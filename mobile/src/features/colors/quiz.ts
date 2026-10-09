import type { ColorAnswers } from '@/api/colors';

/**
 * The four questions that replace the photo. The colors are content, like a garment's color: a rough match for what the
 * person sees in the mirror, there to be recognized at a glance. The server turns the answers into a type.
 * `swatch` is null for the one choice that has no color of its own ("dyed or other"): it is drawn as an empty outline.
 */
export interface QuizOption<T extends string | number> {
  value: T;
  label: string;
  swatch: string | null;
}

/** From very fair to very deep, numbered 1 to 8 as the server expects. */
export const skinToneOptions: readonly QuizOption<ColorAnswers['skinTone']>[] = [
  { value: 1, label: 'Very fair', swatch: '#F6E3D4' },
  { value: 2, label: 'Fair', swatch: '#F1D3BC' },
  { value: 3, label: 'Light', swatch: '#E8BF9E' },
  { value: 4, label: 'Light medium', swatch: '#D9A57D' },
  { value: 5, label: 'Medium', swatch: '#C48A62' },
  { value: 6, label: 'Medium deep', swatch: '#A56C48' },
  { value: 7, label: 'Deep', swatch: '#7F4E33' },
  { value: 8, label: 'Very deep', swatch: '#55341F' },
];

/** Text-only: the undertone is a judgement about the skin, so it sits apart from the tone and is not drawn as a color. */
export const undertoneOptions: readonly { value: ColorAnswers['undertone']; label: string }[] = [
  { value: 'warm', label: 'Warm' },
  { value: 'neutral', label: 'Neutral' },
  { value: 'cool', label: 'Cool' },
];

export const hairOptions: readonly QuizOption<ColorAnswers['hair']>[] = [
  { value: 'platinum_blond', label: 'Platinum blond', swatch: '#EDE6D3' },
  { value: 'golden_blond', label: 'Golden blond', swatch: '#D8B36A' },
  { value: 'red', label: 'Strawberry or red', swatch: '#BC5A33' },
  { value: 'auburn', label: 'Auburn', swatch: '#8A3F24' },
  { value: 'light_brown', label: 'Light brown', swatch: '#8B6B4A' },
  { value: 'dark_brown', label: 'Dark brown', swatch: '#4A3224' },
  { value: 'black', label: 'Black', swatch: '#1E1A1A' },
  { value: 'gray', label: 'Gray or silver', swatch: '#B5B5B2' },
  { value: 'dyed', label: 'Dyed or other', swatch: null },
];

export const eyeOptions: readonly QuizOption<ColorAnswers['eyes']>[] = [
  { value: 'light_blue', label: 'Light blue', swatch: '#9DC3DB' },
  { value: 'gray', label: 'Gray', swatch: '#8E9AA3' },
  { value: 'green', label: 'Green', swatch: '#6E8F5A' },
  { value: 'hazel', label: 'Hazel', swatch: '#8F6B3E' },
  { value: 'amber', label: 'Amber or light brown', swatch: '#B07A32' },
  { value: 'dark_brown', label: 'Dark brown', swatch: '#4A2F20' },
  { value: 'near_black', label: 'Near black', swatch: '#1D1512' },
];

export type QuizDraft = { [K in keyof ColorAnswers]: ColorAnswers[K] | null };

export const emptyQuiz: QuizDraft = { skinTone: null, undertone: null, hair: null, eyes: null };

/** The answers once all four questions are answered, or null while one is missing. */
export const completeQuiz = (draft: QuizDraft): ColorAnswers | null =>
  draft.skinTone && draft.undertone && draft.hair && draft.eyes
    ? { skinTone: draft.skinTone, undertone: draft.undertone, hair: draft.hair, eyes: draft.eyes }
    : null;
