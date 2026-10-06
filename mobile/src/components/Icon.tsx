import { BookmarkSimpleIcon } from 'phosphor-react-native/src/icons/BookmarkSimple';
import { CalendarBlankIcon } from 'phosphor-react-native/src/icons/CalendarBlank';
import { CameraIcon } from 'phosphor-react-native/src/icons/Camera';
import { CaretLeftIcon } from 'phosphor-react-native/src/icons/CaretLeft';
import { CaretRightIcon } from 'phosphor-react-native/src/icons/CaretRight';
import { CheckIcon } from 'phosphor-react-native/src/icons/Check';
import { CloudIcon } from 'phosphor-react-native/src/icons/Cloud';
import { CloudRainIcon } from 'phosphor-react-native/src/icons/CloudRain';
import { CloudSnowIcon } from 'phosphor-react-native/src/icons/CloudSnow';
import { CloudSunIcon } from 'phosphor-react-native/src/icons/CloudSun';
import { CoatHangerIcon } from 'phosphor-react-native/src/icons/CoatHanger';
import { DotsThreeIcon } from 'phosphor-react-native/src/icons/DotsThree';
import { EyeIcon } from 'phosphor-react-native/src/icons/Eye';
import { EyeSlashIcon } from 'phosphor-react-native/src/icons/EyeSlash';
import { ImageIcon } from 'phosphor-react-native/src/icons/Image';
import { MagnifyingGlassIcon } from 'phosphor-react-native/src/icons/MagnifyingGlass';
import { NavigationArrowIcon } from 'phosphor-react-native/src/icons/NavigationArrow';
import { PlusIcon } from 'phosphor-react-native/src/icons/Plus';
import { SlidersHorizontalIcon } from 'phosphor-react-native/src/icons/SlidersHorizontal';
import { SunIcon } from 'phosphor-react-native/src/icons/Sun';
import { ThumbsDownIcon } from 'phosphor-react-native/src/icons/ThumbsDown';
import { ThumbsUpIcon } from 'phosphor-react-native/src/icons/ThumbsUp';
import { UserIcon } from 'phosphor-react-native/src/icons/User';
import { XIcon } from 'phosphor-react-native/src/icons/X';

import { useTheme, type ColorToken } from '@/theme';

/** The one icon family of the app (Phosphor). Each icon is imported on its own so the bundle carries only these. */
const icons = {
  bookmark: BookmarkSimpleIcon,
  calendar: CalendarBlankIcon,
  camera: CameraIcon,
  back: CaretLeftIcon,
  forward: CaretRightIcon,
  check: CheckIcon,
  hanger: CoatHangerIcon,
  more: DotsThreeIcon,
  eye: EyeIcon,
  eyeOff: EyeSlashIcon,
  image: ImageIcon,
  search: MagnifyingGlassIcon,
  location: NavigationArrowIcon,
  plus: PlusIcon,
  filters: SlidersHorizontalIcon,
  sun: SunIcon,
  thumbsDown: ThumbsDownIcon,
  thumbsUp: ThumbsUpIcon,
  user: UserIcon,
  close: XIcon,
} as const;

export type IconName = keyof typeof icons;

interface IconProps {
  name: IconName;
  /** 20 inside controls, 24 standing alone, 16 next to meta text; 22 and 30 belong to the brand mark only. */
  size?: 16 | 20 | 22 | 24 | 30;
  color?: ColorToken;
}

/** Interface icon in the single weight the app uses. Decorative by default; the pressable around it carries the label. */
export function Icon({ name, size = 24, color = 'text' }: IconProps) {
  const theme = useTheme();
  const Glyph = icons[name];
  return <Glyph size={size} color={theme[color]} weight="bold" />;
}

const skies = {
  sun: SunIcon,
  'cloud-sun': CloudSunIcon,
  cloud: CloudIcon,
  rain: CloudRainIcon,
  snow: CloudSnowIcon,
} as const;

export type Sky = keyof typeof skies;

interface SkyGlyphProps {
  sky: Sky;
  size?: 56 | 80;
  /** Outline only, for "we do not know the weather". */
  muted?: boolean;
  label: string;
}

/** Weather glyph: a line in the text colour with a sage fill. The only place the duotone weight is used. */
export function SkyGlyph({ sky, size = 80, muted = false, label }: SkyGlyphProps) {
  const theme = useTheme();
  const Glyph = skies[sky];
  return (
    <Glyph
      size={size}
      color={muted ? theme.borderControl : theme.text}
      weight={muted ? 'regular' : 'duotone'}
      duotoneColor={theme.onSage}
      duotoneOpacity={0.28}
      title={label}
    />
  );
}
