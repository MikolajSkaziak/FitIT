import type { Usage } from '@/api/wardrobe';
import { messageForCode } from '@/copy/errors';
import { plural } from '@/lib/plural';

import type { OrderStage } from './order';

/** One name for this action everywhere in the app (.ux-profile.md). */
export const showAction = 'Try it on';

export const retryAction = 'Try again';

export const viewLabel = 'Outfit view';

/** The three ways to look at an outfit. "Try-on" is the AI picture of it on the person's body shape; "On figure" is instant and drawn on the phone. */
export const figureView = 'On figure';

export const collageView = 'Collage';

export const tryOnView = 'Try-on';

/** Said under the picture, because the generator may miss a pattern or a logo (spec 7.6). */
export const pictureCaption = 'This picture is an illustration, so colors and details can differ a little. The collage shows your clothes exactly as they are.';

export const pictureLabel = 'Outfit on your body shape';

export const enlargeAction = 'Enlarge picture';

export const closeEnlarged = 'Close picture';

export const working = {
  title: 'Putting the outfit on you',
  text: 'This can take up to a minute. Feel free to leave. The picture will be waiting with your outfit.',
  /** Names the bar for screen readers; the panel beside it carries the words. */
  progressLabel: 'Picture progress',
};

export interface Notice {
  title: string;
  text: string;
  /** Label of the way forward, or null when sending the same order again would end the same way. */
  action: string | null;
}

const collageStays = 'Your collage of real clothing photos is still there.';

const refunded = 'This one doesn’t count toward today’s limit.';

const consent: Notice = {
  title: 'We need your OK to use AI on your photos',
  text: `An AI service makes these pictures, so we can’t send it your clothing photos without your consent. You can turn it on in Profile, under Privacy. ${collageStays}`,
  action: null,
};

const paused: Notice = {
  title: 'Try-on pictures are paused for today',
  text: `We’ve used up today’s budget for pictures. They’ll be back tomorrow. ${collageStays}`,
  action: null,
};

/** The three cases of plan task 4.7, plus whatever else the server may answer with. */
const byCode: Record<string, Notice> = {
  content_blocked: {
    title: 'We couldn’t make a picture of this outfit',
    text: `The picture service’s safety filter didn’t accept these clothes, usually because of exposed skin. ${refunded} ${collageStays}`,
    action: null,
  },
  timeout: {
    title: 'The picture took too long',
    text: `The picture service didn’t answer within three minutes. ${refunded} Try again.`,
    action: retryAction,
  },
  budget_exhausted: paused,
  visualizations_paused: paused,
  consent_withdrawn: consent,
  consent_required: consent,
  limit_reached: {
    title: 'You’ve used today’s try-on pictures',
    text: `More tomorrow. ${collageStays}`,
    action: null,
  },
  not_found: {
    title: 'We couldn’t find your picture',
    text: 'It’s no longer saved. Make it again.',
    action: showAction,
  },
};

const pictureFailed: Notice = {
  title: 'The picture didn’t work out',
  text: `We ran into a problem while making it. ${refunded}`,
  action: retryAction,
};

const orderRefused: Notice = {
  title: 'We couldn’t start your picture',
  text: '',
  action: retryAction,
};

/**
 * What the person reads instead of the picture. `blocked` and `failed` are answers about the picture; `refused` means
 * the order was never taken, so its text comes from the shared words for API error codes.
 */
export function noticeFor(stage: OrderStage, errorCode: string | null): Notice | null {
  if (stage !== 'blocked' && stage !== 'failed' && stage !== 'refused') {
    return null;
  }

  const known = errorCode ? byCode[errorCode] : undefined;
  if (known) {
    return known;
  }

  return stage === 'refused' ? { ...orderRefused, text: messageForCode(errorCode) } : pictureFailed;
}

/** "4 of 5 try-on pictures left today." */
export function leftToday(usage: Usage['visualizations']): string {
  const left = Math.max(0, usage.limit - usage.used);
  if (left === 0) {
    return 'You’ve used today’s try-on pictures. More tomorrow.';
  }

  return `${left} of ${usage.limit} ${plural(usage.limit, ['try-on picture', 'try-on pictures'])} left today.`;
}
