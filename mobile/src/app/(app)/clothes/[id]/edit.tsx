import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { StyleTag } from '@/api/account';
import {
  fetchClothing,
  updateClothing,
  wardrobeKeys,
  type Category,
  type Clothing,
  type Color,
  type Dictionaries,
  type Material,
  type Pattern,
  type Subcategory,
} from '@/api/wardrobe';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Segmented } from '@/components/controls';
import { Field } from '@/components/Field';
import { FormError, Labeled } from '@/components/forms';
import { BackHeader } from '@/components/headers';
import { Card, Skeleton } from '@/components/lists';
import { Screen } from '@/components/Screen';
import { ChoiceGrid, ToggleRow } from '@/components/toggles';
import { messageFor } from '@/copy/errors';
import { missingTags, toggleColor, type GarmentForm } from '@/features/wardrobe/garmentForm';
import { useDictionaries } from '@/features/wardrobe/useDictionaries';
import { space } from '@/theme';

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
          <BackHeader title="Opis ubrania" onBack={() => router.back()} />
          {failed ? (
            <View style={styles.section}>
              <AppText color="textSecondary">{messageFor(failed)}</AppText>
              <Button label="Spróbuj ponownie" kind="secondary" inline onPress={() => void Promise.all([garment.refetch(), dictionaries.refetch()])} />
            </View>
          ) : (
            <View style={styles.section} accessibilityRole="progressbar" accessibilityLabel="Wczytujemy opis">
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
    category: garment.category,
    subcategory: garment.subcategory,
    colors: garment.colors,
    pattern: garment.pattern,
    material: garment.material,
    formality: garment.formality,
    warmth: garment.warmth,
    rainOk: garment.rainOk ?? false,
    styles: garment.styles,
  });
  const [checked, setChecked] = useState(false);
  const change = (part: Partial<GarmentForm>) => setForm((current) => ({ ...current, ...part }));

  const save = useMutation({
    mutationFn: () =>
      updateClothing(garment.id, {
        name: form.name.trim(),
        category: form.category,
        subcategory: form.subcategory,
        colors: [...form.colors],
        pattern: form.pattern,
        material: form.material,
        formality: form.formality,
        warmth: form.warmth,
        rainOk: form.rainOk,
        styles: [...form.styles],
      }),
    onSuccess: (saved) => {
      queryClient.setQueryData(wardrobeKeys.one(garment.id), saved);
      void queryClient.invalidateQueries({ queryKey: [...wardrobeKeys.all, 'list'] });
      void queryClient.invalidateQueries({ queryKey: wardrobeKeys.stats });
      router.back();
    },
  });

  const missing = missingTags(form);
  const types = dictionaries.categories.find((entry) => entry.code === form.category)?.types ?? [];
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
              checked && missing.length > 0 ? `Uzupełnij jeszcze: ${missing.join(', ')}.` : save.isError ? messageFor(save.error) : null
            }
          />
          <Button label="Zapisz opis" busy={save.isPending} onPress={submit} testID="garment-save" />
        </>
      }>
      <View style={styles.content}>
        <BackHeader title="Opis ubrania" onBack={() => router.back()} />
        {garment.status === 'processing' ? (
          <AppText color="textSecondary">To ubranie jest jeszcze opisywane. Opis zmienisz za chwilę.</AppText>
        ) : null}
        <Field
          label="Nazwa"
          value={form.name}
          onChangeText={(name) => change({ name })}
          placeholder="np. Granatowa koszula oxford"
          maxLength={60}
          autoCapitalize="sentences"
          returnKeyType="done"
          testID="garment-name-field"
        />

        <Section title="Kategoria">
          <ChoiceGrid
            label="Kategoria"
            options={dictionaries.categories.map((entry) => ({ value: entry.code as Category, label: entry.label }))}
            value={form.category}
            onChange={(category) =>
              // A type belongs to one category, so it is kept only if it still fits.
              change({ category, subcategory: dictionaries.categories.find((entry) => entry.code === category)?.types.some((type) => type.code === form.subcategory) ? form.subcategory : null })
            }
            testID="edit-category"
          />
        </Section>

        {form.category ? (
          <Section title="Typ">
            <ChoiceGrid
              label="Typ"
              options={types.map((entry) => ({ value: entry.code as Subcategory, label: entry.label }))}
              value={form.subcategory}
              onChange={(subcategory) => change({ subcategory })}
              testID="edit-type"
            />
          </Section>
        ) : null}

        <Section title="Kolor" helper="Jeden albo dwa. Pierwszy wybrany jest główny.">
          <ChoiceGrid
            label="Kolor"
            columns={3}
            options={dictionaries.colors.map((entry) => ({ value: entry.code as Color, label: entry.label }))}
            value={form.colors}
            onChange={(color) => change({ colors: toggleColor(form.colors, color) })}
            testID="edit-color"
          />
        </Section>

        <Section title="Wzór">
          <ChoiceGrid
            label="Wzór"
            columns={3}
            options={dictionaries.patterns.map((entry) => ({ value: entry.code as Pattern, label: entry.label }))}
            value={form.pattern}
            onChange={(pattern) => change({ pattern })}
            testID="edit-pattern"
          />
        </Section>

        <Section title="Materiał">
          <ChoiceGrid
            label="Materiał"
            columns={3}
            options={dictionaries.materials.map((entry) => ({ value: entry.code as Material, label: entry.label }))}
            value={form.material}
            onChange={(material) => change({ material })}
            testID="edit-material"
          />
        </Section>

        <Labeled label="Formalność" helper={label(dictionaries.formality, form.formality) ?? 'Od 1 (sportowe lub domowe) do 5 (formalne lub wieczorowe).'}>
          <Segmented label="Formalność" options={levels} value={form.formality === null ? null : String(form.formality)} onChange={(value) => change({ formality: Number(value) })} />
        </Labeled>

        <Labeled label="Ciepło" helper={label(dictionaries.warmth, form.warmth) ?? 'Od 1 (na upał) do 5 (na mróz).'}>
          <Segmented label="Ciepło" options={levels} value={form.warmth === null ? null : String(form.warmth)} onChange={(value) => change({ warmth: Number(value) })} />
        </Labeled>

        <Card>
          <ToggleRow label="Nadaje się na deszcz" value={form.rainOk} onChange={(rainOk) => change({ rainOk })} last testID="edit-rain" />
        </Card>

        <Section title="Styl" helper="Możesz wybrać kilka albo żaden.">
          <ChoiceGrid
            label="Styl"
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

function Section({ title, helper, children }: { title: string; helper?: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <AppText variant="secondaryStrong" accessibilityRole="header">
        {title}
      </AppText>
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
  section: { gap: space[2] },
});
