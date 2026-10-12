import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { useIsFocused } from 'expo-router';

import * as calendarApi from '@/api/calendar';
import * as outfits from '@/api/outfits';
import { ApiError } from '@/api/problem';
import * as wardrobe from '@/api/wardrobe';
import * as weatherApi from '@/api/weather';
import Today from '@/app/(app)/(tabs)/index';
import { useSession } from '@/auth/session';
import { finishPickOutfit } from '@/features/calendar/session';
import { calendarEntry, calendarOf, clothing, dayWeather, outfit, user, weather } from '@/test/fixtures';
import { renderScreen, router } from '@/test/screen';

jest.mock('expo-router', () => ({ ...jest.requireActual('@/test/screen').routerModule, useIsFocused: jest.fn(() => true) }));
jest.mock('@/lib/config', () => ({ apiUrl: 'http://api.test' }));
jest.mock('@/auth/tokenStorage', () => ({
  tokenStorage: { load: jest.fn(async () => null), save: jest.fn(async () => undefined), clear: jest.fn(async () => undefined) },
}));
jest.mock('@/api/calendar', () => jest.requireActual('@/test/calendar').quietCalendar());
jest.mock('@/api/wardrobe', () => ({ ...jest.requireActual('@/api/wardrobe'), fetchWardrobeStats: jest.fn(), fetchClothes: jest.fn() }));
jest.mock('@/api/weather', () => ({ ...jest.requireActual('@/api/weather'), fetchWeatherToday: jest.fn(), fetchWeatherForDay: jest.fn() }));
jest.mock('@/api/outfits', () => ({ ...jest.requireActual('@/api/outfits'), fetchTodaysOutfits: jest.fn(), suggestOutfits: jest.fn() }));

const api = jest.mocked(calendarApi);
const fetchPicks = jest.mocked(outfits.fetchTodaysOutfits);
const fetchDay = jest.mocked(weatherApi.fetchWeatherForDay);
const select = jest.mocked(Haptics.selectionAsync);
const notification = jest.mocked(Haptics.notificationAsync);

const picks: outfits.Suggestions = {
  status: 'proposed',
  date: '2026-10-05',
  missing: [],
  missingEither: [],
  fallback: false,
  occasion: 'everyday',
  weather,
  relaxations: [],
  umbrella: false,
  outfits: [outfit('o1')],
};

const office = outfit('p1', { name: 'Office look', occasion: 'work', isSaved: true });
const dinner = outfit('p2', { occasion: 'date', isSaved: true });
/** Today is Monday 5 October 2026 at the place; Thursday is the 8th. */
const thursday = '2026-10-08';

// What a change asked the server again is let to arrive before the screen is taken down.
afterEach(async () => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useIsFocused).mockReturnValue(true);
  useSession.setState({ status: 'signedIn', user: user({ colorAnalysis: null }), accessToken: 'a', refreshToken: 'r' });
  jest.mocked(weatherApi.fetchWeatherToday).mockResolvedValue(weather);
  fetchDay.mockResolvedValue(dayWeather);
  jest.mocked(wardrobe.fetchWardrobeStats).mockResolvedValue({ total: 5, wornLast30Days: 1, forgotten: 1, processing: 0, needsTags: 0 });
  jest.mocked(wardrobe.fetchClothes).mockResolvedValue([clothing('f1', 'Navy jacket', 'outerwear', { isForgotten: true })]);
  fetchPicks.mockResolvedValue(picks);
  api.fetchCalendar.mockResolvedValue(calendarOf([calendarEntry(office, thursday), calendarEntry(dinner, '2026-10-05')]));
});

const day = (date: string) => screen.getByTestId(`week-day-${date}`);
const toThursday = async () => {
  await renderScreen(<Today />);
  await screen.findByTestId('today-planned');
  await fireEvent.press(day(thursday));
  await screen.findByTestId('weather-high');
};

