import { joinWords, missingNotice } from '@/features/styling/copy';

describe('joinWords', () => {
  it('joins the last one with the word and the rest with commas', () => {
    expect(joinWords([], 'and')).toBe('');
    expect(joinWords(['a'], 'and')).toBe('a');
    expect(joinWords(['a', 'b'], 'or')).toBe('a or b');
    expect(joinWords(['a', 'b', 'c'], 'and')).toBe('a, b, and c');
  });
});

describe('missingNotice', () => {
  it('says what is missing and what to add, naming the temperature when the cold is the reason', () => {
    expect(missingNotice(['outerwear'], [], 1)).toEqual({
      title: 'You’re missing jackets and coats',
      text: 'At 1°C, you need jackets and coats. Add a jacket or a coat and we’ll put an outfit together.',
    });
  });

  it('does not blame the weather for a missing pair of shoes', () => {
    expect(missingNotice(['shoes'], [], 21)).toEqual({
      title: 'You’re missing shoes',
      text: 'To build an outfit, you need shoes. Add shoes and we’ll put an outfit together.',
    });
  });

  it('puts a sign on a temperature below zero', () => {
    expect(missingNotice(['outerwear'], [], -3).text).toContain('At −3°C');
  });

  it('lists several roles', () => {
    const notice = missingNotice(['bottom', 'shoes'], [], 15);

    expect(notice.title).toBe('You’re missing bottoms and shoes');
    expect(notice.text).toBe('To build an outfit, you need at least bottoms and shoes. Add pants, a skirt, or shorts plus shoes and we’ll put an outfit together.');
  });

  it('words "any one of these" as an alternative', () => {
    const notice = missingNotice([], ['mid_layer', 'outerwear'], 8);

    expect(notice.title).toBe('You’re missing warm layers or jackets and coats');
    expect(notice.text).toBe('At 8°C, you need at least warm layers or jackets and coats. Add a sweater, a hoodie, a jacket, or a coat and we’ll put an outfit together.');
  });

  it('keeps required roles and the alternative apart when both are missing', () => {
    const notice = missingNotice(['shoes'], ['mid_layer', 'outerwear'], 8);

    expect(notice.title).toBe('You’re missing shoes and warm layers or jackets and coats');
    expect(notice.text).toContain('Add shoes plus a sweater, a hoodie, a jacket, or a coat');
  });

  it('does not list a role twice when it is required and also an option', () => {
    expect(missingNotice(['outerwear'], ['outerwear', 'mid_layer'], 5).title).toBe('You’re missing jackets and coats and warm layers');
  });
});
