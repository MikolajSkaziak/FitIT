import { QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';
import type { ReactElement } from 'react';

import * as wardrobe from '@/api/wardrobe';
import EditGarment from '@/app/(app)/clothes/[id]/edit';
import GarmentDetail from '@/app/(app)/clothes/[id]/index';
import { useSession } from '@/auth/session';
import { aiNote } from '@/features/wardrobe/AiNote';
import { queryClient } from '@/lib/queryClient';
import { clothing, user, wardrobeDictionaries } from '@/test/fixtures';

jest.mock('expo-router', () => jest.requireActual('@/test/screen').routerModule);
jest.mock('@/lib/config', () => ({ apiUrl: 'http://api.test' }));
jest.mock('@/auth/tokenStorage', () => ({
  tokenStorage: { load: jest.fn(async () => null), save: jest.fn(async () => undefined), clear: jest.fn(async () => undefined) },
}));
jest.mock('@/features/camera/session', () => ({ useCamera: () => jest.fn() }));
jest.mock('@/features/wardrobe/photos', () => ({ batch: 20, pickFromGallery: jest.fn(), preparePhoto: jest.fn() }));
jest.mock('@/api/wardrobe', () => ({ ...jest.requireActual('@/api/wardrobe'), fetchClothing: jest.fn(), fetchDictionaries: jest.fn() }));

const api = jest.mocked(wardrobe);
const show = (screenUnderTest: ReactElement) => render(<QueryClientProvider client={queryClient}>{screenUnderTest}</QueryClientProvider>);
const hoodie = (change: Partial<wardrobe.Clothing> = {}) => clothing('g1', 'Navy hoodie', 'mid_layer', change);

beforeEach(() => {
  jest.clearAllMocks();
  queryClient.clear();
  useSession.setState({ status: 'signedIn', user: user(), accessToken: 'a', refreshToken: 'r' });
  jest.mocked(useLocalSearchParams).mockReturnValue({ id: 'g1' });
  api.fetchDictionaries.mockResolvedValue(wardrobeDictionaries);
});

afterEach(async () => {
  await cleanup();
  queryClient.clear();
});

describe('saying where the AI wrote something', () => {
  it('says so on the garment the tagger described', async () => {
    api.fetchClothing.mockResolvedValue(hoodie({ describedByAi: true }));
    await show(<GarmentDetail />);

    expect(await screen.findByTestId('garment-ai-note')).toHaveTextContent(aiNote);
    expect(aiNote).toBe('Described by AI — check it and change anything that’s off.');
  });

  it('says so on the edit screen too, until the first saved edit clears it', async () => {
    api.fetchClothing.mockResolvedValue(hoodie({ describedByAi: true }));
    await show(<EditGarment />);

    expect(await screen.findByTestId('garment-ai-note')).toBeOnTheScreen();
  });

  it('does not claim it for a starter piece or one the person has edited', async () => {
    api.fetchClothing.mockResolvedValue(hoodie({ describedByAi: false }));
    await show(<GarmentDetail />);
    await screen.findByTestId('garment-name');

    expect(screen.queryByTestId('garment-ai-note')).toBeNull();
  });

  it('does not claim it before the description exists', async () => {
    api.fetchClothing.mockResolvedValue(hoodie({ status: 'processing', describedByAi: true }));
    await show(<GarmentDetail />);
    await screen.findByText('Describing your photo');

    expect(screen.queryByTestId('garment-ai-note')).toBeNull();
  });

  it('does not claim it on the edit screen of an edited garment', async () => {
    api.fetchClothing.mockResolvedValue(hoodie({ describedByAi: false }));
    await show(<EditGarment />);
    await screen.findByTestId('garment-save');

    expect(screen.queryByTestId('garment-ai-note')).toBeNull();
  });
});
