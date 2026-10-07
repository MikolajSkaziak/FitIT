import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { outfitKeys, suggestOutfits, type Occasion, type Outfit, type Suggestions } from '@/api/outfits';
import { codeOf } from '@/api/problem';
import { fetchWeatherToday, weatherKeys, weatherStaleMs } from '@/api/weather';
import { wardrobeKeys } from '@/api/wardrobe';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Collage } from '@/components/Collage';
import { FormError } from '@/components/forms';
import { BackHeader } from '@/components/headers';
import { Skeleton } from '@/components/lists';
import { messageFor } from '@/copy/errors';
import { kindLabel, occasionLabel } from '@/copy/labels';
import { missingNotice, noOutfits } from '@/features/styling/copy';
import { OutfitNotes, RatingBar } from '@/features/styling/OutfitParts';
import { rowHeightFor } from '@/features/styling/collage';
import { pageIndex } from '@/features/styling/pager';
import { ProposalTabs } from '@/features/styling/ProposalTabs';
import { isOccasion } from '@/features/styling/request';
import { useOutfitActions } from '@/features/styling/useOutfitActions';
import { OutfitVisualization } from '@/features/visualization/OutfitVisualization';
import { rangeOf } from '@/features/weather/copy';
import { radius, size, space, useTheme } from '@/theme';

export default function Proposals() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ request: string; occasion: string; note?: string; base?: string }>();
  const occasion: Occasion = isOccasion(params.occasion) ? params.occasion : 'everyday';

  const answer = useQuery({
    queryKey: outfitKeys.suggestions(params.request),
    queryFn: async () => {
      try {
        return await suggestOutfits({ occasion, note: params.note, baseItemId: params.base });
      } finally {
        // Whatever the answer, the count of proposals left for today has changed or is now known.
        void queryClient.invalidateQueries({ queryKey: wardrobeKeys.usage });
      }
    },
    // One request is one question to the server: it is not asked again by itself, and a failed one is asked by the button.
    staleTime: Infinity,
    retry: false,
  });
  const forecast = useQuery({ queryKey: weatherKeys.today, queryFn: fetchWeatherToday, staleTime: weatherStaleMs }).data;
  const weather = answer.data?.weather ?? forecast;

  const day = weather?.forTomorrow ? 'jutro' : 'dziś';
  const header = (
    <BackHeader
      title={`Propozycje na ${day}`}
      meta={weather ? `${occasionLabel(occasion)}, ${rangeOf(weather)}` : occasionLabel(occasion)}
      onBack={() => router.back()}
    />
  );

  if (answer.isPending) {
    return (
      <Frame header={header} testID="proposals-loading">
        <Loading />
      </Frame>
    );
  }

  if (answer.isError) {
    const code = codeOf(answer.error);
    return (
      <Frame header={header} testID="proposals-error">
        <View style={styles.message}>
          <AppText color="textSecondary">{messageFor(answer.error)}</AppText>
          {code === 'location_missing' ? (
            <Button label="Wybierz miejsce" inline onPress={() => router.push('/account/place')} testID="proposals-place" />
          ) : code === 'limit_reached' ? (
            <Button label="Wróć do Dziś" inline onPress={() => router.back()} testID="proposals-back" />
          ) : (
            <Button label="Spróbuj ponownie" inline busy={answer.isFetching} onPress={() => void answer.refetch()} testID="proposals-retry" />
          )}
        </View>
      </Frame>
    );
  }

  if (answer.data.status === 'missing_garments') {
    return (
      <Frame
        header={header}
        testID="proposals-missing"
        footer={<Button label="Dodaj ubrania" icon="plus" onPress={() => router.push('/add')} testID="proposals-add" />}>
        <MissingPanel answer={answer.data} />
      </Frame>
    );
  }

  return <Pager outfits={answer.data.outfits} header={header} />;
}

interface FrameProps {
  header: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  testID: string;
}

/** Header at the top, the buttons pinned at the bottom, and whatever the screen has to say between them. */
function Frame({ header, children, footer, testID }: FrameProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.screen, { backgroundColor: theme.canvas, paddingTop: insets.top + space[2] }]} testID={testID}>
      <View style={styles.gutter}>{header}</View>
      <View style={styles.body}>{children}</View>
      {footer ? <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, space[4]) }]}>{footer}</View> : null}
    </View>
  );
}

