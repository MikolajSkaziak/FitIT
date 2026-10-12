import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams } from 'expo-router';

import * as calendarApi from '@/api/calendar';
import * as outfits from '@/api/outfits';
import { ApiError } from '@/api/problem';
import OutfitDetail from '@/app/(app)/outfit/[id]';
import Outfits from '@/app/(app)/(tabs)/outfits';
import { useSession } from '@/auth/session';
import { finishPickOutfit } from '@/features/calendar/session';
import * as dates from '@/lib/dates';
import { calendarEntry, calendarOf, outfit, user } from '@/test/fixtures';
import { renderScreen, router } from '@/test/screen';

jest.mock('expo-router', () => jest.requireActual('@/test/screen').routerModule);
jest.mock('@/lib/config', () => ({ apiUrl: 'http://api.test' }));
jest.mock('@/auth/tokenStorage', () => ({
  tokenStorage: { load: jest.fn(async () => null), save: jest.fn(async () => undefined), clear: jest.fn(async () => undefined) },
}));
jest.mock('@/api/calendar', () => jest.requireActual('@/test/calendar').quietCalendar());
jest.mock('@/api/outfits', () => ({ ...jest.requireActual('@/api/outfits'), fetchSavedOutfits: jest.fn(), fetchOutfit: jest.fn(), updateOutfit: jest.fn() }));
jest.mock('@/api/wardrobe', () => ({ ...jest.requireActual('@/api/wardrobe'), fetchDictionaries: jest.fn(async () => ({ categories: [], groups: [], colors: [], patterns: [], materials: [], formality: [], warmth: [], styles: [], seasons: [] })) }));
// The phone's own date, which stands in until the server says what day it is at the person's place: Monday 5 October 2026.
jest.mock('@/lib/dates', () => ({ ...jest.requireActual('@/lib/dates'), today: jest.fn(), firstWeekdayOf: jest.fn() }));

const api = jest.mocked(calendarApi);
const savedApi = jest.mocked(outfits);
const select = jest.mocked(Haptics.selectionAsync);
const notification = jest.mocked(Haptics.notificationAsync);

const office = outfit('p1', { name: 'Office look', occasion: 'work', isSaved: true });
const dinner = outfit('p2', { occasion: 'date', isSaved: true });
const gym = outfit('p3', { occasion: 'workout', isSaved: true });

/** What October 2026 holds: two outfits worn on the 2nd, one planned for the 8th. */
const october = () => calendarOf([calendarEntry(office, '2026-10-02', true), calendarEntry(dinner, '2026-10-02', true), calendarEntry(office, '2026-10-08')]);

// What a change asked the server again is let to arrive before the screen is taken down.
afterEach(async () => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(dates.today).mockReturnValue({ day: 5, month: 10, year: 2026 });
  // Weeks start on Monday unless a test says otherwise.
  jest.mocked(dates.firstWeekdayOf).mockReturnValue(1);
  jest.mocked(useLocalSearchParams).mockReturnValue({});
  useSession.setState({ status: 'signedIn', user: user(), accessToken: 'a', refreshToken: 'r' });
  savedApi.fetchSavedOutfits.mockResolvedValue([office, dinner, gym]);
  api.fetchCalendar.mockImplementation(async (from) => (from === '2026-10-01' ? october() : calendarOf([])));
});

const cell = (date: string) => screen.getByTestId(`month-grid-${date}`);
const openCalendar = async () => {
  await renderScreen(<Outfits />);
  await fireEvent.press(await screen.findByRole('tab', { name: 'Calendar' }));
  await screen.findByTestId('month-grid');
};

