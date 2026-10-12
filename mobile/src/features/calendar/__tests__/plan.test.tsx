import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams } from 'expo-router';

import * as calendarApi from '@/api/calendar';
import * as outfits from '@/api/outfits';
import { ApiError } from '@/api/problem';
import BuilderPreview from '@/app/(app)/builder/preview';
import ChooseOccasion from '@/app/(app)/occasion';
import OutfitDetail from '@/app/(app)/outfit/[id]';
import PickOutfitSheet from '@/app/(app)/pick-outfit';
import PlanSheet from '@/app/(app)/plan';
import Proposals from '@/app/(app)/proposals';
import { useSession } from '@/auth/session';
import { useOutfitBuilder } from '@/features/builder/useOutfitBuilder';
import { finishPickDay, usePickDay, usePickOutfit, usePlanNotice } from '@/features/calendar/session';
import * as dates from '@/lib/dates';
import { calendarEntry, calendarOf, clothing, dayWeather, outfit, user, weather } from '@/test/fixtures';
import { renderScreen, router } from '@/test/screen';

jest.mock('expo-router', () => jest.requireActual('@/test/screen').routerModule);
jest.mock('@/lib/config', () => ({ apiUrl: 'http://api.test' }));
jest.mock('@/auth/tokenStorage', () => ({
  tokenStorage: { load: jest.fn(async () => null), save: jest.fn(async () => undefined), clear: jest.fn(async () => undefined) },
}));
jest.mock('@/api/calendar', () => jest.requireActual('@/test/calendar').quietCalendar());
jest.mock('@/api/outfits', () => ({
  ...jest.requireActual('@/api/outfits'),
  fetchSavedOutfits: jest.fn(),
  fetchOutfit: jest.fn(),
  updateOutfit: jest.fn(),
  suggestOutfits: jest.fn(),
  createOutfit: jest.fn(),
}));
jest.mock('@/api/wardrobe', () => ({
  ...jest.requireActual('@/api/wardrobe'),
  fetchUsage: jest.fn(async () => ({ items: { used: 1, limit: 50 }, suggestions: { used: 1, limit: 20 }, visualizations: { used: 0, limit: 5 }, resetsAt: '2026-10-06T00:00:00+02:00' })),
  fetchDictionaries: jest.fn(async () => ({ categories: [], groups: [], colors: [], patterns: [], materials: [], formality: [], warmth: [], styles: [], seasons: [] })),
}));
jest.mock('@/api/weather', () => ({ ...jest.requireActual('@/api/weather'), fetchWeatherToday: jest.fn() }));
// The phone's own date, which stands in until the server says what day it is at the person's place: Monday 5 October 2026.
jest.mock('@/lib/dates', () => ({ ...jest.requireActual('@/lib/dates'), today: jest.fn(), firstWeekdayOf: jest.fn(() => 1) }));

const api = jest.mocked(calendarApi);
const outfitApi = jest.mocked(outfits);
const impact = jest.mocked(Haptics.impactAsync);
const notification = jest.mocked(Haptics.notificationAsync);

const office = outfit('p1', { name: 'Office look', occasion: 'work', isSaved: true });
const dinner = outfit('p2', { occasion: 'date', isSaved: true });
const gym = outfit('p3', { occasion: 'workout', isSaved: true });
const thursday = '2026-10-08';

// What a change asked the server again is let to arrive before the screen is taken down.
afterEach(async () => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(dates.today).mockReturnValue({ day: 5, month: 10, year: 2026 });
  jest.mocked(dates.firstWeekdayOf).mockReturnValue(1);
  jest.mocked(useLocalSearchParams).mockReturnValue({ id: 'p1' });
  useSession.setState({ status: 'signedIn', user: user(), accessToken: 'a', refreshToken: 'r' });
  usePlanNotice.getState().clear();
  finishPickDay(null);
  api.fetchCalendar.mockResolvedValue(calendarOf([]));
  api.fetchOutfitDays.mockResolvedValue([]);
  outfitApi.fetchOutfit.mockResolvedValue(office);
  outfitApi.fetchSavedOutfits.mockResolvedValue([office, dinner, gym]);
});

