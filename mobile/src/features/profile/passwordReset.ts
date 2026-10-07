import { create } from 'zustand';

/**
 * The e-mail address typed on the way in: the login screen edits it, the reset screens use it and leave it for the
 * login screen again once the password is changed. In memory only, and not in a route parameter, so it is never in a URL.
 */
interface ResetDraft {
  email: string;
  set: (email: string) => void;
  reset: () => void;
}

export const useResetDraft = create<ResetDraft>((set) => ({
  email: '',
  set: (email) => set({ email }),
  reset: () => set({ email: '' }),
}));
