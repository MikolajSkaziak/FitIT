import { useEffect, useState, type RefObject } from 'react';
import { useInView, useReducedMotion } from 'motion/react';

/** The one curve of the page: a long, soft deceleration. */
export const EASE: [number, number, number, number] = [0.32, 0.72, 0, 1];
export const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

/**
 * Steps through `count` states on a timer while `ref` is on screen.
 * Stops for good once `hold` is true (the visitor took over) and never runs with reduced motion.
 */
export function useAutoStep(ref: RefObject<Element | null>, count: number, ms: number, hold = false) {
  const [index, setIndex] = useState(0);
  const inView = useInView(ref, { amount: 0.35 });
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!inView || reduced || hold) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % count), ms);
    return () => window.clearInterval(id);
  }, [inView, reduced, hold, count, ms]);

  return [index, setIndex] as const;
}

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}
