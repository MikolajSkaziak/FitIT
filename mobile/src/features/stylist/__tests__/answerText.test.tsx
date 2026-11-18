import { render, screen } from '@testing-library/react-native';

import { AnswerText, blocksOf } from '@/features/stylist/AnswerText';

describe('setting an answer for reading', () => {
  it('keeps a one-line answer as one paragraph', () => {
    expect(blocksOf('Go for the navy blazer.')).toEqual([{ kind: 'paragraph', text: 'Go for the navy blazer.' }]);
  });

  it('splits paragraphs on blank lines and joins the lines inside one', () => {
    expect(blocksOf('First thought\nstill the first.\n\nSecond thought.')).toEqual([
      { kind: 'paragraph', text: 'First thought still the first.' },
      { kind: 'paragraph', text: 'Second thought.' },
    ]);
  });

  it('gathers list lines into one list, whatever mark the model used, and leaves the words around it as paragraphs', () => {
    expect(blocksOf('Start with these:\n- A white tee\n• Dark jeans\n2. White sneakers\nThat is a first outfit.')).toEqual([
      { kind: 'paragraph', text: 'Start with these:' },
      { kind: 'list', items: ['A white tee', 'Dark jeans', 'White sneakers'] },
      { kind: 'paragraph', text: 'That is a first outfit.' },
    ]);
  });

  it('drops empty lines at the edges and in a row', () => {
    expect(blocksOf('\n\nOne.\n\n\n\nTwo.\n\n')).toEqual([
      { kind: 'paragraph', text: 'One.' },
      { kind: 'paragraph', text: 'Two.' },
    ]);
  });

  it('shows each list line on its own, without the dash', async () => {
    await render(<AnswerText text={'Buy:\n- A white tee\n- Dark jeans'} />);

    expect(screen.getByText('A white tee')).toBeOnTheScreen();
    expect(screen.getByText('Dark jeans')).toBeOnTheScreen();
    expect(screen.queryByText(/- A white tee/)).toBeNull();
  });
});
