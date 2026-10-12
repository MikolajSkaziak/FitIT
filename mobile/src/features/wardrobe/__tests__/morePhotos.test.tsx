import { QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams } from 'expo-router';
import type { ReactElement } from 'react';
import { Dimensions } from 'react-native';

import { ApiError } from '@/api/problem';
import * as wardrobe from '@/api/wardrobe';
import EditGarment from '@/app/(app)/clothes/[id]/edit';
import GarmentDetail from '@/app/(app)/clothes/[id]/index';
import { useSession } from '@/auth/session';
import * as photos from '@/features/wardrobe/photos';
import { putFile } from '@/features/wardrobe/putFile';
import { extraPhotos } from '@/features/wardrobe/queue';
import { queryClient } from '@/lib/queryClient';
import { clothing, extraPhoto, user, wardrobeDictionaries } from '@/test/fixtures';

jest.mock('expo-router', () => jest.requireActual('@/test/screen').routerModule);
jest.mock('@/lib/config', () => ({ apiUrl: 'http://api.test' }));
jest.mock('@/auth/tokenStorage', () => ({
  tokenStorage: { load: jest.fn(async () => null), save: jest.fn(async () => undefined), clear: jest.fn(async () => undefined) },
}));
// The native generator of ids has no stand-in here; the upload list only needs each one to be different.
let mockIds = 0;
jest.mock('expo-crypto', () => ({ randomUUID: () => `local-${++mockIds}` }));
const mockOpenCamera = jest.fn();
jest.mock('@/features/camera/session', () => ({ useCamera: () => mockOpenCamera }));
jest.mock('@/features/wardrobe/photos', () => ({ batch: 20, pickFromGallery: jest.fn(), preparePhoto: jest.fn(async (photo: { uri: string }) => photo.uri) }));
jest.mock('@/features/wardrobe/putFile', () => ({ putFile: jest.fn() }));
jest.mock('@/api/wardrobe', () => ({
  ...jest.requireActual('@/api/wardrobe'),
  fetchClothing: jest.fn(),
  fetchDictionaries: jest.fn(),
  createPhotoUpload: jest.fn(),
  addClothingPhoto: jest.fn(),
  deleteClothingPhoto: jest.fn(),
}));

const api = jest.mocked(wardrobe);
const width = Dimensions.get('window').width;
const shot = (name: string) => ({ uri: `file:///${name}.jpg`, width: 3000, height: 4000 });
const ticket = { key: 'u/me/extra/1.jpg', url: 'https://storage.test/1', method: 'PUT', headers: {}, expiresAt: '', maxBytes: 2_000_000 };
/** The counter over the picture is for the eye only: each page already says which photo it is. */
const counter = () => screen.getByTestId('garment-photo-count', { includeHiddenElements: true });
const hoodie = (extras: string[] = [], change: Partial<wardrobe.Clothing> = {}) => clothing('g1', 'Navy hoodie', 'mid_layer', { photos: extras.map(extraPhoto), ...change });

/** The screen on the app's own query client: the one the upload list writes a finished photo into. */
const show = (screenUnderTest: ReactElement) => render(<QueryClientProvider client={queryClient}>{screenUnderTest}</QueryClientProvider>);

// A finished mutation is otherwise kept for minutes, on a timer that outlives the tests.
beforeAll(() => queryClient.setDefaultOptions({ ...queryClient.getDefaultOptions(), mutations: { retry: false, gcTime: 0 } }));

beforeEach(() => {
  jest.clearAllMocks();
  extraPhotos.reset();
  queryClient.clear();
  useSession.setState({ status: 'signedIn', user: user(), accessToken: 'a', refreshToken: 'r' });
  jest.mocked(useLocalSearchParams).mockReturnValue({ id: 'g1' });
  api.fetchDictionaries.mockResolvedValue(wardrobeDictionaries);
  api.createPhotoUpload.mockResolvedValue(ticket);
  jest.mocked(putFile).mockResolvedValue(undefined);
});

// The screen goes first: what it leaves in the app's query client holds timers that would keep the test process alive.
afterEach(async () => {
  await cleanup();
  extraPhotos.reset();
  queryClient.clear();
});

