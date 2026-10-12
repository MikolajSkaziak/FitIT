import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { Linking } from 'react-native';
import { useReducedMotion, withTiming } from 'react-native-reanimated';

import * as account from '@/api/account';
import { ApiError, networkProblem } from '@/api/problem';
import * as wardrobe from '@/api/wardrobe';
import RegisterAccount from '@/app/(auth)/register/account';
import RegisterBasics from '@/app/(auth)/register/basics';
import RegisterGender from '@/app/(auth)/register/index';
import RegisterLook from '@/app/(auth)/register/look';
import RegisterPlace from '@/app/(auth)/register/place';
import RegisterStyles from '@/app/(auth)/register/style';
import Welcome from '@/app/(auth)/welcome';
import { useSession } from '@/auth/session';
import { thermalPictures } from '@/components/brand';
import { usePendingPieces } from '@/features/onboarding/pendingPieces';
import { useRegistrationDraft } from '@/features/registration/draft';
import { messages } from '@/features/registration/validation';
import * as location from '@/lib/location';
import { starterPiece, user, wardrobeDictionaries } from '@/test/fixtures';
import { expectAccent, expectNoAccent, renderScreen, router } from '@/test/screen';

jest.mock('expo-router', () => jest.requireActual('@/test/screen').routerModule);
jest.mock('@/lib/config', () => ({ apiUrl: 'http://api.test' }));
jest.mock('@/auth/tokenStorage', () => ({
  tokenStorage: { load: jest.fn(async () => null), save: jest.fn(async () => undefined), clear: jest.fn(async () => undefined) },
}));
jest.mock('@/api/account', () => ({
  ...jest.requireActual('@/api/account'),
  checkEmail: jest.fn(),
  register: jest.fn(),
  searchPlaces: jest.fn(),
  updateProfile: jest.fn(),
}));
jest.mock('@/api/wardrobe', () => ({
  ...jest.requireActual('@/api/wardrobe'),
  fetchStarterPieces: jest.fn(),
  fetchDictionaries: jest.fn(),
  addStarterPieces: jest.fn(),
}));
jest.mock('@/lib/location', () => ({ ...jest.requireActual('@/lib/location'), findDevicePlace: jest.fn() }));

const api = jest.mocked(account);
const shop = jest.mocked(wardrobe);
const findDevicePlace = jest.mocked(location.findDevicePlace);

const starter = starterPiece;
const catalog = [
  starter('white_tshirt', 'White T-shirt', 'top'),
  starter('blue_jeans', 'Blue jeans', 'bottom'),
  starter('white_sneakers', 'White sneakers', 'shoes'),
  starter('navy_jacket', 'Navy jacket', 'outerwear'),
];
const gliwice = { name: 'Gliwice', lat: 50.3, lon: 18.7 };

beforeEach(() => {
  jest.clearAllMocks();
  useRegistrationDraft.getState().reset();
  usePendingPieces.getState().clear();
  useSession.setState({ status: 'signedOut', user: null, accessToken: null, refreshToken: null });
  shop.fetchStarterPieces.mockResolvedValue(catalog);
  shop.fetchDictionaries.mockResolvedValue(wardrobeDictionaries as wardrobe.Dictionaries);
  shop.addStarterPieces.mockResolvedValue({ added: 0, alreadyThere: 0 });
});

