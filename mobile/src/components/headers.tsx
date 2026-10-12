import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { motion, size, space, typography, useTheme } from '@/theme';

import { AppText } from './AppText';
import { IconButton } from './controls';
import { Icon, type IconName } from './Icon';
import { DrawLine, DropIn, Letters, Nudge, type PlayKey, Shiver, Stretch, Sway } from './motion';
import { SplitText } from './SplitText';

interface BackHeaderProps {
  title: string;
  /** One quiet line under the title. */
  meta?: string;
  /** Decorative icon before the title. */
  titleIcon?: IconName;
  /** Decorative icon before the quiet line. */
  metaIcon?: IconName;
  /** A small uppercase label centred between the back button and whatever is on the right ("Edit piece"). */
  eyebrow?: string;
  onBack: () => void;
  right?: ReactNode;
}

/** Top of a screen opened from another one: a round way back with an optional label beside it, then the serif title underneath. */
export function BackHeader({ title, meta, titleIcon, metaIcon, eyebrow, onBack, right }: BackHeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.bar}>
        <IconButton icon="back" label="Back" onPress={onBack} />
        {eyebrow ? (
          <AppText variant="eyebrow" align="center" numberOfLines={1} style={styles.eyebrow}>
            {eyebrow}
          </AppText>
        ) : null}
        {right ?? <View style={styles.balance} />}
      </View>
      <View style={styles.titles}>
        <View style={styles.line}>
          {titleIcon ? <Icon name={titleIcon} color="action" /> : null}
          <AppText variant="heading" accessibilityRole="header" style={styles.lineText}>
            {title}
          </AppText>
        </View>
        {meta ? (
          <View style={styles.line}>
            {metaIcon ? <Icon name={metaIcon} size={16} color="textSecondary" /> : null}
            <AppText variant="secondary" color="textSecondary" style={styles.lineText}>
              {meta}
            </AppText>
          </View>
        ) : null}
      </View>
    </View>
  );
}

/** What the accent word of a question title does, once, a moment after the screen has arrived. `none` is the italic green word at rest. */
export type AccentAct = 'shiver' | 'sway' | 'drop' | 'tap' | 'stretch' | 'letters' | 'rise' | 'none';

/** The one word of a title that is set in the green italic and acts out what it says. */
export interface TitleAccent {
  /** One whole word of the title, case-sensitive, without the punctuation after it. When no word matches, the title is plain. */
  word: string;
  act: AccentAct;
  /** Acts the word plays again later, each when its key turns truthy (never for the key present on mount): "cold" shivers again when the cold answer is chosen, and rises for the warm one. */
  replay?: { shiver?: PlayKey; rise?: PlayKey };
}

interface TitleBlockProps {
  /** A string, or text with one accent word in `displayItalic`. */
  title: ReactNode;
  /** The small uppercase label above the title: a count, a date, the group a garment belongs to. */
  eyebrow?: string;
  lead?: string;
  /** The smaller serif (`heading`), for a screen led by its picture or grid rather than by its words. */
  compact?: boolean;
  /** For a title that is a plain string and arrives a moment (a first look, "You're set"): a green line draws itself under its last word, once. That word is then also the green italic accent, at rest, unless `accent` names another. */
  underlined?: boolean;
  /** For a title that is a plain string: one word in the green italic that acts out what it says (see `AccentAct`). */
  accent?: TitleAccent;
}

