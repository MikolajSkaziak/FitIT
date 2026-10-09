import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { fetchAvatars, queryKeys, type Avatar, type Gender } from '@/api/account';
import { messageFor } from '@/copy/errors';
import { motion, radius, space, useTheme } from '@/theme';

import { AppText } from './AppText';
import { Button } from './Button';
import { Grid } from './Grid';
import { Icon } from './Icon';
import { Skeleton } from './lists';
import { Fade, PressScale } from './motion';

const photoHeight = 172;
const placeholders = ['a', 'b', 'c', 'd', 'e'] as const;

interface SilhouettePickerProps {
  gender: Gender;
  value: string | null;
  onChange: (avatar: Avatar) => void;
}

/** The body shapes offered to a gender (five, or all ten for non-binary and prefer not to say), three to a row. One can be chosen. */
export function SilhouettePicker({ gender, value, onChange }: SilhouettePickerProps) {
  const theme = useTheme();
  const avatars = useQuery({ queryKey: queryKeys.avatars(gender), queryFn: () => fetchAvatars(gender), staleTime: 60 * 60_000 });

  if (avatars.isPending) {
    return (
      <Grid
        items={placeholders}
        columns={3}
        rowGap={space[4]}
        keyOf={(key) => key}
        accessibilityRole="progressbar"
        accessibilityLabel="Loading body shapes"
        renderItem={() => (
          <View style={styles.tile}>
            <Skeleton height={photoHeight} radius={radius.well} />
            <Skeleton height={14} width="70%" style={styles.skeletonLabel} />
          </View>
        )}
      />
    );
  }

  if (avatars.isError) {
    return (
      <View style={styles.problem}>
        <AppText color="textSecondary">{messageFor(avatars.error)}</AppText>
        <Button label="Try again" kind="secondary" inline onPress={() => void avatars.refetch()} />
      </View>
    );
  }

  return (
    <Grid
      items={avatars.data}
      columns={3}
      rowGap={space[4]}
      keyOf={(avatar) => avatar.id}
      accessibilityRole="radiogroup"
      accessibilityLabel="Body shape"
      renderItem={(avatar) => {
        const selected = avatar.id === value;
        return (
          <PressScale
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={avatar.label}
            onPress={() => onChange(avatar)}
            testID={`silhouette-${avatar.bodyType}`}
            style={styles.tile}>
            <View style={[styles.photo, { backgroundColor: theme.well, borderColor: selected ? theme.action : theme.wellLine, borderWidth: selected ? 3 : 1 }]}>
              <Image source={{ uri: avatar.thumbUrl }} contentFit="cover" transition={motion.exit} style={styles.image} accessible={false} />
              {selected ? (
                <Fade key="badge" pop duration={motion.exit} style={[styles.badge, { backgroundColor: theme.action }]}>
                  <Icon name="check" size={16} color="onAction" />
                </Fade>
              ) : null}
            </View>
            <AppText variant="secondaryStrong" align="center">
              {avatar.label}
            </AppText>
          </PressScale>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  tile: { gap: space[2] },
  photo: { height: photoHeight, borderRadius: radius.well, overflow: 'hidden' },
  image: { flex: 1 },
  badge: { position: 'absolute', top: 8, right: 8, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  skeletonLabel: { alignSelf: 'center' },
  problem: { gap: space[3] },
});
