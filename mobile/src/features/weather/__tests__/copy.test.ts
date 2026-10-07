import type { Weather } from '@/api/weather';
import { advice, formatRange, headline, partOfDay, placeLine, rangeOf } from '@/features/weather/copy';

const weather: Weather = {
  place: 'Gliwice',
  forTomorrow: false,
  from: '2026-10-05T09:00:00+02:00',
  to: '2026-10-05T22:00:00+02:00',
  feelsMin: 7,
  feelsMax: 18,
  coldestAt: '2026-10-05T09:00:00+02:00',
  warmestAt: '2026-10-05T15:00:00+02:00',
  sky: 'sun',
  rain: false,
  rainProbability: 5,
  rainFrom: null,
  needsLayers: false,
  band: 'mild',
};

describe('formatRange', () => {
  it('writes a range with a hyphen, as the mock-ups do', () => {
    expect(formatRange(7, 18)).toBe('7-18°C');
    expect(formatRange(0, 4)).toBe('0-4°C');
  });

  it('writes one value when the day does not move', () => {
    expect(formatRange(12, 12)).toBe('12°C');
  });

  it('spells a range below zero with words, so no hyphen reads as a minus', () => {
    expect(formatRange(-4, 1)).toBe('−4 do 1°C');
    expect(formatRange(-8, -3)).toBe('−8 do −3°C');
    expect(formatRange(-5, -5)).toBe('−5°C');
  });

  it('takes the feels-like temperatures of the forecast', () => {
    expect(rangeOf(weather)).toBe('7-18°C');
  });
});

describe('partOfDay', () => {
  it.each([
    [2, 'w nocy'],
    [7, 'rano'],
    [11, 'rano'],
    [12, 'po południu'],
    [17, 'po południu'],
    [18, 'wieczorem'],
    [23, 'wieczorem'],
  ] as const)('calls %i o\'clock %s', (hour, part) => {
    expect(partOfDay(hour)).toBe(part);
  });
});

describe('headline', () => {
  it('says the sky and that nothing falls from it', () => {
    expect(headline(weather)).toBe('Słonecznie, bez opadów');
    expect(headline({ ...weather, sky: 'cloud' })).toBe('Pochmurno, bez opadów');
    expect(headline({ ...weather, sky: 'cloud_sun' })).toBe('Przejaśnienia, bez opadów');
  });

  it('says when the rain starts if it starts well after the window does', () => {
    expect(headline({ ...weather, sky: 'rain', rain: true, rainFrom: '2026-10-05T14:00:00+02:00' })).toBe('Deszcz po południu');
    expect(headline({ ...weather, sky: 'rain', rain: true, rainFrom: '2026-10-05T19:00:00+02:00' })).toBe('Deszcz wieczorem');
  });

  it('does not repeat "from the start" as a time of day', () => {
    expect(headline({ ...weather, sky: 'rain', rain: true, rainFrom: '2026-10-05T09:00:00+02:00' })).toBe('Deszcz');
    expect(headline({ ...weather, sky: 'snow', rain: true, rainFrom: '2026-10-05T10:00:00+02:00' })).toBe('Śnieg');
  });

  it('warns about rain under a sky that does not look it', () => {
    expect(headline({ ...weather, sky: 'cloud', rain: true, rainFrom: '2026-10-05T17:00:00+02:00' })).toBe('Pochmurno, możliwy deszcz po południu');
  });

  it('reads the clock of the place, not the phone', () => {
    // 07:00 in Tokyo is 22:00 the day before in UTC; the rain still starts "rano" there.
    expect(headline({ sky: 'rain', rain: true, from: '2026-10-05T05:00:00+09:00', rainFrom: '2026-10-05T08:00:00+09:00' })).toBe('Deszcz rano');
  });
});

describe('advice', () => {
  it('suggests a layer to take off when the day swings, naming when it is coldest', () => {
    expect(advice({ ...weather, needsLayers: true })).toBe('Rano chłodno, przyda się warstwa do zdjęcia.');
    expect(advice({ ...weather, needsLayers: true, coldestAt: '2026-10-05T20:00:00+02:00' })).toBe('Wieczorem chłodno, przyda się warstwa do zdjęcia.');
  });

  it('puts rain before everything else', () => {
    expect(advice({ ...weather, rain: true, band: 'cold', needsLayers: true })).toBe('Zimno i mokro, ubierz się ciepło i nieprzemakalnie.');
    expect(advice({ ...weather, rain: true, band: 'warm' })).toBe('Ciepło, ale może padać. Weź coś na deszcz.');
  });

  it('speaks to the person without gendered forms', () => {
    for (const band of ['hot', 'warm', 'mild', 'cold', 'freezing'] as const) {
      expect(advice({ ...weather, band })).not.toMatch(/–|—/);
      expect(advice({ ...weather, band, rain: true })).not.toMatch(/–|—/);
    }
  });
});

describe('placeLine', () => {
  it('says "jutro" once the forecast is for the next day', () => {
    expect(placeLine(weather)).toBe('Gliwice');
    expect(placeLine({ ...weather, forTomorrow: true })).toBe('Gliwice, jutro');
  });
});
