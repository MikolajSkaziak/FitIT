import { months } from '@/lib/dates';
import { garments } from '@/lib/plural';

/** Shown on the screen and typed by the person; the server asks for the password on top of it. */
export const confirmationWord = 'DELETE';

/** The word is matched without regard to case, so a person who types "delete" has understood the question as well as one who types "DELETE". */
export function isDeletionConfirmed(typed: string): boolean {
  return typed.trim().toUpperCase() === confirmationWord;
}

/** What will be removed, named plainly. Without a count (still loading, or empty) the sentence does not guess one. */
export function deletionSummary(garmentCount: number | undefined): string {
  const items = garmentCount ? garments(garmentCount) : 'all your clothes';
  return `We’ll delete your account, ${items}, saved outfits and images. This can’t be undone.`;
}

/** "October 2026": since when the person has been here, for the label of the leaving screen. Null when the date cannot be read. */
export function memberSince(createdAt: string): string | null {
  const date = new Date(createdAt);
  return Number.isNaN(date.getTime()) ? null : `${months[date.getMonth()]} ${date.getFullYear()}`;
}
