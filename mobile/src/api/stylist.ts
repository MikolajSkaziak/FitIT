import { api, type Schemas } from './client';
import { unwrap } from './problem';

export type StylistChatRequest = Schemas['StylistChatRequest'];
export type StylistReply = Schemas['StylistReplyResponse'];
export type StylistTurn = NonNullable<StylistChatRequest['messages']>[number];
export type ShoppingPick = StylistReply['shopping'][number];

/**
 * One turn of the conversation with the stylist. The server keeps nothing: the recent conversation is sent each time,
 * and the answer can carry an outfit from the person's own clothes, the garments it talks about and pieces worth buying.
 */
export const askStylist = (request: StylistChatRequest): Promise<StylistReply> => unwrap(api.POST('/api/stylist/chat', { body: request }));
