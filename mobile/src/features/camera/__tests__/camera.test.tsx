import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as expoCamera from 'expo-camera';
import { useLocalSearchParams } from 'expo-router';
import { AccessibilityInfo, Linking } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import Camera from '@/app/(app)/camera';
import { finishCamera, useCamera } from '@/features/camera/session';
import * as photos from '@/features/wardrobe/photos';
import { renderScreen, router } from '@/test/screen';

jest.mock('expo-router', () => jest.requireActual('@/test/screen').routerModule);
jest.mock('@/features/wardrobe/photos', () => ({ batch: 20, pickFromGallery: jest.fn() }));

const native = jest.mocked(expoCamera as unknown as { takePictureAsync: jest.Mock; getAvailableLensesAsync: jest.Mock; useCameraPermissions: jest.Mock });
const request = jest.fn();
const permission = (status: 'granted' | 'undetermined' | 'denied', canAskAgain = status !== 'denied') => {
  native.useCameraPermissions.mockReturnValue([{ status, granted: status === 'granted', canAskAgain, expires: 'never' }, request, jest.fn()]);
};
const open = (params: Record<string, string>) => jest.mocked(useLocalSearchParams).mockReturnValue(params);
const shot = (name: string) => ({ uri: `file:///${name}.jpg`, width: 3000, height: 4000, format: 'jpg' });
const photo = (name: string) => ({ uri: `file:///${name}.jpg`, width: 3000, height: 4000 });

/** Opens the camera the way a screen does and keeps what it hands back. */
function opener() {
  const result = jest.fn();
  function Opener() {
    const openCamera = useCamera();
    void openCamera({ mode: 'clothes', limit: 3 }).then(result);
    return null;
  }
  return { Opener, result };
}

/** The viewfinder, with the camera reporting ready. */
async function ready(params: Record<string, string>) {
  open(params);
  await renderScreen(<Camera />);
  await fireEvent(screen.getByTestId('camera-view'), 'cameraReady');
  await waitFor(() => expect(screen.getByTestId('camera-shutter')).toBeEnabled());
}

beforeEach(() => {
  jest.clearAllMocks();
  finishCamera([]);
  permission('granted');
  native.getAvailableLensesAsync.mockResolvedValue(['Back Camera']);
  native.takePictureAsync.mockResolvedValue(shot('shot'));
  jest.mocked(useReducedMotion).mockReturnValue(false);
});

