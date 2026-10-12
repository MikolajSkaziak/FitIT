import { useMutation } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { updateProfile } from '@/api/account';
import { setUser } from '@/auth/session';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { LinkText } from '@/components/controls';
import { Eyebrow } from '@/components/Eyebrow';
import { FormError } from '@/components/forms';
import { messageFor } from '@/copy/errors';
import { consent, type ConsentKind } from '@/features/consent/copy';
import { finishConsent } from '@/features/consent/session';
import { openDocument, privacyPolicyUrl } from '@/features/profile/legal';
import { size, space, useTheme } from '@/theme';

/** What the sheet takes besides the scrolling part: grabber gap, title, link, both actions and the gaps between them. */
const chrome = 340;

/**
 * "Before your photos leave your phone": the consent to send photos to Google and fal.ai, asked in context, right before
 * the first garment photo or the selfie. The opener (`useAiConsent`) is waiting for the answer: Allow saves the one consent
 * flag and lets the action go on; Not now, or swiping the sheet away, sends nothing and the action does not go on.
 */
export default function ConsentSheet() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const params = useLocalSearchParams<{ kind?: string }>();
  const kind: ConsentKind = params.kind === 'selfie' ? 'selfie' : 'clothes';
  const words = consent[kind];
  const policy = privacyPolicyUrl();

  // Closed some other way (swiped down): the opener still gets its answer.
  useEffect(() => () => finishConsent(false), []);

  const allow = useMutation({
    mutationFn: () => updateProfile({ aiConsent: true }),
    onSuccess: (user) => {
      setUser(user);
      router.back();
      finishConsent(true);
    },
  });

  const notNow = () => {
    router.back();
    finishConsent(false);
  };

  // The root stays a real native view and the first thing in it is not a ScrollView, so the sheet fits what is in it; the
  // scrolling part is capped to the screen, so a large text size scrolls instead of being clipped.
  const bodyMax = Math.max(160, window.height - insets.top - chrome);

  return (
    <View collapsable={false} style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, space[4]) }]} testID="consent-sheet">
      <View style={styles.titles}>
        <Eyebrow header testID="consent-eyebrow">
          {consent.eyebrow}
        </Eyebrow>
        <AppText variant="heading" accessibilityRole="header" testID="consent-title">
          {words.title}
        </AppText>
      </View>
      <ScrollView style={{ maxHeight: bodyMax }} contentContainerStyle={styles.body} bounces={false} showsVerticalScrollIndicator={false}>
        <Fact label={words.sentLabel} text={words.sent} testID="consent-sent" />
        <Fact label={words.whoLabel} text={words.who} testID="consent-who" />
        <Fact label={words.whatLabel} text={words.what} testID="consent-what" />
        {policy ? <LinkText label={consent.policy} onPress={() => void openDocument(policy)} testID="consent-privacy" /> : null}
      </ScrollView>
      <View style={styles.actions}>
        <FormError message={allow.isError ? messageFor(allow.error) : null} />
        <Button label={consent.allow} busy={allow.isPending} onPress={() => allow.mutate()} testID="consent-allow" />
        <Button label={consent.notNow} kind="text" disabled={allow.isPending} onPress={notNow} testID="consent-not-now" />
      </View>
    </View>
  );
}

/** One plain fact of the three: what it is about, then the words, on a hairline. */
function Fact({ label, text, testID }: { label: string; text: string; testID: string }) {
  const theme = useTheme();
  return (
    <View accessible accessibilityLabel={`${label}. ${text}`} style={[styles.fact, { borderBottomColor: theme.border }]} testID={testID}>
      <AppText variant="eyebrow" accessible={false}>
        {label}
      </AppText>
      <AppText accessible={false}>{text}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { paddingHorizontal: size.gutter, paddingTop: space[6], gap: space[4] },
  titles: { gap: space[2] },
  body: { paddingBottom: space[2] },
  fact: { paddingVertical: space[3], gap: space[1], borderBottomWidth: 1 },
  actions: { gap: space[2] },
});
