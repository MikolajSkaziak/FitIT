import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';
import { Alert } from 'react-native';

import * as outfits from '@/api/outfits';
import { ApiError } from '@/api/problem';
import * as wardrobe from '@/api/wardrobe';
import ChooseOccasion from '@/app/(app)/occasion';
import GarmentDetail from '@/app/(app)/clothes/[id]/index';
import OutfitDetail from '@/app/(app)/outfit/[id]';
import Outfits from '@/app/(app)/(tabs)/outfits';
import Profile from '@/app/(app)/(tabs)/profile';
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
  fetchSavedOutfits: jest.fn(),
  fetchOutfit: jest.fn(),
  updateOutfit: jest.fn(),
  deleteOutfit: jest.fn(),
}));
jest.mock('@/api/wardrobe', () => ({
  ...jest.requireActual('@/api/wardrobe'),
  fetchClothing: jest.fn(),
  fetchUsage: jest.fn(),
  fetchDictionaries: jest.fn(),
}));

const api = jest.mocked(outfits);
const garments = jest.mocked(wardrobe);

const usage = (used: number): wardrobe.Usage => ({
  items: { used: 12, limit: 50 },
  suggestions: { used, limit: 20 },
  visualizations: { used: 1, limit: 5 },
  resetsAt: '2026-10-06T00:00:00+02:00',
});

beforeEach(() => {
  jest.clearAllMocks();
  useSession.setState({ status: 'signedIn', user: user(), accessToken: 'a', refreshToken: 'r' });
  garments.fetchUsage.mockResolvedValue(usage(3));
  garments.fetchDictionaries.mockResolvedValue({ categories: [], groups: [], colors: [], patterns: [], materials: [], formality: [], warmth: [], styles: [], seasons: [] } as never);
});

