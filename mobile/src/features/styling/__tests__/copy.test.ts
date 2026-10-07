import { joinWords, missingNotice, relaxationLine, relaxationLines } from '@/features/styling/copy';

describe('joinWords', () => {
  it('joins the last two with the word and the rest with commas', () => {
    expect(joinWords([], 'i')).toBe('');
    expect(joinWords(['a'], 'i')).toBe('a');
    expect(joinWords(['a', 'b'], 'albo')).toBe('a albo b');
    expect(joinWords(['a', 'b', 'c'], 'i')).toBe('a, b i c');
  });
});

describe('missingNotice', () => {
  it('says what is missing and what to add, naming the temperature when the cold is the reason', () => {
    expect(missingNotice(['outerwear'], [], 1)).toEqual({
      title: 'Brakuje okrycia wierzchniego',
      text: 'Przy 1°C potrzebne jest okrycie wierzchnie. Dodaj kurtkę albo płaszcz, a ułożymy zestaw.',
    });
  });

  it('does not blame the weather for a missing pair of shoes', () => {
    expect(missingNotice(['shoes'], [], 21)).toEqual({
      title: 'Brakuje butów',
      text: 'Do zestawu potrzebne są buty. Dodaj buty, a ułożymy zestaw.',
    });
  });

  it('puts a sign on a temperature below zero', () => {
    expect(missingNotice(['outerwear'], [], -3).text).toContain('Przy −3°C');
  });

  it('lists several roles with the verb that agrees with the first', () => {
    const notice = missingNotice(['bottom', 'shoes'], [], 15);

    expect(notice.title).toBe('Brakuje dołu i butów');
    expect(notice.text).toBe('Do zestawu potrzebne jest co najmniej: dół i buty. Dodaj spodnie, spódnicę albo szorty oraz buty, a ułożymy zestaw.');
  });

  it('words "any one of these" as an alternative', () => {
    const notice = missingNotice([], ['mid_layer', 'outerwear'], 8);

    expect(notice.title).toBe('Brakuje warstwy pośredniej albo okrycia wierzchniego');
    expect(notice.text).toBe('Przy 8°C potrzebne jest co najmniej: warstwa pośrednia albo okrycie wierzchnie. Dodaj sweter, bluzę, kurtkę albo płaszcz, a ułożymy zestaw.');
  });

  it('keeps required roles and the alternative apart when both are missing', () => {
    const notice = missingNotice(['shoes'], ['mid_layer', 'outerwear'], 8);

    expect(notice.title).toBe('Brakuje butów i warstwy pośredniej albo okrycia wierzchniego');
    expect(notice.text).toContain('Dodaj buty oraz sweter, bluzę, kurtkę albo płaszcz');
  });

  it('does not list a role twice when it is required and also an option', () => {
    expect(missingNotice(['outerwear'], ['outerwear', 'mid_layer'], 5).title).toBe('Brakuje okrycia wierzchniego i warstwy pośredniej');
  });
});

describe('relaxationLine', () => {
  it('says which rule gave way for which part of the outfit, in a sentence', () => {
    expect(relaxationLine({ role: 'outerwear', rule: 'warmth' })).toBe('Nie masz okrycia wierzchniego na tę temperaturę, więc proponuję to, co jest najbliżej.');
    expect(relaxationLine({ role: 'shoes', rule: 'formality' })).toBe('Nie masz butów na tę okazję, więc proponuję to, co jest najbliżej.');
    expect(relaxationLine({ role: 'top', rule: 'style' })).toBe('Nie masz góry w pasującym stylu, więc proponuję to, co jest najbliżej.');
  });

  it('says each sentence once, however many outfits of the request carry it', () => {
    const same = { role: 'outerwear' as const, rule: 'warmth' as const };

    expect(relaxationLines([same, same, { role: 'shoes', rule: 'style' }])).toHaveLength(2);
  });
});
