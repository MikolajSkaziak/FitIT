import { api, type Schemas } from './client';
import { unwrap } from './problem';

export type Clothing = Schemas['ClothingResponse'];
export type ClothingStatus = Schemas['ClothingStatus'];
export type Category = Schemas['Category'];
export type Subcategory = Schemas['Subcategory'];
export type Color = Schemas['Color'];
export type Pattern = Schemas['Pattern'];
export type Material = Schemas['Material'];
export type RejectReason = NonNullable<Schemas['RejectReason']>;
export type ClothingChange = Schemas['UpdateClothingRequest'];
export type UploadTicket = Schemas['UploadResponse'];
export type WardrobeStats = Schemas['WardrobeStatsResponse'];
export type Usage = Schemas['UsageResponse'];
export type Dictionaries = Schemas['DictionariesResponse'];

/** What narrows the wardrobe list. Empty means everything. */
export interface ClothesFilter {
  search: string;
  category: Category | null;
  forgotten: boolean;
}

export const noFilter: ClothesFilter = { search: '', category: null, forgotten: false };

export const fetchClothes = (filter: ClothesFilter, signal?: AbortSignal): Promise<Clothing[]> =>
  unwrap(
    api.GET('/api/clothes', {
      params: { query: { q: filter.search.trim() || undefined, category: filter.category ?? undefined, forgotten: filter.forgotten || undefined } },
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
  list: (filter: ClothesFilter) => ['clothes', 'list', filter.search.trim(), filter.category, filter.forgotten] as const,
  one: (id: string) => ['clothes', 'one', id] as const,
  stats: ['clothes', 'stats'] as const,
  usage: ['usage'] as const,
  dictionaries: ['dictionaries'] as const,
};
