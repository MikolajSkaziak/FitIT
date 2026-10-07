import type { StyleTag } from '@/api/account';
import type { Category, Color, Material, Pattern, Subcategory } from '@/api/wardrobe';

/** The description of a garment while a person is filling it in: anything may still be missing. */
export interface GarmentForm {
  name: string;
  category: Category | null;
  subcategory: Subcategory | null;
  colors: readonly Color[];
  pattern: Pattern | null;
  material: Material | null;
  formality: number | null;
  warmth: number | null;
  rainOk: boolean;
  styles: readonly StyleTag[];
}

/** What still has to be filled in before the description can be saved, named the way the form names it. */
export function missingTags(form: GarmentForm): string[] {
  const missing: string[] = [];
  if (form.name.trim().length === 0) {
    missing.push('nazwa');
  }

  if (!form.category) {
    missing.push('kategoria');
  }

  if (!form.subcategory) {
    missing.push('typ');
  }

  if (form.colors.length === 0) {
    missing.push('kolor');
  }

  if (!form.pattern) {
    missing.push('wzór');
  }

  if (!form.material) {
    missing.push('materiał');
  }

  if (form.formality === null) {
    missing.push('formalność');
  }

  if (form.warmth === null) {
    missing.push('ciepło');
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
