import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';

import * as outfits from '@/api/outfits';
import { ApiError } from '@/api/problem';
import * as visualizations from '@/api/visualizations';
import * as wardrobe from '@/api/wardrobe';
import Builder from '@/app/(app)/builder/index';
import BuilderPreview from '@/app/(app)/builder/preview';
import { useSession } from '@/auth/session';
import { useOutfitBuilder } from '@/features/builder/useOutfitBuilder';
import { clothing, outfit, user } from '@/test/fixtures';
import { renderScreen, router } from '@/test/screen';

jest.mock('expo-router', () => jest.requireActual('@/test/screen').routerModule);
jest.mock('@/lib/config', () => ({ apiUrl: 'http://api.test' }));
jest.mock('@/api/calendar', () => jest.requireActual('@/test/calendar').quietCalendar());
jest.mock('@/auth/tokenStorage', () => ({
  tokenStorage: { load: jest.fn(async () => null), save: jest.fn(async () => undefined), clear: jest.fn(async () => undefined) },
}));
jest.mock('@/api/outfits', () => ({
  ...jest.requireActual('@/api/outfits'),
  createOutfit: jest.fn(),
  updateOutfit: jest.fn(),
  fetchOutfitTips: jest.fn(),
}));
jest.mock('@/api/wardrobe', () => ({
  ...jest.requireActual('@/api/wardrobe'),
  fetchClothes: jest.fn(),
  fetchUsage: jest.fn(),
}));
jest.mock('@/api/visualizations', () => ({
  ...jest.requireActual('@/api/visualizations'),
  requestVisualization: jest.fn(),
  fetchVisualization: jest.fn(),
}));

const api = jest.mocked(outfits);
const garments = jest.mocked(wardrobe);
const pictures = jest.mocked(visualizations);

const usage = (used: number): wardrobe.Usage => ({
  items: { used: 12, limit: 50 },
  suggestions: { used: 0, limit: 20 },
  visualizations: { used, limit: 5 },
  stylistChat: { used: 0, limit: 30 },
  resetsAt: '2026-10-06T00:00:00+02:00',
});

const picture = (change: Partial<visualizations.Visualization> = {}): visualizations.Visualization => ({
  id: 'v1',
  outfitId: 'draft-1',
  status: 'completed',
  imageUrl: 'https://images.test/v1.jpg',
  imageKey: 'u/1/viz/v1.jpg',
  errorCode: null,
  createdAt: '2026-10-05T09:30:00Z',
  completedAt: '2026-10-05T09:31:00Z',
  ...change,
});

const tee = clothing('tee', 'White tee', 'top');
const shirt = clothing('shirt', 'Blue shirt', 'top');
const jeans = clothing('jeans', 'Jeans', 'bottom');
const dress = clothing('dress', 'Green dress', 'one_piece');
const sneakers = clothing('sneakers', 'Sneakers', 'shoes');
const scarf = clothing('scarf', 'Wool scarf', 'accessory');
const waiting = clothing('waiting', 'Still describing', 'top', { status: 'processing' });

const pick = (id: string) => fireEvent.press(screen.getByTestId(`pick-${id}`));
const chosen = (id: string) => screen.getByTestId(`pick-${id}`).props.accessibilityState.checked as boolean;

beforeEach(() => {
  jest.clearAllMocks();
  useOutfitBuilder.setState({ items: [], note: null, bodyNoteSeen: false, layout: null, figureLayout: null });
  useSession.setState({ status: 'signedIn', user: user(), accessToken: 'a', refreshToken: 'r' });
  garments.fetchClothes.mockResolvedValue([tee, shirt, jeans, dress, sneakers, scarf, waiting]);
  garments.fetchUsage.mockResolvedValue(usage(1));
});

