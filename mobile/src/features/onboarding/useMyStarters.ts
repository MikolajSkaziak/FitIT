import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { addStarterPieces, fetchMyStarterPieces, wardrobeKeys } from '@/api/wardrobe';

/** The common pieces this person has not added yet. Empty while loading, after a failure, and once everything is added. */
export function useMyStarters() {
  const query = useQuery({ queryKey: wardrobeKeys.starterMine, queryFn: fetchMyStarterPieces });
  const remaining = useMemo(() => (query.data ?? []).filter((piece) => !piece.added), [query.data]);
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
