import { useRouter } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { UsageFilter } from '@/api/wardrobe';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { IconButton, Swatch } from '@/components/controls';
import { Card } from '@/components/lists';
import { ToggleFade } from '@/components/motion';
import { Pill, ToggleRow } from '@/components/toggles';
import { defaultArrangement, groupByOptions, sortOptions } from '@/features/wardrobe/arrange';
import { isFiltered, useWardrobeFilters } from '@/features/wardrobe/filters';
import { seasonIcon } from '@/features/wardrobe/seasons';
import { useDictionaries } from '@/features/wardrobe/useDictionaries';
import { capitalized } from '@/lib/plural';
import { motion, size, space, useTheme } from '@/theme';

const usageOptions: readonly { value: UsageFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'unused', label: 'Not used in outfits' },
  { value: 'used', label: 'Used in outfits' },
];

/**
 * Narrowing, sorting and grouping the wardrobe: a sheet over the list, in sections. Every choice applies at once, so the list
 * behind it already shows the result. Several values may be chosen in Groups, Colors, Seasons and Materials; the rest take one.
 */
export default function WardrobeFilters() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dictionaries = useDictionaries();
  const state = useWardrobeFilters();
  const theme = useTheme();
  const list = useRef<ScrollView>(null);
  // Whether filters are still hidden below the fold: the footer says so until the list is scrolled to its end.
  const [sizes, setSizes] = useState({ frame: 0, content: 0 });
  const [offset, setOffset] = useState(0);
  const measure = (part: Partial<typeof sizes>) => setSizes((current) => ({ ...current, ...part }));
  const more = sizes.content - sizes.frame - offset > space[4];
  // The system scroll bar shows itself for a moment when the sheet opens, as a second cue.
  useEffect(() => {
    const flash = setTimeout(() => list.current?.flashScrollIndicators(), motion.sheet);
    return () => clearTimeout(flash);
  }, []);
  const arranged = state.sort !== defaultArrangement.sort || state.groupBy !== defaultArrangement.groupBy;
  const data = dictionaries.data;

  // The root stays a real native view: react-native-screens resizes a ScrollView it finds directly under a sheet to the whole sheet.
  return (
    <View collapsable={false} style={styles.sheet} testID="filters-sheet">
      <View style={styles.head}>
        <AppText variant="heading" accessibilityRole="header">
          Filters
        </AppText>
        <IconButton icon="close" label="Close" onPress={() => router.back()} />
      </View>
      <ScrollView
        ref={list}
        style={styles.list}
        contentContainerStyle={styles.body}
        onLayout={(event) => measure({ frame: event.nativeEvent.layout.height })}
        onContentSizeChange={(_, height) => measure({ content: height })}
        onScroll={(event) => setOffset(event.nativeEvent.contentOffset.y)}
        scrollEventThrottle={32}>
        <Section title="Groups">
          <Pill label="All" selected={state.groups.length === 0} onPress={state.clearGroups} testID="filter-group-all" />
          {(data?.groups ?? []).map((entry) => (
            <Pill key={entry.code} label={entry.label} selected={state.groups.includes(entry.code)} onPress={() => state.toggleGroup(entry.code)} testID={`filter-group-${entry.code}`} />
          ))}
        </Section>

        <Section title="Colors" spacing={space[1]}>
          {(data?.colors ?? []).map((entry) => (
            <Swatch
              key={entry.code}
              hex={entry.hex}
              label={capitalized(entry.label)}
              selected={state.colors.includes(entry.code)}
              onPress={() => state.toggleColor(entry.code)}
              testID={`filter-color-${entry.code}`}
            />
          ))}
        </Section>

        <Section title="Seasons">
          {(data?.seasons ?? []).map((entry) => (
            <Pill
              key={entry.code}
              label={entry.label}
              icon={seasonIcon[entry.code]}
              selected={state.seasons.includes(entry.code)}
              onPress={() => state.toggleSeason(entry.code)}
              testID={`filter-season-${entry.code}`}
            />
          ))}
        </Section>

        <Section title="Materials">
          {(data?.materials ?? []).map((entry) => (
            <Pill
              key={entry.code}
              label={capitalized(entry.label)}
              selected={state.materials.includes(entry.code)}
              onPress={() => state.toggleMaterial(entry.code)}
              testID={`filter-material-${entry.code}`}
            />
          ))}
        </Section>

        <Section title="Usage">
          {usageOptions.map((option) => (
            <Pill key={option.value} role="radio" label={option.label} selected={state.usage === option.value} onPress={() => state.setUsage(option.value)} testID={`filter-usage-${option.value}`} />
          ))}
        </Section>

        <Card>
          <ToggleRow
            label="Forgotten clothes only"
            meta="Clothes you marked as rarely worn, or haven’t worn in 30 days."
            value={state.forgotten}
            onChange={state.setForgotten}
            last
            testID="filter-forgotten"
          />
        </Card>

        <Section title="Sort by">
          {sortOptions.map((option) => (
            <Pill key={option.value} role="radio" label={option.label} selected={state.sort === option.value} onPress={() => state.setSort(option.value)} testID={`filter-sort-${option.value}`} />
          ))}
        </Section>

        <Section title="Group by">
          {groupByOptions.map((option) => (
            <Pill key={option.value} role="radio" label={option.label} selected={state.groupBy === option.value} onPress={() => state.setGroupBy(option.value)} testID={`filter-groupby-${option.value}`} />
          ))}
        </Section>
      </ScrollView>
      {/* A box of its own under the list: the filters scroll behind its top line and never sit under the buttons. */}
      <View style={[styles.footer, { borderTopColor: theme.border, backgroundColor: theme.canvas, paddingBottom: Math.max(insets.bottom, space[4]) }]}>
        <ToggleFade on={more} style={styles.more}>
          <AppText variant="meta" color="textSecondary" align="center">
            Scroll for more filters
          </AppText>
        </ToggleFade>
        <View style={styles.actions}>
          <Button label="Clear filters" kind="secondary" disabled={!isFiltered(state) && !arranged} onPress={state.clear} style={styles.action} testID="filters-clear" />
          <Button label="Show clothes" onPress={() => router.back()} style={styles.action} testID="filters-done" />
        </View>
      </View>
    </View>
  );
}

/** A labelled section whose options wrap onto as many lines as they need. */
function Section({ title, spacing = space[2], children }: { title: string; spacing?: number; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <AppText variant="subheading" accessibilityRole="header">
        {title}
      </AppText>
      <View style={[styles.options, { gap: spacing }]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, paddingHorizontal: size.gutter, paddingTop: space[6], gap: space[4] },
  footer: { marginTop: -space[4], marginHorizontal: -size.gutter, paddingHorizontal: size.gutter, paddingTop: space[2], borderTopWidth: 1, gap: space[2] },
  more: { height: 18, justifyContent: 'center' },
  actions: { flexDirection: 'row', gap: space[2] },
  action: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  // The list runs to both edges of the sheet, so the scroll bar sits in the gutter beside the options, not over them.
  list: { marginHorizontal: -size.gutter },
  body: { gap: space[6], paddingHorizontal: size.gutter, paddingBottom: space[4] },
  section: { gap: space[2] },
  options: { flexDirection: 'row', flexWrap: 'wrap' },
});
