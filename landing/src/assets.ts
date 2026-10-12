import type { FigureId, PieceId } from './content';
import chair from './assets/photos/chair.webp';
import flatlay from './assets/photos/flatlay.webp';
import rail from './assets/photos/rail.webp';
import raw from './assets/photos/raw.webp';
import tryon from './assets/photos/tryon.webp';
import grain from './assets/grain.png';

function byName(files: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [path, url] of Object.entries(files)) {
    const name = path.split('/').pop()?.replace(/\.\w+$/, '');
    if (name) out[name] = url;
  }
  return out;
}

const cutouts = byName(import.meta.glob<string>('./assets/cutouts/*.webp', { eager: true, import: 'default' }));
const looks = byName(import.meta.glob<string>('./assets/looks/*.webp', { eager: true, import: 'default' }));
const styles = byName(import.meta.glob<string>('./assets/styles/*.webp', { eager: true, import: 'default' }));

export const cutout = (id: PieceId): string => cutouts[id] ?? '';
export const figure = (id: FigureId): string => looks[id] ?? '';
export const stylePhoto = (code: string): string => styles[code] ?? '';

export const photos = { chair, flatlay, rail, raw, tryon, grain };
