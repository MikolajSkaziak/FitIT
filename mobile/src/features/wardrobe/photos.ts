import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

/** A photo on the phone, with its size when the system told us. */
export interface LocalPhoto {
  uri: string;
  width: number;
  height: number;
}

/** Longest side sent to the server (product spec 5.1): enough for the models, small enough for a mobile connection. */
export const longestSide = 1280;

/** Above this the photo is saved again with stronger compression. */
export const targetBytes = 400_000;

const toPhoto = (asset: ImagePicker.ImagePickerAsset): LocalPhoto => ({ uri: asset.uri, width: asset.width, height: asset.height });

/** Opens the system gallery. Several photos can be chosen at once, up to `limit`. Empty when the person backs out. */
export async function pickFromGallery(limit: number): Promise<LocalPhoto[]> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    selectionLimit: Math.max(1, limit),
    orderedSelection: true,
    quality: 1,
    exif: false,
  });
  return result.canceled ? [] : result.assets.map(toPhoto);
}

export type CameraShot = { kind: 'taken'; photo: LocalPhoto } | { kind: 'cancelled' } | { kind: 'denied' };

/** Opens the camera, asking for permission the first time. */
export async function takePhoto(): Promise<CameraShot> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    return { kind: 'denied' };
  }

  const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1, exif: false });
  const asset = result.canceled ? undefined : result.assets[0];
  return asset ? { kind: 'taken', photo: toPhoto(asset) } : { kind: 'cancelled' };
}

/** The size after fitting the longer side into `longestSide`; null when the photo is small enough already. */
export function fitWithin(width: number, height: number, limit: number = longestSide): { width: number | null; height: number | null } | null {
  if (Math.max(width, height) <= limit) {
    return null;
  }

  return width >= height ? { width: limit, height: null } : { width: null, height: limit };
}

async function sizeOf(uri: string): Promise<number> {
  const response = await fetch(uri);
  return (await response.blob()).size;
}

/**
 * Makes the file that is actually sent: at most 1280 on the longer side, JPEG, without the location and camera data
 * a phone writes into a photo (re-encoding drops them).
 */
export async function preparePhoto(photo: LocalPhoto): Promise<string> {
  const context = ImageManipulator.manipulate(photo.uri);
  let width = photo.width;
  let height = photo.height;
  if (width <= 0 || height <= 0) {
    const original = await context.renderAsync();
    width = original.width;
    height = original.height;
  }

  const size = fitWithin(width, height);
  if (size) {
    context.resize(size);
  }

  const image = await context.renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.8 });
  if ((await sizeOf(saved.uri)) <= targetBytes) {
    return saved.uri;
  }

  // A busy pattern can still come out heavy; a second, stronger pass keeps uploads quick on a mobile connection.
  return (await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.6 })).uri;
}
