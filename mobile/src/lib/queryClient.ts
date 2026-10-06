import { QueryClient } from '@tanstack/react-query';

import { ApiError } from '@/api/problem';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // One more try helps with a flaky connection; an answer from the server (4xx) will not change by asking again.
      retry: (failures, error) => failures < 1 && error instanceof ApiError && (error.code === 'network' || error.problem.status >= 500),
    },
    mutations: { retry: false },
  },
});
