import { fireEvent, screen } from '@testing-library/react-native';

import { ApiError } from '@/api/problem';
import * as stylist from '@/api/stylist';
import * as wardrobe from '@/api/wardrobe';
import StylistChat from '@/app/(app)/stylist';
import { useSession } from '@/auth/session';
import { useOutfitBuilder } from '@/features/builder/useOutfitBuilder';
import { useStylistChat } from '@/features/stylist/useStylistChat';
import { clothing, user } from '@/test/fixtures';
import { renderScreen, router } from '@/test/screen';

jest.mock('expo-router', () => jest.requireActual('@/test/screen').routerModule);
jest.mock('@/lib/config', () => ({ apiUrl: 'http://api.test' }));
jest.mock('@/auth/tokenStorage', () => ({
  tokenStorage: { load: jest.fn(async () => null), save: jest.fn(async () => undefined), clear: jest.fn(async () => undefined) },
}));
jest.mock('@/api/stylist', () => ({ askStylist: jest.fn() }));
jest.mock('@/api/wardrobe', () => ({ ...jest.requireActual('@/api/wardrobe'), fetchClothes: jest.fn() }));

const ask = jest.mocked(stylist).askStylist;
const garments = jest.mocked(wardrobe);

const blazer = clothing('blazer', 'Navy blazer', 'mid_layer');
const shirt = clothing('shirt', 'White shirt', 'top');
const trousers = clothing('trousers', 'Grey trousers', 'bottom');
const loafers = clothing('loafers', 'Brown loafers', 'shoes');

const reply = (change: Partial<stylist.StylistReply> = {}): stylist.StylistReply => ({
  text: 'Go for the navy blazer over the white shirt.',
  outfit: null,
  mentioned: [],
  shopping: [],
  followUps: [],
  source: 'ai',
  ...change,
});

const type = async (text: string) => {
  await fireEvent.changeText(screen.getByTestId('stylist-input'), text);
  await fireEvent.press(screen.getByTestId('stylist-send'));
};

beforeEach(() => {
  jest.clearAllMocks();
  useStylistChat.getState().clear();
  useOutfitBuilder.setState({ items: [], note: null, layout: null, figureLayout: null });
  useSession.setState({ status: 'signedIn', user: user(), accessToken: 'a', refreshToken: 'r' });
  garments.fetchClothes.mockResolvedValue([blazer, shirt, trousers, loafers]);
});

