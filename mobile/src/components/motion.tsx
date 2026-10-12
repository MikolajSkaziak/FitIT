import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { BottomTabNavigationOptions } from 'expo-router/js-tabs';
import { AccessibilityInfo, Easing as SceneEasing, Pressable, StyleSheet, useWindowDimensions, View, type PressableProps, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  FadeOut,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion as useSystemReducedMotion,
  useSharedValue,
  type SharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { press, type Haptic, type PressKind } from '@/lib/haptics';
import { easing, feel, motion, travel, type ColorToken, type TextVariant } from '@/theme';

import { AppText } from './AppText';

/**
 * The one motion language of the app. Durations and curves come from the theme tokens, only opacity and transform
 * move, and "reduce motion" is read here and nowhere else: with it on, nothing travels or scales, things only fade.
 *
 * Primitives: `Fade` (appear, leave), `Peek` (a larger look that grows in), `CrossFade` (one thing becomes another), `ToggleFade` (a layer that is on or off),
 * `PressScale` (a pressable that gives under the finger), `ProgressFill` (a bar that fills), `useEstimatedProgress` (how far a wait of unknown length has got) and `Curtain` (draws aside to show what is behind). `staggerOf` and
 * `useIntro` reveal the first items of a list one after another; `useSettle` is a number that glides to where it belongs.
 *
 * Kinetic details (`Shiver`, `Nudge`, `Spin`, `Sway`, `DropIn`, `DrawLine`, `Stretch`, `Letters`): a word or an icon briefly acts out what it says. Each plays once when
 * its `play` key changes to something truthy (and on mount, unless `skipFirst`), is over within `motion.reveal`, never loops, and does
 * nothing at all under reduced motion: the content is simply there. See "Kinetic details" in `REDESIGN.md`.
 */

type Duration = (typeof motion)[keyof typeof motion];

const enterEasing = Easing.bezier(...easing.enter);
const exitEasing = Easing.bezier(...easing.exit);

/**
 * Timing config for every animation. The system reduce-motion flag is switched off here on purpose: fades stay, and
 * the movement is taken out by `liftOf` and `pressLook` instead of by freezing the animation.
 */
const enterTiming = (duration: Duration) => ({ duration, easing: enterEasing, reduceMotion: ReduceMotion.Never });
const exitTiming = (duration: Duration) => ({ duration, easing: exitEasing, reduceMotion: ReduceMotion.Never });

/** Whether the person asked the system for less movement. */
export function useReducedMotion(): boolean {
  return useSystemReducedMotion();
}

/** Whether a scroll the app starts itself (to the next page) may animate. Under reduced motion it jumps. */
export function useAnimatedScroll(): boolean {
  return !useSystemReducedMotion();
}

/** Points a thing rises while it appears. None under reduced motion. */
export function liftOf(rise: number, reduced: boolean): number {
  'worklet';
  return reduced ? 0 : rise;
}

/** Scale and opacity of a pressed surface, `progress` going from 0 (at rest) to 1 (fully pressed). It never scales under reduced motion. */
export function pressLook(progress: number, reduced: boolean): { scale: number; opacity: number } {
  'worklet';
  return {
    scale: reduced ? 1 : 1 - (1 - feel.pressScale) * progress,
    opacity: 1 - (1 - feel.pressOpacity) * progress,
  };
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface PressScaleProps extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>;
  /**
   * The tap in the hand when the press lands (never on a disabled one). `auto` is a selection tick, and nothing for a
   * radio or tab that is already chosen; a shared control passes the kind that fits it; `none` is for a control whose
   * own cue (select, keep, arrange, shutter) fires for the same touch.
   */
  haptic?: Haptic;
}

/** The cue a press gives, or none: a radio or tab that is already the chosen one changes nothing. */
function cueOf(haptic: Haptic, role: PressableProps['accessibilityRole'], state: PressableProps['accessibilityState']): PressKind | null {
  if (haptic === 'none') {
    return null;
  }

  if (haptic !== 'auto') {
    return haptic;
  }

  return (role === 'radio' && state?.checked === true) || (role === 'tab' && state?.selected === true) ? null : 'nav';
}

/** A Pressable that shrinks to 0.97 under the finger in `motion.press`. With reduced motion it only dims. */
export function PressScale({ style, onPressIn, onPressOut, onPress, haptic = 'auto', children, ...rest }: PressScaleProps) {
  const reduced = useReducedMotion();
  const pressed = useSharedValue(0);
  const look = useAnimatedStyle(() => {
    const { scale, opacity } = pressLook(pressed.value, reduced);
    return { opacity, transform: [{ scale }] };
  });
  return (
    <AnimatedPressable
      {...rest}
      onPress={
        onPress
          ? (event) => {
              const cue = cueOf(haptic, rest.accessibilityRole, rest.accessibilityState);
              if (cue) {
                press(cue);
              }

              onPress(event);
            }
          : undefined
      }
      onPressIn={(event) => {
        pressed.set(withTiming(1, enterTiming(motion.press)));
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        pressed.set(withTiming(0, enterTiming(motion.press)));
        onPressOut?.(event);
      }}
      style={[style, look]}>
      {children}
    </AnimatedPressable>
  );
}

const fadeOut = FadeOut.duration(motion.exit).easing(exitEasing);

const leaveTiming = exitTiming(motion.exit);

/** A leave that fades to nothing while it shrinks to `feel.leaveScale`, over `motion.exit`, accelerating. */
const shrinkOut = () => {
  'worklet';
  return {
    initialValues: { opacity: 1, transform: [{ scale: 1 }] },
    animations: { opacity: withTiming(0, leaveTiming), transform: [{ scale: withTiming(feel.leaveScale, leaveTiming) }] },
  };
};

interface FadeProps {
  children: ReactNode;
  /** Points the content rises while it fades in. Under reduced motion it only fades. */
  rise?: number;
  /** Starts at 0.9 and settles at 1: for a check that confirms something. */
  pop?: boolean;
  duration?: typeof motion.exit | typeof motion.enter;
  /** Milliseconds before it starts. */
  delay?: number;
  /** Off: it is simply there. Use it for what should not animate this time (items past the first screenful). */
  enter?: boolean;
  /** Fades out, in `motion.exit`, when it leaves the screen instead of vanishing. */
  exit?: boolean;
  /** With `exit`: it also shrinks to `feel.leaveScale` on its way out (a tile that was removed). Under reduced motion it only fades. */
  shrink?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Content that arrives (and, with `exit`, leaves) with a fade. Give it a `key` that changes when the content changes meaning. */
export function Fade({ children, rise = 0, pop = false, duration = motion.enter, delay = 0, enter = true, exit = false, shrink = false, style, testID }: FadeProps) {
  const reduced = useReducedMotion();
  const progress = useSharedValue(enter ? 0 : 1);
  useEffect(() => {
    if (enter) {
      progress.value = withDelay(delay, withTiming(1, enterTiming(duration)));
    }
  }, [enter, delay, duration, progress]);

  const lift = liftOf(rise, reduced);
  const look = useAnimatedStyle(() => {
    const remaining = 1 - progress.value;
    return {
      opacity: progress.value,
      transform: pop && !reduced ? [{ translateY: remaining * lift }, { scale: 1 - (1 - feel.popScale) * remaining }] : [{ translateY: remaining * lift }],
    };
  });
  return (
    <Animated.View testID={testID} style={[style, look]} exiting={exit ? (shrink && !reduced ? shrinkOut : fadeOut) : undefined}>
      {children}
    </Animated.View>
  );
}

interface PeekProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * A look at something larger: it fades in over `motion.enter` while growing from `feel.peekScale` to full size, and fades out
 * over `motion.exit` when it leaves the tree. Under reduced motion it only fades. It never takes a touch.
 */
export function Peek({ children, style, testID }: PeekProps) {
  const reduced = useReducedMotion();
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(1, enterTiming(motion.enter));
  }, [progress]);

  const look = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: reduced ? 1 : feel.peekScale + (1 - feel.peekScale) * progress.value }],
  }));
  return (
    <Animated.View pointerEvents="none" testID={testID} style={[style, look]} exiting={fadeOut}>
      {children}
    </Animated.View>
  );
}

