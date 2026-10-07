import { firstOutfitHint, missingForFirstOutfit } from '@/features/wardrobe/firstOutfit';
import { fitWithin } from '@/features/wardrobe/photos';
import { garments, plural } from '@/lib/plural';

jest.mock('expo-image-picker', () => ({}));
jest.mock('expo-image-manipulator', () => ({ ImageManipulator: {}, SaveFormat: { JPEG: 'jpeg' } }));

const ready = (category: string) => ({ status: 'ready', category }) as never;

describe('what the first outfit still needs', () => {
  it('is a top, a bottom and shoes for an empty wardrobe', () => {
    expect(missingForFirstOutfit([])).toEqual(['top', 'bottom', 'shoes']);
    expect(firstOutfitHint(['top', 'bottom', 'shoes'])).toBe('Do pierwszego zestawu brakuje jeszcze góry, dołu i butów.');
  });

  it('is nothing once there is one of each', () => {
    expect(missingForFirstOutfit([ready('top'), ready('bottom'), ready('shoes')])).toEqual([]);
    expect(firstOutfitHint([])).toBeNull();
  });

  it('lets a sweater stand in for a top and a dress for top and bottom', () => {
    expect(missingForFirstOutfit([ready('mid_layer'), ready('bottom')])).toEqual(['shoes']);
    expect(missingForFirstOutfit([ready('one_piece')])).toEqual(['shoes']);
    expect(firstOutfitHint(['shoes'])).toBe('Do pierwszego zestawu brakuje jeszcze butów.');
    expect(firstOutfitHint(['bottom', 'shoes'])).toBe('Do pierwszego zestawu brakuje jeszcze dołu i butów.');
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

describe('Polish plurals', () => {
  it.each([
    [0, '0 ubrań'],
    [1, '1 ubranie'],
    [2, '2 ubrania'],
    [4, '4 ubrania'],
    [5, '5 ubrań'],
    [12, '12 ubrań'],
    [14, '14 ubrań'],
    [22, '22 ubrania'],
    [25, '25 ubrań'],
    [62, '62 ubrania'],
    [112, '112 ubrań'],
    [124, '124 ubrania'],
  ])('%i reads %s', (count, text) => {
    expect(garments(count)).toBe(text);
  });

  it('works for other nouns', () => {
    expect(plural(3, ['zestaw', 'zestawy', 'zestawów'])).toBe('zestawy');
  });
});

describe('the garment form', () => {
  const { missingTags, toggleColor } = jest.requireActual<typeof import('@/features/wardrobe/garmentForm')>('@/features/wardrobe/garmentForm');
  const { describeEntry } = jest.requireActual<typeof import('@/features/wardrobe/uploadCopy')>('@/features/wardrobe/uploadCopy');
  const empty = { name: ' ', category: null, subcategory: null, colors: [], pattern: null, material: null, formality: null, warmth: null, rainOk: false, styles: [] };

  it('names everything that is still missing, in the order of the form', () => {
    expect(missingTags(empty)).toEqual(['nazwa', 'kategoria', 'typ', 'kolor', 'wzór', 'materiał', 'formalność', 'ciepło']);
    expect(
      missingTags({ ...empty, name: 'Jeansy', category: 'bottom', subcategory: 'jeans', colors: ['blue'], pattern: 'plain', material: 'denim', formality: 2, warmth: 3 }),
    ).toEqual([]);
  });

  it('keeps one or two colours with the main one first', () => {
    expect(toggleColor([], 'navy')).toEqual(['navy']);
    expect(toggleColor(['navy'], 'white')).toEqual(['navy', 'white']);
    expect(toggleColor(['navy', 'white'], 'red')).toEqual(['navy', 'red']);
    expect(toggleColor(['navy', 'white'], 'navy')).toEqual(['white']);
  });

  it('has words for every state of an upload', () => {
    const say = (status: string, extra = {}) => describeEntry({ status, rejectReason: null, errorCode: null, ...extra } as never);
    expect(say('waiting')).toEqual({ text: 'Czeka w kolejce', trouble: false });
    expect(say('uploading').text).toBe('Wysyłanie');
    expect(say('processing').text).toBe('Opisujemy zdjęcie');
    expect(say('ready').text).toBe('Gotowe, opisane');
    expect(say('needs_tags').trouble).toBe(false);
    expect(say('rejected', { rejectReason: 'several_garments' })).toEqual({ text: 'Na zdjęciu jest kilka ubrań. Sfotografuj je osobno.', trouble: true });
    expect(say('failed', { errorCode: 'network' })).toEqual({ text: 'Nie udało się połączyć. Sprawdź internet i spróbuj ponownie.', trouble: true });
    expect(say('failed', { errorCode: 'limit_reached' }).text).toBe('Dzisiejszy limit jest wykorzystany. Wróć jutro.');
  });
});
