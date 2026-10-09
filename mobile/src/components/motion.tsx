import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  FadeOut,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion as useSystemReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { easing, feel, motion } from '@/theme';

/**
 * The one motion language of the app. Durations and curves come from the theme tokens, only opacity and transform
 * move, and "reduce motion" is read here and nowhere else: with it on, nothing travels or scales, things only fade.
 *
 * Primitives: `Fade` (appear, leave), `Peek` (a larger look that grows in), `CrossFade` (one thing becomes another), `ToggleFade` (a layer that is on or off),
 * `PressScale` (a pressable that gives under the finger) and `ProgressFill` (a bar that fills). `staggerOf` and
 * `useIntro` reveal the first items of a list one after another.
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
}

/** A Pressable that shrinks to 0.97 under the finger in `motion.press`. With reduced motion it only dims. */
export function PressScale({ style, onPressIn, onPressOut, children, ...rest }: PressScaleProps) {
  const reduced = useReducedMotion();
  const pressed = useSharedValue(0);
  const look = useAnimatedStyle(() => {
    const { scale, opacity } = pressLook(pressed.value, reduced);
    return { opacity, transform: [{ scale }] };
  });
  return (
    <AnimatedPressable
      {...rest}
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
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Content that arrives (and, with `exit`, leaves) with a fade. Give it a `key` that changes when the content changes meaning. */
export function Fade({ children, rise = 0, pop = false, duration = motion.enter, delay = 0, enter = true, exit = false, style, testID }: FadeProps) {
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
    <Animated.View testID={testID} style={[style, look]} exiting={exit ? fadeOut : undefined}>
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
}

/** A marker that slides along a rail: `translateX` to `x` over `motion.enter`, decelerating. Under reduced motion it jumps and only fades. */
export function Slide({ x, visible = true, style, children }: SlideProps) {
  const reduced = useReducedMotion();
  const position = useSharedValue(x);
  const shown = useSharedValue(visible ? 1 : 0);
  useEffect(() => {
    position.value = reduced ? x : withTiming(x, enterTiming(motion.enter));
    shown.value = withTiming(visible ? 1 : 0, visible ? enterTiming(motion.exit) : exitTiming(motion.exit));
  }, [x, visible, reduced, position, shown]);
  const look = useAnimatedStyle(() => ({ opacity: shown.value, transform: [{ translateX: position.value }] }));
  return (
    <Animated.View pointerEvents="none" style={[style, look]}>
      {children}
    </Animated.View>
  );
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

interface PulseProps {
  /** True only while real work is under way. When it turns false the pulse stops at full opacity. */
  active: boolean;
  children: ReactNode;
}

/** A functional loop: content that breathes in opacity while something is being worked on. It does not move, and with reduced motion it stays still. */
export function Pulse({ active, children }: PulseProps) {
  const reduced = useReducedMotion();
  const level = useSharedValue(1);
  useEffect(() => {
    if (active && !reduced) {
      level.value = withRepeat(withSequence(withTiming(feel.pulseOpacity, exitTiming(motion.sheet)), withTiming(1, enterTiming(motion.sheet))), -1);
    } else {
      cancelAnimation(level);
      level.value = 1;
    }

    return () => cancelAnimation(level);
  }, [active, reduced, level]);
  const look = useAnimatedStyle(() => ({ opacity: level.value }));
  return <Animated.View style={look}>{children}</Animated.View>;
}

interface ProgressFillProps {
  /** 0 to 1. */
  progress: number;
  style?: StyleProp<ViewStyle>;
}

/** The filled part of a bar. It is always full width and grows with `scaleX` from the left edge, so no layout is touched. */
export function ProgressFill({ progress, style }: ProgressFillProps) {
  const filled = useSharedValue(progress);
  useEffect(() => {
    filled.value = withTiming(progress, enterTiming(motion.enter));
  }, [progress, filled]);
  const look = useAnimatedStyle(() => ({ transform: [{ scaleX: filled.value }] }));
  return <Animated.View style={[styles.fill, style, look]} />;
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
});
