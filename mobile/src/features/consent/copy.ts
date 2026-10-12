import { formatLongDate, fromJsDate } from '@/lib/dates';

/** Which photos the person is about to send out. Both are covered by the one consent. */
export type ConsentKind = 'clothes' | 'selfie';

/**
 * The words of the consent sheet. Each line rests on what the backend really does: a clothes photo goes to fal.ai (the
 * background comes off, and the try-on pictures are made there) and its cutout to Google (the piece is described); the
 * selfie goes to Google only and is deleted from our storage in the same request, whatever the answer; neither company
 * is promised anything beyond its own terms, because the code cannot know what they keep.
 */
export const consent = {
  eyebrow: 'Before your photos leave your phone',
  policy: 'Privacy Policy',
  allow: 'Allow and continue',
  notNow: 'Not now',
  saving: 'Saving your choice…',
  clothes: {
    title: 'AI helps with your clothes',
    sentLabel: 'What is sent',
    sent: 'Photos of your clothes',
    whoLabel: 'Who receives it',
    who: 'Google and fal.ai. They cut each piece out, describe it and make your try-on pictures, under their own terms.',
    whatLabel: 'What happens to it',
    what: 'The photos stay in your wardrobe until you delete the piece or your account. You can turn this off any time in Profile.',
  },
  selfie: {
    title: 'AI reads your colors',
    sentLabel: 'What is sent',
    sent: 'One photo of your face',
    whoLabel: 'Who receives it',
    who: 'Google, to read your coloring, under its own terms.',
    whatLabel: 'What happens to it',
    what: 'We delete the selfie from our storage right after the analysis and keep only your palette. You can turn this off any time in Profile.',
  },
} as const;

/** Profile, About: the switch that withdraws the consent (and gives it again). */
export const consentSwitch = {
  label: 'Send photos to AI services',
  off: 'Off. You can’t add clothes by photo, try outfits on or use a selfie for your colors. Nothing already saved is deleted.',
};

/**
 * The line under the switch. While the consent stands it says what the photos are used for and since when; once withdrawn it
 * says what stops working, because that is what the person needs to know right after switching it off.
 */
export function consentLine(consentAt: string | null): string {
  if (!consentAt) {
    return consentSwitch.off;
  }

  const given = new Date(consentAt);
  const used = 'Used to cut out and describe your clothes, make try-on pictures and read a selfie.';
  return Number.isNaN(given.getTime()) ? used : `${used} Since ${formatLongDate(fromJsDate(given))}.`;
}
