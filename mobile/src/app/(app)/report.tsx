import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { reportVisualization, type ReportReason } from '@/api/visualizations';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { IconButton, OptionTile } from '@/components/controls';
import { FormError } from '@/components/forms';
import { messageFor } from '@/copy/errors';
import { detachVisualization } from '@/features/visualization/attach';
import { report, useReports } from '@/features/visualization/report';
import { success } from '@/lib/haptics';
import { size, space } from '@/theme';

/** "Report a problem" with a try-on picture: the reasons as option rows, and Send report. A sheet that fits its content. */
export default function ReportProblem() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [reason, setReason] = useState<ReportReason | null>(null);

  const send = useMutation({
    mutationFn: (why: ReportReason) => reportVisualization(id, why),
    onSuccess: (_done, why) => {
      success();
      // The picture the server deleted must not stay on any screen that still holds it.
      if (why === 'inappropriate') {
        detachVisualization(queryClient, id);
      }

      useReports.getState().record(id, why);
      router.back();
    },
  });

  return (
    <View collapsable={false} style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, space[4]) }]} testID="report-sheet">
      <View style={styles.head}>
        <View style={styles.titles}>
          <AppText variant="heading" accessibilityRole="header">
            {report.title}
          </AppText>
          <AppText variant="caption" color="textSecondary">
            {report.lead}
          </AppText>
        </View>
        <IconButton icon="close" label={report.close} onPress={() => router.back()} testID="report-close" />
      </View>
      <View accessibilityRole="radiogroup" accessibilityLabel={report.reasonsLabel}>
        {report.reasons.map((option) => (
          <OptionTile key={option.value} label={option.label} selected={reason === option.value} onPress={() => setReason(option.value)} testID={`report-reason-${option.value}`} />
        ))}
      </View>
      <View style={styles.actions}>
        <FormError message={send.isError ? messageFor(send.error) : null} />
        <Button label={report.send} disabled={reason === null} busy={send.isPending} onPress={() => reason && send.mutate(reason)} testID="report-send" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { paddingHorizontal: size.gutter, paddingTop: space[6], gap: space[4] },
  head: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  titles: { flex: 1, gap: 2 },
  actions: { gap: space[2] },
});