type SwitchDuration = typeof motion.press | typeof motion.exit | typeof motion.enter;

/**
 * A value that follows a flag: 0 when off, 1 when on. Without a `duration` it is a selection: turning on is at once, on
 * the frame the finger lifts (a chosen option that fades in reads as lag), and only turning off eases away, over
 * `motion.press`. With a `duration` both directions are eased over it.
 */
function useSwitch(on: boolean, duration?: SwitchDuration) {
  const progress = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    if (duration === undefined) {
      progress.value = on ? 1 : withTiming(0, exitTiming(motion.press));
      return;
    }

    progress.value = withTiming(on ? 1 : 0, on ? enterTiming(duration) : exitTiming(duration));
  }, [on, duration, progress]);
  return progress;
}

interface ToggleFadeProps {
  on: boolean;
  children?: ReactNode;
  /** Leave out for a selection (on at once, off over `motion.press`); give it for a layer that eases both ways. */
  duration?: SwitchDuration;
  style?: StyleProp<ViewStyle>;
}

/** A layer that shows at once when `on` turns true and fades out when it turns false. It keeps its place either way, so nothing shifts. */
export function ToggleFade({ on, children, duration, style }: ToggleFadeProps) {
  const progress = useSwitch(on, duration);
  const look = useAnimatedStyle(() => ({ opacity: progress.value }));
  return (
    <Animated.View pointerEvents="none" style={[style, look]}>
      {children}
    </Animated.View>
  );
}

