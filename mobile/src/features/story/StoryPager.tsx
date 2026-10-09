import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Brandmark } from '@/components/brand';
import { Button } from '@/components/Button';
import { LinkText } from '@/components/controls';
import { CrossFade, PressScale, useAnimatedScroll } from '@/components/motion';
import { pageIndex } from '@/features/styling/pager';
import { motion, size, space, useTheme } from '@/theme';

import { Illustration } from './Illustrations';
import { storyCopy, storyPages } from './pages';

interface StoryPagerProps {
  onCreate: () => void;
  onLogin: () => void;
}

/**
 * The story before sign-up: four pages that swipe sideways, a bar per page, a quiet Skip to the last one. The two ways in
 * ("Create account", "I already have an account") never leave the screen, so they are one touch away on every page.
 */
export function StoryPager({ onCreate, onLogin }: StoryPagerProps) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const scroller = useRef<ScrollView>(null);
  const animated = useAnimatedScroll();
  const [index, setIndex] = useState(0);
  const last = storyPages.length - 1;

  const go = (page: number) => {
    scroller.current?.scrollTo({ x: page * width, animated });
    setIndex(page);
  };
  const follow = (event: NativeSyntheticEvent<NativeScrollEvent>) => setIndex(pageIndex(event.nativeEvent.contentOffset.x, width, storyPages.length));

  return (
    <View style={styles.root} testID="story-pager">
      <View style={[styles.top, { paddingTop: insets.top + space[2] }]}>
        <Brandmark small />
        {/* Skip keeps its place on the last page, so nothing shifts when it goes. */}
        <View style={index < last ? null : styles.hidden} pointerEvents={index < last ? 'auto' : 'none'} accessibilityElementsHidden={index === last}>
          <LinkText label={storyCopy.skip} onPress={() => go(last)} testID="story-skip" />
        </View>
      </View>
      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={follow}
        onMomentumScrollEnd={follow}
        style={styles.pages}
        testID="story-pages">
        {storyPages.map((page, position) => (
          <ScrollView key={page.id} style={{ width }} contentContainerStyle={styles.page} showsVerticalScrollIndicator={false} testID={`story-page-${page.id}`}>
            <Illustration page={page.id} active={position === index} />
            <View style={styles.words}>
              <AppText variant="display" accessibilityRole="header">
                {page.headline.lead}
                <AppText variant="display" color="action">
                  {page.headline.accent}
                </AppText>
              </AppText>
              <AppText color="textSecondary">{page.body}</AppText>
            </View>
          </ScrollView>
        ))}
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, space[4]) + space[2] }]}>
        <Bars index={index} onSelect={go} />
        <Button label={storyCopy.create} onPress={onCreate} testID="welcome-register" />
        <Button label={storyCopy.login} kind="secondary" onPress={onLogin} testID="welcome-login" />
      </View>
    </View>
  );
}

/** A bar per page, in the shape of the registration steps. The bar of the page showing is green; each one is a way to jump. */
function Bars({ index, onSelect }: { index: number; onSelect: (page: number) => void }) {
  const theme = useTheme();
  return (
    <View style={styles.bars} accessibilityRole="tablist">
      {storyPages.map((page, position) => (
        <PressScale
          key={page.id}
          accessibilityRole="tab"
          accessibilityLabel={storyCopy.pageLabel(position + 1, storyPages.length)}
          accessibilityState={{ selected: position === index }}
          onPress={() => onSelect(position)}
          hitSlop={{ top: space[3], bottom: space[3] }}
          testID={`story-bar-${position}`}
          style={styles.barTarget}>
          <CrossFade on={position === index} duration={motion.exit} style={styles.bar}>
            {(on) => <View style={[styles.fill, { backgroundColor: on ? theme.action : theme.border }]} />}
          </CrossFade>
        </PressScale>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  top: { paddingHorizontal: size.gutter, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  hidden: { opacity: 0 },
  pages: { flex: 1 },
  page: { paddingHorizontal: size.gutter, paddingTop: space[6], paddingBottom: space[4], gap: space[6] },
  words: { gap: space[2] },
  footer: { paddingHorizontal: size.gutter, paddingTop: space[2], gap: space[2] },
  bars: { flexDirection: 'row', gap: space[1], marginBottom: space[2] },
  barTarget: { flex: 1 },
  bar: { height: size.bar },
  fill: { flex: 1, borderRadius: size.bar / 2 },
});
