import type { Occasion } from '@/api/outfits';
import { TextTabs } from '@/components/TextTabs';
import { occasionIcon } from '@/copy/labels';

import { occasionPills } from './copy';

interface OccasionTabsProps {
  occasion: Occasion;
  onOccasion: (occasion: Occasion) => void;
}

const options = occasionPills.map(({ value, label }) => ({ value, label, icon: occasionIcon(value) }));

/** The occasions as one row of text tabs that scrolls sideways to both screen edges; the chosen word sits on a green line. */
export function OccasionTabs({ occasion, onOccasion }: OccasionTabsProps) {
  return <TextTabs label="Occasion" options={options} value={occasion} onChange={onOccasion} testID="today-occasions" />;
}
