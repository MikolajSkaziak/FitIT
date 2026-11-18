import { create } from 'zustand';

import type { Occasion } from '@/api/outfits';
import type { StylistReply, StylistTurn } from '@/api/stylist';
import { onSessionEnd } from '@/auth/session';

/** How much of the conversation goes to the server with each question: the server takes at most 16 turns. */
export const sentTurns = 16;

export interface ChatMessage {
  id: string;
  role: 'person' | 'stylist';
  text: string;
  /** What came with a stylist's answer: an outfit, garments, purchases, next questions. */
  reply?: StylistReply;
}

interface ChatStore {
  messages: ChatMessage[];
  /** The occasion the person last spoke of, carried to the next question. */
  occasion: Occasion | null;
  add: (message: ChatMessage) => void;
  clear: () => void;
}

/** The conversation with the stylist. It lasts while the app is open; the server keeps none of it. */
export const useStylistChat = create<ChatStore>((set) => ({
  messages: [],
  occasion: null,
  add: (message) =>
    set((state) => ({ messages: [...state.messages, message], occasion: message.reply?.outfit?.occasion ?? state.occasion })),
  clear: () => set({ messages: [], occasion: null }),
}));

onSessionEnd(() => useStylistChat.setState({ messages: [], occasion: null }));

/** The turns sent with a question: the most recent ones, as plain text. */
export const turnsOf = (messages: readonly ChatMessage[]): StylistTurn[] =>
  messages.slice(-sentTurns).map((message) => ({ role: message.role, text: message.text }));

let next = 0;
export const messageId = (): string => `m${Date.now()}-${(next += 1)}`;