describe('the calendar of the Outfits tab', () => {
  it('shows the month of today, asked for by its first and last day, with the weekdays over it', async () => {
    await openCalendar();

    expect(api.fetchCalendar).toHaveBeenCalledWith('2026-10-01', '2026-10-31');
    expect(screen.getByRole('header', { name: 'October' })).toBeOnTheScreen();
    // Monday first; the initials are for the eye, every cell says its whole date.
    expect(within(screen.getByTestId('month-grid')).getAllByText(/^[MTWFS]$/, { includeHiddenElements: true }).map((initial) => initial.props.children)).toEqual(['M', 'T', 'W', 'T', 'F', 'S', 'S']);
    expect(within(screen.getByTestId('month-grid')).getAllByRole('button')).toHaveLength(31);
    // No way back to today is offered on today's own month.
    expect(screen.queryByRole('link', { name: 'Today' })).toBeNull();
  });

  it('starts the weeks on the day the phone’s region starts them', async () => {
    jest.mocked(dates.firstWeekdayOf).mockReturnValue(0);
    await openCalendar();

    expect(within(screen.getByTestId('month-grid')).getAllByText(/^[MTWFS]$/, { includeHiddenElements: true }).map((initial) => initial.props.children)).toEqual(['S', 'M', 'T', 'W', 'T', 'F', 'S']);
  });

  it('says for every day what it holds, which one is today and which one is chosen', async () => {
    await openCalendar();

    expect(cell('2026-10-05').props.accessibilityLabel).toBe('Monday, October 5, today, selected');
    expect(cell('2026-10-05').props.accessibilityState).toMatchObject({ selected: true });
    expect(cell('2026-10-02').props.accessibilityLabel).toBe('Friday, October 2, 2 worn outfits');
    expect(cell('2026-10-08').props.accessibilityLabel).toBe('Thursday, October 8, 1 planned outfit');
    expect(cell('2026-10-09').props.accessibilityLabel).toBe('Friday, October 9');
    // A second outfit on a day is counted beside the mark.
    expect(within(cell('2026-10-02')).getByText('+1', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(within(cell('2026-10-08')).queryByText('+1', { includeHiddenElements: true })).toBeNull();
  });

  it('holds the place of the month with a shimmering grid while it is on its way', async () => {
    let arrive: (value: calendarApi.Calendar) => void = () => undefined;
    api.fetchCalendar.mockReturnValue(new Promise((resolve) => (arrive = resolve)));
    await renderScreen(<Outfits />);
    await fireEvent.press(await screen.findByRole('tab', { name: 'Calendar' }));

    expect(screen.getByTestId('month-grid-loading').props.accessibilityLabel).toBe('Loading the calendar');
    expect(screen.queryByTestId('month-grid')).toBeNull();
    expect(screen.queryByTestId('calendar-day')).toBeNull();

    await act(async () => arrive(october()));
    expect(await screen.findByTestId('month-grid')).toBeOnTheScreen();
  });

  it('says what happened when the month cannot be loaded, and tries again', async () => {
    api.fetchCalendar.mockRejectedValueOnce(new ApiError({ status: 0, code: 'network' }));
    await renderScreen(<Outfits />);
    await fireEvent.press(await screen.findByRole('tab', { name: 'Calendar' }));

    expect(await screen.findByTestId('calendar-problem')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('calendar-retry'));

    expect(await screen.findByTestId('month-grid')).toBeOnTheScreen();
  });

  it('pages through the months, each asked for by its own range, with a way back to today', async () => {
    await openCalendar();

    await fireEvent.press(screen.getByRole('button', { name: 'Next month' }));
    expect(await screen.findByRole('header', { name: 'November' })).toBeOnTheScreen();
    await waitFor(() => expect(api.fetchCalendar).toHaveBeenCalledWith('2026-11-01', '2026-11-30'));
    // The day under the grid follows the page: the first of a month that is not today's.
    expect(await screen.findByTestId('calendar-day-title')).toHaveTextContent('Sunday, November 1');

    await fireEvent.press(screen.getByRole('button', { name: 'Next month' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Next month' }));
    expect(await screen.findByRole('header', { name: 'January 2027' })).toBeOnTheScreen();
    await waitFor(() => expect(api.fetchCalendar).toHaveBeenCalledWith('2027-01-01', '2027-01-31'));

    await fireEvent.press(screen.getByRole('link', { name: 'Today' }));
    expect(await screen.findByRole('header', { name: 'October' })).toBeOnTheScreen();
    expect(await screen.findByTestId('calendar-day-title')).toHaveTextContent('Monday, October 5');

    await fireEvent.press(screen.getByRole('button', { name: 'Previous month' }));
    expect(await screen.findByRole('header', { name: 'September' })).toBeOnTheScreen();
    await waitFor(() => expect(api.fetchCalendar).toHaveBeenCalledWith('2026-09-01', '2026-09-30'));
  });

  it('keeps a month it has shown, so paging back to it asks for nothing', async () => {
    const { QueryClient, QueryClientProvider } = jest.requireActual<typeof import('@tanstack/react-query')>('@tanstack/react-query');
    const { render } = jest.requireActual<typeof import('@testing-library/react-native')>('@testing-library/react-native');
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 60_000 } } });
    await render(
      <QueryClientProvider client={client}>
        <Outfits />
      </QueryClientProvider>,
    );
    await fireEvent.press(await screen.findByRole('tab', { name: 'Calendar' }));
    await screen.findByTestId('month-grid');

    await fireEvent.press(screen.getByRole('button', { name: 'Next month' }));
    await screen.findByRole('header', { name: 'November' });
    await screen.findByTestId('month-grid');
    await fireEvent.press(screen.getByRole('button', { name: 'Previous month' }));

    // October is there at once, from what the phone kept.
    expect(screen.getByTestId('month-grid-2026-10-08').props.accessibilityLabel).toBe('Thursday, October 8, 1 planned outfit');
    expect(api.fetchCalendar.mock.calls.map(([from]) => from)).toEqual(['2026-10-01', '2026-11-01']);
    client.clear();
  });

  it('shows the outfits of the day that is chosen, each a way into the outfit', async () => {
    await openCalendar();
    expect(screen.getByTestId('calendar-day-title')).toHaveTextContent('Monday, October 5');
    expect(screen.getByTestId('calendar-day-empty')).toHaveTextContent('Nothing here yet.');
    select.mockClear();

    await fireEvent.press(cell('2026-10-02'));

    expect(select).toHaveBeenCalledTimes(1);
    expect(cell('2026-10-02').props.accessibilityLabel).toBe('Friday, October 2, 2 worn outfits, selected');
    expect(screen.getByTestId('calendar-day-title')).toHaveTextContent('Friday, October 2');
    const day = within(screen.getByTestId('calendar-day'));
    expect(day.getByText('Office look')).toBeOnTheScreen();
    expect(day.getByText('Date or night out')).toBeOnTheScreen();
    expect(within(screen.getByTestId('calendar-entry-tag-p1')).getByText('Worn')).toBeOnTheScreen();
    expect(day.getByTestId('calendar-board-p2', { includeHiddenElements: true })).toBeOnTheScreen();
    // Worn already: nothing to confirm, only to take off the day.
    expect(day.queryByRole('button', { name: 'I wore this' })).toBeNull();
    expect(day.getAllByRole('button', { name: 'Remove from this day' })).toHaveLength(2);

    await fireEvent.press(day.getByRole('button', { name: 'Office look, worn' }));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/outfit/[id]', params: { id: 'p1' } });

    // A day ahead carries itself along, so the outfit's page can speak of it.
    await fireEvent.press(cell('2026-10-08'));
    expect(within(screen.getByTestId('calendar-entry-tag-p1')).getByText('Planned')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Office look, planned' }));
    expect(router.push).toHaveBeenLastCalledWith({ pathname: '/outfit/[id]', params: { id: 'p1', date: '2026-10-08' } });
  });

  it('opens on the month of a day it was sent to, with that day chosen', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ view: 'calendar', day: '2026-11-20' });
    api.fetchCalendar.mockResolvedValue(calendarOf([calendarEntry(office, '2026-11-20')]));

    await renderScreen(<Outfits />);

    expect(await screen.findByRole('header', { name: 'November' })).toBeOnTheScreen();
    expect(api.fetchCalendar).toHaveBeenCalledWith('2026-11-01', '2026-11-30');
    expect((await screen.findByTestId('month-grid-2026-11-20')).props.accessibilityLabel).toBe('Friday, November 20, 1 planned outfit, selected');
    expect(screen.getByRole('tab', { name: 'Calendar' }).props.accessibilityState.selected).toBe(true);
  });
});

