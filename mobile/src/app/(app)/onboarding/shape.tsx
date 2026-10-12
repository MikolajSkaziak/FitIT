import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { Avatar, Gender } from '@/api/account';
import { useSession } from '@/auth/session';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { GenderChoice } from '@/components/choices';
import { LinkText } from '@/components/controls';
import { FormError, Labeled } from '@/components/forms';
import { Fade } from '@/components/motion';
import { messageFor } from '@/copy/errors';
import { Actions, Frame } from '@/features/onboarding/Frame';
import { shape } from '@/features/onboarding/copy';
import { useAdvance } from '@/features/onboarding/useAdvance';
import { BodyShapePicker } from '@/features/registration/BodyShapePicker';
import { messages } from '@/features/registration/validation';
import { opensAllShapes, shapeFits } from '@/lib/gender';
import { space } from '@/theme';

type Shape = Pick<Avatar, 'id' | 'gender'>;

/**
 * The first step after the account exists, and the one that cannot be skipped: the body shape. The gender was chosen
 * before the account and is already on it, so only that gender's five shapes show ("Woman" or "Man"), or all ten for
 * non-binary and "prefer not to say". "Change gender" opens the choice right here. A new account holds a stand-in shape
 * until this step is done, so nothing is shown as chosen before the person chooses.
 */
export default function OnboardingShape() {
  const user = useSession((session) => session.user);
  const advance = useAdvance();
  // Past this step once already (Back from the next one, or another phone): what the account holds is the person's own answer.
  const answered = user !== null && user.onboardingStep > 0;
  const [gender, setGender] = useState<Gender>(user?.gender ?? 'unspecified');
  const [changingGender, setChangingGender] = useState(false);
  const [chosen, setChosen] = useState<Shape | null>(answered ? user.avatar : null);
  const [asked, setAsked] = useState(false);

  const chooseGender = (value: Gender) => {
    setGender(value);
    // Women and men are offered their own five shapes, so a choice made from the other set no longer applies.
    setChosen((current) => (current && shapeFits(value, current.gender) ? current : null));
  };

  const next = () => {
    setAsked(true);
    if (chosen) {
      advance.to(1, '/onboarding/fit', { gender, avatarId: chosen.id });
    }
  };

  return (
    <Frame
      step="shape"
      visual
      title={shape.title}
      accent={{ word: 'shape', act: 'stretch' }}
      lead={shape.lead}
      testID="onboarding-shape"
      footer={
        <Actions>
          <FormError message={advance.error ? messageFor(advance.error) : asked && !chosen ? messages.avatarMissing : null} />
          <Button label="Continue" busy={advance.pending} onPress={next} testID="shape-next" />
        </Actions>
      }>
      <View style={styles.body}>
        {changingGender ? (
          <Labeled label={shape.gender}>
            <GenderChoice value={gender} onChange={chooseGender} />
          </Labeled>
        ) : (
          <LinkText label={shape.changeGender} onPress={() => setChangingGender(true)} testID="shape-change-gender" />
        )}
        <View style={styles.shapes}>
          <AppText variant="eyebrow">{shape.shapes}</AppText>
          {opensAllShapes(gender) ? (
            <Fade key="all">
              <AppText variant="secondary" color="textSecondary" testID="shape-all">
                {shape.allShapes}
              </AppText>
            </Fade>
          ) : null}
          <BodyShapePicker gender={gender} value={chosen?.id ?? null} onChange={setChosen} />
        </View>
      </View>
    </Frame>
  );
}

const styles = StyleSheet.create({
  body: { gap: space[6] },
  shapes: { gap: space[3] },
});
