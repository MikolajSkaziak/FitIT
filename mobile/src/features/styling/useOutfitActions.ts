import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';

import { deleteOutfit, outfitKeys, updateOutfit, type Outfit, type OutfitChange, type Suggestions } from '@/api/outfits';
import { wardrobeKeys } from '@/api/wardrobe';

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
  return [...fromLists, ...fromProposals].find((outfit) => outfit.id === id);
}

interface Patch {
  id: string;
  change: OutfitChange;
}

/**
 * What a person does with an outfit: rate it, keep it, wear it, throw it away.
 * Rating and keeping show their result at once and go back if the server refuses; wearing waits for the server,
 * because it changes what the wardrobe says about how much of it is used.
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
        void queryClient.invalidateQueries({ queryKey: wardrobeKeys.stats });
        void queryClient.invalidateQueries({ queryKey: [...wardrobeKeys.all, 'list'] });
      }
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: outfitKeys.saved }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteOutfit(id),
    onSuccess: (_nothing, id) => {
      queryClient.removeQueries({ queryKey: outfitKeys.one(id) });
      void queryClient.invalidateQueries({ queryKey: outfitKeys.saved });
    },
  });

  return {
    rate: (outfit: Outfit, rating: Outfit['rating']) => update.mutate({ id: outfit.id, change: { rating: outfit.rating === rating ? 'none' : rating } }),
    keep: (outfit: Outfit) => update.mutate({ id: outfit.id, change: { saved: !outfit.isSaved } }),
    wear: (outfit: Outfit, onDone: () => void) => update.mutate({ id: outfit.id, change: { worn: true } }, { onSuccess: onDone }),
    remove: (outfit: Outfit, onDone: () => void) => remove.mutate(outfit.id, { onSuccess: onDone }),
    /** The last thing the server refused, if any. */
    error: update.error ?? remove.error,
    wearing: update.isPending && update.variables?.change.worn === true,
    removing: remove.isPending,
  };
}
