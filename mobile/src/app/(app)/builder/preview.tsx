import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Redirect, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { calendarKeys } from '@/api/calendar';
import { createOutfit, fetchOutfitTips, outfitKeys, updateOutfit, type Occasion, type Outfit, type OutfitChange, type OutfitItem, type OutfitPlacement } from '@/api/outfits';
import { codeOf } from '@/api/problem';
import { wardrobeKeys, type Clothing } from '@/api/wardrobe';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { IconButton, IconToggleButton } from '@/components/controls';
import { Eyebrow } from '@/components/Eyebrow';
import { Field } from '@/components/Field';
import { FormError } from '@/components/forms';
import { GarmentImage } from '@/components/garments';
import { Icon } from '@/components/Icon';
import { Row } from '@/components/lists';
import { Fade, Pulse } from '@/components/motion';
import { Screen } from '@/components/Screen';
import { TextTabs } from '@/components/TextTabs';
import { messageFor } from '@/copy/errors';
import { occasionOptions } from '@/copy/labels';
import { groupTitle, previewCopy } from '@/features/builder/copy';
import { minPieces } from '@/features/builder/selection';
import { useOutfitBuilder } from '@/features/builder/useOutfitBuilder';
import { calendarCopy } from '@/features/calendar/copy';
import { PlanNotice } from '@/features/calendar/PlanNotice';
import { usePickDay, usePlanning } from '@/features/calendar/session';
import { useCanPlan, usePlaceToday } from '@/features/calendar/useCalendar';
import { OutfitVisualization, TryOnButton, useOutfitViewer } from '@/features/visualization/OutfitVisualization';
import { groupLabel, useDictionaries } from '@/features/wardrobe/useDictionaries';
import type { CalendarDate } from '@/lib/dates';
import * as haptics from '@/lib/haptics';
import { motion, radius, size, space, travel } from '@/theme';

const nameMaxLength = 60;

/**
 * "Build an outfit", step two: the outfit as one picture, its pieces to swap or take out, and what to do with it: wear
 * it, save it (the bookmark under the picture), try it on, ask for tips, plan it for a day. Nothing here leads to
 * another screen: the check in the corner closes the builder when the person is done.
 */
export default function BuilderPreview() {
  const items = useOutfitBuilder((state) => state.items);
  const [occasion, setOccasion] = useState<Occasion>('everyday');
  const [name, setName] = useState('');

  if (items.length === 0) {
    return <Redirect href="/builder" />;
  }

  // A swapped or removed piece makes it another outfit: what was stored, pictured or said about the old one is let go.
  return <Look key={items.map((item) => item.id).join(' ')} items={items} occasion={occasion} onOccasion={setOccasion} name={name} onName={setName} />;
}

interface LookProps {
  items: readonly Clothing[];
  occasion: Occasion;
  onOccasion: (occasion: Occasion) => void;
  name: string;
  onName: (name: string) => void;
}

