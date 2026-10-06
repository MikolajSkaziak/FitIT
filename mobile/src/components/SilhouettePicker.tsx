import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { fetchAvatars, queryKeys, type Avatar, type Gender } from '@/api/account';
import { messageFor } from '@/copy/errors';
import { radius, space, useTheme } from '@/theme';

import { AppText } from './AppText';
import { Button } from './Button';
import { Grid } from './Grid';
import { Icon } from './Icon';
import { Skeleton } from './lists';

const photoHeight = 172;
const placeholders = ['a', 'b', 'c', 'd', 'e'] as const;

interface SilhouettePickerProps {
  gender: Gender;
  value: string | null;
  onChange: (avatar: Avatar) => void;
}

/** The five silhouette types of one gender, three to a row. One can be chosen. */
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
        accessibilityLabel="Wczytujemy sylwetki"
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
        <Button label="Spróbuj ponownie" kind="secondary" inline onPress={() => void avatars.refetch()} />
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
      accessibilityLabel="Typ sylwetki"
      renderItem={(avatar) => {
        const selected = avatar.id === value;
        return (
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={avatar.label}
            onPress={() => onChange(avatar)}
            testID={`silhouette-${avatar.bodyType}`}
            style={({ pressed }) => [styles.tile, pressed ? styles.pressed : null]}>
            <View style={[styles.photo, { backgroundColor: theme.well, borderColor: selected ? theme.action : theme.wellLine, borderWidth: selected ? 3 : 1 }]}>
              <Image source={{ uri: avatar.thumbUrl }} contentFit="cover" transition={150} style={styles.image} accessible={false} />
              {selected ? (
                <View style={[styles.badge, { backgroundColor: theme.action }]}>
                  <Icon name="check" size={16} color="onAction" />
                </View>
              ) : null}
            </View>
            <AppText variant="secondaryStrong" align="center">
              {avatar.label}
            </AppText>
          </Pressable>
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
  pressed: { opacity: 0.85 },
});
