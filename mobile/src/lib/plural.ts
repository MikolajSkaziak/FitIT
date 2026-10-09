/** English plural forms: 1 item, 0 items, 2 items. `forms` is [one, other]. */
export function plural(count: number, forms: readonly [string, string]): string {
  return Math.abs(count) === 1 ? forms[0] : forms[1];
}

export const garments = (count: number): string => `${count} ${plural(count, ['item', 'items'])}`;

/** "light blue" to "Light blue": dictionary labels are lower case where they sit in a sentence, and capitalized where they stand alone. */
export const capitalized = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);
