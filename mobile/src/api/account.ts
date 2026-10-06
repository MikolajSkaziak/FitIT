import { api, type Schemas } from './client';
import { unwrap } from './problem';

export type Gender = Schemas['Gender'];
export type StyleTag = Schemas['StyleTag'];
export type ThermalPreference = Schemas['ThermalPreference'];
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

export const queryKeys = {
  avatars: (gender: Gender) => ['avatars', gender] as const,
  places: (query: string) => ['places', query] as const,
};
