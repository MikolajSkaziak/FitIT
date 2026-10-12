import { MutationCache, QueryClient } from '@tanstack/react-query';

import { ApiError } from '@/api/problem';
import { onSessionEnd } from '@/auth/session';

import { failureCue } from './failureCue';

export const queryClient = new QueryClient({
  mutationCache: new MutationCache({ onError: failureCue }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // One more try helps with a flaky connection; an answer from the server (4xx) will not change by asking again.
      retry: (failures, error) => failures < 1 && error instanceof ApiError && (error.code === 'network' || error.problem.status >= 500),
    },
    mutations: { retry: false },
  },
});

// What was loaded for one person must not be shown to the next one who signs in on this phone.
onSessionEnd(() => queryClient.clear());
