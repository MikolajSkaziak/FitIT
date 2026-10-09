import { api, type Schemas } from './client';
import { unwrap } from './problem';

export type Clothing = Schemas['ClothingResponse'];
export type Category = Schemas['Category'];
export type GarmentGroup = Schemas['GarmentGroup'];
export type Subcategory = Schemas['Subcategory'];
export type Color = Schemas['Color'];
export type Pattern = Schemas['Pattern'];
export type Material = Schemas['Material'];
export type Season = Schemas['Season'];
export type RejectReason = NonNullable<Schemas['RejectReason']>;
export type ClothingChange = Schemas['UpdateClothingRequest'];
export type UploadTicket = Schemas['UploadResponse'];
export type WardrobeStats = Schemas['WardrobeStatsResponse'];
export type Usage = Schemas['UsageResponse'];
export type Dictionaries = Schemas['DictionariesResponse'];
export type StarterPiece = Schemas['StarterPieceResponse'];
/** A common piece with whether the signed-in person already has it in the wardrobe. */
export type MyStarterPiece = Schemas['MyStarterPieceResponse'];

/** Whether a garment is part of a saved outfit. */
export type UsageFilter = 'all' | 'used' | 'unused';

/** What narrows the wardrobe list. Empty means everything; within one list a garment matching any value is shown, and the lists combine. */
export interface ClothesFilter {
  search: string;
  /** A garment in any of these groups is shown; none chosen means all of them. */
  groups: readonly GarmentGroup[];
  /** Types within the one chosen group. */
  types: readonly Subcategory[];
  colors: readonly Color[];
  seasons: readonly Season[];
  materials: readonly Material[];
  usage: UsageFilter;
  forgotten: boolean;
}

export const noFilter: ClothesFilter = { search: '', groups: [], types: [], colors: [], seasons: [], materials: [], usage: 'all', forgotten: false };

const codes = (values: readonly string[]): string | undefined => (values.length > 0 ? values.join(',') : undefined);

export const fetchClothes = (filter: ClothesFilter, signal?: AbortSignal): Promise<Clothing[]> =>
  unwrap(
    api.GET('/api/clothes', {
      params: {
        query: {
          q: filter.search.trim() || undefined,
          group: codes(filter.groups),
          types: codes(filter.types),
          colors: codes(filter.colors),
          seasons: codes(filter.seasons),
          materials: codes(filter.materials),
          usage: filter.usage === 'all' ? undefined : filter.usage,
          forgotten: filter.forgotten || undefined,
        },
      },
      signal,
    }),
  );

/** Exactly these garments, whatever their state: how the upload queue follows what it sent. */
export const fetchClothesByIds = (ids: readonly string[]): Promise<Clothing[]> =>
  unwrap(api.GET('/api/clothes', { params: { query: { ids: ids.join(',') } } }));

export const fetchClothing = (id: string): Promise<Clothing> => unwrap(api.GET('/api/clothes/{id}', { params: { path: { id } } }));

export const fetchWardrobeStats = (): Promise<WardrobeStats> => unwrap(api.GET('/api/clothes/stats'));

export const fetchUsage = (): Promise<Usage> => unwrap(api.GET('/api/me/usage'));

export const fetchDictionaries = (): Promise<Dictionaries> => unwrap(api.GET('/api/dictionaries'));

/** The common pieces a person can tick instead of photographing. Public and fixed: the same list for everyone. */
export const fetchStarterPieces = (): Promise<StarterPiece[]> => unwrap(api.GET('/api/starter-pieces'));

/** The same pieces, each marked with whether this person has already added it. */
export const fetchMyStarterPieces = (): Promise<MyStarterPiece[]> => unwrap(api.GET('/api/me/starter-pieces'));

/** Adds these pieces as ready garments. Codes the wardrobe already has are skipped, so sending it twice is harmless. */
export const addStarterPieces = (codes: readonly string[]): Promise<Schemas['StarterAdditionResponse']> =>
  unwrap(api.POST('/api/me/starter-pieces', { body: { codes: [...codes] } }));

export const createUpload = (): Promise<UploadTicket> => unwrap(api.POST('/api/uploads'));

export const addClothing = (key: string): Promise<Clothing> => unwrap(api.POST('/api/clothes', { body: { key } }));

export const updateClothing = (id: string, change: ClothingChange): Promise<Clothing> =>
  unwrap(api.PATCH('/api/clothes/{id}', { params: { path: { id } }, body: change }));

export const deleteClothing = async (id: string): Promise<void> => {
  await unwrap(api.DELETE('/api/clothes/{id}', { params: { path: { id } } }));
};

export const reprocessClothing = (id: string): Promise<Clothing> => unwrap(api.POST('/api/clothes/{id}/reprocess', { params: { path: { id } } }));

export const wardrobeKeys = {
  all: ['clothes'] as const,
  // Every server-side filter, each list in a fixed order: the same choice made in another order is the same list.
  list: (filter: ClothesFilter) =>
    [
      'clothes',
      'list',
      filter.search.trim(),
      [...filter.groups].sort().join(','),
      [...filter.types].sort().join(','),
      [...filter.colors].sort().join(','),
      [...filter.seasons].sort().join(','),
      [...filter.materials].sort().join(','),
      filter.usage,
      filter.forgotten,
    ] as const,
  one: (id: string) => ['clothes', 'one', id] as const,
  stats: ['clothes', 'stats'] as const,
  usage: ['usage'] as const,
  dictionaries: ['dictionaries'] as const,
  starter: ['starter-pieces'] as const,
  // Under the garments' key: anything that refreshes the wardrobe (adding, deleting a garment) refreshes what is left to add.
  starterMine: ['clothes', 'starter-pieces'] as const,
};