describe('the stylist chat', () => {
  it('opens on what the stylist knows, the first questions and what the answers are made from', async () => {
    await renderScreen(<StylistChat />);

    expect(await screen.findByText(/I know your 4 pieces/)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'What should I wear tonight?' })).toBeOnTheScreen();
    expect(screen.getByText(/never your photos/)).toBeOnTheScreen();
    // Nothing to send yet.
    expect(screen.getByTestId('stylist-send')).toBeDisabled();
  });

  it('sends a starter question with the conversation so far and shows the answer in place of the welcome', async () => {
    ask.mockResolvedValue(reply());
    await renderScreen(<StylistChat />);

    await fireEvent.press(await screen.findByRole('button', { name: 'What should I wear tonight?' }));

    expect(await screen.findByText('Go for the navy blazer over the white shirt.')).toBeOnTheScreen();
    expect(ask).toHaveBeenCalledWith({ messages: [{ role: 'person', text: 'What should I wear tonight?' }], occasion: null });
    expect(screen.queryByTestId('stylist-welcome')).toBeNull();
  });

  it('carries the whole conversation to the next question, and the occasion of the last outfit', async () => {
    ask.mockResolvedValueOnce(
      reply({ outfit: { occasion: 'date', note: null, items: [{ slot: 'top', clothing: shirt }, { slot: 'bottom', clothing: trousers }, { slot: 'shoes', clothing: loafers }] } }),
    );
    await renderScreen(<StylistChat />);

    await type('Dress me for a date');
    await screen.findByTestId('stylist-outfit');
    ask.mockResolvedValueOnce(reply({ text: 'Loafers keep it relaxed.' }));
    await type('And the shoes?');

    await screen.findByText('Loafers keep it relaxed.');
    expect(ask).toHaveBeenLastCalledWith({
      messages: [
        { role: 'person', text: 'Dress me for a date' },
        { role: 'stylist', text: 'Go for the navy blazer over the white shirt.' },
        { role: 'person', text: 'And the shoes?' },
      ],
      occasion: 'date',
    });
  });

  it('shows an outfit on a board and opens it in the builder with its pieces', async () => {
    ask.mockResolvedValue(
      reply({ outfit: { occasion: 'date', note: 'Roll the sleeves once.', items: [{ slot: 'top', clothing: shirt }, { slot: 'mid_layer', clothing: blazer }, { slot: 'bottom', clothing: trousers }, { slot: 'shoes', clothing: loafers }] } }),
    );
    await renderScreen(<StylistChat />);
    await type('Date night?');

    expect(await screen.findByRole('image', { name: /Outfit on a board: / })).toBeOnTheScreen();
    expect(screen.getByText('Roll the sleeves once.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Open in builder' }));

    expect(useOutfitBuilder.getState().items.map((item) => item.id)).toEqual(['shirt', 'blazer', 'trousers', 'loafers']);
    expect(router.replace).toHaveBeenCalledWith('/builder');
    expect(router.push).toHaveBeenCalledWith('/builder/preview');
  });

  it('lists the garments it talks about and what is worth buying, and offers the next questions to tap', async () => {
    ask.mockResolvedValue(
      reply({
        text: 'You have no outerwear yet.',
        mentioned: [blazer],
        shopping: [{ name: 'Camel wool coat', category: 'outerwear', why: 'Goes over every top you own.', colors: ['beige'] }],
        followUps: ['What colour should it be?'],
      }),
    );
    await renderScreen(<StylistChat />);
    await type('What is missing?');

    expect(await screen.findByText('Camel wool coat')).toBeOnTheScreen();
    expect(screen.getByText('Goes over every top you own.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('stylist-garment-blazer'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/clothes/[id]', params: { id: 'blazer' } });

    ask.mockResolvedValue(reply({ text: 'Camel or charcoal.' }));
    await fireEvent.press(screen.getByRole('button', { name: 'What colour should it be?' }));
    expect(await screen.findByText('Camel or charcoal.')).toBeOnTheScreen();
    // Only the newest answer offers next questions.
    expect(screen.queryByRole('button', { name: 'What colour should it be?' })).toBeNull();
  });

  it('says plainly when the day’s answers are used up, and keeps the question', async () => {
    ask.mockRejectedValue(new ApiError({ status: 429, code: 'limit_reached' }));
    await renderScreen(<StylistChat />);
    await type('Anything?');

    expect(await screen.findByTestId('stylist-error')).toHaveTextContent('That’s all the stylist can answer today. More tomorrow.');
    expect(screen.getByText('Anything?')).toBeOnTheScreen();
    expect(screen.queryByTestId('stylist-retry')).toBeNull();
  });

  it('asks the same again after a failure, and starts over from New chat', async () => {
    ask.mockRejectedValueOnce(new ApiError({ status: 0, code: 'network' }));
    await renderScreen(<StylistChat />);
    await type('Hello');

    const retry = await screen.findByTestId('stylist-retry');
    ask.mockResolvedValue(reply({ text: 'Hi there.' }));
    await fireEvent.press(retry);
    expect(await screen.findByText('Hi there.')).toBeOnTheScreen();
    expect(ask).toHaveBeenCalledTimes(2);
    expect(ask).toHaveBeenLastCalledWith({ messages: [{ role: 'person', text: 'Hello' }], occasion: null });

    await fireEvent.press(screen.getByRole('button', { name: 'New chat' }));
    expect(screen.getByTestId('stylist-welcome')).toBeOnTheScreen();
    expect(useStylistChat.getState().messages).toEqual([]);
  });
});
