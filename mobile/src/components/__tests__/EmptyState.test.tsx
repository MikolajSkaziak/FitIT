import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { EmptyState } from '@/components/EmptyState';

describe('EmptyState', () => {
  beforeEach(() => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  });

  afterEach(() => jest.restoreAllMocks());

  it('says what belongs here and offers the next step', async () => {
    const open = jest.fn();
    await render(<EmptyState icon="sun" title="Zacznij od swojej szafy" text="Dodaj kilka ubrań." action={{ label: 'Otwórz szafę', onPress: open }} />);

    expect(screen.getByRole('header', { name: 'Zacznij od swojej szafy' })).toBeOnTheScreen();
    expect(screen.getByText('Dodaj kilka ubrań.')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Otwórz szafę' }));

    expect(open).toHaveBeenCalledTimes(1);
  });

  it('shows no button when there is nothing to press yet', async () => {
    await render(<EmptyState icon="hanger" title="Zacznij od kilkunastu ubrań" text="Sfotografuj ubrania." />);

    expect(screen.queryByRole('button')).toBeNull();
  });

  it('keeps the words and the way out when it is compact', async () => {
    const clear = jest.fn();
    await render(<EmptyState compact icon="hanger" title="Nic nie pasuje do filtrów" text="Zmień wyszukiwanie." action={{ label: 'Wyczyść filtry', onPress: clear }} />);

    expect(screen.getByRole('header', { name: 'Nic nie pasuje do filtrów' })).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Wyczyść filtry' }));

    expect(clear).toHaveBeenCalledTimes(1);
  });

  it('asks the system whether movement should be reduced before it animates in', async () => {
    const reduced = jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);

    await render(<EmptyState icon="bookmark" title="Tu trafią zapisane zestawy" text="Zapisz propozycję." />);

    await waitFor(() => expect(reduced).toHaveBeenCalled());
    expect(screen.getByText('Tu trafią zapisane zestawy')).toBeOnTheScreen();
  });
});
