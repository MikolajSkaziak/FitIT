# FitIt — plan działania: od zera do działającego MVP

- **Wersja:** 3.4, 10 października 2026 (zadania 1.4 i 1.14: nowa kolejność rejestracji i onboardingu, konto dopiero po pierwszym zestawie, a po nim sylwetka, rozmiar, kolory i podsumowanie; godziny bez ponownej wyceny)
- **Co budujemy:** [FitIt_Specyfikacja_MVP.md](FitIt_Specyfikacja_MVP.md), wersja 2.5, i makiety w [design/](design/README.md)
- **Dlaczego tak:** [FitIt_Krytyka_Specyfikacji.md](FitIt_Krytyka_Specyfikacji.md)

---

## 1. Cel i założenia

**Problem do rozwiązania:** pełna szafa ubrań, a mimo to „nie mam się w co ubrać”. Każde zadanie w tym planie służy temu, żeby aplikacja układała zestawy z tego, co użytkownik już ma, i sięgała także po rzeczy zapomniane.

**Cel:** działająca aplikacja mobilna FitIt w rękach 10–20 testerów od 26 kwietnia 2027, z policzonymi miarami z sekcji 1 specyfikacji, przed obroną w czerwcu–lipcu 2027.

**Założenia:**

- Jedna osoba, 10–20 godzin tygodniowo. Plan liczy średnio niecałe 14 godzin.
- Dobra znajomość .NET; aplikacja mobilna jest nauką.
- Tylko aplikacja mobilna, na iOS i Androida z jednego kodu Expo. Bez aplikacji webowej i panelu administratora.
- Typ sylwetki jest wybierany przy zakładaniu konta z pięciu gotowych dla podanej płci. Aplikacja nie przyjmuje zdjęć użytkownika.
- Development jest lokalny: baza i backend w Dockerze na Twoim komputerze. Na VM projekt trafia przed pierwszymi testerami, a do użytku komercyjnego w Etapie 6.
- Strona promująca i publiczne wydanie w sklepach to ostatni etap, po becie i obronie.

---

## 2. Mapa drogowa

| Etap | Termin | Tygodnie | Godziny | Kamień milowy |
|---|---|---|---|---|
| 0. Przygotowanie i próby AI | 5–25 X 2026 | 3 | 45 | Wybrane modele, sześć sylwetek, wprawka na telefonie |
| 1. Szkielet | 26 X – 22 XI | 4 | 55 | Konto z wybraną sylwetką założone z telefonu; cały backend wstaje w Dockerze |
| 2. Szafa | 23 XI – 10 I 2027 | 7 | 90 | 20 ubrań dodanych w 10 minut |
| 3. Stylista z pogodą | 11 I – 28 II | 7 | 103 | Trzy propozycje pod pogodę i okazję, w tym odkrycie; pierwsze wdrożenie na VM; wersja u pięciu osób |
| 4. Wizualizacja | 1–28 III | 4 | 55 | Zestaw na sylwetce w kilkadziesiąt sekund |
| 5. Domknięcie i beta | 29 III – 2 V | 5 | 65 | **MVP u 10–20 testerów od 26 IV** |
| Praca pisemna i obrona | 3 V – czerwiec | — | ok. 70 | Złożona praca |
| 6. Strona promująca i publiczne wydanie | po obronie | — | ok. 35 | Aplikacja w sklepach, strona z listą oczekujących |

Do MVP: 413 godzin w 30 tygodni. Harmonogram zakłada mniej pracy w okresie świąt i sesji; terminy sesji i złożenia pracy przyjąłem orientacyjnie.

Jak to się zmienia z tempem:

| Tempo | MVP u testerów |
|---|---|
| 10 godzin tygodniowo | Druga połowa lipca, czyli po obronie. Konieczne cięcia z sekcji 9. |
| ok. 14 godzin tygodniowo | 26 kwietnia, jak w planie |
| 18 godzin tygodniowo | Druga połowa marca |

Plan nie ma osobnego bufora. Jego funkcję pełnią kolejność cięć z sekcji 9 i maj.

---

## 3. Zasady pracy

- **Rytm tygodnia.** Trzy stałe sesje, na przykład dwa wieczory po trzy godziny i jeden blok siedmiu–ośmiu godzin. Długi blok na zadania mobilne, bo tam jest nauka.
- **Najpierw backend.** W każdym etapie zadania są ułożone tak, żeby zaczynać od Twojej mocnej strony, a ekrany budować na gotowym API.
- **Kiedy zadanie jest skończone.** Kod jest na gałęzi głównej, CI przechodzi i warunek z kolumny „Gotowe, gdy” jest spełniony na telefonie albo symulatorze, a nie tylko w testach.
- **Gałęzie.** Jedna gałąź główna i krótkie gałęzie na zadanie, łączone przez pull request. Także przy pracy w pojedynkę: CI pilnuje jakości, a historia przyda się w pracy pisemnej.
- **Środowiska.** Do lutego jedno: lokalne. Telefon łączy się z API na Twoim komputerze przez Wi-Fi. Ten sam obraz API i ten sam plik Compose trafiają na VM tuż przed wersją dla pięciu osób (zadania 3.17 i 3.18). Osobne środowisko produkcyjne, do użytku komercyjnego, powstaje w Etapie 6.
- **Co jest w Dockerze.** PostgreSQL zawsze. API ma Dockerfile od Etapu 1 i wstaje w Compose razem z bazą, ale na co dzień szybciej pracuje się z `dotnet watch`. Aplikacja mobilna nie jest dokeryzowana: Metro musi działać na komputerze, żeby telefon mógł się z nim połączyć. Magazyn plików to od początku osobny bucket deweloperski w R2, a nie lokalny kontener, bo fal.ai i Claude muszą pobrać zdjęcia z publicznego adresu.
- **Sekrety.** Nigdy w repozytorium. Lokalnie `dotnet user-secrets` i plik `.env`, na serwerze plik środowiskowy, w EAS zmienne środowiskowe.
- **Koniec tygodnia.** Działająca wersja na telefonie i trzy zdania w `docs/dziennik.md`: co zrobione, co zmierzone, co zdecydowane.
- **Bramka etapu.** Etap jest zamknięty, gdy spełnia warunki bramki. Przy opóźnieniu większym niż tydzień stosuj kolejność cięć zamiast przesuwać wszystkie kolejne etapy.

