import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { useState } from 'react';
import { withTiming } from 'react-native-reanimated';

import type { StyleTag } from '@/api/account';
import * as wardrobe from '@/api/wardrobe';
import { StyleChoice, photoModel } from '@/components/choices';
import { StyleTile } from '@/components/StyleTile';
import { styleOptions } from '@/copy/labels';
import { renderScreen } from '@/test/screen';
import { motion } from '@/theme';
import { wardrobeDictionaries } from '@/test/fixtures';

jest.mock('@/lib/config', () => ({ apiUrl: 'http://api.test' }));
jest.mock('@/api/wardrobe', () => ({ ...jest.requireActual('@/api/wardrobe'), fetchDictionaries: jest.fn() }));

const codes = ['casual', 'smart', 'elegant', 'sporty', 'streetwear', 'minimalist', 'old_money', 'preppy', 'vintage', 'y2k', 'boho', 'grunge', 'gorpcore', 'business', 'romantic', 'edgy'];

const dictionaries = {
  ...wardrobeDictionaries,
  styles: codes.map((code) => ({ code, label: code, womanImageUrl: `http://api.test/styles/${code}-f.jpg`, manImageUrl: `http://api.test/styles/${code}-m.jpg` })),
} as unknown as wardrobe.Dictionaries;

const onChange = jest.fn();

function Picker({ gender, start = [] }: { gender: Parameters<typeof StyleChoice>[0]['gender']; start?: StyleTag[] }) {
  const [value, setValue] = useState<StyleTag[]>(start);
  return (
    <StyleChoice
      gender={gender}
      value={value}
      onChange={(next) => {
        onChange(next);
        setValue(next);
      }}
    />
  );
}

type Node = { props?: Record<string, unknown>; children?: (Node | string)[] | null };

/** The photo address of every picture on the screen, in order; undefined for a tile with none yet. */
function photos(): (string | undefined)[] {
  const found: (string | undefined)[] = [];
  const walk = (node: Node | string | null) => {
    if (!node || typeof node === 'string') {
      return;
    }

    if (node.props && 'contentFit' in node.props) {
      found.push((node.props.source as { uri: string }[]).at(0)?.uri);
    }

    node.children?.forEach(walk);
  };

  const tree = screen.toJSON();
  (Array.isArray(tree) ? tree : [tree]).forEach((root) => walk(root as Node | null));
  return found;
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(wardrobe.fetchDictionaries).mockResolvedValue(dictionaries);
});