/** What the answer will look like, and one honest line about what is going on. */
function Loading() {
  const { width } = useWindowDimensions();
  const tile = (width - 2 * size.gutter - space[2]) / 2;
  return (
    <View style={[styles.gutter, styles.loading]} accessibilityRole="progressbar" accessibilityLabel="Układamy zestawy">
      <View style={styles.pills}>
        <Skeleton height={size.touch} width={88} radius={size.touch / 2} />
        <Skeleton height={size.touch} width={96} radius={size.touch / 2} />
        <Skeleton height={size.touch} width={136} radius={size.touch / 2} />
      </View>
      <View style={styles.skeletonGrid}>
        {['a', 'b', 'c', 'd'].map((key) => (
          <Skeleton key={key} height={rowHeightFor(width - 2 * size.gutter, space[2])} width={tile} radius={radius.well} />
        ))}
      </View>
      <View style={styles.message}>
        <Skeleton height={16} />
        <Skeleton height={16} width="86%" />
        <Skeleton height={16} width="56%" />
      </View>
      <AppText variant="secondary" color="textSecondary" accessibilityRole="text" accessibilityLiveRegion="polite">
        Układamy trzy zestawy z Twojej szafy.
      </AppText>
    </View>
  );
}

/** The wardrobe cannot dress the person for this weather and occasion: what is missing, and what would fix it. */
function MissingPanel({ answer }: { answer: Suggestions }) {
  const theme = useTheme();
  const notice = missingNotice(answer.missing, answer.missingEither, answer.weather.feelsMin);
  return (
    <View style={styles.gutter}>
      <View style={[styles.panel, { backgroundColor: theme.sage }]} accessibilityRole="alert" testID="proposals-missing-panel">
        <AppText variant="label" color="onSage">
          {notice.title}
        </AppText>
        <AppText>{notice.text}</AppText>
      </View>
    </View>
  );
}

interface PagerProps {
  outfits: readonly Outfit[];
  header: ReactNode;
}

/** The proposals, side by side: swipe or press a pill to move between them. */
function Pager({ outfits, header }: PagerProps) {
  const { width } = useWindowDimensions();
  const pages = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const [worn, setWorn] = useState<readonly string[]>([]);
  const actions = useOutfitActions();

  const current = outfits[Math.min(index, outfits.length - 1)];
  if (!current) {
    return (
      <Frame header={header} testID="proposals-none">
        <View style={[styles.gutter, styles.message]}>
          <AppText color="textSecondary">{noOutfits}</AppText>
        </View>
      </Frame>
    );
  }

  const labels = outfits.map((outfit, position) => (outfit.kind ? kindLabel(outfit.kind) : `Zestaw ${position + 1}`));
  const go = (to: number) => {
    setIndex(to);
    pages.current?.scrollTo({ x: to * width, animated: true });
  };
  const wearing = worn.includes(current.id);

  return (
    <Frame
      header={header}
      testID="proposals-screen"
      footer={
        <>
          <FormError message={actions.error ? messageFor(actions.error) : null} />
          <Button
            label={wearing ? 'Założony' : 'Zakładam to'}
            icon={wearing ? 'check' : undefined}
            kind={wearing ? 'secondary' : 'primary'}
            busy={actions.wearing}
            onPress={() => actions.wear(current, () => setWorn((ids) => [...ids, current.id]))}
            testID="proposals-wear"
          />
        </>
      }>
      {outfits.length > 1 ? (
        <View style={styles.gutter}>
          <ProposalTabs labels={labels} selected={index} onSelect={go} />
        </View>
      ) : null}
      <ScrollView
        ref={pages}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(event) => setIndex(pageIndex(event.nativeEvent.contentOffset.x, width, outfits.length))}
        testID="proposals-pages">
        {outfits.map((outfit) => (
          <ScrollView key={outfit.id} style={{ width }} contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
            {outfits.length === 1 && outfit.kind ? (
              <AppText variant="secondaryStrong" color="action">
                {kindLabel(outfit.kind)}
              </AppText>
            ) : null}
            <OutfitVisualization
              outfit={outfit}
              width={width - 2 * size.gutter}
              collage={<Collage items={outfit.items} width={width - 2 * size.gutter} testID={`collage-${outfit.id}`} />}
            />
            <OutfitNotes outfit={outfit} />
            <RatingBar outfit={outfit} onRate={(rating) => actions.rate(outfit, rating)} onKeep={() => actions.keep(outfit)} />
          </ScrollView>
        ))}
      </ScrollView>
    </Frame>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  gutter: { paddingHorizontal: size.gutter },
  body: { flex: 1, gap: space[4], paddingTop: space[3] },
  footer: { paddingHorizontal: size.gutter, paddingTop: space[2], gap: space[1] },
  page: { paddingHorizontal: size.gutter, paddingBottom: space[4], gap: space[4] },
  message: { gap: space[3] },
  loading: { gap: space[4] },
  pills: { flexDirection: 'row', gap: space[2] },
  skeletonGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  panel: { borderRadius: radius.card, padding: space[4], gap: space[2] },
});