describe('welcome', () => {
  afterEach(() => jest.mocked(useReducedMotion).mockReturnValue(false));

  it('starts the journey without asking for anything, and keeps the way in for people with an account', async () => {
    await renderScreen(<Welcome />);

    await fireEvent.press(screen.getByRole('button', { name: 'Get started' }));
    expect(router.push).toHaveBeenLastCalledWith('/register');
    await fireEvent.press(screen.getByRole('button', { name: 'I already have an account' }));
    expect(router.push).toHaveBeenLastCalledWith('/login');
  });

  it('keeps the name "fitit." as one heading, and drops the full stop in last, once', async () => {
    jest.mocked(withTiming).mockClear();
    await renderScreen(<Welcome />);

    const wordmark = screen.getByRole('header', { name: 'fitit.' });
    expect(wordmark).toBeOnTheScreen();
    expect(screen.getByTestId('welcome-wordmark-stop')).toBeOnTheScreen();
    expect(screen.queryByText('fit')).toBeNull();
    expect(screen.getByText('fit', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(wordmark).toHaveTextContent('fitit.');
    // The full stop is the only thing on this screen that is timed: one drop over the enter duration, after a wait.
    expect(jest.mocked(withTiming).mock.calls.map(([to, config]) => [to, (config as { duration: number }).duration])).toContainEqual([1, 200]);
    expect(screen.getByTestId('welcome-wordmark-stop')).toHaveStyle({ opacity: 0, transform: [{ translateY: -6 }] });
  });

  it('shows the whole wordmark at once when the system asks for less movement', async () => {
    jest.mocked(useReducedMotion).mockReturnValue(true);
    await renderScreen(<Welcome />);

    expect(screen.getByTestId('welcome-wordmark-stop')).toHaveStyle({ opacity: 1, transform: [{ translateY: 0 }] });
  });

  it('forgets a sign-up that was left: the gender, the picks, the place and what was typed', async () => {
    useRegistrationDraft.getState().set({ gender: 'male', styles: ['casual'], starters: ['white_tshirt'], place: { ...gliwice, source: 'device' }, email: 'ola@example.com', password: 'secretpass1' });

    await renderScreen(<Welcome />);

    expect(useRegistrationDraft.getState()).toMatchObject({ gender: null, styles: [], starters: [], place: null, email: '', password: '' });
  });
});

describe('step 1: who we are dressing', () => {
  it('asks first, in plain words, with the four answers as rows and none chosen', async () => {
    await renderScreen(<RegisterGender />);

    expect(screen.getByRole('header', { name: 'Who are we dressing?' })).toBeOnTheScreen();
    expectAccent('letters', 'dressing');
    expect(screen.getByText('It decides which styles and body shapes you see, and you can change it later in Profile.')).toBeOnTheScreen();
    expect(screen.getByRole('progressbar', { name: 'Four steps to your first look' })).toBeOnTheScreen();
    expect(screen.getAllByRole('radio').map((row) => row.props.accessibilityLabel)).toEqual(['Woman', 'Man', 'Non-binary', 'Prefer not to say']);
    expect(screen.queryByRole('radio', { checked: true })).toBeNull();
    expect(useRegistrationDraft.getState().gender).toBeNull();
  });

  it('cannot be skipped: Continue waits for an answer', async () => {
    await renderScreen(<RegisterGender />);

    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
    expect(screen.queryByRole('link', { name: /skip/i })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(router.push).not.toHaveBeenCalled();
  });

  it('keeps the chosen row in the draft and goes on to the styles', async () => {
    await renderScreen(<RegisterGender />);

    await fireEvent.press(screen.getByRole('radio', { name: 'Man' }));
    expect(screen.getByRole('radio', { name: 'Man' })).toBeChecked();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled();
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));

    expect(useRegistrationDraft.getState().gender).toBe('male');
    expect(router.push).toHaveBeenCalledWith('/register/style');
    expect(api.register).not.toHaveBeenCalled();
  });

  it('takes "Prefer not to say" as an answer like the others', async () => {
    await renderScreen(<RegisterGender />);

    await fireEvent.press(screen.getByRole('radio', { name: 'Prefer not to say' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));

    expect(useRegistrationDraft.getState().gender).toBe('unspecified');
    expect(router.push).toHaveBeenCalledWith('/register/style');
  });

  it('shows the earlier answer when the person comes back, and lets them change it', async () => {
    useRegistrationDraft.getState().set({ gender: 'female', styles: ['casual'] });
    await renderScreen(<RegisterGender />);

    expect(screen.getByRole('radio', { name: 'Woman' })).toBeChecked();
    await fireEvent.press(screen.getByRole('radio', { name: 'Non-binary' }));

    expect(useRegistrationDraft.getState()).toMatchObject({ gender: 'non_binary', styles: ['casual'] });
  });
});

describe('step 2: styles', () => {
  type Node = { props?: Record<string, unknown>; children?: (Node | string)[] | null };
  /** The address of the photo inside one style tile. */
  const photoOf = (code: string): string | undefined => {
    const find = (node: Node | string | null): string | undefined => {
      if (!node || typeof node === 'string') {
        return undefined;
      }

      if (node.props && 'contentFit' in node.props) {
        return (node.props.source as { uri: string }[]).at(0)?.uri;
      }

      return node.children?.map(find).find((uri) => uri !== undefined);
    };

    return find(screen.getByTestId(`style-${code}`) as unknown as Node);
  };

  beforeEach(() => {
    shop.fetchDictionaries.mockResolvedValue({
      ...wardrobeDictionaries,
      styles: ['casual', 'smart', 'elegant', 'sporty'].map((code) => ({ code, label: code, womanImageUrl: `http://api.test/styles/${code}-f.jpg`, manImageUrl: `http://api.test/styles/${code}-m.jpg` })),
    } as unknown as wardrobe.Dictionaries);
  });

  it('opens with the photos and asks the server for nothing but them', async () => {
    await renderScreen(<RegisterStyles />);

    expect(screen.getByRole('header', { name: 'What do you like to wear?' })).toBeOnTheScreen();
    expectAccent('sway', 'wear');
    expect(screen.getByRole('progressbar', { name: 'Three more steps to your first look' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('style-casual'));
    await fireEvent.press(screen.getByTestId('register-next'));

    expect(useRegistrationDraft.getState().styles).toEqual(['casual']);
    expect(router.push).toHaveBeenCalledWith('/register/basics');
    expect(api.register).not.toHaveBeenCalled();
  });

  it.each([
    ['female', 'f'],
    ['male', 'm'],
  ] as const)('shows every style on the %s photo once that gender is chosen', async (gender, suffix) => {
    useRegistrationDraft.getState().set({ gender });
    await renderScreen(<RegisterStyles />);

    await waitFor(() => expect(photoOf('casual')).toBe(`http://api.test/styles/casual-${suffix}.jpg`));
    for (const code of ['smart', 'elegant', 'sporty']) {
      expect(photoOf(code)).toBe(`http://api.test/styles/${code}-${suffix}.jpg`);
    }
  });

  it.each(['non_binary', 'unspecified'] as const)('alternates a woman and a man for %s, as it does when nothing is known', async (gender) => {
    useRegistrationDraft.getState().set({ gender });
    await renderScreen(<RegisterStyles />);

    await waitFor(() => expect(photoOf('casual')).toBe('http://api.test/styles/casual-f.jpg'));
    expect(photoOf('smart')).toBe('http://api.test/styles/smart-m.jpg');
    expect(photoOf('elegant')).toBe('http://api.test/styles/elegant-f.jpg');
  });

  it('keeps the picks when the gender is changed afterwards: only the photos change', async () => {
    useRegistrationDraft.getState().set({ gender: 'female', styles: ['casual', 'sporty'] });
    await renderScreen(<RegisterStyles />);
    await waitFor(() => expect(photoOf('casual')).toBe('http://api.test/styles/casual-f.jpg'));

    await act(async () => useRegistrationDraft.getState().set({ gender: 'male' }));

    await waitFor(() => expect(photoOf('casual')).toBe('http://api.test/styles/casual-m.jpg'));
    expect(screen.getByTestId('style-casual')).toBeChecked();
    expect(screen.getByTestId('style-sporty')).toBeChecked();
    expect(useRegistrationDraft.getState().styles).toEqual(['casual', 'sporty']);
  });

  it('can be skipped, which keeps no style', async () => {
    useRegistrationDraft.getState().set({ styles: ['casual'] });
    await renderScreen(<RegisterStyles />);

    await fireEvent.press(screen.getByRole('link', { name: 'Skip for now' }));

    expect(useRegistrationDraft.getState().styles).toEqual([]);
    expect(router.push).toHaveBeenCalledWith('/register/basics');
  });
});

describe('step 3: the pieces you own', () => {
  it('shows the common pieces without an account, and keeps the ticks in the draft in the order of the list', async () => {
    await renderScreen(<RegisterBasics />);

    expect(screen.getByRole('header', { name: 'Tap what you already own' })).toBeOnTheScreen();
    expectAccent('tap', 'Tap');
    expect(screen.getByRole('progressbar', { name: 'Two more steps to your first look' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Continue without pieces' })).toBeEnabled();
    await fireEvent.press(await screen.findByTestId('starter-navy_jacket'));
    await fireEvent.press(screen.getByTestId('starter-white_tshirt'));

    expect(screen.getByTestId('starter-white_tshirt')).toBeChecked();
    expect(screen.getByTestId('basics-count')).toHaveTextContent('2 of 4 selected');
    expect(useRegistrationDraft.getState().starters).toEqual(['white_tshirt', 'navy_jacket']);
    await fireEvent.press(screen.getByRole('button', { name: 'Continue with 2 pieces' }));

    expect(router.push).toHaveBeenCalledWith('/register/place');
    expect(shop.addStarterPieces).not.toHaveBeenCalled();
  });

  it('selects all with one control and clears them with the same one', async () => {
    await renderScreen(<RegisterBasics />);
    await screen.findByTestId('starter-white_tshirt');

    await fireEvent.press(screen.getByText('Select all'));
    expect(useRegistrationDraft.getState().starters).toHaveLength(4);
    await fireEvent.press(screen.getByText('Clear'));
    expect(useRegistrationDraft.getState().starters).toEqual([]);
  });

  describe('by the gender chosen at step 1', () => {
    const wide = [
      starter('white_tshirt', 'White T-shirt', 'top'),
      starter('little_black_dress', 'Little black dress', 'one_piece', { type: 'dress', audience: 'women' }),
      starter('black_midi_skirt', 'Black midi skirt', 'bottom', { type: 'skirt', group: 'skirts', audience: 'women' }),
      starter('navy_blazer', 'Navy blazer', 'mid_layer', { type: 'blazer', group: 'suits_and_blazers', audience: 'men' }),
      starter('blue_jeans', 'Blue jeans', 'bottom', { type: 'jeans', group: 'jeans' }),
    ];
    const codes = () => screen.getAllByTestId(/^starter-/).map((tile) => tile.props.testID as string);

    beforeEach(() => {
      shop.fetchStarterPieces.mockResolvedValue(wide);
    });

    it.each([
      ['female', ['starter-white_tshirt', 'starter-little_black_dress', 'starter-black_midi_skirt', 'starter-blue_jeans']],
      ['male', ['starter-white_tshirt', 'starter-navy_blazer', 'starter-blue_jeans']],
      ['non_binary', wide.map((piece) => `starter-${piece.code}`)],
      ['unspecified', wide.map((piece) => `starter-${piece.code}`)],
    ] as const)('shows %s the pieces that suit them, and counts only those', async (gender, expected) => {
      useRegistrationDraft.getState().set({ gender });
      await renderScreen(<RegisterBasics />);

      await screen.findByTestId('starter-white_tshirt');
      expect(codes()).toEqual(expected);
      expect(screen.getByTestId('basics-count')).toHaveTextContent(`0 of ${expected.length} selected`);
    });

    it('shows everything while no gender is known', async () => {
      await renderScreen(<RegisterBasics />);

      await screen.findByTestId('starter-white_tshirt');
      expect(codes()).toHaveLength(wide.length);
    });

    it('has a tab only for the groups that have a piece for this person, and the women get Dresses and Skirts', async () => {
      useRegistrationDraft.getState().set({ gender: 'female' });
      await renderScreen(<RegisterBasics />);
      await screen.findByTestId('starter-white_tshirt');

      expect(screen.getAllByRole('tab').map((tab) => tab.props.accessibilityLabel)).toEqual(['All', 'T-shirts and tops', 'Jeans', 'Skirts', 'Dresses and jumpsuits']);

      await fireEvent.press(screen.getByRole('tab', { name: 'Skirts' }));
      expect(codes()).toEqual(['starter-black_midi_skirt']);
    });

    it('gives a man the blazer tab and none of the women’s', async () => {
      useRegistrationDraft.getState().set({ gender: 'male' });
      await renderScreen(<RegisterBasics />);
      await screen.findByTestId('starter-white_tshirt');

      expect(screen.getAllByRole('tab').map((tab) => tab.props.accessibilityLabel)).toEqual(['All', 'T-shirts and tops', 'Jeans', 'Suits and blazers']);
    });

    it('drops ticks for pieces the chosen gender does not show, so they never reach the wardrobe', async () => {
      useRegistrationDraft.getState().set({ gender: 'female', starters: ['white_tshirt', 'little_black_dress', 'navy_blazer'] });
      await renderScreen(<RegisterBasics />);
      await screen.findByTestId('starter-white_tshirt');

      expect(screen.getByTestId('basics-count')).toHaveTextContent('2 of 4 selected');
      await fireEvent.press(screen.getByRole('button', { name: 'Continue with 2 pieces' }));

      expect(useRegistrationDraft.getState().starters).toEqual(['white_tshirt', 'little_black_dress']);
      expect(router.push).toHaveBeenCalledWith('/register/place');
    });
  });

  it('offers another try when the list does not load, and still lets the person go on', async () => {
    shop.fetchStarterPieces.mockRejectedValueOnce(new ApiError({ status: 500, code: 'server_error' }));
    await renderScreen(<RegisterBasics />);

    expect(await screen.findByText(/couldn’t load the basics/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('register-next'));
    expect(router.push).toHaveBeenCalledWith('/register/place');
  });
});

describe('step 4: where you are', () => {
  it('offers the phone’s location first, a city search second, and nothing about how the person feels the cold', async () => {
    await renderScreen(<RegisterPlace />);

    const choices = screen.getAllByRole('radio');
    expect(choices.map((choice) => choice.props.accessibilityLabel)).toEqual(['Use my location', 'Search for a city']);
    expect(screen.getByRole('progressbar', { name: 'One more step to your first look' })).toBeOnTheScreen();
    expect(screen.queryByTestId('place-search')).toBeNull();
    expect(screen.getByRole('header', { name: 'Where are\nyou?' })).toBeOnTheScreen();
    expectAccent('drop', 'Where');
    expect(screen.queryByText(/feel/i)).toBeNull();
    // Nothing to continue with yet: only skipping is offered.
    expect(screen.queryByTestId('register-next')).toBeNull();
  });

  it('takes the rounded place of the phone with one tap, then asks how the person feels the cold, and moves on with Continue', async () => {
    findDevicePlace.mockResolvedValue({ kind: 'found', place: gliwice });
    await renderScreen(<RegisterPlace />);
    expect(screen.queryByTestId('register-thermal')).toBeNull();

    await fireEvent.press(screen.getByTestId('register-use-location'));

    expect(await screen.findByTestId('register-found')).toHaveTextContent('Gliwice');
    expect(router.push).not.toHaveBeenCalled();
    expect(screen.getByText('And how do you usually feel?')).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'About average' })).toBeChecked();

    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));

    expect(router.push).toHaveBeenCalledWith('/register/look');
    expect(useRegistrationDraft.getState()).toMatchObject({ place: { source: 'device', ...gliwice }, thermalPreference: 'normal' });
    expect(api.register).not.toHaveBeenCalled();
  });

  it('keeps the feeling the person chose, for the account that is created at the end', async () => {
    findDevicePlace.mockResolvedValue({ kind: 'found', place: gliwice });
    await renderScreen(<RegisterPlace />);
    await fireEvent.press(screen.getByTestId('register-use-location'));
    await screen.findByTestId('register-found');

    await fireEvent.press(screen.getByRole('radio', { name: 'I get cold easily' }));
    expect(screen.getByRole('radio', { name: 'I get cold easily' })).toBeChecked();
    expect(screen.getByTestId('register-thermal-effect')).toHaveTextContent('fitit. dresses you as if it were 3° colder than the forecast says.');
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));

    expect(useRegistrationDraft.getState().thermalPreference).toBe('runs_cold');
  });

  it('shows the question for a city too, once one is picked, and not before', async () => {
    api.searchPlaces.mockResolvedValue([{ name: 'Osaka', region: 'Osaka', country: 'Japan', lat: 34.6937, lon: 135.5023 }]);
    await renderScreen(<RegisterPlace />);

    await fireEvent.press(screen.getByTestId('register-choose-city'));
    expect(screen.queryByTestId('register-thermal')).toBeNull();
    await fireEvent.changeText(screen.getByTestId('place-search'), 'Osaka');
    await fireEvent.press(await screen.findByTestId('place-0'));

    expect(screen.getByTestId('register-thermal')).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'About average' })).toBeChecked();
  });

  it('shows the pictures that fit the gender chosen at the first step', async () => {
    findDevicePlace.mockResolvedValue({ kind: 'found', place: gliwice });
    useRegistrationDraft.getState().set({ gender: 'male' });
    await renderScreen(<RegisterPlace />);

    await fireEvent.press(screen.getByTestId('register-use-location'));

    const source = screen.getByTestId('register-thermal-picture-normal').props.source;
    expect(source).toEqual([thermalPictures.m.normal]);
  });

  it('shows the city search right there when the person refuses the location', async () => {
    findDevicePlace.mockResolvedValue({ kind: 'denied' });
    const settings = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
    await renderScreen(<RegisterPlace />);

    await fireEvent.press(screen.getByTestId('register-use-location'));

    expect(await screen.findByTestId('place-search')).toBeOnTheScreen();
    expect(screen.getByText('Location is turned off. Choose a city, or turn it on in your phone’s Settings.')).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'Search for a city' })).toBeChecked();
    expect(router.push).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('link', { name: 'Open phone settings' }));
    expect(settings).toHaveBeenCalled();
    settings.mockRestore();
  });

  it('shows the search too when the phone cannot tell where it is', async () => {
    findDevicePlace.mockResolvedValue({ kind: 'unavailable' });
    await renderScreen(<RegisterPlace />);

    await fireEvent.press(screen.getByTestId('register-use-location'));

    expect(await screen.findByText('We couldn’t find your location. Try again, or choose a city.')).toBeOnTheScreen();
    expect(screen.getByTestId('place-search')).toBeOnTheScreen();
    expect(screen.queryByRole('link', { name: 'Open phone settings' })).toBeNull();
  });

  it('keeps a city picked from the search, rounded to a tenth of a degree', async () => {
    api.searchPlaces.mockResolvedValue([{ name: 'Osaka', region: 'Osaka', country: 'Japan', lat: 34.6937, lon: 135.5023 }]);
    await renderScreen(<RegisterPlace />);

    await fireEvent.press(screen.getByTestId('register-choose-city'));
    await fireEvent.changeText(screen.getByTestId('place-search'), 'Osaka');
    await fireEvent.press(await screen.findByTestId('place-0'));
    await fireEvent.press(screen.getByTestId('register-next'));

    expect(findDevicePlace).not.toHaveBeenCalled();
    expect(useRegistrationDraft.getState().place).toEqual({ source: 'manual', name: 'Osaka', lat: 34.7, lon: 135.5 });
    expect(router.push).toHaveBeenCalledWith('/register/look');
  });

  it('switches back to the phone location after a refusal, without asking the city search for anything', async () => {
    findDevicePlace.mockResolvedValueOnce({ kind: 'denied' }).mockResolvedValueOnce({ kind: 'found', place: gliwice });
    await renderScreen(<RegisterPlace />);
    await fireEvent.press(screen.getByTestId('register-use-location'));
    expect(await screen.findByTestId('place-search')).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('register-use-location'));

    expect(await screen.findByTestId('register-found')).toBeOnTheScreen();
    expect(screen.queryByTestId('place-search')).toBeNull();
    expect(screen.queryByText('Location is turned off. Choose a city, or turn it on in your phone’s Settings.')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(useRegistrationDraft.getState().place).toEqual({ source: 'device', ...gliwice });
  });

  it('keeps the place of the phone when the person comes back and looks at the city search', async () => {
    findDevicePlace.mockResolvedValue({ kind: 'found', place: gliwice });
    await renderScreen(<RegisterPlace />);
    await fireEvent.press(screen.getByTestId('register-use-location'));
    await screen.findByTestId('register-found');

    await fireEvent.press(screen.getByTestId('register-choose-city'));
    expect(screen.getByTestId('place-search')).toBeOnTheScreen();
    expect(screen.queryByTestId('register-found')).toBeNull();
    expect(screen.queryByTestId('register-next')).toBeNull();

    await fireEvent.press(screen.getByTestId('register-use-location'));

    expect(screen.getByTestId('register-found')).toHaveTextContent('Gliwice');
    expect(findDevicePlace).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled();
  });

  it('lets the person skip the place', async () => {
    useRegistrationDraft.getState().set({ place: { ...gliwice, source: 'device' } });
    await renderScreen(<RegisterPlace />);

    await fireEvent.press(screen.getByTestId('register-skip-place'));

    expect(useRegistrationDraft.getState().place).toBeNull();
    expect(router.push).toHaveBeenCalledWith('/register/look');
    expect(findDevicePlace).not.toHaveBeenCalled();
  });
});

