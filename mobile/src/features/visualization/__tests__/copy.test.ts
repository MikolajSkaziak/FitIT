import { leftToday, noticeFor, pictureCaption, working } from '@/features/visualization/copy';

describe('what the person reads about a picture', () => {
  it('counts what is left of today, with the verb agreeing with the number', () => {
    expect(leftToday({ used: 0, limit: 5 })).toBe('Zostało 5 z 5 wizualizacji na dziś.');
    expect(leftToday({ used: 1, limit: 5 })).toBe('Zostały 4 z 5 wizualizacji na dziś.');
    expect(leftToday({ used: 4, limit: 5 })).toBe('Została 1 z 5 wizualizacji na dziś.');
    expect(leftToday({ used: 5, limit: 5 })).toBe('Dzisiejszy limit wizualizacji jest wykorzystany. Wróć jutro.');
    // More used than the limit allows is still simply used up.
    expect(leftToday({ used: 7, limit: 5 })).toBe('Dzisiejszy limit wizualizacji jest wykorzystany. Wróć jutro.');
  });

  it('has nothing to say while the picture is on its way, or once it is here', () => {
    expect(noticeFor('none', null)).toBeNull();
    expect(noticeFor('working', null)).toBeNull();
    expect(noticeFor('ready', null)).toBeNull();
  });

  it('words the filter refusal as an outcome, with no retry that would end the same way', () => {
    const notice = noticeFor('blocked', 'content_blocked');

    expect(notice?.title).toBe('Nie udało się pokazać tego zestawu');
    expect(notice?.text).toContain('nie liczy się do dzisiejszego limitu');
    expect(notice?.text).toContain('Kolaż');
    expect(notice?.action).toBeNull();
  });

  it('offers another try when the generator failed, and names the limit it gave back', () => {
    expect(noticeFor('failed', 'provider_failed')).toMatchObject({ title: 'Obraz nie powstał', action: 'Spróbuj ponownie' });
    expect(noticeFor('failed', 'invalid_image')?.action).toBe('Spróbuj ponownie');
    // A code the app has never seen still gets the words for a picture that did not come out.
    expect(noticeFor('failed', null)?.action).toBe('Spróbuj ponownie');
    expect(noticeFor('failed', 'timeout')?.text).toContain('trzech minut');
  });

  it('says the day is used up, and does not offer a retry that would be refused', () => {
    expect(noticeFor('refused', 'limit_reached')).toMatchObject({ title: 'Dzisiejszy limit wizualizacji jest wykorzystany', action: null });
  });

  it('points at the profile when the consent is missing, whichever side found out', () => {
    expect(noticeFor('refused', 'consent_required')?.text).toContain('w profilu');
    expect(noticeFor('failed', 'consent_withdrawn')).toEqual(noticeFor('refused', 'consent_required'));
  });

  it('says pictures are paused for the day when the budget is gone, from either side', () => {
    expect(noticeFor('refused', 'visualizations_paused')).toMatchObject({ title: 'Wizualizacje są dziś wstrzymane', action: null });
    expect(noticeFor('failed', 'budget_exhausted')?.action).toBeNull();
  });

  it('falls back to the shared words when the order was refused for a reason of its own', () => {
    expect(noticeFor('refused', 'network')).toMatchObject({
      title: 'Nie udało się zamówić obrazu',
      text: 'Nie udało się połączyć. Sprawdź internet i spróbuj ponownie.',
      action: 'Spróbuj ponownie',
    });
  });

  const codes = ['content_blocked', 'timeout', 'provider_failed', 'budget_exhausted', 'consent_withdrawn', 'limit_reached', 'not_found', 'network'];

  it('never blames the person and never uses a dash that is not a hyphen', () => {
    const lines = [pictureCaption, working.title, working.text, leftToday({ used: 1, limit: 5 }), ...codes.flatMap((code) => [noticeFor('failed', code)?.title, noticeFor('failed', code)?.text])];

    for (const line of lines) {
      expect(line).toBeTruthy();
      expect(line).not.toMatch(/[—–]/);
      expect(line).not.toMatch(/\b(Twoj|Twój|źle|błędnie)\b/i);
    }
  });
});
