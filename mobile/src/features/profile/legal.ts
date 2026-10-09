/**
 * Where the privacy policy is published. The drafts in docs/prawne are not to be linked from the app yet (task 5.4),
 * so until the address is set in EXPO_PUBLIC_PRIVACY_POLICY_URL the profile shows no row for it rather than a dead one.
 */
export function privacyPolicyUrl(): string | null {
  return secureUrl(process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL);
}

/** Where the terms of service are published (EXPO_PUBLIC_TERMS_URL). Null until they are, for the same reason. */
export function termsUrl(): string | null {
  return secureUrl(process.env.EXPO_PUBLIC_TERMS_URL);
}

const secureUrl = (value: string | undefined): string | null => {
  const url = value?.trim();
  return url?.startsWith('https://') ? url : null;
};
