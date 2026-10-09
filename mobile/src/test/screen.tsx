import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react-native';
import type { ReactElement } from 'react';

import { PhotoPeekHost } from '@/components/PhotoPeek';

/** Stand-in for the router: screens are tested for *where* they send the person, not for the navigation itself. */
export const router = {
  push: jest.fn(),
  replace: jest.fn(),
  navigate: jest.fn(),
  back: jest.fn(),
  dismissTo: jest.fn(),
};

export const routerModule = {
  useRouter: () => router,
  useLocalSearchParams: jest.fn(() => ({})),
  usePathname: jest.fn(() => '/'),
  useFocusEffect: (effect: () => void) => effect(),
  Redirect: () => null,
};

const clients: QueryClient[] = [];

// Cached results hold timers; left alone they keep the test process alive long after the tests are done.
afterEach(() => {
  for (const client of clients.splice(0)) {
    client.clear();
  }
});

/** Renders a screen with what every screen expects around it: a query client that never retries or caches, and the host of the photo peek. */
export function renderScreen(screen: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false, gcTime: 0 } } });
  clients.push(client);
  return render(<QueryClientProvider client={client}>
      <PhotoPeekHost>{screen}</PhotoPeekHost>
    </QueryClientProvider>);
}
