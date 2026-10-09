import { fireEvent, render, screen } from '@testing-library/react-native';

import { StoryPager } from '@/features/story/StoryPager';
import { storyPages } from '@/features/story/pages';

jest.mock('expo-router', () => jest.requireActual('@/test/screen').routerModule);

const headlineOf = (page: (typeof storyPages)[number]) => `${page.headline.lead}${page.headline.accent}`;

describe('the story before sign-up', () => {
  it('has four pages, each with one headline whose key words are the accent, and a sentence or two', () => {
    expect(storyPages.map((page) => headlineOf(page))).toEqual([
      'A full wardrobe, and nothing to wear?',
      'Photograph once. fitit. does the rest.',
      'An outfit for every day',
      'Rediscover what you forgot you had',
    ]);
    for (const page of storyPages) {
      expect(page.headline.accent.length).toBeGreaterThan(0);
      // "fitit." carries its own period, so it is not counted as the end of a sentence.
      expect(page.body.replaceAll('fitit.', 'fitit').split(/(?<=\.)\s/).length).toBeLessThanOrEqual(2);
      expect(`${headlineOf(page)} ${page.body}`).not.toMatch(/[!—–]|\p{Extended_Pictographic}/u);
    }
  });

  it('shows every page in one horizontal pager, each with its picture', async () => {
    await render(<StoryPager onCreate={jest.fn()} onLogin={jest.fn()} />);

    expect(screen.getByTestId('story-pages').props.horizontal).toBe(true);
    expect(screen.getByTestId('story-pages').props.pagingEnabled).toBe(true);
    for (const page of storyPages) {
      expect(screen.getByTestId(`story-page-${page.id}`)).toBeOnTheScreen();
      expect(screen.getByTestId(`story-art-${page.id}`, { includeHiddenElements: true })).toBeOnTheScreen();
      expect(screen.getByText(page.headline.accent)).toBeOnTheScreen();
    }
  });

  it('keeps both ways in on every page', async () => {
    const create = jest.fn();
    const login = jest.fn();
    await render(<StoryPager onCreate={create} onLogin={login} />);

    for (const position of [0, 1, 2, 3]) {
      await fireEvent.press(screen.getByTestId(`story-bar-${position}`));
      expect(screen.getByRole('button', { name: 'Create account' })).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: 'I already have an account' })).toBeOnTheScreen();
    }

    await fireEvent.press(screen.getByTestId('welcome-register'));
    await fireEvent.press(screen.getByTestId('welcome-login'));
    expect(create).toHaveBeenCalledTimes(1);
    expect(login).toHaveBeenCalledTimes(1);
  });

  it('marks the page showing, follows a swipe, and Skip goes to the last page', async () => {
    await render(<StoryPager onCreate={jest.fn()} onLogin={jest.fn()} />);
    const selected = () => [0, 1, 2, 3].filter((position) => screen.getByTestId(`story-bar-${position}`).props.accessibilityState.selected);
    expect(selected()).toEqual([0]);
    expect(screen.getByRole('tab', { name: 'Page 1 of 4' })).toBeOnTheScreen();

    // A swipe to the third page: the pager reports how far it has scrolled.
    const width = 750;
    await fireEvent.scroll(screen.getByTestId('story-pages'), { nativeEvent: { contentOffset: { x: 2 * width, y: 0 } } });
    expect(selected()).toEqual([2]);

    await fireEvent.press(screen.getByTestId('story-skip'));
    expect(selected()).toEqual([3]);
  });
});
