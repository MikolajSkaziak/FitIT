import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { withTiming } from 'react-native-reanimated';
import { useLocalSearchParams } from 'expo-router';

import * as account from '@/api/account';
import Profile from '@/app/(app)/(tabs)/profile';
import EditLegs from '@/app/(app)/account/legs';
import EditSize from '@/app/(app)/account/size';
import * as wardrobe from '@/api/wardrobe';
import { useSession } from '@/auth/session';
import { SizeLabel, markerShare } from '@/components/SizeLabel';
import { LegFigures } from '@/components/LegFigures';
import { legDetails, legsNotSet, sizeNames } from '@/copy/labels';
import { motion } from '@/theme';
import { user } from '@/test/fixtures';
import { renderScreen, router } from '@/test/screen';

jest.mock('expo-router', () => jest.requireActual('@/test/screen').routerModule);
jest.mock('@/lib/config', () => ({ apiUrl: 'http://api.test' }));
jest.mock('@/auth/tokenStorage', () => ({
  tokenStorage: { load: jest.fn(async () => null), save: jest.fn(async () => undefined), clear: jest.fn(async () => undefined) },
}));
jest.mock('@/api/account', () => ({ ...jest.requireActual('@/api/account'), updateProfile: jest.fn() }));
jest.mock('@/api/wardrobe', () => ({ ...jest.requireActual('@/api/wardrobe'), fetchUsage: jest.fn(), fetchWardrobeStats: jest.fn() }));

const api = jest.mocked(account);
const shop = jest.mocked(wardrobe);

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useLocalSearchParams).mockReturnValue({});
  shop.fetchUsage.mockReturnValue(new Promise<never>(() => undefined));
  shop.fetchWardrobeStats.mockReturnValue(new Promise<never>(() => undefined));
  useSession.setState({ status: 'signedIn', user: user(), accessToken: 'a', refreshToken: 'r' });
});

