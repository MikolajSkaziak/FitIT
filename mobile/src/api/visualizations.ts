import { api, type Schemas } from './client';
import type { Outfit } from './outfits';
import { unwrap } from './problem';

/** One order for a picture of an outfit on the person's silhouette. */
export type Visualization = Schemas['VisualizationResponse'];
export type VisualizationStatus = Schemas['VisualizationStatus'];

/** The newest order of an outfit, as much of it as a list of outfits needs. */
export type OutfitVisualization = Schemas['OutfitVisualizationResponse'];

/** The last three statuses are final (spec 7.5). */
export const isFinal = (status: VisualizationStatus): boolean => status !== 'pending' && status !== 'running';

/**
 * Orders the picture. The same key always means the same order, so a request the connection swallowed can be sent
 * again without using up a second visualization. The answer is the new order, or the one that already existed.
 */
export const requestVisualization = (outfitId: string, idempotencyKey: string): Promise<Visualization> =>
  unwrap(api.POST('/api/outfits/{id}/visualizations', { params: { path: { id: outfitId }, header: { 'Idempotency-Key': idempotencyKey } } }));

export const fetchVisualization = (id: string): Promise<Visualization> => unwrap(api.GET('/api/visualizations/{id}', { params: { path: { id } } }));

/** The newest order the server attached to an outfit. */
export const visualizationOf = (outfit: Outfit): OutfitVisualization | null => outfit.visualization;