---

## 4. Etapy i zadania

Kolumna „Tydz.” to numer tygodnia w obrębie etapu. Numery sekcji w nawiasach odnoszą się do specyfikacji.

### Etap 0 — Przygotowanie i próby AI

5–25 października · 3 tygodnie · 45 h

**Cel:** sprawdzić danymi wszystkie trzy role AI, przygotować sylwetki i oswoić się z Expo, zanim powstanie kod aplikacji.

| Nr | Tydz. | Zadanie | Gotowe, gdy | h |
|---|---|---|---|---|
| 0.1 | 1 | Narzędzia i konta. Na komputerze są już .NET 10 SDK, Node 24, Docker Desktop, Xcode z symulatorami, Rider i VS Code. Do zrobienia: uruchomić Docker Desktop, doinstalować watchman, zainstalować Expo Go na telefonie. Konta: fal.ai, Anthropic, Cloudflare (bucket deweloperski R2), Expo. Miesięczne limity wydatków w panelach fal.ai i Anthropic. | `docker info` odpowiada; klucze API są w menedżerze haseł; limity ustawione | 3 |
| 0.2 | 1 | Repozytorium. Katalogi `backend/`, `mobile/`, `tools/`, `docs/`; dokumenty przeniesione do `docs/`; `fit-it/` przemianowany na `web/`; `.gitignore` w katalogu głównym; plik `global.json` przypinający .NET 10 i `.nvmrc` z wersją Node. | Nowa struktura jest wypchnięta do istniejącego prywatnego repozytorium | 1 |
| 0.3 | 1 | Nauka Expo. Oficjalny samouczek, potem wprawka: lista, wybór zdjęcia z galerii, zmniejszenie, wysłanie pliku do testowego endpointu. | Wprawka działa w Expo Go na Twoim telefonie | 10 |
| 0.4 | 2 | Zestaw testowy. 30 zdjęć własnych ubrań zrobionych tak, jak zrobi je użytkownik: łóżko, wieszak, podłoga, różne światło, kilka trudnych. Arkusz z poprawnymi odpowiedziami: kategoria, kolor, ciepło, formalność. | Folder zdjęć i arkusz | 3 |
| 0.5 | 2 | Słowniki i skale, wersja robocza: kategorie, podkategorie, kolory, wzory, materiały; opisy skal ciepła i formalności z przykładami (5.2). | `docs/slowniki.md` | 2 |
| 0.6 | 2 | Skrypt prób `tools/Spike` jako konsola .NET: klient kolejki fal.ai, klient Claude, zapis wyników do CSV. | Każda próba uruchamia się jednym poleceniem | 6 |
| 0.7 | 2 | Próba tagowania. Usunięcie tła i tagowanie 30 zdjęć na Opus 5.5 i Haiku 4.5. | Tabela: trafność względem arkusza, koszt i czas na zdjęcie; wybrany model | 4 |
| 0.8 | 3 | Próba doboru. 12 kombinacji pogody i okazji, po trzy propozycje, na Opus 5.5 i Haiku 4.5; ręczna ocena. | Tabela: naruszenia reguł, odsetek zestawów do założenia, czas, koszt; pierwsza wersja promptu | 5 |
| 0.9 | 3 | Sylwetki. Wygenerowanie i wybór sześciu postaci według standardu z sekcji 7.3; miniatury. | Sześć obrazów 3:4 i sześć miniatur | 3 |
| 0.10 | 3 | Próba wizualizacji. Dziesięć zestawów × trzy warianty Nano Banana × dwie sylwetki; ubrania jako osobne obrazy i jako jedna plansza. | Tabela: wierność ubrań, zgodność z sylwetką, odsetek blokad, czas; wybrany wariant i szablon zapytania | 6 |
| 0.11 | 3 | Decyzje i promotor. Notatka z wynikami i wyborami; rozmowa o zakresie. | `docs/decyzje/etap-0.md`; zakres potwierdzony | 2 |

**Bramka, 25 października:**

- Tagowanie: kategoria trafna na co najmniej 90% zdjęć, kolor główny na 80%.
- Dobór: co najmniej 70% propozycji nadaje się do założenia.
- Wizualizacja: w co najmniej 7 z 10 prób ubrania są rozpoznawalne; blokady poniżej 10%; czas poniżej minuty.
- Jeśli wizualizacja nie przechodzi: najpierw Nano Banana Pro, potem dedykowany model przymierzania (FASHN, Kling Kolors) ograniczony do góry i dołu.

### Etap 1 — Szkielet od telefonu do bazy

26 października – 22 listopada · 4 tygodnie · 55 h

**Cel:** najcieńsza działająca ścieżka przez wszystkie warstwy, uruchamiana lokalnie w Dockerze: konto z wybraną sylwetką założone z telefonu.

