import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { ClothingSize, LegLength, ProfileChange } from '@/api/account';
import { useSession } from '@/auth/session';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { FormError } from '@/components/forms';
import { Icon, type IconName } from '@/components/Icon';
import { Row } from '@/components/lists';
import { SizeButtons } from '@/components/SizeButtons';
import { SizeLabel } from '@/components/SizeLabel';
import { messageFor } from '@/copy/errors';
import { legDetails, legOptions } from '@/copy/labels';
import { Actions, Frame } from '@/features/onboarding/Frame';
import { fit } from '@/features/onboarding/copy';
import { useAdvance } from '@/features/onboarding/useAdvance';
import { space } from '@/theme';

/** The answers most people give. They are shown chosen and marked as a suggestion until the person changes or clears them. */
const usual = { size: 'm', legs: 'average' } as const satisfies { size: ClothingSize; legs: LegLength };

interface PromptProps {
  icon: IconName;
  text: string;
  /** The answer under it is still our guess: said in words next to the question. */
  suggested: boolean;
  /** Anything is fine to leave unset: once something is chosen, a quiet button next to the question takes it back. */
  chosen: boolean;
  clearLabel: string;
  onClear: () => void;
  testID: string;
}

function Prompt({ icon, text, suggested, chosen, clearLabel, onClear, testID }: PromptProps) {
  return (
    <View style={styles.prompt}>
      <Icon name={icon} size={20} color="textSecondary" />
      <AppText variant="title" accessibilityRole="header" style={styles.promptText}>
        {text}
      </AppText>
      {suggested ? (
        <AppText variant="meta" color="textSecondary" testID={`${testID}-suggested`}>
          {fit.suggested}
        </AppText>
      ) : chosen ? (
        <Button kind="text" compact inline label="Clear" accessibilityLabel={clearLabel} onPress={onClear} testID={`${testID}-none`} />
      ) : null}
    </View>
  );
}

/**
 * The second step after the account: the usual size and the leg length, the same choices as in Profile. Both start on
 * the most common answer, marked as a suggestion; both can be changed, cleared, or left unsaid altogether.
 */
export default function OnboardingFit() {
  const user = useSession((session) => session.user);
  const advance = useAdvance();
  // Past this step once already: the account holds the person's own answers, "not set" among them.
  const answered = user !== null && user.onboardingStep > 1;
  const [size, setSize] = useState<ClothingSize | null>(answered ? (user.clothingSize ?? null) : usual.size);
  const [legs, setLegs] = useState<LegLength | null>(answered ? (user.legLength ?? null) : usual.legs);
  const [guessed, setGuessed] = useState({ size: !answered, legs: !answered });

  const save = (change: ProfileChange) => advance.to(2, '/onboarding/colors', change);

  return (
    <Frame
      step="fit"
      onBack={() => advance.back('/onboarding/fit', false)}
      title={fit.title}
      accent={{ word: 'fit', act: 'sway' }}
      lead={fit.lead}
      testID="onboarding-fit"
      footer={
        <Actions>
          <FormError message={advance.error ? messageFor(advance.error) : null} />
          <Button
            label="Continue"
            busy={advance.pending}
            onPress={() => save({ ...(size ? { clothingSize: size } : { clearClothingSize: true }), ...(legs ? { legLength: legs } : { clearLegLength: true }) })}
            testID="fit-next"
          />
          <Button label={fit.skip} kind="text" compact onPress={() => save({ clearClothingSize: true, clearLegLength: true })} testID="fit-skip" />
        </Actions>
      }>
      <View style={styles.size}>
        <SizeLabel value={size} />
        <Prompt
          icon="ruler"
          text={fit.size}
          suggested={guessed.size}
          chosen={size !== null}
          clearLabel="Clear usual size"
          onClear={() => setSize(null)}
          testID="size"
        />
        <SizeButtons
          value={size}
          onChange={(value) => {
            setSize(value);
            setGuessed((current) => ({ ...current, size: false }));
          }}
        />
      </View>
      <View>
        <Prompt
          icon="height"
          text={fit.legs}
          suggested={guessed.legs}
          chosen={legs !== null}
          clearLabel="Clear leg length"
          onClear={() => setLegs(null)}
          testID="legs"
        />
        <View accessibilityRole="radiogroup" accessibilityLabel="Leg length" testID="legs">
          {legOptions.map((option) => (
            <Row
              key={option.value}
              role="radio"
              label={legDetails[option.value].title}
              meta={legDetails[option.value].hint}
              selected={option.value === legs}
              onPress={() => {
                setLegs(option.value);
                setGuessed((current) => ({ ...current, legs: false }));
              }}
              testID={`legs-${option.value}`}
            />
          ))}
        </View>
      </View>
    </Frame>
  );
}

const styles = StyleSheet.create({
  size: { gap: space[3] },
  prompt: { flexDirection: 'row', alignItems: 'center', gap: space[2], minHeight: 44 },
  promptText: { flex: 1 },
});
