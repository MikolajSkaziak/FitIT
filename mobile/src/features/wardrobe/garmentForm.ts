import type { StyleTag } from '@/api/account';
import type { Color, GarmentGroup, Material, Pattern, Season, Subcategory } from '@/api/wardrobe';

/** The description of a garment while a person is filling it in: anything may still be missing. */
export interface GarmentForm {
  name: string;
  group: GarmentGroup | null;
  subcategory: Subcategory | null;
  colors: readonly Color[];
  pattern: Pattern | null;
  material: Material | null;
  formality: number | null;
  warmth: number | null;
  rainOk: boolean;
  styles: readonly StyleTag[];
  /** Optional: left empty, the garment gets the seasons its warmth suggests. */
  seasons: readonly Season[];
}

/** What still has to be filled in before the description can be saved, named the way the form names it. */
export function missingTags(form: GarmentForm): string[] {
  const missing: string[] = [];
  if (form.name.trim().length === 0) {
    missing.push('name');
  }

  if (!form.group) {
    missing.push('group');
  }

  if (!form.subcategory) {
    missing.push('type');
  }

  if (form.colors.length === 0) {
    missing.push('color');
  }

  if (!form.pattern) {
    missing.push('pattern');
  }

  if (!form.material) {
    missing.push('material');
  }

  if (form.formality === null) {
    missing.push('formality');
  }

  if (form.warmth === null) {
    missing.push('warmth');
  }

  return missing;
}

/**
 * A garment has one or two colours, the main one first. Pressing a chosen colour removes it; pressing a third one
 * replaces the second, so the main colour is never lost by accident.
 */
export function toggleColor(colors: readonly Color[], color: Color): Color[] {
  if (colors.includes(color)) {
    return colors.filter((chosen) => chosen !== color);
  }

  return colors.length < 2 ? [...colors, color] : [colors[0] as Color, color];
}
