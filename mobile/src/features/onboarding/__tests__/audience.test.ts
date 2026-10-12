import type { Gender } from '@/api/account';
import { piecesFor } from '@/features/onboarding/audience';
import { starterPiece } from '@/test/fixtures';

const catalog = [
  starterPiece('white_tshirt', 'White T-shirt', 'top'),
  starterPiece('little_black_dress', 'Little black dress', 'one_piece', { audience: 'women' }),
  starterPiece('navy_blazer', 'Navy blazer', 'mid_layer', { audience: 'men' }),
];
const codes = (gender: Gender | null | undefined) => piecesFor(catalog, gender).map((piece) => piece.code);

describe('which common pieces a gender is shown', () => {
  it('gives a woman the women’s pieces and the ones for everyone', () => {
    expect(codes('female')).toEqual(['white_tshirt', 'little_black_dress']);
  });

  it('gives a man the men’s pieces and the ones for everyone', () => {
    expect(codes('male')).toEqual(['white_tshirt', 'navy_blazer']);
  });

  it.each([['non_binary' as const], ['unspecified' as const], [null], [undefined]])('gives everything to %s', (gender) => {
    expect(codes(gender)).toEqual(['white_tshirt', 'little_black_dress', 'navy_blazer']);
  });

  it('keeps the order of the list and never changes it', () => {
    const before = [...catalog];

    piecesFor(catalog, 'female');

    expect(catalog).toEqual(before);
  });
});
