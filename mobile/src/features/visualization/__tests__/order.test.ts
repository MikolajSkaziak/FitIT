import { ApiError, networkProblem } from '@/api/problem';
import type { Visualization, VisualizationStatus } from '@/api/visualizations';
import { createVisualizationOrder, progressOf, type OrderDeps } from '@/features/visualization/order';

const picture = { imageUrl: 'https://images.test/v1.jpg', imageKey: 'u/me/vis/v1.jpg' };

const record = (status: VisualizationStatus, change: Partial<Visualization> = {}): Visualization => ({
  id: 'v1',
  outfitId: 'o1',
  status,
  imageUrl: status === 'completed' ? picture.imageUrl : null,
  imageKey: status === 'completed' ? picture.imageKey : null,
  errorCode: null,
  createdAt: '2026-10-07T09:00:00Z',
  completedAt: null,
  ...change,
});

/** Lets every queued microtask and resolved promise run. */
const settle = async () => {
  for (let i = 0; i < 20; i++) {
    await Promise.resolve();
  }
};

function setup(overrides: Partial<OrderDeps> = {}) {
  let keys = 0;
  const waits: number[] = [];
  let releaseWait: (() => void) | null = null;
  let answer = record('pending');
  const deps: OrderDeps = {
    request: jest.fn(async () => answer),
    read: jest.fn(async () => answer),
    // Pauses are under the test's control: nothing here waits on a real clock.
    wait: jest.fn(
      (ms) =>
        new Promise<void>((resolve) => {
          waits.push(ms);
          releaseWait = resolve;
        }),
    ),
    newKey: () => `key-${++keys}`,
    onRecord: jest.fn(),
    ...overrides,
  };
  const order = createVisualizationOrder('o1', deps);
  const state = () => order.store.getState();
  const tick = async () => {
    releaseWait?.();
    releaseWait = null;
    await settle();
  };
  return { order, deps, state, waits, tick, serves: (next: Visualization) => (answer = next) };
}