describe('step 5: your first look', () => {
  it('shows a look made only of the pieces the person ticked, names the city, and asks for an account to keep it', async () => {
    useRegistrationDraft.getState().set({ starters: ['white_tshirt', 'blue_jeans', 'white_sneakers'], place: { ...gliwice, source: 'device' } });
    await renderScreen(<RegisterLook />);

    expect(await screen.findByRole('image', { name: 'Outfit on a board: White T-shirt, Blue jeans, White sneakers' })).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Your first look is ready' })).toBeOnTheScreen();
    expectAccent('none', 'ready');
    expect(screen.getByTestId('title-underline')).toBeOnTheScreen();
    expect(screen.getByText(/weather in Gliwice/)).toBeOnTheScreen();
    expect(screen.queryByText(/Navy jacket/)).toBeNull();
    expect(screen.getByRole('progressbar', { name: 'Your wardrobe so far' })).toHaveProp('accessibilityValue', { min: 0, max: 100, now: 100 });

    await fireEvent.press(screen.getByRole('button', { name: 'Create an account to keep it' }));
    expect(router.push).toHaveBeenCalledWith('/register/account');
  });

  it('says where the look came from when no city was given', async () => {
    useRegistrationDraft.getState().set({ starters: ['white_tshirt', 'blue_jeans'] });
    await renderScreen(<RegisterLook />);

    expect(await screen.findByTestId('first-look')).toBeOnTheScreen();
    expect(screen.getByText('Made from the pieces you just picked.')).toBeOnTheScreen();
  });

  it.each([[[]], [['white_tshirt']]])('shows a photograph and says what is missing when there are too few pieces: %p', async (starters) => {
    useRegistrationDraft.getState().set({ starters });
    await renderScreen(<RegisterLook />);

    expect(await screen.findByText('Add a few pieces and your first looks appear here')).toBeOnTheScreen();
    expect(screen.getByTestId('first-look-photo')).toBeOnTheScreen();
    expect(screen.queryByTestId('first-look')).toBeNull();
    expect(screen.queryByRole('header', { name: 'Your first look is ready' })).toBeNull();
    expect(screen.queryByTestId('title-underline')).toBeNull();
    expect(screen.getByRole('button', { name: 'Create an account to keep it' })).toBeOnTheScreen();
  });

  it('"Not now" goes back to the start, in plain words', async () => {
    await renderScreen(<RegisterLook />);

    await fireEvent.press(screen.getByRole('button', { name: 'Not now' }));

    expect(router.dismissTo).toHaveBeenCalledWith('/welcome');
    expect(api.register).not.toHaveBeenCalled();
  });
});

