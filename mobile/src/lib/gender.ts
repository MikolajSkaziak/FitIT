import type { Gender } from '@/api/account';

export const genders: readonly Gender[] = ['female', 'male', 'non_binary', 'unspecified'];

/** Reads a gender code that came in as text (a route parameter), or null when it is not one. */
export const parseGender = (text: string | undefined): Gender | null => genders.find((gender) => gender === text) ?? null;

/** Non-binary and "prefer not to say" are not tied to a set of body shapes: all ten are offered. */
export const opensAllShapes = (gender: Gender | null): boolean => gender === 'non_binary' || gender === 'unspecified';

/** Whether a body shape made for `shapeGender` (female or male) may be chosen by a person of `gender`. Mirrors the server. */
export const shapeFits = (gender: Gender | null, shapeGender: Gender | null): boolean =>
  gender !== null && shapeGender !== null && (opensAllShapes(gender) || gender === shapeGender);