describe('one outfit on the silhouette', () => {
  it('orders the picture, keeps asking while it is being made, and shows it when it is here', async () => {
    const { order, deps, state, waits, tick, serves } = setup();

    order.start();
    await settle();

    expect(deps.request).toHaveBeenCalledWith('o1', 'key-1');
    expect(state()).toMatchObject({ stage: 'working', picture: null, progress: progressOf(0) });
    expect(waits).toEqual([2500]);

    serves(record('running'));
    await tick();
    expect(deps.read).toHaveBeenCalledWith('v1');
    expect(state()).toMatchObject({ stage: 'working', progress: progressOf(2500) });

    serves(record('completed'));
    await tick();

    expect(state()).toMatchObject({ stage: 'ready', picture: { url: picture.imageUrl, cacheKey: picture.imageKey }, progress: 1 });
  });

  it('shows a bar that moves from the first moment and never reaches the end before the picture does', () => {
    expect(progressOf(0)).toBeCloseTo(0.08);
    expect(progressOf(20_000)).toBeCloseTo(0.58);
    expect(progressOf(600_000)).toBe(0.92);
  });

  it('stops asking once the answer is final', async () => {
    const { order, deps, tick, serves } = setup();
    order.start();
    await settle();
    serves(record('completed'));
    await tick();

    const asked = (deps.read as jest.Mock).mock.calls.length;
    await tick();
    await tick();

    expect(deps.read).toHaveBeenCalledTimes(asked);
  });

  it('reports every step of the order, so it stays with the outfit after the screen is gone', async () => {
    const { order, deps, tick, serves } = setup();

    order.start();
    await settle();
    expect(deps.onRecord).toHaveBeenCalledWith(record('pending'));

    serves(record('running'));
    await tick();
    serves(record('running'));
    await tick();
    // The same answer twice is one step, not two.
    expect(deps.onRecord).toHaveBeenCalledTimes(2);

    serves(record('completed'));
    await tick();
    expect(deps.onRecord).toHaveBeenLastCalledWith(record('completed'));
  });

  it('treats the safety filter as an answer about the picture, with the reason it gave', async () => {
    const { order, state, tick, serves } = setup();
    order.start();
    await settle();

    serves(record('blocked', { errorCode: 'content_blocked' }));
    await tick();

    expect(state()).toMatchObject({ stage: 'blocked', errorCode: 'content_blocked', picture: null });
  });

  it('reads a finished order without a picture as a failure, not as an empty frame', async () => {
    const { order, state, tick, serves } = setup();
    order.start();
    await settle();

    serves(record('completed', { imageUrl: null, imageKey: null }));
    await tick();

    expect(state()).toMatchObject({ stage: 'failed', errorCode: 'invalid_image' });
  });

  it('keeps the key of an order the server never took, so sending it again costs no second picture', async () => {
    let offline = true;
    const { order, deps, state } = setup({
      request: jest.fn(async () => {
        if (offline) {
          throw new ApiError(networkProblem);
        }

        return record('pending');
      }),
    });

    order.start();
    await settle();
    expect(state()).toMatchObject({ stage: 'refused', errorCode: 'network' });

    offline = false;
    order.start();
    await settle();

    expect(deps.request).toHaveBeenNthCalledWith(1, 'o1', 'key-1');
    expect(deps.request).toHaveBeenNthCalledWith(2, 'o1', 'key-1');
    expect(state().stage).toBe('working');
  });

  it('orders a picture that did not come out with a new key, because the old order is finished', async () => {
    const { order, deps, state, tick, serves } = setup();
    order.start();
    await settle();
    serves(record('failed', { errorCode: 'provider_failed' }));
    await tick();
    expect(state()).toMatchObject({ stage: 'failed', errorCode: 'provider_failed' });

    serves(record('pending'));
    order.start();
    await settle();

    expect(deps.request).toHaveBeenLastCalledWith('o1', 'key-2');
  });

  it('ignores a second press while the picture is being made', async () => {
    const { order, deps } = setup();

    order.start();
    await settle();
    order.start();
    order.start();
    await settle();

    expect(deps.request).toHaveBeenCalledTimes(1);
  });

  it('takes over an order that came with the outfit and follows it to the end', async () => {
    const { order, deps, state, tick, serves } = setup();
    serves(record('running'));

    order.adopt({ id: 'v1', status: 'running', imageUrl: null, imageKey: null });
    await settle();

    expect(deps.request).not.toHaveBeenCalled();
    expect(deps.read).toHaveBeenCalledWith('v1');
    expect(state().stage).toBe('working');

    serves(record('completed'));
    await tick();

    expect(state().stage).toBe('ready');
  });

  it('shows a picture the outfit already carries without asking the server again', async () => {
    const { order, deps, state } = setup();

    order.adopt({ id: 'v1', status: 'completed', ...picture });
    await settle();

    expect(deps.read).not.toHaveBeenCalled();
    expect(state()).toMatchObject({ stage: 'ready', picture: { url: picture.imageUrl, cacheKey: picture.imageKey }, progress: 1 });
  });

  it('keeps asking while the connection comes and goes', async () => {
    let online = false;
    let answer = record('running');
    const { order, state, tick } = setup({
      read: jest.fn(async () => {
        if (!online) {
          throw new ApiError(networkProblem);
        }

        return answer;
      }),
    });

    order.start();
    await settle();
    await tick();
    expect(state().stage).toBe('working');

    online = true;
    answer = record('completed');
    await tick();

    expect(state().stage).toBe('ready');
  });

  it('does not wait forever for an order the server no longer knows', async () => {
    const { order, state, tick } = setup({
      read: jest.fn(async () => {
        throw new ApiError({ status: 404, code: 'not_found' });
      }),
    });

    order.start();
    await settle();
    await tick();

    expect(state()).toMatchObject({ stage: 'failed', errorCode: 'not_found' });
  });

  it('stops asking when the screen goes away, and can be asked again afterwards', async () => {
    const { order, deps, state, tick, serves } = setup();
    order.start();
    await settle();

    order.stop();
    serves(record('completed'));
    await tick();

    expect(deps.read).not.toHaveBeenCalled();
    expect(state().stage).toBe('working');

    order.start();
    await settle();

    expect(deps.request).toHaveBeenCalledTimes(2);
    expect(state().stage).toBe('ready');
  });
});