describe('the style tiles', () => {
  it('offers every style, in the order of the server, under its own name', async () => {
    await renderScreen(<Picker gender="female" />);
    await waitFor(() => expect(photos()[0]).toBeDefined());

    expect(styleOptions.map((option) => option.value)).toEqual(codes);
    for (const option of styleOptions) {
      expect(screen.getByRole('checkbox', { name: option.label })).not.toBeChecked();
    }

    expect(screen.getAllByRole('checkbox')).toHaveLength(16);
    expect(screen.getByRole('checkbox', { name: 'Smart casual' })).toBeOnTheScreen();
    expect(screen.getByRole('checkbox', { name: 'Old money' })).toBeOnTheScreen();
    expect(screen.getByRole('checkbox', { name: 'Y2K' })).toBeOnTheScreen();
  });

  it('chooses and un-chooses a style, several at a time, and says so to a screen reader', async () => {
    await renderScreen(<Picker gender="female" start={['casual']} />);
    await waitFor(() => expect(photos()[0]).toBeDefined());
    expect(screen.getByRole('checkbox', { name: 'Casual' })).toBeChecked();

    await fireEvent.press(screen.getByRole('checkbox', { name: 'Old money' }));
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Y2K' }));
    expect(onChange).toHaveBeenLastCalledWith(['casual', 'old_money', 'y2k']);
    expect(screen.getByRole('checkbox', { name: 'Old money' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Y2K' })).toBeChecked();

    await fireEvent.press(screen.getByRole('checkbox', { name: 'Casual' }));
    expect(onChange).toHaveBeenLastCalledWith(['old_money', 'y2k']);
    expect(screen.getByRole('checkbox', { name: 'Casual' })).not.toBeChecked();
  });

  it('shows the photos of women to a woman, with the tiles still there before the photos arrive', async () => {
    await renderScreen(<Picker gender="female" />);
    expect(photos().every((uri) => uri === undefined)).toBe(true);

    await waitFor(() => expect(photos()).toEqual(codes.map((code) => `http://api.test/styles/${code}-f.jpg`)));
  });

  it('shows the photos of men to a man', async () => {
    await renderScreen(<Picker gender="male" />);

    await waitFor(() => expect(photos()).toEqual(codes.map((code) => `http://api.test/styles/${code}-m.jpg`)));
  });

  it.each(['non_binary', 'unspecified', null] as const)('alternates a woman and a man across the grid for %s', async (gender) => {
    await renderScreen(<Picker gender={gender} />);

    await waitFor(() => expect(photos()).toEqual(codes.map((code, index) => `http://api.test/styles/${code}-${index % 2 === 0 ? 'f' : 'm'}.jpg`)));
  });

  it('picks the photo by gender and place', () => {
    expect([photoModel('female', 3), photoModel('male', 2)]).toEqual(['woman', 'man']);
    expect([photoModel('non_binary', 0), photoModel('non_binary', 1), photoModel(null, 2), photoModel('unspecified', 3)]).toEqual(['woman', 'man', 'woman', 'man']);
  });

  it('shows the selection on the frame it is tapped and fades it out over the press duration', async () => {
    const { rerender } = await renderScreen(<StyleTile label="Boho" selected={false} onPress={jest.fn()} />);
    jest.mocked(withTiming).mockClear();

    await rerender(<StyleTile label="Boho" selected onPress={jest.fn()} />);
    expect(jest.mocked(withTiming).mock.calls.filter(([to]) => to === 1)).toEqual([]);

    jest.mocked(withTiming).mockClear();
    await rerender(<StyleTile label="Boho" selected={false} onPress={jest.fn()} />);
    const timings = jest.mocked(withTiming).mock.calls.map(([to, config]) => ({ to, duration: (config as { duration: number }).duration }));
    expect(timings).toEqual([
      { to: 0, duration: motion.press },
      { to: 0, duration: motion.press },
    ]);
  });
});

describe('the larger photo', () => {
  const holdHint = 'Touch and hold to see a larger photo';
  // The layer is hidden from screen readers on purpose, and the queries leave hidden things out unless asked.
  const peek = () => screen.queryByTestId('photo-peek', { includeHiddenElements: true });

  it('opens on a long press with the photo and name, and does not change the selection', async () => {
    await renderScreen(<Picker gender="female" />);
    await waitFor(() => expect(photos()[0]).toBeDefined());
    expect(peek()).toBeNull();

    await fireEvent(screen.getByRole('checkbox', { name: 'Boho' }), 'longPress');

    expect(peek()).toHaveTextContent('Boho');
    expect(photos()).toContain('http://api.test/styles/boho-f.jpg');
    expect(photos().filter((uri) => uri === 'http://api.test/styles/boho-f.jpg')).toHaveLength(2);
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('checkbox', { name: 'Boho' })).not.toBeChecked();
  });

  it('closes when the finger lifts, and the lift is not a tap', async () => {
    await renderScreen(<Picker gender="male" />);
    await waitFor(() => expect(photos()[0]).toBeDefined());
    const tile = screen.getByRole('checkbox', { name: 'Y2K' });

    await fireEvent(tile, 'longPress');
    expect(peek()).not.toBeNull();
    await fireEvent(tile, 'pressOut');

    expect(peek()).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('leaves a tap as it was: it selects, and nothing opens', async () => {
    await renderScreen(<Picker gender="female" />);
    await waitFor(() => expect(photos()[0]).toBeDefined());
    const tile = screen.getByRole('checkbox', { name: 'Vintage' });

    await fireEvent(tile, 'pressIn');
    await fireEvent(tile, 'pressOut');
    await fireEvent.press(tile);

    expect(peek()).toBeNull();
    expect(onChange).toHaveBeenCalledWith(['vintage']);
    expect(screen.getByRole('checkbox', { name: 'Vintage' })).toBeChecked();
  });

  it('is only a visual extra: the tile stays a checkbox with a hint, and the layer is hidden from screen readers and takes no touch', async () => {
    await renderScreen(<Picker gender="female" />);
    await waitFor(() => expect(photos()[0]).toBeDefined());

    expect(screen.getByRole('checkbox', { name: 'Edgy' }).props.accessibilityHint).toBe(holdHint);
    await fireEvent(screen.getByRole('checkbox', { name: 'Edgy' }), 'longPress');

    expect(peek()).not.toBeNull();
    expect(peek()?.props.pointerEvents).toBe('none');
    expect(screen.queryByTestId('photo-peek')).toBeNull();
    expect(screen.getAllByRole('checkbox')).toHaveLength(16);
  });

  it('does not open for a style whose photo has not arrived', async () => {
    await renderScreen(<StyleTile label="Boho" selected={false} onPress={jest.fn()} />);

    await fireEvent(screen.getByRole('checkbox', { name: 'Boho' }), 'longPress');

    expect(peek()).toBeNull();
  });

  it('fades in over the enter duration', async () => {
    await renderScreen(<Picker gender="female" />);
    await waitFor(() => expect(photos()[0]).toBeDefined());
    jest.mocked(withTiming).mockClear();

    await fireEvent(screen.getByRole('checkbox', { name: 'Smart casual' }), 'longPress');

    const timings = jest.mocked(withTiming).mock.calls.map(([to, config]) => ({ to, duration: (config as { duration: number }).duration }));
    expect(timings).toEqual(expect.arrayContaining([{ to: 1, duration: motion.enter }]));
  });
});
