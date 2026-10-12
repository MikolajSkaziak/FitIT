import { useRouter } from 'expo-router';

import type { LocalPhoto } from '@/features/wardrobe/photos';

/** `photo` is one more photo of a garment already in the wardrobe: the back camera with no flat-lay guide, as many shots as the garment has room for. */
export type CameraMode = 'clothes' | 'selfie' | 'photo';

export interface CameraRequest {
  mode: CameraMode;
  /** Clothes and photo: how many photos this visit may bring back. */
  limit?: number;
  /** Clothes only: `limit` is what is left of today's allowance, not just the size of one batch. */
  daily?: boolean;
}

/** Whoever opened the camera is waiting here for what it brings back. One camera is open at a time. */
let waiting: ((photos: LocalPhoto[]) => void) | null = null;

/** The camera screen hands its photos back and closes; nothing (an empty list) when the person backed out. */
export function finishCamera(photos: LocalPhoto[]): void {
  waiting?.(photos);
  waiting = null;
}

/**
 * Opens fitit.'s own camera over the current screen and resolves with what was taken, in the shape the library picker
 * returns, so the caller sends both down the same path. Empty when the person closes it without a photo.
 */
export function useCamera(): (request: CameraRequest) => Promise<LocalPhoto[]> {
  const router = useRouter();
  return ({ mode, limit, daily }) => {
    finishCamera([]);
    router.push({ pathname: '/camera', params: { mode, ...(limit ? { limit: String(limit) } : {}), ...(daily ? { daily: '1' } : {}) } });
    return new Promise((resolve) => {
      waiting = resolve;
    });
  };
}
