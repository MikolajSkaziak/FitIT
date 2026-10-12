import { screen } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';

import * as account from '@/api/account';
import * as wardrobe from '@/api/wardrobe';
import OnboardingColors from '@/app/(app)/onboarding/colors';
import OnboardingDone from '@/app/(app)/onboarding/done';
import OnboardingFit from '@/app/(app)/onboarding/fit';
import OnboardingPalette from '@/app/(app)/onboarding/palette';
import OnboardingQuiz from '@/app/(app)/onboarding/quiz';
import OnboardingSelfie from '@/app/(app)/onboarding/selfie';
import OnboardingShape from '@/app/(app)/onboarding/shape';
import RegisterAccount from '@/app/(auth)/register/account';
import RegisterBasics from '@/app/(auth)/register/basics';
import RegisterGender from '@/app/(auth)/register/index';
import RegisterLook from '@/app/(auth)/register/look';
import RegisterPlace from '@/app/(auth)/register/place';
import RegisterStyles from '@/app/(auth)/register/style';
import { useSession } from '@/auth/session';
import { flow, registrationRoutes, type FlowStep } from '@/features/flow';
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
jest.mock('@/api/wardrobe', () => ({
  ...jest.requireActual('@/api/wardrobe'),
  fetchWardrobeStats: jest.fn(),
  fetchStarterPieces: jest.fn(),
  fetchClothes: jest.fn(),
  fetchDictionaries: jest.fn(),
}));
jest.mock('@/api/weather', () => ({ ...jest.requireActual('@/api/weather'), fetchWeatherToday: jest.fn() }));
jest.mock('@/features/wardrobe/photos', () => ({ pickFromGallery: jest.fn(), preparePhoto: jest.fn() }));

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useLocalSearchParams).mockReturnValue({});
  useRegistrationDraft.getState().reset();
  useSession.setState({ status: 'signedIn', user: user({ onboardingStep: 0, onboardingDoneAt: null, colorAnalysis }), accessToken: 'a', refreshToken: 'r' });
  jest.mocked(account).fetchAvatars.mockResolvedValue([]);
  jest.mocked(wardrobe).fetchWardrobeStats.mockResolvedValue({ total: 0, wornLast30Days: 0, forgotten: 0, processing: 0, needsTags: 0 });
  jest.mocked(wardrobe).fetchStarterPieces.mockResolvedValue([]);
  jest.mocked(wardrobe).fetchClothes.mockResolvedValue([]);
  jest.mocked(wardrobe).fetchDictionaries.mockRejectedValue(new Error('not needed here'));
});

/** Every screen of the journey, in order, with the step whose promise it must show. */
const journey: [string, () => React.ReactElement, FlowStep][] = [
  ['who we are dressing', () => <RegisterGender />, 'gender'],
  ['styles', () => <RegisterStyles />, 'styles'],
  ['the pieces you own', () => <RegisterBasics />, 'basics'],
  ['where you are', () => <RegisterPlace />, 'place'],
  ['your first look', () => <RegisterLook />, 'look'],
  ['create account', () => <RegisterAccount />, 'account'],
  ['body shape', () => <OnboardingShape />, 'shape'],
  ['your fit', () => <OnboardingFit />, 'fit'],
  ['colors', () => <OnboardingColors />, 'colors'],
  ['colors: selfie', () => <OnboardingSelfie />, 'colors'],
  ['colors: the questions', () => <OnboardingQuiz />, 'colors'],
  ['colors: result', () => <OnboardingPalette />, 'colors'],
  ['you’re set', () => <OnboardingDone />, 'done'],
];

describe('one journey: something given before anything is asked', () => {
  it('runs gender, styles, pieces, place and the first look before the account, and the body shape, fit, colors and recap after it', () => {
    expect(Object.keys(flow)).toEqual(['gender', 'styles', 'basics', 'place', 'look', 'account', 'shape', 'fit', 'colors', 'done']);
    expect(registrationRoutes).toEqual(['/register', '/register/style', '/register/basics', '/register/place', '/register/look', '/register/account']);
    expect(onboardingRoutes).toEqual(['/onboarding/shape', '/onboarding/fit', '/onboarding/colors', '/onboarding/done']);
    expect([...new Set(journey.map(([, , step]) => step))]).toEqual(Object.keys(flow));
  });

  it('counts down to the next thing the person gets instead of counting steps, and never starts with an empty line', () => {
    expect(Object.values(flow).map((step) => step.label)).toEqual([
      'Four steps to your first look',
      'Three more steps to your first look',
      'Two more steps to your first look',
      'One more step to your first look',
      'Your wardrobe so far',
      'One step to save your picks',
      'Almost done — 3 left',
      'Almost done — 2 left',
      'Almost done — 1 left',
      'All done',
    ]);
    for (const step of Object.values(flow)) {
      expect(step.label).not.toMatch(/step \d+ of|\bof \d/i);
      expect(step.progress).toBeGreaterThan(0);
      expect(step.progress).toBeLessThanOrEqual(1);
    }
    // The line is full exactly where a promise is kept: the first look, and the end.
    expect((Object.keys(flow) as FlowStep[]).filter((step) => flow[step].progress === 1)).toEqual(['look', 'done']);
    // Towards each of the two it only ever grows.
    const fills = (steps: FlowStep[]) => steps.map((step) => flow[step].progress);
    expect(fills(['gender', 'styles', 'basics', 'place', 'look'])).toEqual([0.2, 0.4, 0.6, 0.8, 1]);
    expect(fills(['shape', 'fit', 'colors', 'done'])).toEqual([0.25, 0.5, 0.75, 1]);
  });

  it.each(journey)('%s shows its promise in the same header, and the agreement line only where the account is created', async (_name, screenOf, step) => {
    await renderScreen(screenOf());

    expect(await screen.findByText(flow[step].label)).toBeOnTheScreen();
    expect(screen.getByRole('progressbar', { name: flow[step].label })).toHaveProp('accessibilityValue', { min: 0, max: 100, now: flow[step].progress * 100 });
    expect(screen.queryByText(/^Step \d+ of \d+$/)).toBeNull();
    // The agreement line sits on the screen whose button creates the account, and on no other.
    expect(screen.queryByTestId('legal-note') !== null).toBe(step === 'account');
  });

  it('keeps the count out of the redo from Profile, which is not part of the journey', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ redo: '1' });
    await renderScreen(<OnboardingColors />);

    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(screen.queryByText(flow.colors.label)).toBeNull();
  });
});
