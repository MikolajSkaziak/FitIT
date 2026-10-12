import * as Haptics from 'expo-haptics';

import { ApiError, networkProblem } from '@/api/problem';
import type { Clothing, UploadTicket } from '@/api/wardrobe';
import { createUploadQueue, type UploadDeps, type UploadEntry } from '@/features/wardrobe/uploadQueue';

const photo = (name: string) => ({ uri: `file:///${name}.heic`, width: 3024, height: 4032 });
const garment = (id: string, change: Partial<Clothing> = {}) => ({ id, status: 'processing', name: null, rejectReason: null, ...change }) as Clothing;

/** Lets every queued microtask and resolved promise run. */
const settle = async () => {
  for (let i = 0; i < 20; i++) {
    await Promise.resolve();
  }
};

function setup(overrides: Partial<UploadDeps> = {}) {
  let tickets = 0;
  let ids = 0;
  const server = new Map<string, Clothing>();
  const waits: number[] = [];
  let releaseWait: (() => void) | null = null;
  const deps: UploadDeps = {
    prepare: jest.fn(async (shot) => shot.uri.replace('.heic', '.jpg')),
    createUpload: jest.fn(async () => {
      tickets++;
      return { key: `u/me/orig/${tickets}.jpg`, url: `https://storage.test/${tickets}`, method: 'PUT', headers: { 'Content-Type': 'image/jpeg' }, expiresAt: '', maxBytes: 2_000_000 } as UploadTicket;
    }),
    put: jest.fn(async (_ticket, _file, onProgress) => {
      onProgress(0.5);
      onProgress(1);
    }),
    confirm: jest.fn(async (key) => {
      const item = garment(`item-${key}`);
      server.set(item.id, item);
      return item;
    }),
    fetchByIds: jest.fn(async (wanted) => wanted.flatMap((id) => (server.has(id) ? [server.get(id) as Clothing] : []))),
    onWardrobeChanged: jest.fn(),
    // Pauses are under the test's control: nothing here waits on a real clock.
    wait: jest.fn(
      (ms) =>
        new Promise<void>((resolve) => {
          waits.push(ms);
          releaseWait = resolve;
        }),
    ),
    newId: () => `local-${++ids}`,
    ...overrides,
  };
  const queue = createUploadQueue(deps);
  const entries = () => queue.store.getState().entries;
  const tick = async () => {
    releaseWait?.();
    releaseWait = null;
    await settle();
  };
  return { queue, deps, server, entries, waits, tick };
}

const statuses = (entries: UploadEntry[]) => entries.map((entry) => entry.status);

