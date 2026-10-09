import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { LegFigures } from '@/components/LegFigures';
import { SizeButtons } from '@/components/SizeButtons';
import { SizeLabel } from '@/components/SizeLabel';
import { legDetails, legsNotSet } from '@/copy/labels';
import { flow } from '@/features/flow';
import { useRegistrationDraft } from '@/features/registration/draft';
import { WizardStep } from '@/features/registration/WizardStep';
import { radius, space, useTheme } from '@/theme';

/** Said once, under both questions: what they are for, and that nothing depends on them. */
const buildNote = 'These only help try-on pictures look right. You can change them any time in Profile.';

interface QuestionProps {
  heading: string;
  /** Anything is fine to leave unset: the quiet button next to the heading takes a choice back. */
  chosen: boolean;
  onClear: () => void;
  testID: string;
  children: ReactNode;
}

function Question({ heading, chosen, onClear, testID, children }: QuestionProps) {
  return (
    <View style={styles.question}>
      <View style={styles.heading}>
        <AppText variant="subheading" accessibilityRole="header" style={styles.headingText}>
          {heading}
        </AppText>
        <Button kind="text" compact inline label={chosen ? 'I’d rather not say' : 'Not set for now'} onPress={onClear} testID={`${testID}-none`} />
      </View>
      {children}
    </View>
  );
}

/** Step 4 of 9: the usual size and the leg length, the same controls as in Profile. Both are optional, so Next is always there. */
export default function RegisterFit() {
  const router = useRouter();
  const theme = useTheme();
  const clothingSize = useRegistrationDraft((draft) => draft.clothingSize);
  const legLength = useRegistrationDraft((draft) => draft.legLength);
  const setDraft = useRegistrationDraft((draft) => draft.set);
  const { title, hint } = legLength ? legDetails[legLength] : legsNotSet;

  return (
    <WizardStep
      step={flow.fit}
      title="Your fit"
      lead="Two quick questions. Answer both, one or neither."
      testID="register-fit"
      footer={<Button label="Next" onPress={() => router.push('/register/style')} testID="register-next" />}>
      <Question heading="Your usual size" chosen={clothingSize !== null} onClear={() => setDraft({ clothingSize: null })} testID="size">
        <SizeLabel value={clothingSize} />
        <View style={styles.control}>
          <AppText variant="label">The size you reach for most</AppText>
          <SizeButtons value={clothingSize} onChange={(value) => setDraft({ clothingSize: value })} />
        </View>
      </Question>
      <Question heading="Your legs" chosen={legLength !== null} onClear={() => setDraft({ legLength: null })} testID="legs">
        <View style={styles.control}>
          <AppText variant="label">Where does your waist sit?</AppText>
          <LegFigures value={legLength} onChange={(value) => setDraft({ legLength: value })} />
        </View>
        <View accessibilityLiveRegion="polite" style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]} testID="legs-card">
          <AppText variant="subheading">{title}</AppText>
          <AppText color="textSecondary">{hint}</AppText>
        </View>
      </Question>
      <AppText variant="meta" color="textSecondary" testID="register-build-note">
        {buildNote}
      </AppText>
    </WizardStep>
  );
}

const styles = StyleSheet.create({
  question: { gap: space[3] },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[2] },
  headingText: { flexShrink: 1 },
  control: { gap: space[3] },
  card: { borderWidth: 1, borderRadius: radius.well, paddingVertical: 14, paddingHorizontal: space[4], gap: 2 },
});
