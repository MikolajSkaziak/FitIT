import * as WebBrowser from 'expo-web-browser';
import { Linking } from 'react-native';

import { palettes } from '@/theme';

/**
 * Where the legal documents are published: the `/privacy` and `/terms` pages of the fitit. website, whose address is
 * set in EXPO_PUBLIC_SITE_URL. Either document can be pointed elsewhere with EXPO_PUBLIC_PRIVACY_POLICY_URL or
 * EXPO_PUBLIC_TERMS_URL. Until an address is known there is no link at all rather than a dead one.
 */
export function privacyPolicyUrl(): string | null {
  return publishedUrl(process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL) ?? sitePage('privacy');
}

export function termsUrl(): string | null {
  return publishedUrl(process.env.EXPO_PUBLIC_TERMS_URL) ?? sitePage('terms');
}

const sitePage = (page: string): string | null => {
  const site = publishedUrl(process.env.EXPO_PUBLIC_SITE_URL);
  return site ? `${site.replace(/\/+$/, '')}/${page}` : null;
};

/** Secure addresses only; plain http is let through for a website running on the developer's own machine or home network. */
const publishedUrl = (value: string | undefined): string | null => {
  const url = value?.trim();
  return url && (url.startsWith('https://') || /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?(\/|$)/.test(url)) ? url : null;
};

/**
 * Opens a legal document over the app, in the system's in-app browser, so reading it never throws the person out of
 * what they were doing. If that browser is not available, the address goes to the system instead.
 */
export async function openDocument(url: string): Promise<void> {
  try {
    await WebBrowser.openBrowserAsync(url, {
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
      controlsColor: palettes.light.action,
    });
  } catch {
    await Linking.openURL(url);
  }
}
