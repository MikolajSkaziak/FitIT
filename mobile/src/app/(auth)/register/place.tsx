import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { PlaceMatch, ThermalPreference } from '@/api/account';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { LinkText, OptionTile } from '@/components/controls';
import { Fade } from '@/components/motion';
import { PlaceSearch } from '@/components/PlaceSearch';
import { useRegistrationDraft, type WeatherPlace } from '@/features/registration/draft';
import { ThermalPicker } from '@/features/profile/ThermalPicker';
import { PlaceChoice } from '@/features/registration/PlaceChoice';
import { WizardStep } from '@/features/registration/WizardStep';
import { LocationProblem } from '@/features/weather/LocationProblem';
import { findDevicePlace, roundCoordinate, type Place } from '@/lib/location';
import { space } from '@/theme';

type Method = 'device' | 'city';
type Device = { status: 'idle' | 'locating' | 'denied' | 'unavailable' } | { status: 'found'; place: Place };

/**
 * The fourth step: where the weather is checked. The phone's location is offered first; a city can be searched instead,
 * or the step skipped. Once a place is known a second, optional part appears under it: how the person usually feels the
 * temperature, as the compact thermal picker (a small picture beside the sentence, so the step still fits one screen)
 * with "About average" already chosen. Nothing has to be decided: Continue sends what is shown.
 */
export default function RegisterPlace() {
  const router = useRouter();
  const setDraft = useRegistrationDraft((draft) => draft.set);
  const gender = useRegistrationDraft((draft) => draft.gender);
  const [thermal, setThermal] = useState<ThermalPreference>(useRegistrationDraft.getState().thermalPreference);
  const [method, setMethod] = useState<Method | null>(null);
  const [device, setDevice] = useState<Device>({ status: 'idle' });
  const [city, setCity] = useState<PlaceMatch | null>(null);
  const [focusSearch, setFocusSearch] = useState(false);

  const place: WeatherPlace =
    method === 'device' && device.status === 'found'
      ? { ...device.place, source: 'device' }
      : method === 'city' && city
        ? { source: 'manual', name: city.name, lat: roundCoordinate(city.lat), lon: roundCoordinate(city.lon) }
        : null;

  const go = (chosen: WeatherPlace) => {
    setDraft({ place: chosen, thermalPreference: thermal });
    router.push('/register/look');
  };

  const pickDevice = async () => {
    setMethod('device');
    if (device.status === 'found' || device.status === 'locating') {
      return;
    }

    setDevice({ status: 'locating' });
    const found = await findDevicePlace();
    if (found.kind === 'found') {
      // The place is known: the question about the cold appears under it, and Continue moves on.
      setDevice({ status: 'found', place: found.place });
    } else {
      // No is a fine answer: the city search takes over right here, with the reason above it.
      setDevice({ status: found.kind });
      setFocusSearch(false);
      setMethod('city');
    }
  };

  return (
    <WizardStep
      step="place"
      title={'Where are\nyou?'}
      accent={{ word: 'Where', act: 'drop' }}
      lead="We check the forecast there, so every look suits the day."
      testID="register-place"
      footer={
        <>
          {place ? <Button label="Continue" onPress={() => go(place)} testID="register-next" /> : null}
          <LinkText label="Skip for now" center onPress={() => go(null)} testID="register-skip-place" />
        </>
      }>
      <View style={styles.location}>
        <View accessibilityRole="radiogroup" accessibilityLabel="Where to check the weather">
          <PlaceChoice
            icon="location"
            label="Use my location"
            caption={
              method === 'device' && device.status === 'found' ? (
                <Fade key="found">
                  <AppText variant="caption" color="textSecondary" testID="register-found">
                    {device.place.name}
                  </AppText>
                </Fade>
              ) : null
            }
            selected={method === 'device'}
            onPress={() => void pickDevice()}
            testID="register-use-location"
          />
          <OptionTile
            icon="search"
            label="Search for a city"
            selected={method === 'city'}
            onPress={() => {
              setFocusSearch(true);
              setMethod('city');
            }}
            testID="register-choose-city"
          />
        </View>
        {device.status === 'locating' ? (
          <AppText variant="secondary" color="textSecondary" accessibilityRole="progressbar" accessibilityLabel="Finding your location">
            Finding your location…
          </AppText>
        ) : null}
        <LocationProblem outcome={device.status === 'denied' || device.status === 'unavailable' ? device.status : null} />
        {method === 'city' ? (
          <Fade key="city">
            <PlaceSearch value={city} onChange={setCity} autoFocus={focusSearch} />
          </Fade>
        ) : null}
      </View>
      {place ? (
        <Fade key="thermal" style={styles.thermal}>
          <AppText variant="eyebrow">And how do you usually feel?</AppText>
          <ThermalPicker value={thermal} onChange={setThermal} gender={gender} compact testID="register-thermal" />
        </Fade>
      ) : null}
    </WizardStep>
  );
}

const styles = StyleSheet.create({
  location: { gap: space[3] },
  thermal: { gap: space[2] },
});
