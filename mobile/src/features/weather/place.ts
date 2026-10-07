import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { updateProfile, type PlaceMatch, type User } from '@/api/account';
import { weatherKeys } from '@/api/weather';
import { setUser, useSession } from '@/auth/session';
import { findDevicePlace, hasLocationAccess, roundCoordinate, type Place } from '@/lib/location';

/** What came of asking the phone where it is: the place was saved, or the reason it was not. */
export type LocateOutcome = 'saved' | 'denied' | 'unavailable';

/** True when the phone is somewhere else than the profile says. Both are already rounded to a tenth of a degree. */
export const hasMoved = (saved: Pick<Place, 'lat' | 'lon'> | null | undefined, now: Pick<Place, 'lat' | 'lon'>): boolean =>
  !saved || saved.lat !== now.lat || saved.lon !== now.lon;

const saveDevicePlace = async (place: Place): Promise<User> => updateProfile({ location: { source: 'device', name: place.name, lat: place.lat, lon: place.lon } });

/** The forecast depends on the place and on the thermal preference, so a change to either makes the old one wrong. */
export function useRefreshWeather(): () => Promise<void> {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: weatherKeys.all });
}

/** Asks the phone where it is (the system may show its prompt) and keeps the answer as the place of the weather. */
export function useLocate() {
  const refreshWeather = useRefreshWeather();
  return useMutation({
    mutationFn: async (): Promise<LocateOutcome> => {
      const found = await findDevicePlace();
      if (found.kind !== 'found') {
        return found.kind;
      }

      setUser(await saveDevicePlace(found.place));
      return 'saved';
    },
    onSuccess: (outcome) => {
      if (outcome === 'saved') {
        void refreshWeather();
      }
    },
  });
}

/** Saves a city picked from the search as the place of the weather. */
export function useChooseCity() {
  const refreshWeather = useRefreshWeather();
  return useMutation({
    mutationFn: async (city: PlaceMatch) => {
      setUser(await updateProfile({ location: { source: 'manual', name: city.name, lat: roundCoordinate(city.lat), lon: roundCoordinate(city.lon) } }));
    },
    onSuccess: () => void refreshWeather(),
  });
}

/**
 * Keeps the weather where the phone is. When the app opens or comes back to the foreground, a place that was taken
 * from the device is read again, and replaced if the phone has moved. A place typed in by hand is never touched, and
 * nothing is asked of the person: without permission already given, this does nothing.
 */
export function useKeepPlaceCurrent(): void {
  const queryClient = useQueryClient();
  const running = useRef(false);

  useEffect(() => {
    const check = async () => {
      const saved = useSession.getState().user?.location;
      if (running.current || saved?.source !== 'device' || !(await hasLocationAccess())) {
        return;
      }

      running.current = true;
      try {
        const found = await findDevicePlace();
        if (found.kind === 'found' && hasMoved(saved, found.place)) {
          setUser(await saveDevicePlace(found.place));
          await queryClient.invalidateQueries({ queryKey: weatherKeys.all });
        } else {
          // The forecast moves with the hours; one that went stale while the app was away is replaced.
          await queryClient.refetchQueries({ queryKey: weatherKeys.all, type: 'active', stale: true });
        }
      } catch {
        // The place stays as it was; the next time the app comes forward is another chance.
      } finally {
        running.current = false;
      }
    };

    void check();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void check();
      }
    });
    return () => subscription.remove();
  }, [queryClient]);
}
