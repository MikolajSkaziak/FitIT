import { useCameraPermissions } from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking } from 'react-native';

import { Button } from '@/components/Button';
import { CameraPage } from '@/features/camera/CameraPage';
import { camera as copy } from '@/features/camera/copy';
import { finishCamera, type CameraMode } from '@/features/camera/session';
import { Viewfinder } from '@/features/camera/Viewfinder';
import { batch, pickFromGallery, type LocalPhoto } from '@/features/wardrobe/photos';

/**
 * fitit.'s own camera, full screen over whatever opened it (`useCamera`). `mode` is `clothes` (back camera, shot after
 * shot, up to `limit`), `photo` (the same for one more photo of a garment, without the guide) or `selfie` (front camera, one shot and a look at it). Whatever happens, the opener gets an answer:
 * the photos, or none. Permission is asked here, in context; the page before the system's alert has the one button, and every other state without a camera has a way forward and a way out.
 */
export default function Camera() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string; limit?: string; daily?: string }>();
  const mode: CameraMode = params.mode === 'selfie' || params.mode === 'photo' ? params.mode : 'clothes';
  const limit = mode === 'selfie' ? 1 : Math.max(1, Math.min(batch, Number(params.limit) || batch));
  const [permission, request] = useCameraPermissions();
  const [unavailable, setUnavailable] = useState(false);

  // Closed some other way (the system back button): the opener still gets its answer.
  useEffect(() => () => finishCamera([]), []);

  const finish = (photos: LocalPhoto[]) => {
    finishCamera(photos);
    router.back();
  };
  const close = () => finish([]);

  // The library opens over this screen, and what is chosen goes back the same way a shot would.
  const fromLibrary = async () => {
    const photos = await pickFromGallery(limit);
    if (photos.length > 0) {
      finish(photos);
    }
  };
  const library = <Button label={copy.library} kind="secondary" icon="image" onPress={() => void fromLibrary()} testID="camera-library" />;

  if (unavailable) {
    return (
      <CameraPage
        text={copy.unavailable}
        onClose={close}
        testID="camera-unavailable"
        actions={
          <>
            {library}
            <Button label={copy.close} kind="text" onPress={close} testID="camera-unavailable-close" />
          </>
        }
      />
    );
  }

  if (!permission) {
    return <CameraPage onClose={close} testID="camera-loading" />;
  }

  if (!permission.granted) {
    const text = permission.canAskAgain ? copy.permission[mode] : copy.permission.denied;
    return (
      <CameraPage
        title={copy.permission.title}
        text={text}
        // Before the system's alert there is one button and no way out around it (Apple's guidelines); once refused, closing is there again.
        onClose={permission.canAskAgain ? undefined : close}
        testID={permission.canAskAgain ? 'camera-ask' : 'camera-denied'}
        actions={
          permission.canAskAgain ? (
            <Button label={copy.permission.continue} onPress={() => void request()} testID="camera-continue" />
          ) : (
            <>
              <Button label={copy.permission.settings} onPress={() => void Linking.openSettings()} testID="camera-settings" />
              {mode === 'selfie' ? null : library}
            </>
          )
        }
      />
    );
  }

  return <Viewfinder mode={mode} limit={limit} daily={params.daily === '1'} onDone={finish} onClose={close} onUnavailable={() => setUnavailable(true)} />;
}
