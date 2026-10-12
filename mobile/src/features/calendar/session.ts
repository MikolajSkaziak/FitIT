import { useRouter } from 'expo-router';
import { create } from 'zustand';

import type { CalendarEntry } from '@/api/calendar';
import type { Outfit } from '@/api/outfits';
import { isBefore, toIso, type CalendarDate } from '@/lib/dates';
import * as haptics from '@/lib/haptics';

import { useCalendarActions, useCanPlan } from './useCalendar';

/** Whoever opened the "Wear it when?" sheet is waiting here for the day. One sheet is open at a time. */
let waitingForDay: ((date: CalendarDate | null) => void) | null = null;

/** The sheet reports the day that was chosen; null also when it is swiped away. */
export function finishPickDay(date: CalendarDate | null): void {
  waitingForDay?.(date);
  waitingForDay = null;
}

/**
 * Asks which day an outfit is for: `const date = await pickDay(outfit.id)` opens the sheet and answers with the day, or
 * null when the person closed it. `outfitId` lets the sheet mark the days the outfit already stands on (null for an
 * outfit that is not stored yet); `preselected` is the day the person came from.
 */
export function usePickDay(): (outfitId: string | null, preselected?: string) => Promise<CalendarDate | null> {
  const router = useRouter();
  return (outfitId, preselected) => {
    finishPickDay(null);
    router.push({ pathname: '/plan', params: { ...(outfitId ? { outfit: outfitId } : null), ...(preselected ? { date: preselected } : null) } });
    return new Promise((resolve) => {
      waitingForDay = resolve;
    });
  };
}

/** Whoever opened the sheet of saved outfits is waiting here for the one that was picked. */
let waitingForOutfit: ((outfit: Outfit | null) => void) | null = null;

export function finishPickOutfit(outfit: Outfit | null): void {
  waitingForOutfit?.(outfit);
  waitingForOutfit = null;
}

/** Asks which saved outfit goes on a day: opens the sheet for that day and answers with the outfit, or null when it was closed. */
export function usePickOutfit(): (date: string) => Promise<Outfit | null> {
  const router = useRouter();
  return (date) => {
    finishPickOutfit(null);
    router.push({ pathname: '/pick-outfit', params: { date } });
    return new Promise((resolve) => {
      waitingForOutfit = resolve;
    });
  };
}

interface PlanNoticeState {
  /** The entry that was just planned, for the line that confirms it and can undo it. */
  planned: CalendarEntry | null;
  show: (entry: CalendarEntry) => void;
  clear: () => void;
}

/**
 * The plan that was just made. Kept outside the screens, because the screen that made it may not be the one that
 * confirms it: an outfit planned from the builder is confirmed on its own page.
 */
export const usePlanNotice = create<PlanNoticeState>((set) => ({
  planned: null,
  show: (planned) => set({ planned }),
  clear: () => set({ planned: null }),
}));

/**
 * Planning an outfit for a day from its own screen: `plan` saves at once (shown at once, taken back if the server
 * refuses) and leaves the confirmation line with its Undo; `choose` asks for the day first. A press, then `success()`
 * when the server has it. A refusal is in `error`.
 */
export function usePlanning() {
  const actions = useCalendarActions();
  const allowed = useCanPlan();
  const pickDay = usePickDay();
  const show = usePlanNotice((state) => state.show);
  const clear = usePlanNotice((state) => state.clear);

  const plan = async (outfit: Outfit, date: CalendarDate, today: CalendarDate): Promise<boolean> => {
    if (!allowed) {
      return false;
    }

    clear();
    const entry = await actions.add(outfit, toIso(date), isBefore(date, today));
    if (!entry) {
      return false;
    }

    haptics.success();
    show(entry);
    return true;
  };

  return {
    plan,
    /** Opens "Wear it when?" for the outfit and plans it for the day that is chosen. */
    choose: async (outfit: Outfit, today: CalendarDate, preselected?: string): Promise<boolean> => {
      const date = allowed ? await pickDay(outfit.id, preselected) : null;
      return date ? plan(outfit, date, today) : false;
    },
    /** Takes the plan that was just made off its day again. */
    undo: (entry: CalendarEntry) => {
      clear();
      return actions.remove(entry);
    },
    error: actions.error,
    planning: actions.adding,
  };
}