interface StepBackProps {
  /** The chosen one: fully there. The others step back to `feel.restOpacity`. */
  on: boolean;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** One of several cards side by side: at full strength the moment it is chosen, stepping back over `motion.press` when it no longer is. */
export function StepBack({ on, children, style }: StepBackProps) {
  const progress = useSwitch(on);
  const look = useAnimatedStyle(() => ({ opacity: feel.restOpacity + (1 - feel.restOpacity) * progress.value }));
  return <Animated.View style={[style, look]}>{children}</Animated.View>;
}

interface SlideProps {
  /** Points from the left edge of the frame the thing sits in. */
  x: number;
  /** Fades in and out in `motion.exit`; the travel itself stays opacity-free. */
  visible?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  testID?: string;
}

/** A marker that slides along a rail: `translateX` to `x` over `motion.enter`, decelerating. Under reduced motion it jumps and only fades. */
export function Slide({ x, visible = true, style, children, testID }: SlideProps) {
  const reduced = useReducedMotion();
  const position = useSharedValue(x);
  const shown = useSharedValue(visible ? 1 : 0);
  useEffect(() => {
    position.value = reduced ? x : withTiming(x, enterTiming(motion.enter));
    shown.value = withTiming(visible ? 1 : 0, visible ? enterTiming(motion.exit) : exitTiming(motion.exit));
  }, [x, visible, reduced, position, shown]);
  const look = useAnimatedStyle(() => ({ opacity: shown.value, transform: [{ translateX: position.value }] }));
  return (
    <Animated.View pointerEvents="none" testID={testID} style={[style, look]}>
      {children}
    </Animated.View>
  );
}

/**
 * A number that follows `to`, for a transform: at once, or with `glide` over `motion.enter`, decelerating (things laid
 * out afresh settling into their places). Under reduced motion it always jumps.
 */
export function useSettle(to: number, glide: boolean): SharedValue<number> {
  const reduced = useReducedMotion();
  const value = useSharedValue(to);
  useEffect(() => {
    value.value = glide && !reduced ? withTiming(to, enterTiming(motion.enter)) : to;
  }, [to, glide, reduced, value]);
  return value;
}

/** How much larger than its resting size a piece held in a finger is drawn, `lifted` going from 0 (resting) to 1 (fully lifted). */
export function heldScale(lifted: number): number {
  'worklet';
  return 1 + (feel.liftScale - 1) * lifted;
}

/**
 * What a piece that a finger moves about needs. It lifts (`lifted`, 0 to 1, drawn with `heldScale`) over `motion.press` when
 * `hold` is called and settles back over `motion.press` on `release`. While it is dragged past a limit it follows the finger
 * by `pull` points (`pullX`, `pullY`), and on `release` glides back to 0 over `motion.enter`, decelerating. Under reduced
 * motion it neither lifts nor leaves 0 (`reduced` says so, for whoever works out how far to pull). `hold`, `pull` and `release` can be called from a gesture on the UI thread.
 */
export function useHeld() {
  const reduced = useReducedMotion();
  const lifted = useSharedValue(0);
  const pullX = useSharedValue(0);
  const pullY = useSharedValue(0);
  const raise = enterTiming(motion.press);
  const glide = enterTiming(motion.enter);

  const hold = () => {
    'worklet';
    if (!reduced) {
      lifted.value = withTiming(1, raise);
    }
  };
  const pull = (x: number, y: number) => {
    'worklet';
    pullX.value = x;
    pullY.value = y;
  };
  const release = () => {
    'worklet';
    if (!reduced) {
      lifted.value = withTiming(0, raise);
      pullX.value = withTiming(0, glide);
      pullY.value = withTiming(0, glide);
    }
  };
  return { reduced, lifted, pullX, pullY, hold, pull, release };
}

interface CrossFadeProps {
  on: boolean;
  /** Renders the content as it looks off and as it looks on. Both are drawn, one over the other, so colours blend by opacity alone. */
  children: (on: boolean) => ReactNode;
  /** Leave out for a selection (on at once, off over `motion.press`); give it for a look that eases both ways. */
  duration?: SwitchDuration;
  /** The frame the two looks share. */
  style?: StyleProp<ViewStyle>;
  /** Applied to each look. */
  faceStyle?: StyleProp<ViewStyle>;
}

/** One thing that has two looks (selected or not, active or not): the chosen look appears at once, the lost one fades out, and the size is the same in both. */
export function CrossFade({ on, children, duration, style, faceStyle }: CrossFadeProps) {
  const progress = useSwitch(on, duration);
  const off = useAnimatedStyle(() => ({ opacity: 1 - progress.value }));
  const lit = useAnimatedStyle(() => ({ opacity: progress.value }));
  return (
    <View style={style}>
      <Animated.View style={[faceStyle, off]}>{children(false)}</Animated.View>
      <Animated.View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[StyleSheet.absoluteFill, faceStyle, lit]}>
        {children(true)}
      </Animated.View>
    </View>
  );
}

interface TurnProps {
  /** Turned by `degrees` while true, upright while false. */
  on: boolean;
  degrees?: number;
  children: ReactNode;
}

