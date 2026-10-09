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
  hours: [],
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
    expect(formatRange(-4, 1)).toBe('−4 to 1°C');
    expect(formatRange(-8, -3)).toBe('−8 to −3°C');
    expect(formatRange(-5, -5)).toBe('−5°C');
  });

  it('takes the feels-like temperatures of the forecast', () => {
    expect(rangeOf(weather)).toBe('7-18°C');
  });
});

describe('partOfDay', () => {
  it.each([
    [2, 'at night'],
    [7, 'in the morning'],
    [11, 'in the morning'],
    [12, 'in the afternoon'],
    [17, 'in the afternoon'],
    [18, 'in the evening'],
    [23, 'in the evening'],
  ] as const)('calls %i o\'clock %s', (hour, part) => {
    expect(partOfDay(hour)).toBe(part);
  });
});

describe('headline', () => {
  it('says the sky and that nothing falls from it', () => {
    expect(headline(weather)).toBe('Sunny, no rain');
    expect(headline({ ...weather, sky: 'cloud' })).toBe('Cloudy, no rain');
    expect(headline({ ...weather, sky: 'cloud_sun' })).toBe('Partly cloudy, no rain');
  });

  it('says when the rain starts if it starts well after the window does', () => {
    expect(headline({ ...weather, sky: 'rain', rain: true, rainFrom: '2026-10-05T14:00:00+02:00' })).toBe('Rain from 2 pm');
    expect(headline({ ...weather, sky: 'rain', rain: true, rainFrom: '2026-10-05T19:00:00+02:00' })).toBe('Rain from 7 pm');
  });

  it('does not repeat "from the start" as a time of day', () => {
    expect(headline({ ...weather, sky: 'rain', rain: true, rainFrom: '2026-10-05T09:00:00+02:00' })).toBe('Rain');
    expect(headline({ ...weather, sky: 'snow', rain: true, rainFrom: '2026-10-05T10:00:00+02:00' })).toBe('Snow');
  });

  it('warns about rain under a sky that does not look it', () => {
    expect(headline({ ...weather, sky: 'cloud', rain: true, rainFrom: '2026-10-05T17:00:00+02:00' })).toBe('Cloudy, chance of rain from 5 pm');
  });

  it('reads the clock of the place, not the phone', () => {
    // 05:00 in Tokyo is 20:00 the day before in UTC; the rain still starts at 8 am there, whatever the phone's clock says.
    expect(headline({ sky: 'rain', rain: true, from: '2026-10-05T05:00:00+09:00', rainFrom: '2026-10-05T08:00:00+09:00' })).toBe('Rain from 8 am');
  });
});

describe('advice', () => {
  it('suggests a layer to take off when the day swings, naming when it is coldest', () => {
    expect(advice({ ...weather, needsLayers: true })).toBe('It’ll be cool in the morning. Wear a layer you can take off.');
    expect(advice({ ...weather, needsLayers: true, coldestAt: '2026-10-05T20:00:00+02:00' })).toBe('It’ll be cool in the evening. Wear a layer you can take off.');
  });

  it('puts rain before everything else', () => {
    expect(advice({ ...weather, rain: true, band: 'cold', needsLayers: true })).toBe('Cold and wet. Dress warm and stay dry.');
    expect(advice({ ...weather, rain: true, band: 'warm' })).toBe('Warm, but rain is possible. Bring something for the rain.');
  });

  it('speaks to the person without dashes', () => {
    for (const band of ['hot', 'warm', 'mild', 'cold', 'freezing'] as const) {
      expect(advice({ ...weather, band })).not.toMatch(/–|—/);
      expect(advice({ ...weather, band, rain: true })).not.toMatch(/–|—/);
    }
  });
});

describe('placeLine', () => {
  it('says "tomorrow" once the forecast is for the next day', () => {
    expect(placeLine(weather)).toBe('Gliwice');
    expect(placeLine({ ...weather, forTomorrow: true })).toBe('Gliwice, tomorrow');
  });
});
