import { messageForCode, rejectionFor } from '@/copy/errors';

import type { UploadEntry } from './uploadQueue';

const underWay: Partial<Record<UploadEntry['status'], string>> = {
  waiting: 'Czeka w kolejce',
  preparing: 'Przygotowujemy zdjęcie',
  uploading: 'Wysyłanie',
  processing: 'Opisujemy zdjęcie',
};

/** What a row of the upload list says about its photo, and whether that is a problem to draw attention to. */
export function describeEntry(entry: Pick<UploadEntry, 'status' | 'rejectReason' | 'errorCode'>): { text: string; trouble: boolean } {
  switch (entry.status) {
    case 'ready':
      return { text: 'Gotowe, opisane', trouble: false };
    case 'needs_tags':
      return { text: 'Dodane. Opis trzeba uzupełnić ręcznie.', trouble: false };
    case 'rejected':
      return { text: rejectionFor(entry.rejectReason), trouble: true };
    case 'failed':
      return { text: messageForCode(entry.errorCode), trouble: true };
    default:
      return { text: underWay[entry.status] ?? '', trouble: false };
  }
}
