import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';
import { Linking } from 'react-native';

import * as account from '@/api/account';
import * as colors from '@/api/colors';
import { ApiError } from '@/api/problem';
import * as wardrobe from '@/api/wardrobe';
import * as weatherApi from '@/api/weather';
import OnboardingBasics from '@/app/(app)/onboarding/basics';
import OnboardingColors from '@/app/(app)/onboarding/colors';
import OnboardingDone from '@/app/(app)/onboarding/done';
import OnboardingStart from '@/app/(app)/onboarding/index';
import OnboardingPalette from '@/app/(app)/onboarding/palette';
import OnboardingQuiz from '@/app/(app)/onboarding/quiz';
import OnboardingSelfie from '@/app/(app)/onboarding/selfie';
import TabsLayout from '@/app/(app)/(tabs)/_layout';
import { useSession } from '@/auth/session';
import * as photos from '@/features/wardrobe/photos';
import { putFile } from '@/features/wardrobe/putFile';
import { colorAnalysis, user, weather } from '@/test/fixtures';
import { renderScreen, router } from '@/test/screen';

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
jest.mock('@/api/account', () => ({ ...jest.requireActual('@/api/account'), updateProfile: jest.fn() }));
jest.mock('@/api/colors', () => ({ createSelfieUpload: jest.fn(), analyzeColors: jest.fn(), deleteColorAnalysis: jest.fn() }));
jest.mock('@/api/wardrobe', () => ({ ...jest.requireActual('@/api/wardrobe'), fetchWardrobeStats: jest.fn(), fetchStarterPieces: jest.fn(), addStarterPieces: jest.fn() }));
jest.mock('@/api/weather', () => ({ ...jest.requireActual('@/api/weather'), fetchWeatherToday: jest.fn() }));
jest.mock('@/features/wardrobe/photos', () => ({ takePhoto: jest.fn(), pickFromGallery: jest.fn(), preparePhoto: jest.fn(async (photo: { uri: string }) => photo.uri) }));
jest.mock('@/features/wardrobe/putFile', () => ({ putFile: jest.fn(async () => undefined) }));

const profile = jest.mocked(account);
const palette = jest.mocked(colors);
const shop = jest.mocked(wardrobe);
const forecast = jest.mocked(weatherApi);
const camera = jest.mocked(photos);

const fresh = (change: Partial<account.User> = {}) => user({ onboardingStep: 0, onboardingDoneAt: null, ...change });
const selfie = { uri: 'file:///selfie.jpg', width: 1200, height: 1600 };
const starter = (code: string, name: string): wardrobe.StarterPiece => ({ code, name, category: 'top', type: 't_shirt', colors: ['white'], imageUrl: `http://api.test/starter/${code}.png` });
const catalog = [starter('white_tshirt', 'White T-shirt'), starter('blue_jeans', 'Blue jeans'), starter('white_sneakers', 'White sneakers'), starter('navy_jacket', 'Navy jacket')];
const stats = (total: number) => ({ total, wornLast30Days: 0, forgotten: 0, processing: 0, needsTags: 0 });

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useLocalSearchParams).mockReturnValue({});
  useSession.setState({ status: 'signedIn', user: fresh(), accessToken: 'a', refreshToken: 'r' });
  shop.fetchWardrobeStats.mockResolvedValue(stats(0));
  shop.fetchStarterPieces.mockResolvedValue(catalog);
  shop.addStarterPieces.mockResolvedValue({ added: 0, alreadyThere: 0 });
  forecast.fetchWeatherToday.mockResolvedValue(weather);
  profile.updateProfile.mockImplementation(async (change) => fresh({ onboardingStep: change.onboardingStep ?? 0 }));
});

describe('A: your colors', () => {
  it('says what it is and offers a selfie, three questions, or skipping', async () => {
    await renderScreen(<OnboardingColors />);

    expect(screen.getByText('Find your colors')).toBeOnTheScreen();
    expect(screen.getByText('Step 7 of 9')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Take a selfie' }));
    expect(router.push).toHaveBeenLastCalledWith({ pathname: '/onboarding/selfie', params: {} });
    await fireEvent.press(screen.getByRole('button', { name: 'Answer a few questions instead' }));
    expect(router.push).toHaveBeenLastCalledWith({ pathname: '/onboarding/quiz', params: {} });
  });

  it('remembers on the account that the step was skipped, then goes to the next one', async () => {
    await renderScreen(<OnboardingColors />);

    await fireEvent.press(screen.getByTestId('colors-skip'));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/onboarding/basics'));
    expect(profile.updateProfile).toHaveBeenCalledWith({ onboardingStep: 1 });
    expect(useSession.getState().user?.onboardingStep).toBe(1);
  });

  it('opened to redo from Profile, it has no steps and skipping only goes back', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ redo: '1' });
    await renderScreen(<OnboardingColors />);

    expect(screen.queryByText('Step 7 of 9')).toBeNull();
    await fireEvent.press(screen.getByTestId('colors-skip'));

    expect(router.back).toHaveBeenCalled();
    expect(profile.updateProfile).not.toHaveBeenCalled();
  });
});

