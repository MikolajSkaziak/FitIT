import { cellLabel, daySectionTitle, dayWord, entriesWords, looksTitle, outfitDaysLine, planLabel, plannedLabel, suggestLabel, withinHorizon } from '@/features/calendar/copy';
import { fromIso, type CalendarDate } from '@/lib/dates';

const date = (iso: string): CalendarDate => fromIso(iso)!;
/** Monday. */
const today = date('2026-10-05');

describe('naming a day', () => {
  it.each([
    ['2026-10-05', 'today'],
    ['2026-10-06', 'tomorrow'],
    ['2026-10-07', 'Wednesday'],
    ['2026-10-11', 'Sunday'],
    // A week on is the same weekday as today: the date says which one is meant.
    ['2026-10-12', 'Oct 12'],
    ['2026-11-20', 'Nov 20'],
    ['2026-10-04', 'Oct 4'],
  ])('%s is "%s"', (iso, word) => {
    expect(dayWord(date(iso), today)).toBe(word);
  });

  it('words the actions and titles with it', () => {
    const thursday = date('2026-10-08');
    expect(planLabel(thursday, today)).toBe('Plan for Thursday');
    expect(plannedLabel(thursday, today)).toBe('Planned for Thursday');
    expect(suggestLabel(thursday, today)).toBe('Suggest looks for Thursday');
    expect(looksTitle(date('2026-10-06'), today)).toBe('Looks for tomorrow');
  });

  it('knows which days the forecast reaches: today and the next six', () => {
    expect(withinHorizon(today, today)).toBe(true);
    expect(withinHorizon(date('2026-10-11'), today)).toBe(true);
    expect(withinHorizon(date('2026-10-12'), today)).toBe(false);
    expect(withinHorizon(date('2026-10-04'), today)).toBe(false);
  });
});

describe('what a day holds', () => {
  const planned = { worn: false };
  const worn = { worn: true };

  it('counts planned and worn outfits in words', () => {
    expect(entriesWords([])).toBeNull();
    expect(entriesWords([planned])).toBe('1 planned outfit');
    expect(entriesWords([planned, planned])).toBe('2 planned outfits');
    expect(entriesWords([worn])).toBe('1 worn outfit');
    expect(entriesWords([worn, worn, worn])).toBe('3 worn outfits');
    expect(entriesWords([worn, planned])).toBe('1 worn and 1 planned outfit');
    expect(entriesWords([worn, worn, planned, planned])).toBe('2 worn and 2 planned outfits');
  });

  it('says a cell of the calendar as one sentence: the date, then its state', () => {
    const thursday = date('2026-10-15');
    expect(cellLabel(thursday, [], { today: false, selected: false })).toBe('Thursday, October 15');
    expect(cellLabel(thursday, [planned], { today: false, selected: true })).toBe('Thursday, October 15, 1 planned outfit, selected');
    expect(cellLabel(today, [worn], { today: true, selected: false })).toBe('Monday, October 5, today, 1 worn outfit');
    expect(cellLabel(thursday, [planned, planned, planned], { today: false, selected: false, refused: 'this day already has three outfits' })).toBe(
      'Thursday, October 15, 3 planned outfits, this day already has three outfits',
    );
    expect(cellLabel(thursday, [planned], { today: false, selected: false, held: true })).toBe('Thursday, October 15, 1 planned outfit, this outfit is planned here');
  });

  it('titles the outfits of a day by whether anything on it is still a plan', () => {
    expect(daySectionTitle([planned], date('2026-10-08'), today)).toBe('Planned for Thursday');
    expect(daySectionTitle([worn, planned], today, today)).toBe('Planned for today');
    expect(daySectionTitle([worn], today, today)).toBe('Worn today');
  });
});

describe('the days an outfit stands on', () => {
  it('is silent for an outfit that stands on none', () => {
    expect(outfitDaysLine([], today)).toBeNull();
  });

  it('leads with the next planned day, and counts the others', () => {
    expect(outfitDaysLine([{ id: 'a', date: '2026-10-15', worn: false }], today)).toEqual({ text: 'Planned for Thu, Oct 15', date: '2026-10-15' });
    expect(
      outfitDaysLine(
        [
          { id: 'a', date: '2026-10-02', worn: true },
          { id: 'b', date: '2026-10-20', worn: false },
          { id: 'c', date: '2026-10-08', worn: false },
        ],
        today,
      ),
    ).toEqual({ text: 'Planned for Thu, Oct 8 and 2 more', date: '2026-10-08' });
    // Planned for today counts as upcoming.
    expect(outfitDaysLine([{ id: 'a', date: '2026-10-05', worn: false }], today)?.text).toBe('Planned for Mon, Oct 5');
  });

  it('otherwise tells the last day it was worn', () => {
    expect(outfitDaysLine([{ id: 'a', date: '2026-10-06', worn: true }], date('2026-10-09'))).toEqual({ text: 'Worn Oct 6', date: '2026-10-06' });
    expect(
      outfitDaysLine(
        [
          { id: 'a', date: '2026-09-12', worn: true },
          { id: 'b', date: '2026-10-06', worn: true },
          { id: 'c', date: '2026-09-30', worn: true },
        ],
        date('2026-10-09'),
      ),
    ).toEqual({ text: 'Worn Oct 6 and 2 more', date: '2026-10-06' });
  });

  it('still names a plan whose day has passed unconfirmed, as a plan', () => {
    expect(outfitDaysLine([{ id: 'a', date: '2026-10-01', worn: false }], today)).toEqual({ text: 'Planned for Thu, Oct 1', date: '2026-10-01' });
  });
});
