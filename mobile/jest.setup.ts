// Runs once before every test file.
import '@testing-library/react-native/matchers';

// Native pieces that have no place in a unit test.
jest.mock('react-native-safe-area-context', () => jest.requireActual('react-native-safe-area-context/jest/mock').default);

// Reanimated runs on the UI thread. Its official mock makes every timing land on its target at once, with no timers, so
// nothing is left running after a test. The mock has no `useReducedMotion`; tests switch it with `jest.mocked(...)`.
jest.mock('react-native-reanimated', () => {
  const mock = jest.requireActual('react-native-reanimated/mock');
  return { ...mock, useReducedMotion: jest.fn(() => false), withTiming: jest.fn(mock.withTiming) };
});
