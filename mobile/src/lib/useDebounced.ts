import { useEffect, useState } from 'react';

/** The value as it was once it stopped changing for `delayMs`. Keeps a search from firing on every key press. */
export function useDebounced<T>(value: T, delayMs: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return settled;
}
