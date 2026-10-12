import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { useEffect, useMemo } from 'react';

import type { Outfit } from '@/api/outfits';
import {
  fetchVisualization,
  isFinal,
  requestVisualization,
  visualizationOf,
} from '@/api/visualizations';
import { fetchUsage, wardrobeKeys } from '@/api/wardrobe';

import { attachVisualization } from './attach';
import { leftToday, noticeFor } from './copy';
import { createVisualizationOrder, useOrder } from './order';
import { isHidden, useReports } from './report';

/**
 * The picture of one outfit: its state, the words for it, and how much of today's allowance is left.
 *
 * An outfit that is still being put together has no id to order a picture for. It is given as null with `prepare`,
 * which stores it and answers with its id when the picture is ordered, and with the same id every time after that.
 */
export function useVisualization(outfit: Outfit | null, prepare?: () => Promise<string>) {
  const queryClient = useQueryClient();
  const known = outfit ? visualizationOf(outfit) : null;
  const outfitId = outfit?.id ?? null;
  const order = useMemo(
    () =>
      createVisualizationOrder(outfitId ?? '', {
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
    [outfitId, queryClient],
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

  // A picture reported as inappropriate is gone on the server: this order lets go of it too, and the outfit is back to nothing ordered.
  const reported = useReports((reports) => reports.sent);
  const shownId = state.picture?.id;
  useEffect(() => {
    if (isHidden(reported, shownId)) {
      order.forget();
    }
  }, [order, reported, shownId]);

  const left = usage.data?.visualizations;
  return {
    ...state,
    notice: noticeFor(state.stage, state.errorCode),
    /** How many pictures are left today, or null while the count is unknown. */
    leftLine: left ? leftToday(left) : null,
    /** Nothing left for today: ordering now would only be refused. */
    usedUp: left ? left.used >= left.limit : false,
    start: () => order.start(outfitId ? undefined : prepare),
  };
}
