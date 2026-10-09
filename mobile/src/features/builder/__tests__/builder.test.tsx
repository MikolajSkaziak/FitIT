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
jest.mock('@/auth/tokenStorage', () => ({
  tokenStorage: { load: jest.fn(async () => null), save: jest.fn(async () => undefined), clear: jest.fn(async () => undefined) },
}));
jest.mock('@/api/outfits', () => ({
  ...jest.requireActual('@/api/outfits'),
  createOutfit: jest.fn(),
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
  useOutfitBuilder.setState({ items: [], note: null, bodyNoteSeen: false });
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

    expect(screen.getByTestId('figure-draft')).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'On figure', checked: true })).toBeOnTheScreen();
    expect(screen.queryByRole('radio', { name: 'Try-on' })).toBeNull();
    await fireEvent.press(screen.getByRole('radio', { name: 'Collage' }));
    expect(await screen.findByTestId('builder-collage')).toBeOnTheScreen();
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

  it('saves the outfit with its name and occasion and lands on its page', async () => {
    api.createOutfit.mockResolvedValue(outfit('built-1', { source: 'manual', name: 'Sunday brunch', isSaved: true }));
    await open();

    await fireEvent.changeText(screen.getByTestId('builder-name'), 'Sunday brunch');
    await fireEvent.press(screen.getByRole('radio', { name: 'With friends' }));
    await fireEvent.press(screen.getByTestId('builder-save'));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith({ pathname: '/outfit/[id]', params: { id: 'built-1' } }));
    expect(api.createOutfit).toHaveBeenCalledWith({ items: ['tee', 'jeans', 'sneakers'], occasion: 'friends', name: 'Sunday brunch' });
    await act(async () => undefined);
    expect(useOutfitBuilder.getState().items).toEqual([]);
  });

  it('keeps the outfit and says what went wrong when saving fails', async () => {
    api.createOutfit.mockRejectedValue(new ApiError({ status: 0, code: 'network' }));
    await open();

    await fireEvent.press(screen.getByTestId('builder-save'));

    expect(await screen.findByText(/Can’t connect right now/)).toBeOnTheScreen();
    expect(useOutfitBuilder.getState().items).toHaveLength(3);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('tries the outfit on before it is saved: stores it once as a draft, orders the picture and shows it', async () => {
    api.createOutfit.mockResolvedValue(outfit('draft-1', { source: 'manual', isSaved: false }));
    pictures.requestVisualization.mockResolvedValue(picture());
    await open();

    expect(screen.getByTestId('visualization-left')).toHaveTextContent(/4/);
    await fireEvent.press(screen.getByRole('radio', { name: 'With friends' }));
    await fireEvent.press(screen.getByTestId('visualization-show'));

    expect(await screen.findByTestId('visualization-picture')).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'Try-on', checked: true })).toBeOnTheScreen();
    expect(api.createOutfit).toHaveBeenCalledTimes(1);
    expect(api.createOutfit).toHaveBeenCalledWith({ items: ['tee', 'jeans', 'sneakers'], occasion: 'friends', saved: false });
    expect(pictures.requestVisualization.mock.calls.map(([id]) => id)).toEqual(['draft-1']);

    // The figure and the collage stay one press away.
    await fireEvent.press(screen.getByRole('radio', { name: 'Collage' }));
    expect(await screen.findByTestId('builder-collage')).toBeOnTheScreen();
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

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith({ pathname: '/outfit/[id]', params: { id: 'built-1' } }));
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
