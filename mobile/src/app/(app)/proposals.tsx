import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View, type ScrollViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { outfitKeys, suggestOutfits, type Occasion, type Outfit, type OutfitPlacement, type Suggestions } from '@/api/outfits';
import { codeOf } from '@/api/problem';
import { fetchWeatherToday, weatherKeys, weatherStaleMs } from '@/api/weather';
import { wardrobeKeys } from '@/api/wardrobe';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { IconButton } from '@/components/controls';
import { Eyebrow } from '@/components/Eyebrow';
import { Icon, type IconName } from '@/components/Icon';
import { Fade, Pulse } from '@/components/motion';
import { useScrollable } from '@/components/scrollLock';
import { FormError } from '@/components/forms';
import { Skeleton } from '@/components/lists';
import { messageFor } from '@/copy/errors';
import { kindLabel, occasionIcon, occasionLabel } from '@/copy/labels';
import { calendarCopy, dayWord, looksTitle, planLabel, plannedLabel } from '@/features/calendar/copy';
import { PlanNotice } from '@/features/calendar/PlanNotice';
import { usePlanning } from '@/features/calendar/session';
import { useCanPlan, usePlaceToday } from '@/features/calendar/useCalendar';
import { missingNotice, noOutfits } from '@/features/styling/copy';
import { KeepBar, OutfitNotes } from '@/features/styling/OutfitParts';
import { pageIndex } from '@/features/styling/pager';
import { ProposalTabs } from '@/features/styling/ProposalTabs';
import { isOccasion } from '@/features/styling/request';
import { useOutfitActions } from '@/features/styling/useOutfitActions';
import { OutfitVisualization, stageWidth, TryOnButton, useOutfitViewer } from '@/features/visualization/OutfitVisualization';
import { rangeOf } from '@/features/weather/copy';
import { daysBetween, fromIso, type CalendarDate } from '@/lib/dates';
import { useWarning } from '@/lib/haptics';
import { motion, radius, size, space, travel, useTheme } from '@/theme';

export default function Proposals() {
  const router = useRouter();
  const queryClient = useQueryClient();
  // `date` is the day of the calendar the looks are for, when they were asked for from a day ahead.
  const params = useLocalSearchParams<{ request: string; occasion: string; note?: string; base?: string; date?: string }>();
  const occasion: Occasion = isOccasion(params.occasion) ? params.occasion : 'everyday';
  const today = usePlaceToday();
  const asked = params.date ? fromIso(params.date) : null;
  // Today named by its date is an ordinary request for today.
  const planFor = asked && daysBetween(today, asked) > 0 ? asked : null;

  const answer = useQuery({
    queryKey: outfitKeys.suggestions(params.request),
    queryFn: async () => {
      try {
        return await suggestOutfits({ occasion, note: params.note, baseItemId: params.base, date: planFor ? params.date : undefined });
      } finally {
        // Whatever the answer, the count of proposals left for today has changed or is now known.
        void queryClient.invalidateQueries({ queryKey: wardrobeKeys.usage });
      }
    },
    // One request is one question to the server: it is not asked again by itself, and a failed one is asked by the button.
    staleTime: Infinity,
    retry: false,
  });
  // Today's forecast stands in for the header while the answer is on its way; for a day ahead only that day's own weather will do.
  const forecast = useQuery({ queryKey: weatherKeys.today, queryFn: fetchWeatherToday, staleTime: weatherStaleMs, enabled: !planFor }).data;
  const weather = answer.data?.weather ?? (planFor ? undefined : forecast);
  useWarning(codeOf(answer.error) === 'limit_reached');

  const day = planFor ? dayWord(planFor, today) : weather?.forTomorrow ? 'tomorrow' : 'today';
  const place = weather?.place ? ` in ${weather.place}` : '';
  const around = params.base ? 'Built around your piece, for' : 'For';
  const headerFor = (title: string, lead?: string) => (
    <Header
      eyebrow={weather ? `${occasionLabel(occasion)}, ${rangeOf(weather)}` : occasionLabel(occasion)}
      icon={occasionIcon(occasion)}
      title={title}
      lead={lead}
      onBack={() => router.back()}
    />
  );
  const header = headerFor(planFor ? looksTitle(planFor, today) : `Looks for ${day}`);

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
        <Fade key="problem" style={styles.message}>
          <AppText color="textSecondary">{messageFor(answer.error)}</AppText>
          {code === 'location_missing' ? (
            <Button label="Choose a city" inline onPress={() => router.push('/account/place')} testID="proposals-place" />
          ) : code === 'date_out_of_range' ? (
            <Button label="Back" inline onPress={() => router.back()} testID="proposals-back" />
          ) : code === 'limit_reached' ? (
            <Button label="Back to Today" inline onPress={() => router.back()} testID="proposals-back" />
          ) : (
            <Button label="Try again" inline busy={answer.isFetching} onPress={() => void answer.refetch()} testID="proposals-retry" />
          )}
        </Fade>
      </Frame>
    );
  }

  if (answer.data.status === 'missing_garments') {
    return (
      <Frame
        header={header}
        testID="proposals-missing"
        footer={<Button label="Add clothes" icon="plus" onPress={() => router.push('/add')} testID="proposals-add" />}>
        <MissingPanel answer={answer.data} />
      </Frame>
    );
  }

  const count = answer.data.outfits.length;
  const title = count > 0 && count <= looksNamed.length ? looksNamed[count - 1] : `Looks for ${day}`;
  return <Pager outfits={answer.data.outfits} header={headerFor(title, `${around} ${day}${place}.`)} planFor={planFor} today={today} />;
}

