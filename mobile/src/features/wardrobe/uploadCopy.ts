import { messageForCode, rejectionFor } from '@/copy/errors';

import type { UploadEntry } from './uploadQueue';

const underWay: Partial<Record<UploadEntry['status'], string>> = {
  waiting: 'Waiting',
  preparing: 'Preparing the photo',
  uploading: 'Uploading',
  processing: 'Describing your photo',
};

/** What a row of the upload list says about its photo, and whether that is a problem to draw attention to. */
export function describeEntry(entry: Pick<UploadEntry, 'status' | 'rejectReason' | 'errorCode'>): { text: string; trouble: boolean } {
  switch (entry.status) {
    case 'ready':
      return { text: 'Ready', trouble: false };
    case 'needs_tags':
      return { text: 'Added. Fill in the details to finish.', trouble: false };
    case 'rejected':
      return { text: rejectionFor(entry.rejectReason), trouble: true };
    case 'failed':
      return { text: messageForCode(entry.errorCode), trouble: true };
    default:
      return { text: underWay[entry.status] ?? '', trouble: false };
  }
}
