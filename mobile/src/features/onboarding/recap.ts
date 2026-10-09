import type { User } from '@/api/account';
import type { Weather } from '@/api/weather';
import { styleLabel } from '@/copy/labels';
import { rangeOf, skyNames } from '@/features/weather/copy';

import { recap } from './copy';
import { piecesForFirstOutfit } from './steps';

export interface RecapLine {
  key: keyof typeof recap.labels;
  label: string;
  value: string;
  meta?: string;
}

/**
 * The facts the person actually gave, one line each, and nothing else: no place without a place, no colors without an
 * analysis, no styles when none were chosen. The body shape is not a fact the recap lists.
 */
export function recapLines(user: Pick<User, 'displayName' | 'location' | 'styles' | 'colorAnalysis'>, weather: Weather | undefined, clothes: number): RecapLine[] {
  const lines: RecapLine[] = [{ key: 'name', label: recap.labels.name, value: user.displayName }];
  if (user.location) {
    lines.push({
      key: 'weather',
      label: recap.labels.weather,
      value: user.location.name,
      meta: weather ? `${skyNames[weather.sky]}, ${rangeOf(weather)} today` : undefined,
    });
  }

  if (user.styles.length > 0) {
    lines.push({ key: 'styles', label: recap.labels.styles, value: user.styles.map((tag) => styleLabel(tag).toLowerCase()).join(', ') });
  }

  if (user.colorAnalysis) {
    lines.push({ key: 'colors', label: recap.labels.colors, value: user.colorAnalysis.name });
  }

  lines.push({ key: 'clothes', label: recap.labels.clothes, value: String(clothes) });
  return lines;
}

/** What happens next: how many pieces are still needed for the first outfit, or that there are enough. */
export const nextLine = (clothes: number): string => (clothes >= piecesForFirstOutfit ? recap.ready : recap.needMore);
