import { fireEvent, render, screen } from '@testing-library/react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { EmptyState } from '@/components/EmptyState';

describe('EmptyState', () => {
  afterEach(() => jest.mocked(useReducedMotion).mockReturnValue(false));

  it('says what belongs here and offers the next step', async () => {
    const open = jest.fn();
    await render(<EmptyState icon="sun" title="Start with your wardrobe" text="Add a few items." action={{ label: 'Open wardrobe', onPress: open }} />);

    expect(screen.getByRole('header', { name: 'Start with your wardrobe' })).toBeOnTheScreen();
    expect(screen.getByText('Add a few items.')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Open wardrobe' }));

    expect(open).toHaveBeenCalledTimes(1);
  });

  it('shows no button when there is nothing to press yet', async () => {
    await render(<EmptyState icon="hanger" title="Start with a dozen or so items" text="Photograph your clothes." />);

    expect(screen.queryByRole('button')).toBeNull();
  });

  it('keeps the words and the way out when it is compact', async () => {
    const clear = jest.fn();
    await render(<EmptyState compact icon="hanger" title="Nothing matches your filters" text="Change your search." action={{ label: 'Clear filters', onPress: clear }} />);

    expect(screen.getByRole('header', { name: 'Nothing matches your filters' })).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Clear filters' }));

    expect(clear).toHaveBeenCalledTimes(1);
  });

  it('rises a few points as it fades in', async () => {
    await render(<EmptyState icon="bookmark" title="Your saved outfits will appear here" text="Save a suggestion." testID="empty" />);

    expect(screen.getByTestId('empty')).toHaveStyle({ opacity: 0, transform: [{ translateY: 8 }] });
  });

  it('only fades, without travelling, when the system asks for less movement', async () => {
    jest.mocked(useReducedMotion).mockReturnValue(true);

    await render(<EmptyState icon="bookmark" title="Your saved outfits will appear here" text="Save a suggestion." testID="empty" />);

    expect(screen.getByTestId('empty')).toHaveStyle({ opacity: 0, transform: [{ translateY: 0 }] });
    expect(screen.getByText('Your saved outfits will appear here')).toBeOnTheScreen();
  });
});