describe('"Wear it when?"', () => {
  /** A stand-in for the screen that opened the sheet: it says which day came back. */
  function Opener({ onPicked }: { onPicked: (date: dates.CalendarDate | null) => void }) {
    const pickDay = usePickDay();
    const { Button } = jest.requireActual<typeof import('@/components/Button')>('@/components/Button');
    return <Button label="Open" onPress={() => void pickDay('p1', thursday).then(onPicked)} />;
  }

  const openSheet = async (entries: calendarApi.CalendarEntry[] = []) => {
    api.fetchCalendar.mockResolvedValue(calendarOf(entries));
    jest.mocked(useLocalSearchParams).mockReturnValue({ outfit: 'p1', date: thursday });
    const picked = jest.fn();
    await renderScreen(
      <>
        <Opener onPicked={picked} />
        <PlanSheet />
      </>,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Open' }));
    await waitFor(() => expect(api.fetchCalendar).toHaveBeenCalled());
    return picked;
  };

  it('opens as a sheet for the outfit, carrying the day the person came from', async () => {
    await openSheet();

    expect(router.push).toHaveBeenCalledWith({ pathname: '/plan', params: { outfit: 'p1', date: thursday } });
    expect(screen.getByRole('header', { name: 'Wear it when?' })).toBeOnTheScreen();
  });

  it('offers the next fourteen days, today first, the day the person came from already marked', async () => {
    await openSheet();

    const days = within(screen.getByTestId('plan-days')).getAllByRole('button');
    expect(days).toHaveLength(14);
    expect(days[0]?.props.accessibilityLabel).toBe('Monday, October 5, today');
    expect(days[3]?.props.accessibilityLabel).toBe('Thursday, October 8, selected');
    expect(days[13]?.props.accessibilityLabel).toBe('Sunday, October 18');
    expect(api.fetchCalendar).toHaveBeenCalledWith('2026-10-05', '2026-10-18');
    expect(within(days[0]!).getByText('Today')).toBeOnTheScreen();
    expect(within(days[4]!).getByText('Fri')).toBeOnTheScreen();
    expect(within(days[4]!).getByText('9')).toBeOnTheScreen();
  });

  it('answers with the day that is pressed and closes, with the tap of a main action', async () => {
    const picked = await openSheet();
    impact.mockClear();

    await fireEvent.press(screen.getByTestId('plan-day-2026-10-10'));

    await waitFor(() => expect(picked).toHaveBeenCalledWith({ day: 10, month: 10, year: 2026 }));
    expect(router.back).toHaveBeenCalledTimes(1);
    expect(impact.mock.calls).toEqual([['medium']]);
  });

  it('answers with nothing when it is closed without a day', async () => {
    const picked = await openSheet();

    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    expect(router.back).toHaveBeenCalledTimes(1);
    // The sheet going away is what tells the opener: here it is taken off the screen.
    await act(async () => finishPickDay(null));

    expect(picked).toHaveBeenCalledWith(null);
  });

  it('marks the days that already hold the outfit and will not take a full day, saying why', async () => {
    const picked = await openSheet([
      calendarEntry(office, '2026-10-06'),
      calendarEntry(dinner, '2026-10-07'),
      calendarEntry(gym, '2026-10-07'),
      calendarEntry(outfit('p4'), '2026-10-07'),
      calendarEntry(dinner, '2026-10-09'),
    ]);
    await screen.findByTestId('plan-held-note');

    const held = screen.getByTestId('plan-day-2026-10-06');
    expect(held.props.accessibilityLabel).toBe('Tuesday, October 6, 1 planned outfit, this outfit is planned here');
    expect(held.props.accessibilityState).toMatchObject({ disabled: true });
    const full = screen.getByTestId('plan-day-2026-10-07');
    expect(full.props.accessibilityLabel).toBe('Wednesday, October 7, 3 planned outfits, this day already has three outfits');
    expect(full.props.accessibilityState).toMatchObject({ disabled: true });
    // A day with room says what it holds and can be chosen.
    const open = screen.getByTestId('plan-day-2026-10-09');
    expect(open.props.accessibilityLabel).toBe('Friday, October 9, 1 planned outfit');
    expect(open.props.accessibilityState).toMatchObject({ disabled: false });
    // The reasons are on the page too, not only in what a screen reader says.
    expect(screen.getByText('Already planned for the checked days.')).toBeOnTheScreen();
    expect(screen.getByText('Days in gray already have three outfits.')).toBeOnTheScreen();

    await fireEvent.press(held);
    await fireEvent.press(full);
    expect(picked).not.toHaveBeenCalled();
    expect(router.back).not.toHaveBeenCalled();
  });

  it('reveals a month to page through behind "Pick another date", and answers with a day chosen there', async () => {
    const picked = await openSheet([calendarEntry(office, '2026-10-06')]);
    expect(screen.queryByTestId('plan-grid')).toBeNull();

    await fireEvent.press(screen.getByRole('link', { name: 'Pick another date' }));

    expect(await screen.findByTestId('plan-grid')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'October' })).toBeOnTheScreen();
    await waitFor(() => expect(api.fetchCalendar).toHaveBeenCalledWith('2026-10-01', '2026-10-31'));
    await waitFor(() =>
      expect(screen.getByTestId('plan-grid-2026-10-06').props.accessibilityLabel).toBe('Tuesday, October 6, 1 planned outfit, this outfit is planned here, already planned'),
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Next month' }));
    expect(await screen.findByRole('header', { name: 'November' })).toBeOnTheScreen();
    await fireEvent.press(await screen.findByTestId('plan-grid-2026-11-14'));

    await waitFor(() => expect(picked).toHaveBeenCalledWith({ day: 14, month: 11, year: 2026 }));
    expect(router.back).toHaveBeenCalledTimes(1);
  });
});

