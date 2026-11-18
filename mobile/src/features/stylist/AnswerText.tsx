import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { space, useTheme } from '@/theme';

type Block = { kind: 'paragraph'; text: string } | { kind: 'list'; items: string[] };

const bullet = /^\s*(?:[-•*]|\d+[.)])\s+/;

/**
 * The stylist writes plain text: short paragraphs, and lists as lines that start with "- ". Read as one run of text
 * those turn into a wall; here each paragraph stands apart and each list line hangs from its own dot.
 */
export function blocksOf(text: string): Block[] {
  const blocks: Block[] = [];
  for (const raw of text.replace(/\r\n/g, '\n').split('\n')) {
    const line = raw.trim();
    const last = blocks.at(-1);
    if (!line) {
      // A blank line closes whatever was open; the next line starts a new block.
      if (last && !(last.kind === 'paragraph' && last.text === '')) {
        blocks.push({ kind: 'paragraph', text: '' });
      }
      continue;
    }

    if (bullet.test(line)) {
      const item = line.replace(bullet, '');
      if (last?.kind === 'list') {
        last.items.push(item);
      } else {
        blocks.push({ kind: 'list', items: [item] });
      }
      continue;
    }

    if (last?.kind === 'paragraph' && last.text !== '') {
      last.text = `${last.text} ${line}`;
    } else if (last?.kind === 'paragraph') {
      last.text = line;
    } else {
      blocks.push({ kind: 'paragraph', text: line });
    }
  }

  return blocks.filter((block) => block.kind === 'list' || block.text !== '');
}

/** An answer's words, set for reading: paragraphs apart, list lines indented under a small green dot. */
export function AnswerText({ text }: { text: string }) {
  const theme = useTheme();
  return (
    <View style={styles.blocks} testID="stylist-answer-text">
      {blocksOf(text).map((block, index) =>
        block.kind === 'paragraph' ? (
          <AppText key={index} selectable style={styles.reading}>
            {block.text}
          </AppText>
        ) : (
          <View key={index} style={styles.list}>
            {block.items.map((item, at) => (
              <View key={at} style={styles.item}>
                <View style={[styles.dot, { backgroundColor: theme.action }]} />
                <AppText selectable style={[styles.reading, styles.itemText]}>
                  {item}
                </AppText>
              </View>
            ))}
          </View>
        ),
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  blocks: { gap: space[3] },
  // A little more air between lines than the app's body text: answers run longer than anything else on a screen.
  reading: { lineHeight: 26 },
  list: { gap: space[2] },
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: space[3] },
  // Centred on the first line: 26 / 2 minus half the dot.
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 10 },
  itemText: { flex: 1 },
});
