import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';

import * as account from '@/api/account';
import * as colors from '@/api/colors';
import { ApiError } from '@/api/problem';
import * as wardrobe from '@/api/wardrobe';
import * as weatherApi from '@/api/weather';
import OnboardingColors from '@/app/(app)/onboarding/colors';
import OnboardingDone from '@/app/(app)/onboarding/done';
import OnboardingFit from '@/app/(app)/onboarding/fit';
import OnboardingStart from '@/app/(app)/onboarding/index';
import OnboardingPalette from '@/app/(app)/onboarding/palette';
import OnboardingQuiz from '@/app/(app)/onboarding/quiz';
import OnboardingSelfie from '@/app/(app)/onboarding/selfie';
import OnboardingShape from '@/app/(app)/onboarding/shape';
import TabsLayout from '@/app/(app)/(tabs)/_layout';
import { useSession } from '@/auth/session';
import { legDetails } from '@/copy/labels';
import { finishConsent } from '@/features/consent/session';
import { usePendingPieces } from '@/features/onboarding/pendingPieces';
import { messages } from '@/features/registration/validation';
import * as photos from '@/features/wardrobe/photos';
import { putFile } from '@/features/wardrobe/putFile';
import { clothing, colorAnalysis, user, weather } from '@/test/fixtures';
import { expectAccent, expectNoAccent, renderScreen, router } from '@/test/screen';

const mockRedirect = jest.fn();
jest.mock('expo-router', () => ({
  ...jest.requireActual('@/test/screen').routerModule,
  Redirect: (props: { href: unknown }) => {
    mockRedirect(props.href);
    return null;
  },
}));
jest.mock('expo-router/js-tabs', () => ({ Tabs: Object.assign(() => null, { Screen: () => null }) }));
jest.mock('@/lib/config', () => ({ apiUrl: 'http://api.test' }));
jest.mock('@/auth/tokenStorage', () => ({
  tokenStorage: { load: jest.fn(async () => null), save: jest.fn(async () => undefined), clear: jest.fn(async () => undefined) },
}));
jest.mock('@/api/account', () => ({ ...jest.requireActual('@/api/account'), updateProfile: jest.fn(), fetchAvatars: jest.fn() }));
jest.mock('@/api/colors', () => ({ createSelfieUpload: jest.fn(), analyzeColors: jest.fn(), deleteColorAnalysis: jest.fn() }));
jest.mock('@/api/wardrobe', () => ({ ...jest.requireActual('@/api/wardrobe'), fetchWardrobeStats: jest.fn(), fetchClothes: jest.fn(), addStarterPieces: jest.fn() }));
jest.mock('@/api/weather', () => ({ ...jest.requireActual('@/api/weather'), fetchWeatherToday: jest.fn() }));
const mockOpenCamera = jest.fn();
jest.mock('@/features/camera/session', () => ({ useCamera: () => mockOpenCamera }));
jest.mock('@/features/wardrobe/photos', () => ({ pickFromGallery: jest.fn(), preparePhoto: jest.fn(async (photo: { uri: string }) => photo.uri) }));
jest.mock('@/features/wardrobe/putFile', () => ({ putFile: jest.fn(async () => undefined) }));

const profile = jest.mocked(account);
const palette = jest.mocked(colors);
const shop = jest.mocked(wardrobe);
const forecast = jest.mocked(weatherApi);
const camera = jest.mocked(photos);

const fresh = (change: Partial<account.User> = {}) => user({ onboardingStep: 0, onboardingDoneAt: null, ...change });
const selfie = { uri: 'file:///selfie.jpg', width: 1200, height: 1600 };
const avatar = (id: string, gender: 'female' | 'male', bodyType: string): account.Avatar => ({
  id,
  gender,
  bodyType,
  label: bodyType,
  imageUrl: `https://images.test/${id}.jpg`,
  thumbUrl: `https://images.test/${id}.jpg`,
  figureUrl: `https://images.test/${id}.png`,
});
const women = ['hourglass', 'pear', 'apple', 'column', 'goblet'].map((type, index) => avatar(`f${index}`, 'female', type));
const men = ['triangle', 'rectangle', 'oval', 'trapezoid', 'inverted_triangle'].map((type, index) => avatar(`m${index}`, 'male', type));
const stats = (total: number) => ({ total, wornLast30Days: 0, forgotten: 0, processing: 0, needsTags: 0 });

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useLocalSearchParams).mockReturnValue({});
  useSession.setState({ status: 'signedIn', user: fresh(), accessToken: 'a', refreshToken: 'r' });
  shop.fetchWardrobeStats.mockResolvedValue(stats(0));
  shop.fetchClothes.mockResolvedValue([]);
  shop.addStarterPieces.mockResolvedValue({ added: 0, alreadyThere: 0 });
  forecast.fetchWeatherToday.mockResolvedValue(weather);
  profile.updateProfile.mockImplementation(async (change) => fresh({ onboardingStep: change.onboardingStep ?? 0 }));
  profile.fetchAvatars.mockImplementation(async (gender) => (gender === 'female' ? women : gender === 'male' ? men : [...women, ...men]));
  usePendingPieces.getState().clear();
});

