import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import type { StyleTag } from '@/api/account';
import {
  fetchClothing,
  updateClothing,
  wardrobeKeys,
  type Clothing,
  type Color,
  type Dictionaries,
  type GarmentGroup,
  type Material,
  type Pattern,
  type Season,
  type Subcategory,
} from '@/api/wardrobe';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { IconButton, Segmented, Swatch } from '@/components/controls';
import { Eyebrow } from '@/components/Eyebrow';
import { FormError } from '@/components/forms';
import { GarmentImage } from '@/components/garments';
import { Hairline } from '@/components/Hairline';
import type { IconName } from '@/components/Icon';
import { Skeleton } from '@/components/lists';
import { Screen } from '@/components/Screen';
import { TextTabs } from '@/components/TextTabs';
import { ToggleRow } from '@/components/toggles';
import { messageFor } from '@/copy/errors';
import { AiNote } from '@/features/wardrobe/AiNote';
import { missingTags, toggleColor, type GarmentForm } from '@/features/wardrobe/garmentForm';
import { RemovablePhotos } from '@/features/wardrobe/MorePhotos';
import { categoryOfType, useDictionaries } from '@/features/wardrobe/useDictionaries';
import { capitalized } from '@/lib/plural';
import { space, typography, useTheme } from '@/theme';

const levels = ['1', '2', '3', '4', '5'].map((value) => ({ value, label: value }));

export default function EditGarment() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const dictionaries = useDictionaries();
  const garment = useQuery({ queryKey: wardrobeKeys.one(id), queryFn: () => fetchClothing(id) });

  if (!garment.data || !dictionaries.data) {
    const failed = garment.error ?? dictionaries.error;
    return (
      <Screen testID="garment-edit-screen">
        <View style={styles.content}>
          <EditHeader onClose={() => router.back()} />
          {failed ? (
            <View style={styles.section}>
              <AppText color="textSecondary">{messageFor(failed)}</AppText>
              <Button label="Try again" kind="secondary" inline onPress={() => void Promise.all([garment.refetch(), dictionaries.refetch()])} />
            </View>
          ) : (
            <View style={styles.section} accessibilityRole="progressbar" accessibilityLabel="Loading details">
              <Skeleton height={48} />
              <Skeleton height={120} />
              <Skeleton height={120} />
            </View>
          )}
        </View>
      </Screen>
    );
  }

  return <Form garment={garment.data} dictionaries={dictionaries.data} />;
}

