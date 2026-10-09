# Dostawcy AI: Google Gemini i fal.ai

Każda usługa zewnętrzna ma w kodzie port i dwie implementacje: atrapę (`Fake`) i prawdziwy adapter. O tym, która działa, decyduje konfiguracja `Providers:*`. W repozytorium wszystko jest ustawione na `Fake`, więc testy i świeży klon nie potrzebują żadnego klucza.

| Port | Ustawienie | Prawdziwy dostawca | Co wysyłamy |
|---|---|---|---|
| Opis ubrania | `Providers:GarmentTagger = Gemini` | Google Gemini | wycinek ubrania |
| Dobór zestawów | `Providers:OutfitStylist = Gemini` | Google Gemini | opisy ubrań, pogoda, okazja, notatka, style, kolory z palety, ocenione zestawy |
| Wskazówki do zestawu | `Providers:OutfitCritic = Gemini` | Google Gemini | opisy i nazwy ubrań z zestawu, okazja, pogoda bez miejscowości |
| Analiza kolorów | `Providers:ColorAnalyst = Gemini` | Google Gemini | selfie (ankieta nie opuszcza serwera) |
| Usuwanie tła | `Providers:BackgroundRemover = Fal` | fal.ai, `fal-ai/birefnet/v2` | zdjęcie ubrania |
| Obraz na sylwetce | `Providers:OutfitVisualizer = Fal` | fal.ai, `fal-ai/nano-banana-2/edit` | obraz sylwetki, wycinki ubrań, prompt z opisów |

## Klucze

Klucze są czytane wyłącznie z konfiguracji: `Gemini:ApiKey` i `Fal:ApiKey`. Nie ma ich i nie może być w kodzie, w `appsettings*.json`, w testach, w dokumentach ani w `.env.example`.

Na komputerze programisty: user secrets projektu API (plik leży poza repozytorium, w katalogu domowym).

```bash
cd backend/src/FitIt.Api
dotnet user-secrets set "Gemini:ApiKey" "<klucz z Google AI Studio>"
dotnet user-secrets set "Fal:ApiKey" "<klucz z fal.ai>"
```

Na serwerze: zmienne środowiskowe `Gemini__ApiKey` i `Fal__ApiKey`. W `deploy/compose.yml` biorą się z `GEMINI_API_KEY` i `FAL_API_KEY` w pliku env trzymanym poza repozytorium.

Nie uruchamiaj `dotnet user-secrets list` przy kimś ani w nagrywanej sesji: wypisuje klucze jawnie.

## Włączanie i wyłączanie

Każdy port przełącza się osobno, też w user secrets (albo zmienną `Providers__GarmentTagger` itd.):

```bash
dotnet user-secrets set "Providers:GarmentTagger" "Gemini"
dotnet user-secrets set "Providers:OutfitStylist" "Gemini"
dotnet user-secrets set "Providers:OutfitCritic" "Gemini"
dotnet user-secrets set "Providers:ColorAnalyst" "Gemini"
dotnet user-secrets set "Providers:BackgroundRemover" "Fal"
dotnet user-secrets set "Providers:OutfitVisualizer" "Fal"
```

Wyłączenie: `dotnet user-secrets remove "Providers:GarmentTagger"` (wraca `Fake` z `appsettings.json`). Po zmianie trzeba uruchomić API ponownie.

Gdy port jest ustawiony na `Gemini` albo `Fal`, a klucza nie ma, API nie wystartuje i powie, którego klucza brakuje. Nieznana nazwa dostawcy też zatrzymuje start.

## Co chroni klucze

- Klucz Gemini idzie tylko w nagłówku `x-goog-api-key`, klucz fal.ai tylko w nagłówku `Authorization` żądań do `queue.fal.run`. Nigdy w adresie, nigdy do hosta, z którego pobieramy gotowy obraz.
- Klienci HTTP obu dostawców nie piszą nic do logów (`RemoveAllLoggers`), a gdyby logowanie kiedyś wróciło, oba nagłówki są zamazywane.
- Komunikaty błędów adapterów zawierają najwyżej kod HTTP i jednowyrazowy status dostawcy. Nie powtarzają treści odpowiedzi, adresów ani wyjątków sieciowych.
- Test `ProviderSecretsTests` przeszukuje wszystkie pliki repozytorium (śledzone i nowe, bez ignorowanych) pod kątem kształtów prawdziwych kluczy (Google `AIza…` i `AQ.…`, fal `uuid:hex`, kilka innych) i nie przejdzie, jeśli coś takiego znajdzie.

## Ustawienia Gemini (`Gemini:*`)

