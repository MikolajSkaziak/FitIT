import type { User } from '@/api/account';
import type { Outfit, OutfitItem } from '@/api/outfits';
import type { Clothing, Category, Dictionaries } from '@/api/wardrobe';
import type { Weather } from '@/api/weather';

/** A ready garment, which is what an outfit is made of. */
export const clothing = (id: string, name: string, category: Category, change: Partial<Clothing> = {}): Clothing => ({
  id,
  status: 'ready',
  name,
  category,
  group: null,
  subcategory: null,
  colors: ['navy'],
  pattern: 'plain',
  material: 'cotton',
  formality: 3,
  warmth: 2,
  rainOk: false,
  styles: [],
  seasons: ['spring', 'summer'],
  inLaundry: false,
  rarelyWorn: false,
  isForgotten: false,
  wearCount: 0,
  lastWornOn: null,
  rejectReason: null,
  imageUrl: `https://images.test/${id}.png`,
  imageKey: id,
  createdAt: '2026-10-02T08:00:00Z',
  ...change,
});

export const fourItems: OutfitItem[] = [
  { slot: 'top', clothing: clothing('g1', 'Navy shirt', 'top') },
  { slot: 'outerwear', clothing: clothing('g2', 'Gray coat', 'outerwear') },
  { slot: 'bottom', clothing: clothing('g3', 'Beige chinos', 'bottom') },
  { slot: 'shoes', clothing: clothing('g4', 'White sneakers', 'shoes') },
];

export const outfit = (id: string, change: Partial<Outfit> = {}): Outfit => ({
  id,
  requestId: 'request-1',
  occasion: 'everyday',
  occasionNote: null,
  name: null,
  kind: 'sure_bet',
  score: 90,
  reasoning: `Reasoning for outfit ${id}.`,
  weatherNote: 'Morning 7°C, afternoon 18°C.',
  umbrella: false,
  relaxations: [],
  source: 'model',
  rating: 'none',
  isSaved: false,
  wornOn: null,
  visualization: null,
  weather: {
    place: 'Gliwice',
    forTomorrow: false,
    from: '2026-10-05T09:00:00+02:00',
    to: '2026-10-05T22:00:00+02:00',
    feelsMin: 7,
    feelsMax: 18,
    sky: 'sun',
    rain: false,
    rainProbability: 5,
    needsLayers: true,
    band: 'mild',
  },
  items: fourItems,
  createdAt: '2026-10-05T09:30:00Z',
  ...change,
});

export const weather: Weather = {
  place: 'Gliwice',
  forTomorrow: false,
  from: '2026-10-05T09:00:00+02:00',
  to: '2026-10-05T22:00:00+02:00',
  feelsMin: 7,
  feelsMax: 18,
  coldestAt: '2026-10-05T09:00:00+02:00',
  warmestAt: '2026-10-05T15:00:00+02:00',
  sky: 'sun',
  rain: false,
  rainProbability: 5,
  rainFrom: null,
  needsLayers: true,
  band: 'mild',
  hours: [
    { time: '2026-10-05T09:00:00+02:00', feels: 7, sky: 'sun' },
    { time: '2026-10-05T13:00:00+02:00', feels: 16, sky: 'sun' },
    { time: '2026-10-05T18:00:00+02:00', feels: 14, sky: 'rain' },
    { time: '2026-10-05T22:00:00+02:00', feels: 9, sky: 'cloud' },
  ],
};


