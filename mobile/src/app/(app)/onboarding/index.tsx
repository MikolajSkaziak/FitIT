import { Redirect } from 'expo-router';

import { useSession } from '@/auth/session';
import { resumeRoute } from '@/features/onboarding/steps';

/** Opens the step the person has not finished yet. */
export default function OnboardingStart() {
  const user = useSession((session) => session.user);
  return <Redirect href={user ? resumeRoute(user) : '/'} />;
}
