import { useRouter } from 'expo-router';

import { AppText } from '@/components/AppText';
import { LinkText } from '@/components/controls';

import { report, useReports } from './report';

/**
 * Under the caption of a try-on picture: a quiet "Report a problem" that opens the report sheet, and once a report for this
 * picture was sent, the thanks line in its place.
 */
export function ReportLink({ pictureId }: { pictureId: string }) {
  const router = useRouter();
  const reported = useReports((state) => pictureId in state.sent);
  if (reported) {
    return (
      <AppText variant="caption" color="textSecondary" testID="visualization-reported">
        {report.thanks}
      </AppText>
    );
  }

  return <LinkText label={report.link} color="textSecondary" onPress={() => router.push({ pathname: '/report', params: { id: pictureId } })} testID="visualization-report" />;
}
