import type { Gender } from '@/api/account';
import type { StarterAudience } from '@/api/wardrobe';

/**
 * The common pieces a person is shown, by the gender they gave: a woman sees the women's pieces and the ones for everyone,
 * a man the men's and the ones for everyone. Non-binary, "prefer not to say" and an unknown gender see them all.
 */
export function piecesFor<T extends { audience: StarterAudience }>(pieces: readonly T[], gender: Gender | null | undefined): T[] {
  const own: StarterAudience | null = gender === 'female' ? 'women' : gender === 'male' ? 'men' : null;
  return own ? pieces.filter((piece) => piece.audience === 'everyone' || piece.audience === own) : [...pieces];
}
