// Runs once before every test file.
import '@testing-library/react-native/matchers';
// The gesture handler's own stand-ins for its native module.
import 'react-native-gesture-handler/jestSetup';

// Native pieces that have no place in a unit test.
jest.mock('react-native-safe-area-context', () => jest.requireActual('react-native-safe-area-context/jest/mock').default);

// Reanimated runs on the UI thread. Its official mock makes every timing land on its target at once, with no timers, so
// nothing is left running after a test. The mock has no `useReducedMotion`; tests switch it with `jest.mocked(...)`.
jest.mock('react-native-reanimated', () => {
  const mock = jest.requireActual('react-native-reanimated/mock');
  return { ...mock, useReducedMotion: jest.fn(() => false), withTiming: jest.fn(mock.withTiming), withDelay: jest.fn(mock.withDelay) };
});

// The haptic motor: every cue is a mock a test can look at (`src/lib/haptics.ts` is the only code that calls it).
jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(async () => undefined),
  impactAsync: jest.fn(async () => undefined),
  notificationAsync: jest.fn(async () => undefined),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy', Soft: 'soft', Rigid: 'rigid' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

// The camera is a native view. Its stand-in is a plain view that says it is ready when a test fires `onCameraReady` on
// `camera-view`; the permission and what the shutter and the lens list answer are mocks a test can set.
jest.mock('expo-camera', () => {
  const { createElement, useImperativeHandle } = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  const granted = { status: 'granted', granted: true, canAskAgain: true, expires: 'never' };
  const takePictureAsync = jest.fn(async () => ({ uri: 'file:///shot.jpg', width: 3000, height: 4000, format: 'jpg' }));
  const getAvailableLensesAsync = jest.fn(async () => ['Back Camera']);
  const CameraView = ({ ref, ...props }: { ref?: import('react').Ref<unknown> }) => {
    useImperativeHandle(ref, () => ({ takePictureAsync, getAvailableLensesAsync }));
    return createElement(View, { testID: 'camera-view', ...props });
  };
  return {
    CameraView,
    takePictureAsync,
    getAvailableLensesAsync,
    useCameraPermissions: jest.fn(() => [granted, jest.fn(async () => granted), jest.fn(async () => granted)]),
  };
});
