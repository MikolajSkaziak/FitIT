import { Text, type TextProps } from 'react-native';

import { typography, useTheme, type ColorToken, type TextVariant } from '@/theme';

export interface AppTextProps extends TextProps {
  variant?: TextVariant;
  color?: ColorToken;
  align?: 'left' | 'center' | 'right';
  /** Digits of equal width, for counts and prices that change. */
  tabular?: boolean;
}

/** All text goes through here, so sizes come from the scale and never grow past 1.3 times with the system setting. */
export function AppText({ variant = 'body', color = 'text', align, tabular, style, ...rest }: AppTextProps) {
  const theme = useTheme();
  return (
    <Text
      maxFontSizeMultiplier={1.3}
      {...rest}
      style={[
        typography[variant],
        { color: theme[color] },
        align ? { textAlign: align } : null,
        tabular ? { fontVariant: ['tabular-nums'] } : null,
        style,
      ]}
    />
  );
}
