import { api, type Schemas } from './client';
import { unwrap } from './problem';

export type Outfit = Schemas['OutfitResponse'];
export type OutfitItem = Schemas['OutfitItemResponse'];
export type OutfitKind = NonNullable<Schemas['OutfitKind']>;
export type Occasion = Schemas['Occasion'];
export type Relaxation = Schemas['RelaxationResponse'];
export type SuggestionRequest = { occasion: Occasion; note?: string; baseItemId?: string };
export type OutfitChange = Schemas['UpdateOutfitRequest'];

/** The answer to a request for proposals. `missingEither` is "any one of these would do" (a mid layer or outerwear on a mild day). */
export type Suggestions = Schemas['SuggestionsResponse'];

export const suggestOutfits = (request: SuggestionRequest): Promise<Suggestions> =>
  unwrap(api.POST('/api/outfits/suggestions', { body: { occasion: request.occasion, note: request.note ?? null, baseItemId: request.baseItemId ?? null } }));

/**
 * Today's picks for an occasion. The server makes them on the first visit of the day and hands the same ones back
 * afterwards; `fresh` asks for a new set, which counts against the day's limit like any request.
 */
export const fetchTodaysOutfits = (occasion: Occasion, fresh = false): Promise<Suggestions> =>
  unwrap(api.POST('/api/outfits/suggestions/today', { body: { occasion, fresh } }));

/** Tips on a combination: what works, up to three things to improve (the sentences come from the server), and a score. */
export type OutfitTips = Schemas['OutfitTipsResponse'];
/** `saved: false` stores a draft, enough to order a try-on picture of it; `draftId` names the draft a saved outfit replaces, whose pictures it inherits. */
export type OutfitBuild = { items: readonly string[]; occasion?: Occasion; name?: string; saved?: boolean; draftId?: string | null };

/** Saves an outfit the person put together; it comes back saved, with `source: manual`. */
export const createOutfit = (build: OutfitBuild): Promise<Outfit> =>
  unwrap(api.POST('/api/outfits', { body: { items: [...build.items], occasion: build.occasion ?? null, name: build.name?.trim() ? build.name.trim() : null, saved: build.saved ?? null, draftId: build.draftId ?? null } }));

export const fetchOutfitTips = (build: Pick<OutfitBuild, 'items' | 'occasion'>): Promise<OutfitTips> =>
  unwrap(api.POST('/api/outfits/tips', { body: { items: [...build.items], occasion: build.occasion ?? null } }));

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
  /**
   * Today's picks, one answer per occasion and day, asked again when the wardrobe grows or shrinks (the server hands back
   * the set it keeps). Kept among the suggestions, so an outfit opened from them is found at once.
   */
  today: (occasion: Occasion, day: string, pieces: number | null) => ['outfits', 'suggestions', 'today', occasion, day, pieces] as const,
};
