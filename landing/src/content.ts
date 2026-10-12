/**
 * Everything the owner may need to change lives in this file: links, prices, limits and copy.
 * Anything marked PLACEHOLDER is not decided yet and is rendered on the page as a visible placeholder.
 */

/* ------------------------------------------------------------------ */
/* Links                                                               */
/* ------------------------------------------------------------------ */

/** PLACEHOLDER: the real store listings. `#` until the app is published. */
export const STORE_LINKS = {
  appStore: '#',
  googlePlay: '#',
} as const;

/** The legal pages (src/legal/, rendered by src/components/LegalPage.tsx). They are drafts until the owner publishes the final texts. */
export const LEGAL_LINKS = {
  terms: '/terms',
  privacy: '/privacy',
} as const;

/** PLACEHOLDER: the public contact e-mail. `null` hides the mailto and shows a plain "Contact" link to `#`. */
export const CONTACT_EMAIL: string | null = null;

/** PLACEHOLDER: an image of the real QR code that opens the store listing. `null` draws an empty frame. */
export const QR_CODE_IMAGE: string | null = null;

/* ------------------------------------------------------------------ */
/* Pricing: NOT DECIDED. Fill these in; `null` renders as "—".          */
/* ------------------------------------------------------------------ */

/** Shown wherever a value is still `null`. */
export const PLACEHOLDER_MARK = '—';

export const CURRENCY_SYMBOL = '$';

/** PLACEHOLDER: price of Plus when billed monthly, per month. */
export const PLUS_PRICE_MONTHLY: number | null = null;
/** PLACEHOLDER: price of Plus when billed yearly, per year. */
export const PLUS_PRICE_YEARLY: number | null = null;
/** PLACEHOLDER: what the yearly plan works out to per month. */
export const PLUS_PRICE_YEARLY_PER_MONTH: number | null = null;

/** PLACEHOLDER: daily limits of each plan. */
export const FREE_OUTFIT_SUGGESTIONS_PER_DAY: number | null = null;
export const PLUS_OUTFIT_SUGGESTIONS_PER_DAY: number | null = null;
export const FREE_TRY_ONS_PER_DAY: number | null = null;
export const PLUS_TRY_ONS_PER_DAY: number | null = null;

/** PLACEHOLDER: taken from the app's subscription mockup, not confirmed. */
export const FREE_OUTFIT_CALENDAR = 'Not included';
export const PLUS_OUTFIT_CALENDAR = 'Included';
export const FREE_COLOR_ANALYSIS = 'Once';
export const PLUS_COLOR_ANALYSIS = 'Any time';

export function formatPrice(value: number | null): string {
  return `${CURRENCY_SYMBOL}${value === null ? PLACEHOLDER_MARK : value}`;
}

export function formatPerDay(value: number | null): string {
  return `${value === null ? PLACEHOLDER_MARK : value} a day`;
}

export type PlanRowIcon = 'sparkle' | 'camera' | 'calendar' | 'palette';

export const PLAN_ROWS: { label: string; short: string; icon: PlanRowIcon; free: string; plus: string }[] = [
  {
    label: 'Outfit suggestions a day',
    short: 'Looks',
    icon: 'sparkle',
    free: formatPerDay(FREE_OUTFIT_SUGGESTIONS_PER_DAY),
    plus: formatPerDay(PLUS_OUTFIT_SUGGESTIONS_PER_DAY),
  },
  {
    label: 'AI try-on pictures a day',
    short: 'Try-ons',
    icon: 'camera',
    free: formatPerDay(FREE_TRY_ONS_PER_DAY),
    plus: formatPerDay(PLUS_TRY_ONS_PER_DAY),
  },
  { label: 'Outfit calendar', short: 'Calendar', icon: 'calendar', free: FREE_OUTFIT_CALENDAR, plus: PLUS_OUTFIT_CALENDAR },
  { label: 'Color analysis', short: 'Color analysis', icon: 'palette', free: FREE_COLOR_ANALYSIS, plus: PLUS_COLOR_ANALYSIS },
];

