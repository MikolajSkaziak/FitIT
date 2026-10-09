# Etap 5: domknięcie. Usuwanie konta, reset hasła kodem, przegląd bezpieczeństwa i miary bety

Stan na 7 października 2026. Notatki do pracy pisemnej (zadanie 5.13 planu).
Opisują to, co faktycznie działa w repozytorium, i dlaczego zostało zrobione w ten sposób.
Plan przewiduje w tej notatce przebieg bety i pierwsze miary. **Bety jeszcze nie było:** żaden obcy tester nie używał aplikacji,
baza nie zawiera danych z prawdziwego użycia, a dostawcy poczty, modelu stylisty i generatora obrazów są w tym etapie atrapami.
Ta notatka opisuje więc, co jest gotowe do zmierzenia i jakie pytanie odpowiada każda miara, i nie podaje żadnej liczby z bety.
Obejmuje zadania 5.1, 5.2, 5.6 (strona serwerowa) i 5.10. Zadań 5.3, 5.4, 5.5, 5.7, 5.8, 5.9, 5.11 i 5.12 (onboarding, dokumenty prawne,
rejestr błędów, dopracowanie interfejsu, odporność, buildy, rekrutacja, pierwszy tydzień bety) ta notatka nie opisuje i ich gotowości nie potwierdza.

## 1. Co działa po tym etapie

| Kryterium z planu | Wynik | Jak sprawdzono |
|---|---|---|
| Po usunięciu konta nie ma rekordów ani plików (5.1) | tak | test integracyjny `AccountDeletionTests`: zliczenie wierszy we wszystkich tabelach, które mogą trzymać dane osoby, i kluczy pod jej prefiksem w magazynie |
| Usunięcie konta wymaga hasła i nie ułatwia zgadywania | tak | testy: złe hasło nic nie usuwa, po pięciu błędach blokada `locked_out` |
| Reset hasła kodem: dwa punkty końcowe (5.2) | tak | `PasswordResetTests`, 28 metod |
| Reset hasła w pełnej ścieżce na telefonie (5.2) | nie sprawdzono | dostawcy poczty nie ma; wiadomości atrapy żyją w pamięci procesu i nie ma jak ich odczytać poza testem |
| Każda trasa z identyfikatorem odpowiada obcemu "nie znaleziono" (5.6) | tak | `AccessTests`; lista tras pochodzi z dokumentu OpenAPI, więc nowa trasa nie ominie testu |
| Limity żądań, logi bez danych wrażliwych (5.6) | tak | `ExposureTests`, `LoggingTests` |
| Aktualizacja zależności (5.6) | częściowo | po stronie serwera skan nie wykazuje podatnych pakietów; po stronie aplikacji `npm audit` zgłasza 67 uwag (sekcja 4) |
| Miary liczą się jednym poleceniem (5.10) | tak, z zastrzeżeniami | `backend/sql/beta-metrics.sql`, 18 zapytań; każde uruchamia `BetaMetricsTests`; sekcja 5 mówi, czego nie liczą |
| Wersja dla testerów, rejestr błędów, pierwszy tydzień bety | poza tą notatką | zadania 5.5, 5.9, 5.11, 5.12 |

Przy pisaniu notatki uruchomiłem testy bez bazy (290 przypadków, w tym `EvalTests`), które przechodzą. Testy z tej notatki
(`AccountDeletionTests` 9 metod, `PasswordResetTests` 28, `AccessTests` 5, `ExposureTests` 6, `LoggingTests` 3, `BetaMetricsTests` 8)
są integracyjne na PostgreSQL w Testcontainers; Docker nie odpowiadał, więc dzisiaj ich nie uruchamiałem.

## 2. Usuwanie konta

**Przebieg.** `DELETE /api/me` z hasłem w treści żądania. Serwer sprawdza hasło, usuwa wiersz osoby jednym poleceniem
i zleca zadanie w tle, które usuwa pliki. Odpowiedź to 204. W aplikacji jest ekran z potwierdzeniem: osoba wpisuje słowo "USUŃ"
(zaakceptowane także jako "usun", bo na wielu klawiaturach "ń" wymaga przytrzymania) i hasło; ekran nazywa, co zniknie, z liczbą ubrań.