describe('asking for the camera', () => {
  it('explains first, and asks the system only on Continue', async () => {
    permission('undetermined');
    open({ mode: 'clothes' });
    await renderScreen(<Camera />);

    expect(screen.getByRole('header', { name: 'Let fitit. use your camera' })).toBeOnTheScreen();
    expect(screen.getByText('fitit. uses the camera only while this screen is open, to photograph your clothes.')).toBeOnTheScreen();
    expect(screen.queryByTestId('camera-view')).toBeNull();
    expect(request).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('has exactly one button and no way out before the system alert (Apple’s guideline)', async () => {
    permission('undetermined');
    open({ mode: 'clothes' });
    await renderScreen(<Camera />);

    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Continue' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Not now' })).toBeNull();
    expect(screen.queryByTestId('camera-close')).toBeNull();
    expect(screen.queryByTestId('camera-not-now')).toBeNull();
  });

  it('says what the camera is for by what the screen was opened for', async () => {
    permission('undetermined');
    open({ mode: 'selfie' });
    await renderScreen(<Camera />);

    expect(screen.getByText('fitit. uses the camera only while this screen is open, to take your selfie for your color analysis.')).toBeOnTheScreen();
  });

  it('gives the way out back once the camera is refused, and hands back nothing', async () => {
    permission('denied');
    open({ mode: 'clothes' });
    const { Opener, result } = opener();
    await renderScreen(<Opener />);
    await renderScreen(<Camera />);

    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));

    expect(router.back).toHaveBeenCalled();
    await waitFor(() => expect(result).toHaveBeenCalledWith([]));
  });

  it('points to Settings once refused, and offers the library for clothes', async () => {
    permission('denied');
    open({ mode: 'clothes', limit: '3' });
    const settings = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
    const { Opener, result } = opener();
    await renderScreen(<Opener />);
    await renderScreen(<Camera />);

    expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Open Settings' }));
    expect(settings).toHaveBeenCalled();

    jest.mocked(photos.pickFromGallery).mockResolvedValue([photo('picked')]);
    await fireEvent.press(screen.getByRole('button', { name: 'Choose from library instead' }));

    await waitFor(() => expect(result).toHaveBeenCalledWith([photo('picked')]));
    expect(photos.pickFromGallery).toHaveBeenCalledWith(3);
    expect(router.back).toHaveBeenCalled();
  });

  it('does not offer the library for a refused selfie: the screen behind has it', async () => {
    permission('denied');
    open({ mode: 'selfie' });
    await renderScreen(<Camera />);

    expect(screen.getByRole('button', { name: 'Open Settings' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Choose from library instead' })).toBeNull();
  });

  it('goes straight to the viewfinder when the camera is allowed', async () => {
    open({ mode: 'clothes' });
    await renderScreen(<Camera />);

    expect(screen.getByTestId('camera-view')).toHaveProp('facing', 'back');
    expect(screen.getByText('Lay the piece flat, fill the frame')).toBeOnTheScreen();
    await fireEvent(screen.getByTestId('camera-guide', { includeHiddenElements: true }), 'layout', { nativeEvent: { layout: { width: 390, height: 500 } } });
    expect(screen.getByTestId('camera-brackets', { includeHiddenElements: true })).toHaveStyle({ width: 342, height: 456 });
    expect(screen.queryByText('Let fitit. use your camera')).toBeNull();
  });
});

describe('photographing clothes', () => {
  it('keeps the shutter off until the camera is ready', async () => {
    open({ mode: 'clothes' });
    await renderScreen(<Camera />);

    expect(screen.getByRole('button', { name: 'Take photo' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Done' })).toBeDisabled();
  });

  it('takes shot after shot, counts them, says so, and hands them back on Done', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined);
    const { Opener, result } = opener();
    await renderScreen(<Opener />);
    await ready({ mode: 'clothes', limit: '5' });

    for (const name of ['a', 'b', 'c']) {
      native.takePictureAsync.mockResolvedValueOnce(shot(name));
      await fireEvent.press(screen.getByTestId('camera-shutter'));
    }

    expect(await screen.findByLabelText('3 photos taken')).toHaveTextContent('3');
    expect(announce).toHaveBeenLastCalledWith('Photo 3 taken');
    expect(native.takePictureAsync).toHaveBeenCalledWith({ quality: 1, exif: false });
    expect(result).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('button', { name: 'Done' }));

    await waitFor(() => expect(result).toHaveBeenCalledWith([photo('a'), photo('b'), photo('c')]));
    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it('still counts under reduced motion', async () => {
    jest.mocked(useReducedMotion).mockReturnValue(true);
    await ready({ mode: 'clothes', limit: '5' });

    await fireEvent.press(screen.getByTestId('camera-shutter'));

    expect(await screen.findByLabelText('1 photo taken')).toBeOnTheScreen();
  });

  it('stops at what the day still allows and says why', async () => {
    await ready({ mode: 'clothes', limit: '2', daily: '1' });

    await fireEvent.press(screen.getByTestId('camera-shutter'));
    await fireEvent.press(screen.getByTestId('camera-shutter'));

    expect(await screen.findByText('That’s the limit for today')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Take photo' })).toBeDisabled();
    await fireEvent.press(screen.getByTestId('camera-shutter'));
    expect(native.takePictureAsync).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('button', { name: 'Done' })).toBeEnabled();
  });

  it('never takes more than one batch, and does not blame the day for it', async () => {
    await ready({ mode: 'clothes', limit: '1' });

    await fireEvent.press(screen.getByTestId('camera-shutter'));

    expect(await screen.findByText('That’s the most in one go')).toBeOnTheScreen();
  });

  it('cycles the flash and names its state', async () => {
    await ready({ mode: 'clothes' });

    await fireEvent.press(screen.getByRole('button', { name: 'Flash off' }));
    expect(screen.getByTestId('camera-view')).toHaveProp('flash', 'on');
    await fireEvent.press(screen.getByRole('button', { name: 'Flash on' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Flash auto' }));
    expect(screen.getByRole('button', { name: 'Flash off' })).toBeOnTheScreen();
  });

  it('says so when a shot did not save, and keeps going', async () => {
    await ready({ mode: 'clothes', limit: '5' });
    native.takePictureAsync.mockRejectedValueOnce(new Error('no'));

    await fireEvent.press(screen.getByTestId('camera-shutter'));
    expect(await screen.findByText('That photo didn’t save. Try again.')).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('camera-shutter'));
    expect(await screen.findByLabelText('1 photo taken')).toBeOnTheScreen();
    expect(screen.getByText('Lay the piece flat, fill the frame')).toBeOnTheScreen();
  });

  it('hands back nothing when closed', async () => {
    const { Opener, result } = opener();
    await renderScreen(<Opener />);
    await ready({ mode: 'clothes', limit: '5' });
    await fireEvent.press(screen.getByTestId('camera-shutter'));

    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));

    await waitFor(() => expect(result).toHaveBeenCalledWith([]));
  });
});

describe('one more photo of a garment', () => {
  it('uses the back camera without the flat-lay guide, and says what the photo can be', async () => {
    await ready({ mode: 'photo', limit: '2' });

    expect(screen.getByTestId('camera-view').props.facing).toBe('back');
    expect(screen.queryByTestId('camera-guide')).toBeNull();
    expect(screen.getByTestId('camera-caption')).toHaveTextContent('The back, a detail, or how it fits you');
    expect(screen.queryByText('Lay the piece flat, fill the frame')).toBeNull();
    expect(screen.getByTestId('camera-flash')).toBeOnTheScreen();
  });

  it('stops at what the garment has room for and says so', async () => {
    const { Opener, result } = opener();
    await renderScreen(<Opener />);
    await ready({ mode: 'photo', limit: '1' });

    await fireEvent.press(screen.getByTestId('camera-shutter'));

    await waitFor(() => expect(screen.getByTestId('camera-caption')).toHaveTextContent('That’s all this piece can hold'));
    expect(screen.getByTestId('camera-shutter')).toBeDisabled();
    await fireEvent.press(screen.getByTestId('camera-done'));
    await waitFor(() => expect(result).toHaveBeenCalledWith([photo('shot')]));
  });

  it('offers the library when the camera was refused', async () => {
    permission('denied');
    open({ mode: 'photo', limit: '2' });
    await renderScreen(<Camera />);

    expect(screen.getByRole('button', { name: 'Choose from library instead' })).toBeOnTheScreen();
  });
});

describe('the selfie', () => {
  it('uses the front camera with an oval guide and no flash', async () => {
    await ready({ mode: 'selfie' });

    expect(screen.getByTestId('camera-view')).toHaveProp('facing', 'front');
    expect(screen.getByText('Face the window, no filter')).toBeOnTheScreen();
    expect(screen.queryByTestId('camera-flash')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Done' })).toBeNull();
  });

  it('shows the still, and hands it back on Use this photo', async () => {
    const { Opener, result } = opener();
    await renderScreen(<Opener />);
    await ready({ mode: 'selfie' });
    native.takePictureAsync.mockResolvedValueOnce(shot('me'));

    await fireEvent.press(screen.getByTestId('camera-shutter'));

    expect(await screen.findByLabelText('Your selfie')).toBeOnTheScreen();
    expect(screen.queryByTestId('camera-view')).toBeNull();
    expect(result).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('button', { name: 'Use this photo' }));

    await waitFor(() => expect(result).toHaveBeenCalledWith([photo('me')]));
    expect(router.back).toHaveBeenCalled();
  });

  it('goes back to the live camera on Retake', async () => {
    await ready({ mode: 'selfie' });
    await fireEvent.press(screen.getByTestId('camera-shutter'));
    await screen.findByTestId('camera-still');

    await fireEvent.press(screen.getByRole('button', { name: 'Retake' }));

    expect(screen.queryByTestId('camera-still')).toBeNull();
    expect(screen.getByTestId('camera-view')).toBeOnTheScreen();
    expect(router.back).not.toHaveBeenCalled();
  });
});

describe('a device without a camera', () => {
  it('says so instead of a black screen when there is no lens (a simulator), and offers the library and a way out', async () => {
    native.getAvailableLensesAsync.mockResolvedValue([]);
    open({ mode: 'clothes', limit: '4' });
    await renderScreen(<Camera />);

    await fireEvent(screen.getByTestId('camera-view'), 'cameraReady');

    expect(await screen.findByText('The camera isn’t available on this device.')).toBeOnTheScreen();
    expect(screen.queryByTestId('camera-view')).toBeNull();
    expect(screen.getByRole('button', { name: 'Choose from library instead' })).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('camera-unavailable-close'));
    expect(router.back).toHaveBeenCalled();
  });

  it('says the same when the camera fails to start, selfie included', async () => {
    open({ mode: 'selfie' });
    await renderScreen(<Camera />);

    await act(async () => {
      await fireEvent(screen.getByTestId('camera-view'), 'mountError', { message: 'in use' });
    });

    expect(screen.getByText('The camera isn’t available on this device.')).toBeOnTheScreen();
    jest.mocked(photos.pickFromGallery).mockResolvedValue([]);
    await fireEvent.press(screen.getByRole('button', { name: 'Choose from library instead' }));
    expect(photos.pickFromGallery).toHaveBeenCalledWith(1);
    expect(router.back).not.toHaveBeenCalled();
  });
});
