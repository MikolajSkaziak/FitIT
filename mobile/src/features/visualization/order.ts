import { useStore } from 'zustand';
import { createStore, type StoreApi } from 'zustand/vanilla';

import { codeOf } from '@/api/problem';
import { isFinal, type OutfitVisualization, type Visualization, type VisualizationStatus } from '@/api/visualizations';

/**
 * - `none`: nothing was ordered for this outfit
 * - `working`: the order is with the server, or on its way there
 * - `ready`: the picture is here
 * - `blocked`: the provider's safety filter would not pass the outfit; an ordinary outcome, not a fault (spec 7.6)
 * - `failed`: the picture did not come out and today's allowance was given back
 * - `refused`: the server would not take the order at all (limit used up, no consent, paused, no connection)
 */
export type OrderStage = 'none' | 'working' | 'ready' | 'blocked' | 'failed' | 'refused';

export interface Picture {
  url: string;
  cacheKey: string | null;
}

export interface OrderState {
  stage: OrderStage;
  picture: Picture | null;
  /** Machine code of why it did not come out, or of the refusal; the words for it are in `copy`. */
  errorCode: string | null;
  /** 0 to 1, from how long the order has been running against how long one usually takes. */
  progress: number;
}

/** Everything the order needs from the outside world, so tests can stand in for the server and the clock. */
export interface OrderDeps {
  request: (outfitId: string, idempotencyKey: string) => Promise<Visualization>;
  read: (id: string) => Promise<Visualization>;
  wait: (ms: number) => Promise<void>;
  newKey: () => string;
  /** The server's record as it now stands, so the outfit it belongs to carries it after the screen is gone. */
  onRecord: (record: Visualization) => void;
}

export interface OrderOptions {
  /** How often the server is asked about a running order; the spec says two to three seconds. */
  pollMs: number;
  /** How long a picture usually takes. The progress bar is measured against this, never past it. */
  expectedMs: number;
}

const defaults: OrderOptions = { pollMs: 2500, expectedMs: 40_000 };

const idle: OrderState = { stage: 'none', picture: null, errorCode: null, progress: 0 };

/** A sliver is visible from the first moment, and the bar never claims to be finished before the picture is. */
export const progressOf = (elapsedMs: number, expectedMs: number = defaults.expectedMs): number => Math.min(0.92, 0.08 + elapsedMs / expectedMs);

export interface VisualizationOrder {
  store: StoreApi<OrderState>;
  /**
   * Orders the picture, or sends the order that was refused once again. An outfit that is not stored yet comes with
   * `prepare`, which stores it and answers with the id to order the picture for.
   */
  start: (prepare?: () => Promise<string>) => void;
  /** Takes over an order the server already has: the one that came attached to the outfit. */
  adopt: (known: OutfitVisualization) => void;
  /** Stops asking. The server carries on, and the picture waits by the outfit. */
  stop: () => void;
}

/**
 * One outfit's picture, from the order to the result: sends the request, then asks every couple of seconds until the
 * answer is final. Nothing here touches React, a real clock or the network, so the whole flow can be tested as it is.
 */
export function createVisualizationOrder(outfitId: string, deps: OrderDeps, options: Partial<OrderOptions> = {}): VisualizationOrder {
  const settings = { ...defaults, ...options };
  const store = createStore<OrderState>(() => idle);
  let generation = 0;
  let live = false;
  // Held until the server answers with a record: a request lost on the way must not order a second picture.
  let key: string | null = null;

  function settle(record: Visualization): void {
    if (record.status === 'completed') {
      store.setState(
        record.imageUrl
          ? { stage: 'ready', picture: { url: record.imageUrl, cacheKey: record.imageKey }, errorCode: null, progress: 1 }
          : // Finished without a picture: nothing to show, so it reads as a failure rather than an empty frame.
            { stage: 'failed', picture: null, errorCode: 'invalid_image', progress: 0 },
      );
      return;
    }

    store.setState({ stage: record.status === 'blocked' ? 'blocked' : 'failed', picture: null, errorCode: record.errorCode, progress: 0 });
  }

  /** Runs one order to its end: `begin` either places it or picks up one that exists. */
  async function run(begin: () => Promise<Visualization>): Promise<void> {
    if (live) {
      return;
    }

    live = true;
    const mine = ++generation;
    let elapsed = 0;
    store.setState({ stage: 'working', picture: null, errorCode: null, progress: progressOf(0, settings.expectedMs) });
    try {
      let record: Visualization;
      try {
        record = await begin();
      } catch (error) {
        if (mine === generation) {
          store.setState({ stage: 'refused', errorCode: codeOf(error) });
        }

        return;
      }

      // The order exists and is known by its own id from now on; the key has done its work.
      key = null;
      let reported: VisualizationStatus | null = null;
      for (;;) {
        if (mine !== generation) {
          return;
        }

        if (record.status !== reported) {
          reported = record.status;
          deps.onRecord(record);
        }

        if (isFinal(record.status)) {
          settle(record);
          return;
        }

        await deps.wait(settings.pollMs);
        if (mine !== generation) {
          return;
        }

        elapsed += settings.pollMs;
        store.setState({ progress: progressOf(elapsed, settings.expectedMs) });
        try {
          record = await deps.read(record.id);
        } catch (error) {
          // A moment without a connection is not the picture's failure: ask again on the next round.
          if (codeOf(error) === 'not_found') {
            store.setState({ stage: 'failed', errorCode: 'not_found' });
            return;
          }
        }
      }
    } finally {
      if (mine === generation) {
        live = false;
      }
    }
  }

  return {
    store,
    start: (prepare) => {
      const sending = (key ??= deps.newKey());
      void run(async () => deps.request(prepare ? await prepare() : outfitId, sending));
    },
    adopt: (known) => {
      if (known.status === 'completed' && known.imageUrl) {
        generation++;
        live = false;
        store.setState({ stage: 'ready', picture: { url: known.imageUrl, cacheKey: known.imageKey }, errorCode: null, progress: 1 });
        return;
      }

      void run(() => deps.read(known.id));
    },
    stop: () => {
      generation++;
      live = false;
    },
  };
}

/** Subscribes a component to one outfit's order. */
export const useOrder = <T,>(order: VisualizationOrder, selector: (state: OrderState) => T): T => useStore(order.store, selector);
