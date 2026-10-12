import { createStore, type StoreApi } from 'zustand/vanilla';

import { codeOf } from '@/api/problem';
import type { ClothingPhoto, UploadTicket } from '@/api/wardrobe';
import * as haptics from '@/lib/haptics';

import type { LocalPhoto } from './photos';

/**
 * - `waiting`: in line behind another photo
 * - `preparing`: being shrunk on the phone
 * - `uploading`: on its way to storage
 * - `failed`: did not get through; can be tried again or let go
 *
 * A photo that got through leaves the list: from then on the garment itself carries it.
 */
export type ExtraStatus = 'waiting' | 'preparing' | 'uploading' | 'failed';

export interface ExtraEntry {
  id: string;
  /** The garment the photo is one more picture of. */
  garmentId: string;
  photo: LocalPhoto;
  status: ExtraStatus;
  /** 0 to 1 of the upload itself. */
  progress: number;
  /** Machine code of what went wrong; the screen has the words for it. */
  errorCode: string | null;
}

/** Everything the list needs from the outside world, so tests can stand in for the phone and the server. */
export interface ExtraDeps {
  prepare: (photo: LocalPhoto) => Promise<string>;
  createUpload: (garmentId: string) => Promise<UploadTicket>;
  put: (ticket: UploadTicket, fileUri: string, onProgress: (fraction: number) => void) => Promise<void>;
  confirm: (garmentId: string, key: string) => Promise<ClothingPhoto>;
  /** The server has the photo: whoever shows the garment adds it to what they hold. */
  onAdded: (garmentId: string, photo: ClothingPhoto) => void;
  wait: (ms: number) => Promise<void>;
  newId: () => string;
}

interface ExtraState {
  entries: ExtraEntry[];
}

export interface ExtraPhotoQueue {
  store: StoreApi<ExtraState>;
  /** Puts more photos of a garment in line and starts sending. */
  add: (garmentId: string, photos: readonly LocalPhoto[]) => void;
  /** Sends a failed photo again from the start. */
  retry: (id: string) => void;
  /** Lets a failed photo go. */
  discard: (id: string) => void;
  /** Forgets everything: used when the person signs out. */
  reset: () => void;
}

/** Extra tries after a lost connection, with a growing pause between them: the same patience as the queue for new clothes. */
const networkRetries = 2;

/**
 * More photos of garments on their way to the server. Unlike a new garment, such a photo is only stored: nothing is
 * described, so it is done the moment the server has it. One travels at a time, so they arrive in the order they were added.
 */
export function createExtraPhotoQueue(deps: ExtraDeps): ExtraPhotoQueue {
  const store = createStore<ExtraState>(() => ({ entries: [] }));
  let generation = 0;
  /** The generation whose photos are being sent, if any are. */
  let pumping: number | null = null;

  const patch = (id: string, change: Partial<ExtraEntry>) =>
    store.setState((state) => ({ entries: state.entries.map((entry) => (entry.id === id ? { ...entry, ...change } : entry)) }));
  const drop = (id: string) => store.setState((state) => ({ entries: state.entries.filter((entry) => entry.id !== id) }));

  /** Repeats `step` after a lost connection; any other failure is final at once. */
  async function persistent<T>(step: () => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await step();
      } catch (error) {
        if (codeOf(error) !== 'network' || attempt >= networkRetries) {
          throw error;
        }

        await deps.wait(1000 * (attempt + 1));
      }
    }
  }

  async function send(entry: ExtraEntry): Promise<void> {
    const started = generation;
    try {
      const file = await deps.prepare(entry.photo);
      const ticket = await persistent(() => deps.createUpload(entry.garmentId));
      patch(entry.id, { status: 'uploading', progress: 0 });
      await persistent(() => deps.put(ticket, file, (fraction) => patch(entry.id, { progress: Math.max(0, Math.min(1, fraction)) })));
      const photo = await persistent(() => deps.confirm(entry.garmentId, ticket.key));
      if (started !== generation) {
        return;
      }

      // Handed over before it leaves the list, so the photo is never missing from both.
      deps.onAdded(entry.garmentId, photo);
      drop(entry.id);
    } catch (error) {
      if (started === generation) {
        const running = !store.getState().entries.some((other) => other.status === 'failed');
        patch(entry.id, { status: 'failed', errorCode: codeOf(error) });
        if (running && codeOf(error) === 'photo_limit_reached') {
          haptics.warning();
        } else if (running) {
          haptics.error();
        }
      }
    }
  }

  async function pump(): Promise<void> {
    if (pumping === generation) {
      return;
    }

    // A pump belongs to its generation: after a reset the old one stops by itself, and a photo of the old session that
    // never gets an answer cannot hold up the new one.
    const mine = generation;
    pumping = mine;
    try {
      while (mine === generation) {
        const next = store.getState().entries.find((entry) => entry.status === 'waiting');
        if (!next) {
          return;
        }

        patch(next.id, { status: 'preparing', errorCode: null, progress: 0 });
        await send(next);
      }
    } finally {
      if (pumping === mine) {
        pumping = null;
      }
    }
  }

  return {
    store,
    add: (garmentId, photos) => {
      const added: ExtraEntry[] = photos.map((photo) => ({ id: deps.newId(), garmentId, photo, status: 'waiting', progress: 0, errorCode: null }));
      store.setState((state) => ({ entries: [...state.entries, ...added] }));
      void pump();
    },
    retry: (id) => {
      if (store.getState().entries.find((entry) => entry.id === id)?.status === 'failed') {
        patch(id, { status: 'waiting', errorCode: null, progress: 0 });
        void pump();
      }
    },
    discard: (id) => {
      if (store.getState().entries.find((entry) => entry.id === id)?.status === 'failed') {
        drop(id);
      }
    },
    reset: () => {
      generation++;
      store.setState({ entries: [] });
    },
  };
}
