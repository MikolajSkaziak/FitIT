import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { fetchAvatars, queryKeys, type Avatar, type Gender } from '@/api/account';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Grid } from '@/components/Grid';
import { Icon } from '@/components/Icon';
import { Skeleton } from '@/components/lists';
import { Fade, PressScale } from '@/components/motion';
import { messageFor } from '@/copy/errors';
import { motion, radius, space, useTheme } from '@/theme';

const placeholders = ['a', 'b', 'c', 'd'] as const;

interface BodyShapePickerProps {
  gender: Gender;
  value: string | null;
  onChange: (avatar: Avatar) => void;
}

/**
 * The body shapes offered to a gender (five, or all ten for non-binary and prefer not to say), two to a row on tall photos,
 * the name underneath. The shared picker of Profile keeps three narrower columns; this one is the larger look of the design.
 */
export function BodyShapePicker({ gender, value, onChange }: BodyShapePickerProps) {
  const theme = useTheme();
  const avatars = useQuery({ queryKey: queryKeys.avatars(gender), queryFn: () => fetchAvatars(gender), staleTime: 60 * 60_000 });

  if (avatars.isPending) {
    return (
      <Grid
        items={placeholders}
        columns={2}
        rowGap={20}
        keyOf={(key) => key}
        accessibilityRole="progressbar"
        accessibilityLabel="Loading body shapes"
        renderItem={() => (
          <View style={styles.tile}>
            <Skeleton height={226} radius={radius.well} />
            <Skeleton height={14} width="70%" />
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
      columns={2}
      rowGap={20}
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
            <View style={[styles.photo, { backgroundColor: theme.well }]}>
              <Image source={{ uri: avatar.thumbUrl }} contentFit="cover" transition={motion.exit} style={styles.image} accessible={false} />
              {selected ? <View style={[StyleSheet.absoluteFill, styles.ring, { borderColor: theme.action }]} /> : null}
              {selected ? (
                <Fade key="badge" pop duration={motion.exit} style={[styles.badge, { backgroundColor: theme.action }]}>
                  <Icon name="check" size={16} color="onAction" />
                </Fade>
              ) : null}
            </View>
            <AppText variant="title">{avatar.label}</AppText>
          </PressScale>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  tile: { gap: space[2] },
  photo: { aspectRatio: 3 / 4, width: '100%', borderRadius: radius.well, overflow: 'hidden' },
  image: { flex: 1 },
  // Drawn over the photo, so the picture keeps its size whether it is chosen or not.
  ring: { borderWidth: 2, borderRadius: radius.well },
  badge: { position: 'absolute', top: 10, right: 10, width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  problem: { gap: space[3] },
});