/** Content that rotates to `degrees` over `motion.enter` and back over `motion.exit` (a plus that becomes a close mark). Under reduced motion it jumps. */
export function Turn({ on, degrees = 45, children }: TurnProps) {
  const reduced = useReducedMotion();
  const progress = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    const target = on ? 1 : 0;
    progress.value = reduced ? target : withTiming(target, on ? enterTiming(motion.enter) : exitTiming(motion.exit));
  }, [on, reduced, progress]);
  const look = useAnimatedStyle(() => ({ transform: [{ rotate: `${progress.value * degrees}deg` }] }));
  return <Animated.View style={look}>{children}</Animated.View>;
}

/** What sets a kinetic detail off: it plays when the key changes to anything but `false`, `null`, `undefined`, `0` or `''`. */
export type PlayKey = string | number | boolean | null | undefined;

/**
 * How many times the key has asked for a play so far. A mount counts when the key is already truthy and `skipFirst` is off. It is
 * worked out while rendering, so a component that animates from a hidden start can be drawn hidden on its very first frame.
 */
function useCue(play: PlayKey, skipFirst: boolean): number {
  const [state, setState] = useState(() => ({ seen: play, count: play && !skipFirst ? 1 : 0 }));
  if (state.seen !== play) {
    setState({ seen: play, count: play ? state.count + 1 : state.count });
  }

  return state.count;
}

/** Runs `act` once for each new cue (not for a re-render, nor for the second run of an effect in development), and never under reduced motion. */
function useOnCue(cue: number, reduced: boolean, act: () => void): void {
  const played = useRef(0);
  const latest = useRef(act);
  useEffect(() => {
    latest.current = act;
  });
  useEffect(() => {
    if (cue > played.current && !reduced) {
      played.current = cue;
      latest.current();
    }
  }, [cue, reduced]);
}

interface KineticProps {
  /** Plays when this changes to a truthy key. Leave out for "once, when it appears". */
  play?: PlayKey;
  /** Does not play for the key it has when it first appears: only for a change after that. */
  skipFirst?: boolean;
  /** Milliseconds before it starts (a title word waits for the screen to arrive). */
  delay?: number;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  testID?: string;
}

/** One step of a shiver: half of `motion.press`, the shortest beat the profile has. */
const tickTiming = { duration: motion.press / 2, easing: enterEasing, reduceMotion: ReduceMotion.Never };

/** How far, in points, a shiver pushes the word to either side. */
const shiverReach = 1.5;

/**
 * A word that shivers with cold: five quick steps (+1.5, -1.5, +1.5, -1.5, 0 points sideways, half of `motion.press` each, 250ms in all),
 * settling at 0. Only `translateX` moves, so the word keeps its box.
 */
export function Shiver({ play = true, skipFirst = false, delay = 0, style, children, testID }: KineticProps) {
  const reduced = useReducedMotion();
  const cue = useCue(play, skipFirst);
  const offset = useSharedValue(0);
  useOnCue(cue, reduced, () => {
    offset.value = withDelay(
      delay,
      withSequence(
        withTiming(shiverReach, tickTiming),
        withTiming(-shiverReach, tickTiming),
        withTiming(shiverReach, tickTiming),
        withTiming(-shiverReach, tickTiming),
        withTiming(0, tickTiming),
      ),
    );
  });
  const look = useAnimatedStyle(() => ({ transform: [{ translateX: offset.value }] }));
  return (
    <Animated.View testID={testID} style={[style, look]}>
      {children}
    </Animated.View>
  );
}

interface NudgeProps extends KineticProps {
  /** Points it moves vertically and comes back from: negative lifts, positive dips. */
  dy: number;
  /** The opacity it dips to at the far end of the move (a heat haze). Full strength when left out. */
  dimTo?: number;
}

/**
 * A move out and back: `dy` points up or down and home again, in two steps of `motion.exit` (`motion.sheet` in all), decelerating,
 * with the opacity dipping to `dimTo` at the far end if asked. A word that warms up, a thermometer that lifts, a raindrop that falls.
 */
export function Nudge({ dy, dimTo = 1, play = true, skipFirst = false, delay = 0, style, children, testID }: NudgeProps) {
  const reduced = useReducedMotion();
  const cue = useCue(play, skipFirst);
  const reach = useSharedValue(0);
  useOnCue(cue, reduced, () => {
    reach.value = withDelay(delay, withSequence(withTiming(1, enterTiming(motion.exit)), withTiming(0, enterTiming(motion.exit))));
  });
  const look = useAnimatedStyle(() => ({ opacity: 1 - (1 - dimTo) * reach.value, transform: [{ translateY: reach.value * dy }] }));
  return (
    <Animated.View testID={testID} style={[style, look]}>
      {children}
    </Animated.View>
  );
}

interface SpinProps extends KineticProps {
  /** A turn after which the content looks the same as before (60 for a snowflake, 45 for a sun). */
  degrees: number;
}

/**
 * Content that turns by `degrees` over `motion.enter`, decelerating, and is upright again at the end. It is meant for a shape that
 * looks the same after that turn, so the finish is not a jump: the angle simply reads 0 once the turn is complete.
 */