describe('changing a day of the calendar', () => {
  it('adds a saved outfit to a day ahead as a plan: shown at once, kept when the server has it', async () => {
    api.addCalendarEntry.mockImplementation(async () => {
      api.fetchCalendar.mockResolvedValue(calendarOf([...october().days.flatMap((day) => day.entries), calendarEntry(gym, '2026-10-09')]));
      return calendarEntry(gym, '2026-10-09');
    });
    await openCalendar();
    await fireEvent.press(cell('2026-10-09'));

    await fireEvent.press(screen.getByRole('button', { name: 'Add an outfit to this day' }));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/pick-outfit', params: { date: '2026-10-09' } });
    await act(async () => finishPickOutfit(gym));

    expect(await screen.findByTestId('calendar-entry-p3')).toBeOnTheScreen();
    expect(within(screen.getByTestId('calendar-entry-tag-p3')).getByText('Planned')).toBeOnTheScreen();
    expect(api.addCalendarEntry).toHaveBeenCalledWith('2026-10-09', 'p3', undefined);
    await waitFor(() => expect(notification).toHaveBeenCalledWith('success'));
    expect(cell('2026-10-09').props.accessibilityLabel).toBe('Friday, October 9, 1 planned outfit, selected');
    expect(screen.queryByTestId('calendar-day-empty')).toBeNull();
  });

  it('adds an outfit to a day that has passed as worn', async () => {
    api.addCalendarEntry.mockImplementation(async () => {
      api.fetchCalendar.mockResolvedValue(calendarOf([calendarEntry(gym, '2026-10-01', true)]));
      return calendarEntry(gym, '2026-10-01', true);
    });
    await openCalendar();
    await fireEvent.press(cell('2026-10-01'));
    await fireEvent.press(screen.getByRole('button', { name: 'Add an outfit to this day' }));

    await act(async () => finishPickOutfit(gym));

    expect(api.addCalendarEntry).toHaveBeenCalledWith('2026-10-01', 'p3', true);
    expect(within(await screen.findByTestId('calendar-entry-tag-p3')).getByText('Worn')).toBeOnTheScreen();
    await waitFor(() => expect(cell('2026-10-01').props.accessibilityLabel).toBe('Thursday, October 1, 1 worn outfit, selected'));
  });

  it('takes the outfit back off the day and says why when the server refuses it', async () => {
    api.addCalendarEntry.mockRejectedValue(new ApiError({ status: 409, code: 'calendar_day_full' }));
    await openCalendar();
    await fireEvent.press(cell('2026-10-09'));
    await fireEvent.press(screen.getByRole('button', { name: 'Add an outfit to this day' }));

    await act(async () => finishPickOutfit(gym));

    expect(await screen.findByText('That day already has three outfits. Remove one to add another.')).toBeOnTheScreen();
    expect(screen.queryByTestId('calendar-entry-p3')).toBeNull();
    expect(screen.getByTestId('calendar-day-empty')).toBeOnTheScreen();
    expect(notification).toHaveBeenCalledWith('error');
  });

  it('confirms a planned day that has come, and goes back to planned when the server refuses', async () => {
    const tuesday = calendarEntry(dinner, '2026-10-03');
    api.fetchCalendar.mockResolvedValue(calendarOf([tuesday]));
    api.updateCalendarEntry.mockRejectedValueOnce(new ApiError({ status: 0, code: 'network' })).mockImplementationOnce(async () => {
      api.fetchCalendar.mockResolvedValue(calendarOf([{ ...tuesday, worn: true }]));
      return { ...tuesday, worn: true };
    });
    await openCalendar();
    await fireEvent.press(cell('2026-10-03'));
    // The day has passed and nobody said it was worn: it is still a plan.
    expect(cell('2026-10-03').props.accessibilityLabel).toBe('Saturday, October 3, 1 planned outfit, selected');

    await fireEvent.press(screen.getByRole('button', { name: 'I wore this' }));
    expect(await screen.findByText('Can’t connect right now. Check your internet connection and try again.')).toBeOnTheScreen();
    expect(within(screen.getByTestId('calendar-entry-tag-p2')).getByText('Planned')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'I wore this' }));
    await waitFor(() => expect(within(screen.getByTestId('calendar-entry-tag-p2')).getByText('Worn')).toBeOnTheScreen());
    expect(api.updateCalendarEntry).toHaveBeenLastCalledWith(tuesday.id, true);
    await waitFor(() => expect(notification).toHaveBeenCalledWith('success'));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'I wore this' })).toBeNull());
  });

  it('removes an outfit from a day, and puts it back when the server refuses', async () => {
    api.removeCalendarEntry.mockRejectedValueOnce(new ApiError({ status: 0, code: 'network' })).mockImplementationOnce(async () => {
      api.fetchCalendar.mockResolvedValue(calendarOf([]));
    });
    await openCalendar();
    await fireEvent.press(cell('2026-10-08'));

    await fireEvent.press(screen.getByRole('button', { name: 'Remove from this day' }));
    expect(await screen.findByText('Can’t connect right now. Check your internet connection and try again.')).toBeOnTheScreen();
    expect(screen.getByTestId('calendar-entry-p1')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Remove from this day' }));
    expect(api.removeCalendarEntry).toHaveBeenLastCalledWith('e-p1-2026-10-08');
    await waitFor(() => expect(screen.queryByTestId('calendar-entry-p1')).toBeNull());
    expect(await screen.findByTestId('calendar-day-empty')).toBeOnTheScreen();
    await waitFor(() => expect(cell('2026-10-08').props.accessibilityLabel).toBe('Thursday, October 8, selected'));
  });
});

