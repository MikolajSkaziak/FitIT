import { firstOutfitHint, missingForFirstOutfit } from '@/features/wardrobe/firstOutfit';
import { fitWithin } from '@/features/wardrobe/photos';
import { garments, plural } from '@/lib/plural';

jest.mock('expo-image-picker', () => ({}));
jest.mock('expo-image-manipulator', () => ({ ImageManipulator: {}, SaveFormat: { JPEG: 'jpeg' } }));

const ready = (category: string) => ({ status: 'ready', category }) as never;

describe('what the first outfit still needs', () => {
  it('is a top, a bottom and shoes for an empty wardrobe', () => {
    expect(missingForFirstOutfit([])).toEqual(['top', 'bottom', 'shoes']);
    expect(firstOutfitHint(['top', 'bottom', 'shoes'])).toBe('Add tops, bottoms, and shoes to get your first outfit.');
  });

  it('is nothing once there is one of each', () => {
    expect(missingForFirstOutfit([ready('top'), ready('bottom'), ready('shoes')])).toEqual([]);
    expect(firstOutfitHint([])).toBeNull();
  });

  it('lets a sweater stand in for a top and a dress for top and bottom', () => {
    expect(missingForFirstOutfit([ready('mid_layer'), ready('bottom')])).toEqual(['shoes']);
    expect(missingForFirstOutfit([ready('one_piece')])).toEqual(['shoes']);
    expect(firstOutfitHint(['shoes'])).toBe('Add shoes to get your first outfit.');
    expect(firstOutfitHint(['bottom', 'shoes'])).toBe('Add bottoms and shoes to get your first outfit.');
  });

  it('counts only garments that are ready', () => {
    const waiting = [{ status: 'processing', category: null }, { status: 'failed', category: null }] as never[];
    expect(missingForFirstOutfit([...waiting, ready('outerwear'), ready('accessory')])).toEqual(['top', 'bottom', 'shoes']);
  });
});

describe('fitting a photo into 1280', () => {
  it('leaves a small photo alone', () => {
    expect(fitWithin(1280, 960)).toBeNull();
    expect(fitWithin(800, 1280)).toBeNull();
  });

  it('shrinks by the longer side and lets the other follow', () => {
    expect(fitWithin(4032, 3024)).toEqual({ width: 1280, height: null });
    expect(fitWithin(3024, 4032)).toEqual({ width: null, height: 1280 });
    expect(fitWithin(2000, 2000)).toEqual({ width: 1280, height: null });
  });
});

describe('plurals', () => {
  it.each([
    [0, '0 items'],
    [1, '1 item'],
    [2, '2 items'],
    [5, '5 items'],
    [12, '12 items'],
    [21, '21 items'],
    [112, '112 items'],
  ])('%i reads %s', (count, text) => {
    expect(garments(count)).toBe(text);
  });

  it('works for other nouns', () => {
    expect(plural(3, ['outfit', 'outfits'])).toBe('outfits');
    expect(plural(1, ['outfit', 'outfits'])).toBe('outfit');
  });
});

describe('the garment form', () => {
  const { missingTags, toggleColor } = jest.requireActual<typeof import('@/features/wardrobe/garmentForm')>('@/features/wardrobe/garmentForm');
  const { describeEntry } = jest.requireActual<typeof import('@/features/wardrobe/uploadCopy')>('@/features/wardrobe/uploadCopy');
  const empty = { name: ' ', group: null, subcategory: null, colors: [], pattern: null, material: null, formality: null, warmth: null, rainOk: false, styles: [], seasons: [] };

  it('names everything that is still missing, in the order of the form', () => {
    expect(missingTags(empty)).toEqual(['name', 'group', 'type', 'color', 'pattern', 'material', 'formality', 'warmth']);
    expect(
      missingTags({ ...empty, name: 'Jeans', group: 'jeans', subcategory: 'jeans', colors: ['blue'], pattern: 'plain', material: 'denim', formality: 2, warmth: 3 }),
    ).toEqual([]);
  });

  it('keeps one or two colors with the main one first', () => {
    expect(toggleColor([], 'navy')).toEqual(['navy']);
    expect(toggleColor(['navy'], 'white')).toEqual(['navy', 'white']);
    expect(toggleColor(['navy', 'white'], 'red')).toEqual(['navy', 'red']);
    expect(toggleColor(['navy', 'white'], 'navy')).toEqual(['white']);
  });

  it('has words for every state of an upload', () => {
    const say = (status: string, extra = {}) => describeEntry({ status, rejectReason: null, errorCode: null, ...extra } as never);
    expect(say('waiting')).toEqual({ text: 'Waiting', trouble: false });
    expect(say('uploading').text).toBe('Uploading');
    expect(say('processing').text).toBe('Describing your photo');
    expect(say('ready').text).toBe('Ready');
    expect(say('needs_tags').trouble).toBe(false);
    expect(say('rejected', { rejectReason: 'several_garments' })).toEqual({ text: 'This photo has several items. Take one photo per item.', trouble: true });
    expect(say('failed', { errorCode: 'network' })).toEqual({ text: 'Can’t connect right now. Check your internet connection and try again.', trouble: true });
    expect(say('failed', { errorCode: 'limit_reached' }).text).toBe('You’ve hit today’s limit. More tomorrow.');
  });
});