describe('size and leg length in the profile', () => {
  it('lists both next to the body shape, "Not set" until the person says, and opens their screens', async () => {
    await renderScreen(<Profile />);

    expect(screen.getByRole('button', { name: 'Usual size, Not set' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Leg length, Not set' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('profile-row-size'));
    await fireEvent.press(screen.getByTestId('profile-row-legs'));

    expect(router.push).toHaveBeenCalledWith('/account/size');
    expect(router.push).toHaveBeenCalledWith('/account/legs');
  });

  it('shows what was chosen', async () => {
    useSession.setState({ user: user({ clothingSize: 'xl', legLength: 'longer' }) });
    await renderScreen(<Profile />);

    expect(screen.getByRole('button', { name: 'Usual size, XL' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Leg length, Longer' })).toBeOnTheScreen();
  });
});

describe('the size screen', () => {
  it('starts on the current size and saves a new one', async () => {
    useSession.setState({ user: user({ clothingSize: 'm' }) });
    api.updateProfile.mockResolvedValue(user({ clothingSize: 'l' }));
    await renderScreen(<EditSize />);

    expect(screen.getByRole('radio', { name: 'Medium' })).toBeChecked();
    await fireEvent.press(screen.getByRole('radio', { name: 'Large' }));
    expect(screen.getByRole('radio', { name: 'Large' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Medium' })).not.toBeChecked();
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(api.updateProfile).toHaveBeenCalledWith({ clothingSize: 'l' }));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect(useSession.getState().user?.clothingSize).toBe('l');
  });

  it('is a radio group of six buttons read out by their full names', async () => {
    await renderScreen(<EditSize />);

    expect(screen.getByLabelText('Usual size', { exact: true }).props.accessibilityRole).toBe('radiogroup');
    expect(screen.getAllByRole('radio')).toHaveLength(6);
    for (const name of Object.values(sizeNames)) {
      expect(screen.getByRole('radio', { name })).toBeOnTheScreen();
    }
    expect(screen.getByText('The size you reach for most')).toBeOnTheScreen();
    expect(screen.getByTestId('size-note')).toHaveTextContent(/fit the way your clothes do/);
  });

  it('writes the chosen size on the label as a large letter, with its full name, and the "try-on fit" line', async () => {
    useSession.setState({ user: user({ clothingSize: 'xxl' }) });
    await renderScreen(<EditSize />);

    expect(screen.getByTestId('size-letter')).toHaveTextContent('XXL');
    expect(screen.getByText('Double extra large')).toBeOnTheScreen();
    expect(screen.getByText('try-on fit')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('radio', { name: 'Small' }));

    expect(screen.getByTestId('size-letter')).toHaveTextContent('S');
    expect(screen.getByText('Small')).toBeOnTheScreen();
    expect(screen.getByTestId('size-letter').props.accessibilityLiveRegion).toBe('polite');
  });

  it('shows a dash and "Not set" until a size is chosen', async () => {
    await renderScreen(<EditSize />);

    expect(screen.getByTestId('size-letter')).toHaveTextContent('–');
    expect(screen.getByText('Not set')).toBeOnTheScreen();
    expect(screen.queryByRole('radio', { checked: true })).toBeNull();
    expect(screen.getByRole('button', { name: 'Not set for now' })).toBeOnTheScreen();
  });

  it('goes back to "not set" through "I’d rather not say"', async () => {
    useSession.setState({ user: user({ clothingSize: 'm' }) });
    api.updateProfile.mockResolvedValue(user());
    await renderScreen(<EditSize />);

    await fireEvent.press(screen.getByRole('button', { name: 'I’d rather not say' }));
    expect(screen.getByTestId('size-letter')).toHaveTextContent('–');
    expect(screen.getByRole('button', { name: 'Not set for now' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(api.updateProfile).toHaveBeenCalledWith({ clearClothingSize: true }));
  });

  it('keeps the size when the chosen button is pressed again', async () => {
    useSession.setState({ user: user({ clothingSize: 'm' }) });
    await renderScreen(<EditSize />);

    await fireEvent.press(screen.getByRole('radio', { name: 'Medium' }));

    expect(screen.getByRole('radio', { name: 'Medium' })).toBeChecked();
  });

  it('sends nothing when nothing changed', async () => {
    useSession.setState({ user: user({ clothingSize: 'm' }) });
    await renderScreen(<EditSize />);

    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    expect(api.updateProfile).not.toHaveBeenCalled();
    expect(router.back).toHaveBeenCalled();
  });

  it('says what the server refused and stays open', async () => {
    useSession.setState({ user: user({ clothingSize: 'm' }) });
    api.updateProfile.mockRejectedValue(new Error('network'));
    await renderScreen(<EditSize />);

    await fireEvent.press(screen.getByRole('radio', { name: 'Large' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(screen.getByTestId('edit-save')).toBeOnTheScreen());
    expect(router.back).not.toHaveBeenCalled();
  });
});

describe('the tape on the size label', () => {
  const timings = () => jest.mocked(withTiming).mock.calls.map(([to, config]) => ({ to, duration: (config as { duration: number }).duration }));

  it('puts the marker under each size in turn, and in the middle when nothing is chosen', () => {
    expect(markerShare('xs')).toBeCloseTo(0.12);
    expect(markerShare('xxl')).toBeCloseTo(0.88);
    expect(markerShare(null)).toBe(0.5);
  });

  it('slides the marker with a translation over the enter duration', async () => {
    const view = await render(<SizeLabel value="m" />);
    await fireEvent(screen.getByTestId('size-tape', { includeHiddenElements: true }), 'layout', { nativeEvent: { layout: { width: 300, height: 40, x: 0, y: 0 } } });
    jest.mocked(withTiming).mockClear();

    await view.rerender(<SizeLabel value="xl" />);

    expect(timings()).toContainEqual({ to: markerShare('xl') * 300 - 1, duration: motion.enter });
  });

  it('is hidden from screen readers', async () => {
    await render(<SizeLabel value="s" />);

    expect(screen.getByTestId('size-tape', { includeHiddenElements: true }).props.accessibilityElementsHidden).toBe(true);
  });
});

describe('the leg length screen', () => {
  it('is a radio group of three columns read out by neutral words', async () => {
    await renderScreen(<EditLegs />);

    expect(screen.getByTestId('legs').props).toMatchObject({ accessibilityRole: 'radiogroup', accessibilityLabel: 'Leg length' });
    expect(screen.getAllByRole('radio')).toHaveLength(3);
    for (const label of ['Shorter', 'Average', 'Longer']) {
      expect(screen.getByRole('radio', { name: label })).toBeOnTheScreen();
    }
    expect(screen.getByText('Where does your waist sit?')).toBeOnTheScreen();
    for (const { caption } of Object.values(legDetails)) {
      expect(screen.getByText(caption)).toBeOnTheScreen();
    }
  });

  it('saves the choice', async () => {
    api.updateProfile.mockResolvedValue(user({ legLength: 'shorter' }));
    await renderScreen(<EditLegs />);

    await fireEvent.press(screen.getByRole('radio', { name: 'Shorter' }));
    expect(screen.getByRole('radio', { name: 'Shorter' })).toBeChecked();
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(api.updateProfile).toHaveBeenCalledWith({ legLength: 'shorter' }));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect(useSession.getState().user?.legLength).toBe('shorter');
  });

  it('explains the chosen option in the card under the figures, and says "Not set" before', async () => {
    await renderScreen(<EditLegs />);

    expect(screen.getByTestId('legs-card')).toHaveTextContent(`${legsNotSet.title}${legsNotSet.hint}`);
    for (const [label, value] of [['Shorter', 'shorter'], ['Average', 'average'], ['Longer', 'longer']] as const) {
      await fireEvent.press(screen.getByRole('radio', { name: label }));
      expect(screen.getByTestId('legs-card')).toHaveTextContent(`${legDetails[value].title}${legDetails[value].hint}`);
    }
  });

  it('starts on the current choice', async () => {
    useSession.setState({ user: user({ legLength: 'longer' }) });
    await renderScreen(<EditLegs />);

    expect(screen.getByRole('radio', { name: 'Longer' })).toBeChecked();
    expect(screen.getByTestId('legs-card')).toHaveTextContent(/^Longer legs/);
  });

  it('goes back to "not set" through "I’d rather not say"', async () => {
    useSession.setState({ user: user({ legLength: 'longer' }) });
    api.updateProfile.mockResolvedValue(user());
    await renderScreen(<EditLegs />);

    await fireEvent.press(screen.getByRole('button', { name: 'I’d rather not say' }));
    expect(screen.queryByRole('radio', { checked: true })).toBeNull();
    expect(screen.getByTestId('legs-card')).toHaveTextContent(/^Not set/);
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(api.updateProfile).toHaveBeenCalledWith({ clearLegLength: true }));
  });

  it('sends nothing when nothing changed', async () => {
    useSession.setState({ user: user({ legLength: 'average' }) });
    await renderScreen(<EditLegs />);

    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    expect(api.updateProfile).not.toHaveBeenCalled();
    expect(router.back).toHaveBeenCalled();
  });
});

describe('the figures', () => {
  it('hide their drawings from screen readers and fade the chosen look out over the press duration', async () => {
    const view = await render(<LegFigures value="average" onChange={jest.fn()} />);
    const timings = () => jest.mocked(withTiming).mock.calls.map(([to, config]) => ({ to, duration: (config as { duration: number }).duration }));
    jest.mocked(withTiming).mockClear();

    await view.rerender(<LegFigures value="longer" onChange={jest.fn()} />);

    expect(timings().filter(({ to }) => to === 1)).toEqual([]);
    expect(timings().every(({ duration }) => duration === motion.press)).toBe(true);
    expect(screen.getByRole('radio', { name: 'Longer' })).toBeChecked();
  });
});