describe('a garment with only its main picture', () => {
  it('shows the picture as before, and the section with the add tile and what the photos are for', async () => {
    api.fetchClothing.mockResolvedValue(hoodie());
    await show(<GarmentDetail />);

    expect(await screen.findByRole('image', { name: 'Navy hoodie' })).toBeOnTheScreen();
    expect(screen.queryByTestId('garment-photos')).toBeNull();
    expect(screen.queryByTestId('garment-photo-count', { includeHiddenElements: true })).toBeNull();
    expect(screen.getByRole('header', { name: 'More photos' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Add photo' })).toBeOnTheScreen();
    expect(screen.getByText('The back, a detail, or how it fits you. Only you see these.')).toBeOnTheScreen();
  });

  it('keeps the section away while the photo is still being described', async () => {
    api.fetchClothing.mockResolvedValue(hoodie([], { status: 'processing', name: null }));
    await show(<GarmentDetail />);

    expect(await screen.findByText('Describing your photo')).toBeOnTheScreen();
    expect(screen.queryByTestId('more-photos')).toBeNull();
  });
});

describe('a garment with extra photos', () => {
  it('pages through them after the main picture, counts them, and lists them small without the caption', async () => {
    api.fetchClothing.mockResolvedValue(hoodie(['back', 'fit']));
    await show(<GarmentDetail />);

    expect(await screen.findByRole('image', { name: 'Photo 1 of 3 of Navy hoodie' })).toBeOnTheScreen();
    expect(screen.getByTestId('garment-photo-2')).toHaveProp('accessibilityLabel', 'Photo 2 of 3 of Navy hoodie');
    expect(screen.getByTestId('garment-photo-3')).toHaveProp('accessibilityLabel', 'Photo 3 of 3 of Navy hoodie');
    expect(counter()).toHaveTextContent('Photo 1 of 3');
    // The round buttons stay over the picture whichever page is in front.
    expect(screen.getByRole('button', { name: 'Back' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Edit details' })).toBeOnTheScreen();

    await fireEvent.scroll(screen.getByTestId('garment-photos'), { nativeEvent: { contentOffset: { x: 2 * width, y: 0 } } });
    expect(counter()).toHaveTextContent('Photo 3 of 3');

    expect(screen.getByTestId('more-photo-2')).toHaveProp('accessibilityLabel', 'Photo 2 of 3 of Navy hoodie');
    expect(screen.getByTestId('more-photo-3')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Add photo' })).toBeOnTheScreen();
    expect(screen.queryByText('The back, a detail, or how it fits you. Only you see these.')).toBeNull();
  });

  it('opens a photo full screen from its page, and closes it again', async () => {
    api.fetchClothing.mockResolvedValue(hoodie(['back']));
    await show(<GarmentDetail />);

    await fireEvent.press(await screen.findByTestId('garment-photo-2'));

    expect(screen.getByTestId('visualization-viewer-close')).toBeOnTheScreen();
    expect(screen.getAllByLabelText('Photo 2 of 2 of Navy hoodie')).toHaveLength(3);
    await fireEvent.press(screen.getByTestId('visualization-viewer-close'));
    expect(screen.queryByTestId('visualization-viewer-close')).toBeNull();
  });

  it('offers no more once it has four', async () => {
    api.fetchClothing.mockResolvedValue(hoodie(['a', 'b', 'c', 'd']));
    await show(<GarmentDetail />);

    expect(await screen.findByTestId('more-photo-5')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Add photo' })).toBeNull();
  });
});

describe('adding a photo', () => {
  it('asks where from, opens the app’s own camera for what the garment has room for, and shows the photo at once', async () => {
    api.fetchClothing.mockResolvedValue(hoodie(['back']));
    mockOpenCamera.mockResolvedValue([shot('fit')]);
    // The server takes its time: the photo is on the screen while it does.
    api.addClothingPhoto.mockReturnValue(new Promise(() => undefined));
    await show(<GarmentDetail />);

    await fireEvent.press(await screen.findByRole('button', { name: 'Add photo' }));
    expect(screen.getByRole('button', { name: 'Choose from library' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Take a photo' }));

    expect(mockOpenCamera).toHaveBeenCalledWith({ mode: 'photo', limit: 3 });
    expect(await screen.findByRole('progressbar', { name: 'Uploading photo 3' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Take a photo' })).toBeNull();
    // The rest of the screen is still there to use.
    expect(screen.getByTestId('garment-laundry')).toBeOnTheScreen();
    await waitFor(() => expect(api.addClothingPhoto).toHaveBeenCalledWith('g1', ticket.key));
    expect(api.createPhotoUpload).toHaveBeenCalledWith('g1');
  });

  it('takes photos from the library, up to what is left, and makes them the garment’s once the server has them', async () => {
    api.fetchClothing.mockResolvedValue(hoodie(['a', 'b']));
    // The picker let one too many through.
    jest.mocked(photos.pickFromGallery).mockResolvedValue([shot('c'), shot('d'), shot('e')]);
    api.addClothingPhoto.mockResolvedValueOnce(extraPhoto('c')).mockResolvedValueOnce(extraPhoto('d'));
    await show(<GarmentDetail />);

    await fireEvent.press(await screen.findByRole('button', { name: 'Add photo' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Choose from library' }));

    expect(photos.pickFromGallery).toHaveBeenCalledWith(2);
    expect(await screen.findByTestId('more-photo-5')).toHaveProp('accessibilityLabel', 'Photo 5 of 5 of Navy hoodie');
    expect(api.addClothingPhoto).toHaveBeenCalledTimes(2);
    expect(extraPhotos.store.getState().entries).toEqual([]);
    // Four extra photos: the pager has them all, and there is no room for another.
    expect(screen.getByTestId('garment-photo-5')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Add photo' })).toBeNull();
  });

  it('adds nothing when the person backs out of the camera', async () => {
    api.fetchClothing.mockResolvedValue(hoodie());
    mockOpenCamera.mockResolvedValue([]);
    await show(<GarmentDetail />);

    await fireEvent.press(await screen.findByRole('button', { name: 'Add photo' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Take a photo' }));

    await waitFor(() => expect(mockOpenCamera).toHaveBeenCalled());
    expect(api.createPhotoUpload).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Add photo' })).toBeOnTheScreen();
  });

  it('says why a photo did not get through, sends it again on a press, and can let it go', async () => {
    api.fetchClothing.mockResolvedValue(hoodie());
    mockOpenCamera.mockResolvedValue([shot('back')]);
    jest.mocked(putFile).mockRejectedValueOnce(new ApiError({ status: 403, code: 'upload_refused' }));
    api.addClothingPhoto.mockResolvedValue(extraPhoto('back'));
    await show(<GarmentDetail />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Add photo' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Take a photo' }));

    expect(await screen.findByText('The photo didn’t upload. Try again.')).toBeOnTheScreen();
    expect(api.addClothingPhoto).not.toHaveBeenCalled();
    expect(screen.getByRole('link', { name: 'Discard' })).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Retry upload: photo 2' }));

    expect(await screen.findByTestId('more-photo-2')).toBeOnTheScreen();
    expect(screen.queryByText('The photo didn’t upload. Try again.')).toBeNull();
    expect(api.addClothingPhoto).toHaveBeenCalledTimes(1);
  });

  it('drops a photo that did not get through on Discard', async () => {
    api.fetchClothing.mockResolvedValue(hoodie());
    mockOpenCamera.mockResolvedValue([shot('back')]);
    api.createPhotoUpload.mockRejectedValue(new ApiError({ status: 409, code: 'photo_limit_reached' }));
    await show(<GarmentDetail />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Add photo' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Take a photo' }));

    expect(await screen.findByText('This piece already has four extra photos. Remove one to add another.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('link', { name: 'Discard' }));

    expect(screen.queryByTestId('more-photos-error')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Retry upload: photo 2' })).toBeNull();
    expect(screen.getByText('The back, a detail, or how it fits you. Only you see these.')).toBeOnTheScreen();
  });
});

describe('removing a photo on the edit screen', () => {
  it('shows no section for a garment without extra photos', async () => {
    api.fetchClothing.mockResolvedValue(hoodie());
    await show(<EditGarment />);

    expect(await screen.findByTestId('garment-name-field')).toBeOnTheScreen();
    expect(screen.queryByTestId('edit-photos')).toBeNull();
  });

  it('takes the photo away at once and tells the server which one', async () => {
    api.fetchClothing.mockResolvedValue(hoodie(['back', 'fit']));
    api.deleteClothingPhoto.mockResolvedValue(undefined);
    await show(<EditGarment />);

    expect(await screen.findByRole('header', { name: 'More photos' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Remove photo 2' }));

    await waitFor(() => expect(api.deleteClothingPhoto).toHaveBeenCalledWith('g1', 'back'));
    expect(jest.mocked(Haptics.impactAsync).mock.calls).toEqual([['heavy']]);
    expect(Haptics.notificationAsync).not.toHaveBeenCalled();
    // The one that is left is now photo 2.
    expect(screen.getByRole('button', { name: 'Remove photo 2' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Remove photo 3' })).toBeNull();
    expect(queryClient.getQueryData<wardrobe.Clothing>(wardrobe.wardrobeKeys.one('g1'))?.photos.map((photo) => photo.id)).toEqual(['fit']);
  });

  it('puts the photo back and says why when the server refuses', async () => {
    api.fetchClothing.mockResolvedValue(hoodie(['back', 'fit']));
    api.deleteClothingPhoto.mockRejectedValue(new ApiError({ status: 0, code: 'network' }));
    await show(<EditGarment />);

    await fireEvent.press(await screen.findByRole('button', { name: 'Remove photo 3' }));

    expect(await screen.findByText('Can’t connect right now. Check your internet connection and try again.')).toBeOnTheScreen();
    // Felt once: the heavy tap for removing it, the error cue for the photo coming back.
    expect(jest.mocked(Haptics.notificationAsync).mock.calls).toEqual([['error']]);
    expect(screen.getByRole('button', { name: 'Remove photo 3' })).toBeOnTheScreen();
    expect(queryClient.getQueryData<wardrobe.Clothing>(wardrobe.wardrobeKeys.one('g1'))?.photos.map((photo) => photo.id)).toEqual(['back', 'fit']);
  });
});
