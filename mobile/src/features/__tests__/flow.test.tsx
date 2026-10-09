import { screen } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';

import * as account from '@/api/account';
import * as wardrobe from '@/api/wardrobe';
import OnboardingBasics from '@/app/(app)/onboarding/basics';
import OnboardingColors from '@/app/(app)/onboarding/colors';
import OnboardingDone from '@/app/(app)/onboarding/done';
import OnboardingPalette from '@/app/(app)/onboarding/palette';
import OnboardingQuiz from '@/app/(app)/onboarding/quiz';
import OnboardingSelfie from '@/app/(app)/onboarding/selfie';
import RegisterAbout from '@/app/(auth)/register/about';
import RegisterFit from '@/app/(auth)/register/fit';
import RegisterAccount from '@/app/(auth)/register/index';
import RegisterSilhouette from '@/app/(auth)/register/silhouette';
import RegisterStyle from '@/app/(auth)/register/style';
import RegisterWeather from '@/app/(auth)/register/weather';
import { useSession } from '@/auth/session';
import { flow } from '@/features/flow';
import { onboardingRoutes } from '@/features/onboarding/steps';
import { useRegistrationDraft } from '@/features/registration/draft';
import { colorAnalysis, user } from '@/test/fixtures';
import { renderScreen } from '@/test/screen';

jest.mock('expo-router', () => jest.requireActual('@/test/screen').routerModule);
jest.mock('@/lib/config', () => ({ apiUrl: 'http://api.test' }));
jest.mock('@/auth/tokenStorage', () => ({
  tokenStorage: { load: jest.fn(async () => null), save: jest.fn(async () => undefined), clear: jest.fn(async () => undefined) },
}));
jest.mock('@/api/account', () => ({ ...jest.requireActual('@/api/account'), fetchAvatars: jest.fn(), searchPlaces: jest.fn() }));
jest.mock('@/api/colors', () => ({ createSelfieUpload: jest.fn(), analyzeColors: jest.fn(), deleteColorAnalysis: jest.fn() }));
jest.mock('@/api/wardrobe', () => ({ ...jest.requireActual('@/api/wardrobe'), fetchWardrobeStats: jest.fn(), fetchStarterPieces: jest.fn() }));
jest.mock('@/api/weather', () => ({ ...jest.requireActual('@/api/weather'), fetchWeatherToday: jest.fn() }));
jest.mock('@/features/wardrobe/photos', () => ({ takePhoto: jest.fn(), pickFromGallery: jest.fn(), preparePhoto: jest.fn() }));

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useLocalSearchParams).mockReturnValue({});
  useRegistrationDraft.getState().reset();
  useRegistrationDraft.getState().set({ gender: 'female' });
  useSession.setState({ status: 'signedIn', user: user({ onboardingStep: 0, onboardingDoneAt: null, colorAnalysis }), accessToken: 'a', refreshToken: 'r' });
  jest.mocked(account).fetchAvatars.mockResolvedValue([]);
  jest.mocked(wardrobe).fetchWardrobeStats.mockResolvedValue({ total: 0, wornLast30Days: 0, forgotten: 0, processing: 0, needsTags: 0 });
  jest.mocked(wardrobe).fetchStarterPieces.mockResolvedValue([]);
});

/** Every screen of the one journey, in order, with the number it must show. */
const journey: [string, () => React.ReactElement, number][] = [
  ['account', () => <RegisterAccount />, 1],
  ['about you', () => <RegisterAbout />, 2],
  ['body shape', () => <RegisterSilhouette />, 3],
  ['your fit', () => <RegisterFit />, 4],
  ['styles', () => <RegisterStyle />, 5],
  ['weather, where the account is created', () => <RegisterWeather />, 6],
  ['colors', () => <OnboardingColors />, 7],
  ['colors: selfie', () => <OnboardingSelfie />, 7],
  ['colors: the questions', () => <OnboardingQuiz />, 7],
  ['colors: result', () => <OnboardingPalette />, 7],
  ['the basics', () => <OnboardingBasics />, 8],
  ['you’re set', () => <OnboardingDone />, 9],
];

describe('one journey, one count', () => {
  it('numbers the steps 1 to 9 without a gap or a second start', () => {
    expect(flow).toEqual({ account: 1, about: 2, silhouette: 3, fit: 4, styles: 5, weather: 6, colors: 7, basics: 8, done: 9, total: 9 });
    expect(6 + onboardingRoutes.length).toBe(flow.total);
    expect([...new Set(journey.map(([, , step]) => step))]).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it.each(journey)('%s shows its number of 9 in the same header, and the agreement line only where the account is created', async (_name, screenOf, step) => {
    await renderScreen(screenOf());

    expect(await screen.findByText(`Step ${step} of 9`)).toBeOnTheScreen();
    expect(screen.queryByText(/ of [1-8]$/)).toBeNull();
    expect(screen.getByRole('progressbar', { name: `Step ${step} of 9` })).toBeOnTheScreen();
    // The agreement line sits on the screen whose button creates the account, and on no other.
    expect(screen.queryByTestId('legal-note') !== null).toBe(step === flow.weather);
  });

  it('keeps the numbers out of the redo from Profile, which is not part of the journey', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ redo: '1' });
    await renderScreen(<OnboardingColors />);

    expect(screen.queryByText(/^Step \d of 9$/)).toBeNull();
  });
});
