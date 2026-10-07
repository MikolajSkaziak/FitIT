import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { useEffect, useMemo } from 'react';

import { outfitKeys, type Outfit, type Suggestions } from '@/api/outfits';
import {
  fetchVisualization,
  isFinal,
  requestVisualization,
  visualizationOf,
  type OutfitVisualization,
  type Visualization,
} from '@/api/visualizations';
import { fetchUsage, wardrobeKeys } from '@/api/wardrobe';

import { leftToday, noticeFor } from './copy';
import { createVisualizationOrder, useOrder } from './order';

/** Keeps the order with its outfit wherever the phone holds a copy of it, so leaving the screen and coming back finds it again. */
function attachVisualization(queryClient: QueryClient, record: Visualization): void {
  const summary: OutfitVisualization = { id: record.id, status: record.status, imageUrl: record.imageUrl, imageKey: record.imageKey };
  const swap = (outfit: Outfit): Outfit =>
    outfit.id === record.outfitId ? { ...outfit, visualization: summary } : outfit;
  queryClient.setQueriesData<Suggestions>({ queryKey: ['outfits', 'suggestions'] }, (answer) => (answer ? { ...answer, outfits: answer.outfits.map(swap) } : answer));
  queryClient.setQueriesData<Outfit[]>({ queryKey: outfitKeys.saved }, (list) => list?.map(swap));
  queryClient.setQueriesData<Outfit>({ queryKey: ['outfits', 'one'] }, (outfit) => (outfit ? swap(outfit) : outfit));
}

/** The picture of one outfit: its state, the words for it, and how much of today's allowance is left. */
export function useVisualization(outfit: Outfit) {
  const queryClient = useQueryClient();
  const known = visualizationOf(outfit);
  const order = useMemo(
    () =>
      createVisualizationOrder(outfit.id, {
        request: requestVisualization,
        read: fetchVisualization,
        wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
        // The same way the app makes the ids it sends for photos.
        newKey: () => Crypto.randomUUID(),
        onRecord: (record) => {
          attachVisualization(queryClient, record);
          if (isFinal(record.status)) {
            // A picture that did not come out gives the allowance back, so the counter has to be read again.
            void queryClient.invalidateQueries({ queryKey: wardrobeKeys.usage });
          }
        },
      }),
    [outfit.id, queryClient],
  );

  const state = useOrder(order, (current) => current);
  const usage = useQuery({ queryKey: wardrobeKeys.usage, queryFn: fetchUsage });

  useEffect(() => () => order.stop(), [order]);

  // The order lives on the server. Whatever came attached to the outfit is taken over here, whether it is still
  // running or already finished; an order this screen started itself is left alone.
  const knownId = known?.id ?? null;
  const knownStatus = known?.status ?? null;
  const knownUrl = known?.imageUrl ?? null;
  const knownKey = known?.imageKey ?? null;
  useEffect(() => {
    if (knownId && knownStatus) {
      order.adopt({ id: knownId, status: knownStatus, imageUrl: knownUrl, imageKey: knownKey });
    }
  }, [order, knownId, knownStatus, knownUrl, knownKey]);

  const left = usage.data?.visualizations;
  return {
    ...state,
    notice: noticeFor(state.stage, state.errorCode),
    /** How many pictures are left today, or null while the count is unknown. */
    leftLine: left ? leftToday(left) : null,
    /** Nothing left for today: ordering now would only be refused. */
    usedUp: left ? left.used >= left.limit : false,
    start: order.start,
  };
}
