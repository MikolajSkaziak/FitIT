import * as Location from 'expo-location';

import { findDevicePlace, hasLocationAccess, roundCoordinate } from '@/lib/location';

jest.mock('expo-location', () => ({
  Accuracy: { Low: 2 },
  requestForegroundPermissionsAsync: jest.fn(),
  getForegroundPermissionsAsync: jest.fn(),
  getLastKnownPositionAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  reverseGeocodeAsync: jest.fn(),
}));

const location = jest.mocked(Location);
const at = (latitude: number, longitude: number) => ({ coords: { latitude, longitude }, timestamp: 0 }) as Location.LocationObject;
const allow = (granted: boolean) => location.requestForegroundPermissionsAsync.mockResolvedValue({ granted } as Location.LocationPermissionResponse);

beforeEach(() => {
  jest.resetAllMocks();
  location.getLastKnownPositionAsync.mockResolvedValue(null);
  location.reverseGeocodeAsync.mockResolvedValue([{ city: 'Gliwice' } as Location.LocationGeocodedAddress]);
});

describe('roundCoordinate', () => {
  it.each([
    [50.2945, 50.3],
    [18.6714, 18.7],
    [50.25, 50.3],
    [-0.25, -0.3],
    [-33.8688, -33.9],
    [0.04, 0],
  ])('rounds %p to %p, away from zero like the server', (value, rounded) => {
    expect(roundCoordinate(value)).toBeCloseTo(rounded, 10);
  });
});

describe('findDevicePlace', () => {
  it('says so when the person refuses, without reading the location', async () => {
    allow(false);

    await expect(findDevicePlace()).resolves.toEqual({ kind: 'denied' });
    expect(location.getLastKnownPositionAsync).not.toHaveBeenCalled();
    expect(location.getCurrentPositionAsync).not.toHaveBeenCalled();
  });

  it('returns rounded coordinates and the name of the rounded point', async () => {
    allow(true);
    location.getLastKnownPositionAsync.mockResolvedValue(at(50.2945, 18.6714));

    const found = await findDevicePlace();

    expect(found).toEqual({ kind: 'found', place: { name: 'Gliwice', lat: 50.3, lon: 18.7 } });
    expect(location.reverseGeocodeAsync).toHaveBeenCalledWith({ latitude: 50.3, longitude: 18.7 });
    expect(location.getCurrentPositionAsync).not.toHaveBeenCalled();
  });

  it('asks for a fresh position, at low accuracy, when there is no recent one', async () => {
    allow(true);
    location.getCurrentPositionAsync.mockResolvedValue(at(52.2297, 21.0122));
    location.reverseGeocodeAsync.mockResolvedValue([{ city: 'Warszawa' } as Location.LocationGeocodedAddress]);

    await expect(findDevicePlace()).resolves.toEqual({ kind: 'found', place: { name: 'Warszawa', lat: 52.2, lon: 21 } });
    expect(location.getCurrentPositionAsync).toHaveBeenCalledWith({ accuracy: Location.Accuracy.Low });
  });

  it('falls back to wider names, then to a neutral one, when the place has no city', async () => {
    allow(true);
    location.getLastKnownPositionAsync.mockResolvedValue(at(49.3, 19.9));
    location.reverseGeocodeAsync.mockResolvedValueOnce([{ city: null, district: null, subregion: 'powiat tatrzański' } as Location.LocationGeocodedAddress]);
    await expect(findDevicePlace()).resolves.toMatchObject({ place: { name: 'powiat tatrzański' } });

    location.reverseGeocodeAsync.mockResolvedValueOnce([]);
    await expect(findDevicePlace()).resolves.toMatchObject({ place: { name: 'Twoja okolica' } });

    location.reverseGeocodeAsync.mockRejectedValueOnce(new Error('no geocoder'));
    await expect(findDevicePlace()).resolves.toMatchObject({ kind: 'found', place: { name: 'Twoja okolica', lat: 49.3, lon: 19.9 } });
  });

  it('keeps the name within what the server stores', async () => {
    allow(true);
    location.getLastKnownPositionAsync.mockResolvedValue(at(50, 19));
    location.reverseGeocodeAsync.mockResolvedValue([{ city: 'x'.repeat(200) } as Location.LocationGeocodedAddress]);

    const found = await findDevicePlace();

    expect(found.kind === 'found' && found.place.name).toHaveLength(80);
  });

  it('reports the location as unavailable when the phone cannot say where it is', async () => {
    allow(true);
    location.getCurrentPositionAsync.mockRejectedValue(new Error('Location services are disabled'));

    await expect(findDevicePlace()).resolves.toEqual({ kind: 'unavailable' });
  });

  it('gives up after fifteen seconds instead of waiting forever', async () => {
    jest.useFakeTimers();
    try {
      allow(true);
      location.getCurrentPositionAsync.mockReturnValue(new Promise(() => {}));

      const pending = findDevicePlace();
      await jest.advanceTimersByTimeAsync(15_000);

      await expect(pending).resolves.toEqual({ kind: 'unavailable' });
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('hasLocationAccess', () => {
  it('reads the permission without prompting', async () => {
    location.getForegroundPermissionsAsync.mockResolvedValue({ granted: true } as Location.LocationPermissionResponse);
    await expect(hasLocationAccess()).resolves.toBe(true);

    location.getForegroundPermissionsAsync.mockRejectedValue(new Error('unavailable'));
    await expect(hasLocationAccess()).resolves.toBe(false);
    expect(location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
  });
});
