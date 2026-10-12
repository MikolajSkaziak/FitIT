import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { Platform } from 'react-native';

/**
 * The one place that talks to the phone's haptic motor. Each cue is named for what it means, so different things feel
 * different; the table is in `components/REDESIGN.md`. A cue is fire-and-forget: it is never awaited, never throws, and
 * does nothing on the web. The system setting governs whether the phone buzzes at all, so there is no switch for it here.
 */
function fire(cue: () => Promise<void>): void {
  if (Platform.OS === 'web') {
    return;
  }

  try {
    cue().catch(() => undefined);
  } catch {
    // A phone without a haptic motor, or a module that did not load, is not a reason to break what the person did.
  }
}

/** A discrete choice changed: a tile, a size, an option, a tab. */
export const select = (): void => fire(() => Haptics.selectionAsync());

/** A piece on the board was picked up. */
export const lift = (): void => fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));

/** The dragged piece has just crossed the board's boundary (once per crossing). */
export const edge = (): void => fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid));

/** A piece on the board was let go. */
export const drop = (): void => fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft));

/** The camera took a photo. */
export const shutter = (): void => fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));

/** The bookmark: saved is a light tap, taken off is a plain selection. */
export const keep = (on: boolean): void => fire(() => (on ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light) : Haptics.selectionAsync()));

/** Something meaningful completed: a day's outfit worn, an account created, a result arrived, the curtain opening. */
export const success = (): void => fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));

/** A limit was hit. */
export const warning = (): void => fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));

/** An action the person just took failed. */
export const error = (): void => fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));

/** A destructive action was confirmed. */
export const destroy = (): void => fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));

/** The board's arrange mode: `true` for going in and for Done, `false` for Reset. */
export const arrange = (on: boolean): void =>
  fire(() => Haptics.impactAsync(on ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light));

/** What a press is for, which sets how hard it taps: the heavier the action, the firmer the tap. */
export type PressKind = 'primary' | 'secondary' | 'icon' | 'quiet' | 'danger' | 'nav';

/** What a shared control does on a press: `auto` is what its kind implies, `none` is for a control whose own cue takes over, or one `PressKind` by name. */
export type Haptic = 'auto' | 'none' | PressKind;

const pressFeel: Record<PressKind, () => Promise<void>> = {
  primary: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
  secondary: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  icon: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  quiet: () => Haptics.selectionAsync(),
  danger: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid),
  nav: () => Haptics.selectionAsync(),
};

/**
 * The tap of a button, graded by the weight of what it does: primary Medium, secondary and round icon buttons Light,
 * text buttons, links and anything that opens something (rows, tiles, tabs) a selection tick, danger Rigid. One cue per
 * touch: a control whose own cue (select, keep, arrange, shutter) fires for the same touch asks for `none`.
 */
export const press = (kind: PressKind): void => fire(pressFeel[kind]);

/** How warm the person runs, felt in the hand: cold is a soft thud, average a plain tick, warm a firm tap. */
export const temperature = (level: 'cold' | 'normal' | 'warm'): void =>
  fire(() => (level === 'cold' ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft) : level === 'warm' ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid) : Haptics.selectionAsync()));

/** Gives the warning once, the moment `reached` turns true (or when the screen opens already in that state). */
export function useWarning(reached: boolean): void {
  useEffect(() => {
    if (reached) {
      warning();
    }
  }, [reached]);
}