/* ------------------------------------------------------------------ */
/* Navigation                                                          */
/* ------------------------------------------------------------------ */

export const NAV_LINKS = [
  { href: '#how', label: 'How it works' },
  { href: '#wardrobe', label: 'Wardrobe' },
  { href: '#weather', label: 'Weather' },
  { href: '#try-on', label: 'Try-on' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#faq', label: 'FAQ' },
] as const;

export const CTA_LABEL = 'Get the app';
export const CTA_HREF = '#get';

/* ------------------------------------------------------------------ */
/* Demo data shown inside the phone screens                            */
/* ------------------------------------------------------------------ */

/** The name, place and date in the mock screens. */
export const DEMO = {
  name: 'Sam',
  initial: 'S',
  place: 'Lisbon',
  date: 'Friday · October 9',
} as const;

export type PieceId =
  | 'beige_chinos'
  | 'black_boots'
  | 'black_jeans'
  | 'black_shorts'
  | 'black_tshirt'
  | 'black_winter_coat'
  | 'blue_jeans'
  | 'gray_sweater'
  | 'navy_hoodie'
  | 'navy_jacket'
  | 'olive_cargo_pants'
  | 'white_shirt'
  | 'white_sneakers'
  | 'white_tshirt';

export type PieceRole = 'top' | 'layer' | 'bottom' | 'shoes';

export const PIECES: Record<PieceId, { name: string; group: string; role: PieceRole; wide?: boolean }> = {
  beige_chinos: { name: 'Beige chinos', group: 'Pants and shorts', role: 'bottom' },
  black_boots: { name: 'Black boots', group: 'Shoes', role: 'shoes' },
  black_jeans: { name: 'Black jeans', group: 'Jeans', role: 'bottom' },
  black_shorts: { name: 'Black shorts', group: 'Pants and shorts', role: 'bottom', wide: true },
  black_tshirt: { name: 'Black tee', group: 'T-shirts and tops', role: 'top' },
  black_winter_coat: { name: 'Black wool coat', group: 'Jackets and coats', role: 'layer' },
  blue_jeans: { name: 'Blue jeans', group: 'Jeans', role: 'bottom' },
  gray_sweater: { name: 'Gray crewneck', group: 'Sweaters and hoodies', role: 'top' },
  navy_hoodie: { name: 'Navy hoodie', group: 'Sweaters and hoodies', role: 'top' },
  navy_jacket: { name: 'Navy jacket', group: 'Jackets and coats', role: 'layer' },
  olive_cargo_pants: { name: 'Olive cargo pants', group: 'Pants and shorts', role: 'bottom' },
  white_shirt: { name: 'White shirt', group: 'Shirts and blouses', role: 'top' },
  white_sneakers: { name: 'White sneakers', group: 'Shoes', role: 'shoes' },
  white_tshirt: { name: 'White tee', group: 'T-shirts and tops', role: 'top' },
};

export type FigureId = 'fit-1' | 'fit-2' | 'fit-3';

export type Look = {
  title: string;
  reason: string;
  tag: string;
  art: { kind: 'figure'; figure: FigureId } | { kind: 'collage'; pieces: PieceId[] };
};

export type OccasionIcon = 'mug' | 'briefcase' | 'glass' | 'dumbbell';

export const OCCASIONS: { label: string; icon: OccasionIcon; looks: [Look, Look, Look] }[] = [
  {
    label: 'Everyday',
    icon: 'mug',
    looks: [
      {
        title: 'Easy everyday',
        reason: 'Light enough for 14°. Add a layer if you stay out after 3.',
        tag: 'Safe choice',
        art: { kind: 'figure', figure: 'fit-1' },
      },
      {
        title: 'Soft layers',
        reason: 'The hoodie covers the cooler evening, and the hood helps in light rain.',
        tag: 'A bit warmer',
        art: { kind: 'figure', figure: 'fit-2' },
      },
      {
        title: 'Coat weather',
        reason: 'Dark and simple under a wool coat. Ready for the rain after 3 pm.',
        tag: 'Sure bet',
        art: { kind: 'figure', figure: 'fit-3' },
      },
    ],
  },
  {
    label: 'Work',
    icon: 'briefcase',
    looks: [
      {
        title: 'Clean lines',
        reason: 'A white shirt and chinos, with boots that handle a wet sidewalk.',
        tag: 'Safe choice',
        art: { kind: 'collage', pieces: ['white_shirt', 'beige_chinos', 'black_boots'] },
      },
      {
        title: 'Knit and coat',
        reason: 'A crewneck under the wool coat keeps the commute warm.',
        tag: 'A bit warmer',
        art: { kind: 'collage', pieces: ['black_winter_coat', 'gray_sweater', 'black_jeans', 'black_boots'] },
      },
      {
        title: 'Smart, relaxed',
        reason: 'The jacket goes on when the rain starts after 3 pm.',
        tag: 'New pairing',
        art: { kind: 'collage', pieces: ['navy_jacket', 'white_shirt', 'black_jeans', 'white_sneakers'] },
      },
    ],
  },
  {
    label: 'Date night',
    icon: 'glass',
    looks: [
      {
        title: 'Sharp and simple',
        reason: 'White on black, and boots for the walk home in the rain.',
        tag: 'Safe choice',
        art: { kind: 'collage', pieces: ['white_shirt', 'black_jeans', 'black_boots'] },
      },
      {
        title: 'All black',
        reason: 'One color from coat to boots. Warm enough for 11° at 9 pm.',
        tag: 'Sure bet',
        art: { kind: 'collage', pieces: ['black_winter_coat', 'black_tshirt', 'black_jeans', 'black_boots'] },
      },
      {
        title: 'Soft neutrals',
        reason: 'Gray knit and beige chinos, relaxed but put together.',
        tag: 'New pairing',
        art: { kind: 'collage', pieces: ['gray_sweater', 'beige_chinos', 'white_sneakers'] },
      },
    ],
  },
  {
    label: 'Workout',
    icon: 'dumbbell',
    looks: [
      {
        title: 'Light session',
        reason: 'Tee and shorts for indoors. Nothing you need to carry.',
        tag: 'Safe choice',
        art: { kind: 'collage', pieces: ['black_tshirt', 'black_shorts', 'white_sneakers'] },
      },
      {
        title: 'Warm-up layer',
        reason: 'The hoodie comes off once you are warm.',
        tag: 'A bit warmer',
        art: { kind: 'collage', pieces: ['navy_hoodie', 'black_shorts', 'white_sneakers'] },
      },
      {
        title: 'Outdoor run',
        reason: 'The zip jacket keeps the light rain off at 14°.',
        tag: 'New pairing',
        art: { kind: 'collage', pieces: ['navy_jacket', 'white_tshirt', 'black_shorts', 'white_sneakers'] },
      },
    ],
  },
];

export const HERO_WEATHER = {
  temp: '14°',
  condition: 'Light rain after 3 pm',
  line: `${DEMO.place} · feels like 12° to 15°. Take a jacket.`,
} as const;

/** The wardrobe grid behind the hero and at the end of the photo sequence. */
export const WARDROBE_GRID: PieceId[] = [
  'black_winter_coat',
  'navy_hoodie',
  'blue_jeans',
  'gray_sweater',
  'white_tshirt',
  'white_sneakers',
];

/** The piece that is photographed in the "From photo to wardrobe" sequence. */
export const SEQUENCE_PIECE = {
  id: 'navy_jacket' as PieceId,
  name: 'Navy jacket',
  group: 'Jackets and coats',
  description: 'A lightweight zip jacket with a stand collar.',
  tagLines: ['Navy · Nylon', 'Spring · Fall', 'Casual · Sporty'],
} as const;

export const SEQUENCE_STEPS = [
  {
    label: 'Your photo',
    title: 'Take a photo',
    body: 'Lay a piece on the bed, the floor or a hanger and photograph it. One piece per photo, straight from your camera or library.',
    status: 'One piece per photo.',
  },
  {
    label: 'Background removed',
    title: 'The background falls away',
    body: 'fitit. cuts the piece out of the photo, so your wardrobe looks tidy even when the bedroom does not.',
    status: 'Removing the background…',
  },
  {
    label: 'Described by AI',
    title: 'It writes the label for you',
    body: 'Name, group, color, material and season are filled in. You can correct anything it got wrong.',
    status: 'Describing it for you…',
  },
  {
    label: 'In your wardrobe',
    title: 'It joins your wardrobe',
    body: 'The piece lands in your wardrobe, ready to be worn in today’s looks.',
    status: 'Ready',
  },
] as const;

export type WeatherIcon = 'sun' | 'rain' | 'snow';

export const WEATHER_STATES: {
  id: string;
  tab: string;
  temp: number;
  icon: WeatherIcon;
  condition: string;
  line: string;
  figure: FigureId;
  title: string;
  reason: string;
}[] = [
  {
    id: 'sun',
    tab: 'Sunny',
    temp: 24,
    icon: 'sun',
    condition: 'Clear and warm',
    line: `${DEMO.place} · feels like 23° to 25°. No layers needed.`,
    figure: 'fit-1',
    title: 'Easy everyday',
    reason: 'Light enough for 24°. A tee, jeans and sneakers, and nothing extra to carry.',
  },
  {
    id: 'rain',
    tab: 'Rain',
    temp: 13,
    icon: 'rain',
    condition: 'Light rain after 3 pm',
    line: `${DEMO.place} · feels like 11° to 14°. Take a layer.`,
    figure: 'fit-2',
    title: 'Soft layers',
    reason: 'The hoodie covers the cooler air, and the hood helps in light rain.',
  },
  {
    id: 'cold',
    tab: 'Cold',
    temp: 2,
    icon: 'snow',
    condition: 'Cold and dry',
    line: `${DEMO.place} · feels like −1° to 3°. Dress warm.`,
    figure: 'fit-3',
    title: 'Coat weather',
    reason: 'A wool coat over dark layers, and boots for the cold ground.',
  },
];

export const OUTFIT_VIEWS = [
  {
    id: 'collage',
    tab: 'Collage',
    care: '3 pieces · collage',
    title: 'Laid out as a collage',
    body: 'The pieces of the look side by side, the way you would lay them on the bed.',
  },
  {
    id: 'figure',
    tab: 'On figure',
    care: 'On your figure',
    title: 'Placed on a figure',
    body: 'The same pieces layered on a mannequin with your body shape, so you can judge proportions.',
  },
  {
    id: 'tryon',
    tab: 'Try-on',
    care: 'Try-on · made by AI',
    title: 'Worn in a try-on picture',
    body: 'A generated picture of the mannequin wearing the outfit. It is a preview: fit and colors can differ a little from the real thing.',
  },
] as const;

export const OUTFIT_VIEW_PIECES: PieceId[] = ['white_tshirt', 'blue_jeans', 'white_sneakers'];

export const PALETTE = {
  season: 'Soft autumn',
  line: 'Warm, muted shades suit you best. We’ll lean on them when we pick outfits.',
  more: [
    { name: 'Olive', hex: '#6B7045' },
    { name: 'Camel', hex: '#B58E5E' },
    { name: 'Rust', hex: '#9C5435' },
    { name: 'Cream', hex: '#EFE6D2' },
    { name: 'Teal', hex: '#3F6E6C' },
    { name: 'Burgundy', hex: '#6E2F38' },
    { name: 'Moss', hex: '#54603F' },
    { name: 'Warm gray', hex: '#8C857A' },
  ],
  less: [
    { name: 'Pure white', hex: '#FFFFFF' },
    { name: 'Black', hex: '#111111' },
    { name: 'Neon pink', hex: '#FF3E9A' },
  ],
} as const;

/** The 16 styles of the app, in the order of the shelf. `code` is the image file name. */
export const STYLES = [
  { code: 'casual', label: 'Casual' },
  { code: 'smart', label: 'Smart casual' },
  { code: 'elegant', label: 'Elegant' },
  { code: 'sporty', label: 'Sporty' },
  { code: 'streetwear', label: 'Streetwear' },
  { code: 'minimalist', label: 'Minimalist' },
  { code: 'old_money', label: 'Old money' },
  { code: 'preppy', label: 'Preppy' },
  { code: 'vintage', label: 'Vintage' },
  { code: 'y2k', label: 'Y2K' },
  { code: 'boho', label: 'Boho' },
  { code: 'grunge', label: 'Grunge' },
  { code: 'gorpcore', label: 'Gorpcore' },
  { code: 'business', label: 'Business' },
  { code: 'romantic', label: 'Romantic' },
  { code: 'edgy', label: 'Edgy' },
] as const;

/* ------------------------------------------------------------------ */
/* Page copy                                                           */
/* ------------------------------------------------------------------ */

export const HOW_STEPS = [
  {
    title: 'Photograph your clothes',
    body: 'Snap each piece once. The background is removed and the piece is described for you, so adding a wardrobe takes minutes, not an afternoon.',
  },
  {
    title: 'Say where you are going',
    body: 'Everyday, work, date night or a workout. fitit. checks today’s weather where you are and picks from what is clean and in your closet.',
  },
  {
    title: 'Pick a look and wear it',
    body: 'You get three complete outfits with a short reason for each. See one on a figure, mark it as worn, and it is saved for later.',
  },
] as const;

export const EXTRAS = [
  {
    title: 'Build an outfit yourself',
    body: 'Pick one piece per group and watch the figure update as you go.',
  },
  {
    title: 'Start from one piece',
    body: 'Choose a piece you want to wear and get looks built around it.',
  },
  {
    title: 'Keep what you wore',
    body: 'Mark a look as worn and it is saved, so you can find it again.',
  },
  {
    title: 'In the laundry',
    body: 'Flag a piece as being washed and it is left out of today’s looks.',
  },
] as const;

/** PLACEHOLDER (review): answers describe the app as designed; confirm the privacy answer against the real policy. */
export const FAQ = [
  {
    q: 'Do I have to photograph my whole wardrobe first?',
    a: 'No. Start with the pieces you wear most. fitit. builds outfits from whatever you have added, and you can add more whenever you like.',
  },
  {
    q: 'How does it know the weather?',
    a: 'It checks today’s forecast for your phone’s location, or for a place you choose yourself. The forecast shapes every look, down to whether you need a layer after 3 pm.',
  },
  {
    q: 'Are the outfits made from my own clothes?',
    a: 'Yes. Every look is put together from the pieces in your wardrobe. Pieces you have marked as in the laundry are left out.',
  },
  {
    q: 'What is an AI try-on picture?',
    a: 'A generated picture of a mannequin with your body shape wearing the outfit. It is a preview, so fit and colors can differ a little from the real thing.',
  },
  {
    q: 'How does it find my colors?',
    a: 'You take a selfie in daylight and fitit. suggests a palette: shades to wear more of and a few to wear less of. It leans on them when it picks outfits.',
  },
  {
    q: 'What happens to my photos?',
    a: 'Photos of your clothes are used to cut out and describe each piece, and to make your try-on pictures. You can delete your account in the app. The details are in the Privacy Policy.',
  },
  {
    q: 'Which phones does it work on?',
    a: 'fitit. is made for iPhone and Android.',
  },
] as const;