describe('planning from an outfit’s own page', () => {
  it('saves the chosen day at once, confirms it in place and offers to undo it', async () => {
    const entry = { ...calendarEntry(office, thursday), id: 'e-1' };
    api.addCalendarEntry.mockImplementation(async () => {
      api.fetchOutfitDays.mockResolvedValue([{ id: 'e-1', date: thursday, worn: false }]);
      return entry;
    });
    api.removeCalendarEntry.mockImplementation(async () => {
      api.fetchOutfitDays.mockResolvedValue([]);
    });
    await renderScreen(<OutfitDetail />);
    expect(await screen.findByRole('button', { name: 'Wear this today' })).toBeOnTheScreen();
    expect(screen.queryByTestId('outfit-days')).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Plan for a day' }));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/plan', params: { outfit: 'p1' } });
    await act(async () => finishPickDay({ day: 8, month: 10, year: 2026 }));

    // No alert: one quiet line where the person is looking, with the way to take it back.
    expect(await screen.findByTestId('plan-notice')).toHaveTextContent(/Planned for Thursday\./);
    expect(api.addCalendarEntry).toHaveBeenCalledWith(thursday, 'p1', undefined);
    await waitFor(() => expect(notification).toHaveBeenCalledWith('success'));
    expect(await screen.findByRole('link', { name: 'Planned for Thu, Oct 8. Opens the calendar' })).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Undo: planned for thursday' }));

    expect(api.removeCalendarEntry).toHaveBeenCalledWith('e-1');
    expect(screen.queryByTestId('plan-notice')).toBeNull();
    await waitFor(() => expect(screen.queryByTestId('outfit-days')).toBeNull());
  });

  it('takes the plan back and says why when the server refuses, with no confirmation', async () => {
    api.addCalendarEntry.mockRejectedValue(new ApiError({ status: 409, code: 'calendar_day_full' }));
    await renderScreen(<OutfitDetail />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Plan for a day' }));

    await act(async () => finishPickDay({ day: 8, month: 10, year: 2026 }));

    expect(await screen.findByText('That day already has three outfits. Remove one to add another.')).toBeOnTheScreen();
    expect(screen.queryByTestId('plan-notice')).toBeNull();
    expect(screen.queryByTestId('outfit-days')).toBeNull();
    expect(notification).not.toHaveBeenCalledWith('success');
  });

  it('lets the confirmation go by itself after a few seconds', async () => {
    jest.useFakeTimers();
    try {
      await renderScreen(<OutfitDetail />);
      await act(async () => jest.advanceTimersByTime(50));
      await act(async () => usePlanNotice.getState().show(calendarEntry(office, thursday)));
      expect(screen.getByTestId('plan-notice')).toBeOnTheScreen();

      await act(async () => jest.advanceTimersByTime(5999));
      expect(screen.getByTestId('plan-notice')).toBeOnTheScreen();
      await act(async () => jest.advanceTimersByTime(2));
      expect(screen.queryByTestId('plan-notice')).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  it('says nothing about a plan made for another outfit', async () => {
    await renderScreen(<OutfitDetail />);
    await screen.findByRole('button', { name: 'Wear this today' });

    await act(async () => usePlanNotice.getState().show(calendarEntry(dinner, thursday)));

    expect(screen.queryByTestId('plan-notice')).toBeNull();
  });

  it('tells the days it stands on in one line that opens the calendar on that month', async () => {
    api.fetchOutfitDays.mockResolvedValue([
      { id: 'a', date: '2026-09-28', worn: true },
      { id: 'b', date: '2026-10-02', worn: true },
      { id: 'c', date: '2026-10-15', worn: false },
    ]);
    await renderScreen(<OutfitDetail />);

    await fireEvent.press(await screen.findByRole('link', { name: 'Planned for Thu, Oct 15 and 2 more. Opens the calendar' }));

    expect(router.navigate).toHaveBeenCalledWith({ pathname: '/outfits', params: { view: 'calendar', day: '2026-10-15' } });
  });

  it('reads "Plan for Thursday" when it was opened from that day, and says so once it is planned', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ id: 'p1', date: thursday });
    api.addCalendarEntry.mockImplementation(async () => {
      api.fetchOutfitDays.mockResolvedValue([{ id: 'e-1', date: thursday, worn: false }]);
      return { ...calendarEntry(office, thursday), id: 'e-1' };
    });
    await renderScreen(<OutfitDetail />);

    // The day is ahead: it is not a day to wear the outfit on yet.
    expect(await screen.findByRole('button', { name: 'Plan for Thursday' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Wear this today' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Plan for another day' })).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Plan for Thursday' }));

    expect(await screen.findByRole('button', { name: 'Planned for Thursday' })).toBeOnTheScreen();
    expect(api.addCalendarEntry).toHaveBeenCalledWith(thursday, 'p1', undefined);
    expect(await screen.findByTestId('plan-notice')).toBeOnTheScreen();

    // "Plan for another day" opens the sheet with that day still marked.
    await fireEvent.press(screen.getByRole('button', { name: 'Plan for another day' }));
    expect(router.push).toHaveBeenLastCalledWith({ pathname: '/plan', params: { outfit: 'p1', date: thursday } });
    await act(async () => finishPickDay(null));
  });

  it('says it is planned already when it was opened from a day it stands on', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ id: 'p1', date: thursday });
    api.fetchOutfitDays.mockResolvedValue([{ id: 'e-1', date: thursday, worn: false }]);
    await renderScreen(<OutfitDetail />);

    await fireEvent.press(await screen.findByRole('button', { name: 'Planned for Thursday' }));

    expect(api.addCalendarEntry).not.toHaveBeenCalled();
  });

  it('wears as ever when the day it was opened from has come', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ id: 'p1', date: '2026-10-05' });
    await renderScreen(<OutfitDetail />);

    expect(await screen.findByRole('button', { name: 'Wear this today' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Plan for a day' })).toBeOnTheScreen();
  });
});

