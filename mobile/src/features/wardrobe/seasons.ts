import type { Season } from '@/api/wardrobe';
import type { IconName } from '@/components/Icon';

/** One line icon for each season, wherever seasons are picked. */
export const seasonIcon: Record<Season, IconName> = { spring: 'flower', summer: 'sun', fall: 'leaf', winter: 'snowflake' };
