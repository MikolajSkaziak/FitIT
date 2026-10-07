import { api, type Schemas } from './client';
import { unwrap } from './problem';

export type Outfit = Schemas['OutfitResponse'];
export type OutfitItem = Schemas['OutfitItemResponse'];
export type OutfitKind = NonNullable<Schemas['OutfitKind']>;
export type OutfitRating = Schemas['OutfitRating'];
export type OutfitWeather = Schemas['OutfitWeatherResponse'];
export type Occasion = Schemas['Occasion'];
export type Relaxation = Schemas['RelaxationResponse'];
export type SuggestionRequest = { occasion: Occasion; note?: string; baseItemId?: string };
export type OutfitChange = Schemas['UpdateOutfitRequest'];

/** The answer to a request for proposals. `missingEither` is "any one of these would do" (a mid layer or outerwear on a mild day). */
export type Suggestions = Schemas['SuggestionsResponse'];

export const suggestOutfits = (request: SuggestionRequest): Promise<Suggestions> =>
  unwrap(api.POST('/api/outfits/suggestions', { body: { occasion: request.occasion, note: request.note ?? null, baseItemId: request.baseItemId ?? null } }));

export const fetchSavedOutfits = (): Promise<Outfit[]> => unwrap(api.GET('/api/outfits', { params: { query: { saved: true } } }));

export const fetchOutfit = (id: string): Promise<Outfit> => unwrap(api.GET('/api/outfits/{id}', { params: { path: { id } } }));

export const updateOutfit = (id: string, change: OutfitChange): Promise<Outfit> =>
  unwrap(api.PATCH('/api/outfits/{id}', { params: { path: { id } }, body: change }));

export const deleteOutfit = async (id: string): Promise<void> => {
  await unwrap(api.DELETE('/api/outfits/{id}', { params: { path: { id } } }));
};

export const outfitKeys = {
  all: ['outfits'] as const,
  saved: ['outfits', 'list'] as const,
  one: (id: string) => ['outfits', 'one', id] as const,
  /** One key per request for proposals: asking again is a new request, going back and forth is not. */
  suggestions: (request: string) => ['outfits', 'suggestions', request] as const,
};