describe('looks suggested for a day ahead', () => {
  const answer: outfits.Suggestions = {
    status: 'proposed',
    date: thursday,
    missing: [],
    missingEither: [],
    fallback: false,
    occasion: 'work',
    weather: { ...weather, from: dayWeather.from, to: dayWeather.to, feelsMin: 4, feelsMax: 11, band: 'cold' },
    relaxations: [],
    umbrella: false,
    outfits: [outfit('o1'), outfit('o2', { kind: 'discovery' })],
  };

  beforeEach(() => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ request: `plan-${Math.random()}`, occasion: 'work', date: thursday });
    outfitApi.suggestOutfits.mockResolvedValue(answer);
  });

  it('are asked for that day, named for it, and planned for it instead of worn today', async () => {
    api.addCalendarEntry.mockResolvedValue({ ...calendarEntry(answer.outfits[0]!, thursday), id: 'e-9' });
    await renderScreen(<Proposals />);

    expect(await screen.findByRole('header', { name: 'Two looks' })).toBeOnTheScreen();
    expect(outfitApi.suggestOutfits).toHaveBeenCalledWith({ occasion: 'work', note: undefined, baseItemId: undefined, date: thursday });
    expect(screen.getByText('For Thursday in Gliwice.')).toBeOnTheScreen();
    expect(screen.getByText('Work or school, 4-11°C')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Wear this today' })).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Plan for Thursday' }));

    expect(await screen.findByRole('button', { name: 'Planned for Thursday' })).toBeOnTheScreen();
    expect(api.addCalendarEntry).toHaveBeenCalledWith(thursday, 'o1', undefined);
    expect(await screen.findByTestId('plan-notice')).toHaveTextContent(/Planned for Thursday\./);
    await waitFor(() => expect(notification).toHaveBeenCalledWith('success'));

    // The other look is its own answer: not planned by the first one.
    await fireEvent.press(screen.getByRole('tab', { name: 'Discovery, 2 of 2' }));
    expect(await screen.findByRole('button', { name: 'Plan for Thursday' })).toBeOnTheScreen();
    expect(screen.queryByTestId('plan-notice')).toBeNull();
  });

  it('undoes the plan from the line that confirmed it, and the button offers it again', async () => {
    api.addCalendarEntry.mockResolvedValue({ ...calendarEntry(answer.outfits[0]!, thursday), id: 'e-9' });
    api.removeCalendarEntry.mockResolvedValue(undefined);
    await renderScreen(<Proposals />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Plan for Thursday' }));
    await screen.findByTestId('plan-notice');

    await fireEvent.press(screen.getByTestId('plan-undo'));

    expect(api.removeCalendarEntry).toHaveBeenCalledWith('e-9');
    expect(await screen.findByRole('button', { name: 'Plan for Thursday' })).toBeOnTheScreen();
    expect(screen.queryByTestId('plan-notice')).toBeNull();
  });

  it('names the day while the stylist works, and does not borrow today’s weather for it', async () => {
    outfitApi.suggestOutfits.mockReturnValue(new Promise(() => undefined));
    await renderScreen(<Proposals />);

    expect(await screen.findByRole('header', { name: 'Looks for Thursday' })).toBeOnTheScreen();
    expect(screen.getByText('Work or school')).toBeOnTheScreen();
    expect(jest.requireMock<typeof import('@/api/weather')>('@/api/weather').fetchWeatherToday).not.toHaveBeenCalled();
  });

  it('says so when the day is past what the forecast reaches', async () => {
    outfitApi.suggestOutfits.mockRejectedValue(new ApiError({ status: 400, code: 'date_out_of_range' }));
    await renderScreen(<Proposals />);

    expect(await screen.findByText('The forecast only reaches a week ahead. Pick a closer day.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('proposals-back'));
    expect(router.back).toHaveBeenCalled();
  });

  it('keeps "Wear this today" for today, with planning for a day beside it', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ request: `today-${Math.random()}`, occasion: 'work' });
    jest.mocked(jest.requireMock<typeof import('@/api/weather')>('@/api/weather').fetchWeatherToday).mockResolvedValue(weather);
    outfitApi.suggestOutfits.mockResolvedValue({ ...answer, date: '2026-10-05', weather });
    api.addCalendarEntry.mockResolvedValue({ ...calendarEntry(answer.outfits[0]!, '2026-10-10'), id: 'e-3' });
    await renderScreen(<Proposals />);

    expect(await screen.findByRole('button', { name: 'Wear this today' })).toBeOnTheScreen();
    expect(outfitApi.suggestOutfits).toHaveBeenCalledWith({ occasion: 'work', note: undefined, baseItemId: undefined, date: undefined });

    await fireEvent.press(screen.getByRole('button', { name: 'Plan for a day' }));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/plan', params: { outfit: 'o1' } });
    await act(async () => finishPickDay({ day: 10, month: 10, year: 2026 }));

    expect(await screen.findByTestId('plan-notice')).toHaveTextContent(/Planned for Saturday\./);
    expect(api.addCalendarEntry).toHaveBeenCalledWith('2026-10-10', 'o1', undefined);
    // Planned for another day: today it can still be worn.
    expect(screen.getByRole('button', { name: 'Wear this today' })).toBeOnTheScreen();
  });

  it('carries the day from the occasion sheet to the proposals', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ date: thursday });
    await renderScreen(<ChooseOccasion />);

    expect(await screen.findByRole('header', { name: 'Looks for Thursday' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('radio', { name: 'Work or school' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Suggest looks' }));

    expect(router.replace).toHaveBeenCalledWith({ pathname: '/proposals', params: expect.objectContaining({ occasion: 'work', date: thursday }) });
  });

  it('leaves a day the forecast does not reach out of the request', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ date: '2026-11-20' });
    await renderScreen(<ChooseOccasion />);

    expect(await screen.findByRole('header', { name: 'Create outfits' })).toBeOnTheScreen();
    await fireEvent.press(await screen.findByRole('button', { name: 'Suggest looks' }));

    expect(jest.mocked(router.replace).mock.calls[0]?.[0].params).not.toHaveProperty('date');
  });
});

