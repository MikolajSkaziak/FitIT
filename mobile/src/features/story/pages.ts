/** The four pages of the story before sign-up. A headline has one accent: the key words, in the action color. */
export interface StoryPage {
  id: 'problem' | 'photograph' | 'daily' | 'rediscover';
  headline: { lead: string; accent: string };
  body: string;
}

export const storyPages: readonly StoryPage[] = [
  {
    id: 'problem',
    headline: { lead: 'A full wardrobe, and nothing ', accent: 'to wear?' },
    body: 'You own plenty, and most mornings you still reach for the same few things.',
  },
  {
    id: 'photograph',
    headline: { lead: 'Photograph once. ', accent: 'fitit. does the rest.' },
    body: 'Snap each piece you own. fitit. describes it for you, so there is nothing to type.',
  },
  {
    id: 'daily',
    headline: { lead: 'An outfit for ', accent: 'every day' },
    body: 'Pick the occasion and fitit. matches pieces you already own to today’s weather.',
  },
  {
    id: 'rediscover',
    headline: { lead: 'Rediscover what you ', accent: 'forgot you had' },
    body: 'fitit. brings back the pieces that sit unworn, so you wear more of your wardrobe.',
  },
];

export const storyCopy = {
  skip: 'Skip',
  create: 'Create account',
  login: 'I already have an account',
  pageLabel: (page: number, count: number) => `Page ${page} of ${count}`,
};
