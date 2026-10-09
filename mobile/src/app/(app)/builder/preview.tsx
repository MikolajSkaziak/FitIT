import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Redirect, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { createOutfit, fetchOutfitTips, outfitKeys, type Occasion, type OutfitItem } from '@/api/outfits';
import { codeOf } from '@/api/problem';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Collage } from '@/components/Collage';
import { Field } from '@/components/Field';
import { FormError } from '@/components/forms';
import { BackHeader } from '@/components/headers';
import { Icon } from '@/components/Icon';
import { Fade, Pulse } from '@/components/motion';
import { Screen } from '@/components/Screen';
import { ChoiceGrid } from '@/components/toggles';
import { messageFor } from '@/copy/errors';
import { occasionOptions } from '@/copy/labels';
import { groupTitle, previewCopy } from '@/features/builder/copy';
import { useOutfitBuilder } from '@/features/builder/useOutfitBuilder';
import { OutfitVisualization } from '@/features/visualization/OutfitVisualization';
import { size, space, travel, useTheme } from '@/theme';

const nameMaxLength = 60;

/** "Build an outfit", step two: the outfit as one picture, tips on request, and saving it. */
export default function BuilderPreview() {
  const router = useRouter();
  const theme = useTheme();
  const queryClient = useQueryClient();
  const { width } = useWindowDimensions();
  const items = useOutfitBuilder((state) => state.items);
  const clear = useOutfitBuilder((state) => state.clear);
  const [occasion, setOccasion] = useState<Occasion>('everyday');
  const [name, setName] = useState('');
  // Trying the outfit on before saving stores it once as a draft; saving then hands the draft's picture to the saved outfit.
  const draft = useRef<Promise<string> | null>(null);

  const ids = items.map((item) => item.id);
  const prepare = () => {
    const stored = (draft.current ??= createOutfit({ items: ids, occasion, saved: false }).then((outfit) => outfit.id));
    stored.catch(() => {
      // Not stored: the next try starts over instead of repeating this answer.
      draft.current = null;
    });
    return stored;
  };

  const tips = useMutation({ mutationFn: () => fetchOutfitTips({ items: ids, occasion }) });
  const save = useMutation({
    mutationFn: async () => createOutfit({ items: ids, occasion, name, draftId: await draft.current?.catch(() => null) }),
    onSuccess: (outfit) => {
      queryClient.setQueryData(outfitKeys.one(outfit.id), outfit);
      void queryClient.invalidateQueries({ queryKey: outfitKeys.saved });
      clear();
      router.replace({ pathname: '/outfit/[id]', params: { id: outfit.id } });
    },
  });

  if (items.length === 0) {
    return <Redirect href="/builder" />;
  }

  const pieces: OutfitItem[] = items.flatMap((clothing) => (clothing.category ? [{ slot: clothing.category, clothing }] : []));
  const tipsError = tips.isError ? (codeOf(tips.error) === 'limit_reached' ? previewCopy.limit : messageFor(tips.error)) : null;

  return (
    <Screen
      testID="builder-preview-screen"
      footer={
        <View style={styles.footer}>
          <FormError message={save.isError ? messageFor(save.error) : null} />
          <Button label={previewCopy.save} busy={save.isPending} onPress={() => save.mutate()} testID="builder-save" />
          <Button
            label={tips.isSuccess ? previewCopy.tipsAgain : previewCopy.tips}
            kind="secondary"
            icon="sparkle"
            busy={tips.isPending}
            onPress={() => tips.mutate()}
            testID="builder-tips"
          />
        </View>
      }>
      <View style={styles.content}>
        <BackHeader title={previewCopy.title} onBack={() => router.back()} />
        <OutfitVisualization
          draft={{ items: pieces, prepare }}
          width={width - 2 * size.gutter}
          collage={<Collage items={pieces} width={width - 2 * size.gutter} testID="builder-collage" />}
          testID="builder-looks"
        />

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
            <View style={styles.tipsHead}>
              <Icon name="sparkle" size={20} color="action" />
              <AppText variant="subheading" accessibilityRole="header">
                {previewCopy.tipsTitle}
              </AppText>
            </View>
            {tips.data.positives.length > 0 ? <TipList title={previewCopy.works} icon="check" lines={tips.data.positives} testID="builder-positives" /> : null}
            {tips.data.improvements.length > 0 ? (
              <TipList title={previewCopy.improve} icon="plus" lines={tips.data.improvements.map((tip) => tip.text)} testID="builder-improvements" />
            ) : null}
          </Fade>
        ) : null}

        <View style={styles.section}>
          <AppText variant="subheading" accessibilityRole="header">
            {previewCopy.piecesTitle}
          </AppText>
          {pieces.map(({ slot, clothing }) => (
            <View key={clothing.id} style={[styles.piece, { borderBottomColor: theme.border }]}>
              <AppText numberOfLines={1} style={styles.pieceName}>
                {clothing.name ?? 'Item without details'}
              </AppText>
              <AppText variant="meta" color="textSecondary">
                {groupTitle[slot]}
              </AppText>
            </View>
          ))}
        </View>

        <Field label={previewCopy.nameLabel} value={name} onChangeText={setName} placeholder={previewCopy.namePlaceholder} maxLength={nameMaxLength} returnKeyType="done" testID="builder-name" />
        <View style={styles.section}>
          <AppText variant="subheading" accessibilityRole="header">
            {previewCopy.occasionTitle}
          </AppText>
          <ChoiceGrid label="Occasion" options={occasionOptions} value={occasion} onChange={setOccasion} testID="occasion" />
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
  content: { gap: space[6] },
  footer: { gap: space[2] },
  section: { gap: space[2] },
  tips: { gap: space[3] },
  tipsHead: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  list: { gap: space[2] },
  line: { flexDirection: 'row', gap: space[2], alignItems: 'flex-start' },
  bullet: { width: 20, height: 24, alignItems: 'center', justifyContent: 'center' },
  lineText: { flex: 1 },
  piece: { minHeight: size.touch, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[3], borderBottomWidth: 1 },
  pieceName: { flexShrink: 1 },
});