/** The last word of a title with a line that draws itself under it: `DrawLine` sits just below the word's box, so the title's layout does not change. */
function Underlined({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return (
    <View>
      {children}
      <DrawLine delay={motion.enter} style={[styles.underline, { backgroundColor: theme.action }]} testID="title-underline" />
    </View>
  );
}

/** A word and the punctuation that closes it ("dressing?"): only the word is the accent. */
function parted(word: string): { core: string; tail: string } {
  const tail = /[.,;:!?…]+$/.exec(word)?.[0] ?? '';
  return { core: word.slice(0, word.length - tail.length), tail };
}

const hidden = { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' } as const;

/**
 * The accent word, drawn in the italic twin of the title's size in the action colour. It keeps the line height of the upright words around it
 * (the italic twin's own is taller), so the word sits level and the line does not grow. Its act waits `motion.sheet`, so it plays after the
 * screen has been pushed in. The pieces are hidden from screen readers: the title row carries the sentence.
 */
function AccentWord({ core, tail, last, variant, accent }: { core: string; tail: string; last: boolean; variant: 'display' | 'heading'; accent: TitleAccent }) {
  const italic = variant === 'display' ? 'displayItalic' : 'headingItalic';
  const level = { lineHeight: typography[variant].lineHeight };
  const after = `${tail}${last ? '' : ' '}`;
  const { act, replay } = accent;
  const testID = `title-accent-${act}`;
  if (act === 'letters') {
    return (
      <View style={styles.letters} testID={testID} {...hidden}>
        <Letters text={core} variant={italic} color="action" delay={motion.sheet} letterStyle={level} testID="title-accent" />
        {after ? <AppText variant={variant}>{after}</AppText> : null}
      </View>
    );
  }

  let word: ReactNode = (
    <AppText variant={variant} {...hidden}>
      <AppText variant={italic} color="action" style={level} testID="title-accent">
        {core}
      </AppText>
      {after}
    </AppText>
  );
  if (replay?.rise !== undefined) {
    word = (
      <Nudge dy={-2} dimTo={0.6} play={replay.rise} skipFirst testID="title-accent-replay-rise">
        {word}
      </Nudge>
    );
  }

  if (replay?.shiver !== undefined) {
    word = (
      <Shiver play={replay.shiver} skipFirst testID="title-accent-replay-shiver">
        {word}
      </Shiver>
    );
  }

  switch (act) {
    case 'shiver':
      return (
        <Shiver delay={motion.sheet} testID={testID}>
          {word}
        </Shiver>
      );
    case 'rise':
      return (
        <Nudge dy={-2} dimTo={0.6} delay={motion.sheet} testID={testID}>
          {word}
        </Nudge>
      );
    case 'tap':
      return (
        <Nudge dy={2} delay={motion.sheet} testID={testID}>
          {word}
        </Nudge>
      );
    case 'sway':
      return (
        <Sway soft delay={motion.sheet} testID={testID}>
          {word}
        </Sway>
      );
    case 'stretch':
      return (
        <Stretch delay={motion.sheet} testID={testID}>
          {word}
        </Stretch>
      );
    case 'drop':
      return (
        <DropIn delay={motion.sheet} testID={testID}>
          {word}
        </DropIn>
      );
    default:
      return <View testID={testID}>{word}</View>;
  }
}

interface AccentTitleProps {
  text: string;
  variant: 'display' | 'heading';
  accent?: TitleAccent;
  underlined?: boolean;
}

/**
 * A title as one header whose label is the whole sentence. With an `accent` whose word is one of its words, or with `underlined`, it is set as a
 * wrapping row of words (`SplitText`) so that one word can act and another carry the line; otherwise it is plain text.
 */
export function AccentTitle({ text, variant, accent, underlined = false }: AccentTitleProps) {
  const words = text.split(' ');
  const found = accent && accent.word !== '' ? words.findIndex((word) => parted(word).core === accent.word) : -1;
  if (found < 0 && !underlined) {
    return (
      <AppText variant={variant} accessibilityRole="header">
        {text}
      </AppText>
    );
  }

  return (
    <SplitText
      text={text}
      variant={variant}
      role="header"
      wrap={(word, node, last, index) => {
        const { core, tail } = parted(word);
        const drawn = accent && index === found ? <AccentWord core={core} tail={tail} last={last} variant={variant} accent={accent} /> : node;
        return underlined && last ? <Underlined>{drawn}</Underlined> : drawn;
      }}
    />
  );
}

/** The accent an underlined title gets by itself: its last word, in the green italic, at rest. */
function underlinedAccent(title: string): TitleAccent | undefined {
  const word = parted(title.split(' ').at(-1) ?? '').core;
  return word ? { word, act: 'none' } : undefined;
}

/** The big serif title of a screen, with the label above it and the sentence that explains it. */
export function TitleBlock({ title, eyebrow, lead, compact = false, underlined = false, accent }: TitleBlockProps) {
  const variant = compact ? 'heading' : 'display';
  return (
    <View style={styles.block}>
      {eyebrow ? <AppText variant="eyebrow">{eyebrow}</AppText> : null}
      {typeof title === 'string' ? (
        <AccentTitle text={title} variant={variant} accent={accent ?? (underlined ? underlinedAccent(title) : undefined)} underlined={underlined} />
      ) : (
        <AppText variant={variant} accessibilityRole="header">
          {title}
        </AppText>
      )}
      {lead ? <AppText color="textSecondary">{lead}</AppText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { gap: space[4] },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[3] },
  eyebrow: { flex: 1 },
  balance: { width: size.touch, height: size.touch },
  titles: { gap: space[1] },
  line: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  lineText: { flexShrink: 1 },
  block: { gap: 10 },
  letters: { flexDirection: 'row' },
  underline: { position: 'absolute', left: 0, right: 0, bottom: -space[1] / 2, height: size.bar },
});