export function Spin({ degrees, play = true, skipFirst = false, style, children, testID }: SpinProps) {
  const reduced = useReducedMotion();
  const cue = useCue(play, skipFirst);
  const turned = useSharedValue(0);
  useOnCue(cue, reduced, () => {
    turned.value = 0;
    turned.value = withTiming(1, enterTiming(motion.enter));
  });
  const look = useAnimatedStyle(() => ({ transform: [{ rotate: `${turned.value >= 1 ? 0 : turned.value * degrees}deg` }] }));
  return (
    <Animated.View testID={testID} style={[style, look]}>
      {children}
    </Animated.View>
  );
}

/** Where a sway begins, in degrees. It then passes through +4 and -2 on its way to 0. */
const swayFrom = -6;

interface SwayProps extends KineticProps {
  /** A smaller swing for one word of a title: upright, then -3, +2 and 0 degrees (wound up over `motion.press`, then two steps of `motion.exit`, 400ms in all), never drawn tilted before its turn. */
  soft?: boolean;
}

/**
 * Something that hangs from its top edge and swings like a hanger on a rail: from -6 degrees to +4, -2 and 0, around its top centre,
 * in three steps of `motion.exit` (450ms), decelerating. It is drawn at -6 from its first frame.
 */
export function Sway({ soft = false, play = true, skipFirst = false, delay = 0, style, children, testID }: SwayProps) {
  const reduced = useReducedMotion();
  const cue = useCue(play, skipFirst);
  const angle = useSharedValue(cue > 0 && !reduced && !soft ? swayFrom : 0);
  useOnCue(cue, reduced, () => {
    if (soft) {
      angle.value = withDelay(delay, withSequence(withTiming(-3, enterTiming(motion.press)), withTiming(2, enterTiming(motion.exit)), withTiming(0, enterTiming(motion.exit))));
      return;
    }

    angle.value = swayFrom;
    angle.value = withDelay(delay, withSequence(withTiming(4, enterTiming(motion.exit)), withTiming(-2, enterTiming(motion.exit)), withTiming(0, enterTiming(motion.exit))));
  });
  const look = useAnimatedStyle(() => ({ transform: [{ rotate: `${angle.value}deg` }] }));
  return (
    <Animated.View testID={testID} style={[styles.hanging, style, look]}>
      {children}
    </Animated.View>
  );
}

/** How much wider than its resting width a stretched word gets at the far end. */
const stretchTo = 1.06;

/**
 * A word that stretches a little and comes back: `scaleX` from 1 to 1.06 and home again in two steps of `motion.exit`
 * (`motion.sheet` in all), decelerating, around its left edge, so the line it sits in keeps its layout.
 */
export function Stretch({ play = true, skipFirst = false, delay = 0, style, children, testID }: KineticProps) {
  const reduced = useReducedMotion();
  const cue = useCue(play, skipFirst);
  const reach = useSharedValue(0);
  useOnCue(cue, reduced, () => {
    reach.value = withDelay(delay, withSequence(withTiming(1, enterTiming(motion.exit)), withTiming(0, enterTiming(motion.exit))));
  });
  const look = useAnimatedStyle(() => ({ transform: [{ scaleX: 1 + (stretchTo - 1) * reach.value }] }));
  return (
    <Animated.View testID={testID} style={[styles.drawn, style, look]}>
      {children}
    </Animated.View>
  );
}

/** Milliseconds between one letter of a word starting to appear and the next: half of `motion.press`, less when the word is long enough to run past `motion.reveal`. */
export function letterStep(count: number): number {
  return count > 1 ? Math.min(motion.press / 2, (motion.reveal - motion.exit) / (count - 1)) : 0;
}

interface LettersProps {
  text: string;
  variant: TextVariant;
  color?: ColorToken;
  /** Milliseconds before the first letter starts. */
  delay?: number;
  /** Applied to every letter (the line height that keeps the word level with the words around it). */
  letterStyle?: StyleProp<TextStyle>;
  testID?: string;
}

/**
 * A word whose letters fade in one after another, each its own `AppText` in a row (the word's box is the same either way): a new letter every
 * `letterStep` over `motion.exit`, so the whole word is there within `motion.reveal`. Letters wait invisible until their turn. Under
 * reduced motion the word is simply there.
 */
export function Letters({ text, variant, color, delay = 0, letterStyle, testID }: LettersProps) {
  const reduced = useReducedMotion();
  const letters = Array.from(text);
  const step = letterStep(letters.length);
  return (
    <View style={styles.letters} testID={testID}>
      {letters.map((letter, index) => (
        <Fade key={index} enter={!reduced} delay={delay + index * step} duration={motion.exit}>
          <AppText variant={variant} color={color} style={letterStyle}>
            {letter}
          </AppText>
        </Fade>
      ))}
    </View>
  );
}

type ArrivalProps = KineticProps;

