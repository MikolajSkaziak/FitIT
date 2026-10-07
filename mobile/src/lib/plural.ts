/**
 * Polish plural forms: 1 ubranie, 2 ubrania, 5 ubrań, 22 ubrania, 112 ubrań.
 * `forms` is [one, few, many].
 */
export function plural(count: number, forms: readonly [string, string, string]): string {
  const n = Math.abs(count);
  if (n === 1) {
    return forms[0];
  }

  const lastTwo = n % 100;
  const last = n % 10;
  return last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14) ? forms[1] : forms[2];
}

export const garments = (count: number): string => `${count} ${plural(count, ['ubranie', 'ubrania', 'ubrań'])}`;