**Dlaczego hasło.** Skradziony token dostępu nie powinien wystarczyć do nieodwracalnego kroku. Hasło podaje się ponownie, a błędne próby
liczą się do tej samej blokady co przy logowaniu (5 prób, 5 minut). Test: po pięciu błędach nawet właściwe hasło daje `429 locked_out`.

**Co znika.**

| Dane | Jak |
|---|---|
| konto, tokeny odświeżania, kody resetu hasła, ubrania, zestawy i ich elementy, wizualizacje, liczniki dzienne | usuwanie kaskadowe w bazie, w jednym poleceniu |
| pliki: oryginały, wycinki, obrazy wizualizacji, kopia sylwetki | zadanie `AccountCleanup`: wylicza klucze pod prefiksem `u/<osoba>/` i usuwa je partiami po 200; można je uruchomić ponownie |
| wpisy dziennika kosztów AI | **zostają**, ale bez identyfikatora osoby (`user_id` ustawiony na NULL) |

Konto jest usuwane **przed** plikami: zadanie, które nie usunie pliku, można powtórzyć, a plik trzymany dla osoby, której już nie ma,
byłoby trudno znaleźć. Wiersze znikają od razu; pliki w zadaniu w tle, które Hangfire ponawia. Specyfikacja obiecuje usunięcie "najpóźniej w ciągu doby".

**Skutki uboczne usunięcia, które sprawdzają testy.**

- Token dostępu usuniętego konta przestaje działać od razu, choć jest jeszcze ważny przez minuty: uwierzytelnianie sprawdza przy
  każdym żądaniu, czy konto istnieje (jedno zapytanie po kluczu głównym). Test: `/api/me`, `/api/clothes` i `/api/uploads` odpowiadają 401,
  odświeżenie i logowanie też.
- Ten sam adres e-mail może założyć nowe konto i zaczyna od zera.
- Zadanie czekające na usunięte konto (na przykład przetwarzanie ubrania) nie znajduje niczego do zrobienia i kończy się bez błędu.
- Nikt inny nie traci niczego: test sprawdza obcą osobę z własną szafą i plikami.

**Różnica względem specyfikacji.** Specyfikacja (sekcja 12) mówi, że "rekordy znikają kaskadowo". Wpisy dziennika kosztów zostają bez
identyfikatora osoby, żeby zachować sumy kosztów i dzienny budżet AI. Zawierają model, koszt, czas trwania, powodzenie i chwilę;
nie zawierają niczego, co wskazuje osobę. Sama zmiana w `ai_usage_log` to decyzja z tabeli w sekcji 7.

**Znane ograniczenie.** Nocne sprzątanie plików bez wiersza (Etap 2) celowo pomija kopie sylwetek, bo nie mają wiersza i należą do konta.
Kopia sylwetki zapisana przez zadanie wizualizacji już po usunięciu konta zostałaby więc na stałe. Zadanie `AccountCleanup`
usuwa cały prefiks, ale tylko raz; wyścig jest mało prawdopodobny (zlecenie wizualizacji musiałoby zacząć się w sekundach usuwania), lecz możliwy.
Wniosek z lektury kodu, bez testu.

## 3. Reset hasła kodem z e-maila

**Przebieg.**

```
aplikacja                                     API
  | POST /api/auth/password-reset/request        |
  |   { email }  ------------------------------> | zawsze 204, także dla nieznanego adresu
  |                                              | jeśli jest konto: kod, 6 cyfr, e-mail
  | (osoba czyta kod w poczcie)                  |
  | POST /api/auth/password-reset/confirm        |
  |   { email, code, newPassword } -------------> | 204, albo 400 invalid_reset_code
  |                                              | nowe hasło, wszystkie sesje zakończone
  | <------ logowanie od nowa -------------------|
```

Dwa ekrany w aplikacji: pierwszy prosi o adres, drugi o kod i nowe hasło; po sukcesie osoba trafia na logowanie z komunikatem.
Adres jest w pamięci aplikacji, nie w adresie trasy, więc nie wpada do żadnego adresu URL.