/**
 * Content that is absent until its turn and then drops into place from `travel.rise` points above while it fades in, over
 * `motion.enter`, decelerating, after `delay`: the full stop at the end of a word. Under reduced motion it is simply there.
 */
export function DropIn({ delay = 0, play = true, skipFirst = false, style, children, testID }: ArrivalProps) {
  const reduced = useReducedMotion();
  const cue = useCue(play, skipFirst);
  const arrived = useSharedValue(cue > 0 && !reduced ? 0 : 1);
  useOnCue(cue, reduced, () => {
    arrived.value = 0;
    arrived.value = withDelay(delay, withTiming(1, enterTiming(motion.enter)));
  });
  const look = useAnimatedStyle(() => ({ opacity: arrived.value, transform: [{ translateY: (arrived.value - 1) * travel.rise }] }));
  return (
    <Animated.View testID={testID} style={[style, look]}>
      {children}
    </Animated.View>
  );
}

/**
 * A line that draws itself from its left edge: `scaleX` from 0 to 1 over `motion.sheet`, decelerating, after `delay`, and then it stays.
 * It is a full-width layer (give it its height, colour and place in `style`), so the layout never changes. Under reduced motion it is simply there.
 */
export function DrawLine({ delay = 0, play = true, skipFirst = false, style, testID }: Omit<ArrivalProps, 'children'>) {
  const reduced = useReducedMotion();
  const cue = useCue(play, skipFirst);
  const drawn = useSharedValue(cue > 0 && !reduced ? 0 : 1);
  useOnCue(cue, reduced, () => {
    drawn.value = 0;
    drawn.value = withDelay(delay, withTiming(1, enterTiming(motion.sheet)));
  });
  const look = useAnimatedStyle(() => ({ transform: [{ scaleX: drawn.value }] }));
  return <Animated.View pointerEvents="none" testID={testID} style={[styles.drawn, style, look]} />;
}

interface ShimmerProps {
  /** The colour of the light; the placeholder underneath keeps its own. */
  color: string;
}

/**
 * A functional loop: a soft band of light that crosses a loading placeholder from left to right, again and again, the way
 * a page that is still arriving is usually shown. It fills its parent (which clips it) and only translates. Under reduced
 * motion there is no band: the placeholder stays still.
 */
export function Shimmer({ color }: ShimmerProps) {
  const reduced = useReducedMotion();
  const [width, setWidth] = useState(0);
  const across = useSharedValue(0);
  useEffect(() => {
    if (reduced || width === 0) {
      return undefined;
    }

    across.value = 0;
    // Not reversed: each pass starts again from the left, and the time the band spends off both edges is the pause between passes.
    across.value = withRepeat(withTiming(1, { duration: motion.sweep, easing: Easing.linear, reduceMotion: ReduceMotion.Never }), -1, false);
    return () => cancelAnimation(across);
  }, [reduced, width, across]);
  // The band is as wide as the placeholder, so it starts fully off its left edge and ends fully off its right one.
  const look = useAnimatedStyle(() => ({ transform: [{ translateX: -width + across.value * 2 * width }] }));
  return (
    <View pointerEvents="none" onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={StyleSheet.absoluteFill} testID="shimmer">
      {reduced || width === 0 ? null : (
        <Animated.View style={[StyleSheet.absoluteFill, look]}>
          <Svg width="100%" height="100%">
            <Defs>
              <LinearGradient id="shine" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor={color} stopOpacity={0} />
                <Stop offset="0.5" stopColor={color} stopOpacity={1} />
                <Stop offset="1" stopColor={color} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#shine)" />
          </Svg>
        </Animated.View>
      )}
    </View>
  );
}

interface PulseProps {
  /** True only while real work is under way. When it turns false the pulse stops at full opacity. */
  active: boolean;
  /** The lowest opacity of the breath. A whole picture breathes less than a small marker does. */
  depth?: number;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}

/** A functional loop: content that breathes in opacity while something is being worked on. It does not move, and with reduced motion it stays still. */
export function Pulse({ active, depth = feel.pulseOpacity, style, children }: PulseProps) {
  const reduced = useReducedMotion();
  const level = useSharedValue(1);
  useEffect(() => {
    if (active && !reduced) {
      level.value = withRepeat(withSequence(withTiming(depth, exitTiming(motion.sheet)), withTiming(1, enterTiming(motion.sheet))), -1);
    } else {
      cancelAnimation(level);
      level.value = 1;
    }

    return () => cancelAnimation(level);
  }, [active, reduced, depth, level]);
  const look = useAnimatedStyle(() => ({ opacity: level.value }));
  return <Animated.View style={[style, look]}>{children}</Animated.View>;
}

interface FlashProps {
  /** Each time this number changes the layer blinks. It does not blink when it first appears. */
  count: number;
  style?: StyleProp<ViewStyle>;
}

