import * as Location from 'expo-location';

/** A place for the weather forecast: a name to show and coordinates rounded to a tenth of a degree. */
export interface Place {
  name: string;
  lat: number;
  lon: number;
}

export type DevicePlace =
  | { kind: 'found'; place: Place }
  /** The person said no to the system prompt (or had said no before). */
  | { kind: 'denied' }
  /** Allowed, but the phone could not say where it is: location switched off, no signal, or it took too long. */
  | { kind: 'unavailable' };

export const nameMaxLength = 80;
const fallbackName = 'Twoja okolica';
const positionTimeoutMs = 15_000;
const lastKnownMaxAgeMs = 30 * 60_000;

/**
 * Rounds to 0.1 of a degree (about 11 km), away from zero like the server does.
 * Exact coordinates never leave the phone: this is enough for a forecast and too coarse to find a person.
 */
export const roundCoordinate = (value: number): number => (Math.sign(value) * Math.round(Math.abs(value) * 10)) / 10;

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}

async function nameOf(lat: number, lon: number): Promise<string> {
  try {
    const [address] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
    const name = address?.city ?? address?.district ?? address?.subregion ?? address?.region;
    return name ? name.slice(0, nameMaxLength) : fallbackName;
  } catch {
    return fallbackName;
  }
}

/** True when the app may read the location without showing a system prompt. */
export async function hasLocationAccess(): Promise<boolean> {
  try {
    return (await Location.getForegroundPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

/**
 * Asks for the location (the system shows its prompt the first time) and turns it into a place for the forecast.
 * Low accuracy on purpose: it is quicker, lighter on the battery, and the result is rounded anyway.
 */
export async function findDevicePlace(): Promise<DevicePlace> {
  let granted: boolean;
  try {
    granted = (await Location.requestForegroundPermissionsAsync()).granted;
  } catch {
    return { kind: 'unavailable' };
  }

  if (!granted) {
    return { kind: 'denied' };
  }

  try {
    const position =
      (await Location.getLastKnownPositionAsync({ maxAge: lastKnownMaxAgeMs })) ??
      (await withTimeout(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }), positionTimeoutMs));
    const lat = roundCoordinate(position.coords.latitude);
    const lon = roundCoordinate(position.coords.longitude);
    // The name is looked up for the rounded point, so it matches the place the forecast is really for.
    return { kind: 'found', place: { name: await nameOf(lat, lon), lat, lon } };
  } catch {
    return { kind: 'unavailable' };
  }
}