**Dlaczego kod, a nie link.** Plan z góry przewiduje kod wpisywany w aplikacji. Powody, które widzę w kodzie i w otoczeniu projektu,
a nie cytat z decyzji:

- Link w wiadomości otwiera przeglądarkę. Żeby wrócił do aplikacji, potrzebne są linki uniwersalne (iOS) i linki aplikacji (Android):
  domena z plikami powiązania i zbudowana, podpisana aplikacja z docelowym identyfikatorem. Beta idzie przez Expo Go, plik APK
  i TestFlight, więc ta infrastruktura jeszcze nie istnieje, a kod wymaga tylko dwóch punktów końcowych i dwóch ekranów.
- Kod wpisuje człowiek w tej samej aplikacji, w której wpisze nowe hasło. Nie ma strony internetowej do zbudowania ani utrzymania.
- Skanery bezpieczeństwa poczty potrafią otwierać linki z wiadomości, co mogłoby zużyć link jednorazowy, zanim zrobi to człowiek.
  Kod nie ma tej wady.

Koszt tej decyzji: sześć cyfr to tylko milion możliwości, więc samo bezpieczeństwo kodu wynika z ograniczeń, nie z jego długości.
Każde z nich ma test:

| Zabezpieczenie | Wartość | Skąd |
|---|---|---|
| ważność kodu | 15 minut | `Account:ResetCodeMinutes` |
| próby zgadnięcia na kod | 5, potem kod jest martwy, także dla właściwej wartości | `Account:ResetCodeAttempts`; licznik rośnie jednym poleceniem SQL **przed** sprawdzeniem kodu, więc równoległe próby nie przechodzą pod limitem |
| użycie | jednorazowe; z dwóch równoczesnych żądań z dobrym kodem wygrywa jedno | warunkowa zmiana `used_at` |
| najnowszy kod unieważnia poprzednie | tak | prośba o nowy kod oznacza starsze jako użyte |
| liczba kodów na adres | 3 na godzinę, dalsze prośby nic nie wysyłają i nic nie mówią | `Account:ResetRequestsPerHour` |
| liczba żądań z jednego adresu IP | 10 na 15 minut na obu trasach, własna pula, niezależna od logowania | `RateLimits:PasswordResetPer15Minutes` |
| przechowywanie | tylko HMAC-SHA256 kodu, związany z identyfikatorem kodu i kluczem serwera | zwykły skrót sześciu cyfr dałoby się odwrócić z kopii tabeli; klucz serwera uniemożliwia próbowanie miliona kodów w trybie offline |

Z tych liczb wynika prosty rachunek (nie pomiar): przy 3 kodach na godzinę i 5 próbach na kod napastnik, który zna tylko adres,
ma najwyżej 15 prób na godzinę z miliona możliwych, czyli szansę nie większą niż 15 na milion na godzinę, a po godzinie
kolejne kody są nowymi losowaniami. Rachunek zakłada, że kod jest losowany równomiernie (`RandomNumberGenerator.GetInt32`).

**Wyliczanie kont.** Odpowiedź na prośbę o kod jest ta sama (204) dla adresu z kontem i bez niego, a potwierdzenie z kodem dla adresu bez konta
daje ten sam błąd co zły kod (`invalid_reset_code`). Reguły hasła są sprawdzane przed kodem, więc zbyt krótkie hasło nie zużywa próby.
Błąd dostawcy poczty nie jest widoczny dla wołającego. Test sprawdza treść i kod odpowiedzi, nie czas.
Kod pozornie wyrównuje czas (hasz liczony także dla nieistniejącego konta), ale pozostałe kroki (zapytania, wysłanie wiadomości) są różne.
Z prawdziwym dostawcą poczty, wołanym w trakcie żądania, odpowiedź dla adresu z kontem byłaby wolniejsza o czas wysłania.
To wniosek z lektury kodu, bez pomiaru: przed podłączeniem dostawcy warto wysyłać wiadomość w zadaniu w tle.

