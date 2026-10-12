import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { addStarterPieces, fetchMyStarterPieces, wardrobeKeys } from '@/api/wardrobe';
import { useSession } from '@/auth/session';

import { piecesFor } from './audience';

/** The common pieces this person has not added yet and that suit the gender in their profile. Empty while loading, after a failure, and once everything is added. */
export function useMyStarters() {
  const query = useQuery({ queryKey: wardrobeKeys.starterMine, queryFn: fetchMyStarterPieces });
  const gender = useSession((session) => session.user?.gender);
  const remaining = useMemo(() => piecesFor((query.data ?? []).filter((piece) => !piece.added), gender), [query.data, gender]);
  return { query, remaining };
}

/** Adds pieces as ready garments, then refreshes the wardrobe, its stats and what is left to add. */
export function useAddStarters() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (codes: string[]) => addStarterPieces(codes),
    onSuccess: () => client.invalidateQueries({ queryKey: wardrobeKeys.all }),
  });
}