describe('the sheet of saved outfits for a day', () => {
  /** A stand-in for the screen that opened the sheet: it says which outfit came back. */
  function Opener({ date, onPicked }: { date: string; onPicked: (picked: outfits.Outfit | null) => void }) {
    const pickOutfit = usePickOutfit();
    const { Button } = jest.requireActual<typeof import('@/components/Button')>('@/components/Button');
    return <Button label="Open" onPress={() => void pickOutfit(date).then(onPicked)} />;
  }

  const openSheet = async (date: string) => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ date });
    const picked = jest.fn();
    await renderScreen(
      <>
        <Opener date={date} onPicked={picked} />
        <PickOutfitSheet />
      </>,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Open' }));
    return picked;
  };

  it('lists the saved outfits the day does not hold yet, and answers with the one that is pressed', async () => {
    api.fetchCalendar.mockResolvedValue(calendarOf([calendarEntry(office, thursday)]));
    const picked = await openSheet(thursday);

    expect(await screen.findByTestId('outfit-p2')).toBeOnTheScreen();
    expect(screen.getByTestId('outfit-p3')).toBeOnTheScreen();
    await waitFor(() => expect(screen.queryByTestId('outfit-p1')).toBeNull());
    expect(screen.getByText('Thursday, October 8')).toBeOnTheScreen();
    expect(api.fetchCalendar).toHaveBeenCalledWith(thursday, thursday);

    await fireEvent.press(screen.getByTestId('outfit-p3'));

    await waitFor(() => expect(picked).toHaveBeenCalledWith(gym));
    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it('offers looks made for the day while the forecast reaches it, and not beyond', async () => {
    const picked = await openSheet(thursday);

    await fireEvent.press(await screen.findByRole('button', { name: 'Suggest looks for Thursday' }));

    expect(router.replace).toHaveBeenCalledWith({ pathname: '/occasion', params: { date: thursday } });
    await waitFor(() => expect(picked).toHaveBeenCalledWith(null));
  });

  it('has no suggestions for a day past the forecast or behind us', async () => {
    await openSheet('2026-10-20');

    expect(await screen.findByTestId('outfit-p1')).toBeOnTheScreen();
    expect(screen.queryByTestId('pick-outfit-suggest')).toBeNull();
  });

  it('says a full day is full instead of offering what would be refused', async () => {
    api.fetchCalendar.mockResolvedValue(calendarOf([calendarEntry(office, thursday), calendarEntry(dinner, thursday), calendarEntry(gym, thursday)]));
    await openSheet(thursday);

    expect(await screen.findByTestId('pick-outfit-full')).toHaveTextContent('That day already has three outfits. Remove one to add another.');
    expect(screen.queryByTestId('outfit-p1')).toBeNull();
  });

  it('says so when nothing is saved yet', async () => {
    outfitApi.fetchSavedOutfits.mockResolvedValue([]);
    await openSheet('2026-10-20');

    expect(await screen.findByTestId('pick-outfit-none')).toHaveTextContent('No saved outfits yet. Save a look you like and it’ll be here to pick.');
  });
});