| Nr | Tydz. | Zadanie | Gotowe, gdy | h |
|---|---|---|---|---|
| 1.1 | 1 | Solucja .NET 10: `FitIt.Api`, `FitIt.Core`, `FitIt.Infrastructure`, `FitIt.Tests`; wspólne ustawienia kompilacji i formatowania. | `dotnet build` i `dotnet test` przechodzą | 2 |
| 1.2 | 1 | PostgreSQL w Docker Compose; EF Core; pierwsza migracja. | Baza wstaje jednym poleceniem; migracja przechodzi | 3 |
| 1.3 | 1 | Tabela `avatars` z dziesięcioma sylwetkami (płeć i typ) wgrywanymi przy starcie; obrazy jako publiczne pliki statyczne; publiczny `GET /api/avatars?gender=`. | Endpoint zwraca pięć pozycji dla każdej płci z adresami miniatur | 2 |
| 1.4 | 1 | Identity; rejestracja z imieniem, datą urodzenia, stylami, preferencją termiczną i miejscem pogody (płeć i sylwetka opcjonalne, uzupełniane w pierwszym kroku po rejestracji); logowanie; JWT na 15 minut. | Testy: rejestracja bez płci i sylwetki zakłada konto z sylwetką zastępczą; z sylwetką innej płci albo poniżej 16 lat jest odrzucana; logowanie zwraca token | 6 |
| 1.5 | 1 | Dockerfile API i profil Compose z pełnym stosem (API i PostgreSQL). Ten sam plik posłuży później na VM. | Jedno polecenie `docker compose` stawia działające API z bazą | 3 |
| 1.6 | 2 | Refresh token: rotacja przy każdym użyciu, w bazie tylko skrót; wylogowanie. | Test: zużyty token jest odrzucany | 4 |
| 1.7 | 2 | Fundament API: błędy w formacie ProblemDetails, walidacja wejścia, logi strukturalne, `/health`, dokument OpenAPI, limit żądań na logowaniu. | Dokument OpenAPI jest dostępny; błędna prośba zwraca czytelny błąd | 4 |
| 1.8 | 2 | Profil: `GET` i `PATCH /api/me` (imię, sylwetka). | Test integracyjny | 2 |
| 1.9 | 2 | Hangfire na PostgreSQL z dashboardem tylko dla administratora. | Zadanie testowe wykonuje się i jest widoczne w dashboardzie | 2 |
| 1.10 | 3 | Testy integracyjne ścieżki konta na prawdziwym PostgreSQL (Testcontainers). | Zielone lokalnie | 3 |
| 1.11 | 3 | CI w GitHub Actions: build i testy backendu, budowanie obrazu API; lint i kontrola typów aplikacji. | Zielony przebieg na każdym pull requeście | 2 |
| 1.12 | 3 | Projekt Expo: Expo Router, TypeScript w trybie ścisłym, ESLint, pięć podstawowych komponentów (ekran, tekst, przycisk, pole, kafel). | Uruchamia się w Expo Go i w symulatorze iPhone'a | 5 |
| 1.13 | 3 | Klient API generowany z OpenAPI; TanStack Query; adres API zależny od środowiska (symulator: `localhost`, telefon: adres komputera w sieci lokalnej). | Jedno polecenie odświeża typy po zmianie backendu | 3 |
| 1.14 | 4 | Ekran startowy („Get started”); rejestracja w pięciu krokach przed kontem (style; podstawowe ubrania; miejsce pogody; pierwszy zestaw; konto), logowanie, tokeny w SecureStore, odświeżanie po odpowiedzi 401, wylogowanie. | Sesja przeżywa zamknięcie aplikacji i wygaśnięcie tokenu | 10 |
| 1.15 | 4 | Zakładki Dziś, Szafa, Outfity, Profil; w profilu imię, zmiana sylwetki, wylogowanie. | Zmiana sylwetki zapisuje się w profilu | 3 |
| 1.16 | 4 | Notatki do pracy: architektura i uzasadnienia wyborów. | `docs/decyzje/etap-1.md` | 1 |

**Bramka, 22 listopada:** konto z wybraną sylwetką da się założyć z fizycznego telefonu na API działającym na Twoim komputerze; cały backend wstaje jednym poleceniem `docker compose`; sesja odświeża się sama; CI przechodzi.

### Etap 2 — Szafa

23 listopada 2026 – 10 stycznia 2027 · 7 tygodni, w tym dwa świąteczne lżejsze · 90 h

**Cel:** dodanie kilkunastu ubrań trwa minuty, a tagi są na tyle trafne, że wystarczy je poprawiać.