describe('first after the account: the body shape of the gender chosen before it', () => {
  // The account was created with the gender chosen at the start of sign-up.
  const asked = (gender: account.Gender) => useSession.setState({ user: fresh({ gender }) });

  it('shows nothing as chosen on a new account, whatever stand-in it holds, and asks no gender', async () => {
    asked('female');
    await renderScreen(<OnboardingShape />);

    expect(screen.getByRole('header', { name: 'Your body shape' })).toBeOnTheScreen();
    expectAccent('stretch', 'shape');
    expect(screen.getByText(/only guides how outfits are balanced on you/)).toBeOnTheScreen();
    expect(screen.getByRole('progressbar', { name: 'Almost done — 3 left' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
    expect(screen.queryByRole('radio', { name: 'Woman' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Change gender' })).toBeOnTheScreen();
    await screen.findByTestId('silhouette-pear');
    expect(screen.queryByRole('radio', { checked: true })).toBeNull();
    expect(screen.queryByTestId('shape-all')).toBeNull();
  });

  it.each([
    ['female', 5, 'hourglass', 'oval'],
    ['male', 5, 'oval', 'hourglass'],
  ] as const)('shows only the five shapes of a %s account', async (gender, count, shown, hidden) => {
    asked(gender);
    await renderScreen(<OnboardingShape />);

    await screen.findByTestId(`silhouette-${shown}`);
    expect(screen.getAllByRole('radio')).toHaveLength(count);
    expect(screen.queryByTestId(`silhouette-${hidden}`)).toBeNull();
    expect(profile.fetchAvatars).toHaveBeenCalledWith(gender);
  });

  it.each(['non_binary', 'unspecified'] as const)('shows all ten shapes, with the one-line note, for %s', async (gender) => {
    asked(gender);
    await renderScreen(<OnboardingShape />);

    await screen.findByTestId('silhouette-oval');
    expect(screen.getAllByRole('radio')).toHaveLength(10);
    expect(screen.getByTestId('shape-all')).toHaveTextContent('You see all ten shapes, so pick whichever is closest.');
  });

  it('needs a body shape before the person can go on, and says so', async () => {
    asked('male');
    await renderScreen(<OnboardingShape />);
    await screen.findByTestId('silhouette-oval');

    await fireEvent.press(screen.getByTestId('shape-next'));

    expect(screen.getByText(messages.avatarMissing)).toBeOnTheScreen();
    expect(profile.updateProfile).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
  });

  it('opens the gender choice right here, narrows the shapes and drops a shape of the other set', async () => {
    asked('male');
    await renderScreen(<OnboardingShape />);
    await fireEvent.press(await screen.findByTestId('silhouette-oval'));
    expect(screen.getByTestId('silhouette-oval')).toBeChecked();

    await fireEvent.press(screen.getByRole('link', { name: 'Change gender' }));
    expect(screen.getByRole('radio', { name: 'Man' })).toBeChecked();
    expect(screen.queryByRole('link', { name: 'Change gender' })).toBeNull();
    await fireEvent.press(screen.getByRole('radio', { name: 'Woman' }));

    await screen.findByTestId('silhouette-pear');
    expect(screen.queryByTestId('silhouette-oval')).toBeNull();
    await fireEvent.press(screen.getByTestId('shape-next'));
    expect(screen.getByText(messages.avatarMissing)).toBeOnTheScreen();
  });

  it('keeps a shape that is still on offer when the new gender is an open one', async () => {
    asked('male');
    await renderScreen(<OnboardingShape />);
    await fireEvent.press(await screen.findByTestId('silhouette-oval'));

    await fireEvent.press(screen.getByRole('link', { name: 'Change gender' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Non-binary' }));

    expect(screen.getByTestId('shape-all')).toBeOnTheScreen();
    expect(await screen.findByTestId('silhouette-pear')).toBeOnTheScreen();
    expect(screen.getByTestId('silhouette-oval')).toBeChecked();
  });

  it('saves the gender and the shape on the account with the step, then goes to the fit', async () => {
    asked('male');
    await renderScreen(<OnboardingShape />);
    await fireEvent.press(await screen.findByTestId('silhouette-oval'));

    await fireEvent.press(screen.getByTestId('shape-next'));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/onboarding/fit'));
    expect(profile.updateProfile).toHaveBeenCalledWith({ gender: 'male', avatarId: 'm2', onboardingStep: 1 });
  });

  it('saves a gender changed here', async () => {
    asked('male');
    await renderScreen(<OnboardingShape />);
    await fireEvent.press(screen.getByRole('link', { name: 'Change gender' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Woman' }));
    await fireEvent.press(await screen.findByTestId('silhouette-pear'));

    await fireEvent.press(screen.getByTestId('shape-next'));

    await waitFor(() => expect(profile.updateProfile).toHaveBeenCalledWith({ gender: 'female', avatarId: 'f1', onboardingStep: 1 }));
  });

  it('shows the person’s own answer when they come back to it', async () => {
    useSession.setState({ user: fresh({ onboardingStep: 1, gender: 'female', avatar: women[1] }) });
    await renderScreen(<OnboardingShape />);

    expect(await screen.findByTestId('silhouette-pear')).toBeChecked();
  });

  it('stays here and says so when the server refuses', async () => {
    asked('male');
    profile.updateProfile.mockRejectedValue(new ApiError({ status: 400, code: 'avatar_invalid' }));
    await renderScreen(<OnboardingShape />);
    await fireEvent.press(await screen.findByTestId('silhouette-oval'));

    await fireEvent.press(screen.getByTestId('shape-next'));

    expect(await screen.findByText('That body shape isn’t available anymore. Pick another one.')).toBeOnTheScreen();
    expect(router.push).not.toHaveBeenCalled();
  });
});

describe('second: your fit, with the usual answers suggested', () => {
  beforeEach(() => useSession.setState({ user: fresh({ onboardingStep: 1 }) }));

  it('starts on medium and average legs, says they are suggestions, and saves them when the person agrees', async () => {
    const view = await renderScreen(<OnboardingFit />);

    expect(view.getByRole('header', { name: 'Your fit' })).toBeOnTheScreen();
    expectAccent('sway', 'fit');
    expect(view.getByRole('progressbar', { name: 'Almost done — 2 left' })).toBeOnTheScreen();
    expect(view.getByRole('radio', { name: 'Medium', checked: true })).toBeOnTheScreen();
    expect(view.getByRole('radio', { name: 'Average legs', checked: true })).toBeOnTheScreen();
    expect(view.getByTestId('size-letter')).toHaveTextContent('M');
    expect(view.getByTestId('size-suggested')).toHaveTextContent('Suggested');
    expect(view.getByTestId('legs-suggested')).toHaveTextContent('Suggested');
    for (const label of ['Extra small', 'Small', 'Medium', 'Large', 'Extra large', 'Double extra large', 'Shorter legs', 'Average legs', 'Longer legs']) {
      expect(view.getByRole('radio', { name: label })).toBeOnTheScreen();
    }
    expect(view.getByTestId('size').props.accessibilityRole).toBe('radiogroup');
    expect(view.getByTestId('legs').props.accessibilityRole).toBe('radiogroup');
    expect(view.getByText(legDetails.average.hint)).toBeOnTheScreen();
    expect(view.queryByText(/ideal|normal|big|fat|thin|slim/i)).toBeNull();

    await fireEvent.press(view.getByTestId('fit-next'));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/onboarding/colors'));
    expect(profile.updateProfile).toHaveBeenCalledWith({ clothingSize: 'm', legLength: 'average', onboardingStep: 2 });
  });

  it('drops the word "Suggested" once the person answers, and lets either answer be taken back', async () => {
    const view = await renderScreen(<OnboardingFit />);

    await fireEvent.press(view.getByRole('radio', { name: 'Extra large' }));
    expect(view.queryByTestId('size-suggested')).toBeNull();
    expect(view.getByTestId('legs-suggested')).toBeOnTheScreen();
    expect(view.getByTestId('size-letter')).toHaveTextContent('XL');
    await fireEvent.press(view.getByRole('radio', { name: 'Longer legs' }));
    await fireEvent.press(view.getByTestId('legs-none'));
    expect(view.queryByRole('radio', { name: /legs$/, checked: true })).toBeNull();

    await fireEvent.press(view.getByTestId('fit-next'));

    await waitFor(() => expect(profile.updateProfile).toHaveBeenCalledWith({ clothingSize: 'xl', clearLegLength: true, onboardingStep: 2 }));
  });

  it('lets the person say they would rather not, which saves neither and goes on', async () => {
    const view = await renderScreen(<OnboardingFit />);

    await fireEvent.press(view.getByRole('button', { name: 'I’d rather not say' }));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/onboarding/colors'));
    expect(profile.updateProfile).toHaveBeenCalledWith({ clearClothingSize: true, clearLegLength: true, onboardingStep: 2 });
  });

  it('shows the person’s own answers, "not set" among them, when they come back to it', async () => {
    useSession.setState({ user: fresh({ onboardingStep: 2, clothingSize: 'l', legLength: null }) });
    const view = await renderScreen(<OnboardingFit />);

    expect(view.getByRole('radio', { name: 'Large', checked: true })).toBeOnTheScreen();
    expect(view.queryByRole('radio', { name: /legs$/, checked: true })).toBeNull();
    expect(view.queryByTestId('size-suggested')).toBeNull();
    expect(view.queryByTestId('legs-suggested')).toBeNull();
  });

  it('goes back to the body shape', async () => {
    await renderScreen(<OnboardingFit />);

    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));

    expect(router.dismissTo).toHaveBeenLastCalledWith('/onboarding/shape');
  });
});

describe('pieces picked before sign-up that could not be added', () => {
  it('are said plainly on the next screens, with another try that clears the notice', async () => {
    usePendingPieces.getState().set(['white_tshirt', 'blue_jeans']);
    await renderScreen(<OnboardingShape />);

    expect(screen.getByTestId('pending-pieces')).toHaveTextContent(/Your account is ready, but we couldn’t add your pieces\./);
    await fireEvent.press(screen.getByRole('button', { name: 'Add them again' }));

    await waitFor(() => expect(screen.queryByTestId('pending-pieces')).toBeNull());
    expect(shop.addStarterPieces).toHaveBeenCalledWith(['white_tshirt', 'blue_jeans']);
  });

  it('say nothing when everything was added', async () => {
    await renderScreen(<OnboardingShape />);

    expect(screen.queryByTestId('pending-pieces')).toBeNull();
  });
});

describe('A: your colors', () => {
  it('leads with an example of the result, says one thing about the photo, and offers a selfie, a few questions, or skipping', async () => {
    await renderScreen(<OnboardingColors />);

    expect(screen.getByRole('header', { name: 'Find your colors' })).toBeOnTheScreen();
    expectAccent('letters', 'colors');
    expect(screen.getByRole('progressbar', { name: 'Almost done — 1 left' })).toBeOnTheScreen();
    expect(screen.getByRole('image', { name: /^An example: a palette of eight colors, and the same sweater/ })).toBeOnTheScreen();
    expect(screen.getByText('An example palette')).toBeOnTheScreen();
    expect(screen.getByText('A selfie in daylight is all it takes, and the photo is deleted right after.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Take a selfie' }));
    expect(router.push).toHaveBeenLastCalledWith({ pathname: '/onboarding/selfie', params: {} });
    await fireEvent.press(screen.getByRole('button', { name: 'Answer a few questions instead' }));
    expect(router.push).toHaveBeenLastCalledWith({ pathname: '/onboarding/quiz', params: {} });
  });

  it('remembers on the account that the step was skipped, then goes to the next one', async () => {
    await renderScreen(<OnboardingColors />);

    await fireEvent.press(screen.getByTestId('colors-skip'));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/onboarding/done'));
    expect(profile.updateProfile).toHaveBeenCalledWith({ onboardingStep: 3 });
    expect(useSession.getState().user?.onboardingStep).toBe(3);
  });

  it('goes back to the fit', async () => {
    await renderScreen(<OnboardingColors />);

    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));

    expect(router.dismissTo).toHaveBeenLastCalledWith('/onboarding/fit');
  });

  it('opened to redo from Profile, it has no steps and skipping only goes back', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ redo: '1' });
    await renderScreen(<OnboardingColors />);

    expect(screen.queryByRole('progressbar')).toBeNull();
    await fireEvent.press(screen.getByTestId('colors-skip'));

    expect(router.back).toHaveBeenCalled();
    expect(profile.updateProfile).not.toHaveBeenCalled();
  });
});

describe('A: the selfie', () => {
  it('always says what happens to the photo, right under the buttons', async () => {
    await renderScreen(<OnboardingSelfie />);

    expectNoAccent();
    expect(screen.getByTestId('selfie-notice')).toHaveTextContent(
      'Your photo is sent to our AI service for this analysis and deleted right after. We keep only your palette.',
    );
    expect(screen.getByText('Use daylight, no filter, and face the light.')).toBeOnTheScreen();
  });

  it('takes a selfie with the app’s own camera, sends it and shows the palette', async () => {
    mockOpenCamera.mockResolvedValue([selfie]);
    palette.createSelfieUpload.mockResolvedValue({ key: 'u/1/selfie/a.jpg', url: 'https://storage.test/put', method: 'PUT', headers: {}, expiresAt: '2026-10-09T09:00:00Z', maxBytes: 2_000_000 });
    palette.analyzeColors.mockResolvedValue(colorAnalysis);
    await renderScreen(<OnboardingSelfie />);

    await fireEvent.press(screen.getByTestId('selfie-camera'));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith({ pathname: '/onboarding/palette', params: {} }));
    expect(mockOpenCamera).toHaveBeenCalledWith({ mode: 'selfie' });
    expect(putFile).toHaveBeenCalledWith(expect.objectContaining({ url: 'https://storage.test/put' }), selfie.uri, expect.any(Function));
    expect(palette.analyzeColors).toHaveBeenCalledWith({ key: 'u/1/selfie/a.jpg' });
    expect(useSession.getState().user?.colorAnalysis?.name).toBe('Soft autumn');
  });

  it('also takes a photo from the library', async () => {
    camera.pickFromGallery.mockResolvedValue([selfie]);
    palette.createSelfieUpload.mockResolvedValue({ key: 'u/1/selfie/b.jpg', url: 'https://storage.test/put', method: 'PUT', headers: {}, expiresAt: '2026-10-09T09:00:00Z', maxBytes: 2_000_000 });
    palette.analyzeColors.mockResolvedValue(colorAnalysis);
    await renderScreen(<OnboardingSelfie />);

    await fireEvent.press(screen.getByTestId('selfie-library'));

    await waitFor(() => expect(palette.analyzeColors).toHaveBeenCalledWith({ key: 'u/1/selfie/b.jpg' }));
  });

  it('sends nothing when the camera is closed without a photo (refused, or simply backed out of)', async () => {
    mockOpenCamera.mockResolvedValue([]);
    await renderScreen(<OnboardingSelfie />);

    await fireEvent.press(screen.getByTestId('selfie-camera'));

    await waitFor(() => expect(mockOpenCamera).toHaveBeenCalled());
    expect(palette.createSelfieUpload).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
  });

  describe('the consent sheet for a photo of the face', () => {
    beforeEach(() => {
      finishConsent(false);
      useSession.setState({ user: fresh({ aiConsentAt: null }) });
    });

    it('comes before the camera, with its own wording, and the camera opens only after Allow', async () => {
      mockOpenCamera.mockResolvedValue([]);
      await renderScreen(<OnboardingSelfie />);

      await fireEvent.press(screen.getByTestId('selfie-camera'));

      expect(router.push).toHaveBeenCalledWith({ pathname: '/consent', params: { kind: 'selfie' } });
      expect(mockOpenCamera).not.toHaveBeenCalled();
      await act(async () => finishConsent(true));
      await waitFor(() => expect(mockOpenCamera).toHaveBeenCalledWith({ mode: 'selfie' }));
    });

    it('comes before the library too, and nothing is chosen or sent on Not now', async () => {
      camera.pickFromGallery.mockResolvedValue([selfie]);
      await renderScreen(<OnboardingSelfie />);

      await fireEvent.press(screen.getByTestId('selfie-library'));
      expect(router.push).toHaveBeenCalledWith({ pathname: '/consent', params: { kind: 'selfie' } });
      await act(async () => finishConsent(false));

      expect(camera.pickFromGallery).not.toHaveBeenCalled();
      expect(palette.createSelfieUpload).not.toHaveBeenCalled();
    });

    it('is not shown to somebody who has allowed it', async () => {
      useSession.setState({ user: fresh() });
      mockOpenCamera.mockResolvedValue([]);
      await renderScreen(<OnboardingSelfie />);

      await fireEvent.press(screen.getByTestId('selfie-camera'));

      await waitFor(() => expect(mockOpenCamera).toHaveBeenCalled());
      expect(router.push).not.toHaveBeenCalledWith({ pathname: '/consent', params: expect.anything() });
    });
  });

  it('says in its own words when the daily limit is reached, and offers the questions instead', async () => {
    camera.pickFromGallery.mockResolvedValue([selfie]);
    palette.createSelfieUpload.mockRejectedValue(new ApiError({ status: 429, code: 'limit_reached' }));
    await renderScreen(<OnboardingSelfie />);

    await fireEvent.press(screen.getByTestId('selfie-library'));

    expect(await screen.findByText('You’ve hit today’s limit. More tomorrow.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('selfie-quiz'));
    expect(router.replace).toHaveBeenCalledWith({ pathname: '/onboarding/quiz', params: {} });
  });
});

describe('A: the questions', () => {
  const answer = async (skin: string, undertone: string, hair: string, eyes: string) => {
    await fireEvent.press(screen.getByTestId(`quiz-skin-${skin}`));
    await fireEvent.press(screen.getByRole('radio', { name: undertone }));
    await fireEvent.press(screen.getByTestId(`quiz-hair-${hair}`));
    await fireEvent.press(screen.getByTestId(`quiz-eyes-${eyes}`));
  };

  it('waits for all four answers, with the reason in view, then sends them', async () => {
    palette.analyzeColors.mockResolvedValue(colorAnalysis);
    await renderScreen(<OnboardingQuiz />);
    expect(screen.getByText('A few quick questions')).toBeOnTheScreen();
    expect(screen.getByTestId('quiz-show')).toBeDisabled();
    expect(screen.getByText('Answer all four to see your colors.')).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('quiz-skin-4'));
    await fireEvent.press(screen.getByRole('radio', { name: 'Warm' }));
    await fireEvent.press(screen.getByTestId('quiz-hair-dark_brown'));
    expect(screen.getByTestId('quiz-show')).toBeDisabled();
    await fireEvent.press(screen.getByTestId('quiz-eyes-hazel'));
    expect(screen.getByTestId('quiz-skin-4')).toBeChecked();
    expect(screen.getByTestId('quiz-show')).toBeEnabled();
    await fireEvent.press(screen.getByTestId('quiz-show'));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith({ pathname: '/onboarding/palette', params: {} }));
    expect(palette.analyzeColors).toHaveBeenCalledWith({ answers: { skinTone: 4, undertone: 'warm', hair: 'dark_brown', eyes: 'hazel' } });
  });

  it('answers with round swatches that are radios in named groups, not tiles with words', async () => {
    await renderScreen(<OnboardingQuiz />);

    for (const group of ['Skin tone', 'Hair color', 'Eye color', 'Skin undertone']) {
      expect(screen.getByLabelText(group)).toHaveProp('accessibilityRole', 'radiogroup');
    }
    expect(screen.getAllByRole('radio', { name: /^(Very fair|Fair|Light|Light medium|Medium|Medium deep|Deep|Very deep)$/ })).toHaveLength(8);
    expect(screen.getByRole('radio', { name: 'Dyed or other' })).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'Near black' })).toBeOnTheScreen();
    expect(screen.queryByTestId('quiz-skin-9')).toBeNull();
    // 8 + 9 + 7 swatches and the 3 undertone choices.
    expect(screen.getAllByRole('radio')).toHaveLength(27);
    // The name shows once, under the row, and only for the chosen swatch.
    expect(screen.getByTestId('quiz-hair-caption')).toHaveTextContent('');
    expect(screen.queryByText('Auburn')).toBeNull();
  });

  it('names the chosen swatch in one line under its row, keeps a single choice per question and moves nothing', async () => {
    await renderScreen(<OnboardingQuiz />);
    const caption = screen.getByTestId('quiz-hair-caption');
    const heightBefore = JSON.stringify(caption.props.style);

    await fireEvent.press(screen.getByTestId('quiz-hair-auburn'));
    expect(caption).toHaveTextContent('Auburn');
    expect(screen.getByTestId('quiz-hair-auburn')).toBeChecked();

    await fireEvent.press(screen.getByTestId('quiz-hair-dyed'));
    expect(caption).toHaveTextContent('Dyed or other');
    expect(screen.getByTestId('quiz-hair-dyed')).toBeChecked();
    expect(screen.getByTestId('quiz-hair-auburn')).not.toBeChecked();
    expect(JSON.stringify(caption.props.style)).toBe(heightBefore);
    // The caption line is always there, with its height reserved, even before anything is chosen.
    expect(screen.getByTestId('quiz-eyes-caption')).toHaveTextContent('');
    expect(JSON.stringify(screen.getByTestId('quiz-eyes-caption').props.style)).toContain('minHeight');
  });

  it('lets the undertone be chosen on its own, three ways', async () => {
    await renderScreen(<OnboardingQuiz />);
    expect(screen.getByText(/Gold jewelry looks better on warm, silver on cool/)).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('radio', { name: 'Neutral' }));
    expect(screen.getByRole('radio', { name: 'Neutral' })).toBeChecked();
    await fireEvent.press(screen.getByRole('radio', { name: 'Cool' }));
    expect(screen.getByRole('radio', { name: 'Neutral' })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: 'Cool' })).toBeChecked();
  });

  it('sends the codes of a different set of answers just as they were chosen', async () => {
    palette.analyzeColors.mockResolvedValue(colorAnalysis);
    await renderScreen(<OnboardingQuiz />);

    await answer('8', 'Cool', 'dyed', 'near_black');
    await fireEvent.press(screen.getByTestId('quiz-show'));

    await waitFor(() => expect(palette.analyzeColors).toHaveBeenCalledWith({ answers: { skinTone: 8, undertone: 'cool', hair: 'dyed', eyes: 'near_black' } }));
  });
});

