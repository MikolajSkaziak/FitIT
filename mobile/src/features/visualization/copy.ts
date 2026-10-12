import type { Usage } from '@/api/wardrobe';
import { messageForCode } from '@/copy/errors';
import { plural } from '@/lib/plural';

import type { OrderStage } from './order';

/** One name for this action everywhere in the app (.ux-profile.md). */
export const showAction = 'Try it on';

export const retryAction = 'Try again';

export const viewLabel = 'Outfit view';

/**
 * The ways to look at an outfit. "Board" is the garments laid out flat and "On figure" the same garments where they are
 * worn, over the person's silhouette: both instant and drawn on the phone. "Try-on" is the AI picture of the outfit on
 * the person's body shape.
 */
export const boardView = 'Board';

export const figureView = 'On figure';

export const tryOnView = 'Try-on';

/** Said under the picture, because the generator may miss a pattern or a logo (spec 7.6). */
export const pictureCaption = 'A generated preview. Fit and colors can differ a little from the real thing.';

export const pictureLabel = 'Outfit on your body shape';

export const enlargeAction = 'Enlarge picture';

export const closeEnlarged = 'Close picture';

/** Said under the picture while it is being made, and while the curtain is still closed. */
export const waitingCaption = 'This can take up to a minute. Feel free to leave. The picture will be waiting with your outfit.';

/** The words on the closed curtain of the fitting room: what the wait is called, and what is being done as it goes on. */
export const fittingRoom = {
  eyebrow: 'Fitting room',
  /** One for each stretch of the wait; the first is shown from the start. */
  stages: ['Getting your pieces ready', 'Dressing the mannequin', 'Almost there'],
  /** Names the bar for screen readers; the words above it carry the rest. */
  progressLabel: 'Try-on progress',
  /** Said once to screen readers when the curtain is about to open. */
  ready: 'Your try-on is ready',
} as const;

/** Where the stages change, as a share of the bar. */
const stageEdges = [0.35, 0.75] as const;

/** The line for the stretch of the wait the bar has reached. */
export function stageOf(progress: number): string {
  const index = stageEdges.filter((edge) => progress >= edge).length;
  return fittingRoom.stages[index] ?? fittingRoom.stages[0];
}

export interface Notice {
  title: string;
  text: string;
  /** Label of the way forward, or null when sending the same order again would end the same way. */
  action: string | null;
  /** The way forward is the consent sheet first, then the order again. */
  consent?: boolean;
}

const refunded = 'This one doesn’t count toward today’s limit.';

const consent: Notice = {
  title: 'We need your OK to use AI on your photos',
  text: 'AI services make these pictures, so we can’t send them your clothing photos until you allow it. You can change this any time in Profile.',
  action: 'Review and allow',
  consent: true,
};

const paused: Notice = {
  title: 'Try-on pictures are paused for today',
  text: `We’ve used up today’s budget for pictures. They’ll be back tomorrow.`,
  action: null,
};

/** The three cases of plan task 4.7, plus whatever else the server may answer with. */
const byCode: Record<string, Notice> = {
  content_blocked: {
    title: 'We couldn’t make a picture of this outfit',
    text: `The picture service’s safety filter didn’t accept these clothes, usually because of exposed skin. ${refunded}`,
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
    text: 'More tomorrow.',
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