**Skutki udanego resetu.** Nowe hasło, wszystkie sesje zakończone (tokeny odświeżania unieważnione, więc osoba loguje się od nowa;
istniejące tokeny dostępu żyją do końca swoich 15 minut), zdjęta blokada konta po nieudanych próbach. Ta sama logika zmiany hasła
działa przy zmianie hasła z profilu (`POST /api/me/password`), z tą różnicą, że sesja, z której wysłano zmianę, zostaje.

**Wiadomość.** Zwykły tekst po polsku, w drugiej osobie, bez form zależnych od płci, bez myślników: kod, informacja, że działa
jeden raz i przez 15 minut, i zdanie "Jeśli ta prośba nie pochodzi od Ciebie, zignoruj tę wiadomość."

**Dostawca poczty.** Port `IEmailSender` ma jedną implementację, `FakeEmailSender`: trzyma wiadomości w pamięci procesu i w logu
zapisuje tylko, że wiadomość została przyjęta (ani adres, ani treść, bo treść to klucz do cudzego konta). `Providers:Email=Smtp`
zatrzymuje start aplikacji. Do bety potrzebny jest prawdziwy dostawca; plan zawiera w ścieżce cięć "w becie wystarczy reset ręczny".

## 4. Przegląd bezpieczeństwa

Lista kontrolna z zadania 5.6 jest zapisana jako testy, które wywołują się przy każdym budowaniu. Nie jest to audyt zewnętrzny.

**Dostęp do cudzych zasobów** (`AccessTests`).

- Lista tras jest czytana z dokumentu OpenAPI, nie z listy w teście. Każda trasa spoza jawnej listy dziesięciu tras publicznych
  musi odpowiedzieć 401 na brak tokenu, na token podrobiony bez podpisu i na token podpisany obcym kluczem.
- Każda trasa z identyfikatorem w adresie (`clothes`, `reprocess`, `outfits`, `visualizations`) odpowiada obcej osobie `404 not_found`,
  takim samym kodem jak dla identyfikatora, który nie istnieje, więc nie da się sprawdzić, że cudzy zasób jest. Test kończy się porażką,
  jeśli dodano trasę z identyfikatorem, której nikt nie opisał, i sprawdza, że właściciel nic nie stracił po próbach obcego.
- Listy pokazują osobie tylko jej własne dane (ubrania, zestawy, zapisane, statystyki, zużycie).
- Cudze ubranie nie może być bazą propozycji, a klucz cudzego pliku nie może być użyty jako własne ubranie.

**Limity żądań** (`ExposureTests`). Adres wołającego pochodzi z nagłówka `X-Forwarded-For` tylko wtedy, gdy połączenie przychodzi
z zaufanej sieci (domyślnie pętla zwrotna i sieci prywatne, czyli kontener z serwerem pośredniczącym; zmiana przez `Proxy:TrustedNetworks`).
Inaczej każdy mógłby podać dowolny adres i uciec spod limitu. Testy: za zaufanym pośrednikiem każdy klient ma własną pulę,
bez zaufanego pośrednika podawany adres jest ignorowany, a niepoprawna sieć w konfiguracji zatrzymuje start.
Dokument OpenAPI i strona testowa nie są serwowane w środowisku produkcyjnym.
Limity żądań obejmują trasy `/api/auth/*` (10 na minutę na adres) i wyszukiwanie miejscowości, a reset hasła ma własną pulę.
**Reszta tras nie ma ogólnego limitu żądań na osobę**: chronią je dzienne limity działań kosztownych (ubrania, propozycje,
wizualizacje) i globalny budżet AI. Zwykłe odczyty nie są ograniczone.

**Logi** (`LoggingTests`). Test wykonuje rejestrację, logowanie ze złym i dobrym hasłem, dodanie ubrań, propozycje, wizualizację
(także nieudaną trzykrotnie), pełny reset hasła, zmianę hasła i usunięcie konta, a potem sprawdza cały zapisany dziennik:
nie ma w nim haseł, tokenów dostępu i odświeżania, kodu resetu, podpisanych adresów (ani ich ścieżek), nagłówka `Bearer`,
adresu e-mail, imienia ani nazwy miejsca. Drugi test: wpis o żądaniu zawiera trasę i status, ale nie ciąg zapytania.
Trzeci: atrapa poczty zapisuje, że przyjęła wiadomość, i nic więcej. Adaptery dostawców mają obowiązek nie wkładać adresów, kluczy
ani tekstów osoby do komunikatów wyjątków (opisane przy `ProviderException`).

