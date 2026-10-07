import type { User } from '@/api/account';
import type { Outfit, OutfitItem } from '@/api/outfits';
import type { Clothing, Category } from '@/api/wardrobe';
import type { Weather } from '@/api/weather';

/** A ready garment, which is what an outfit is made of. */
export const clothing = (id: string, name: string, category: Category, change: Partial<Clothing> = {}): Clothing => ({
  id,
  status: 'ready',
  name,
  category,
  subcategory: null,
  colors: ['navy'],
  pattern: 'plain',
  material: 'cotton',
  formality: 3,
  warmth: 2,
  rainOk: false,
  styles: [],
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
  { slot: 'top', clothing: clothing('g1', 'Granatowa koszula', 'top') },
  { slot: 'outerwear', clothing: clothing('g2', 'Szary płaszcz', 'outerwear') },
  { slot: 'bottom', clothing: clothing('g3', 'Beżowe chinosy', 'bottom') },
  { slot: 'shoes', clothing: clothing('g4', 'Białe trampki', 'shoes') },
];

export const outfit = (id: string, change: Partial<Outfit> = {}): Outfit => ({
  id,
  requestId: 'request-1',
  occasion: 'everyday',
  occasionNote: null,
  kind: 'sure_bet',
  score: 90,
  reasoning: `Uzasadnienie zestawu ${id}.`,
  weatherNote: 'Rano 7°C, po południu 18°C.',
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
};


/** The signed-in person, with the place the weather is for. */
export const user = (change: Partial<User> = {}): User => ({
  id: 'u1',
  email: 'ola@poczta.pl',
  displayName: 'Ola',
  birthDate: '1999-03-14',
  gender: 'female',
  avatar: { id: 'a1', gender: 'female', bodyType: 'hourglass', label: 'Klepsydra', imageUrl: 'https://images.test/a1.jpg', thumbUrl: 'https://images.test/a1-thumb.jpg' },
  styles: ['casual'],
  thermalPreference: 'normal',
  location: { source: 'device', name: 'Gliwice', lat: 50.3, lon: 18.7 },
  aiConsentAt: '2026-10-02T08:00:00Z',
  createdAt: '2026-10-01T08:00:00Z',
  ...change,
});