| Nr | Tydz. | Zadanie | Gotowe, gdy | h |
|---|---|---|---|---|
| 2.1 | 1 | `IImageStorage` dla R2: pre-signed PUT i GET, sprawdzenie pliku, usuwanie, kopiowanie z adresu URL; klucze z prefiksem użytkownika. | Test na buckecie deweloperskim | 5 |
| 2.2 | 1 | `POST /api/uploads` i `POST /api/clothes` z weryfikacją typu i rozmiaru pliku; encja ubrania ze stanami. | Test: zbyt duży plik jest odrzucany | 5 |
| 2.3 | 1 | Liczniki dzienne `usage_counters` jako jedno atomowe polecenie; dziennik `ai_usage_log`; globalny budżet dzienny. | Test: limitu nie da się przekroczyć równoległymi żądaniami | 5 |
| 2.4 | 2 | `IBackgroundRemover` na fal.ai: zlecenie do kolejki, odpytywanie, kopiowanie wycinka do magazynu. | Pięć zdjęć testowych daje poprawne wycinki | 5 |
| 2.5 | 2 | `IGarmentTagger` na Claude: zapytanie z opisami skal, odpowiedź w schemacie JSON, mapowanie na słowniki, odrzucanie nieobsługiwanych zdjęć (5.3). | 30 zdjęć testowych: trafność jak w Etapie 0 | 7 |
| 2.6 | 2 | Zadanie cykliczne usuwające pliki bez rekordu starsze niż dobę. | Test | 2 |
| 2.7 | 3 | Zadanie przetwarzania: tło → tagowanie → `Ready`; ponowienia; idempotencja; `Failed`; ponowne przetworzenie na żądanie. | Testy na atrapach: sukces, błąd tła, błąd tagowania, ponowione zadanie | 6 |
| 2.8 | 3 | Lista z filtrem i podpisanymi adresami, szczegóły, edycja tagów, usuwanie rekordu i plików, „w praniu” i „rzadko noszę”. | Testy integracyjne, w tym próba dostępu do cudzego ubrania | 6 |
| 2.9 | 3 | Zgoda na AI: pole w profilu, blokada wysyłki bez zgody po stronie backendu, ekran zgody w aplikacji. | Bez zgody `POST /api/uploads` odmawia | 3 |
| 2.10 | 4 | Wybór zdjęć: aparat i galeria, wiele naraz, uprawnienia, zmniejszanie do 1280 px. | Zdjęcie po zmniejszeniu ma poniżej 400 kB | 6 |
| 2.11 | 4 | Kolejka wysyłania: pre-signed PUT, postęp, ponawianie po błędzie sieci. | 20 zdjęć wysłanych jedną akcją | 9 |
| 2.12 | 5–6 | Ekran szafy: siatka z pamięcią obrazów po kluczu obiektu, filtr kategorii, pozycje „w trakcie” i „błąd”, odpytywanie tylko podczas przetwarzania. | Nowe ubranie przechodzi z „w trakcie” w gotowe bez ręcznego odświeżania | 9 |
| 2.13 | 5–6 | Stany brzegowe: pusta szafa z licznikiem do pierwszego zestawu, brak sieci, odrzucone zdjęcie. | Każdy stan da się wywołać i wygląda poprawnie | 5 |
| 2.14 | 7 | Ekran ubrania: wycinek, edycja tagów z list wyboru, „w praniu”, „rzadko noszę”, usuwanie, ponowienie przetwarzania. | Zmiana tagu jest widoczna po ponownym otwarciu | 9 |
| 2.15 | 7 | Próba na telefonie: 20 ubrań przez sieć komórkową, z lokalnym API wystawionym tunelem (np. cloudflared); poprawki. | Czas i liczba poprawionych tagów zapisane w notatce | 4 |
| 2.16 | 7 | Notatki do pracy: przepływ wysyłki, trafność tagowania, koszt na ubranie. | `docs/decyzje/etap-2.md` | 4 |

**Bramka, 10 stycznia:** 20 ubrań da się dodać w 10 minut przez sieć komórkową; kategoria jest trafna na co najmniej 90% zdjęć, a kolor główny na 80%; usunięcie ubrania usuwa oba pliki; awaria dostawcy AI nie blokuje dodawania.

### Etap 3 — Stylista z pogodą

11 stycznia – 28 lutego · 7 tygodni · 103 h

**Cel:** trzy sensowne propozycje pod dzisiejszą pogodę i wybraną okazję, z których jedna sięga po zapomniane ubranie; wersja u pierwszych pięciu osób.

