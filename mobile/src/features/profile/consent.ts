import { formatLongDate, fromJsDate } from '@/lib/dates';

/**
 * The line under the consent switch. While consent stands it says since when; once withdrawn it says, in one
 * sentence, what stops working, because that is what the person needs to know right after switching it off.
 */
export function consentLine(consentAt: string | null): string {
  if (!consentAt) {
    return 'Zgoda wycofana. Bez niej nie dodasz nowych ubrań ani nie zobaczysz zestawu na sylwetce.';
  }

  const given = new Date(consentAt);
  return Number.isNaN(given.getTime()) ? 'Zgoda udzielona.' : `Zgoda z ${formatLongDate(fromJsDate(given))}.`;
}
