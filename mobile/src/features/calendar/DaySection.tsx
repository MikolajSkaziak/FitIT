import { useRouter } from 'expo-router';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import type { CalendarEntry } from '@/api/calendar';
import { daysBetween, fromIso, type CalendarDate } from '@/lib/dates';

import { EntryRow } from './EntryRow';
import { isPending } from './useCalendar';

interface DayEntriesProps {
  entries: readonly CalendarEntry[];
  today: CalendarDate;
  size: 'card' | 'row';
  onConfirm: (entry: CalendarEntry) => void;
  onRemove: (entry: CalendarEntry) => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * The outfits of one day, each with what can be done about it. "I wore this" is offered for a planned outfit once its
 * day has come. An outfit opened from a day that is still ahead carries the day along, so its page can speak of it.
 */
export function DayEntries({ entries, today, size, onConfirm, onRemove, style }: DayEntriesProps) {
  const router = useRouter();
  return (
    <View style={style}>
      {entries.map((entry) => {
        const date = fromIso(entry.date);
        const ahead = date ? daysBetween(today, date) : 0;
        return (
          <EntryRow
            key={entry.outfit.id}
            entry={entry}
            size={size}
            onOpen={() => router.push({ pathname: '/outfit/[id]', params: { id: entry.outfit.id, ...(ahead > 0 ? { date: entry.date } : null) } })}
            onConfirm={!entry.worn && ahead <= 0 && !isPending(entry) ? () => onConfirm(entry) : undefined}
            onRemove={() => onRemove(entry)}
          />
        );
      })}
    </View>
  );
}