describe('the upload queue', () => {
  it('takes a photo from the phone to a described garment in the wardrobe', async () => {
    const { queue, deps, server, entries, tick } = setup();

    queue.add([photo('a')]);
    await settle();

    expect(deps.prepare).toHaveBeenCalledWith(photo('a'));
    expect(deps.put).toHaveBeenCalledWith(expect.objectContaining({ key: 'u/me/orig/1.jpg' }), 'file:///a.jpg', expect.any(Function));
    expect(deps.confirm).toHaveBeenCalledWith('u/me/orig/1.jpg');
    expect(entries()[0]).toMatchObject({ status: 'processing', progress: 1, itemId: 'item-u/me/orig/1.jpg' });

    server.set('item-u/me/orig/1.jpg', garment('item-u/me/orig/1.jpg', { status: 'ready', name: 'Granatowa koszula oxford' }));
    await tick();

    expect(entries()[0]).toMatchObject({ status: 'ready', name: 'Granatowa koszula oxford' });
    // Once when the garment appeared on the server, once when it was described.
    expect(deps.onWardrobeChanged).toHaveBeenCalledTimes(2);
  });

  it('sends two photos at a time and keeps the rest in line', async () => {
    const release: (() => void)[] = [];
    const { queue, entries } = setup({ put: jest.fn(() => new Promise<void>((resolve) => release.push(resolve))) });

    queue.add([photo('a'), photo('b'), photo('c'), photo('d')]);
    await settle();

    expect(statuses(entries())).toEqual(['uploading', 'uploading', 'waiting', 'waiting']);
    expect(queue.pendingCount()).toBe(4);

    release[0]?.();
    await settle();

    expect(statuses(entries())).toEqual(['processing', 'uploading', 'uploading', 'waiting']);
    expect(queue.pendingCount()).toBe(3);
  });

  it('shows how much of a photo has gone out', async () => {
    let report: (fraction: number) => void = () => {};
    const { queue, entries } = setup({
      put: jest.fn(
        (_ticket, _file, onProgress) =>
          new Promise<void>(() => {
            report = onProgress;
          }),
      ),
    });

    queue.add([photo('a')]);
    await settle();
    report(0.6);

    expect(entries()[0]).toMatchObject({ status: 'uploading', progress: 0.6 });
  });

  it('tries again by itself after a lost connection, pausing longer each time', async () => {
    let attempts = 0;
    const { queue, entries, waits, tick } = setup({
      put: jest.fn(async () => {
        if (++attempts < 3) {
          throw new ApiError(networkProblem);
        }
      }),
    });

    queue.add([photo('a')]);
    await settle();
    expect(entries()[0]?.status).toBe('uploading');
    await tick();
    await tick();

    expect(attempts).toBe(3);
    expect(waits.slice(0, 2)).toEqual([1000, 2000]);
    expect(entries()[0]?.status).toBe('processing');
  });

  it('gives up after three lost connections and can be sent again by hand', async () => {
    let offline = true;
    const { queue, deps, entries, tick } = setup({
      put: jest.fn(async () => {
        if (offline) {
          throw new ApiError(networkProblem);
        }
      }),
    });

    queue.add([photo('a')]);
    await settle();
    await tick();
    await tick();

    expect(entries()[0]).toMatchObject({ status: 'failed', errorCode: 'network' });
    expect(deps.put).toHaveBeenCalledTimes(3);

    offline = false;
    queue.retry('local-1');
    await settle();

    expect(entries()[0]).toMatchObject({ status: 'processing', errorCode: null });
    expect(deps.createUpload).toHaveBeenCalledTimes(2);
  });

  it('does not repeat a request the server has refused', async () => {
    const { queue, deps, entries } = setup({
      createUpload: jest.fn(async () => {
        throw new ApiError({ status: 429, code: 'limit_reached' });
      }),
    });

    queue.add([photo('a'), photo('b')]);
    await settle();

    expect(statuses(entries())).toEqual(['failed', 'failed']);
    expect(entries()[0]?.errorCode).toBe('limit_reached');
    expect(deps.createUpload).toHaveBeenCalledTimes(2);
    expect(deps.put).not.toHaveBeenCalled();
    expect(queue.pendingCount()).toBe(0);
  });

  it('reports a photo that is not a garment, and one that needs its tags filled in', async () => {
    const { queue, server, entries, tick, deps } = setup();
    queue.add([photo('a'), photo('b')]);
    await settle();

    server.set('item-u/me/orig/1.jpg', garment('item-u/me/orig/1.jpg', { status: 'rejected', rejectReason: 'several_garments' }));
    server.set('item-u/me/orig/2.jpg', garment('item-u/me/orig/2.jpg', { status: 'failed' }));
    await tick();

    expect(entries()[0]).toMatchObject({ status: 'rejected', rejectReason: 'several_garments' });
    expect(entries()[1]).toMatchObject({ status: 'needs_tags' });
    expect(deps.onWardrobeChanged).toHaveBeenCalledTimes(4);
  });

  it('keeps asking about a garment while the connection comes and goes, and stops once nothing is pending', async () => {
    let online = false;
    const { queue, deps, server, entries, tick } = setup();
    (deps.fetchByIds as jest.Mock).mockImplementation(async (wanted: string[]) => {
      if (!online) {
        throw new ApiError(networkProblem);
      }

      return wanted.map((id) => server.get(id));
    });
    queue.add([photo('a')]);
    await settle();

    await tick();
    expect(entries()[0]?.status).toBe('processing');

    online = true;
    server.set('item-u/me/orig/1.jpg', garment('item-u/me/orig/1.jpg', { status: 'ready', name: 'White sneakers' }));
    await tick();
    expect(entries()[0]?.status).toBe('ready');

    const asked = (deps.fetchByIds as jest.Mock).mock.calls.length;
    await tick();
    await tick();
    expect(deps.fetchByIds).toHaveBeenCalledTimes(asked);
  });

  it('marks a garment that was deleted meanwhile instead of waiting for it forever', async () => {
    const { queue, server, entries, tick } = setup();
    queue.add([photo('a')]);
    await settle();

    server.clear();
    await tick();

    expect(entries()[0]).toMatchObject({ status: 'failed', errorCode: 'not_found' });
  });

  it('clears what is finished and keeps what still needs attention', async () => {
    const { queue, server, entries, tick } = setup({
      prepare: jest.fn(async (shot) => {
        if (shot.uri.includes('broken')) {
          throw new Error('cannot read');
        }

        return shot.uri;
      }),
    });
    queue.add([photo('a'), photo('broken')]);
    await settle();
    server.set('item-u/me/orig/1.jpg', garment('item-u/me/orig/1.jpg', { status: 'ready', name: 'Sweter' }));
    await tick();
    expect(statuses(entries())).toEqual(['ready', 'failed']);

    queue.clearSettled();

    expect(statuses(entries())).toEqual(['failed']);
  });

  it('forgets everything on reset, including uploads that finish afterwards', async () => {
    let finish: () => void = () => {};
    const { queue, entries, deps } = setup({
      put: jest.fn(
        () =>
          new Promise<void>((resolve) => {
            finish = resolve;
          }),
      ),
    });
    queue.add([photo('a')]);
    await settle();

    queue.reset();
    finish();
    await settle();

    expect(entries()).toEqual([]);
    expect(deps.onWardrobeChanged).not.toHaveBeenCalled();
  });
});