function Form({ garment, dictionaries }: { garment: Clothing; dictionaries: Dictionaries }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<GarmentForm>({
    name: garment.name ?? '',
    group: garment.group,
    subcategory: garment.subcategory,
    colors: garment.colors,
    pattern: garment.pattern,
    material: garment.material,
    formality: garment.formality,
    warmth: garment.warmth,
    rainOk: garment.rainOk ?? false,
    styles: garment.styles,
    seasons: garment.seasons,
  });
  const [checked, setChecked] = useState(false);
  const change = (part: Partial<GarmentForm>) => setForm((current) => ({ ...current, ...part }));

  const save = useMutation({
    mutationFn: () =>
      updateClothing(garment.id, {
        name: form.name.trim(),
        category: categoryOfType(dictionaries, form.subcategory),
        subcategory: form.subcategory,
        colors: [...form.colors],
        pattern: form.pattern,
        material: form.material,
        formality: form.formality,
        warmth: form.warmth,
        rainOk: form.rainOk,
        styles: [...form.styles],
        seasons: [...form.seasons],
      }),
    onSuccess: (saved) => {
      queryClient.setQueryData(wardrobeKeys.one(garment.id), saved);
      void queryClient.invalidateQueries({ queryKey: [...wardrobeKeys.all, 'list'] });
      void queryClient.invalidateQueries({ queryKey: wardrobeKeys.stats });
      router.back();
    },
  });

  const missing = missingTags(form);
  const types = dictionaries.groups.find((entry) => entry.code === form.group)?.types ?? [];
  const label = (entries: readonly { value: number; label: string }[], value: number | null) => entries.find((entry) => entry.value === value)?.label;

  const submit = () => {
    setChecked(true);
    if (missing.length === 0) {
      save.mutate();
    }
  };

  return (
    <Screen
      testID="garment-edit-screen"
      footer={
        <>
          <FormError
            message={
              checked && missing.length > 0 ? `Still to fill in: ${missing.join(', ')}.` : save.isError ? messageFor(save.error) : null
            }
          />
          <Button label="Save changes" busy={save.isPending} onPress={submit} testID="garment-save" />
        </>
      }>
      <View style={styles.content}>
        <EditHeader onClose={() => router.back()} />
        {garment.status === 'processing' ? (
          <AppText color="textSecondary">We’re still describing this item. You’ll be able to edit it in a moment.</AppText>
        ) : null}
        <View style={styles.identity}>
          <GarmentImage url={garment.imageUrl} cacheKey={garment.imageKey} height={140} inset={8} style={styles.photo} />
          <NameField value={form.name} onChangeText={(name) => change({ name })} testID="garment-name-field" />
        </View>

        {garment.status === 'ready' && garment.describedByAi ? <AiNote testID="garment-ai-note" /> : null}

        <RemovablePhotos garment={garment} />

        <Section title="Group">
          <TextTabs
            label="Group"
            layout="wrap"
            options={dictionaries.groups.map((entry) => ({ value: entry.code as GarmentGroup, label: entry.label }))}
            value={form.group}
            onChange={(group) =>
              // A type belongs to one group, so it is kept only if it still fits.
              change({ group, subcategory: dictionaries.groups.find((entry) => entry.code === group)?.types.some((type) => type.code === form.subcategory) ? form.subcategory : null })
            }
            testID="edit-group"
          />
        </Section>

        {form.group ? (
          <Section title="Type">
            <TextTabs
              label="Type"
              layout="wrap"
              options={types.map((entry) => ({ value: entry.code as Subcategory, label: entry.label }))}
              value={form.subcategory}
              onChange={(subcategory) => change({ subcategory })}
              testID="edit-type"
            />
          </Section>
        ) : null}

        <Section title="Colors" icon="palette" helper="One or two. The first one you choose is the main color.">
          <View accessibilityLabel="Colors" style={styles.swatches}>
            {dictionaries.colors.map((entry) => (
              <Swatch
                key={entry.code}
                hex={entry.hex}
                label={capitalized(entry.label)}
                selected={form.colors.includes(entry.code as Color)}
                onPress={() => change({ colors: toggleColor(form.colors, entry.code as Color) })}
                testID={`edit-color-${entry.code}`}
              />
            ))}
          </View>
        </Section>

        <Section title="Pattern">
          <TextTabs
            label="Pattern"
            layout="wrap"
            options={dictionaries.patterns.map((entry) => ({ value: entry.code as Pattern, label: capitalized(entry.label) }))}
            value={form.pattern}
            onChange={(pattern) => change({ pattern })}
            testID="edit-pattern"
          />
        </Section>

        <Section title="Material">
          <TextTabs
            label="Material"
            layout="wrap"
            options={dictionaries.materials.map((entry) => ({ value: entry.code as Material, label: capitalized(entry.label) }))}
            value={form.material}
            onChange={(material) => change({ material })}
            testID="edit-material"
          />
        </Section>

        <Section title="Formality" helper={label(dictionaries.formality, form.formality) ?? 'From 1 (sporty or loungewear) to 5 (formal or evening).'}>
          <Segmented label="Formality" options={levels} value={form.formality === null ? null : String(form.formality)} onChange={(value) => change({ formality: Number(value) })} />
        </Section>

        <Section title="Warmth" helper={label(dictionaries.warmth, form.warmth) ?? 'From 1 (for hot weather) to 5 (for freezing weather).'}>
          <Segmented label="Warmth" options={levels} value={form.warmth === null ? null : String(form.warmth)} onChange={(value) => change({ warmth: Number(value) })} />
        </Section>

        <View>
          <Hairline />
          <ToggleRow icon="rain" label="Good in rain" value={form.rainOk} onChange={(rainOk) => change({ rainOk })} testID="edit-rain" />
        </View>

        <Section title="Seasons" icon="sun" helper="Pick any that fit. Leave them all off and we’ll suggest seasons from the warmth.">
          <TextTabs
            label="Seasons"
            layout="wrap"
            options={dictionaries.seasons.map((entry) => ({ value: entry.code as Season, label: entry.label }))}
            value={form.seasons}
            onChange={(season) => change({ seasons: form.seasons.includes(season) ? form.seasons.filter((chosen) => chosen !== season) : [...form.seasons, season] })}
            testID="edit-season"
          />
        </Section>

        <Section title="Styles" icon="hanger" helper="Pick as many as you like, or none.">
          <TextTabs
            label="Styles"
            layout="wrap"
            options={dictionaries.styles.map((entry) => ({ value: entry.code as StyleTag, label: entry.label }))}
            value={form.styles}
            onChange={(style) => change({ styles: form.styles.includes(style) ? form.styles.filter((chosen) => chosen !== style) : [...form.styles, style] })}
            testID="edit-style"
          />
        </Section>
      </View>
    </Screen>
  );
}

/** A round way out and the name of the screen, centred between it and a spacer of the same width. */
function EditHeader({ onClose }: { onClose: () => void }) {
  return (
    <View style={styles.bar}>
      <IconButton icon="close" label="Close" onPress={onClose} />
      <AppText variant="eyebrow" accessibilityRole="header">
        Edit piece
      </AppText>
      <View style={styles.balance} />
    </View>
  );
}

/** The name, written large on its line: the serif of a title, with its caption above. */
function NameField({ value, onChangeText, testID }: { value: string; onChangeText: (text: string) => void; testID: string }) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.name}>
      <AppText variant="caption" color="textSecondary">
        Name
      </AppText>
      <TextInput
        accessibilityLabel="Name"
        value={value}
        onChangeText={onChangeText}
        placeholder="e.g. Navy oxford shirt"
        placeholderTextColor={theme.textSecondary}
        maxLength={60}
        autoCapitalize="sentences"
        returnKeyType="done"
        maxFontSizeMultiplier={1.3}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[styles.nameInput, { color: theme.text }]}
        testID={testID}
      />
      <View style={[styles.nameLine, { backgroundColor: focused ? theme.action : theme.borderControl, height: focused ? 2 : 1 }]} />
    </View>
  );
}

function Section({ title, icon, helper, children }: { title: string; icon?: IconName; helper?: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Eyebrow icon={icon} header>
        {title}
      </Eyebrow>
      {children}
      {helper ? (
        <AppText variant="meta" color="textSecondary">
          {helper}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: space[6] },
  section: { gap: 10 },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  balance: { width: 44, height: 44 },
  identity: { flexDirection: 'row', alignItems: 'flex-end', gap: space[4] },
  photo: { width: 112 },
  name: { flex: 1 },
  nameInput: { ...typography.heading, minHeight: 40, paddingVertical: 4, paddingHorizontal: 0 },
  nameLine: { alignSelf: 'stretch' },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', marginLeft: -4 },
});