| Nr | Tydz. | Zadanie | Gotowe, gdy | h |
|---|---|---|---|---|
| 3.1 | 1 | `IWeatherProvider` dla Open-Meteo: prognoza godzinowa, wyszukiwanie miasta, pamięć podręczna na godzinę, zachowanie przy braku danych. | Test na nagranej odpowiedzi | 5 |
| 3.2 | 1 | Profil pogody: okno czasu, temperatura odczuwalna, deszcz, amplituda, korekta termiczna, przedziały z konfiguracji (6.2). | Testy jednostkowe wszystkich przedziałów i ich granic | 5 |
| 3.3 | 1 | Walidator zestawu: twarde reguły (6.6). | Test jednostkowy dla każdej reguły | 5 |
| 3.4 | 2 | Okazje i filtr kandydatów z luzowaniem reguł; odpowiedź „brakuje w szafie”; do 12 kandydatów na rolę, po połowie lubianych i zapomnianych (6.3, 6.4). | Testy: mała szafa, pusta rola, każde poluzowanie, mieszanka kandydatów | 9 |
| 3.5 | 2 | Funkcja oceny spójności (6.6). | Test jednostkowy każdego kryterium | 4 |
| 3.6 | 3 | Generator regułowy jako tryb awaryjny (6.7). | Test: zwraca poprawne zestawy zawsze, gdy szafa na to pozwala | 3 |
| 3.7 | 3 | `IOutfitStylist` na Claude: prompt systemowy w repozytorium, kontekst z aliasami ubrań, trzy typy propozycji (pewniak, odkrycie, nowe połączenie), odpowiedź w schemacie JSON, ponowienie z listą błędów, obsługa odmowy i limitu czasu (6.1, 6.5). | Test na atrapie i próba na żywo z własną szafą | 9 |
| 3.8 | 4 | `POST /api/outfits/suggestions`: spięcie kroków, zapis trzech propozycji z migawką pogody, licznik próśb, dziennik kosztów. | Test integracyjny pełnej ścieżki, także z wyłączonym modelem | 5 |
| 3.9 | 4 | Zestawy: lista zapisanych, szczegóły, zapis, ocena, „Zakładam to” z licznikami noszenia ubrań, usuwanie; wykorzystanie szafy (`GET /api/clothes/stats`); `GET /api/weather/today`; miasto i preferencja termiczna w profilu. | Testy integracyjne | 6 |
| 3.10 | 4 | `FitIt.Eval`: macierz scenariuszy i raport (6.9). | Raport: zero naruszeń twardych reguł | 5 |
| 3.11 | 5 | Ekran „Dziś”: pogoda, kafle okazji, notatka, „Zaproponuj”, stan oczekiwania. | Pogoda zgadza się z prognozą dla wybranego miasta | 6 |
| 3.12 | 5 | Komponent kolażu: układ wycinków według ról. | Wygląda poprawnie dla zestawów od 3 do 7 elementów | 6 |
| 3.13 | 6 | Trzy propozycje do przewijania: etykieta typu, uzasadnienie, notka pogodowa, poluzowane reguły, kciuki, „Zapisz”, „Zakładam to”. | Ocena i „Zakładam to” zapisują się na backendzie | 8 |
| 3.14 | 6 | „Dobierz do tego” z ekranu ubrania; komunikat „brakuje w szafie”. | Każda propozycja zawiera wskazane ubranie | 3 |
| 3.15 | 6 | „Moje outfity”: lista, szczegóły, usuwanie. W Szafie wskaźnik wykorzystania i filtr zapomnianych. | Zapisany zestaw jest na liście po restarcie aplikacji; wskaźnik rośnie po „Zakładam to” | 5 |
| 3.16 | 7 | Miejsce pogody i preferencja termiczna w profilu: lokalizacja telefonu odświeżana przy otwarciu aplikacji, miasto jako wyjście zapasowe; pozostałe limity w profilu. | Zmiana miejsca zmienia pogodę na ekranie „Dziś” | 3 |
| 3.17 | 5 | Serwer i domena: VM, Docker, konto bez uprawnień roota, zapora; DNS. | SSH działa; domena wskazuje na serwer | 3 |
| 3.18 | 7 | Pierwsze wdrożenie na VM: ten sam Compose (API, PostgreSQL) plus Caddy, sekrety w pliku środowiskowym poza repozytorium, nocna kopia bazy z próbnym odtworzeniem. | `/health` odpowiada pod własną domeną przez HTTPS; kopia odtworzona lokalnie | 5 |
| 3.19 | 7 | Pierwszy build testowy w EAS: Android jako plik APK; iOS, jeśli jest konto Apple Developer. | Aplikacja instaluje się z linku na obcym telefonie i łączy się z API na VM | 3 |
| 3.20 | 7 | Wersja dla pięciu osób: krótka instrukcja, zebranie uwag po tygodniu. | Lista uwag | 2 |
| 3.21 | 7 | Notatki do pracy: wyniki ewaluacji, porównanie modelu z samymi regułami. | `docs/decyzje/etap-3.md` | 3 |

Dodane 11 października 2026 (kalendarz zestawów, specyfikacja 6.10), zrobione:

| Nr | Zadanie | Gotowe, gdy |
|---|---|---|
| 3.22 | Kalendarz na backendzie: tabela `calendar_entries` z migracją i uzupełnieniem historii z `worn_on`, `GET/POST/PATCH/DELETE /api/calendar`, `GET /api/outfits/{id}/days`, „Zakładam to” zapisuje wpis na dziś. | Testy integracyjne: limit trzech na dzień, idempotencja, strefy czasowe, kaskady, migracja |
| 3.23 | Pogoda i propozycje dla wybranego dnia: prognoza na 8 dni, `GET /api/weather/day`, `date` w `POST /api/outfits/suggestions`. | Testy: horyzont, okno całego dnia, limit dnia żądania |
| 3.24 | Aplikacja: pasek tygodnia na „Dziś”, widok „Calendar” w „Outfity”, arkusz „Wear it when?” z cofnięciem, „Plan for a day” w szczegółach, propozycjach i podglądzie kreatora. | Testy ekranów; przejście na telefonie zostaje do zrobienia |

**Bramka, 28 lutego:** macierz scenariuszy przechodzi bez naruszeń twardych reguł; mediana odpowiedzi jest poniżej 8 sekund; co najmniej 70% ręcznie ocenionych zestawów nadaje się do założenia; gdy wśród kandydatów jest zapomniane ubranie, jedna z propozycji po nie sięga; z wyłączonym modelem aplikacja dalej zwraca propozycje; wersja jest u pięciu osób.

### Etap 4 — Wizualizacja

1–28 marca · 4 tygodnie · 55 h

**Cel:** wybrany zestaw na sylwetce w kilkadziesiąt sekund, bez podwójnych zleceń i utraconych limitów.