describe('the picker', () => {
  it('lists the ready garments by role in outfit order and leaves out empty roles and garments still being described', async () => {
    await renderScreen(<Builder />);

    await screen.findByTestId('builder-group-top');
    expect(['top', 'bottom', 'one_piece', 'shoes', 'accessory'].every((role) => screen.queryByTestId(`builder-group-${role}`))).toBe(true);
    expect(screen.queryByTestId('builder-group-mid_layer')).toBeNull();
    expect(screen.queryByTestId('pick-waiting')).toBeNull();
    expect(screen.getByText('Dresses and jumpsuits')).toBeOnTheScreen();
  });

  it('toggles garments: one per role, and a dress replaces the top and the bottom with a note the first time only', async () => {
    await renderScreen(<Builder />);
    await screen.findByTestId('pick-tee');

    await pick('tee');
    await pick('shirt');
    expect([chosen('tee'), chosen('shirt')]).toEqual([false, true]);

    await pick('jeans');
    await pick('dress');
    expect([chosen('shirt'), chosen('jeans'), chosen('dress')]).toEqual([false, false, true]);
    expect(screen.getByTestId('builder-note')).toHaveTextContent('A dress or jumpsuit stands in for a top and a bottom, so those were taken out.');

    await pick('tee');
    await pick('dress');
    await pick('jeans');
    await pick('dress');
    expect(screen.queryByTestId('builder-note')).toBeNull();
    expect(useOutfitBuilder.getState().items.map((item) => item.id)).toEqual(['dress']);
  });

  it('starts with the garment it was opened for chosen, and lets the person take it out', async () => {
    useOutfitBuilder.getState().startWith(shirt);
    await renderScreen(<Builder />);
    await screen.findByTestId('pick-tee');

    expect([chosen('shirt'), chosen('tee')]).toEqual([true, false]);
    await pick('jeans');
    expect(useOutfitBuilder.getState().items.map((item) => item.id)).toEqual(['shirt', 'jeans']);

    await pick('shirt');
    expect(chosen('shirt')).toBe(false);
    expect(useOutfitBuilder.getState().items.map((item) => item.id)).toEqual(['jeans']);
  });

  it('wants two pieces before the preview, and then opens it', async () => {
    await renderScreen(<Builder />);
    await screen.findByTestId('pick-tee');

    expect(screen.getByText('Pick at least two pieces')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('builder-preview'));
    expect(router.push).not.toHaveBeenCalled();

    await pick('tee');
    await pick('sneakers');
    await fireEvent.press(screen.getByTestId('builder-preview'));

    expect(router.push).toHaveBeenCalledWith('/builder/preview');
  });

  it('calls onPress at once: the chosen look is there in the same pass, no wait for an animation', async () => {
    await renderScreen(<Builder />);
    await screen.findByTestId('pick-tee');

    await pick('tee');

    expect(chosen('tee')).toBe(true);
  });

  it('sends a person with nothing ready to add clothes', async () => {
    garments.fetchClothes.mockResolvedValue([waiting]);
    await renderScreen(<Builder />);

    await fireEvent.press(await screen.findByTestId('builder-add'));

    expect(router.replace).toHaveBeenCalledWith('/add');
  });
});

