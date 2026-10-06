import { Platform } from 'react-native';

/**
 * Address of the API. Set EXPO_PUBLIC_API_URL for a phone on Wi-Fi (the computer's address in the local network)
 * or for a deployed server. The default reaches an API running on the same computer as the simulator.
 */
export const apiUrl: string =
  process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '') ?? (Platform.OS === 'android' ? 'http://10.0.2.2:5080' : 'http://localhost:5080');
