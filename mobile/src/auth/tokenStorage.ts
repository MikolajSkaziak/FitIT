import * as SecureStore from 'expo-secure-store';

const key = 'fitit.refreshToken';

/** The refresh token rests in the Keychain (iOS) or Keystore (Android), never in plain storage. */
export const tokenStorage = {
  load: (): Promise<string | null> => SecureStore.getItemAsync(key),
  save: (token: string): Promise<void> => SecureStore.setItemAsync(key, token),
  clear: (): Promise<void> => SecureStore.deleteItemAsync(key),
};
