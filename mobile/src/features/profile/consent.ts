import { formatLongDate, fromJsDate } from '@/lib/dates';

/**
 * The line under the consent switch. While consent stands it says what the photos are for and since when; once withdrawn it says, in one
 * sentence, what stops working, because that is what the person needs to know right after switching it off.
 */
export function consentLine(consentAt: string | null): string {
  if (!consentAt) {
    return 'Off. Without it, you can’t add clothes or try outfits on.';
  }

  const given = new Date(consentAt);
  const purpose = 'Used to describe your clothes and show outfits on you.';
  return Number.isNaN(given.getTime()) ? purpose : `${purpose} You agreed on ${formatLongDate(fromJsDate(given))}.`;
}
