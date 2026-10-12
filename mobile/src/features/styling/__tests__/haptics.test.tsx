import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams } from 'expo-router';
import { Alert } from 'react-native';

import * as outfits from '@/api/outfits';
import { ApiError } from '@/api/problem';
import * as wardrobe from '@/api/wardrobe';
import GarmentDetail from '@/app/(app)/clothes/[id]/index';
import ChooseOccasion from '@/app/(app)/occasion';
import OutfitDetail from '@/app/(app)/outfit/[id]';
import { useSession } from '@/auth/session';
import { failureCue } from '@/lib/failureCue';
import { clothing, outfit, user, wardrobeDictionaries } from '@/test/fixtures';
import { renderScreen } from '@/test/screen';

jest.mock('expo-router', () => jest.requireActual('@/test/screen').routerModule);
jest.mock('@/lib/config', () => ({ apiUrl: 'http://api.test' }));
jest.mock('@/api/calendar', () => jest.requireActual('@/test/calendar').quietCalendar());
jest.mock('@/auth/tokenStorage', () => ({
  tokenStorage: { load: jest.fn(async () => null), save: jest.fn(async () => undefined), clear: jest.fn(async () => undefined) },
}));
jest.mock('@/api/outfits', () => ({ ...jest.requireActual('@/api/outfits'), fetchOutfit: jest.fn(), updateOutfit: jest.fn(), deleteOutfit: jest.fn() }));
jest.mock('@/api/wardrobe', () => ({
  ...jest.requireActual('@/api/wardrobe'),
  fetchClothing: jest.fn(),
  deleteClothing: jest.fn(),
  fetchUsage: jest.fn(),
  fetchDictionaries: jest.fn(),
}));

const api = jest.mocked(outfits);
const garments = jest.mocked(wardrobe);
const impact = jest.mocked(Haptics.impactAsync);
const notification = jest.mocked(Haptics.notificationAsync);
const select = jest.mocked(Haptics.selectionAsync);

const usage = (used: number): wardrobe.Usage => ({
  items: { used: 12, limit: 50 },
  suggestions: { used, limit: 20 },
  visualizations: { used: 1, limit: 5 },
  resetsAt: '2026-10-06T00:00:00+02:00',
});

beforeEach(() => {
  jest.clearAllMocks();
  useSession.setState({ status: 'signedIn', user: user(), accessToken: 'a', refreshToken: 'r' });
  jest.mocked(useLocalSearchParams).mockReturnValue({ id: 's1' });
  garments.fetchUsage.mockResolvedValue(usage(3));
  garments.fetchDictionaries.mockResolvedValue(wardrobeDictionaries);
});

