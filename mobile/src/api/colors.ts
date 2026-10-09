import { api, type Schemas } from './client';
import { unwrap } from './problem';
import type { UploadTicket } from './wardrobe';

export type ColorAnalysis = Schemas['ColorAnalysisResponse'];
export type ColorSwatch = Schemas['ColorSwatchResponse'];
/** The schema marks every optional enum as nullable; the questions are all required, so the null is taken out here. */
export type ColorAnswers = {
  /** 1 (very fair) to 8 (very deep). */
  skinTone: number;
  undertone: NonNullable<Schemas['SkinUndertone']>;
  hair: NonNullable<Schemas['HairColor']>;
  eyes: NonNullable<Schemas['EyeColor']>;
};

/** An address for one selfie. It lies under the person's own `selfie/` folder, and the file is deleted as soon as the analysis returns. */
export const createSelfieUpload = (): Promise<UploadTicket> => unwrap(api.POST('/api/me/color-analysis/upload'));

/** Send the key of an uploaded selfie, or the four answers. The result is also kept on the profile. */
export const analyzeColors = (body: { key: string } | { answers: ColorAnswers }): Promise<ColorAnalysis> =>
  unwrap(api.POST('/api/me/color-analysis', { body }));

export const deleteColorAnalysis = async (): Promise<void> => {
  await unwrap(api.DELETE('/api/me/color-analysis'));
};