/** One combination of pieces, from the moment it is put together until one of them changes. */
function Look({ items, occasion, onOccasion, name, onName }: LookProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const clear = useOutfitBuilder((state) => state.clear);
  const remove = useOutfitBuilder((state) => state.remove);
  const arranged = useOutfitBuilder((state) => state.layout);
  const arrangedFigure = useOutfitBuilder((state) => state.figureLayout);
  const arrange = useOutfitBuilder((state) => state.arrange);
  const arrangeFigure = useOutfitBuilder((state) => state.arrangeFigure);
  const dictionaries = useDictionaries().data;
  const canPlan = useCanPlan();
  const pickDay = usePickDay();
  const planning = usePlanning();
  const today = usePlaceToday();
  // The outfit once it is stored for good: by the bookmark, by wearing it or by planning it.
  const [kept, setKept] = useState<Outfit | null>(null);
  const [worn, setWorn] = useState(false);
  const storing = useRef<Promise<Outfit> | null>(null);
  // Trying the outfit on before it is stored keeps it once as a draft; storing it then hands the draft's picture on.
  const draft = useRef<Promise<string> | null>(null);

  const ids = items.map((item) => item.id);
  const enough = items.length >= minPieces;
  // An arrangement made before a piece was swapped out no longer names only what is in the outfit.
  const within = (placements: OutfitPlacement[] | null) => placements?.filter((placement) => ids.includes(placement.clothingId)) ?? null;
  const layout = within(arranged);
  const figureLayout = within(arrangedFigure);

  /** Stores the outfit among the saved ones, once: every way of keeping it leads through here. */
  const store = (): Promise<Outfit> => {
    const stored = (storing.current ??= (async () => {
      const outfit = await createOutfit({ items: ids, occasion, name, draftId: await draft.current?.catch(() => null), layout: layout?.length ? layout : undefined, figureLayout: figureLayout?.length ? figureLayout : undefined });
      queryClient.setQueryData(outfitKeys.one(outfit.id), outfit);
      void queryClient.invalidateQueries({ queryKey: outfitKeys.saved });
      setKept(outfit);
      return outfit;
    })());
    stored.catch(() => {
      // Not stored: the next try starts over instead of repeating this answer.
      storing.current = null;
    });
    return stored;
  };

  const prepare = () => {
    if (storing.current) {
      return storing.current.then((outfit) => outfit.id);
    }

    const stored = (draft.current ??= createOutfit({ items: ids, occasion, saved: false }).then((outfit) => outfit.id));
    stored.catch(() => {
      draft.current = null;
    });
    return stored;
  };

  const pieces: OutfitItem[] = items.flatMap((clothing) => (clothing.category ? [{ slot: clothing.category, clothing }] : []));
  const viewer = useOutfitViewer(undefined, { items: pieces, prepare, layout, figureLayout });

  const tips = useMutation({ mutationFn: () => fetchOutfitTips({ items: ids, occasion }) });
  const keep = useMutation({
    // The bookmark: stores the outfit the first time, and after that takes it out of the saved ones or puts it back.
    mutationFn: async () => {
      if (!kept) {
        haptics.keep(true);
        return store();
      }

      haptics.keep(!kept.isSaved);
      setKept({ ...kept, isSaved: !kept.isSaved });
      try {
        return await updateOutfit(kept.id, { saved: !kept.isSaved });
      } catch (error) {
        setKept(kept);
        throw error;
      }
    },
    onSuccess: (outfit) => {
      setKept(outfit);
      void queryClient.invalidateQueries({ queryKey: outfitKeys.saved });
    },
  });
  const wear = useMutation({
    mutationFn: async () => updateOutfit((await store()).id, { worn: true }),
    onSuccess: (outfit) => {
      haptics.success();
      setKept(outfit);
      setWorn(true);
      void queryClient.invalidateQueries({ queryKey: outfitKeys.saved });
      void queryClient.invalidateQueries({ queryKey: wardrobeKeys.stats });
      void queryClient.invalidateQueries({ queryKey: [...wardrobeKeys.all, 'list'] });
      // Wearing writes today into the calendar on the server.
      void queryClient.invalidateQueries({ queryKey: calendarKeys.all });
    },
  });
  const plan = useMutation({
    // An outfit has to exist before it can stand on a day. The line above the buttons confirms the plan and can undo it.
    mutationFn: async (day: CalendarDate) => planning.plan(await store(), day, today),
  });
  const planADay = async () => {
    const day = await pickDay(kept?.id ?? null);
    if (day) {
      plan.mutate(day);
    }
  };

  /** An arrangement is kept with the outfit being built, and with the stored one once there is one. */
  const keepArrangement = (change: Pick<OutfitChange, 'layout' | 'figureLayout'>) =>
    kept ? updateOutfit(kept.id, change).then(setKept, () => undefined) : undefined;

  const done = () => {
    // Stored, the outfit is finished with; not stored, it waits in the builder for the next visit.
    if (kept) {
      clear();
    }

    router.dismiss(2);
  };

  const tipsError = tips.isError ? (codeOf(tips.error) === 'limit_reached' ? previewCopy.limit : messageFor(tips.error)) : null;
  const failed = keep.error ?? wear.error ?? plan.error ?? planning.error;
  const buttonTop = insets.top + space[2];

  return (
    <Screen
      testID="builder-preview-screen"
      contentStyle={styles.screen}
      footer={
        <View style={styles.footer}>
          <FormError message={failed ? messageFor(failed) : null} />
          <PlanNotice outfitId={kept?.id} today={today} onUndo={(entry) => void planning.undo(entry)} />
          {enough ? null : (
            <AppText variant="caption" color="textSecondary" align="center" testID="builder-few">
              {previewCopy.few}
            </AppText>
          )}
          <View style={styles.actions}>
            <Fade key={worn ? 'worn' : 'wear'} enter={worn} exit duration={motion.exit} style={styles.wear}>
              <Button
                label={worn ? previewCopy.worn : previewCopy.wear}
                icon="check"
                kind={worn ? 'secondary' : 'primary'}
                busy={wear.isPending}
                disabled={!enough}
                onPress={worn ? undefined : () => wear.mutate()}
                testID="builder-wear"
              />
            </Fade>
            {enough ? <TryOnButton viewer={viewer} inline /> : null}
          </View>
          <View style={styles.links}>
            <Button
              label={tips.isSuccess ? previewCopy.tipsAgain : previewCopy.tips}
              kind="text"
              icon="sparkle"
              compact
              busy={tips.isPending}
              disabled={!enough}
              onPress={() => tips.mutate()}
              testID="builder-tips"
            />
            {canPlan ? (
              <Button label={calendarCopy.planADay} kind="text" icon="calendar" compact busy={plan.isPending} disabled={!enough} onPress={() => void planADay()} testID="builder-plan" />
            ) : null}
          </View>
        </View>
      }>
      <View style={styles.content}>
        <OutfitVisualization
          viewer={viewer}
          draft={{ items: pieces, prepare, layout, figureLayout }}
          onArrange={(next) => {
            arrange(next);
            return keepArrangement({ layout: next });
          }}
          onArrangeFigure={(next) => {
            arrangeFigure(next);
            return keepArrangement({ figureLayout: next });
          }}
          width={width}
          trailing={
            enough ? (
              <IconToggleButton
                icon="bookmark"
                label={kept?.isSaved ? 'Remove from saved' : 'Save outfit'}
                active={kept?.isSaved ?? false}
                onPress={() => (keep.isPending ? undefined : keep.mutate())}
                haptic="none"
                bare
                testID="builder-save"
              />
            ) : null
          }
          hero={{
            top: buttonTop,
            overlay: (
              <>
                <IconButton icon="back" label="Back" onPress={() => router.back()} style={[styles.corner, { top: buttonTop, left: size.gutter }]} />
                <IconButton icon="check" label={previewCopy.finish} color="action" onPress={done} style={[styles.corner, { top: buttonTop, right: size.gutter }]} testID="builder-done" />
              </>
            ),
          }}
          testID="builder-looks"
        />

        <AppText variant="display" accessibilityRole="header">
          {previewCopy.title}
        </AppText>

        {tips.isPending ? (
          <Pulse active>
            <View style={styles.tipsHead} accessibilityRole="progressbar" accessibilityLabel={previewCopy.tipsLoading}>
              <Icon name="sparkle" size={20} color="action" />
              <AppText color="textSecondary">{previewCopy.tipsLoading}</AppText>
            </View>
          </Pulse>
        ) : null}
        {tipsError ? (
          <AppText variant="secondary" color="danger" accessibilityRole="alert" testID="builder-tips-error">
            {tipsError}
          </AppText>
        ) : null}
        {tips.data ? (
          <Fade key={tips.submittedAt} rise={travel.rise} style={styles.tips} testID="builder-tips-result">
            <Eyebrow icon="sparkle" header>
              {previewCopy.tipsTitle}
            </Eyebrow>
            {tips.data.positives.length > 0 ? <TipList title={previewCopy.works} icon="check" lines={tips.data.positives} testID="builder-positives" /> : null}
            {tips.data.improvements.length > 0 ? (
              <TipList title={previewCopy.improve} icon="plus" lines={tips.data.improvements.map((tip) => tip.text)} testID="builder-improvements" />
            ) : null}
          </Fade>
        ) : null}

        {/* The pieces, each with its two ways to change the outfit: another in its place, or none. */}
        <View testID="builder-pieces">
          <Eyebrow header>{previewCopy.piecesTitle}</Eyebrow>
          {pieces.map(({ slot, clothing }) => {
            const pieceName = clothing.name ?? 'Item without details';
            return (
              <Row
                key={clothing.id}
                leading={<GarmentImage url={clothing.imageUrl} cacheKey={clothing.imageKey} height={56} inset={6} corner={radius.thumb} style={styles.thumbnail} />}
                label={pieceName}
                meta={groupLabel(dictionaries, clothing.group) ?? groupTitle[slot]}
                strong
                right={
                  <View style={styles.pieceActions}>
                    <IconButton
                      icon="refresh"
                      label={previewCopy.swap(pieceName)}
                      bare
                      onPress={() => router.push({ pathname: '/builder/swap', params: { id: clothing.id } })}
                      testID={`builder-swap-${clothing.id}`}
                    />
                    <IconButton icon="close" label={previewCopy.remove(pieceName)} bare onPress={() => remove(clothing.id)} testID={`builder-remove-${clothing.id}`} />
                  </View>
                }
                testID={`builder-piece-${clothing.id}`}
              />
            );
          })}
          <Row label={previewCopy.add} icon="plus" accent onPress={() => router.back()} last testID="builder-add-piece" />
        </View>

        <Field label={previewCopy.nameLabel} value={name} onChangeText={onName} placeholder={previewCopy.namePlaceholder} maxLength={nameMaxLength} returnKeyType="done" testID="builder-name" />
        <View style={styles.section}>
          <Eyebrow header>{previewCopy.occasionTitle}</Eyebrow>
          <TextTabs label="Occasion" layout="wrap" options={occasionOptions} value={occasion} onChange={onOccasion} testID="occasion" />
        </View>
      </View>
    </Screen>
  );
}