describe('the week strip', () => {
  it('offers today and the next six days as one radio group, today chosen, saying what each day holds', async () => {
    await renderScreen(<Today />);
    await screen.findByTestId('today-planned');

    const strip = screen.getByTestId('week-strip');
    expect([strip.props.accessibilityRole, strip.props.accessibilityLabel]).toEqual(['radiogroup', 'Day']);
    const days = within(strip).getAllByRole('radio');
    expect(days).toHaveLength(7);
    expect(days.map((cell) => cell.props.accessibilityLabel)).toEqual([
      'Monday, October 5, today, 1 planned outfit',
      'Tuesday, October 6',
      'Wednesday, October 7',
      'Thursday, October 8, 1 planned outfit',
      'Friday, October 9',
      'Saturday, October 10',
      'Sunday, October 11',
    ]);
    expect(days.map((cell) => cell.props.accessibilityState.checked)).toEqual([true, false, false, false, false, false, false]);
    expect(within(day('2026-10-05')).getByText('Today')).toBeOnTheScreen();
    expect(within(day(thursday)).getByText('Thu')).toBeOnTheScreen();
    expect(within(day(thursday)).getByText('8')).toBeOnTheScreen();
    // The week is asked for in the days of the place, not of the phone.
    expect(api.fetchCalendar).toHaveBeenCalledWith('2026-10-05', '2026-10-11');
  });

  it('starts from the day at the place when the phone is on another date', async () => {
    // Close to midnight far to the west: the forecast is stamped with the 4th there.
    jest.mocked(weatherApi.fetchWeatherToday).mockResolvedValue({ ...weather, from: '2026-10-04T23:00:00-11:00' });
    api.fetchCalendar.mockResolvedValue(calendarOf([], '2026-10-04'));

    await renderScreen(<Today />);

    await waitFor(() => expect(api.fetchCalendar).toHaveBeenCalledWith('2026-10-04', '2026-10-10'));
    expect(within(screen.getByTestId('week-day-2026-10-04')).getByText('Today')).toBeOnTheScreen();
    expect(screen.queryByTestId('week-day-2026-10-11')).toBeNull();
  });

  it('gives one selection tick when the day changes and none for the day that is already chosen', async () => {
    await renderScreen(<Today />);
    await screen.findByTestId('today-planned');
    select.mockClear();

    await fireEvent.press(day('2026-10-05'));
    expect(select).not.toHaveBeenCalled();

    await fireEvent.press(day(thursday));
    expect(select).toHaveBeenCalledTimes(1);
    expect(day(thursday).props.accessibilityState.checked).toBe(true);
    expect(day('2026-10-05').props.accessibilityState.checked).toBe(false);
  });
});

