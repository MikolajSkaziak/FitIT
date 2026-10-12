import { render, screen } from '@testing-library/react-native';

import { ColorResult } from '@/features/colors/ColorResult';
import { completeQuiz, emptyQuiz, eyeOptions, hairOptions, skinToneOptions, undertoneOptions } from '@/features/colors/quiz';
import { colorAnalysis } from '@/test/fixtures';

describe('the questions that replace the photo', () => {
  it('offers 8 skin tones, 9 hair colors and 7 eye colors, each with a name and a color, ordered as the server expects', () => {
    expect([skinToneOptions.length, hairOptions.length, eyeOptions.length]).toEqual([8, 9, 7]);
    expect(skinToneOptions.map((option) => option.value)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    for (const options of [skinToneOptions, hairOptions, eyeOptions]) {
      expect(new Set(options.map((option) => option.label)).size).toBe(options.length);
      expect(options.filter((option) => option.swatch !== null).every((option) => /^#[0-9A-F]{6}$/i.test(option.swatch ?? ''))).toBe(true);
    }
    // Only "dyed or other" has no color of its own.
    expect(hairOptions.filter((option) => option.swatch === null).map((option) => option.value)).toEqual(['dyed']);
    expect(undertoneOptions.map((option) => option.value)).toEqual(['warm', 'neutral', 'cool']);
  });

  it('turns four answers into the request, and nothing until all four are given', () => {
    expect(completeQuiz(emptyQuiz)).toBeNull();
    expect(completeQuiz({ skinTone: 3, undertone: 'warm', hair: 'black', eyes: null })).toBeNull();
    expect(completeQuiz({ skinTone: 3, undertone: 'warm', hair: 'black', eyes: 'hazel' })).toEqual({ skinTone: 3, undertone: 'warm', hair: 'black', eyes: 'hazel' });
  });
});

describe('the result view', () => {
  it('names the type, explains it in two sentences and lists both palettes with a name for each color', async () => {
    await render(<ColorResult analysis={colorAnalysis} />);

    expect(screen.getByTestId('color-result-name')).toHaveTextContent('Soft autumn');
    expect(screen.getByText(colorAnalysis.summary)).toBeOnTheScreen();
    expect(colorAnalysis.summary.match(/\./g)).toHaveLength(2);
    expect(screen.getByText('Wear more of')).toBeOnTheScreen();
    expect(screen.getByText('Wear less of')).toBeOnTheScreen();
    for (const swatch of [...colorAnalysis.best, ...colorAnalysis.soften]) {
      expect(screen.getByLabelText(swatch.name)).toBeOnTheScreen();
    }
  });
});
