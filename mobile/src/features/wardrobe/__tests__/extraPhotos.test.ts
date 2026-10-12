import { ApiError, networkProblem } from '@/api/problem';
import type { ClothingPhoto, UploadTicket } from '@/api/wardrobe';
import { createExtraPhotoQueue, type ExtraDeps } from '@/features/wardrobe/extraPhotos';

const photo = (name: string) => ({ uri: `file:///${name}.heic`, width: 3024, height: 4032 });

/** Lets every queued microtask and resolved promise run. */
const settle = async () => {
  for (let i = 0; i < 30; i++) {
    await Promise.resolve();
  }
};

function setup(overrides: Partial<ExtraDeps> = {}) {
  let tickets = 0;
  let ids = 0;
  const deps: ExtraDeps = {
    prepare: jest.fn(async (shot) => shot.uri.replace('.heic', '.jpg')),
    createUpload: jest.fn(async () => {
      tickets++;
      return { key: `u/me/extra/${tickets}.jpg`, url: `https://storage.test/${tickets}`, method: 'PUT', headers: { 'Content-Type': 'image/jpeg' }, expiresAt: '', maxBytes: 2_000_000 } as UploadTicket;
    }),
    put: jest.fn(async (_ticket, _file, onProgress) => {
      onProgress(0.5);
      onProgress(1);
    }),
    confirm: jest.fn(async (_garmentId, key) => ({ id: `photo-${key}`, imageUrl: `https://images.test/${key}`, imageKey: key, width: 960, height: 1280 }) as ClothingPhoto),
    onAdded: jest.fn(),
    wait: jest.fn(async () => undefined),
    newId: () => `local-${++ids}`,
    ...overrides,
  };
  const queue = createExtraPhotoQueue(deps);
  const entries = () => queue.store.getState().entries;
  return { queue, deps, entries };
}

describe('more photos of a garment on their way to the server', () => {
  it('shows each photo at once, sends them one after another in the order added, and hands each over when the server has it', async () => {
    const order: string[] = [];
    const { queue, deps, entries } = setup({
      prepare: jest.fn(async (shot) => {
        order.push(`prepare ${shot.uri}`);
        return shot.uri;
      }),
      confirm: jest.fn(async (_garmentId, key) => {
        order.push(`confirm ${key}`);
        return { id: `photo-${key}`, imageUrl: '', imageKey: key, width: 1, height: 1 };
      }),
    });

    queue.add('g1', [photo('back'), photo('detail')]);

    expect(entries().map((entry) => [entry.garmentId, entry.photo.uri, entry.status])).toEqual([
      ['g1', 'file:///back.heic', 'preparing'],
      ['g1', 'file:///detail.heic', 'waiting'],
    ]);
    await settle();

    expect(order).toEqual(['prepare file:///back.heic', 'confirm u/me/extra/1.jpg', 'prepare file:///detail.heic', 'confirm u/me/extra/2.jpg']);
    expect(deps.createUpload).toHaveBeenCalledWith('g1');
    expect(jest.mocked(deps.onAdded).mock.calls.map(([garmentId, added]) => [garmentId, added.imageKey])).toEqual([
      ['g1', 'u/me/extra/1.jpg'],
      ['g1', 'u/me/extra/2.jpg'],
    ]);
    // A photo that got through leaves the list: the garment carries it from here.
    expect(entries()).toEqual([]);
  });

  it('reports how far the upload has got', async () => {
    let release: () => void = () => undefined;
    const { queue, entries } = setup({
      put: jest.fn(async (_ticket, _file, onProgress) => {
        onProgress(0.4);
        await new Promise<void>((resolve) => {
          release = resolve;
        });
      }),
    });

    queue.add('g1', [photo('back')]);
    await settle();

    expect(entries()[0]).toMatchObject({ status: 'uploading', progress: 0.4 });
    release();
    await settle();
    expect(entries()).toEqual([]);
  });

  it('keeps a photo the server refused with its reason, goes on with the next, and sends it again on retry', async () => {
    const confirm = jest
      .fn<Promise<ClothingPhoto>, [string, string]>()
      .mockRejectedValueOnce(new ApiError({ status: 400, code: 'upload_not_jpeg' }))
      .mockImplementation(async (_garmentId, key) => ({ id: `photo-${key}`, imageUrl: '', imageKey: key, width: 1, height: 1 }));
    const { queue, deps, entries } = setup({ confirm });

    queue.add('g1', [photo('back'), photo('detail')]);
    await settle();

    expect(entries().map((entry) => [entry.photo.uri, entry.status, entry.errorCode])).toEqual([['file:///back.heic', 'failed', 'upload_not_jpeg']]);
    expect(deps.onAdded).toHaveBeenCalledTimes(1);

    queue.retry(entries()[0]!.id);
    await settle();

    expect(entries()).toEqual([]);
    expect(deps.onAdded).toHaveBeenCalledTimes(2);
  });

  it('tries again by itself after a lost connection, and gives up after two more tries', async () => {
    const createUpload = jest.fn<Promise<UploadTicket>, [string]>().mockRejectedValue(new ApiError(networkProblem));
    const { queue, deps, entries } = setup({ createUpload });

    queue.add('g1', [photo('back')]);
    await settle();

    expect(createUpload).toHaveBeenCalledTimes(3);
    expect(jest.mocked(deps.wait).mock.calls).toEqual([[1000], [2000]]);
    expect(entries()[0]).toMatchObject({ status: 'failed', errorCode: 'network' });
  });

  it('is not held up after a reset by a photo of the old session that never got its answer', async () => {
    const confirm = jest
      .fn<Promise<ClothingPhoto>, [string, string]>()
      .mockReturnValueOnce(new Promise(() => undefined))
      .mockImplementation(async (_garmentId, key) => ({ id: `photo-${key}`, imageUrl: '', imageKey: key, width: 1, height: 1 }));
    const { queue, deps, entries } = setup({ confirm });
    queue.add('g1', [photo('stuck')]);
    await settle();
    expect(entries()[0]).toMatchObject({ status: 'uploading' });

    queue.reset();
    queue.add('g2', [photo('back')]);
    await settle();

    expect(entries()).toEqual([]);
    expect(jest.mocked(deps.onAdded).mock.calls.map(([garmentId]) => garmentId)).toEqual(['g2']);
  });

  it('lets a failed photo go, and forgets everything when the person signs out', async () => {
    const { queue, deps, entries } = setup({ confirm: jest.fn(async () => Promise.reject(new ApiError({ status: 409, code: 'photo_limit_reached' }))) });
    queue.add('g1', [photo('back'), photo('detail')]);
    await settle();
    expect(entries().map((entry) => entry.errorCode)).toEqual(['photo_limit_reached', 'photo_limit_reached']);

    queue.discard(entries()[0]!.id);
    expect(entries().map((entry) => entry.photo.uri)).toEqual(['file:///detail.heic']);

    queue.reset();
    expect(entries()).toEqual([]);
    expect(deps.onAdded).not.toHaveBeenCalled();
  });
});
