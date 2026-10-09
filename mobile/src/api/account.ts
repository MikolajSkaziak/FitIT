import type { Client } from 'openapi-fetch';

import { api, type Schemas } from './client';
import { unwrap } from './problem';
import type { paths } from './schema';

export type Gender = Schemas['Gender'];
export type StyleTag = Schemas['StyleTag'];
export type ThermalPreference = Schemas['ThermalPreference'];
export type ClothingSize = NonNullable<Schemas['ClothingSize']>;
export type LegLength = NonNullable<Schemas['LegLength']>;
export type Avatar = Schemas['AvatarResponse'];
export type PlaceMatch = Schemas['PlaceResponse'];
export type User = Schemas['UserResponse'];
export type ProfileChange = Schemas['UpdateProfileRequest'];

export const fetchAvatars = (gender: Gender): Promise<Avatar[]> => unwrap(api.GET('/api/avatars', { params: { query: { gender } } }));

export const searchPlaces = (query: string, signal?: AbortSignal): Promise<PlaceMatch[]> =>
  unwrap(api.GET('/api/locations', { params: { query: { query } }, signal }));

export const checkEmail = async (email: string): Promise<boolean> => (await unwrap(api.POST('/api/auth/email-check', { body: { email } }))).available;

export const register = (body: Schemas['RegisterRequest']): Promise<Schemas['AuthResponse']> => unwrap(api.POST('/api/auth/register', { body }));

export const login = (body: Schemas['LoginRequest']): Promise<Schemas['AuthResponse']> => unwrap(api.POST('/api/auth/login', { body }));

export const fetchMe = (): Promise<User> => unwrap(api.GET('/api/me'));

export const updateProfile = (body: ProfileChange): Promise<User> => unwrap(api.PATCH('/api/me', { body }));

/**
 * Three routes of tasks 5.1 and 5.2 (password reset, deleting the account) exist on the server, but `schema.d.ts` was
 * generated before them. They are described here in the generator's own shape so the calls stay typed; once
 * `npm run gen:api` has run against the current server this block and the cast below can go.
 */
type Failure = { headers: { [name: string]: unknown }; content: { 'application/problem+json': Schemas['ProblemDetails'] } };
type Operation<Body> = {
  parameters: { query?: never; header?: never; path?: never; cookie?: never };
  requestBody: { content: { 'application/json': Body } };
  responses: { 204: { headers: { [name: string]: unknown }; content?: never }; 400: Failure; 429: Failure };
};
type PendingPaths = Omit<paths, '/api/me'> & {
  '/api/auth/password-reset/request': { post: Operation<{ email: string }> };
  '/api/auth/password-reset/confirm': { post: Operation<{ email: string; code: string; newPassword: string }> };
  '/api/me': Omit<paths['/api/me'], 'delete'> & { delete: Operation<{ password: string }> };
};

const pending = api as unknown as Client<PendingPaths>;

/** Always succeeds, whether or not the address has an account; that is the server's answer, not an oversight. */
export const requestPasswordReset = async (email: string): Promise<void> => {
  await unwrap(pending.POST('/api/auth/password-reset/request', { body: { email } }));
};

/** The new password is set; every session of the account has ended, so the person signs in again. */
export const confirmPasswordReset = async (body: { email: string; code: string; newPassword: string }): Promise<void> => {
  await unwrap(pending.POST('/api/auth/password-reset/confirm', { body }));
};

/** Removes the account and everything in it; the password is the confirmation the server asks for. */
export const deleteAccount = async (password: string): Promise<void> => {
  await unwrap(pending.DELETE('/api/me', { body: { password } }));
};

export const queryKeys = {
  avatars: (gender: Gender) => ['avatars', gender] as const,
  places: (query: string) => ['places', query] as const,
};
