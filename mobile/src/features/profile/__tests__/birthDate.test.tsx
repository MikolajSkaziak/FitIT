import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import * as account from '@/api/account';
import { ApiError } from '@/api/problem';
import EditBirthDate from '@/app/(app)/account/birth-date';
import RegisterAccount from '@/app/(auth)/register/account';
import { useSession } from '@/auth/session';
import { useRegistrationDraft } from '@/features/registration/draft';
import { messages } from '@/features/registration/validation';
import { user } from '@/test/fixtures';
import { renderScreen, router } from '@/test/screen';

jest.mock('expo-router', () => jest.requireActual('@/test/screen').routerModule);
jest.mock('@/lib/config', () => ({ apiUrl: 'http://api.test' }));
jest.mock('@/auth/tokenStorage', () => ({
  tokenStorage: { load: jest.fn(async () => null), save: jest.fn(async () => undefined), clear: jest.fn(async () => undefined) },
}));
jest.mock('@/api/account', () => ({ ...jest.requireActual('@/api/account'), updateProfile: jest.fn() }));

const updateProfile = jest.mocked(account.updateProfile);

beforeEach(() => {
  jest.clearAllMocks();
  useRegistrationDraft.getState().reset();
  useSession.setState({ status: 'signedIn', user: user({ birthDate: '1999-03-14' }), accessToken: 'a', refreshToken: 'r' });
});

/** Opens the list of months and takes one, as a person would. */
const chooseMonth = async (testID: string, month: number) => {
  await fireEvent.press(screen.getByTestId(testID));
  await fireEvent.press(await screen.findByTestId(`month-${month}`));
};

describe('the birth date boxes on the profile screen', () => {
  it('show the saved date as a month name, a day and a year', async () => {
    await renderScreen(<EditBirthDate />);

    expect(screen.getByRole('button', { name: 'Month, March' })).toBeOnTheScreen();
    expect(screen.getByTestId('edit-birth-date-field-day').props.value).toBe('14');
    expect(screen.getByTestId('edit-birth-date-field-year').props.value).toBe('1999');
    expect(screen.getByText('Month')).toBeOnTheScreen();
    expect(screen.getByText('Day')).toBeOnTheScreen();
    expect(screen.getByText('Year')).toBeOnTheScreen();
  });

  it('send the date to the server as YYYY-MM-DD, whatever way it was entered', async () => {
    updateProfile.mockResolvedValue(user({ birthDate: '2004-05-06' }));
    await renderScreen(<EditBirthDate />);

    await chooseMonth('edit-birth-date-field-month', 5);
    await fireEvent.changeText(screen.getByTestId('edit-birth-date-field-day'), '6');
    await fireEvent.changeText(screen.getByTestId('edit-birth-date-field-year'), '2004');
    await fireEvent.press(screen.getByTestId('edit-save'));

    await waitFor(() => expect(updateProfile).toHaveBeenCalledWith({ birthDate: '2004-05-06' }));
    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
  });

  it('keep only digits in the day and the year', async () => {
    await renderScreen(<EditBirthDate />);

    await fireEvent.changeText(screen.getByTestId('edit-birth-date-field-day'), '1a7x9');
    await fireEvent.changeText(screen.getByTestId('edit-birth-date-field-year'), '19.9-85');

    expect(screen.getByTestId('edit-birth-date-field-day').props.value).toBe('17');
    expect(screen.getByTestId('edit-birth-date-field-year').props.value).toBe('1998');
  });

  it('say so for a day that does not exist, and ask the server nothing', async () => {
    await renderScreen(<EditBirthDate />);

    await chooseMonth('edit-birth-date-field-month', 2);
    await fireEvent.changeText(screen.getByTestId('edit-birth-date-field-day'), '31');
    await fireEvent.press(screen.getByTestId('edit-save'));

    expect(screen.getByText(messages.birthDateInvalid)).toBeOnTheScreen();
    expect(updateProfile).not.toHaveBeenCalled();
  });

  it('pass on what the server says about the age', async () => {
    updateProfile.mockRejectedValue(new ApiError({ status: 422, code: 'underage', minimumAge: 16 }));
    await renderScreen(<EditBirthDate />);

    await fireEvent.changeText(screen.getByTestId('edit-birth-date-field-year'), '2015');
    await fireEvent.press(screen.getByTestId('edit-save'));

    expect(await screen.findByText('You need to be 16 to create an account.')).toBeOnTheScreen();
  });

  it('leave the server alone when the date did not change', async () => {
    await renderScreen(<EditBirthDate />);

    await fireEvent.press(screen.getByTestId('edit-save'));

    expect(updateProfile).not.toHaveBeenCalled();
    expect(router.back).toHaveBeenCalledTimes(1);
  });
});

describe('the birth date boxes in registration', () => {
  it('ask for all three parts before moving on', async () => {
    await renderScreen(<RegisterAccount />);

    await fireEvent.changeText(screen.getByTestId('register-name'), 'Ola');
    await fireEvent.press(screen.getByTestId('register-submit'));

    expect(screen.getByText(messages.birthDateMissing)).toBeOnTheScreen();
    expect(router.push).not.toHaveBeenCalled();
  });

  it('keep the entered parts in the draft', async () => {
    await renderScreen(<RegisterAccount />);

    await chooseMonth('register-birth-date-month', 10);
    await fireEvent.changeText(screen.getByTestId('register-birth-date-day'), '6');
    await fireEvent.changeText(screen.getByTestId('register-birth-date-year'), '2004');

    expect(useRegistrationDraft.getState().birthDate).toEqual({ month: 10, day: '6', year: '2004' });
    expect(screen.getByRole('button', { name: 'Month, October' })).toBeOnTheScreen();
  });
});