describe('A: the selfie', () => {
  it('always says what happens to the photo, right under the buttons', async () => {
    await renderScreen(<OnboardingSelfie />);

    expect(screen.getByTestId('selfie-notice')).toHaveTextContent(
      'Your photo is sent to our AI service for this analysis and deleted right after. We keep only your palette.',
    );
    expect(screen.getByText('Use daylight, no filter, and face the light.')).toBeOnTheScreen();
  });

  it('takes a selfie with the front camera, sends it and shows the palette', async () => {
    camera.takePhoto.mockResolvedValue({ kind: 'taken', photo: selfie });
    palette.createSelfieUpload.mockResolvedValue({ key: 'u/1/selfie/a.jpg', url: 'https://storage.test/put', method: 'PUT', headers: {}, expiresAt: '2026-10-09T09:00:00Z', maxBytes: 2_000_000 });
    palette.analyzeColors.mockResolvedValue(colorAnalysis);
    await renderScreen(<OnboardingSelfie />);

    await fireEvent.press(screen.getByTestId('selfie-camera'));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith({ pathname: '/onboarding/palette', params: {} }));
    expect(camera.takePhoto).toHaveBeenCalledWith({ front: true });
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

  it('points to Settings when the camera is refused, and sends nothing', async () => {
    camera.takePhoto.mockResolvedValue({ kind: 'denied' });
    const settings = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
    await renderScreen(<OnboardingSelfie />);

    await fireEvent.press(screen.getByTestId('selfie-camera'));

    expect(await screen.findByText(/can’t use your camera/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Open settings' }));
    expect(settings).toHaveBeenCalled();
    expect(palette.createSelfieUpload).not.toHaveBeenCalled();
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
    expect(camera.takePhoto).not.toHaveBeenCalled();
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

    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/onboarding/basics'));
    expect(profile.updateProfile).toHaveBeenCalledWith({ onboardingStep: 1 });
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

describe('B: start with the basics', () => {
  it('shows the common pieces as tiles, with one line about photographing real clothes later', async () => {
    await renderScreen(<OnboardingBasics />);

    expect(screen.getByText('Step 8 of 9')).toBeOnTheScreen();
    expect(screen.getByText('Start with the basics')).toBeOnTheScreen();
    expect(screen.getByText(/You can swap these for photos of your own clothes any time/)).toBeOnTheScreen();
    expect(await screen.findByTestId('starter-white_tshirt')).not.toBeChecked();
    expect(screen.getByTestId('basics-count')).toHaveTextContent('0 of 4 selected');
    expect(screen.getByTestId('basics-add')).toBeDisabled();
    expect(screen.getByText('Tick the pieces you own, or skip for now.')).toBeOnTheScreen();
  });

  it('selects and unselects single pieces, counting them and naming the button after the count', async () => {
    await renderScreen(<OnboardingBasics />);

    await fireEvent.press(await screen.findByTestId('starter-white_tshirt'));
    expect(screen.getByTestId('starter-white_tshirt')).toBeChecked();
    expect(screen.getByTestId('basics-count')).toHaveTextContent('1 of 4 selected');
    expect(screen.getByRole('button', { name: 'Add 1 piece' })).toBeEnabled();
    await fireEvent.press(screen.getByTestId('starter-blue_jeans'));
    expect(screen.getByRole('button', { name: 'Add 2 pieces' })).toBeEnabled();
    await fireEvent.press(screen.getByTestId('starter-white_tshirt'));
    expect(screen.getByTestId('basics-count')).toHaveTextContent('1 of 4 selected');
  });

  it('selects all with one control and clears them with the same one', async () => {
    await renderScreen(<OnboardingBasics />);
    await screen.findByTestId('starter-white_tshirt');

    await fireEvent.press(screen.getByText('Select all'));
    expect(screen.getByTestId('basics-count')).toHaveTextContent('4 of 4 selected');
    expect(screen.getByRole('button', { name: 'Add 4 pieces' })).toBeEnabled();
    expect(screen.queryByText('Select all')).toBeNull();

    await fireEvent.press(screen.getByText('Clear'));
    expect(screen.getByTestId('basics-count')).toHaveTextContent('0 of 4 selected');
    expect(screen.getByTestId('basics-add')).toBeDisabled();
  });

  it('adds the chosen pieces to the wardrobe, remembers the step and moves on', async () => {
    shop.addStarterPieces.mockResolvedValue({ added: 2, alreadyThere: 0 });
    await renderScreen(<OnboardingBasics />);
    await fireEvent.press(await screen.findByTestId('starter-white_tshirt'));
    await fireEvent.press(screen.getByTestId('starter-navy_jacket'));

    await fireEvent.press(screen.getByTestId('basics-add'));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/onboarding/done'));
    expect(shop.addStarterPieces).toHaveBeenCalledWith(['white_tshirt', 'navy_jacket']);
    expect(profile.updateProfile).toHaveBeenCalledWith({ onboardingStep: 2 });
  });

  it('skips without adding anything, remembering the step', async () => {
    await renderScreen(<OnboardingBasics />);
    await screen.findByTestId('starter-white_tshirt');

    await fireEvent.press(screen.getByTestId('basics-skip'));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/onboarding/done'));
    expect(shop.addStarterPieces).not.toHaveBeenCalled();
    expect(profile.updateProfile).toHaveBeenCalledWith({ onboardingStep: 2 });
  });

  it('stays here and says so when the pieces could not be added, keeping the choice', async () => {
    shop.addStarterPieces.mockRejectedValue(new ApiError({ status: 500, code: 'server_error' }));
    await renderScreen(<OnboardingBasics />);
    await fireEvent.press(await screen.findByTestId('starter-blue_jeans'));

    await fireEvent.press(screen.getByTestId('basics-add'));

    expect(await screen.findByRole('alert')).toBeOnTheScreen();
    expect(router.push).not.toHaveBeenCalled();
    expect(screen.getByTestId('starter-blue_jeans')).toBeChecked();
  });

  it('offers another try when the list does not load, and still lets the person skip', async () => {
    shop.fetchStarterPieces.mockRejectedValueOnce(new ApiError({ status: 500, code: 'server_error' }));
    await renderScreen(<OnboardingBasics />);

    expect(await screen.findByText(/couldn’t load the basics/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('basics-skip'));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/onboarding/done'));
  });

  it('goes back to the colors', async () => {
    await renderScreen(<OnboardingBasics />);

    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));

    expect(router.dismissTo).toHaveBeenLastCalledWith('/onboarding/colors');
  });

  it('goes back to the result of the colors when there is one', async () => {
    useSession.setState({ user: fresh({ colorAnalysis }) });
    await renderScreen(<OnboardingBasics />);

    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));

    expect(router.dismissTo).toHaveBeenLastCalledWith('/onboarding/palette');
  });
});

describe('C: you’re set', () => {
  it('recaps what the person gave and what happens next, with one action into the app', async () => {
    useSession.setState({ user: fresh({ colorAnalysis, onboardingStep: 2 }) });
    shop.fetchWardrobeStats.mockResolvedValue(stats(2));
    await renderScreen(<OnboardingDone />);

    expect(screen.getByText('You’re set')).toBeOnTheScreen();
    expect(screen.getByText('Step 9 of 9')).toBeOnTheScreen();
    expect(screen.getByTestId('recap-name')).toHaveTextContent('NameOla');
    expect(screen.getByTestId('recap-colors')).toHaveTextContent('Your colorsSoft autumn');
    expect(await screen.findByText('Sunny, 7-18°C today')).toBeOnTheScreen();
    expect(screen.getByTestId('recap-clothes')).toHaveTextContent('Clothes added2');
    expect(screen.getByTestId('recap-next')).toHaveTextContent('Add 5 or more pieces and we’ll style your first outfit.');
    expect(screen.queryByText(/body shape/i)).toBeNull();
  });

  it('leaves out the colors and the place when there are none', async () => {
    useSession.setState({ user: fresh({ onboardingStep: 2, location: null, styles: [] }) });
    await renderScreen(<OnboardingDone />);

    expect(screen.queryByTestId('recap-colors')).toBeNull();
    expect(screen.queryByTestId('recap-weather')).toBeNull();
    expect(screen.queryByTestId('recap-styles')).toBeNull();
    expect(forecast.fetchWeatherToday).not.toHaveBeenCalled();
  });

  it('marks the whole flow done on the account and opens the app', async () => {
    profile.updateProfile.mockResolvedValue(user());
    useSession.setState({ user: fresh({ onboardingStep: 2 }) });
    await renderScreen(<OnboardingDone />);

    await fireEvent.press(screen.getByRole('button', { name: 'Go to Today' }));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'));
    expect(profile.updateProfile).toHaveBeenCalledWith({ onboardingDone: true });
    expect(useSession.getState().user?.onboardingDoneAt).not.toBeNull();
  });
});

describe('resuming and showing the flow once', () => {
  it.each([
    [0, null, '/onboarding/colors'],
    [1, null, '/onboarding/basics'],
    [2, null, '/onboarding/done'],
    [0, colorAnalysis, '/onboarding/basics'],
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
