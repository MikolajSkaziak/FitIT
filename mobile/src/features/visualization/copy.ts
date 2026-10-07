import type { Usage } from '@/api/wardrobe';
import { messageForCode } from '@/copy/errors';
import { plural } from '@/lib/plural';

import type { OrderStage } from './order';

/** One name for this action everywhere in the app (.ux-profile.md). */
export const showAction = 'Pokaż na sylwetce';

export const retryAction = 'Spróbuj ponownie';

export const viewLabel = 'Widok zestawu';

export const collageView = 'Kolaż';

export const silhouetteView = 'Na sylwetce';

/** Said under the picture, because the generator may miss a pattern or a logo (spec 7.6). */
export const pictureCaption = 'Wizualizacja poglądowa. Kolory i detale mogą różnić się od ubrań.';

export const pictureLabel = 'Zestaw na wybranej sylwetce';

export const enlargeAction = 'Powiększ obraz';

export const closeEnlarged = 'Zamknij obraz';

export const working = {
  title: 'Tworzymy obraz',
  text: 'To potrwa do minuty. Możesz wyjść z ekranu, obraz będzie czekał przy zestawie.',
  /** Names the bar for screen readers; the panel beside it carries the words. */
  progressLabel: 'Postęp tworzenia obrazu',
};

export interface Notice {
  title: string;
  text: string;
  /** Label of the way forward, or null when sending the same order again would end the same way. */
  action: string | null;
}

const collageStays = 'Kolaż z prawdziwymi zdjęciami ubrań zostaje przy zestawie.';

const refunded = 'Ta wizualizacja nie liczy się do dzisiejszego limitu.';

const consent: Notice = {
  title: 'Potrzebna jest zgoda na przetwarzanie zdjęć',
  text: `Obraz powstaje u zewnętrznego dostawcy, więc bez tej zgody go nie zrobimy. Zgodę można włączyć w profilu. ${collageStays}`,
  action: null,
};

const paused: Notice = {
  title: 'Wizualizacje są dziś wstrzymane',
  text: `Dzienny budżet na obrazy się skończył. Obrazy wrócą jutro. ${collageStays}`,
  action: null,
};

/** The three cases of plan task 4.7, plus whatever else the server may answer with. */
const byCode: Record<string, Notice> = {
  content_blocked: {
    title: 'Nie udało się pokazać tego zestawu',
    text: `Filtr bezpieczeństwa generatora nie przepuścił tych ubrań. Zwykle dotyczy to odsłoniętej skóry. ${refunded} ${collageStays}`,
    action: null,
  },
  timeout: {
    title: 'Obraz nie powstał na czas',
    text: `Generator nie odpowiedział w ciągu trzech minut. ${refunded}`,
    action: retryAction,
  },
  budget_exhausted: paused,
  visualizations_paused: paused,
  consent_withdrawn: consent,
  consent_required: consent,
  limit_reached: {
    title: 'Dzisiejszy limit wizualizacji jest wykorzystany',
    text: `Obrazy wrócą jutro. ${collageStays}`,
    action: null,
  },
  not_found: {
    title: 'Nie udało się odnaleźć zamówienia',
    text: 'Obrazu już nie ma na serwerze. Zamów go jeszcze raz.',
    action: showAction,
  },
};

const pictureFailed: Notice = {
  title: 'Obraz nie powstał',
  text: `Generator obrazu zawiódł. ${refunded}`,
  action: retryAction,
};

const orderRefused: Notice = {
  title: 'Nie udało się zamówić obrazu',
  text: '',
  action: retryAction,
};

/**
 * What the person reads instead of the picture. `blocked` and `failed` are answers about the picture; `refused` means
 * the order was never taken, so its text comes from the shared words for API error codes.
 */
export function noticeFor(stage: OrderStage, errorCode: string | null): Notice | null {
  if (stage !== 'blocked' && stage !== 'failed' && stage !== 'refused') {
    return null;
  }

  const known = errorCode ? byCode[errorCode] : undefined;
  if (known) {
    return known;
  }

  return stage === 'refused' ? { ...orderRefused, text: messageForCode(errorCode) } : pictureFailed;
}

/** "Zostały 4 z 5 wizualizacji na dziś." The counted noun stays in one form after "z 5"; the verb agrees with what is left. */
export function leftToday(usage: Usage['visualizations']): string {
  const left = Math.max(0, usage.limit - usage.used);
  if (left === 0) {
    return 'Dzisiejszy limit wizualizacji jest wykorzystany. Wróć jutro.';
  }

  return `${plural(left, ['Została', 'Zostały', 'Zostało'])} ${left} z ${usage.limit} wizualizacji na dziś.`;
}
