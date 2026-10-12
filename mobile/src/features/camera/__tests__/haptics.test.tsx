import { fireEvent, screen } from '@testing-library/react-native';
import * as expoCamera from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams } from 'expo-router';
import { useReducedMotion, withTiming } from 'react-native-reanimated';

import Camera from '@/app/(app)/camera';
import { finishCamera } from '@/features/camera/session';
import { renderScreen } from '@/test/screen';
import { feel, motion } from '@/theme';

jest.mock('expo-router', () => jest.requireActual('@/test/screen').routerModule);
jest.mock('@/features/wardrobe/photos', () => ({ batch: 20, pickFromGallery: jest.fn() }));

const native = jest.mocked(expoCamera as unknown as { takePictureAsync: jest.Mock; getAvailableLensesAsync: jest.Mock });
const impact = jest.mocked(Haptics.impactAsync);
const notification = jest.mocked(Haptics.notificationAsync);
const select = jest.mocked(Haptics.selectionAsync);

async function ready(params: Record<string, string>) {
  jest.mocked(useLocalSearchParams).mockReturnValue(params);
  await renderScreen(<Camera />);
  await fireEvent(screen.getByTestId('camera-view'), 'cameraReady');
  await screen.findByRole('button', { name: 'Take photo', disabled: false });
  jest.clearAllMocks();
}

const shutter = () => fireEvent.press(screen.getByTestId('camera-shutter'));

beforeEach(() => {
  jest.clearAllMocks();
  finishCamera([]);
  native.getAvailableLensesAsync.mockResolvedValue(['Back Camera']);
  native.takePictureAsync.mockResolvedValue({ uri: 'file:///shot.jpg', width: 3000, height: 4000, format: 'jpg' });
  jest.mocked(useReducedMotion).mockReturnValue(false);
});

describe('the camera', () => {
  it('clicks the shutter for every photo that was taken', async () => {
    await ready({ mode: 'clothes', limit: '5' });

    await shutter();
    await screen.findByLabelText('1 photo taken');
    await shutter();
    await screen.findByLabelText('2 photos taken');

    expect(impact.mock.calls).toEqual([['medium'], ['medium']]);
    expect(notification).not.toHaveBeenCalled();
  });

  it('clicks the shutter for a selfie too', async () => {
    await ready({ mode: 'selfie' });

    await shutter();
    await screen.findByTestId('camera-still');

    expect(impact.mock.calls).toEqual([['medium']]);
  });

  it('warns once, in place of the click, with the shot that reaches the limit of the day', async () => {
    await ready({ mode: 'clothes', limit: '2', daily: '1' });

    await shutter();
    await screen.findByLabelText('1 photo taken');
    await shutter();
    await screen.findByText('That’s the limit for today');

    expect(impact.mock.calls).toEqual([['medium']]);
    expect(notification.mock.calls).toEqual([['warning']]);

    // The shutter is off now: pressing it again says nothing more.
    await shutter();
    expect(notification).toHaveBeenCalledTimes(1);
  });

  it('warns for the photo cap of a garment, too', async () => {
    await ready({ mode: 'photo', limit: '1' });

    await shutter();
    await screen.findByText('That’s all this piece can hold');

    expect(notification.mock.calls).toEqual([['warning']]);
    expect(impact).not.toHaveBeenCalled();
  });

  it('gives the error cue, and no click, when a shot did not save', async () => {
    await ready({ mode: 'clothes', limit: '5' });
    native.takePictureAsync.mockRejectedValueOnce(new Error('no'));

    await shutter();
    await screen.findByText('That photo didn’t save. Try again.');

    expect(notification.mock.calls).toEqual([['error']]);
    expect(impact).not.toHaveBeenCalled();
  });

  it('gives a selection for each turn of the flash, and a light tap for closing the camera', async () => {
    await ready({ mode: 'clothes', limit: '5' });

    await fireEvent.press(screen.getByRole('button', { name: 'Flash off' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Flash on' }));
    expect(select).toHaveBeenCalledTimes(2);

    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    expect(select).toHaveBeenCalledTimes(2);
    expect(impact.mock.calls).toEqual([['light']]);
  });
});

describe('the thumbnail of the last shot', () => {
  const settlesIn = () => jest.mocked(withTiming).mock.calls.filter(([to, config]) => to === 1 && (config as { duration: number }).duration === motion.exit);

  it('settles in anew each time the count goes up, over the exit duration', async () => {
    await ready({ mode: 'clothes', limit: '5' });
    jest.mocked(withTiming).mockClear();

    await shutter();
    await screen.findByLabelText('1 photo taken');
    const first = screen.getByTestId('camera-thumb');
    expect(settlesIn()).toHaveLength(1);
    expect(first).toHaveStyle({ transform: [{ translateY: 0 }, { scale: feel.popScale }] });

    await shutter();
    await screen.findByLabelText('2 photos taken');
    expect(settlesIn()).toHaveLength(2);
    // A new element for a new count, not the same one made to run again.
    expect(screen.getByTestId('camera-thumb')).not.toBe(first);
  });

  it('only fades under reduced motion', async () => {
    jest.mocked(useReducedMotion).mockReturnValue(true);
    await ready({ mode: 'clothes', limit: '5' });

    await shutter();
    await screen.findByLabelText('1 photo taken');

    // As far as the fade has got in a test: still to come in, and never scaled.
    expect(screen.getByTestId('camera-thumb')).toHaveStyle({ opacity: 0, transform: [{ translateY: 0 }] });
    expect(screen.getByTestId('camera-thumb')).not.toHaveStyle({ transform: [{ translateY: 0 }, { scale: 0.9 }] });
  });
});