interface TipListProps {
  title: string;
  icon: 'check' | 'plus';
  lines: readonly string[];
  testID: string;
}

function TipList({ title, icon, lines, testID }: TipListProps) {
  return (
    <View style={styles.list} testID={testID}>
      <AppText variant="secondaryStrong" color="textSecondary">
        {title}
      </AppText>
      {lines.map((line) => (
        <View key={line} style={styles.line}>
          <View style={styles.bullet}>
            <Icon name={icon} size={16} color={icon === 'check' ? 'action' : 'textSecondary'} />
          </View>
          <AppText style={styles.lineText}>{line}</AppText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  // The picture runs to the top of the screen, under the status bar.
  screen: { paddingTop: 0 },
  content: { gap: space[6] },
  corner: { position: 'absolute' },
  footer: { gap: space[1] },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  wear: { flex: 1 },
  links: { flexDirection: 'row', justifyContent: 'center', gap: space[4] },
  thumbnail: { width: 56 },
  pieceActions: { flexDirection: 'row' },
  section: { gap: space[1] },
  tips: { gap: space[3] },
  tipsHead: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  list: { gap: space[2] },
  line: { flexDirection: 'row', gap: space[2], alignItems: 'flex-start' },
  bullet: { width: 20, height: 24, alignItems: 'center', justifyContent: 'center' },
  lineText: { flex: 1 },
});
