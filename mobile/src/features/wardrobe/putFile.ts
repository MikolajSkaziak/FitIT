import { ApiError, networkProblem } from '@/api/problem';
import type { UploadTicket } from '@/api/wardrobe';

/**
 * Sends a local file straight to storage, to the address and with the headers the API issued.
 * XMLHttpRequest rather than fetch because it reports how much has gone out, which matters on a slow connection.
 */
export async function putFile(ticket: Pick<UploadTicket, 'url' | 'headers'>, fileUri: string, onProgress: (fraction: number) => void): Promise<void> {
  let body: Blob;
  try {
    body = await (await fetch(fileUri)).blob();
  } catch {
    throw new ApiError({ status: 0, code: 'photo_unreadable' });
  }

  await new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('PUT', ticket.url);
    for (const [name, value] of Object.entries(ticket.headers)) {
      request.setRequestHeader(name, value);
    }

    request.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress(event.loaded / event.total);
      }
    };
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        resolve();
      } else {
        // 403 here means the address expired or was used with other headers; asking for a new one fixes it.
        reject(new ApiError({ status: request.status, code: 'upload_refused' }));
      }
    };
    request.onerror = () => reject(new ApiError(networkProblem));
    request.ontimeout = () => reject(new ApiError(networkProblem));
    request.timeout = 60_000;
    request.send(body);
  });
}
