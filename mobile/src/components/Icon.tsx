import { BarbellIcon } from 'phosphor-react-native/src/icons/Barbell';
import { BookmarkSimpleIcon } from 'phosphor-react-native/src/icons/BookmarkSimple';
import { BriefcaseIcon } from 'phosphor-react-native/src/icons/Briefcase';
import { CalendarBlankIcon } from 'phosphor-react-native/src/icons/CalendarBlank';
import { CameraIcon } from 'phosphor-react-native/src/icons/Camera';
import { CaretDownIcon } from 'phosphor-react-native/src/icons/CaretDown';
import { CaretLeftIcon } from 'phosphor-react-native/src/icons/CaretLeft';
import { CaretRightIcon } from 'phosphor-react-native/src/icons/CaretRight';
import { CheckIcon } from 'phosphor-react-native/src/icons/Check';
import { CloudIcon } from 'phosphor-react-native/src/icons/Cloud';
import { CloudRainIcon } from 'phosphor-react-native/src/icons/CloudRain';
import { CloudSnowIcon } from 'phosphor-react-native/src/icons/CloudSnow';
import { CloudSunIcon } from 'phosphor-react-native/src/icons/CloudSun';
import { CoatHangerIcon } from 'phosphor-react-native/src/icons/CoatHanger';
import { CoffeeIcon } from 'phosphor-react-native/src/icons/Coffee';
import { EnvelopeIcon } from 'phosphor-react-native/src/icons/Envelope';
import { EyeIcon } from 'phosphor-react-native/src/icons/Eye';
import { EyeSlashIcon } from 'phosphor-react-native/src/icons/EyeSlash';
import { FileTextIcon } from 'phosphor-react-native/src/icons/FileText';
import { FlowerIcon } from 'phosphor-react-native/src/icons/Flower';
import { GenderIntersexIcon } from 'phosphor-react-native/src/icons/GenderIntersex';
import { HandshakeIcon } from 'phosphor-react-native/src/icons/Handshake';
import { ImageIcon } from 'phosphor-react-native/src/icons/Image';
import { LeafIcon } from 'phosphor-react-native/src/icons/Leaf';
import { MagnifyingGlassIcon } from 'phosphor-react-native/src/icons/MagnifyingGlass';
import { MapPinIcon } from 'phosphor-react-native/src/icons/MapPin';
import { NavigationArrowIcon } from 'phosphor-react-native/src/icons/NavigationArrow';
import { PersonSimpleIcon } from 'phosphor-react-native/src/icons/PersonSimple';
import { PlusIcon } from 'phosphor-react-native/src/icons/Plus';
import { ShieldCheckIcon } from 'phosphor-react-native/src/icons/ShieldCheck';
import { SlidersHorizontalIcon } from 'phosphor-react-native/src/icons/SlidersHorizontal';
import { SnowflakeIcon } from 'phosphor-react-native/src/icons/Snowflake';
import { SparkleIcon } from 'phosphor-react-native/src/icons/Sparkle';
import { SunIcon } from 'phosphor-react-native/src/icons/Sun';
import { ArrowsClockwiseIcon } from 'phosphor-react-native/src/icons/ArrowsClockwise';
import { ArrowsVerticalIcon } from 'phosphor-react-native/src/icons/ArrowsVertical';
import { RulerIcon } from 'phosphor-react-native/src/icons/Ruler';
import { TShirtIcon } from 'phosphor-react-native/src/icons/TShirt';
import { ThermometerIcon } from 'phosphor-react-native/src/icons/Thermometer';
import { ThumbsDownIcon } from 'phosphor-react-native/src/icons/ThumbsDown';
import { ThumbsUpIcon } from 'phosphor-react-native/src/icons/ThumbsUp';
import { UserIcon } from 'phosphor-react-native/src/icons/User';
import { UsersThreeIcon } from 'phosphor-react-native/src/icons/UsersThree';
import { WineIcon } from 'phosphor-react-native/src/icons/Wine';
import { XIcon } from 'phosphor-react-native/src/icons/X';
import { View } from 'react-native';

import { useTheme, type ColorToken } from '@/theme';

/** The one icon family of the app (Phosphor). Each icon is imported on its own so the bundle carries only these. */
const icons = {
  bookmark: BookmarkSimpleIcon,
  calendar: CalendarBlankIcon,
  camera: CameraIcon,
  back: CaretLeftIcon,
  down: CaretDownIcon,
  forward: CaretRightIcon,
  check: CheckIcon,
  hanger: CoatHangerIcon,
  eye: EyeIcon,
  eyeOff: EyeSlashIcon,
  image: ImageIcon,
  search: MagnifyingGlassIcon,
  location: NavigationArrowIcon,
  plus: PlusIcon,
  filters: SlidersHorizontalIcon,
  sun: SunIcon,
  flower: FlowerIcon,
  leaf: LeafIcon,
  snowflake: SnowflakeIcon,
  thumbsDown: ThumbsDownIcon,
  thumbsUp: ThumbsUpIcon,
  user: UserIcon,
  close: XIcon,
  sparkle: SparkleIcon,
  coffee: CoffeeIcon,
  briefcase: BriefcaseIcon,
  handshake: HandshakeIcon,
  wine: WineIcon,
  friends: UsersThreeIcon,
  barbell: BarbellIcon,
  thermometer: ThermometerIcon,
  pin: MapPinIcon,
  person: PersonSimpleIcon,
  gender: GenderIntersexIcon,
  mail: EnvelopeIcon,
  style: TShirtIcon,
  ruler: RulerIcon,
  height: ArrowsVerticalIcon,
  shield: ShieldCheckIcon,
  document: FileTextIcon,
  refresh: ArrowsClockwiseIcon,
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
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Glyph size={size} color={theme[color]} weight="bold" />
    </View>
  );
}

interface BackdropIconProps {
  name: IconName;
  size?: number;
}

/**
 * The icon of a place, large and tone on tone with the page: the centrepiece of an empty screen.
 * Decorative, so it is hidden from screen readers by the view that holds it.
 */
export function BackdropIcon({ name, size = 144 }: BackdropIconProps) {
  const theme = useTheme();
  const Glyph = icons[name];
  return <Glyph size={size} color={theme.sage} weight="duotone" duotoneColor={theme.sage} duotoneOpacity={0.55} />;
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

interface SkyBackdropProps {
  sky: Sky;
  size?: number;
  color?: ColorToken;
}

/** The sky, large and faint, behind the words of the weather card. Decorative: the card says the same in words. */
export function SkyBackdrop({ sky, size = 150, color = 'onAction' }: SkyBackdropProps) {
  const theme = useTheme();
  const Glyph = skies[sky];
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Glyph size={size} color={theme[color]} weight="regular" />
    </View>
  );
}

/** Weather glyph: a line in the text colour with a sage fill. The only place the duotone weight is used. */
export function SkyGlyph({ sky, size = 80, muted = false, label }: SkyGlyphProps) {
  const theme = useTheme();
  const Glyph = skies[sky];
  // The label sits on a view around the glyph: the library's own `title` becomes an SVG element the native renderer does not know.
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label}>
      <Glyph
        size={size}
        color={muted ? theme.borderControl : theme.text}
        weight={muted ? 'regular' : 'duotone'}
        duotoneColor={theme.onSage}
        duotoneOpacity={0.28}
      />
    </View>
  );
}
