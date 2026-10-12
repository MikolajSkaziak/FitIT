import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { updateProfile, type ProfileChange } from '@/api/account';
import { weatherKeys } from '@/api/weather';
import { setUser } from '@/auth/session';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { IconButton } from '@/components/controls';
import { FormError } from '@/components/forms';
import { AccentTitle, type TitleAccent } from '@/components/headers';
import { Icon, type IconName } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { messageFor } from '@/copy/errors';
import { size, space } from '@/theme';

/** Saves a change to the profile; the signed-in person kept in memory is replaced by what the server answers. */
export function useSaveProfile(onSaved: () => void, { weather = true }: { weather?: boolean } = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (change: ProfileChange) => updateProfile(change),
    onSuccess: (user) => {
      setUser(user);
      // The thermal preference shifts the forecast's band, so the weather on Today is asked for again.
      if (weather) {
        void queryClient.invalidateQueries({ queryKey: weatherKeys.all });
      }

      onSaved();
    },
  });
}

interface EditScreenProps {
  title: string;
  /** The small label between the back button and the title; the group the setting belongs to. */
  eyebrow?: string;
  lead?: string;
  /** A small icon before the lead. */
  leadIcon?: IconName;
  /** One word of the title in the green italic that acts out what it says. Not shown with a `hero`, which has no title of its own. */
  accent?: TitleAccent;
  /** A band that takes the place of the header (a `LabelHero`): it runs edge to edge and the back button lies over it. */
  hero?: ReactNode;
  children: ReactNode;
  actionLabel?: string;
  onAction: () => void;
  busy?: boolean;
  /** Nothing to save yet: the button waits until the person has changed something. */
  disabled?: boolean;
  /** What the server refused, shown above the button in the app's own words. */
  error?: unknown;
  /** Something the person still has to do before the action can run. */
  notice?: string | null;
  /** A quiet action under the button, such as taking a choice back. */
  secondary?: ReactNode;
  testID?: string;
}

interface PageHeadProps {
  title: string;
  eyebrow?: string;
  lead?: string;
  leadIcon?: IconName;
  accent?: TitleAccent;
  onBack: () => void;
}

/** The top of a profile screen without a hero: the round back button with the group's name beside it, then the serif title and one line of lead. */
export function PageHead({ title, eyebrow = 'Profile', lead, leadIcon, accent, onBack }: PageHeadProps) {
  return (
    <View style={styles.head}>
      <View style={styles.bar}>
        <IconButton icon="back" label="Back" onPress={onBack} />
        <AppText variant="eyebrow" align="center" numberOfLines={1} style={styles.eyebrow}>
          {eyebrow}
        </AppText>
        <View style={styles.balance} />
      </View>
      <View style={styles.titles}>
        <AccentTitle text={title} variant="display" accent={accent} />
        {lead ? (
          <View style={styles.lead}>
            {leadIcon ? <Icon name={leadIcon} size={20} color="textSecondary" /> : null}
            <AppText color="textSecondary" style={styles.leadText}>
              {lead}
            </AppText>
          </View>
        ) : null}
      </View>
    </View>
  );
}

/** A screen that changes one thing in the profile: a way back, the control, one button. */
export function EditScreen({ title, eyebrow = 'Profile', lead, leadIcon, accent, hero, children, actionLabel = 'Save', onAction, busy, disabled, error, notice, secondary, testID }: EditScreenProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const back = () => router.back();
  return (
    <Screen
      testID={testID}
      contentStyle={hero ? styles.bleed : undefined}
      footer={
        <>
          <FormError message={notice ?? (error ? messageFor(error) : null)} />
          <Button label={actionLabel} busy={busy} disabled={disabled} onPress={onAction} testID="edit-save" />
          {secondary}
        </>
      }>
      {hero ? (
        <>
          <View>
            {hero}
            <IconButton icon="back" label="Back" onPress={back} style={[styles.back, { top: insets.top + space[2] }]} />
          </View>
          <View style={[styles.body, styles.heroBody]}>{children}</View>
        </>
      ) : (
        <View style={styles.body}>
          <PageHead title={title} eyebrow={eyebrow} lead={lead} leadIcon={leadIcon} accent={accent} onBack={back} />
          {children}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  // The hero reaches the edges of the screen, so the page gives up its gutter and its top; the body keeps its own.
  bleed: { paddingTop: 0, paddingHorizontal: 0 },
  body: { gap: space[6] },
  heroBody: { paddingHorizontal: size.gutter, paddingTop: space[6] },
  head: { gap: space[6] },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[3] },
  eyebrow: { flex: 1 },
  balance: { width: size.touch, height: size.touch },
  back: { position: 'absolute', left: size.gutter },
  titles: { gap: 10 },
  lead: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  leadText: { flexShrink: 1 },
});