/** What the color analysis answers: a type with its two palettes. */
export const colorAnalysis = {
  season: 'soft_autumn' as const,
  name: 'Soft autumn',
  summary: 'Your coloring is warm-leaning and muted, with gentle contrast. Earthy, softened colors suit you best, while stark or icy shades look harsh.',
  source: 'quiz' as const,
  best: [
    { name: 'Sage green', hex: '#A3B18A', wardrobeColor: 'green' as const },
    { name: 'Warm taupe', hex: '#A68F7D', wardrobeColor: 'beige' as const },
    { name: 'Terracotta', hex: '#C4745A', wardrobeColor: null },
    { name: 'Muted teal', hex: '#5E8C87', wardrobeColor: null },
    { name: 'Soft olive', hex: '#8A8F5A', wardrobeColor: 'olive' as const },
    { name: 'Cream', hex: '#F1E6D0', wardrobeColor: 'cream' as const },
    { name: 'Dusty rose', hex: '#C99A8E', wardrobeColor: null },
  ],
  soften: [
    { name: 'Black', hex: '#1C1F1E', wardrobeColor: 'black' as const },
    { name: 'Icy blue', hex: '#BFE3F2', wardrobeColor: 'light_blue' as const },
    { name: 'Hot pink', hex: '#E0488A', wardrobeColor: 'pink' as const },
    { name: 'Pure white', hex: '#FFFFFF', wardrobeColor: 'white' as const },
  ],
  analyzedAt: '2026-10-09T08:00:00Z',
};

/** The signed-in person, with the place the weather is for. */
export const user = (change: Partial<User> = {}): User => ({
  id: 'u1',
  email: 'ola@example.com',
  displayName: 'Ola',
  birthDate: '1999-03-14',
  gender: 'female',
  avatar: { id: 'a1', gender: 'female', bodyType: 'hourglass', label: 'Hourglass', imageUrl: 'https://images.test/a1.jpg', thumbUrl: 'https://images.test/a1-thumb.jpg', figureUrl: 'https://images.test/a1-figure.png' },
  styles: ['casual'],
  thermalPreference: 'normal',
  clothingSize: null,
  legLength: null,
  location: { source: 'device', name: 'Gliwice', lat: 50.3, lon: 18.7 },
  aiConsentAt: '2026-10-02T08:00:00Z',
  colorAnalysis: null,
  onboardingStep: 2,
  onboardingDoneAt: '2026-10-02T09:00:00Z',
  createdAt: '2026-10-01T08:00:00Z',
  ...change,
});

/** The closed lists of the server, cut down to what the wardrobe tests need. */
export const wardrobeDictionaries = {
  categories: [
    { code: 'top', label: 'Tops', types: [{ code: 'shirt', label: 'Shirt' }] },
    { code: 'mid_layer', label: 'Warm layers', types: [{ code: 'hoodie', label: 'Hoodie' }, { code: 'blazer', label: 'Blazer' }] },
    { code: 'bottom', label: 'Bottoms', types: [{ code: 'jeans', label: 'Jeans' }] },
  ],
  groups: [
    { code: 'shirts_and_blouses', label: 'Shirts and blouses', types: [{ code: 'shirt', label: 'Shirt' }] },
    { code: 'sweaters_and_hoodies', label: 'Sweaters and hoodies', types: [{ code: 'hoodie', label: 'Hoodie' }] },
    { code: 'jeans', label: 'Jeans', types: [{ code: 'jeans', label: 'Jeans' }] },
    {
      code: 'pants',
      label: 'Pants',
      types: [
        { code: 'trousers', label: 'Trousers' },
        { code: 'chinos', label: 'Chinos' },
      ],
    },
    { code: 'suits_and_blazers', label: 'Suits and blazers', types: [{ code: 'blazer', label: 'Blazer' }] },
  ],
  colors: [
    { code: 'white', label: 'white', neutral: true, hex: '#FFFFFF' },
    { code: 'navy', label: 'navy', neutral: true, hex: '#1F2A44' },
    { code: 'light_blue', label: 'light blue', neutral: false, hex: '#9CC6EB' },
  ],
  patterns: [{ code: 'plain', label: 'plain' }],
  materials: [
    { code: 'cotton', label: 'cotton' },
    { code: 'wool', label: 'wool' },
  ],
  seasons: [
    { code: 'spring', label: 'Spring' },
    { code: 'summer', label: 'Summer' },
    { code: 'fall', label: 'Fall' },
    { code: 'winter', label: 'Winter' },
  ],
  styles: [],
  formality: [{ value: 3, label: 'smart casual' }],
  warmth: [{ value: 2, label: 'light' }],
} as unknown as Dictionaries;
