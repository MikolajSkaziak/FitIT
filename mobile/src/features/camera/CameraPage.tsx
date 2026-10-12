import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { IconButton } from '@/components/controls';
import { Icon } from '@/components/Icon';
import { Fade } from '@/components/motion';
import { Screen } from '@/components/Screen';
import { radius, space, travel, useTheme } from '@/theme';

import { camera as copy } from './copy';

interface CameraPageProps {
  /** Left out for a plain message. With it, the camera icon stands above on its well. */
  title?: string;
  text?: string;
  /** Left out where there must be no way out but the button below: the screen before the system's permission alert (Apple's guidelines). */
  onClose?: () => void;
  /** The ways forward, as buttons. */
  actions?: ReactNode;
  testID: string;
}

/**
 * What the camera route shows instead of a viewfinder: asking for the camera, being refused it, or having none.
 * A calm page in the colours of the theme, with a way forward and, except before the system's permission alert, a way to close.
 */
export function CameraPage({ title, text, onClose, actions, testID }: CameraPageProps) {
  const theme = useTheme();
  return (
    <Screen scroll={false} footer={actions} testID={testID}>
      {onClose ? <IconButton icon="close" label={copy.close} onPress={onClose} testID="camera-close" /> : null}
      {text ? (
        <Fade rise={travel.rise} style={styles.words}>
          {title ? (
            <>
              <View style={[styles.well, { backgroundColor: theme.well }]}>
                <Icon name="camera" color="onWellChip" />
              </View>
              <AppText variant="heading" align="center" accessibilityRole="header">
                {title}
              </AppText>
            </>
          ) : null}
          <AppText color={title ? 'textSecondary' : 'text'} align="center">
            {text}
          </AppText>
        </Fade>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  // Lifted to the optical centre, like an empty state.
  words: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space[3], paddingBottom: space[12] },
  well: { width: 96, height: 96, borderRadius: radius.well, alignItems: 'center', justifyContent: 'center', marginBottom: space[3] },
});
