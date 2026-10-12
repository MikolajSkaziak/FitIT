import type { QueryClient } from '@tanstack/react-query';

import { outfitKeys, type Outfit, type Suggestions } from '@/api/outfits';
import type { OutfitVisualization, Visualization } from '@/api/visualizations';

/** Changes the outfit that has the given id wherever the phone holds a copy of it: today's and other suggestions, the saved list, the opened outfit. */
function updateOutfit(queryClient: QueryClient, outfitId: string | null, change: (outfit: Outfit) => Outfit): void {
  const swap = (outfit: Outfit): Outfit => (outfitId === null || outfit.id === outfitId ? change(outfit) : outfit);
  queryClient.setQueriesData<Suggestions>({ queryKey: ['outfits', 'suggestions'] }, (answer) => (answer ? { ...answer, outfits: answer.outfits.map(swap) } : answer));
  queryClient.setQueriesData<Outfit[]>({ queryKey: outfitKeys.saved }, (list) => list?.map(swap));
  queryClient.setQueriesData<Outfit>({ queryKey: ['outfits', 'one'] }, (outfit) => (outfit ? swap(outfit) : outfit));
}

/** Keeps the order with its outfit wherever the phone holds a copy of it, so leaving the screen and coming back finds it again. */
export function attachVisualization(queryClient: QueryClient, record: Visualization): void {
  const summary: OutfitVisualization = { id: record.id, status: record.status, imageUrl: record.imageUrl, imageKey: record.imageKey };
  updateOutfit(queryClient, record.outfitId, (outfit) => ({ ...outfit, visualization: summary }));
}

/** The picture was removed on the server (reported as inappropriate): no outfit may carry it any longer. */
export function detachVisualization(queryClient: QueryClient, visualizationId: string): void {
  updateOutfit(queryClient, null, (outfit) => (outfit.visualization?.id === visualizationId ? { ...outfit, visualization: null } : outfit));
}
