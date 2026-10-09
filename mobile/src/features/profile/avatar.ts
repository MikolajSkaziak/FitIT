/** The first letter of a name, upper case, for the placeholder avatar. Null when the name has no letter to show. */
export function initialOf(name: string | null | undefined): string | null {
  const letter = name?.match(/\p{L}/u)?.[0];
  return letter ? letter.toLocaleUpperCase() : null;
}
