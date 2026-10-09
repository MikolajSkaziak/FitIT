import { toggleGarment } from '@/features/builder/selection';
import { clothing } from '@/test/fixtures';

const tee = clothing('tee', 'White tee', 'top');
const shirt = clothing('shirt', 'Blue shirt', 'top');
const jeans = clothing('jeans', 'Jeans', 'bottom');
const dress = clothing('dress', 'Green dress', 'one_piece');
const sneakers = clothing('sneakers', 'Sneakers', 'shoes');
const accessories = ['a1', 'a2', 'a3', 'a4'].map((id) => clothing(id, id, 'accessory'));

const ids = (items: readonly { id: string }[]) => items.map((item) => item.id);

describe('the picker rules', () => {
  it('adds a garment, keeps the pieces in outfit order, and takes it out when tapped again', () => {
    const one = toggleGarment([], sneakers);
    const two = toggleGarment(one.items, tee);
    const three = toggleGarment(two.items, jeans);

    expect(ids(three.items)).toEqual(['tee', 'jeans', 'sneakers']);
    expect(ids(toggleGarment(three.items, jeans).items)).toEqual(['tee', 'sneakers']);
  });

  it('keeps one garment per role: a new one takes the place of the old', () => {
    const swapped = toggleGarment([tee, jeans], shirt);

    expect(ids(swapped.items)).toEqual(['shirt', 'jeans']);
    expect(swapped.effect).toBeNull();
  });

  it('lets several accessories in, up to three', () => {
    const three = [accessories[0]!, accessories[1]!].reduce((items, piece) => toggleGarment(items, piece).items, [tee]);
    const full = toggleGarment(toggleGarment(three, accessories[2]!).items, accessories[3]!);

    expect(ids(full.items)).toEqual(['tee', 'a1', 'a2', 'a3']);
    expect(full.effect).toBe('accessories_full');
  });

  it('clears the top and the bottom when a dress is chosen, and the dress when a top or a bottom is', () => {
    const withDress = toggleGarment([tee, jeans, sneakers], dress);
    const back = toggleGarment(withDress.items, jeans);

    expect(ids(withDress.items)).toEqual(['dress', 'sneakers']);
    expect(withDress.effect).toBe('replaced_body');
    expect(ids(back.items)).toEqual(['jeans', 'sneakers']);
    expect(back.effect).toBe('replaced_body');
  });

  it('does not call a swap within one role a dress swap', () => {
    expect(toggleGarment([dress], clothing('jumpsuit', 'Jumpsuit', 'one_piece')).effect).toBeNull();
  });
});