describe('A: the questions need no consent and no allowance', () => {
  it('works for an account without consent to external AI, and never asks for a ticket or a photo', async () => {
    useSession.setState({ user: fresh({ aiConsentAt: null }) });
    palette.analyzeColors.mockResolvedValue(colorAnalysis);
    await renderScreen(<OnboardingQuiz />);

    await fireEvent.press(screen.getByTestId('quiz-skin-2'));
    await fireEvent.press(screen.getByRole('radio', { name: 'Cool' }));
    await fireEvent.press(screen.getByTestId('quiz-hair-light_brown'));
    await fireEvent.press(screen.getByTestId('quiz-eyes-gray'));
    await fireEvent.press(screen.getByTestId('quiz-show'));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith({ pathname: '/onboarding/palette', params: {} }));
    expect(palette.analyzeColors).toHaveBeenCalledWith({ answers: { skinTone: 2, undertone: 'cool', hair: 'light_brown', eyes: 'gray' } });
    expect(palette.createSelfieUpload).not.toHaveBeenCalled();
    expect(mockOpenCamera).not.toHaveBeenCalled();
  });

  it('still shows the result when the day’s selfie allowance is spent', async () => {
    // The allowance is the server's business: it answers the questions with 200 however many selfies were made.
    palette.createSelfieUpload.mockRejectedValue(new ApiError({ status: 429, code: 'limit_reached' }));
    palette.analyzeColors.mockResolvedValue(colorAnalysis);
    await renderScreen(<OnboardingQuiz />);

    await fireEvent.press(screen.getByTestId('quiz-skin-6'));
    await fireEvent.press(screen.getByRole('radio', { name: 'Warm' }));
    await fireEvent.press(screen.getByTestId('quiz-hair-black'));
    await fireEvent.press(screen.getByTestId('quiz-eyes-dark_brown'));
    await fireEvent.press(screen.getByTestId('quiz-show'));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith({ pathname: '/onboarding/palette', params: {} }));
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('A: the result', () => {
  it('shows the palette and goes on to the next step, remembering it', async () => {
    useSession.setState({ user: fresh({ colorAnalysis }) });
    await renderScreen(<OnboardingPalette />);

    expect(screen.getByTestId('color-result-name')).toHaveTextContent('Soft autumn');
    await fireEvent.press(screen.getByTestId('palette-continue'));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/onboarding/done'));
    expect(profile.updateProfile).toHaveBeenCalledWith({ onboardingStep: 3 });
  });

  it('lets the person redo it', async () => {
    useSession.setState({ user: fresh({ colorAnalysis }) });
    await renderScreen(<OnboardingPalette />);

    await fireEvent.press(screen.getByTestId('palette-redo'));

    expect(router.dismissTo).toHaveBeenCalledWith({ pathname: '/onboarding/colors', params: {} });
  });

  it('after a redo from Profile it says Done and goes back to Your colors, without touching the steps', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ redo: '1' });
    useSession.setState({ user: user({ colorAnalysis }) });
    await renderScreen(<OnboardingPalette />);

    await fireEvent.press(screen.getByRole('button', { name: 'Done' }));

    expect(router.dismissTo).toHaveBeenCalledWith('/account/colors');
    expect(profile.updateProfile).not.toHaveBeenCalled();
  });

  it('sends the person back to the start when there is no palette', async () => {
    await renderScreen(<OnboardingPalette />);

    expect(mockRedirect).toHaveBeenCalledWith('/onboarding/colors');
  });
});