| Nr | Tydz. | Zadanie | Gotowe, gdy | h |
|---|---|---|---|---|
| 4.1 | 1 | `IOutfitVisualizer` na fal.ai (Nano Banana): zapytanie z szablonu i opisów ubrań, lista obrazów (sylwetka i wycinki), zlecenie do kolejki, status, wynik, rozpoznanie blokady filtra (7.4). | Próba na żywo z trzema zestawami | 8 |
| 4.2 | 1 | Encja wizualizacji ze stanami; `POST /api/outfits/{id}/visualizations` z kluczem idempotencji i atomowym licznikiem; `GET /api/visualizations/{id}` (7.5). | Testy: powtórzone żądanie zwraca ten sam rekord; limit dzienny odmawia | 6 |
| 4.3 | 2 | Zadanie w tle: zapis identyfikatora dostawcy przed odpytywaniem, wznawianie po ponowieniu, limit czasu, kopiowanie wyniku do magazynu, zwrot licznika przy niepowodzeniu, dziennik kosztów. | Testy na atrapie: sukces, blokada, błąd, limit czasu, ponowione zadanie | 9 |
| 4.4 | 2 | Nagłówki ograniczające przechowywanie danych u dostawcy; adresy obrazów w odpowiedziach zestawów. | W panelu fal.ai nie ma zapisanych treści żądań | 2 |
| 4.5 | 2 | `FitIt.Eval` rozszerzony o dziesięć wizualizacji: czas, koszt, blokady. | Raport | 3 |
| 4.6 | 3 | „Pokaż na sylwetce”: wysłanie zlecenia, ekran postępu, odpytywanie statusu, wynik obok kolażu, podpis „wizualizacja poglądowa”. | Obraz pojawia się bez wychodzenia z ekranu, a po wyjściu czeka przy zestawie | 9 |
| 4.7 | 3 | Blokada, błąd i wyczerpany limit: komunikaty, ponowienie, licznik pozostałych wizualizacji. | Każdy z trzech przypadków ma czytelny komunikat | 4 |
| 4.8 | 4 | Miniatury obrazów w „Moje outfity”; powiększenie obrazu. | Zapisany zestaw pokazuje miniaturę obrazu | 4 |
| 4.9 | 4 | Próba na telefonie: 15 wizualizacji z własnej szafy; pomiar czasu, ocena, poprawki szablonu zapytania. | Wyniki w notatce | 5 |
| 4.10 | 4 | Aktualizacja u pięciu osób z Etapu 3. | Pięć osób ma nową wersję | 2 |
| 4.11 | 4 | Notatki do pracy: przepływ asynchroniczny, idempotencja, wyniki. | `docs/decyzje/etap-4.md` | 3 |

**Bramka, 28 marca:** mediana czasu jest poniżej 40 sekund; ponowione zadanie i powtórzone żądanie nie tworzą drugiego zlecenia u dostawcy; przy błędzie i blokadzie limit wraca. Wszystkie trzy warunki potwierdzają testy.

### Etap 5 — Domknięcie i beta

29 marca – 2 maja · 5 tygodni · 65 h

**Cel:** aplikacja w rękach obcych ludzi i policzone miary.

| Nr | Tydz. | Zadanie | Gotowe, gdy | h |
|---|---|---|---|---|
| 5.1 | 1 | Usuwanie konta z aplikacji: kaskada w bazie, zadanie usuwające pliki, ekran potwierdzenia. | Test: po usunięciu nie ma rekordów ani plików | 5 |
| 5.2 | 1 | Reset hasła kodem z e-maila wpisywanym w aplikacji: dostawca poczty, dwa endpointy, dwa ekrany. | Pełna ścieżka na telefonie | 7 |
| 5.3 | 2 | Onboarding wokół problemu „pełna szafa, a nie mam się w co ubrać”: trzy ekrany wprowadzenia, wskazówki fotografowania (jedno ubranie na zdjęciu, jasne tło) i prośba o dodanie także kilku rzeczy leżących bez użycia. | Nowa osoba dodaje pierwsze ubrania i oznacza jedno jako „rzadko noszę” bez pomocy | 5 |
| 5.4 | 2 | Polityka prywatności i regulamin jako statyczna strona pod domeną; odnośniki w aplikacji. | Oba dokumenty otwierają się z aplikacji | 4 |
| 5.5 | 2 | Rejestrowanie błędów w aplikacji i na backendzie; powiadomienie o nieudanych zadaniach. | Wymuszony błąd pojawia się w panelu | 3 |
| 5.6 | 3 | Przegląd bezpieczeństwa: dostęp do cudzych zasobów na każdym endpoincie z identyfikatorem, limity żądań, logi bez danych wrażliwych i podpisanych adresów, aktualizacja zależności. | Lista kontrolna odhaczona; brakujące testy dodane | 6 |
| 5.7 | 3 | Dopracowanie interfejsu: spójne odstępy i typografia, stany oczekiwania, pustki i błędu na każdym ekranie, ikona i ekran startowy. | Przegląd każdego ekranu na dwóch telefonach | 10 |
| 5.8 | 4 | Odporność: wolna sieć, tryb samolotowy, szafa ze 100 ubraniami, długie odpowiedzi usług. | Żaden scenariusz nie zawiesza aplikacji | 4 |
| 5.9 | 4 | Buildy do bety: wersjonowanie, Android APK, iOS przez TestFlight (jeśli jest konto), aktualizacje bez nowego builda. | Tester instaluje aplikację z linku | 5 |
| 5.10 | 4 | Zapytania SQL do miar bety i kosztu AI na użytkownika. | Miary liczą się jednym poleceniem | 3 |
| 5.11 | 4 | Rekrutacja 10–20 testerów hasłem „Pełna szafa, a nie masz się w co ubrać?”; instrukcja na jedną stronę, kanał na uwagi, ankieta. | Testerzy mają aplikację do 26 kwietnia | 5 |
| 5.12 | 5 | Pierwszy tydzień bety: obserwacja, poprawki błędów krytycznych. | Brak otwartych błędów krytycznych | 5 |
| 5.13 | 5 | Notatki do pracy: przebieg bety, pierwsze miary. | `docs/decyzje/etap-5.md` | 3 |

**Bramka, 2 maja:** spełniona definicja z sekcji 5.

---

## 5. Definicja ukończonego MVP

MVP jest gotowe, gdy na wdrożonym środowisku prawdziwe są wszystkie punkty:

