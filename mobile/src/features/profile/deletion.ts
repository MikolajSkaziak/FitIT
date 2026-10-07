import { garments } from '@/lib/plural';

/** Shown in the mock-up and typed by the person; the server asks for the password on top of it. */
export const confirmationWord = 'USUŃ';

/**
 * The word is matched without regard to case, and without the diacritic: on many phone keyboards "ń" needs a long
 * press, and a person who types "usun" has understood the question as well as one who types "USUŃ".
 */
export function isDeletionConfirmed(typed: string): boolean {
  const word = typed.trim().normalize('NFC').toUpperCase();
  return word === confirmationWord || word === 'USUN';
}

/** What will be removed, named plainly. Without a count (still loading, or empty) the sentence does not guess one. */
export function deletionSummary(garmentCount: number | undefined): string {
  const items = garmentCount ? garments(garmentCount) : 'wszystkie ubrania';
  return `Usuniemy konto, ${items}, zapisane zestawy i obrazy. Tego nie da się cofnąć.`;
}
