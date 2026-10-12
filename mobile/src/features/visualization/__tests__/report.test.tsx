import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, renderHook, screen, waitFor } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams } from 'expo-router';
import type { ReactNode } from 'react';

import type { Outfit, Suggestions } from '@/api/outfits';
import { ApiError, networkProblem } from '@/api/problem';
import * as visualizations from '@/api/visualizations';
import ReportProblem from '@/app/(app)/report';
import { finishConsent } from '@/features/consent/session';
import { useSession } from '@/auth/session';
import { noticeFor, pictureCaption } from '@/features/visualization/copy';
import { detachVisualization } from '@/features/visualization/attach';
import { TryOnButton, type OutfitViewer } from '@/features/visualization/OutfitVisualization';
import { ReportLink } from '@/features/visualization/ReportLink';
import { report, useReports } from '@/features/visualization/report';
import { useVisualization } from '@/features/visualization/useVisualization';
import { outfit, user } from '@/test/fixtures';
import { renderScreen, router } from '@/test/screen';

jest.mock('expo-router', () => jest.requireActual('@/test/screen').routerModule);
jest.mock('@/lib/config', () => ({ apiUrl: 'http://api.test' }));
jest.mock('@/auth/tokenStorage', () => ({
  tokenStorage: { load: jest.fn(async () => null), save: jest.fn(async () => undefined), clear: jest.fn(async () => undefined) },
}));
jest.mock('@/api/visualizations', () => ({ ...jest.requireActual('@/api/visualizations'), reportVisualization: jest.fn() }));
jest.mock('@/api/wardrobe', () => ({ ...jest.requireActual('@/api/wardrobe'), fetchUsage: jest.fn(() => new Promise(() => undefined)) }));

const api = jest.mocked(visualizations);

beforeEach(() => {
  jest.clearAllMocks();
  useReports.setState({ sent: {} });
  jest.mocked(useLocalSearchParams).mockReturnValue({ id: 'v1' });
});

describe('the link under the caption', () => {
  it('is a quiet "Report a problem" that opens the report sheet for this picture', async () => {
    await renderScreen(<ReportLink pictureId="v1" />);

    await fireEvent.press(screen.getByRole('link', { name: 'Report a problem' }));

    expect(router.push).toHaveBeenCalledWith({ pathname: '/report', params: { id: 'v1' } });
  });

  it('becomes the thanks line for that picture once it was reported, and only for that one', async () => {
    await renderScreen(
      <>
        <ReportLink pictureId="v1" />
        <ReportLink pictureId="v2" />
      </>,
    );

    await act(async () => useReports.getState().record('v1', 'distorted'));

    expect(screen.getByText('Thanks — reported.')).toBeOnTheScreen();
    expect(screen.getAllByRole('link', { name: 'Report a problem' })).toHaveLength(1);
  });
});