describe('C: you’re set', () => {
  it('opens with a look made of the person’s own pieces, then a short recap and one action into the app', async () => {
    useSession.setState({ user: fresh({ colorAnalysis, onboardingStep: 3 }) });
    shop.fetchWardrobeStats.mockResolvedValue(stats(3));
    shop.fetchClothes.mockResolvedValue([clothing('g1', 'White T-shirt', 'top'), clothing('g2', 'Blue jeans', 'bottom'), clothing('g3', 'White sneakers', 'shoes')]);
    await renderScreen(<OnboardingDone />);

    expect(screen.getByRole('header', { name: 'You’re set' })).toBeOnTheScreen();
    expectAccent('none', 'set');
    expect(screen.getByTestId('title-underline')).toBeOnTheScreen();
    expect(screen.getByRole('progressbar', { name: 'All done' })).toBeOnTheScreen();
    expect(await screen.findByRole('image', { name: 'Outfit on a board: White T-shirt, Blue jeans, White sneakers' })).toBeOnTheScreen();
    expect(screen.getByText('Looks like this one are built from your pieces and the forecast in Gliwice.')).toBeOnTheScreen();
    expect(screen.getByTestId('recap-name')).toHaveTextContent('NameOla');
    expect(screen.getByTestId('recap-colors')).toHaveTextContent('Your colorsSoft autumn');
    expect(await screen.findByText('Sunny, 7-18°C today')).toBeOnTheScreen();
    expect(screen.getByTestId('recap-clothes')).toHaveTextContent('Clothes added3');
    expect(screen.queryByText(/what happens next/i)).toBeNull();
    expect(screen.queryByText(/body shape/i)).toBeNull();
  });

  it('shows a photograph, and says what is missing, while there are too few pieces for a look', async () => {
    useSession.setState({ user: fresh({ onboardingStep: 3 }) });
    shop.fetchClothes.mockResolvedValue([clothing('g1', 'White T-shirt', 'top')]);
    await renderScreen(<OnboardingDone />);

    expect(await screen.findByTestId('recap-photo')).toBeOnTheScreen();
    expect(screen.queryByTestId('recap-look')).toBeNull();
    expect(screen.getByText('Add a few pieces and your first looks appear here.')).toBeOnTheScreen();
  });

  it.each([
    [null, '/onboarding/colors'],
    [colorAnalysis, '/onboarding/palette'],
  ] as const)('goes back to the colors, or to their result when there is one: %#', async (analysis, route) => {
    useSession.setState({ user: fresh({ onboardingStep: 3, colorAnalysis: analysis }) });
    await renderScreen(<OnboardingDone />);

    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));

    expect(router.dismissTo).toHaveBeenLastCalledWith(route);
  });

  it('leaves out the colors and the place when there are none', async () => {
    useSession.setState({ user: fresh({ onboardingStep: 3, location: null, styles: [] }) });
    await renderScreen(<OnboardingDone />);

    expect(screen.queryByTestId('recap-colors')).toBeNull();
    expect(screen.queryByTestId('recap-weather')).toBeNull();
    expect(screen.queryByTestId('recap-styles')).toBeNull();
    expect(forecast.fetchWeatherToday).not.toHaveBeenCalled();
  });

  it('marks the whole flow done on the account and opens the app', async () => {
    profile.updateProfile.mockResolvedValue(user());
    useSession.setState({ user: fresh({ onboardingStep: 3 }) });
    await renderScreen(<OnboardingDone />);

    await fireEvent.press(screen.getByRole('button', { name: 'Go to Today' }));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'));
    expect(profile.updateProfile).toHaveBeenCalledWith({ onboardingDone: true });
    expect(useSession.getState().user?.onboardingDoneAt).not.toBeNull();
  });
});

describe('resuming and showing the flow once', () => {
  it.each([
    [0, null, '/onboarding/shape'],
    [1, null, '/onboarding/fit'],
    [2, null, '/onboarding/colors'],
    [3, null, '/onboarding/done'],
    [2, colorAnalysis, '/onboarding/done'],
    [0, colorAnalysis, '/onboarding/shape'],
  ] as const)('after a restart at step %s the flow opens %s', async (step, analysis, route) => {
    useSession.setState({ user: fresh({ onboardingStep: step, colorAnalysis: analysis }) });

    await renderScreen(<OnboardingStart />);

    expect(mockRedirect).toHaveBeenCalledWith(route);
  });

  it('sends a new account to the flow from the tabs, and never an account that is marked done', async () => {
    await renderScreen(<TabsLayout />);
    expect(mockRedirect).toHaveBeenCalledWith('/onboarding');

    mockRedirect.mockClear();
    useSession.setState({ user: user() });
    await renderScreen(<TabsLayout />);
    expect(mockRedirect).not.toHaveBeenCalled();
  });
});
