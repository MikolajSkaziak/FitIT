import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react-native';
import type { ReactElement } from 'react';

import { PhotoPeekHost } from '@/components/PhotoPeek';
import { failureCue } from '@/lib/failureCue';

/** Stand-in for the router: screens are tested for *where* they send the person, not for the navigation itself. */
export const router = {
  push: jest.fn(),
  replace: jest.fn(),
  navigate: jest.fn(),
  back: jest.fn(),
  dismiss: jest.fn(),
  dismissTo: jest.fn(),
};

export const routerModule = {
  useRouter: () => router,
  useLocalSearchParams: jest.fn(() => ({})),
  usePathname: jest.fn(() => '/'),
  useFocusEffect: (effect: () => void) => effect(),
  useIsFocused: () => true,
  Redirect: () => null,
};

const clients: QueryClient[] = [];

// Cached results hold timers; left alone they keep the test process alive long after the tests are done.
afterEach(() => {
  for (const client of clients.splice(0)) {
    client.clear();
  }
});

/** Renders a screen with what every screen expects around it: a query client that never retries or caches (and feels a failed action, as the app's does), and the host of the photo peek. */
export function renderScreen(screen: ReactElement) {
  const client = new QueryClient({ mutationCache: new MutationCache({ onError: failureCue }), defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false, gcTime: 0 } } });
  clients.push(client);
  return render(<QueryClientProvider client={client}>
      <PhotoPeekHost>{screen}</PhotoPeekHost>
    </QueryClientProvider>);
}

/** The title on screen has `word` as its accent, performing `act` (`none` when it only sits there in green italic). */
export function expectAccent(act: string, word: string) {
  expect(screen.getByTestId(`title-accent-${act}`, { hidden: true })).toBeOnTheScreen();
  expect(screen.getByTestId('title-accent', { hidden: true })).toHaveTextContent(word);
}

/** The title on screen has no accent word. */
export function expectNoAccent() {
  expect(screen.queryByTestId('title-accent', { hidden: true })).toBeNull();
}