/** A layer that lights up over `motion.press` and fades away over `motion.enter` when something was just captured. Under reduced motion it stays dark. */
export function Flash({ count, style }: FlashProps) {
  const reduced = useReducedMotion();
  const level = useSharedValue(0);
  const last = useRef(count);
  useEffect(() => {
    if (last.current === count) {
      return;
    }

    last.current = count;
    if (!reduced) {
      level.value = withSequence(withTiming(feel.flashOpacity, enterTiming(motion.press)), withTiming(0, exitTiming(motion.enter)));
    }
  }, [count, reduced, level]);
  const look = useAnimatedStyle(() => ({ opacity: level.value }));
  return <Animated.View pointerEvents="none" style={[style, look]} />;
}

/**
 * Says a sentence to a screen reader when what happened shows only as a picture or a blink ("Photo 3 taken").
 * It lives here because this is the one module that talks to the system's accessibility service.
 */
export function announce(message: string): void {
  AccessibilityInfo.announceForAccessibility(message);
}

interface ProgressFillProps {
  /** 0 to 1. */
  progress: number;
  /** Where the fill starts when the bar first appears; it then grows (or shrinks) to `progress`. Under reduced motion it is simply at `progress`. */
  from?: number;
  /** Milliseconds before that first move starts. */
  delay?: number;
  duration?: typeof motion.enter | typeof motion.sheet;
  style?: StyleProp<ViewStyle>;
}

/** The filled part of a bar. It is always full width and grows with `scaleX` from the left edge, so no layout is touched. */
export function ProgressFill({ progress, from, delay = 0, duration = motion.enter, style }: ProgressFillProps) {
  const reduced = useReducedMotion();
  const jump = reduced && from !== undefined;
  const filled = useSharedValue(jump ? progress : (from ?? progress));
  const begun = useRef(false);
  useEffect(() => {
    if (jump) {
      filled.value = progress;
      return;
    }

    // The wait before the first move is for the bar's arrival; a later change goes at once.
    const wait = begun.current ? 0 : delay;
    begun.current = true;
    filled.value = withDelay(wait, withTiming(progress, enterTiming(duration)));
  }, [progress, jump, delay, duration, filled]);
  const look = useAnimatedStyle(() => ({ transform: [{ scaleX: filled.value }] }));
  return <Animated.View style={[styles.fill, style, look]} />;
}

/** The most a bar claims while the work is still going: it only reaches the end when the work has. */
export const progressCeiling = 0.9;

/** A sliver from the first moment, so the bar is seen to have started. */
const progressStart = 0.04;

/** How quickly the curve closes in on the ceiling: after `typicalMs` it has covered 1 - e^-3, about 95% of the way. */
const progressRate = 3;

/**
 * How far a wait of unknown length has probably got, from how long it has run against how long it usually takes. It
 * decelerates, so it keeps creeping when the wait runs long instead of reaching the end, and never passes `progressCeiling`.
 */
export function estimateOf(elapsedMs: number, typicalMs: number): number {
  const spent = 1 - Math.exp((-progressRate * Math.max(0, elapsedMs)) / typicalMs);
  return Math.min(progressCeiling, progressStart + (progressCeiling - progressStart) * spent);
}

/** `running` estimates, `done` runs to the end, `stopped` holds still (the work failed or was refused). */
export type Wait = 'running' | 'done' | 'stopped';

/**
 * Progress of work whose length is unknown. While `running` it follows `estimateOf` and never moves backwards; when it
 * turns `done` it goes to 1 and `complete` becomes true once the bar has had `motion.enter` to get there; `stopped` keeps
 * the value where it was. Running again after either starts over from the beginning.
 */
export function useEstimatedProgress(wait: Wait, typicalMs: number): { progress: number; complete: boolean } {
  const [progress, setProgress] = useState(wait === 'done' ? 1 : wait === 'running' ? progressStart : 0);
  const [complete, setComplete] = useState(wait === 'done');
  const [last, setLast] = useState(wait);
  if (last !== wait) {
    setLast(wait);
    if (wait === 'running') {
      setProgress(progressStart);
      setComplete(false);
    } else if (wait === 'done') {
      setProgress(1);
    }
  }

  useEffect(() => {
    if (wait !== 'running') {
      return undefined;
    }

    const began = Date.now();
    const timer = setInterval(() => setProgress((now) => Math.max(now, estimateOf(Date.now() - began, typicalMs))), motion.sheet);
    return () => clearInterval(timer);
  }, [wait, typicalMs]);

  useEffect(() => {
    if (wait !== 'done' || complete) {
      return undefined;
    }

    const timer = setTimeout(() => setComplete(true), motion.enter);
    return () => clearTimeout(timer);
  }, [wait, complete]);

  return { progress, complete };
}

interface CurtainProps {
  /**
   * `closed` hangs shut; `opening` draws aside (and the picture behind settles to full strength); `open` is drawn already:
   * nothing of the curtain is left, and the picture is as it is.
   */
  phase: 'closed' | 'opening' | 'open';
  /** Width of the frame the two halves fill. */
  width: number;
  left: ReactNode;
  right: ReactNode;
  /** Closed and working: the curtain breathes, as the one sign that something is going on. Never under reduced motion. */
  breathe?: boolean;
  /** What is behind the curtain. */
  children?: ReactNode;
  testID?: string;
}

