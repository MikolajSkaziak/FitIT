import type { Gender, ThermalPreference } from '@/api/account';
import type { IconName } from '@/components/Icon';
import { opensAllShapes } from '@/lib/gender';

/**
 * Degrees the server moves the temperature it dresses the person for: colder for someone who gets cold easily, warmer for
 * someone who runs warm (`Weather:ThermalShift`, 3 in the shipped settings). The forecast itself is not changed.
 */
export const thermalShift = 3;

export type ThermalSet = 'f' | 'm';

/**
 * The mannequin set whose pictures are shown: the men's for a man, the women's for a woman. For non-binary and "prefer not to say"
 * it follows the body shape the person chose, when there is one; with nothing to go by it is the women's set (one default, never mixed).
 */
export const thermalSetOf = (gender: Gender | null | undefined, shapeGender?: Gender | null): ThermalSet =>
  (opensAllShapes(gender ?? null) ? shapeGender : gender) === 'male' ? 'm' : 'f';

/** The answers in the order of the scale, cold to warm. */
export const thermalOrder: readonly ThermalPreference[] = ['runs_cold', 'normal', 'runs_warm'];

interface ThermalLook {
  icon: IconName;
  /** The word under the stop. */
  stop: string;
  /** The care label over the picture: what the answer does, in the words of the server's rule. */
  care: string;
  /** One sentence under the scale that says what the answer changes. */
  effect: string;
  /** What the picture shows, for a screen reader. */
  seen: string;
}

export const thermalLooks: Record<ThermalPreference, ThermalLook> = {
  runs_cold: {
    icon: 'snowflake',
    stop: 'Cold',
    care: `Dressed for ${thermalShift}° colder`,
    effect: `fitit. dresses you as if it were ${thermalShift}° colder than the forecast says.`,
    seen: 'A mannequin in a coat, a knit and a scarf',
  },
  normal: {
    icon: 'thermometer',
    stop: 'Average',
    care: 'As the forecast says',
    effect: 'fitit. dresses you for the forecast as it is.',
    seen: 'A mannequin in a knit over a shirt',
  },
  runs_warm: {
    icon: 'sun',
    stop: 'Warm',
    care: `Dressed for ${thermalShift}° warmer`,
    effect: `fitit. dresses you as if it were ${thermalShift}° warmer than the forecast says.`,
    seen: 'A mannequin in a T-shirt',
  },
};

/** The haptic level of an answer. */
export const temperatureOf = (value: ThermalPreference): 'cold' | 'normal' | 'warm' => (value === 'runs_cold' ? 'cold' : value === 'runs_warm' ? 'warm' : 'normal');
