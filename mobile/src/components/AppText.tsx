import { Text, type TextProps } from 'react-native';

import { typography, useTheme, type ColorToken, type TextVariant } from '@/theme';

export interface AppTextProps extends TextProps {
  /** Serif variants (`heading`, `display`, `figure`) have italic twins, `headingItalic` and `displayItalic`, for the accent word. */
  variant?: TextVariant;
  /** Ink by default; the secondary colour for an `eyebrow`. */
  color?: ColorToken;
  align?: 'left' | 'center' | 'right';
  /** Digits of equal width, for counts and prices that change. */
  tabular?: boolean;
}

/** All text goes through here, so sizes come from the scale and never grow past 1.3 times with the system setting. */
export function AppText({ variant = 'body', color, align, tabular, style, ...rest }: AppTextProps) {
  const theme = useTheme();
  // An eyebrow is a quiet label by nature; everything else is ink unless told otherwise.
  const tone = color ?? (variant === 'eyebrow' ? 'textSecondary' : 'text');
  return (
    <Text
      maxFontSizeMultiplier={1.3}
      {...rest}
      style={[
        typography[variant],
        { color: theme[tone] },
        align ? { textAlign: align } : null,
        tabular ? { fontVariant: ['tabular-nums'] } : null,
        style,
      ]}
    />
  );
}
