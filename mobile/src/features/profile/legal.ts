/**
 * Where the privacy policy is published. The drafts in docs/prawne are not to be linked from the app yet (task 5.4),
 * so until the address is set in EXPO_PUBLIC_PRIVACY_POLICY_URL the profile shows no row for it rather than a dead one.
 */
export function privacyPolicyUrl(): string | null {
  const url = process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL?.trim();
  return url?.startsWith('https://') ? url : null;
}