describe('the page turned to a day ahead', () => {
  it('shows that day’s forecast with its high in the large figure, no "now", and the hours by their clock', async () => {
    await toThursday();

    expect(fetchDay).toHaveBeenCalledWith(thursday);
    expect(screen.getByTestId('weather-high')).toHaveTextContent('High');
    expect(screen.getByTestId('weather-now')).toHaveTextContent('11°');
    expect(screen.getByTestId('weather-range')).toHaveTextContent('Feels like 4-11°C. Cold and wet. Dress warm and stay dry.');
    const hours = within(screen.getByTestId('weather-hours'));
    expect(hours.queryByText('Now')).toBeNull();
    expect(hours.getByText('7 am')).toBeOnTheScreen();
    expect(hours.getByText('12 pm')).toBeOnTheScreen();
    expect(hours.getByText('5 pm')).toBeOnTheScreen();
    expect(hours.getByText('10 pm')).toBeOnTheScreen();
    expect(screen.getByTestId('weather-row').props.accessibilityLabel).toBe(
      'Gliwice, Thursday. Feels like 4-11°C. Rain from 3 pm. Cold and wet. Dress warm and stay dry. 7 am: 4°. 12 pm: 10°. 5 pm: 9° rain. 10 pm: 6° rain.',
    );
    // The greeting and the date over it stay today's.
    expect(screen.getByTestId('today-date')).toHaveTextContent('Monday · October 5');
  });

  it('says what the forecast of that day could not be had, and tries again', async () => {
    fetchDay.mockRejectedValueOnce(new ApiError({ status: 503, code: 'weather_unavailable' }));
    await renderScreen(<Today />);
    await screen.findByTestId('today-planned');

    await fireEvent.press(day(thursday));
    expect(await screen.findByTestId('weather-problem')).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('weather-retry'));
    expect(await screen.findByTestId('weather-high')).toBeOnTheScreen();
  });

  it('shows what is planned for the day, each outfit a way into it with the day carried along', async () => {
    await toThursday();

    const section = within(screen.getByTestId('today-planned'));
    expect(screen.getByTestId('today-planned-title')).toHaveTextContent('Planned for Thursday');
    expect(section.getByText('Office look')).toBeOnTheScreen();
    // The care label lies on the board, which the row speaks for: "Office look, planned".
    expect(section.getByText('Planned', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(section.getByTestId('calendar-board-p1', { includeHiddenElements: true })).toBeOnTheScreen();
    // A day ahead cannot be worn yet: only taking the plan off it is offered.
    expect(section.queryByRole('button', { name: 'I wore this' })).toBeNull();
    expect(section.getByRole('button', { name: 'Remove from this day' })).toBeOnTheScreen();

    await fireEvent.press(section.getByRole('button', { name: 'Office look, planned' }));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/outfit/[id]', params: { id: 'p1', date: thursday } });
  });

  it('makes nothing until asked: the occasions and one button that leads to looks for that day', async () => {
    await toThursday();

    // Today's picks were made for today only; a day ahead costs nothing until the button is pressed.
    expect(screen.queryByTestId('today-picks')).toBeNull();
    expect(fetchPicks).toHaveBeenCalledTimes(1);
    expect(outfits.suggestOutfits).not.toHaveBeenCalled();
    expect(screen.getByTestId('today-occasions')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('radio', { name: 'Work' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Suggest looks for Thursday' }));

    expect(router.push).toHaveBeenCalledWith({ pathname: '/proposals', params: expect.objectContaining({ occasion: 'work', date: thursday }) });
    expect(outfits.suggestOutfits).not.toHaveBeenCalled();
  });

  it('names tomorrow as tomorrow', async () => {
    await renderScreen(<Today />);
    await screen.findByTestId('today-planned');

    await fireEvent.press(day('2026-10-06'));

    expect(await screen.findByRole('button', { name: 'Suggest looks for tomorrow' })).toBeOnTheScreen();
    expect(screen.queryByTestId('today-planned')).toBeNull();
  });

  it('keeps what is about the wardrobe as it is now on today’s own page', async () => {
    await renderScreen(<Today />);
    expect(await screen.findByTestId('today-nudge')).toBeOnTheScreen();
    expect(screen.getByTestId('today-colors')).toBeOnTheScreen();
    expect(await screen.findByTestId('today-forgotten')).toBeOnTheScreen();

    await fireEvent.press(day(thursday));

    expect(screen.queryByTestId('today-nudge')).toBeNull();
    expect(screen.queryByTestId('today-colors')).toBeNull();
    expect(screen.queryByTestId('today-forgotten')).toBeNull();
  });

  it('puts a saved outfit on the day: shown at once, felt when the server has it', async () => {
    const added = { ...calendarEntry(dinner, thursday), id: 'e-new' };
    api.addCalendarEntry.mockImplementation(async () => {
      // From now on the server's calendar holds it too.
      api.fetchCalendar.mockResolvedValue(calendarOf([calendarEntry(office, thursday), added, calendarEntry(dinner, '2026-10-05')]));
      return added;
    });
    await toThursday();

    await fireEvent.press(screen.getByRole('link', { name: 'Pick from saved outfits' }));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/pick-outfit', params: { date: thursday } });

    await act(async () => finishPickOutfit(dinner));

    expect(await screen.findByTestId('calendar-entry-p2')).toBeOnTheScreen();
    expect(api.addCalendarEntry).toHaveBeenCalledWith(thursday, 'p2', undefined);
    await waitFor(() => expect(notification).toHaveBeenCalledWith('success'));
    expect(day(thursday).props.accessibilityLabel).toBe('Thursday, October 8, 2 planned outfits');
  });

  it('takes the outfit back off the day and says why when the server refuses it', async () => {
    api.addCalendarEntry.mockRejectedValue(new ApiError({ status: 409, code: 'calendar_day_full' }));
    await toThursday();
    await fireEvent.press(screen.getByRole('link', { name: 'Pick from saved outfits' }));

    await act(async () => finishPickOutfit(dinner));

    expect(await screen.findByText('That day already has three outfits. Remove one to add another.')).toBeOnTheScreen();
    expect(screen.queryByTestId('calendar-entry-p2')).toBeNull();
    expect(notification).toHaveBeenCalledWith('error');
    expect(notification).not.toHaveBeenCalledWith('success');
  });

  it('adds nothing when the sheet is closed without a pick', async () => {
    await toThursday();
    await fireEvent.press(screen.getByRole('link', { name: 'Pick from saved outfits' }));

    await act(async () => finishPickOutfit(null));

    expect(api.addCalendarEntry).not.toHaveBeenCalled();
  });

  it('removes a plan with a light tap and no question, and puts it back when the server refuses', async () => {
    const impact = jest.mocked(Haptics.impactAsync);
    api.removeCalendarEntry.mockRejectedValueOnce(new ApiError({ status: 0, code: 'network' })).mockImplementationOnce(async () => {
      api.fetchCalendar.mockResolvedValue(calendarOf([calendarEntry(dinner, '2026-10-05')]));
    });
    await toThursday();
    impact.mockClear();

    // Refused: the plan is back where it was, with the usual line about why.
    await fireEvent.press(screen.getByTestId('calendar-remove-p1'));

    expect(impact.mock.calls).toEqual([['light']]);
    expect(await screen.findByText('Can’t connect right now. Check your internet connection and try again.')).toBeOnTheScreen();
    expect(screen.getByTestId('calendar-entry-p1')).toBeOnTheScreen();
    expect(api.removeCalendarEntry).toHaveBeenCalledWith(`e-p1-${thursday}`);

    // Taken: the day holds nothing any more, and nobody was asked "are you sure".
    await fireEvent.press(screen.getByTestId('calendar-remove-p1'));

    await waitFor(() => expect(screen.queryByTestId('today-planned')).toBeNull());
    expect(day(thursday).props.accessibilityLabel).toBe('Thursday, October 8');
  });
});

describe('today’s own page', () => {
  it('shows what is planned for today under the picks, and "I wore this" turns the plan into a worn day', async () => {
    api.updateCalendarEntry.mockResolvedValue(calendarEntry(dinner, '2026-10-05', true));
    await renderScreen(<Today />);

    expect(await screen.findByTestId('today-planned-title')).toHaveTextContent('Planned for today');
    expect(await screen.findByTestId('today-picks')).toBeOnTheScreen();
    // Today's own outfit opens as any outfit does: there is no day ahead to carry along.
    await fireEvent.press(screen.getByRole('button', { name: 'Date or night out, planned' }));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/outfit/[id]', params: { id: 'p2' } });

    api.fetchCalendar.mockResolvedValue(calendarOf([calendarEntry(office, thursday), calendarEntry(dinner, '2026-10-05', true)]));
    await fireEvent.press(screen.getByRole('button', { name: 'I wore this' }));

    expect(api.updateCalendarEntry).toHaveBeenCalledWith('e-p2-2026-10-05', true);
    // The title is already on the screen as "Planned for today": wait for it to change, not merely to be there.
    await waitFor(() => expect(screen.getByTestId('today-planned-title')).toHaveTextContent('Worn today'));
    expect(within(screen.getByTestId('today-planned')).getByText('Worn', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'I wore this' })).toBeNull();
    await waitFor(() => expect(notification).toHaveBeenCalledWith('success'));
    expect(day('2026-10-05').props.accessibilityLabel).toBe('Monday, October 5, today, 1 worn outfit');
  });

  it('is where the page starts again after the tab was left', async () => {
    await toThursday();

    // Another tab comes to the front, then this one again (a press on the page makes it draw itself anew, as a real change of focus would).
    jest.mocked(useIsFocused).mockReturnValue(false);
    await fireEvent.press(screen.getByRole('radio', { name: 'Work' }));
    jest.mocked(useIsFocused).mockReturnValue(true);
    await fireEvent.press(screen.getByRole('radio', { name: 'Everyday' }));

    await waitFor(() => expect(day('2026-10-05').props.accessibilityState.checked).toBe(true));
    expect(day(thursday).props.accessibilityState.checked).toBe(false);
    expect(screen.queryByTestId('weather-high')).toBeNull();
    expect(await screen.findByTestId('today-picks')).toBeOnTheScreen();
    expect(screen.getByTestId('today-nudge')).toBeOnTheScreen();
  });
});
