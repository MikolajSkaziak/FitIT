import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { queryKeys, searchPlaces, type PlaceMatch } from '@/api/account';
import { messageFor } from '@/copy/errors';
import { useDebounced } from '@/lib/useDebounced';
import { space } from '@/theme';

import { AppText } from './AppText';
import { Field } from './Field';
import { Card, Row, Skeleton } from './lists';

const minimumLength = 2;

/** "Śląskie, Polska": what tells two places of the same name apart. */
export const placeDetail = (place: Pick<PlaceMatch, 'region' | 'country'>): string => [place.region, place.country].filter(Boolean).join(', ');

interface PlaceSearchProps {
  value: PlaceMatch | null;
  onChange: (place: PlaceMatch | null) => void;
  /** Shown under the field when nothing has been picked and the form was sent. */
  error?: string | null;
  initialText?: string;
}

/** A city field: type a few letters, pick the place from the matches below. */
export function PlaceSearch({ value, onChange, error, initialText = '' }: PlaceSearchProps) {
  const [text, setText] = useState(value?.name ?? initialText);
  const query = useDebounced(text.trim(), 300);
  const searching = !value && query.length >= minimumLength;
  const matches = useQuery({
    queryKey: queryKeys.places(query),
    queryFn: ({ signal }) => searchPlaces(query, signal),
    enabled: searching,
    staleTime: 5 * 60_000,
  });

  return (
    <View style={styles.search}>
      <Field
        label="Miasto"
        value={text}
        onChangeText={(next) => {
          setText(next);
          if (value) {
            onChange(null);
          }
        }}
        error={error}
        helper={value ? placeDetail(value) : 'Wpisz co najmniej dwie litery i wybierz miejscowość z listy.'}
        leadingIcon="search"
        autoCapitalize="words"
        autoCorrect={false}
        autoComplete="off"
        maxLength={80}
        returnKeyType="search"
        testID="place-search"
      />
      {searching ? (
        matches.isPending ? (
          <Card>
            <View style={styles.loading} accessibilityRole="progressbar" accessibilityLabel="Szukamy miejscowości">
              <Skeleton height={16} width="45%" />
              <Skeleton height={12} width="65%" />
            </View>
          </Card>
        ) : matches.isError ? (
          <AppText variant="secondary" color="danger" accessibilityRole="alert">
            {messageFor(matches.error)}
          </AppText>
        ) : matches.data.length === 0 ? (
          <AppText variant="secondary" color="textSecondary">
            Nie znaleźliśmy takiej miejscowości. Sprawdź pisownię albo wpisz większe miasto w pobliżu.
          </AppText>
        ) : (
          <Card>
            {matches.data.map((place, index) => (
              <Row
                key={`${place.name}-${place.lat}-${place.lon}`}
                label={place.name}
                meta={placeDetail(place) || undefined}
                last={index === matches.data.length - 1}
                onPress={() => {
                  setText(place.name);
                  onChange(place);
                }}
                testID={`place-${index}`}
              />
            ))}
          </Card>
        )
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  search: { gap: space[2] },
  loading: { padding: space[4], gap: space[2] },
});