/**
 * Two halves of a curtain over a picture. Opening, they slide apart to the sides over `motion.reveal`, decelerating, while the
 * picture rises from `feel.unveilOpacity` to full. Under reduced motion nothing slides: the curtain fades out over
 * `motion.enter`. The caller fills the frame with it and takes it out of the tree when `phase` has reached `open`.
 */
export function Curtain({ phase, width, left, right, breathe = false, children, testID }: CurtainProps) {
  const reduced = useReducedMotion();
  const drawn = useSharedValue(phase === 'open' ? 1 : 0);
  useEffect(() => {
    if (phase === 'opening') {
      drawn.value = withTiming(1, enterTiming(reduced ? motion.enter : motion.reveal));
    } else {
      drawn.value = phase === 'open' ? 1 : 0;
    }
  }, [phase, reduced, drawn]);

  const half = Math.round(width / 2);
  const behind = useAnimatedStyle(() => ({ opacity: feel.unveilOpacity + (1 - feel.unveilOpacity) * drawn.value }));
  const leftLook = useAnimatedStyle(() => ({ opacity: reduced ? 1 - drawn.value : 1, transform: [{ translateX: reduced ? 0 : -drawn.value * half }] }));
  const rightLook = useAnimatedStyle(() => ({ opacity: reduced ? 1 - drawn.value : 1, transform: [{ translateX: reduced ? 0 : drawn.value * half }] }));

  return (
    <View style={styles.curtainFrame}>
      <Animated.View style={[StyleSheet.absoluteFill, behind]}>{children}</Animated.View>
      {phase === 'open' ? null : (
        <Pulse active={breathe && phase === 'closed'} depth={feel.breathOpacity} style={StyleSheet.absoluteFill}>
          <View
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={StyleSheet.absoluteFill}
            testID={testID}>
            <Animated.View style={[styles.curtainLeft, { width: half }, leftLook]}>{left}</Animated.View>
            <Animated.View style={[styles.curtainRight, { width: width - half }, rightLook]}>{right}</Animated.View>
          </View>
        </Pulse>
      )}
    </View>
  );
}

/** The items of a list that are revealed one after another, and how long apart. Later items are simply there. */
export const stagger = { limit: 8, step: motion.press / 2 } as const;

/** Props for the `Fade` around item `index`: the first few start in turn, the rest do not animate. */
export function staggerOf(index: number, intro: boolean): { enter: boolean; delay: number } {
  return { enter: intro && index < stagger.limit, delay: Math.min(index, stagger.limit) * stagger.step };
}

/** How long the reveal of a list can take: the last of the staggered items has arrived by then. */
const introSpan = stagger.limit * stagger.step + motion.enter;

/**
 * True for the moment a list is first shown with its data, and for as long as its first items take to arrive. After
 * that it is false for good, so items scrolled into view later, or after a refetch, appear without animation.
 */
export function useIntro(ready: boolean): boolean {
  const [phase, setPhase] = useState<'waiting' | 'playing' | 'done'>('waiting');
  if (ready && phase === 'waiting') {
    setPhase('playing');
  }

  useEffect(() => {
    if (phase !== 'playing') {
      return undefined;
    }

    const timer = setTimeout(() => setPhase('done'), introSpan);
    return () => clearTimeout(timer);
  }, [phase]);

  return phase === 'playing';
}

/** True once `value` is no longer what it was on the first render: it tells a change from a first appearance. */
export function useChanged(value: unknown): boolean {
  const [first] = useState(value);
  return first !== value;
}

const styles = StyleSheet.create({
  fill: { width: '100%', height: '100%', transformOrigin: 'left center' },
  hanging: { transformOrigin: '50% 0%' },
  letters: { flexDirection: 'row' },
  drawn: { transformOrigin: 'left center' },
  curtainFrame: { flex: 1, overflow: 'hidden' },
  curtainLeft: { position: 'absolute', top: 0, bottom: 0, left: 0 },
  curtainRight: { position: 'absolute', top: 0, bottom: 0, right: 0 },
});

/**
 * How one tab gives way to the next: the pages lie side by side in the order of the bar and the row slides across,
 * as if scrolled. The navigator drives it, so it is described here in its terms; under reduced motion the page just changes.
 */
export function useTabSlide(): Pick<BottomTabNavigationOptions, 'animation' | 'sceneStyleInterpolator' | 'transitionSpec'> {
  const reduced = useReducedMotion();
  const { width } = useWindowDimensions();
  if (reduced) {
    return { animation: 'none' };
  }

  return {
    animation: 'shift',
    transitionSpec: { animation: 'timing', config: { duration: motion.sheet, easing: SceneEasing.bezier(...easing.enter) } },
    sceneStyleInterpolator: ({ current }) => ({
      sceneStyle: { transform: [{ translateX: current.progress.interpolate({ inputRange: [-1, 0, 1], outputRange: [-width, 0, width] }) }] },
    }),
  };
}
