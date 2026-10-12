import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';

import { calendarKeys, type Calendar } from '@/api/calendar';
import { deleteOutfit, outfitKeys, updateOutfit, type Outfit, type OutfitChange, type OutfitPlacement, type Suggestions } from '@/api/outfits';
import { wardrobeKeys } from '@/api/wardrobe';
import * as haptics from '@/lib/haptics';

/** An outfit is held in three kinds of answers: proposals, the saved list and one on its own. All of them are kept alike. */
function replaceOutfit(queryClient: QueryClient, id: string, change: (outfit: Outfit) => Outfit): void {
  const swap = (outfit: Outfit) => (outfit.id === id ? change(outfit) : outfit);
  queryClient.setQueriesData<Suggestions>({ queryKey: ['outfits', 'suggestions'] }, (answer) => (answer ? { ...answer, outfits: answer.outfits.map(swap) } : answer));
  queryClient.setQueriesData<Outfit[]>({ queryKey: outfitKeys.saved }, (list) => list?.map(swap));
  queryClient.setQueriesData<Outfit>({ queryKey: ['outfits', 'one'] }, (outfit) => (outfit ? swap(outfit) : outfit));
}

/** An outfit the phone already has, wherever it was seen first: lets its page open at once while the server confirms. */
export function findCachedOutfit(queryClient: QueryClient, id: string): Outfit | undefined {
  const fromLists = queryClient.getQueriesData<Outfit[]>({ queryKey: outfitKeys.saved }).flatMap(([, list]) => list ?? []);
  const fromProposals = queryClient.getQueriesData<Suggestions>({ queryKey: ['outfits', 'suggestions'] }).flatMap(([, answer]) => answer?.outfits ?? []);
  const fromCalendar = queryClient
    .getQueriesData<Calendar>({ queryKey: calendarKeys.ranges })
    .flatMap(([, calendar]) => calendar?.days.flatMap((day) => day.entries.map((entry) => entry.outfit)) ?? []);
  return [...fromLists, ...fromProposals, ...fromCalendar].find((outfit) => outfit.id === id);
}

interface Patch {
  id: string;
  change: OutfitChange;
}

/**
 * What a person does with an outfit: rate it, keep it, arrange its board, wear it, throw it away.
 * Rating, keeping and arranging show their result at once and go back if the server refuses; wearing waits for the server,
 * because it changes what the wardrobe says about how much of it is used. Keeping is felt at once, wearing when the server has taken it.
 * A refusal is felt by `queryClient`, which gives the cue for every action that fails.
 */
export function useOutfitActions() {
  const queryClient = useQueryClient();

  const update = useMutation({
    mutationFn: ({ id, change }: Patch) => updateOutfit(id, change),
    onMutate: async ({ id, change }) => {
      await queryClient.cancelQueries({ queryKey: outfitKeys.all });
      const before = queryClient.getQueriesData({ queryKey: outfitKeys.all });
      replaceOutfit(queryClient, id, (outfit) => ({
        ...outfit,
        isSaved: change.saved ?? outfit.isSaved,
        rating: change.rating ?? outfit.rating,
        // Left out, the board stays as it is; null goes back to the automatic layout.
        layout: change.layout === undefined ? outfit.layout : (change.layout as OutfitPlacement[] | null),
        figureLayout: change.figureLayout === undefined ? outfit.figureLayout : (change.figureLayout as OutfitPlacement[] | null),
      }));
      return before;
    },
    onError: (_error, _patch, before) => {
      for (const [key, data] of before ?? []) {
        queryClient.setQueryData(key, data);
      }
    },
    onSuccess: (outfit, { change }) => {
      replaceOutfit(queryClient, outfit.id, () => outfit);
      if (change.worn) {
        haptics.success();
        void queryClient.invalidateQueries({ queryKey: wardrobeKeys.stats });
        void queryClient.invalidateQueries({ queryKey: [...wardrobeKeys.all, 'list'] });
        // Wearing writes today into the calendar on the server: the week strip and the month ask again.
        void queryClient.invalidateQueries({ queryKey: calendarKeys.all });
      }
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: outfitKeys.saved }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteOutfit(id),
    onSuccess: (_nothing, id) => {
      queryClient.removeQueries({ queryKey: outfitKeys.one(id) });
      void queryClient.invalidateQueries({ queryKey: outfitKeys.saved });
      // A deleted outfit leaves every day it stood on.
      void queryClient.invalidateQueries({ queryKey: calendarKeys.all });
    },
  });

  return {
    keep: (outfit: Outfit) => {
      haptics.keep(!outfit.isSaved);
      update.mutate({ id: outfit.id, change: { saved: !outfit.isSaved } });
    },
    /**
     * Keeps the person's arrangement of the board, or with null goes back to the automatic one. Answers when the server
     * has taken it or refused it; a refusal is in `error`, like any other.
     */
    arrange: (outfit: Outfit, layout: OutfitPlacement[] | null): Promise<unknown> => update.mutateAsync({ id: outfit.id, change: { layout } }).catch(() => undefined),
    /** The same for the garments on the figure, which are arranged apart from the board. */
    arrangeFigure: (outfit: Outfit, figureLayout: OutfitPlacement[] | null): Promise<unknown> => update.mutateAsync({ id: outfit.id, change: { figureLayout } }).catch(() => undefined),
    wear: (outfit: Outfit, onDone: () => void) => update.mutate({ id: outfit.id, change: { worn: true } }, { onSuccess: onDone }),
    remove: (outfit: Outfit, onDone: () => void) => remove.mutate(outfit.id, { onSuccess: onDone }),
    /** The last thing the server refused, if any. */
    error: update.error ?? remove.error,
    wearing: update.isPending && update.variables?.change.worn === true,
    removing: remove.isPending,
  };
}