1. Nowa osoba instaluje aplikację z linku, zakłada konto i wybiera sylwetkę bez pomocy.
2. 20 ubrań da się dodać w 10 minut; kategoria jest trafna na co najmniej 90% zdjęć, a kolor główny na 80%.
3. Prośba o propozycje zwraca trzy zestawy w medianie poniżej 8 sekund; żaden nie łamie twardych reguł; gdy w szafie są zapomniane ubrania, jedna z propozycji po nie sięga; z wyłączonym modelem działa tryb awaryjny.
4. Wizualizacja powstaje w medianie poniżej 40 sekund; nie ma podwójnych zleceń; nieudana zwraca limit.
5. Usunięcie konta usuwa rekordy i pliki.
6. Limity dzienne i globalny budżet AI działają; koszt na użytkownika da się policzyć.
7. Błędy aplikacji i backendu trafiają do rejestru; nie ma znanych błędów krytycznych.
8. Co najmniej 10 testerów korzysta przez tydzień, a miary z sekcji 1 specyfikacji są policzone.

---

## 6. Beta

- **Kto.** 10–20 osób spoza Twojego najbliższego otoczenia, które same o sobie mówią, że mają pełną szafę i nie mają się w co ubrać. Bez podziału na płeć i wiek.
- **Skąd.** Grupy uczelniane, znajomi znajomych, jedna społeczność tematyczna. Zaproszenie to jedno zdanie obietnicy i informacja, że to test.
- **Jak dostają aplikację.** Android: link do pliku APK. iOS: TestFlight, co wymaga konta Apple Developer.
- **Co dostają.** Instrukcję na jedną stronę z zadaniem na pierwszy dzień (dodaj 15 ubrań, w tym kilka rzadko noszonych, poproś o propozycję, pokaż ją na sylwetce) i kanał na uwagi.
- **Co mierzysz.** Miary z sekcji 1 specyfikacji, koszt AI na użytkownika, odsetek zablokowanych i nieudanych wizualizacji, odsetek propozycji z trybu awaryjnego.
- **Ankieta po tygodniu.** Czy propozycje nadawały się do założenia? Czy aplikacja podsunęła Ci coś, czego dawno nie było na Tobie? Co było najbardziej uciążliwe? Czy obraz na sylwetce pomógł w decyzji? Czy chcesz używać tego co tydzień? Ile byłoby to dla Ciebie warte?
- **Rytm.** Przegląd miar i uwag raz w tygodniu. Do końca maja tylko poprawki błędów krytycznych; reszta trafia do Etapu 6.
- **Czas trwania.** Co najmniej dwa tygodnie, najlepiej do końca maja. Miara „aktywni w drugim tygodniu” potrzebuje tego czasu.

---

## 7. Po MVP

### Praca pisemna i obrona (3 maja – czerwiec, ok. 70 h)

Kod jest zamrożony od 2 maja poza poprawkami krytycznymi. Materiał jest już zebrany:

| Rozdział | Źródło |
|---|---|
| Analiza problemu i istniejących rozwiązań | Krytyka specyfikacji, wyniki Etapu 0 |
| Projekt systemu | Specyfikacja MVP |
| Implementacja | `docs/decyzje/etap-1.md` do `etap-4.md` |
| Testy i ewaluacja | Raporty `FitIt.Eval`, trafność tagowania, czasy, koszty |
| Weryfikacja z użytkownikami | Miary i ankieta z bety |

### Etap 6 — Strona promująca i publiczne wydanie (po obronie, ok. 35 h)

- **Poprawki po becie:** trzy najczęstsze uwagi testerów.
- **Strona promująca** na bazie katalogu `web/`: jedna strona z nagłówkiem „Pełna szafa, a nie masz się w co ubrać?”, opisem działania w trzech krokach, prawdziwymi zrzutami ekranu, listą oczekujących albo odznakami sklepów, polityką prywatności i kontaktem.
- **Sklepy:** konta Apple Developer i Google Play, karty aplikacji, deklaracje prywatności, przejście weryfikacji. Google wymaga od nowych kont osobistych zamkniętego testu przed publikacją, więc warto sprawdzić aktualne warunki jeszcze w trakcie bety.
- **Przejście na użytek komercyjny:** umowy powierzenia z dostawcami AI, płatny plan Open-Meteo albo inny dostawca pogody (darmowy plan jest tylko do użytku niekomercyjnego), osobne środowisko produkcyjne.
- **Model płatności:** według sekcji 11.3 specyfikacji, gdy beta potwierdzi wartość.

Strona jest na końcu celowo: potrzebuje prawdziwych zrzutów ekranu i wniosków od testerów. Jedynym powodem, żeby zrobić ją wcześniej, byłaby lista oczekujących do rekrutacji testerów; wtedy wystarczy jej najprostsza wersja w Etapie 5.

---

## 8. Budżet

| Pozycja | Koszt | Uwagi |
|---|---|---|
| Serwer VM (2 vCPU, 4 GB) | ok. 20–30 zł miesięcznie | Od zadania 3.17, czyli od lutego |
| Magazyn plików | 0 zł | 10 GB w darmowym progu R2 |
| Domena | ok. 50–60 zł rocznie | Od zadania 3.17 |
| AI: próby w Etapie 0 | ok. 40–70 zł jednorazowo | Głównie obrazy w trzech wariantach |
| AI: rozwój | ok. 30–60 zł miesięcznie | Etapy 2–5 |
| AI: miesiąc bety, 20 osób | ok. 160–250 zł | Wyliczenie w sekcji 11.2 specyfikacji |
| Apple Developer Program | 99 USD rocznie (ok. 385 zł) | Tylko dla testów na iOS; najwcześniej w Etapie 3 |
| Google Play | 25 USD jednorazowo | Dopiero w Etapie 6 |
| Rejestrowanie błędów, EAS Build, GitHub Actions | 0 zł | Darmowe progi |

