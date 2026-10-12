import { codeOf } from '@/api/problem';

import * as haptics from './haptics';

/** The answers that say a limit was reached, which is felt as a warning and not as a failure. */
const limits: readonly string[] = ['limit_reached', 'photo_limit_reached'];

/**
 * Something the person just did has failed: a form that was sent, a save that was taken back. Every action is a mutation and
 * nothing else is, so a query that fails in the background (a refetch) is never felt. Given to the mutation cache.
 */
export const failureCue = (error: unknown): void => (limits.includes(codeOf(error)) ? haptics.warning() : haptics.error());