describe('the Outfits tab', () => {
  const saved = [
    outfit('s1', { isSaved: true, occasion: 'everyday', createdAt: '2026-10-03T09:00:00Z', wornOn: '2026-10-03' }),
    outfit('s2', { isSaved: true, occasion: 'work', createdAt: '2026-09-28T09:00:00Z', items: outfit('x').items.slice(0, 3) }),
  ];

  it('lists the saved outfits with the occasion, the date and the weather they were for', async () => {
    api.fetchSavedOutfits.mockResolvedValue(saved);

    await renderScreen(<Outfits />);

    expect(await screen.findByText('Everyday')).toBeOnTheScreen();
    expect(screen.getByText('Work or school')).toBeOnTheScreen();
    expect(screen.getByText('Worn on October 3')).toBeOnTheScreen();
    expect(screen.getByText('Saved September 28')).toBeOnTheScreen();
    expect(screen.getAllByText('7-18°C')).toHaveLength(2);
    expect(screen.getByTestId('outfits-count')).toHaveTextContent('2 saved outfits');
  });

  it('opens an outfit', async () => {
    api.fetchSavedOutfits.mockResolvedValue(saved);
    await renderScreen(<Outfits />);

    await fireEvent.press(await screen.findByTestId('outfit-s2'));

    expect(router.push).toHaveBeenCalledWith({ pathname: '/outfit/[id]', params: { id: 's2' } });
  });

  it('narrows the list by what is typed, and offers a way out when nothing matches', async () => {
    api.fetchSavedOutfits.mockResolvedValue(saved);
    await renderScreen(<Outfits />);
    await screen.findByTestId('outfit-s1');

    await fireEvent.changeText(screen.getByTestId('outfits-search'), 'school');
    expect(screen.queryByTestId('outfit-s1')).toBeNull();
    expect(screen.getByTestId('outfit-s2')).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByTestId('outfits-search'), 'workout');
    expect(await screen.findByTestId('outfits-no-match')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Clear search' }));
    expect(screen.getByTestId('outfit-s1')).toBeOnTheScreen();
  });

  it('keeps the empty screen when nothing is saved yet', async () => {
    api.fetchSavedOutfits.mockResolvedValue([]);

    await renderScreen(<Outfits />);

    expect(await screen.findByTestId('outfits-empty')).toBeOnTheScreen();
    expect(screen.queryByTestId('outfits-search')).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Open Today' }));
    expect(router.navigate).toHaveBeenCalledWith('/');
  });

  it('says what happened when the list cannot be loaded, and tries again', async () => {
    api.fetchSavedOutfits.mockRejectedValueOnce(new ApiError({ status: 0, code: 'network' })).mockResolvedValueOnce(saved);

    await renderScreen(<Outfits />);

    expect(await screen.findByText('Can’t connect right now. Check your internet connection and try again.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByTestId('outfit-s1')).toBeOnTheScreen();
  });
});

describe('a saved outfit', () => {
  beforeEach(() => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ id: 's1' });
    api.fetchOutfit.mockResolvedValue(outfit('s1', { isSaved: true, occasion: 'work', occasionNote: 'prezentacja', createdAt: '2026-09-28T09:00:00Z' }));
  });

  it('shows the garments, what was said about them and the note the person wrote', async () => {
    await renderScreen(<OutfitDetail />);

    expect(await screen.findByText('Reasoning for outfit s1.')).toBeOnTheScreen();
    expect(screen.getByText('Work or school')).toBeOnTheScreen();
    expect(screen.getByText('September 28, 7-18°C')).toBeOnTheScreen();
    expect(screen.getByText('Note: prezentacja')).toBeOnTheScreen();
    expect(screen.getByRole('image', { name: /Outfit on a figure: Navy shirt/ })).toBeOnTheScreen();
  });

  it('opens on the figure and switches to the collage of real photos', async () => {
    await renderScreen(<OutfitDetail />);

    expect(await screen.findByRole('radio', { name: 'On figure', checked: true })).toBeOnTheScreen();
    expect(screen.queryByRole('radio', { name: 'Try-on' })).toBeNull();
    await fireEvent.press(screen.getByRole('radio', { name: 'Collage' }));

    expect(await screen.findByRole('image', { name: /^Outfit: Navy shirt/ })).toBeOnTheScreen();
  });

  it('wears it, and the wardrobe is asked again how much of it is used', async () => {
    api.updateOutfit.mockResolvedValue(outfit('s1', { isSaved: true, wornOn: '2026-10-05' }));
    const { QueryClient } = jest.requireActual('@tanstack/react-query') as typeof import('@tanstack/react-query');
    const invalidate = jest.spyOn(QueryClient.prototype, 'invalidateQueries');
    await renderScreen(<OutfitDetail />);

    await fireEvent.press(await screen.findByTestId('outfit-wear'));

    await waitFor(() => expect(api.updateOutfit).toHaveBeenCalledWith('s1', { worn: true }));
    expect(await screen.findByRole('button', { name: 'Worn' })).toBeOnTheScreen();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: wardrobe.wardrobeKeys.stats });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: [...wardrobe.wardrobeKeys.all, 'list'] });
    invalidate.mockRestore();
  });

  it('rates it and lets it go from the saved ones', async () => {
    api.updateOutfit.mockResolvedValueOnce(outfit('s1', { isSaved: true, rating: 'like' })).mockResolvedValueOnce(outfit('s1', { isSaved: false, rating: 'like' }));
    await renderScreen(<OutfitDetail />);

    await fireEvent.press(await screen.findByTestId('outfit-like'));
    await waitFor(() => expect(api.updateOutfit).toHaveBeenLastCalledWith('s1', { rating: 'like' }));

    await fireEvent.press(screen.getByRole('button', { name: 'Remove from saved' }));
    await waitFor(() => expect(api.updateOutfit).toHaveBeenLastCalledWith('s1', { saved: false }));
  });

  it('asks before deleting, naming what will go, and keeps it when the person changes their mind', async () => {
    const ask = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await renderScreen(<OutfitDetail />);

    await fireEvent.press(await screen.findByTestId('outfit-delete'));

    expect(ask).toHaveBeenCalledWith(
      'Delete outfit “Work or school, September 28”?',
      'We’ll remove it from your saved outfits. This can’t be undone.',
      expect.arrayContaining([expect.objectContaining({ text: 'Keep', style: 'cancel' }), expect.objectContaining({ text: 'Delete outfit', style: 'destructive' })]),
    );
    expect(api.deleteOutfit).not.toHaveBeenCalled();
    ask.mockRestore();
  });

  it('deletes it once confirmed and goes back to the list', async () => {
    const ask = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    api.deleteOutfit.mockResolvedValue(undefined);
    await renderScreen(<OutfitDetail />);
    await fireEvent.press(await screen.findByTestId('outfit-delete'));

    const buttons = ask.mock.calls[0]?.[2] ?? [];
    buttons.find((button) => button.text === 'Delete outfit')?.onPress?.();

    await waitFor(() => expect(api.deleteOutfit).toHaveBeenCalledWith('s1'));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    ask.mockRestore();
  });

  it('says the outfit is gone when it was deleted somewhere else, in words about outfits', async () => {
    api.fetchOutfit.mockRejectedValue(new ApiError({ status: 404, code: 'not_found' }));

    await renderScreen(<OutfitDetail />);

    expect(await screen.findByText('This outfit isn’t here anymore.')).toBeOnTheScreen();
  });
});

