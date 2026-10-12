import * as Crypto from 'expo-crypto';

import { addClothing, addClothingPhoto, createPhotoUpload, createUpload, fetchClothesByIds, wardrobeKeys, type Clothing } from '@/api/wardrobe';
import { onSessionEnd } from '@/auth/session';
import { queryClient } from '@/lib/queryClient';

import { createExtraPhotoQueue } from './extraPhotos';
import { preparePhoto } from './photos';
import { putFile } from './putFile';
import { createUploadQueue } from './uploadQueue';

/**
 * The app's one upload queue. It lives outside the screens, so photos keep travelling while the person closes the
 * sheet and looks around the wardrobe.
 */
export const uploads = createUploadQueue({
  prepare: preparePhoto,
  createUpload,
  put: putFile,
  confirm: addClothing,
  fetchByIds: (ids) => fetchClothesByIds(ids),
  onWardrobeChanged: () => {
    void queryClient.invalidateQueries({ queryKey: wardrobeKeys.all });
    void queryClient.invalidateQueries({ queryKey: wardrobeKeys.usage });
  },
  wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  newId: () => Crypto.randomUUID(),
});

onSessionEnd(() => uploads.reset());

/**
 * More photos of garments already in the wardrobe, on their way to the server. They are prepared on the phone like any
 * upload, and only stored: no background removal, no AI service. Like `uploads`, it outlives the screen that started it.
 */
export const extraPhotos = createExtraPhotoQueue({
  prepare: preparePhoto,
  createUpload: createPhotoUpload,
  put: putFile,
  confirm: addClothingPhoto,
  onAdded: (garmentId, photo) => {
    queryClient.setQueryData<Clothing>(wardrobeKeys.one(garmentId), (garment) =>
      garment && !garment.photos.some((known) => known.id === photo.id) ? { ...garment, photos: [...garment.photos, photo] } : garment,
    );
    // The lists carry the garment's photos too, and the detail screen opens from what a list holds.
    void queryClient.invalidateQueries({ queryKey: [...wardrobeKeys.all, 'list'] });
  },
  wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  newId: () => Crypto.randomUUID(),
});

onSessionEnd(() => extraPhotos.reset());
