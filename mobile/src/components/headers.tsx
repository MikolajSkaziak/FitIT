import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { space } from '@/theme';

import { AppText } from './AppText';
import { IconButton } from './controls';
import { Icon, type IconName } from './Icon';

interface BackHeaderProps {
  title: string;
  /** One quiet line under the title. */
  meta?: string;
  /** Decorative icon before the title. */
  titleIcon?: IconName;
  /** Decorative icon before the quiet line. */
  metaIcon?: IconName;
  onBack: () => void;
  right?: ReactNode;
}

/** Top of a screen opened from another one: a way back, then the title. */
export function BackHeader({ title, meta, titleIcon, metaIcon, onBack, right }: BackHeaderProps) {
  return (
    <View style={styles.header}>
      <IconButton icon="back" label="Back" onPress={onBack} />
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
      {right}
    </View>
  );
}

interface TitleBlockProps {
  title: ReactNode;
  lead?: string;
}

/** The big title of a screen with the sentence that explains it. */
export function TitleBlock({ title, lead }: TitleBlockProps) {
  return (
    <View style={styles.block}>
      <AppText variant="display" accessibilityRole="header">
        {title}
      </AppText>
      {lead ? <AppText color="textSecondary">{lead}</AppText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // The 24 icon sits in a 44 target; pulling it out by 10 lines the icon up with the content edge.
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: space[1], marginLeft: -10 },
  titles: { flex: 1, minHeight: 44, justifyContent: 'center' },
  line: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  lineText: { flexShrink: 1 },
  block: { gap: space[2] },
});
