import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type ScrollViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fetchClothes, wardrobeKeys, type GarmentGroup, type UsageFilter } from '@/api/wardrobe';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Swatch } from '@/components/controls';
import { Eyebrow } from '@/components/Eyebrow';
import { Hairline } from '@/components/Hairline';
import type { IconName } from '@/components/Icon';
import { PressScale, ToggleFade } from '@/components/motion';
import { TextTabs } from '@/components/TextTabs';
import { ToggleRow } from '@/components/toggles';
import { defaultArrangement, groupByOptions, sortOptions } from '@/features/wardrobe/arrange';
import { isFiltered, useWardrobeFilters } from '@/features/wardrobe/filters';
import { useDictionaries } from '@/features/wardrobe/useDictionaries';
import { capitalized, plural } from '@/lib/plural';
import { motion, size, space, useTheme } from '@/theme';

const usageOptions: readonly { value: UsageFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'unused', label: 'Not used in outfits' },
  { value: 'used', label: 'Used in outfits' },
];

/**
 * Narrowing, sorting and grouping the wardrobe: a sheet over the list, in sections. Every choice applies at once, so the list
 * behind it already shows the result. Several values may be chosen in Group, Season, Material and Color; the rest take one.
 */
export default function WardrobeFilters() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dictionaries = useDictionaries();
  const state = useWardrobeFilters();
  const theme = useTheme();
  const list = useRef<ScrollViewInstance>(null);
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

  const nothingSet = !isFiltered(state) && !arranged;
  // What the list behind the sheet shows for these choices: read from the list's own answer, never asked again from here.
  const shown = useQuery({ queryKey: wardrobeKeys.list(state), queryFn: ({ signal }) => fetchClothes(state, signal), enabled: false, placeholderData: keepPreviousData });
  const showLabel = shown.data ? `Show ${shown.data.length} ${plural(shown.data.length, ['piece', 'pieces'])}` : 'Show clothes';
  const groupOptions = [{ value: 'all' as GarmentGroup | 'all', label: 'All' }, ...(data?.groups ?? []).map((entry) => ({ value: entry.code as GarmentGroup | 'all', label: entry.label }))];

  // The root stays a real native view: react-native-screens resizes a ScrollView it finds directly under a sheet to the whole sheet.
  return (
    <View collapsable={false} style={styles.sheet} testID="filters-sheet">
      <View style={styles.head}>
        <AppText variant="heading" accessibilityRole="header">
          Filters
        </AppText>
        <ClearLink disabled={nothingSet} onPress={state.clear} />
      </View>
      <ScrollView
        ref={list}
        style={styles.list}
        contentContainerStyle={styles.body}
        onLayout={(event) => measure({ frame: event.nativeEvent.layout.height })}
        onContentSizeChange={(_, height) => measure({ content: height })}
        onScroll={(event) => setOffset(event.nativeEvent.contentOffset.y)}
        scrollEventThrottle={32}>
        <Section title="Group" icon="hanger">
          <TextTabs
            label="Group"
            layout="wrap"
            options={groupOptions}
            value={state.groups.length > 0 ? state.groups : ['all']}
            onChange={(group) => (group === 'all' ? state.clearGroups() : state.toggleGroup(group))}
            testID="filter-group"
          />
        </Section>

        <Section title="Season" icon="sun">
          <TextTabs
            label="Season"
            layout="wrap"
            options={(data?.seasons ?? []).map((entry) => ({ value: entry.code, label: entry.label }))}
            value={state.seasons}
            onChange={state.toggleSeason}
            testID="filter-season"
          />
        </Section>

        <Section title="Material" icon="style">
          <TextTabs
            label="Material"
            layout="wrap"
            options={(data?.materials ?? []).map((entry) => ({ value: entry.code, label: capitalized(entry.label) }))}
            value={state.materials}
            onChange={state.toggleMaterial}
            testID="filter-material"
          />
        </Section>

        <Section title="Usage" icon="bookmark">
          <TextTabs label="Usage" layout="wrap" options={usageOptions} value={state.usage} onChange={state.setUsage} testID="filter-usage" />
        </Section>

        <View>
          <Hairline />
          <ToggleRow
            icon="clock"
            label="Forgotten clothes only"
            meta="Clothes you marked as rarely worn, or haven’t worn in 30 days."
            value={state.forgotten}
            onChange={state.setForgotten}
            testID="filter-forgotten"
          />
        </View>

        <Section title="Sort by" icon="filters">
          <TextTabs label="Sort by" layout="wrap" options={sortOptions} value={state.sort} onChange={state.setSort} testID="filter-sort" />
        </Section>

        <Section title="Group by" icon="hanger">
          <TextTabs label="Group by" layout="wrap" options={groupByOptions} value={state.groupBy} onChange={state.setGroupBy} testID="filter-groupby" />
        </Section>

        <Section title="Color" icon="palette">
          <View accessibilityLabel="Color" style={styles.swatches}>
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
          </View>
        </Section>
      </ScrollView>
      {/* A box of its own under the list: the filters scroll behind its top line and never sit under the button. */}
      <View style={[styles.footer, { borderTopColor: theme.border, backgroundColor: theme.canvas, paddingBottom: Math.max(insets.bottom, space[4]) }]}>
        <ToggleFade on={more} style={styles.more}>
          <AppText variant="meta" color="textSecondary" align="center">
            Scroll for more filters
          </AppText>
        </ToggleFade>
        <Button label={showLabel} onPress={() => router.back()} testID="filters-done" />
      </View>
    </View>
  );
}

/** "Clear all" in green words at the end of the title row; grey and inert while nothing is set. */
function ClearLink({ disabled, onPress }: { disabled: boolean; onPress: () => void }) {
  return (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel="Clear filters"
      accessibilityState={{ disabled }}
      disabled={disabled}
      haptic="quiet"
      onPress={onPress}
      hitSlop={{ left: 12, right: 4 }}
      style={styles.clear}
      testID="filters-clear">
      <AppText variant="label" color={disabled ? 'disabledText' : 'action'}>
        Clear all
      </AppText>
    </PressScale>
  );
}

/** A section named by a small icon and label, whose options wrap onto as many lines as they need. */
function Section({ title, icon, children }: { title: string; icon: IconName; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Eyebrow icon={icon} header>
        {title}
      </Eyebrow>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, paddingHorizontal: size.gutter, paddingTop: space[6], gap: space[4] },
  footer: { marginTop: -space[4], marginHorizontal: -size.gutter, paddingHorizontal: size.gutter, paddingTop: space[2], borderTopWidth: 1, gap: space[2] },
  more: { height: 18, justifyContent: 'center' },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  clear: { minHeight: size.touch, justifyContent: 'center' },
  // The list runs to both edges of the sheet, so the scroll bar sits in the gutter beside the options, not over them.
  list: { marginHorizontal: -size.gutter },
  body: { gap: space[6], paddingHorizontal: size.gutter, paddingBottom: space[4] },
  section: { gap: 10 },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', marginLeft: -4 },
});