const looksNamed = ['One look', 'Two looks', 'Three looks'] as const;

interface HeaderProps {
  /** What the outfits are for, in the small uppercase line between the back button and the edge. */
  eyebrow: string;
  icon: IconName;
  title: string;
  lead?: string;
  onBack: () => void;
}

/** Back button, what the outfits are for, then the big serif title and one sentence under it. */
function Header({ eyebrow, icon, title, lead, onBack }: HeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.bar}>
        <IconButton icon="back" label="Back" onPress={onBack} />
        <Eyebrow icon={icon} style={styles.eyebrow}>
          {eyebrow}
        </Eyebrow>
        <View style={styles.balance} />
      </View>
      <View style={styles.titles}>
        <AppText variant="display" accessibilityRole="header">
          {title}
        </AppText>
        {lead ? (
          <AppText variant="secondary" color="textSecondary">
            {lead}
          </AppText>
        ) : null}
      </View>
    </View>
  );
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
  const column = width - 2 * size.gutter;
  return (
    <View style={[styles.gutter, styles.loading]} accessibilityRole="progressbar" accessibilityLabel="Styling your outfits">
      <View style={styles.words}>
        <Skeleton height={20} width={64} />
        <Skeleton height={20} width={72} />
        <Skeleton height={20} width={92} />
      </View>
      <Skeleton height={Math.round((stageWidth(column) * 4) / 3) + 2 * space[4]} radius={radius.well} />
      <View style={styles.message}>
        <Skeleton height={16} />
        <Skeleton height={16} width="86%" />
        <Skeleton height={16} width="56%" />
      </View>
      <View style={styles.working}>
        <Pulse active>
          <Icon name="sparkle" size={20} color="action" />
        </Pulse>
        <AppText variant="secondary" color="textSecondary" accessibilityRole="text" accessibilityLiveRegion="polite" style={styles.workingText}>
          Styling three outfits from your wardrobe.
        </AppText>
      </View>
    </View>
  );
}

/** The wardrobe cannot dress the person for this weather and occasion: what is missing, and what would fix it. */
function MissingPanel({ answer }: { answer: Suggestions }) {
  const notice = missingNotice(answer.missing, answer.missingEither, answer.weather.feelsMin);
  return (
    <View style={styles.gutter}>
      <Fade>
        <View style={styles.message} accessibilityRole="alert" testID="proposals-missing-panel">
          <AppText variant="heading">{notice.title}</AppText>
          <AppText color="textSecondary">{notice.text}</AppText>
        </View>
      </Fade>
    </View>
  );
}

interface PagerProps {
  outfits: readonly Outfit[];
  header: ReactNode;
  /** The day ahead the looks were asked for: the main action plans the look for it instead of wearing it today. */
  planFor: CalendarDate | null;
  today: CalendarDate;
}

