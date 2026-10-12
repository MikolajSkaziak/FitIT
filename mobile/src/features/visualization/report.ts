import { create } from 'zustand';

import type { ReportReason } from '@/api/visualizations';

/** The words of "Report a problem" on a try-on picture. */
export const report = {
  link: 'Report a problem',
  thanks: 'Thanks — reported.',
  title: 'Report a problem',
  lead: 'What’s wrong with this picture?',
  send: 'Send report',
  close: 'Close',
  reasonsLabel: 'What’s wrong',
  reasons: [
    { value: 'wrong_clothes', label: 'Wrong clothes' },
    { value: 'distorted', label: 'Looks distorted' },
    { value: 'inappropriate', label: 'Inappropriate or offensive' },
    { value: 'other', label: 'Something else' },
  ] satisfies { value: ReportReason; label: string }[],
};

interface ReportsState {
  /** Pictures reported during this visit, with the reason: their link has become the thanks line. */
  sent: Record<string, ReportReason>;
  record: (pictureId: string, reason: ReportReason) => void;
}

/** What has been reported so far. Kept only while the app runs: the server keeps the reports themselves. */
export const useReports = create<ReportsState>((set) => ({
  sent: {},
  record: (pictureId, reason) => set((state) => ({ sent: { ...state.sent, [pictureId]: reason } })),
}));

/** A picture reported as inappropriate is taken away, and so is the way back to it. */
export const isHidden = (sent: Record<string, ReportReason>, pictureId: string | undefined): boolean => Boolean(pictureId) && sent[pictureId as string] === 'inappropriate';