**Hasła i sesje.** Z Etapu 1: hasło od 8 znaków, blokada po 5 błędach na 5 minut, tokeny odświeżania rotujące i trzymane jako skrót,
użycie zużytego tokenu unieważnia wszystkie sesje osoby.

**Zależności.** Stan na dziś, nie wynik osobnego przeglądu:

- Serwer: `dotnet list package --vulnerable --include-transitive` nie wykazuje podatnych pakietów w żadnym z pięciu projektów.
- Aplikacja: `npm audit` zgłasza 67 uwag (16 umiarkowanych, 51 wysokich). Dotyczą bezpośrednich zależności: `expo`, `expo-router`,
  `expo-splash-screen`, `jest` i `@react-native-community/datetimepicker` (przez pakiety Expo), a poprawki wymagają ich aktualizacji, nie
  zmiany jednej linii. Audit nie mówi, które z uwag dotyczą kodu w uruchomionej aplikacji, a które narzędzi budowania i testów.
  Nie oceniałem tego i niczego nie aktualizowałem: to decyzja do podjęcia przed betą.

**Czego przegląd nie obejmuje.** Nie ma testów obciążeniowych, testu penetracyjnego ani sprawdzenia konfiguracji serwera
(HTTPS, nagłówki, zapora); to należy do wdrożenia (zadanie 3.18).

## 5. Miary bety (`backend/sql/beta-metrics.sql`)

Plik zawiera 18 zapytań tylko do odczytu. Każde zaczyna się od linii `-- name:` i komentarza, i kończy średnikiem.
Wszystkie naraz: `psql "$DATABASE_URL" -f backend/sql/beta-metrics.sql`. Jedno: skopiować blok do dowolnego klienta SQL.
`BetaMetricsTests` uruchamia każdy blok na schemacie z migracji, na bazie z danymi i na pustej (bez dzielenia przez zero),
sprawdza nazwy kolumn i to, że żadne zapytanie niczego nie zmienia, więc zmiana nazwy kolumny przerwie budowanie, a nie pulpit w dniu,
w którym będzie potrzebny. Ja go dziś nie uruchamiałem.

| Zapytanie | Na jakie pytanie odpowiada |
|---|---|
| `active_people_per_day`, `active_people_per_week` | ile osób coś zrobiło w danym dniu i tygodniu (ostatnie 30 dni i 12 tygodni) |
| `garments_added_per_person`, `garments_added_summary` | ile ubrań dodał każdy tester, ilu doszło do "gotowych", ilu czeka na ręczny opis; średnia, mediana i maksimum |
| `suggestions_requested_per_day`, `suggestions_requested_per_person` | jak często testerzy proszą o propozycje; ile prośb policzono w dziennych licznikach, a ile dało zapisane propozycje. Prośby, które kończą się "brakuje w szafie", nie są liczone nigdzie, więc ta miara ich nie widzi |
| `proposals_saved_liked_worn`, `proposals_by_kind` | jaki odsetek propozycji został zapisany, polubiony, odrzucony i założony, łącznie, tygodniami i według typu (pewniak, odkrycie, nowe połączenie, bez etykiety) |
| `worn_outfits_with_forgotten_garment` | jaka część założonych zestawów była "odkryciem", czyli zawierała zapomniane ubranie |
| `wardrobe_usage_per_person`, `wardrobe_usage_summary` | ile gotowych ubrań osoba nosiła w ostatnich 30 dniach; średnia, mediana i odsetek osób, które założyły cokolwiek |
| `ai_cost_per_person`, `ai_cost_per_person_per_operation` | ile każdy tester kosztuje w dolarach, z podziałem na usuwanie tła, tagowanie, stylistę i wizualizację |
| `ai_cost_per_operation` | średni koszt, czas (średni i 95. percentyl) i odsetek powodzeń każdej operacji u każdego modelu |
| `ai_cost_per_day` | dzienna suma kosztów (do porównania z budżetem 10 USD) |
| `ai_cost_per_active_person_per_week` | koszt na osobę aktywną tydzień po tygodniu: liczba, która rozstrzyga, ile kosztuje darmowy użytkownik; do zestawienia z sekcją 11.2 specyfikacji |
| `fallback_share` | jak często zestawy ułożyły reguły zamiast modelu (awaria, odmowa, brak poprawnych zestawów, wyczerpany budżet), łącznie i tygodniami |
| `visualizations_by_outcome` | ile wizualizacji skończyło się obrazem, blokadą filtra i błędem (z kodem), ile kosztowały i ile trwały |

