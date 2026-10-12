import { useEffect } from 'react';
import { create } from 'zustand';

/** How many things on the screen need the page to hold still right now: a board whose garments are being dragged about. */
const useLocks = create<{ held: number }>(() => ({ held: 0 }));

/** False while something on the page is being arranged by hand. Scroll views around such a thing pass it to `scrollEnabled`. */
export const useScrollable = (): boolean => useLocks((locks) => locks.held === 0);

/** Holds the scroll views still for as long as `active` is true, so a drag moves the thing under the finger and not the page. */
export function useScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) {
      return undefined;
    }

    useLocks.setState((locks) => ({ held: locks.held + 1 }));
    return () => useLocks.setState((locks) => ({ held: locks.held - 1 }));
  }, [active]);
}