W czasie budowy to ok. 60–100 zł miesięcznie, a w miesiącu bety ok. 200–300 zł, plus ewentualna opłata Apple.

---

## 9. Ryzyka i kolejność cięć

| Ryzyko | Jak je ograniczamy |
|---|---|
| Aplikacja mobilna to nowa technologia i tu powstaną największe opóźnienia | Dziesięć godzin nauki w Etapie 0; Expo Go bez natywnych buildów do Etapu 3; cienki klient z logiką na backendzie; długie bloki pracy na zadania mobilne. |
| Nano Banana nie trzyma wierności ubrań | Pomiar w Etapie 0 na trzech wariantach; kolaż zawsze obok obrazu; inny model za tym samym interfejsem. |
| Filtr bezpieczeństwa blokuje zwykłe zestawy | Sylwetki w stroju zakrywającym ciało; pomiar odsetka blokad w Etapie 0; blokada jako zwykły wynik ze zwrotem limitu. |
| Gotowa sylwetka nie przypomina użytkownika i obraz robi mniejsze wrażenie | Sześć sylwetek o różnej budowie; pytanie o to w ankiecie; własne zdjęcie jako rozszerzenie po becie. |
| Dobór jest formalnie poprawny, ale nietrafiony | Reguły i walidator, ocena spójności, macierz scenariuszy, pięć osób od końca lutego. |
| Aplikacja podsuwa w kółko te same bezpieczne rzeczy, czyli nie rozwiązuje problemu | Trzy typy propozycji, oznaczenie „rzadko noszę”, połowa kandydatów spośród zapomnianych, osobna miara w becie. |
| Progi pogody nie pasują do ludzi | Preferencja termiczna w profilu; progi w konfiguracji; kalibracja na ocenach z bety. |
| Automatyczne tagowanie myli się zbyt często | Pomiar w Etapie 0; progi trafności w bramkach; szybka korekta tagów w aplikacji. |
| Wdrożenie na VM dopiero w lutym ujawnia problemy środowiskowe pod presją czasu | Dockerfile i Compose pełnego stosu od Etapu 1; obraz budowany w CI przy każdej zmianie; na VM trafia ten sam plik Compose. |
| Koszty AI wymykają się spod kontroli | Limity na użytkownika, globalny budżet dzienny, limity w panelach dostawców, dziennik kosztów. |

**Kolejność cięć przy poślizgu:**

1. Reset hasła e-mailem (5.2); w becie wystarczy reset ręczny.
2. Notatka wolnym tekstem do okazji i funkcja oceny spójności (3.5); propozycje zostają w kolejności od modelu.
3. Filtr kategorii i „w praniu” (części 2.8, 2.12, 2.14).
4. „Dobierz do tego” (3.14).
5. Dopracowanie interfejsu (5.7) ograniczone do ekranów „Dziś” i propozycji.
6. W ostateczności wizualizacja trafia do testerów jako aktualizacja w trakcie bety.

**Punkty kontrolne:**

- **22 listopada.** Jeśli konto nie działa z telefonu, problemem jest tempo nauki aplikacji mobilnej. Zastosuj cięcia 1–3 od razu.
- **28 lutego.** Jeśli szafa i stylista nie są u pięciu osób, zastosuj cięcia 4–5 i rozważ punkt 6.

---

## 10. Otwarte decyzje

| Nr | Decyzja | Kiedy | Uwagi |
|---|---|---|---|
| 1 | Model do tagowania: Opus 5.5 czy Haiku 4.5 | Po zadaniu 0.7 | Specyfikacja przyjmuje Opus 5.5. Haiku kosztuje ok. 1,5 gr zamiast 9 gr za ubranie, a przy pełnej szafie to różnica między ok. 3 zł a 15 zł na użytkownika. To decyzja kosztowa po Twojej stronie, oparta na pomiarze trafności. |
| 2 | Wariant Nano Banana: 2 Lite, 2 czy Pro | Po zadaniu 0.10 | Domyślnie wersja 2 za ok. 31 gr za obraz. |
| 3 | Liczba i przekrój sylwetek | Przed zadaniem 0.9 | Aplikacja jest dla każdego z tym problemem, więc proponuję sześć: dwie płcie po trzy budowy ciała. Dodanie kolejnych później to nowe wiersze i pliki. |
| 4 | Hosting: własna VM czy kredyty studenckie w chmurze | Przed zadaniem 3.17 | Plan zakłada jedną VM z Dockerem dla testerów; środowisko do użytku komercyjnego powstaje w Etapie 6. |
| 5 | iOS w becie | Przed zadaniem 3.19 | Wymaga konta Apple Developer. Zależy od telefonów testerów. |
| 6 | Zakres z promotorem | Zadanie 0.11 | Rezygnacja z RabbitMQ i panelu administratora; Nano Banana zamiast modeli Try-On; gotowe sylwetki zamiast zdjęcia użytkownika. |
| 7 | Subskrypcja | Przed Etapem 6 | Ekran zakupu jest zaprojektowany, ale nazwa planu, ceny i podniesione limity to wartości zastępcze. Wdrożenie oznacza rozliczenia przez App Store i Google Play, uprawnienia na backendzie i teksty prawne. |
| 8 | Cel i próg daty urodzenia | Przed betą | Przyjęto potwierdzenie wieku z progiem 16 lat w konfiguracji. Jeśli data ma służyć czemuś jeszcze, trzeba to nazwać w polityce prywatności. |
| 9 | Docelowe obrazy sylwetek | Przed Etapem 4 | Dziesięć renderów w kadrze 3:4 według standardu z sekcji 7.3 specyfikacji; teraz są miniatury zastępcze wycięte z obrazka referencyjnego. |