**Jak miary pokrywają progi ze specyfikacji** (sekcja 1). Sześć progów bety, i to, co zapytania z nich liczą:

| Próg ze specyfikacji | Zapytanie | Zgodność |
|---|---|---|
| mediana liczby ubrań w pierwszej sesji co najmniej 10 | `garments_added_summary` | przybliżona: liczy ubrania dodane łącznie, bo w bazie nie ma pojęcia sesji |
| testerzy, którzy poprosili o propozycję, co najmniej 70% | `suggestions_requested_per_person` i `garments_added_summary.people` | trzeba podzielić ręcznie: liczba wierszy pierwszego przez liczbę osób |
| propozycje ocenione kciukiem w górę co najmniej 60% | `proposals_saved_liked_worn.liked_percent` | liczy polubione wśród wszystkich propozycji, także nieocenionych |
| testerzy, którzy choć raz założyli zestaw, co najmniej 40% | `wardrobe_usage_summary.people_wearing_something_percent` | najbliższa miara: osoby z gotowymi ubraniami, które założyły coś w ostatnich 30 dniach |
| testerzy, którzy założyli zestaw z zapomnianym ubraniem, co najmniej 30% | `worn_outfits_with_forgotten_garment` | **inna wielkość**: odsetek odkryć wśród założonych zestawów, nie odsetek testerów |
| testerzy aktywni w drugim tygodniu, co najmniej 30% | `active_people_per_week` | **brak**: liczy aktywnych w tygodniu kalendarzowym, nie według tygodnia od rejestracji |

Dwóch progów (zapomniane ubranie i aktywność w drugim tygodniu) nie liczy więc żadne zapytanie w odpowiadającej im postaci, a trzy kolejne
liczą się tylko w przybliżeniu albo po ręcznym dzieleniu. Zapytania trzeba dopisać albo policzyć z surowych tabel, zanim wyniki bety trafią do pracy. Plik dodatkowo mierzy rzeczy, o które plan prosi w sekcji 6:
koszt AI na użytkownika, odsetek zablokowanych i nieudanych wizualizacji oraz odsetek propozycji z trybu awaryjnego.

**Czego miary nie mogą powiedzieć**, i co zapisano w komentarzu pliku:

- Dni i tygodnie są w UTC. Dzień osoby (sekcja 7 notatki Etapu 3) nie jest zapisywany, tylko daty, które z niego wyliczono
  (`usage_counters.day`, `outfits.worn_on`, `clothing_items.last_worn_on`); te są użyte bez zmian.
- Nie ma dziennika "otworzono aplikację". Aktywność to ślad, który coś zostawia: odświeżenie sesji, dodane ubranie, prośba o propozycje,
  ocena, zamówiony obraz. Osoba, która tylko obejrzała szafę, jest niewidoczna.
- Zestawy zawierające usunięte później ubranie znikają razem z nim, więc odsetki są liczone na propozycjach, które jeszcze istnieją.
- Konta usunięte zostawiają tylko dziennik kosztów, bez identyfikatora osoby (wiersz `user_id IS NULL` w kosztach).
- "Zapomniane w chwili założenia" nie jest zapisywane; wiadomo tylko, czy propozycję oznaczono jako odkrycie w chwili jej ułożenia.
- Dzień budżetu AI jest liczony w strefie serwera, a `ai_cost_per_day` w UTC, więc granice dni mogą się różnić o przesunięcie.
- Ankiety po tygodniu (czy zestawy nadawały się do założenia, czy aplikacja podsunęła coś zapomnianego, ile byłoby to warte) w bazie nie ma.
  Odsetek zestawów nadających się do założenia, który jest bramką Etapu 3, leży więc poza zasięgiem SQL; najbliższy ślad to odsetek zestawów założonych i polubionych.