describe('"Style this"', () => {
  it('is offered for a described garment and opens the choice of occasion', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ id: 'g1' });
    garments.fetchClothing.mockResolvedValue(clothing('g1', 'Navy oxford shirt', 'top'));
    await renderScreen(<GarmentDetail />);

    await fireEvent.press(await screen.findByRole('button', { name: 'Style this' }));

    expect(router.push).toHaveBeenCalledWith({ pathname: '/occasion', params: { base: 'g1' } });
  });

  it('is not offered while the garment is still being described', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ id: 'g2' });
    garments.fetchClothing.mockResolvedValue(clothing('g2', 'Item', 'top', { status: 'processing' }));
    await renderScreen(<GarmentDetail />);

    expect(await screen.findByText('Describing your photo')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Style this' })).toBeNull();
  });

  it('asks for the occasion and sends the garment along to the proposals', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ base: 'g1' });
    garments.fetchClothing.mockResolvedValue(clothing('g1', 'Navy oxford shirt', 'top'));
    await renderScreen(<ChooseOccasion />);

    expect(await screen.findByText('Outfits built around Navy oxford shirt')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('radio', { name: 'Date or night out' }));
    await fireEvent.changeText(screen.getByTestId('occasion-note'), 'kolacja');
    await fireEvent.press(screen.getByRole('button', { name: 'Suggest outfits' }));

    expect(router.replace).toHaveBeenCalledWith({
      pathname: '/proposals',
      params: { request: expect.any(String), occasion: 'date', note: 'kolacja', base: 'g1' },
    });
  });

  it('shows the garment it is about, starts on Everyday, and suggests at once', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ base: 'g1' });
    garments.fetchClothing.mockResolvedValue(clothing('g1', 'Navy oxford shirt', 'top'));
    await renderScreen(<ChooseOccasion />);

    expect(await screen.findByTestId('occasion-garment')).toBeOnTheScreen();
    expect(screen.getByText('Outfits built around Navy oxford shirt')).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'Everyday' }).props.accessibilityState.checked).toBe(true);
    expect(screen.getByRole('button', { name: 'Suggest outfits' }).props.accessibilityState.disabled).toBeFalsy();
    expect(screen.getByPlaceholderText('Anything we should know?')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Suggest outfits' }));
    expect(router.replace).toHaveBeenCalledWith({ pathname: '/proposals', params: { request: expect.any(String), occasion: 'everyday', base: 'g1' } });
  });

  it('opens the builder with the garment already chosen, replacing what was chosen before', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ base: 'g1' });
    const shirt = clothing('g1', 'Navy oxford shirt', 'top');
    garments.fetchClothing.mockResolvedValue(shirt);
    useOutfitBuilder.setState({ items: [clothing('old', 'Old jeans', 'bottom')], note: null, bodyNoteSeen: false });
    await renderScreen(<ChooseOccasion />);

    await waitFor(() => expect(screen.getByTestId('occasion-build').props.accessibilityState.disabled).toBeFalsy());
    await fireEvent.press(screen.getByRole('button', { name: 'Build an outfit myself around this garment' }));

    expect(useOutfitBuilder.getState().items.map((item) => item.id)).toEqual(['g1']);
    expect(router.replace).toHaveBeenCalledWith('/builder');
  });

  it('offers no way to build by hand when it was not opened for a garment', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({});
    await renderScreen(<ChooseOccasion />);

    expect(screen.queryByTestId('occasion-build')).toBeNull();
    expect(screen.queryByTestId('occasion-garment')).toBeNull();
  });

  it('says the limit is used up instead of sending a request that would be refused', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ base: 'g1' });
    garments.fetchClothing.mockResolvedValue(clothing('g1', 'Navy oxford shirt', 'top'));
    garments.fetchUsage.mockResolvedValue(usage(20));
    await renderScreen(<ChooseOccasion />);

    expect(await screen.findByTestId('occasion-limit')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Suggest outfits' }).props.accessibilityState.disabled).toBe(true);
  });
});

describe('the profile', () => {
  it('shows where the weather comes from, the thermal preference and what is left of today\'s limits', async () => {
    await renderScreen(<Profile />);

    expect(screen.getByRole('button', { name: 'Weather for, Phone location' })).toBeOnTheScreen();
    expect(screen.getByText('Gliwice')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Feel the cold, About average' })).toBeOnTheScreen();
    expect(await screen.findByText('3 of 20')).toBeOnTheScreen();
    expect(screen.getByText('12 of 50')).toBeOnTheScreen();
  });

  it('names a city typed in by hand, and says so when there is no place', async () => {
    useSession.setState({ user: user({ location: { source: 'manual', name: 'Osaka', lat: 34.7, lon: 135.5 } }) });
    const { unmount } = await renderScreen(<Profile />);
    expect(screen.getByRole('button', { name: 'Weather for, City you chose' })).toBeOnTheScreen();
    expect(screen.getByText('Osaka')).toBeOnTheScreen();
    await unmount();

    useSession.setState({ user: user({ location: null }) });
    await renderScreen(<Profile />);
    expect(screen.getByRole('button', { name: 'Weather for, Not set' })).toBeOnTheScreen();
  });

  it('opens the screens that change them', async () => {
    await renderScreen(<Profile />);

    await fireEvent.press(screen.getByTestId('profile-row-place'));
    await fireEvent.press(screen.getByTestId('profile-row-thermal'));

    expect(router.push).toHaveBeenCalledWith('/account/place');
    expect(router.push).toHaveBeenCalledWith('/account/thermal');
  });
});
