import { fireEvent, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';

import { LegalNote } from '@/features/registration/LegalNote';
import { renderScreen } from '@/test/screen';

const keep = { terms: process.env.EXPO_PUBLIC_TERMS_URL, privacy: process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL };
afterEach(() => {
  for (const [name, value] of [['EXPO_PUBLIC_TERMS_URL', keep.terms], ['EXPO_PUBLIC_PRIVACY_POLICY_URL', keep.privacy]] as const) {
    if (value === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = value;
    }
  }
});

describe('the line under "Create account"', () => {
  it('says that creating the account is the agreement, with both documents as links', async () => {
    process.env.EXPO_PUBLIC_TERMS_URL = 'https://fitit.test/terms';
    process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL = 'https://fitit.test/privacy';
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    await renderScreen(<LegalNote />);

    expect(screen.getByTestId('legal-note')).toHaveTextContent('By creating an account you agree to our Terms and Privacy Policy.');
    await fireEvent.press(screen.getByTestId('legal-terms'));
    await fireEvent.press(screen.getByTestId('legal-privacy'));

    expect(open).toHaveBeenNthCalledWith(1, 'https://fitit.test/terms');
    expect(open).toHaveBeenNthCalledWith(2, 'https://fitit.test/privacy');
  });

  it('shows a document that is not published yet as plain text rather than a dead link', async () => {
    delete process.env.EXPO_PUBLIC_TERMS_URL;
    delete process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL;
    await renderScreen(<LegalNote />);

    expect(screen.getByTestId('legal-note')).toHaveTextContent('By creating an account you agree to our Terms and Privacy Policy.');
    expect(screen.queryByTestId('legal-terms')).toBeNull();
    expect(screen.queryByTestId('legal-privacy')).toBeNull();
  });
});
