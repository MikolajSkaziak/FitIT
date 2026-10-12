import { create } from 'zustand';

import type { OutfitPlacement } from '@/api/outfits';
import type { Clothing } from '@/api/wardrobe';
import { onSessionEnd } from '@/auth/session';

import { effectNote } from './copy';
import { toggleGarment } from './selection';

interface BuilderStore {
  /** The pieces chosen so far, in outfit order. */
  items: Clothing[];
  /** The one line under the picker after a tap that did more than add or remove. */
  note: string | null;
  /** The dress note is said once; after that the swap speaks for itself. */
  bodyNoteSeen: boolean;
  /** How the person arranged the board in the preview, or null while the app lays the pieces out itself. */
  layout: OutfitPlacement[] | null;
  /** The same for the garments on the figure. */
  figureLayout: OutfitPlacement[] | null;
  arrange: (layout: OutfitPlacement[] | null) => void;
  arrangeFigure: (figureLayout: OutfitPlacement[] | null) => void;
  toggle: (garment: Clothing) => void;
  /** Puts `garment` in the place of the chosen piece `id` (the preview's "Swap"). */
  swap: (id: string, garment: Clothing) => void;
  /** Takes a chosen piece out. */
  remove: (id: string) => void;
  /** Begins a new outfit around one garment ("Style this" → "Build it myself"). Whatever was chosen before is dropped. */
  startWith: (garment: Clothing) => void;
  clear: () => void;
}

/** The outfit being built, shared by the picker, the preview and its swap sheet. It is forgotten when the outfit is saved or the person signs out. */
export const useOutfitBuilder = create<BuilderStore>((set, get) => ({
  items: [],
  note: null,
  bodyNoteSeen: false,
  layout: null,
  figureLayout: null,
  arrange: (layout) => set({ layout }),
  arrangeFigure: (figureLayout) => set({ figureLayout }),
  toggle: (garment) => {
    const { items, effect } = toggleGarment(get().items, garment);
    const said = effect === 'replaced_body' && get().bodyNoteSeen ? null : effect;
    set({ items, note: said ? effectNote[said] : null, bodyNoteSeen: get().bodyNoteSeen || effect === 'replaced_body' });
  },
  swap: (id, garment) => set({ items: toggleGarment(get().items.filter((item) => item.id !== id && item.id !== garment.id), garment).items, note: null }),
  remove: (id) => set({ items: get().items.filter((item) => item.id !== id), note: null }),
  startWith: (garment) => set({ items: toggleGarment([], garment).items, note: null, layout: null, figureLayout: null }),
  clear: () => set({ items: [], note: null, layout: null, figureLayout: null }),
}));

onSessionEnd(() => useOutfitBuilder.setState({ items: [], note: null, bodyNoteSeen: false, layout: null, figureLayout: null }));
