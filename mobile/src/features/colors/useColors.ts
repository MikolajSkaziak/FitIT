import { useMutation } from '@tanstack/react-query';

import { analyzeColors, createSelfieUpload, deleteColorAnalysis, type ColorAnalysis, type ColorAnswers } from '@/api/colors';
import { setUser, useSession } from '@/auth/session';
import { preparePhoto, type LocalPhoto } from '@/features/wardrobe/photos';
import { putFile } from '@/features/wardrobe/putFile';

/** The result is kept with the person in memory, as the server keeps it on the profile. */
function keep(colorAnalysis: ColorAnalysis | null): void {
  const user = useSession.getState().user;
  if (user) {
    setUser({ ...user, colorAnalysis });
  }
}

/** A selfie in, a palette out: shrink it, send it straight to storage, ask for the analysis. The server deletes the photo. */
export async function analyzeSelfie(photo: LocalPhoto): Promise<ColorAnalysis> {
  const file = await preparePhoto(photo);
  const ticket = await createSelfieUpload();
  await putFile(ticket, file, () => undefined);
  return analyzeColors({ key: ticket.key });
}

export function useAnalyzeSelfie() {
  return useMutation({ mutationFn: (photo: LocalPhoto) => analyzeSelfie(photo), onSuccess: keep });
}

export function useAnalyzeAnswers() {
  return useMutation({ mutationFn: (answers: ColorAnswers) => analyzeColors({ answers }), onSuccess: keep });
}

export function useRemoveColors() {
  return useMutation({ mutationFn: () => deleteColorAnalysis(), onSuccess: () => keep(null) });
}
