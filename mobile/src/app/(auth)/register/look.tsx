import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { StyleSheet, useWindowDimensions } from 'react-native';

import { fetchStarterPieces, wardrobeKeys } from '@/api/wardrobe';
import { BoardView } from '@/components/BoardView';
import { onboardingPictures } from '@/components/brand';
import { Button } from '@/components/Button';
import { Skeleton } from '@/components/lists';
import { Fade } from '@/components/motion';
import { firstLook } from '@/features/onboarding/copy';
import { lookOfStarters } from '@/features/onboarding/firstLook';
import { boardAspect, boardSize } from '@/features/styling/board';
import { useRegistrationDraft } from '@/features/registration/draft';
import { WizardStep } from '@/features/registration/WizardStep';
import { radius, size, useTheme } from '@/theme';

/**
 * The fifth step gives before it asks: a look laid out on a board, on the phone, out of the pieces the person just ticked.
 * The board lets its garments arrive one after another by itself, and here it is only shown, never arranged.
 * With too few pieces for one there is a photograph instead and the words say so; an outfit nobody picked is never shown as theirs.
 * The account comes next and keeps all of it; "Not now" goes back to the start and keeps nothing.
 */
export default function RegisterLook() {
  const router = useRouter();
  const theme = useTheme();
  const width = useWindowDimensions().width - 2 * size.gutter;
  const starters = useRegistrationDraft((draft) => draft.starters);
  const place = useRegistrationDraft((draft) => draft.place);
  // Already loaded by the basics step; asked again only if this screen is opened without it.
  const pieces = useQuery({ queryKey: wardrobeKeys.starter, queryFn: fetchStarterPieces, staleTime: Infinity, enabled: starters.length > 0 });
  const waiting = starters.length > 0 && pieces.isPending;
  const look = lookOfStarters((pieces.data ?? []).filter((piece) => starters.includes(piece.code)));
  const ready = look.length > 0;

  return (
    <WizardStep
      step="look"
      visual
      underlined={ready}
      picture={
        waiting ? (
          <Skeleton width={width} height={boardSize(width).height} radius={radius.well} />
        ) : ready ? (
          <BoardView items={look} width={width} testID="first-look" />
        ) : (
          <Fade style={[styles.photo, { backgroundColor: theme.well }]} testID="first-look-photo">
            <Image source={onboardingPictures.rail} contentFit="cover" accessible={false} style={StyleSheet.absoluteFill} />
          </Fade>
        )
      }
      title={ready || waiting ? firstLook.title : firstLook.emptyTitle}
      lead={ready ? firstLook.lead(place?.name) : undefined}
      testID="register-look"
      footer={
        <>
          <Button label={firstLook.keep} onPress={() => router.push('/register/account')} testID="look-keep" />
          {/* Welcome forgets the draft when it comes back into view. */}
          <Button label={firstLook.leave} kind="text" onPress={() => router.dismissTo('/welcome')} testID="look-leave" />
        </>
      }
    />
  );
}

const styles = StyleSheet.create({
  photo: { alignSelf: 'stretch', aspectRatio: boardAspect, borderRadius: radius.well, overflow: 'hidden' },
});
