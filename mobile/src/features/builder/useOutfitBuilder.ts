import { create } from 'zustand';

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
  toggle: (garment: Clothing) => void;
  /** Begins a new outfit around one garment ("Style this" → "Build it myself"). Whatever was chosen before is dropped. */
  startWith: (garment: Clothing) => void;
  clear: () => void;
}

/** The outfit being built, shared by the picker and the preview. It is forgotten when the outfit is saved or the person signs out. */
export const useOutfitBuilder = create<BuilderStore>((set, get) => ({
  items: [],
  note: null,
  bodyNoteSeen: false,
  toggle: (garment) => {
    const { items, effect } = toggleGarment(get().items, garment);
    const said = effect === 'replaced_body' && get().bodyNoteSeen ? null : effect;
    set({ items, note: said ? effectNote[said] : null, bodyNoteSeen: get().bodyNoteSeen || effect === 'replaced_body' });
  },
  startWith: (garment) => set({ items: toggleGarment([], garment).items, note: null }),
  clear: () => set({ items: [], note: null }),
}));

onSessionEnd(() => useOutfitBuilder.setState({ items: [], note: null, bodyNoteSeen: false }));
