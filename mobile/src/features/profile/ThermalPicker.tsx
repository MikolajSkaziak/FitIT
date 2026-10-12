import { Image } from 'expo-image';
import { useState, type ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import type { Gender, ThermalPreference } from '@/api/account';
import { AppText } from '@/components/AppText';
import { thermalPictures } from '@/components/brand';
import { CareLabel } from '@/components/CareLabel';
import { Icon } from '@/components/Icon';
import { Nudge, PressScale, Shiver, Slide, Spin, ToggleFade } from '@/components/motion';
import { SplitText } from '@/components/SplitText';
import { thermalOptions } from '@/copy/labels';
import * as haptics from '@/lib/haptics';
import { motion, radius, size, space, useTheme } from '@/theme';

import { temperatureOf, thermalLooks, thermalOrder, thermalSetOf } from './thermal';

interface ThermalPickerProps {
  value: ThermalPreference;
  onChange: (value: ThermalPreference) => void;
  /** Decides whose mannequin is shown: a man's for a man, the women's for everyone else. */
  gender: Gender | null | undefined;
  /** The gender of the body shape the person chose, when they have one: it decides the set for non-binary and "prefer not to say". */
  shapeGender?: Gender | null;
  /** A small picture beside the sentence instead of the large one, for a step that has to stay on one screen. */
  compact?: boolean;
  testID?: string;
}

const compactWidth = 64;

/**
 * The word of a sentence about `answer` that acts out what it says, once, when that answer is chosen: "colder" shivers, "warmer" rises
 * like heat (a lift of 2 points while it dims to 0.6). `moved` is false until the person has changed the answer, so the one that is
 * already chosen when the picker opens stays still.
 */
function actingWord(tag: string, answer: ThermalPreference, active: boolean, moved: boolean) {
  return function wrapWord(word: string, node: ReactNode): ReactNode {
    if (answer === 'runs_cold' && word === 'colder') {
      return (
        <Shiver play={active} skipFirst={!moved} testID={`${tag}-shiver`}>
          {node}
        </Shiver>
      );
    }

    if (answer === 'runs_warm' && word === 'warmer') {
      return (
        <Nudge dy={-2} dimTo={0.6} play={active} skipFirst={!moved} testID={`${tag}-heat`}>
          {node}
        </Nudge>
      );
    }

    return node;
  };
}

/** The icon of a stop answers when its stop is chosen: the snowflake and the sun turn (to a look they already have), the thermometer lifts and returns. */
function StopAct({ answer, chosen, children }: { answer: ThermalPreference; chosen: boolean; children: ReactNode }) {
  if (answer === 'normal') {
    return (
      <Nudge dy={-2} play={chosen} skipFirst>
        {children}
      </Nudge>
    );
  }

  return (
    <Spin degrees={answer === 'runs_cold' ? 60 : 45} play={chosen} skipFirst>
      {children}
    </Spin>
  );
}

/**
 * How the person usually feels the temperature, as a picture and a scale. The mannequin changes clothes (the three pictures
 * cross-fade) while a green line slides along a three-stop scale; each stop has its own feel in the hand. Under the scale one
 * sentence says what the answer changes.
 */
export function ThermalPicker({ value, onChange, gender, shapeGender, compact = false, testID = 'thermal' }: ThermalPickerProps) {
  const theme = useTheme();
  const dimensions = useWindowDimensions();
  const [track, setTrack] = useState(0);
  const [moved, setMoved] = useState(false);
  const set = thermalPictures[thermalSetOf(gender, shapeGender)];
  const look = thermalLooks[value];
  const stop = track / thermalOrder.length;
  const index = thermalOrder.indexOf(value);

  const choose = (next: ThermalPreference) => {
    // Choosing the answer that is already chosen changes nothing, so it gives no cue.
    if (next !== value) {
      haptics.temperature(temperatureOf(next));
      setMoved(true);
    }

    onChange(next);
  };

  const contentWidth = dimensions.width - 2 * size.gutter;
  const heroHeight = Math.round(Math.min((contentWidth * 4) / 3, dimensions.height * 0.42));
  const heroWidth = Math.round((heroHeight * 3) / 4);
  const thumbHeight = Math.round((compactWidth * 4) / 3);

  const pictures = (width: number, height: number, labelled: boolean) => (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`${look.seen}. ${look.care}`}
      style={[styles.hero, { width, height, backgroundColor: theme.well }]}
      testID={`${testID}-picture`}>
      {thermalOrder.map((answer) => (
        <ToggleFade key={answer} on={answer === value} duration={motion.enter} style={StyleSheet.absoluteFill}>
          <Image source={set[answer]} contentFit="cover" accessible={false} style={StyleSheet.absoluteFill} testID={`${testID}-picture-${answer}`} />
          {labelled ? <CareLabel label={thermalLooks[answer].care} corner="topLeft" wrapWord={actingWord(`${testID}-care-${answer}`, answer, answer === value, moved)} testID={`${testID}-care-${answer}`} /> : null}
        </ToggleFade>
      ))}
    </View>
  );

  const scale = (
    <View accessibilityRole="radiogroup" accessibilityLabel="How you usually feel the temperature" testID={`${testID}-scale`}>
      <View style={styles.stops}>
        {thermalOrder.map((answer) => {
          const chosen = answer === value;
          const stopLook = thermalLooks[answer];
          return (
            <PressScale
              key={answer}
              accessibilityRole="radio"
              accessibilityState={{ checked: chosen }}
              accessibilityLabel={thermalOptions.find((option) => option.value === answer)?.label}
              haptic="none"
              onPress={() => choose(answer)}
              testID={`${testID}-${answer}`}
              style={styles.stop}>
              <StopAct answer={answer} chosen={chosen}>
                <View style={styles.icon}>
                  <Icon name={stopLook.icon} size={24} color="textSecondary" />
                  <ToggleFade on={chosen} style={StyleSheet.absoluteFill}>
                    <View style={styles.icon}>
                      <Icon name={stopLook.icon} size={24} color="action" />
                    </View>
                  </ToggleFade>
                </View>
              </StopAct>
              <AppText variant={chosen ? 'title' : 'secondary'} color={chosen ? 'text' : 'textSecondary'} numberOfLines={1}>
                {stopLook.stop}
              </AppText>
            </PressScale>
          );
        })}
      </View>
      <View onLayout={(event) => setTrack(event.nativeEvent.layout.width)} style={[styles.track, { backgroundColor: theme.border }]} testID={`${testID}-track`}>
        {stop > 0 ? <Slide x={index * stop} style={[styles.marker, { width: stop, backgroundColor: theme.action }]} testID={`${testID}-marker`} /> : null}
      </View>
    </View>
  );

  const effect = (
    <SplitText text={look.effect} color="textSecondary" accessibilityLiveRegion="polite" wrap={actingWord(`${testID}-effect`, value, true, moved)} testID={`${testID}-effect`} style={styles.effect} />
  );

  if (compact) {
    return (
      <View style={styles.block} testID={testID}>
        {scale}
        <View style={styles.compactRow}>
          {pictures(compactWidth, thumbHeight, false)}
          {effect}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.block} testID={testID}>
      {pictures(heroWidth, heroHeight, true)}
      {scale}
      {effect}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: space[4] },
  hero: { alignSelf: 'center', borderRadius: radius.well, overflow: 'hidden' },
  stops: { flexDirection: 'row' },
  stop: { flex: 1, minHeight: size.touch + space[6], alignItems: 'center', justifyContent: 'center', gap: space[1] },
  icon: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  track: { height: 1 },
  marker: { position: 'absolute', left: 0, top: -0.5, height: size.bar },
  compactRow: { flexDirection: 'row', alignItems: 'center', gap: space[4] },
  effect: { flex: 1 },
});