describe('step 6: create account', () => {
  const auth = { accessToken: 'a', refreshToken: 'r', expiresIn: 900, user: { id: 'u1', displayName: 'Ola' } as account.User };
  const picked = { gender: 'female' as const, styles: ['casual' as const], starters: ['white_tshirt', 'blue_jeans'], place: { ...gliwice, source: 'device' as const } };

  const fill = async () => {
    await fireEvent.changeText(screen.getByTestId('register-name'), ' Ola ');
    await fireEvent.press(screen.getByTestId('register-birth-date-month'));
    await fireEvent.press(await screen.findByTestId('month-3'));
    await fireEvent.changeText(screen.getByTestId('register-birth-date-day'), '14');
    await fireEvent.changeText(screen.getByTestId('register-birth-date-year'), '1999');
    await fireEvent.changeText(screen.getByTestId('register-email'), ' ola@example.com ');
    await fireEvent.changeText(screen.getByTestId('register-password'), 'secretpass1');
  };

  beforeEach(() => {
    useRegistrationDraft.getState().set(picked);
    api.register.mockResolvedValue(auth);
  });

  it('asks for a name, a birth date, an email and a password, with the agreement under the button and no password filled in', async () => {
    await renderScreen(<RegisterAccount />);

    expect(screen.getByText('Create your\naccount')).toBeOnTheScreen();
    expectNoAccent();
    expect(screen.getByTestId('register-password').props.value).toBe('');
    expect(screen.getByTestId('legal-note')).toHaveTextContent('By creating an account you agree to the Terms and Privacy Policy.');
    expect(screen.queryByText(/gender|body shape|size/i)).toBeNull();
  });

  it('says what is missing and asks the server nothing', async () => {
    await renderScreen(<RegisterAccount />);

    await fireEvent.press(screen.getByTestId('register-submit'));

    for (const message of [messages.nameMissing, messages.birthDateMissing, messages.emailMissing, messages.passwordMissing]) {
      expect(screen.getByText(message)).toBeOnTheScreen();
    }
    expect(api.register).not.toHaveBeenCalled();
  });

  it('creates the account with what was picked on the way, then adds the pieces to the new wardrobe', async () => {
    shop.addStarterPieces.mockResolvedValue({ added: 2, alreadyThere: 0 });
    await renderScreen(<RegisterAccount />);
    await fill();

    await fireEvent.press(screen.getByTestId('register-submit'));

    await waitFor(() => expect(shop.addStarterPieces).toHaveBeenCalledWith(['white_tshirt', 'blue_jeans']));
    expect(api.register).toHaveBeenCalledWith({
      email: 'ola@example.com',
      password: 'secretpass1',
      displayName: 'Ola',
      birthDate: '1999-03-14',
      gender: 'female',
      styles: ['casual'],
      thermalPreference: 'normal',
      location: { source: 'device', ...gliwice },
    });
    expect(useSession.getState().status).toBe('signedIn');
    // The pieces need the account: the session has started by the time they are sent.
    expect(api.register.mock.invocationCallOrder[0]).toBeLessThan(shop.addStarterPieces.mock.invocationCallOrder[0] as number);
    // Nothing typed during registration (a password among it) outlives the registration.
    expect(useRegistrationDraft.getState()).toMatchObject({ email: '', password: '', starters: [] });
    expect(usePendingPieces.getState().codes).toEqual([]);
    // Felt once: the account exists.
    expect(jest.mocked(Haptics.notificationAsync).mock.calls).toEqual([['success']]);
  });

  it('creates the account without any consent to AI: none is sent, none is saved afterwards, and the new person has none', async () => {
    api.register.mockResolvedValue({ ...auth, user: user({ aiConsentAt: null }) });
    await renderScreen(<RegisterAccount />);
    await fill();

    await fireEvent.press(screen.getByTestId('register-submit'));

    await waitFor(() => expect(useSession.getState().status).toBe('signedIn'));
    expect(Object.keys(api.register.mock.calls[0]![0])).not.toContain('aiConsent');
    expect(api.updateProfile).not.toHaveBeenCalled();
    expect(useSession.getState().user?.aiConsentAt).toBeNull();
  });

  it('sends the feeling of the cold chosen on the place step', async () => {
    useRegistrationDraft.getState().set({ thermalPreference: 'runs_warm' });
    await renderScreen(<RegisterAccount />);
    await fill();

    await fireEvent.press(screen.getByTestId('register-submit'));

    await waitFor(() => expect(api.register).toHaveBeenCalledWith(expect.objectContaining({ thermalPreference: 'runs_warm' })));
  });

  it('sends "prefer not to say" as the chosen gender, not as a missing one', async () => {
    useRegistrationDraft.getState().set({ gender: 'unspecified' });
    await renderScreen(<RegisterAccount />);
    await fill();

    await fireEvent.press(screen.getByTestId('register-submit'));

    await waitFor(() => expect(api.register).toHaveBeenCalledWith(expect.objectContaining({ gender: 'unspecified' })));
  });

  it('sends no place and adds no pieces when none were given', async () => {
    useRegistrationDraft.getState().set({ styles: [], starters: [], place: null });
    await renderScreen(<RegisterAccount />);
    await fill();

    await fireEvent.press(screen.getByTestId('register-submit'));

    await waitFor(() => expect(useSession.getState().status).toBe('signedIn'));
    expect(api.register).toHaveBeenCalledWith(expect.objectContaining({ styles: [], location: null }));
    expect(shop.addStarterPieces).not.toHaveBeenCalled();
  });

  it('still creates the account when the pieces cannot be added, and keeps them to say so and try again', async () => {
    shop.addStarterPieces.mockRejectedValue(new ApiError({ status: 500, code: 'server_error' }));
    await renderScreen(<RegisterAccount />);
    await fill();

    await fireEvent.press(screen.getByTestId('register-submit'));

    await waitFor(() => expect(usePendingPieces.getState().codes).toEqual(['white_tshirt', 'blue_jeans']));
    expect(useSession.getState().status).toBe('signedIn');
  });

  it('says at the email that the address is taken, creates nothing and keeps what was typed', async () => {
    api.register.mockRejectedValue(new ApiError({ status: 409, code: 'email_taken' }));
    await renderScreen(<RegisterAccount />);
    await fill();

    await fireEvent.press(screen.getByTestId('register-submit'));

    expect(await screen.findByText(messages.emailTaken)).toBeOnTheScreen();
    // The form was sent and refused: the error cue, once, and no success.
    expect(jest.mocked(Haptics.notificationAsync).mock.calls).toEqual([['error']]);
    expect(useSession.getState().status).toBe('signedOut');
    expect(useRegistrationDraft.getState()).toMatchObject({ email: ' ola@example.com ', starters: picked.starters });
    expect(shop.addStarterPieces).not.toHaveBeenCalled();
  });

  it('explains a missing connection above the button', async () => {
    api.register.mockRejectedValue(new ApiError(networkProblem));
    await renderScreen(<RegisterAccount />);
    await fill();

    await fireEvent.press(screen.getByTestId('register-submit'));

    expect(await screen.findByText('Can’t connect right now. Check your internet connection and try again.')).toBeOnTheScreen();
    expect(useSession.getState().status).toBe('signedOut');
  });
});
