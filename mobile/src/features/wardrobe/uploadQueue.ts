import { useStore } from 'zustand';
import { createStore, type StoreApi } from 'zustand/vanilla';

import { codeOf } from '@/api/problem';
import type { Clothing, RejectReason, UploadTicket } from '@/api/wardrobe';

import type { LocalPhoto } from './photos';

/**
 * - `waiting`: in line behind other uploads
 * - `preparing`: being shrunk on the phone
 * - `uploading`: on its way to storage
 * - `processing`: with the server, which is removing the background and describing the garment
 * - `ready`: in the wardrobe
 * - `needs_tags`: in the wardrobe, but the description has to be filled in by hand
 * - `rejected`: not a single wearable garment; never entered the wardrobe
 * - `failed`: did not get through; can be tried again
 */
export type UploadStatus = 'waiting' | 'preparing' | 'uploading' | 'processing' | 'ready' | 'needs_tags' | 'rejected' | 'failed';

export interface UploadEntry {
  id: string;
  photo: LocalPhoto;
  status: UploadStatus;
  /** 0 to 1 of the upload itself. */
  progress: number;
  /** The garment on the server, once it exists. */
  itemId: string | null;
  name: string | null;
  rejectReason: RejectReason | null;
  /** Machine code of what went wrong; the screen has the words for it. */
  errorCode: string | null;
}

/** Everything the queue needs from the outside world, so tests can stand in for the phone and the server. */
export interface UploadDeps {
  prepare: (photo: LocalPhoto) => Promise<string>;
  createUpload: () => Promise<UploadTicket>;
  put: (ticket: UploadTicket, fileUri: string, onProgress: (fraction: number) => void) => Promise<void>;
  confirm: (key: string) => Promise<Clothing>;
  fetchByIds: (ids: string[]) => Promise<Clothing[]>;
  /** Called whenever the wardrobe on the server changed (a garment appeared or reached its final state), so lists can reload. */
  onWardrobeChanged: () => void;
  wait: (ms: number) => Promise<void>;
  newId: () => string;
}

export interface UploadOptions {
  /** How many photos travel at once. Two keeps a mobile connection responsive. */
  concurrency: number;
  pollMs: number;
  /** Extra tries after a lost connection, with a growing pause between them. */
  networkRetries: number;
}

const defaults: UploadOptions = { concurrency: 2, pollMs: 2500, networkRetries: 2 };

const inFlight: readonly UploadStatus[] = ['waiting', 'preparing', 'uploading'];

interface QueueState {
  entries: UploadEntry[];
}

export interface UploadQueue {
  store: StoreApi<QueueState>;
  /** Puts photos in line and starts sending. */
  add: (photos: readonly LocalPhoto[]) => void;
  /** Sends a failed photo again from the start. */
  retry: (id: string) => void;
  /** Drops entries that need no more attention (ready or rejected ones the person has seen). */
  clearSettled: () => void;
  /** Forgets everything: used when the person signs out. */
  reset: () => void;
  /** Photos not yet counted by the server against today's limit. */
  pendingCount: () => number;
}