| Ustawienie | Domyślnie | Znaczenie |
|---|---|---|
| `Model` | `gemini-3.8-flash` | model główny |
| `FallbackModel` | `gemini-flash-lite-latest` | model zapasowy; pusty = brak |
| `AttemptTimeoutSeconds` | 20 | czas na jedną próbę; model, który milczy, od razu ustępuje zapasowemu |
| `TimeoutSeconds` | 60 | czas na całe pytanie ze wszystkimi próbami |
| `MaxRetries`, `RetryBaseDelayMs` | 2, 800 | ponowienia po 429/500/502/503/504, z rosnącą przerwą; potem model zapasowy |
| `ThinkingLevel` | pusty | `minimal`/`low`/`medium`/`high`; pusty = domyślny modelu |
| `InputUsdPerMillionTokens`, `OutputUsdPerMillionTokens` | 0.75, 3.75 | cennik modelu głównego |
| `FallbackInputUsdPerMillionTokens`, `FallbackOutputUsdPerMillionTokens` | 0.30, 2.50 | cennik modelu zapasowego |

Odpowiedzi przychodzą w trybie JSON ze schematem zbudowanym ze słowników aplikacji (lista stylów, typów, kolorów bierze się z kodu w chwili pytania). Wszystko spoza słowników jest odrzucane. Gdy Gemini zawiedzie: ubranie zostaje i czeka na ręczny opis, zestawy i wskazówki układają reguły, analiza kolorów proponuje ankietę.

Ceny pochodzą z cennika Google z 2026-10-09. Cena `gemini-3.8-flash` jest promocyjna do końca 2026 r.; od 2027-01-01 cennik podaje 1.50 i 7.50, wtedy trzeba zmienić ustawienia. Cena modelu zapasowego to cena Flash-Lite 3.5 (alias `-latest` może z czasem wskazywać inny model).

## Ustawienia fal.ai (`Fal:*`)

| Ustawienie | Domyślnie | Znaczenie |
|---|---|---|
| `BackgroundRemovalEndpoint` | `fal-ai/birefnet/v2` | usuwanie tła |
| `TryOnEndpoint` | `fal-ai/nano-banana-2/edit` | obraz na sylwetce |
| `AspectRatio`, `Resolution` | `3:4`, `1K` | format obrazu na sylwetce |
| `TryOnUsdPerImage` | 0.08 | cena jednego obrazu |
| `BackgroundRemovalUsdPerImage` | 0.005 | szacunek; fal liczy usuwanie tła za czas obliczeń |
| `BackgroundRemovalTimeoutSeconds`, `PollIntervalMs` | 60, 1000 | czekanie na wycinek |
| `SendSignedUrls` | false | false: obrazy idą w treści żądania (działa z magazynem na localhost); true: fal pobiera podpisane adresy (wymaga magazynu widocznego z internetu, czyli R2) |
| `DisablePayloadStorage` | false | wysyła `X-Fal-Store-IO: 0`; włączyć po sprawdzeniu z prawdziwym kluczem |

Czekanie na obraz na sylwetce ustawia `Visualization:*` (co ile sekund pytamy, po ilu rezygnujemy). Wynik zawsze pobieramy do własnego magazynu. Blokada filtra treści kończy zamówienie stanem „zablokowane” i zwraca limit.

## Orientacyjny koszt jednej operacji

| Operacja | Koszt | Skąd |
|---|---|---|
| Opis ubrania | ok. 0.001 do 0.003 USD | tokeny (pomiar: 0.0009 USD na modelu zapasowym) |
| Trzy propozycje zestawów | ok. 0.002 do 0.006 USD | tokeny (pomiar: 0.0015 USD na modelu zapasowym; drugie pytanie po odrzuceniu podwaja koszt) |
| Wskazówki do zestawu | ok. 0.001 do 0.002 USD | tokeny, szacunek |
| Analiza kolorów ze zdjęcia | ok. 0.001 do 0.003 USD | tokeny, szacunek |
| Usuwanie tła | ok. 0.005 USD | szacunek stały |
| Obraz na sylwetce | 0.08 USD | cena za obraz w 1K |

Każde wywołanie trafia do dziennika kosztów z tą kwotą. Po przekroczeniu `Limits:AiBudgetUsdPerDay` (domyślnie 10 USD dziennie dla wszystkich razem) płatne wywołania ustają do następnego dnia.

## Sprawdzenie na żywo

Nie jest częścią `dotnet test`. Zużywa 2 do 4 prawdziwych wywołań Gemini.

```bash
cd backend
dotnet run --project tools/FitIt.ProviderCheck -- src/FitIt.Api/wwwroot/starter/black_jeans.png all
```

Drugi argument: `tagger`, `stylist` albo `all`. Narzędzie czyta klucz tak samo jak API i nigdy go nie wypisuje. Dla fal.ai nie ma jeszcze sprawdzenia na żywo (brak klucza); adaptery fal.ai są pokryte testami kontraktowymi.

## Uwaga o bezpłatnym poziomie Gemini

Według cennika Google treści wysyłane w bezpłatnym poziomie są używane do ulepszania produktów Google; w płatnym nie. Zanim z aplikacji skorzysta ktokolwiek poza autorem, klucz powinien pochodzić z projektu z włączonym rozliczeniem.