describe('the preview', () => {
  beforeEach(() => useOutfitBuilder.setState({ items: [tee, jeans, sneakers] }));

  /** The screen once it has settled: the day's allowance of pictures is the last thing to arrive. */
  const open = async () => {
    await renderScreen(<BuilderPreview />);
    await screen.findByTestId('visualization-left');
  };

  it('shows the outfit, its pieces and the occasion, Everyday chosen', async () => {
    await open();

    expect(screen.getByTestId('board-draft')).toBeOnTheScreen();
    expect(screen.getByRole('tab', { name: 'Board', selected: true })).toBeOnTheScreen();
    expect(screen.getByRole('tab', { name: 'On figure' })).toBeOnTheScreen();
    expect(screen.queryByRole('tab', { name: 'Try-on' })).toBeNull();
    expect(within(screen.getByTestId('builder-preview-screen')).getByText('White tee')).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'Everyday', checked: true })).toBeOnTheScreen();
  });

  it('asks for tips with the occasion and shows what works and what to improve', async () => {
    api.fetchOutfitTips.mockResolvedValue({
      positives: ['The neutral palette is easy to wear.'],
      improvements: [{ code: 'no_shoes', text: 'No shoes yet. Add a pair to finish the outfit.' }],
      score: 70,
    });
    await open();

    await fireEvent.press(screen.getByRole('radio', { name: 'Work or school' }));
    await fireEvent.press(screen.getByTestId('builder-tips'));

    expect(await screen.findByText('No shoes yet. Add a pair to finish the outfit.')).toBeOnTheScreen();
    expect(screen.getByText('The neutral palette is easy to wear.')).toBeOnTheScreen();
    expect(api.fetchOutfitTips).toHaveBeenCalledWith({ items: ['tee', 'jeans', 'sneakers'], occasion: 'work' });
  });

  it('says plainly when the day’s tips are used up', async () => {
    api.fetchOutfitTips.mockRejectedValue(new ApiError({ status: 429, code: 'limit_reached' }));
    await open();

    await fireEvent.press(screen.getByTestId('builder-tips'));

    expect(await screen.findByTestId('builder-tips-error')).toHaveTextContent('You’ve used today’s tips. More tomorrow.');
  });

  it('saves the outfit from the bookmark under the picture, with its name and occasion, and stays where it is', async () => {
    api.createOutfit.mockResolvedValue(outfit('built-1', { source: 'manual', name: 'Sunday brunch', isSaved: true }));
    await open();

    expect(within(screen.getByTestId('visualization-tabs-row')).getByRole('button', { name: 'Save outfit' })).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByTestId('builder-name'), 'Sunday brunch');
    await fireEvent.press(screen.getByRole('radio', { name: 'With friends' }));
    await fireEvent.press(screen.getByTestId('builder-save'));

    expect(await screen.findByRole('button', { name: 'Remove from saved' })).toBeOnTheScreen();
    expect(api.createOutfit).toHaveBeenCalledWith({ items: ['tee', 'jeans', 'sneakers'], occasion: 'friends', name: 'Sunday brunch' });
    expect(router.replace).not.toHaveBeenCalled();
    expect(useOutfitBuilder.getState().items).toHaveLength(3);
  });

  it('takes a saved outfit out of the saved ones again with the same bookmark, without storing it twice', async () => {
    const built = outfit('built-1', { source: 'manual', isSaved: true });
    api.createOutfit.mockResolvedValue(built);
    api.updateOutfit.mockResolvedValue({ ...built, isSaved: false });
    await open();

    await fireEvent.press(screen.getByTestId('builder-save'));
    await screen.findByRole('button', { name: 'Remove from saved' });
    await fireEvent.press(screen.getByTestId('builder-save'));

    expect(await screen.findByRole('button', { name: 'Save outfit' })).toBeOnTheScreen();
    expect(api.updateOutfit).toHaveBeenCalledWith('built-1', { saved: false });
    expect(api.createOutfit).toHaveBeenCalledTimes(1);
  });

  it('wears the outfit today: stores it, marks it worn and says so on the button', async () => {
    const built = outfit('built-1', { source: 'manual', isSaved: true });
    api.createOutfit.mockResolvedValue(built);
    api.updateOutfit.mockResolvedValue({ ...built, wornOn: '2026-10-05' });
    await open();

    await fireEvent.press(screen.getByRole('button', { name: 'Wear it today' }));

    expect(await screen.findByRole('button', { name: 'Worn' })).toBeOnTheScreen();
    expect(api.createOutfit).toHaveBeenCalledWith({ items: ['tee', 'jeans', 'sneakers'], occasion: 'everyday', name: '' });
    expect(api.updateOutfit).toHaveBeenCalledWith('built-1', { worn: true });
    expect(screen.getByRole('button', { name: 'Remove from saved' })).toBeOnTheScreen();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('closes the whole builder from the check in the corner: a stored outfit is finished with, an unstored one waits', async () => {
    api.createOutfit.mockResolvedValue(outfit('built-1', { source: 'manual', isSaved: true }));
    await open();

    await fireEvent.press(screen.getByTestId('builder-done'));
    expect(router.dismiss).toHaveBeenCalledWith(2);
    expect(useOutfitBuilder.getState().items).toHaveLength(3);

    await fireEvent.press(screen.getByTestId('builder-save'));
    await screen.findByRole('button', { name: 'Remove from saved' });
    await fireEvent.press(screen.getByTestId('builder-done'));
    expect(useOutfitBuilder.getState().items).toEqual([]);
  });

  it('takes a piece out, opens the swap sheet for one, and goes back to the picker for more', async () => {
    await open();

    await fireEvent.press(screen.getByRole('button', { name: 'Swap White tee' }));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/builder/swap', params: { id: 'tee' } });

    await fireEvent.press(screen.getByRole('button', { name: 'Add a piece' }));
    expect(router.back).toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('button', { name: 'Take out Sneakers' }));
    expect(useOutfitBuilder.getState().items.map((item) => item.id)).toEqual(['tee', 'jeans']);
    expect(screen.queryByTestId('builder-piece-sneakers')).toBeNull();

    // One piece is not an outfit: it can be neither worn nor saved until another joins it.
    await fireEvent.press(screen.getByRole('button', { name: 'Take out Jeans' }));
    expect(screen.getByTestId('builder-few')).toBeOnTheScreen();
    expect(screen.getByTestId('builder-wear')).toBeDisabled();
    expect(screen.queryByTestId('builder-save')).toBeNull();
  });

  it('shows the pieces on the figure, each where it is worn, and keeps that arrangement apart from the board', async () => {
    await open();

    await fireEvent.press(screen.getByRole('tab', { name: 'On figure' }));

    expect(await screen.findByRole('image', { name: 'Outfit on a figure: White tee, Jeans, Sneakers' })).toBeOnTheScreen();
    expect(screen.getByTestId('figure-draft-body')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Arrange' }));
    await fireEvent(screen.getByTestId('figure-draft-tee-handle'), 'accessibilityAction', { nativeEvent: { actionName: 'moveLeft' } });
    await fireEvent.press(screen.getByRole('button', { name: 'Done' }));

    expect(useOutfitBuilder.getState().figureLayout?.map((placement) => placement.clothingId).sort()).toEqual(['jeans', 'sneakers', 'tee']);
    expect(useOutfitBuilder.getState().layout).toBeNull();
  });

  it('keeps the outfit and says what went wrong when saving fails', async () => {
    api.createOutfit.mockRejectedValue(new ApiError({ status: 0, code: 'network' }));
    await open();

    await fireEvent.press(screen.getByTestId('builder-save'));

    expect(await screen.findByText(/Can’t connect right now/)).toBeOnTheScreen();
    expect(useOutfitBuilder.getState().items).toHaveLength(3);
    expect(screen.getByRole('button', { name: 'Save outfit' })).toBeOnTheScreen();
  });

  it('saves the outfit with the board as the person arranged it, leaving out a piece taken off since', async () => {
    api.createOutfit.mockResolvedValue(outfit('built-1', { source: 'manual', isSaved: true }));
    await open();

    await fireEvent.press(screen.getByRole('button', { name: 'Arrange' }));
    await fireEvent(screen.getByTestId('board-draft-tee-handle'), 'accessibilityAction', { nativeEvent: { actionName: 'moveLeft' } });
    await fireEvent.press(screen.getByRole('button', { name: 'Done' }));

    const arranged = useOutfitBuilder.getState().layout;
    expect(arranged?.map((placement) => placement.clothingId).sort()).toEqual(['jeans', 'sneakers', 'tee']);
    // Back in the picker the sneakers come off; what is saved places only what is still in the outfit.
    await act(async () => useOutfitBuilder.getState().toggle(sneakers));
    await fireEvent.press(screen.getByTestId('builder-save'));

    await waitFor(() => expect(api.createOutfit).toHaveBeenCalledTimes(1));
    expect(api.createOutfit.mock.calls[0][0]).toMatchObject({ items: ['tee', 'jeans'], layout: arranged?.filter((placement) => placement.clothingId !== 'sneakers') });
    await screen.findByRole('button', { name: 'Remove from saved' });
    await fireEvent.press(screen.getByTestId('builder-done'));
    expect(useOutfitBuilder.getState().layout).toBeNull();
  });

  it('tries the outfit on before it is saved: stores it once as a draft, orders the picture and shows it', async () => {
    api.createOutfit.mockResolvedValue(outfit('draft-1', { source: 'manual', isSaved: false }));
    pictures.requestVisualization.mockResolvedValue(picture());
    await open();

    expect(screen.getByTestId('visualization-left')).toHaveTextContent(/4/);
    await fireEvent.press(screen.getByRole('radio', { name: 'With friends' }));
    await fireEvent.press(screen.getByTestId('visualization-show'));

    expect(await screen.findByTestId('visualization-picture')).toBeOnTheScreen();
    expect(screen.getByRole('tab', { name: 'Try-on', selected: true })).toBeOnTheScreen();
    expect(api.createOutfit).toHaveBeenCalledTimes(1);
    expect(api.createOutfit).toHaveBeenCalledWith({ items: ['tee', 'jeans', 'sneakers'], occasion: 'friends', saved: false });
    expect(pictures.requestVisualization.mock.calls.map(([id]) => id)).toEqual(['draft-1']);

    // The board stays one press away.
    expect(screen.getByRole('tab', { name: 'Board' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('tab', { name: 'Board' }));
    expect(await screen.findByTestId('board-draft')).toBeOnTheScreen();
  });

  it('saves a tried-on outfit with its draft, so the picture comes along', async () => {
    api.createOutfit.mockResolvedValueOnce(outfit('draft-1', { source: 'manual', isSaved: false }));
    pictures.requestVisualization.mockResolvedValue(picture());
    await open();
    await fireEvent.press(screen.getByTestId('visualization-show'));
    await screen.findByTestId('visualization-picture');

    api.createOutfit.mockResolvedValueOnce(outfit('built-1', { source: 'manual', name: 'Sunday brunch', isSaved: true }));
    await fireEvent.changeText(screen.getByTestId('builder-name'), 'Sunday brunch');
    await fireEvent.press(screen.getByTestId('builder-save'));

    await screen.findByRole('button', { name: 'Remove from saved' });
    expect(api.createOutfit).toHaveBeenLastCalledWith({ items: ['tee', 'jeans', 'sneakers'], occasion: 'everyday', name: 'Sunday brunch', draftId: 'draft-1' });
  });

  it('says what happened when the picture is refused, and tries again from the start', async () => {
    api.createOutfit.mockRejectedValueOnce(new ApiError({ status: 0, code: 'network' }));
    await open();

    await fireEvent.press(screen.getByTestId('visualization-show'));

    expect(await screen.findByTestId('visualization-problem')).toBeOnTheScreen();
    expect(pictures.requestVisualization).not.toHaveBeenCalled();

    api.createOutfit.mockResolvedValueOnce(outfit('draft-2', { source: 'manual', isSaved: false }));
    pictures.requestVisualization.mockResolvedValue(picture({ outfitId: 'draft-2' }));
    await fireEvent.press(screen.getByTestId('visualization-retry'));

    expect(await screen.findByTestId('visualization-picture')).toBeOnTheScreen();
    expect(pictures.requestVisualization.mock.calls.map(([id]) => id)).toEqual(['draft-2']);
  });

  it('offers no try-on once today’s pictures are used up', async () => {
    garments.fetchUsage.mockResolvedValue(usage(5));
    await open();

    await waitFor(() => expect(screen.getByTestId('visualization-show')).toBeDisabled());
  });
});
