import * as Crypto from 'expo-crypto';

import { addClothing, createUpload, fetchClothesByIds, wardrobeKeys } from '@/api/wardrobe';
import { onSessionEnd } from '@/auth/session';
import { queryClient } from '@/lib/queryClient';

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