/** The proposals, side by side: swipe or press a pill to move between them. */
function Pager({ outfits, header, planFor, today }: PagerProps) {
  const { width } = useWindowDimensions();
  const pages = useRef<ScrollViewInstance>(null);
  const [index, setIndex] = useState(0);
  const [worn, setWorn] = useState<readonly string[]>([]);
  const actions = useOutfitActions();
  const planning = usePlanning();
  const canPlan = useCanPlan();
  // The looks planned from this screen, by the day each was planned for: the button says so until the plan is undone.
  const [planned, setPlanned] = useState<readonly string[]>([]);
  // While a board is being arranged, a drag moves the garment under the finger: neither the pages nor the page scroll.
  const scrollable = useScrollable();

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

  const labels = outfits.map((outfit, position) => (outfit.kind ? kindLabel(outfit.kind) : `Outfit ${position + 1}`));
  const go = (to: number) => {
    setIndex(to);
    pages.current?.scrollTo({ x: to * width, animated: true });
  };
  const wearing = worn.includes(current.id);
  const isPlanned = planned.includes(current.id);
  const plan = async () => {
    if (planFor && (await planning.plan(current, planFor, today))) {
      setPlanned((ids) => [...ids, current.id]);
    }
  };
  const failed = actions.error ?? planning.error;

  return (
    <Frame
      header={header}
      testID="proposals-screen"
      footer={
        <>
          <FormError message={failed ? messageFor(failed) : null} />
          <PlanNotice
            outfitId={current.id}
            today={today}
            onUndo={(entry) => {
              setPlanned((ids) => ids.filter((id) => id !== entry.outfit.id));
              void planning.undo(entry);
            }}
          />
          {planFor ? (
            <Fade key={isPlanned ? 'planned' : 'plan'} enter={isPlanned} exit duration={motion.exit}>
              <Button
                label={isPlanned ? plannedLabel(planFor, today) : planLabel(planFor, today)}
                icon={isPlanned ? 'check' : 'calendar'}
                kind={isPlanned ? 'secondary' : 'primary'}
                busy={planning.planning}
                onPress={isPlanned ? undefined : () => void plan()}
                testID="proposals-plan-day"
              />
            </Fade>
          ) : (
            <Fade key={wearing ? 'worn' : 'wear'} enter={wearing} exit duration={motion.exit}>
              <Button
                label={wearing ? 'Worn' : 'Wear this today'}
                icon="check"
                kind={wearing ? 'secondary' : 'primary'}
                busy={actions.wearing}
                onPress={() => actions.wear(current, () => setWorn((ids) => [...ids, current.id]))}
                testID="proposals-wear"
              />
            </Fade>
          )}
          {canPlan ? (
            <Button
              label={planFor ? calendarCopy.otherDay : calendarCopy.planADay}
              kind="text"
              icon="calendar"
              compact
              onPress={() => void planning.choose(current, today)}
              testID="proposals-plan"
            />
          ) : null}
        </>
      }>
      {/* The proposals arrive together: the tabs and the pages rise a few points and fade in once; paging after that is the scroll view's own. */}
      <Fade rise={travel.rise} style={styles.arrival}>
        {outfits.length > 1 ? (
          <View style={styles.gutter}>
            <ProposalTabs labels={labels} selected={index} onSelect={go} />
          </View>
        ) : null}
        <ScrollView
          ref={pages}
          horizontal
          pagingEnabled
          scrollEnabled={scrollable}
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(event) => setIndex(pageIndex(event.nativeEvent.contentOffset.x, width, outfits.length))}
          testID="proposals-pages">
          {outfits.map((outfit) => (
            <ScrollView key={outfit.id} style={{ width }} contentContainerStyle={styles.page} scrollEnabled={scrollable} showsVerticalScrollIndicator={false}>
              {outfits.length === 1 && outfit.kind ? (
                <AppText variant="eyebrow" color="action">
                  {kindLabel(outfit.kind)}
                </AppText>
              ) : null}
              <Look outfit={outfit} width={width - 2 * size.gutter} onKeep={() => actions.keep(outfit)} onArrange={(layout) => actions.arrange(outfit, layout)} onArrangeFigure={(layout) => actions.arrangeFigure(outfit, layout)} />
            </ScrollView>
          ))}
        </ScrollView>
      </Fade>
    </Frame>
  );
}

interface LookProps {
  outfit: Outfit;
  /** Width of the content column. */
  width: number;
  onKeep: () => void;
  onArrange: (layout: OutfitPlacement[] | null) => Promise<unknown>;
  onArrangeFigure: (layout: OutfitPlacement[] | null) => Promise<unknown>;
}

/** One proposal: the outfit on its well, its name and what the stylist said, then the ways to answer it. */
function Look({ outfit, width, onKeep, onArrange, onArrangeFigure }: LookProps) {
  const viewer = useOutfitViewer(outfit, undefined);
  return (
    <>
      <OutfitVisualization
        viewer={viewer}
        outfit={outfit}
        width={width}
        onArrange={onArrange}
        onArrangeFigure={onArrangeFigure}
      />
      {outfit.name ? (
        <AppText variant="heading" accessibilityRole="header">
          {outfit.name}
        </AppText>
      ) : null}
      <OutfitNotes outfit={outfit} />
      <TryOnButton viewer={viewer} />
      <KeepBar outfit={outfit} onKeep={onKeep} />
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  gutter: { paddingHorizontal: size.gutter },
  header: { gap: space[4] },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[3] },
  eyebrow: { flexShrink: 1 },
  balance: { width: size.touch, height: size.touch },
  titles: { gap: space[2] },
  arrival: { flex: 1, gap: space[4] },
  body: { flex: 1, gap: space[4], paddingTop: space[4] },
  footer: { paddingHorizontal: size.gutter, paddingTop: space[2], gap: space[1] },
  page: { paddingHorizontal: size.gutter, paddingBottom: space[4], gap: space[4] },
  message: { gap: space[3] },
  loading: { gap: space[4] },
  working: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  workingText: { flexShrink: 1 },
  words: { flexDirection: 'row', gap: 22 },
});