describe('feeling a photo that did not get through', () => {
  const notification = jest.mocked(Haptics.notificationAsync);
  beforeEach(() => jest.clearAllMocks());

  it('gives the error cue once for a batch that fails together, not once for each photo', async () => {
    const { queue, entries } = setup({
      createUpload: jest.fn(async () => {
        throw new ApiError({ status: 500, code: 'server_error' });
      }),
    });

    queue.add([photo('a'), photo('b'), photo('c')]);
    await settle();

    expect(statuses(entries())).toEqual(['failed', 'failed', 'failed']);
    expect(notification.mock.calls).toEqual([['error']]);
  });

  it('gives the warning, and not the error, when the day’s limit is what refused it', async () => {
    const { queue } = setup({
      createUpload: jest.fn(async () => {
        throw new ApiError({ status: 429, code: 'limit_reached' });
      }),
    });

    queue.add([photo('a'), photo('b')]);
    await settle();

    expect(notification.mock.calls).toEqual([['warning']]);
  });

  it('gives the cue again when a photo sent again fails again', async () => {
    const { queue, entries } = setup({
      createUpload: jest.fn(async () => {
        throw new ApiError({ status: 500, code: 'server_error' });
      }),
    });
    queue.add([photo('a')]);
    await settle();
    expect(notification).toHaveBeenCalledTimes(1);

    queue.retry(entries()[0]?.id ?? '');
    await settle();

    expect(notification.mock.calls).toEqual([['error'], ['error']]);
  });

  it('is silent for photos that go through', async () => {
    const { queue, entries } = setup();

    queue.add([photo('a')]);
    await settle();

    expect(statuses(entries())).toEqual(['processing']);
    expect(notification).not.toHaveBeenCalled();
  });
});