describe('a saved outfit', () => {
  beforeEach(() => api.fetchOutfit.mockResolvedValue(outfit('s1', { isSaved: false, occasion: 'work', createdAt: '2026-09-28T09:00:00Z' })));

  it('gives a light tap the moment it is saved, and a plain selection when it is taken off', async () => {
    api.updateOutfit.mockResolvedValueOnce(outfit('s1', { isSaved: true }));
    await renderScreen(<OutfitDetail />);

    await fireEvent.press(await screen.findByRole('button', { name: 'Save outfit' }));
    expect(impact.mock.calls).toEqual([['light']]);
    expect(select).not.toHaveBeenCalled();
    await waitFor(() => expect(api.updateOutfit).toHaveBeenCalledWith('s1', { saved: true }));

    api.updateOutfit.mockResolvedValueOnce(outfit('s1', { isSaved: false }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Remove from saved' }));
    expect(select).toHaveBeenCalledTimes(1);
    expect(impact).toHaveBeenCalledTimes(1);
  });

  it('gives the error cue, once, when the save is taken back', async () => {
    api.updateOutfit.mockRejectedValue(new ApiError({ status: 500, code: 'server_error' }));
    await renderScreen(<OutfitDetail />);

    await fireEvent.press(await screen.findByRole('button', { name: 'Save outfit' }));

    await waitFor(() => expect(notification.mock.calls).toEqual([['error']]));
  });

  it('gives the success cue when the server has taken the day’s outfit, and not before', async () => {
    let answer: (value: outfits.Outfit) => void = () => undefined;
    api.updateOutfit.mockReturnValue(new Promise((resolve) => (answer = resolve)));
    await renderScreen(<OutfitDetail />);

    await fireEvent.press(await screen.findByTestId('outfit-wear'));
    expect(notification).not.toHaveBeenCalled();

    await act(async () => answer(outfit('s1', { wornOn: '2026-10-05' })));
    await screen.findByRole('button', { name: 'Worn' });

    expect(notification.mock.calls).toEqual([['success']]);
  });

  it('gives the error cue and no success when wearing it fails', async () => {
    api.updateOutfit.mockRejectedValue(new ApiError({ status: 500, code: 'server_error' }));
    await renderScreen(<OutfitDetail />);

    await fireEvent.press(await screen.findByTestId('outfit-wear'));

    await waitFor(() => expect(notification).toHaveBeenCalled());
    expect(notification.mock.calls).toEqual([['error']]);
  });

  it('gives a firm tap when the delete button is pressed, and the heavy one only when the deletion is confirmed in its alert', async () => {
    const ask = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    api.deleteOutfit.mockResolvedValue(undefined);
    await renderScreen(<OutfitDetail />);

    await fireEvent.press(await screen.findByTestId('outfit-delete'));
    expect(impact.mock.calls).toEqual([['rigid']]);

    const buttons = ask.mock.calls[0]?.[2] ?? [];
    buttons.find((button) => button.text === 'Keep')?.onPress?.();
    expect(impact.mock.calls).toEqual([['rigid']]);

    buttons.find((button) => button.text === 'Delete outfit')?.onPress?.();
    expect(impact.mock.calls).toEqual([['rigid'], ['heavy']]);
    await waitFor(() => expect(api.deleteOutfit).toHaveBeenCalledWith('s1'));
    ask.mockRestore();
  });
});

describe('a garment', () => {
  it('gives a firm tap for the button and a heavy one when its deletion is confirmed in the alert', async () => {
    const ask = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    jest.mocked(useLocalSearchParams).mockReturnValue({ id: 'g1' });
    garments.fetchClothing.mockResolvedValue(clothing('g1', 'Navy hoodie', 'mid_layer'));
    garments.deleteClothing.mockResolvedValue(undefined);
    await renderScreen(<GarmentDetail />);

    await fireEvent.press(await screen.findByTestId('garment-delete'));
    expect(impact.mock.calls).toEqual([['rigid']]);
    ask.mock.calls[0]?.[2]?.find((button) => button.text === 'Delete item')?.onPress?.();

    expect(impact.mock.calls).toEqual([['rigid'], ['heavy']]);
    ask.mockRestore();
  });
});

describe('the suggestion limit', () => {
  it('warns once when the sheet says today’s suggestions are used up, not again as it re-renders', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ base: 'g1' });
    garments.fetchClothing.mockResolvedValue(clothing('g1', 'Navy oxford shirt', 'top'));
    garments.fetchUsage.mockResolvedValue(usage(20));
    await renderScreen(<ChooseOccasion />);

    expect(await screen.findByTestId('occasion-limit')).toBeOnTheScreen();
    // The screen draws again with another occasion; the warning was given once, the choice is a selection.
    await fireEvent.press(screen.getByRole('radio', { name: 'Work or school' }));

    expect(notification.mock.calls).toEqual([['warning']]);
    expect(select).toHaveBeenCalledTimes(1);
  });

  it('is silent while there are suggestions left', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ base: 'g1' });
    garments.fetchClothing.mockResolvedValue(clothing('g1', 'Navy oxford shirt', 'top'));
    await renderScreen(<ChooseOccasion />);
    await screen.findByTestId('occasion-suggest');

    expect(notification).not.toHaveBeenCalled();
  });
});

describe('a failed action', () => {
  it('is felt as an error, and as a warning when the answer was a limit', () => {
    failureCue(new ApiError({ status: 500, code: 'server_error' }));
    failureCue(new Error('anything'));
    expect(notification.mock.calls).toEqual([['error'], ['error']]);

    failureCue(new ApiError({ status: 429, code: 'limit_reached' }));
    failureCue(new ApiError({ status: 409, code: 'photo_limit_reached' }));
    expect(notification.mock.calls.slice(2)).toEqual([['warning'], ['warning']]);
  });
});