export function createUploadQueue(deps: UploadDeps, options: Partial<UploadOptions> = {}): UploadQueue {
  const settings = { ...defaults, ...options };
  const store = createStore<QueueState>(() => ({ entries: [] }));
  let running = 0;
  let polling = false;
  let generation = 0;

  const find = (id: string) => store.getState().entries.find((entry) => entry.id === id);
  const patch = (id: string, change: Partial<UploadEntry>) =>
    store.setState((state) => ({ entries: state.entries.map((entry) => (entry.id === id ? { ...entry, ...change } : entry)) }));

  /** Repeats `step` after a lost connection; any other failure is final at once (asking again would get the same answer). */
  async function persistent<T>(step: () => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await step();
      } catch (error) {
        if (codeOf(error) !== 'network' || attempt >= settings.networkRetries) {
          throw error;
        }

        await deps.wait(1000 * (attempt + 1));
      }
    }
  }

  /** Brings an entry in line with what the server says about its garment. */
  function apply(item: Clothing): void {
    const entry = store.getState().entries.find((candidate) => candidate.itemId === item.id);
    if (!entry || entry.status !== 'processing') {
      return;
    }

    if (item.status === 'ready') {
      patch(entry.id, { status: 'ready', name: item.name });
    } else if (item.status === 'failed') {
      patch(entry.id, { status: 'needs_tags' });
    } else if (item.status === 'rejected') {
      patch(entry.id, { status: 'rejected', rejectReason: item.rejectReason });
    } else {
      return;
    }

    deps.onWardrobeChanged();
  }

  async function poll(): Promise<void> {
    if (polling) {
      return;
    }

    polling = true;
    const started = generation;
    try {
      const processing = () => store.getState().entries.filter((entry) => entry.status === 'processing' && entry.itemId);
      for (;;) {
        if (processing().length === 0 || started !== generation) {
          return;
        }

        await deps.wait(settings.pollMs);
        if (started !== generation) {
          return;
        }

        // Read after the pause, so photos that arrived during it are asked about in this round.
        const watched = processing();
        if (watched.length === 0) {
          return;
        }

        try {
          const ids = watched.map((entry) => entry.itemId as string);
          const items = await deps.fetchByIds(ids);
          items.forEach(apply);
          for (const entry of watched) {
            // Deleted from another screen while it was being described.
            if (!items.some((item) => item.id === entry.itemId) && find(entry.id)?.status === 'processing') {
              patch(entry.id, { status: 'failed', errorCode: 'not_found' });
            }
          }
        } catch {
          // No connection for a moment is not the garment's failure: ask again on the next round.
        }
      }
    } finally {
      polling = false;
    }
  }

  async function send(id: string): Promise<void> {
    const entry = find(id);
    if (!entry) {
      return;
    }

    const started = generation;
    try {
      const file = await deps.prepare(entry.photo);
      const ticket = await persistent(() => deps.createUpload());
      patch(id, { status: 'uploading', progress: 0 });
      await persistent(() => deps.put(ticket, file, (fraction) => patch(id, { progress: Math.max(0, Math.min(1, fraction)) })));
      const item = await persistent(() => deps.confirm(ticket.key));
      if (started !== generation) {
        return;
      }

      patch(id, { status: 'processing', progress: 1, itemId: item.id });
      deps.onWardrobeChanged();
      apply(item);
      void poll();
    } catch (error) {
      if (started === generation) {
        patch(id, { status: 'failed', errorCode: codeOf(error) });
      }
    }
  }

  function pump(): void {
    while (running < settings.concurrency) {
      const next = store.getState().entries.find((entry) => entry.status === 'waiting');
      if (!next) {
        return;
      }

      running++;
      // Claimed before the first await, so the next turn of the loop cannot pick the same photo.
      patch(next.id, { status: 'preparing', errorCode: null, progress: 0 });
      void send(next.id).finally(() => {
        running--;
        pump();
      });
    }
  }

  return {
    store,
    add: (photos) => {
      const added: UploadEntry[] = photos.map((photo) => ({
        id: deps.newId(),
        photo,
        status: 'waiting',
        progress: 0,
        itemId: null,
        name: null,
        rejectReason: null,
        errorCode: null,
      }));
      store.setState((state) => ({ entries: [...state.entries, ...added] }));
      pump();
    },
    retry: (id) => {
      if (find(id)?.status === 'failed') {
        patch(id, { status: 'waiting', errorCode: null, progress: 0, itemId: null });
        pump();
      }
    },
    clearSettled: () => store.setState((state) => ({ entries: state.entries.filter((entry) => entry.status !== 'ready' && entry.status !== 'rejected') })),
    reset: () => {
      generation++;
      store.setState({ entries: [] });
    },
    pendingCount: () => store.getState().entries.filter((entry) => inFlight.includes(entry.status)).length,
  };
}

/** Subscribes a component to a queue. */
export const useQueue = <T,>(queue: UploadQueue, selector: (state: QueueState) => T): T => useStore(queue.store, selector);

export const isInFlight = (entry: UploadEntry): boolean => inFlight.includes(entry.status);
