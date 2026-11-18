import type { IconName } from '@/components/Icon';

export const stylistCopy = {
  eyebrow: 'Your stylist',
  title: 'Ask your stylist',
  accent: 'stylist',
  lead: (pieces: number) =>
    pieces === 0
      ? 'Add a few clothes and I can put outfits together from them, tell you what is missing and what to buy next.'
      : `I know your ${pieces} ${pieces === 1 ? 'piece' : 'pieces'}, your styles and today’s weather. Ask me for an outfit, what is missing, or what to buy next.`,
  /** Said once, quietly, under the first prompts: what the answers are and what they are made from. */
  disclosure: 'Answers come from AI and can be wrong. It reads your clothes’ details, never your photos.',
  speaker: 'Stylist',
  you: 'You',
  placeholder: 'Ask your stylist',
  send: 'Send',
  thinking: 'Looking through your wardrobe',
  newChat: 'New chat',
  close: 'Close',
  outfitTitle: 'Wear this',
  openOutfit: 'Open in builder',
  mentionedTitle: 'From your wardrobe',
  shoppingTitle: 'Worth adding',
  retry: 'Try again',
  limit: 'That’s all the stylist can answer today. More tomorrow.',
};

/** The first things to ask, shown while the conversation is empty. */
export const starters: readonly { icon: IconName; text: string }[] = [
  { icon: 'sparkle', text: 'What should I wear tonight?' },
  { icon: 'hanger', text: 'What’s missing from my wardrobe?' },
  { icon: 'plus', text: 'What should I buy next?' },
  { icon: 'palette', text: 'Which of my colors work best together?' },
];