describe('the report sheet', () => {
  it('lists the reasons as options and sends nothing until one is chosen', async () => {
    await renderScreen(<ReportProblem />);

    for (const label of ['Wrong clothes', 'Looks distorted', 'Inappropriate or offensive', 'Something else']) {
      expect(screen.getByRole('radio', { name: label })).toBeOnTheScreen();
    }
    expect(screen.getByRole('button', { name: 'Send report' })).toBeDisabled();
    await fireEvent.press(screen.getByRole('button', { name: 'Send report' }));
    expect(api.reportVisualization).not.toHaveBeenCalled();
  });

  it('sends the chosen reason, feels the success once, closes, and the picture’s link is replaced', async () => {
    api.reportVisualization.mockResolvedValue(undefined);
    await renderScreen(<ReportProblem />);

    await fireEvent.press(screen.getByRole('radio', { name: 'Looks distorted' }));
    jest.mocked(Haptics.notificationAsync).mockClear();
    await fireEvent.press(screen.getByRole('button', { name: 'Send report' }));

    await waitFor(() => expect(api.reportVisualization).toHaveBeenCalledWith('v1', 'distorted'));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect(useReports.getState().sent).toEqual({ v1: 'distorted' });
    expect(jest.mocked(Haptics.notificationAsync).mock.calls).toEqual([['success']]);
  });

  it('stays with the usual error, and the link stays a link, when the report does not go through', async () => {
    api.reportVisualization.mockRejectedValue(new ApiError(networkProblem));
    await renderScreen(<ReportProblem />);

    await fireEvent.press(screen.getByRole('radio', { name: 'Something else' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Send report' }));

    expect(await screen.findByText('Can’t connect right now. Check your internet connection and try again.')).toBeOnTheScreen();
    expect(router.back).not.toHaveBeenCalled();
    expect(useReports.getState().sent).toEqual({});
    expect(jest.mocked(Haptics.notificationAsync).mock.calls).toEqual([['error']]);
  });

  it('closes without sending on the close button', async () => {
    await renderScreen(<ReportProblem />);

    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));

    expect(router.back).toHaveBeenCalled();
    expect(api.reportVisualization).not.toHaveBeenCalled();
  });

  it('takes an inappropriate picture off every outfit that holds it', async () => {
    api.reportVisualization.mockResolvedValue(undefined);
    const client = new QueryClient();
    const withPicture = outfit('o1', { visualization: { id: 'v1', status: 'completed', imageUrl: 'https://images.test/v1.jpg', imageKey: 'k1' } });
    const other = outfit('o2', { visualization: { id: 'v2', status: 'completed', imageUrl: 'https://images.test/v2.jpg', imageKey: 'k2' } });
    client.setQueryData<Suggestions>(['outfits', 'suggestions', 'x'], { outfits: [withPicture, other] } as Suggestions);
    client.setQueryData<Outfit>(['outfits', 'one', 'o1'], withPicture);

    detachVisualization(client, 'v1');

    expect(client.getQueryData<Suggestions>(['outfits', 'suggestions', 'x'])?.outfits.map((found) => found.visualization?.id ?? null)).toEqual([null, 'v2']);
    expect(client.getQueryData<Outfit>(['outfits', 'one', 'o1'])?.visualization).toBeNull();
  });

  it('reports an inappropriate picture to the server, which deletes it', async () => {
    api.reportVisualization.mockResolvedValue(undefined);
    await renderScreen(<ReportProblem />);

    await fireEvent.press(screen.getByRole('radio', { name: 'Inappropriate or offensive' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Send report' }));

    await waitFor(() => expect(api.reportVisualization).toHaveBeenCalledWith('v1', 'inappropriate'));
    expect(useReports.getState().sent).toEqual({ v1: 'inappropriate' });
  });
});

describe('an outfit’s picture that was reported as inappropriate', () => {
  const client = () => new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const wrapper = (queryClient: QueryClient) =>
    function Wrapper({ children }: { children: ReactNode }) {
      return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    };

  it('is let go of by the screen that shows it: the outfit is back to nothing ordered', async () => {
    const shown = outfit('o1', { visualization: { id: 'v1', status: 'completed', imageUrl: 'https://images.test/v1.jpg', imageKey: 'k1' } });
    const { result } = await renderHook(() => useVisualization(shown), { wrapper: wrapper(client()) });
    await waitFor(() => expect(result.current.stage).toBe('ready'));
    expect(result.current.picture?.id).toBe('v1');

    await act(async () => useReports.getState().record('v1', 'inappropriate'));

    await waitFor(() => expect(result.current.stage).toBe('none'));
    expect(result.current.picture).toBeNull();
  });

  it('stays on screen after a report of another kind', async () => {
    const shown = outfit('o1', { visualization: { id: 'v1', status: 'completed', imageUrl: 'https://images.test/v1.jpg', imageKey: 'k1' } });
    const { result } = await renderHook(() => useVisualization(shown), { wrapper: wrapper(client()) });
    await waitFor(() => expect(result.current.stage).toBe('ready'));

    await act(async () => useReports.getState().record('v1', 'wrong_clothes'));

    expect(result.current.stage).toBe('ready');
  });
});

describe('the words', () => {
  it('are the ones of the design', () => {
    expect(report.reasons.map((reason) => reason.label)).toEqual(['Wrong clothes', 'Looks distorted', 'Inappropriate or offensive', 'Something else']);
    expect(report.thanks).toBe('Thanks — reported.');
    expect(pictureCaption).toContain('generated preview');
  });
});

describe('the consent notice of the try-on', () => {
  const viewer = () => {
    const start = jest.fn();
    const notice = noticeFor('refused', 'consent_required');
    return {
      start,
      viewer: { picture: { stage: 'refused', notice, usedUp: false, start }, order: jest.fn() } as unknown as OutfitViewer,
    };
  };

  beforeEach(() => {
    finishConsent(false);
    useSession.setState({ status: 'signedIn', user: user({ aiConsentAt: '2026-10-02T08:00:00Z' }), accessToken: 'a', refreshToken: 'r' });
  });

  it('has an action that opens the consent sheet, even when this phone thought the consent stood', async () => {
    const { viewer: shown } = viewer();
    await renderScreen(<TryOnButton viewer={shown} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Review and allow' }));

    expect(router.push).toHaveBeenCalledWith({ pathname: '/consent', params: { kind: 'clothes' } });
  });

  it('orders the picture again only once the consent was given', async () => {
    const { viewer: shown, start } = viewer();
    await renderScreen(<TryOnButton viewer={shown} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Review and allow' }));
    expect(start).not.toHaveBeenCalled();
    await act(async () => finishConsent(true));

    await waitFor(() => expect(start).toHaveBeenCalledTimes(1));
  });

  it('does nothing more on Not now', async () => {
    const { viewer: shown, start } = viewer();
    await renderScreen(<TryOnButton viewer={shown} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Review and allow' }));
    await act(async () => finishConsent(false));

    expect(start).not.toHaveBeenCalled();
  });
});