describe('"Wear this today"', () => {
  it('shows up on today in the calendar', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ id: 'p3' });
    savedApi.fetchOutfit.mockResolvedValue(gym);
    api.fetchCalendar.mockResolvedValue(calendarOf([]));
    savedApi.updateOutfit.mockImplementation(async () => {
      // The server wrote today into the calendar together with the wear.
      api.fetchCalendar.mockResolvedValue(calendarOf([calendarEntry(gym, '2026-10-05', true)]));
      return { ...gym, wornOn: '2026-10-05' };
    });
    // The calendar of the Outfits tab and the outfit's own page, alive together as they are in the app.
    await renderScreen(
      <>
        <Outfits />
        <OutfitDetail />
      </>,
    );
    await fireEvent.press(await screen.findByRole('tab', { name: 'Calendar' }));
    await screen.findByTestId('month-grid');
    expect(cell('2026-10-05').props.accessibilityLabel).toBe('Monday, October 5, today, selected');

    await fireEvent.press(await screen.findByTestId('outfit-wear'));

    await waitFor(() => expect(cell('2026-10-05').props.accessibilityLabel).toBe('Monday, October 5, today, 1 worn outfit, selected'));
    expect(within(await screen.findByTestId('calendar-entry-tag-p3')).getByText('Worn')).toBeOnTheScreen();
    expect(savedApi.updateOutfit).toHaveBeenCalledWith('p3', { worn: true });
  });
});