## 6. Czego jeszcze nie zmierzono

- Wszystkiego, co wymaga testerów: pierwsza sesja, aktywność w drugim tygodniu, oceny, odsetek założonych zestawów.
- Kosztu AI na użytkownika: dziennik działa, ale atrapy zapisują zera. Szacunki ze specyfikacji (sekcja 11.2) to cennik, nie pomiar.
- Odsetka blokad i błędów wizualizacji oraz odsetka trybu awaryjnego u prawdziwego modelu.
- Reset hasła w pełnej ścieżce na telefonie: czeka na dostawcę poczty.
- Dwóch rzeczy z samego przeglądu: aktualizacji zależności aplikacji i sprawdzenia konfiguracji serwera po wdrożeniu.

## 7. Decyzje podjęte bez pytania, do potwierdzenia

| Decyzja | Dlaczego tak | Łatwo zmienić? |
|---|---|---|
| Usunięcie konta wymaga hasła, błędne hasło liczy się do blokady logowania | skradziony token dostępu nie powinien wystarczyć do kroku nieodwracalnego | tak, jedna metoda w `AccountService` |
| Wpisy dziennika kosztów AI zostają po usunięciu konta, z `user_id` ustawionym na NULL | zachowują sumy kosztów i dzienny budżet; nie zawierają danych osoby. Specyfikacja mówi tylko "rekordy znikają kaskadowo" | tak, zmiana klucza obcego z `SET NULL` na `CASCADE` (migracja); trzeba też zdecydować, czy polityka prywatności mówi o tym wprost |
| Konto jest usuwane z bazy przed plikami; pliki w zadaniu w tle | zadanie można powtórzyć, a pliki bez właściciela trudno znaleźć | tak |
| Token dostępu usuniętego konta przestaje działać od razu (zapytanie o konto przy każdym żądaniu) | inaczej konto działałoby jeszcze do 15 minut | tak, kosztem jednego zapytania na żądanie |
| Kod resetu: 6 cyfr, 15 minut, 5 prób, jednorazowy, 3 kody na godzinę na adres, HMAC z kluczem serwera | kod zamiast linku (powody w sekcji 3); wartości są startowe i w konfiguracji | tak, `Account:Reset*` |
| Reset kończy wszystkie sesje i zdejmuje blokadę konta | osoba, która zapomniała hasła, mogła być zablokowana własnymi próbami; sesje mogły należeć do kogoś, kto znał stare hasło | tak |
| Odpowiedź na prośbę o kod jest zawsze 204 | nie wolno wyliczać, kto ma konto | nie zmieniać |
| Wiadomość z kodem wysyłana w trakcie żądania, nie w zadaniu w tle | prostsze; przy atrapie nie ma różnicy | tak, przed podłączeniem dostawcy (zagrożenie czasem odpowiedzi opisane w sekcji 3) |
| Przegląd bezpieczeństwa jako testy w repozytorium, listy tras czytane z OpenAPI | nowa trasa nie ominie przeglądu; lista kontrolna nie stygnie | tak |
| Brak ogólnego limitu żądań na osobę poza trasami logowania i resetu | w MVP chroni dzienny limit kosztownych działań i budżet AI; ogólny limit dodałby konfigurację bez widocznego zysku przy 10 do 20 testerach | tak, jeden limiter |
| Dzień w miarach bety w UTC | prosto i jednoznacznie; dzień osoby nie jest zapisywany | tak, ale wymaga zapisania strefy przy zdarzeniach |
| Miary jako zwykłe zapytania SQL, bez pulpitu | trzech miar na dziś nie ma w dokładnej postaci, a pulpit przed betą byłby zbędny | tak |
| `npm audit` nie rozwiązany przed betą | aktualizacja Expo i Jest jest większą zmianą niż pojedyncza poprawka; decyzja należy do autora | tak, kwestia terminu |