describe('planning an outfit that is still being built', () => {
  it('saves the outfit and puts it on the chosen day in one go, and confirms it where the person is', async () => {
    const built = outfit('new1', { source: 'manual', isSaved: true, kind: null });
    useOutfitBuilder.setState({ items: [clothing('g1', 'Navy shirt', 'top'), clothing('g3', 'Beige chinos', 'bottom')], layout: null });
    outfitApi.createOutfit.mockResolvedValue(built);
    api.addCalendarEntry.mockResolvedValue({ ...calendarEntry(built, thursday), id: 'e-7' });
    await renderScreen(<BuilderPreview />);

    await fireEvent.press(await screen.findByRole('button', { name: 'Plan for a day' }));
    // Not stored yet, so there is no outfit to mark days for.
    expect(router.push).toHaveBeenCalledWith({ pathname: '/plan', params: {} });
    await act(async () => finishPickDay({ day: 8, month: 10, year: 2026 }));

    await waitFor(() => expect(api.addCalendarEntry).toHaveBeenCalledWith(thursday, 'new1', undefined));
    expect(outfitApi.createOutfit).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(usePlanNotice.getState().planned?.id).toBe('e-7'));
    expect(router.replace).not.toHaveBeenCalled();
    expect(await screen.findByRole('button', { name: 'Remove from saved' })).toBeOnTheScreen();
  });

  it('saves nothing when the sheet is closed without a day', async () => {
    useOutfitBuilder.setState({ items: [clothing('g1', 'Navy shirt', 'top'), clothing('g3', 'Beige chinos', 'bottom')], layout: null });
    await renderScreen(<BuilderPreview />);

    await fireEvent.press(await screen.findByRole('button', { name: 'Plan for a day' }));
    await act(async () => finishPickDay(null));

    expect(outfitApi.createOutfit).not.toHaveBeenCalled();
    expect(api.addCalendarEntry).not.toHaveBeenCalled();
  });
});
