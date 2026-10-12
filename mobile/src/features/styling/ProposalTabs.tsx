import { TextTabs } from '@/components/TextTabs';

interface ProposalTabsProps {
  labels: readonly string[];
  selected: number;
  onSelect: (index: number) => void;
}

/** One word per proposal: the chosen one is ink on a green line. They name the pages and show where you are among them. */
export function ProposalTabs({ labels, selected, onSelect }: ProposalTabsProps) {
  return (
    <TextTabs<number>
      label="Outfits"
      tabs
      layout="row"
      value={selected}
      onChange={onSelect}
      options={labels.map((label, index) => ({ value: index, label, accessibilityLabel: `${label}, ${index + 1} of ${labels.length}` }))}
      testID="proposal-tab"
    />
  );
}
