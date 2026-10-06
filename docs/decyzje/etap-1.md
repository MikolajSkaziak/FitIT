# Etap 1: szkielet od telefonu do bazy. Architektura i uzasadnienia

Stan na 6 października 2026. Notatki do pracy pisemnej (zadanie 1.16 planu).
Opisują to, co faktycznie działa w repozytorium, i dlaczego zostało zrobione w ten sposób.

## 1. Co działa po tym etapie

| Kryterium z planu | Wynik | Jak sprawdzono |
|---|---|---|
| Konto z wybraną sylwetką założone z telefonu | tak | przejście w symulatorze iPhone'a 17 Pro (Expo Go), rekord w bazie |
| Cały backend wstaje w Dockerze | tak | `docker compose --profile full up`, `/health` odpowiada |
| Rejestracja bez sylwetki, z sylwetką innej płci albo poniżej 16 lat jest odrzucana | tak | testy integracyjne |
| Zużyty refresh token jest odrzucany | tak | test integracyjny (ponowne użycie unieważnia wszystkie tokeny osoby) |
| Sesja przeżywa zamknięcie aplikacji i wygaśnięcie tokenu | tak | restart aplikacji w symulatorze; token ustawiony na 1 minutę: w logu API `401`, `refresh 200`, powtórzone żądanie `200` |
| Zmiana sylwetki zapisuje się w profilu | tak | symulator i rekord w bazie |

Testy: 73 po stronie backendu (w tym integracyjne na prawdziwym PostgreSQL w Testcontainers), 111 po stronie aplikacji.
Nie sprawdzono: Androida (na komputerze nie ma emulatora) i ekranowej klawiatury iOS (symulator miał podłączoną klawiaturę sprzętową).

## 2. Układ repozytorium

```
backend/   .NET 10: FitIt.Api, FitIt.Core, FitIt.Infrastructure, FitIt.Tests
mobile/    Expo SDK 57 (React Native 0.86, Expo Router, TypeScript w trybie ścisłym)
web/       dawny szablon Vite; miejsce na stronę promującą (Etap 6)
docs/      specyfikacja, plan, makiety (docs/design), decyzje
docker-compose.yml   baza lokalnie; profil `full` dokłada API
```

Monorepo, bo jedna osoba zmienia kontrakt API i aplikację w tym samym kroku, a typy klienta powstają z dokumentu OpenAPI backendu.

## 3. Backend

**Trzy projekty zamiast pełnej „czystej architektury”.** `Core` trzyma reguły i typy domeny bez zależności,
`Infrastructure` bazę, tożsamość i klientów usług zewnętrznych, `Api` punkty końcowe i kontrakty. Dla jednej osoby
i jednego modułu więcej warstw to więcej przepisywania, a nie więcej bezpieczeństwa. Granica, która ma znaczenie,
jest zachowana: reguły (wiek, zgodność sylwetki z płcią, zaokrąglanie współrzędnych) dają się testować bez bazy.

**Minimal API zamiast kontrolerów.** Mniej kodu wokół punktu końcowego, wbudowana walidacja (`AddValidation`)
i dokument OpenAPI 3.1 generowany przez sam framework.

**Błędy jako `ProblemDetails` z maszynowym polem `code`.** Aplikacja nigdy nie pokazuje tekstu z serwera.
Mapuje `code` (np. `email_taken`, `underage`, `invalid_credentials`) na własne polskie komunikaty, więc treść
komunikatów można zmieniać bez wydawania backendu, a tłumaczenie aplikacji nie wymaga zmian w API.
Oczekiwane odmowy wracają jako `Result<T>`, a nie wyjątki.

**Wartości słownikowe jako kody ASCII w `snake_case`** (w bazie, w API i w OpenAPI: `runs_cold`, `inverted_triangle`).
Etykiety są sprawą interfejsu. Liczby w JSON są ścisłe: domyślne ustawienie ASP.NET przyjmuje też `"12"`,
przez co każda liczba w kontrakcie miałaby typ „liczba albo tekst” i taki typ trafiałby do klienta.

**Tożsamość.** ASP.NET Core Identity bez ról (`IdentityUserContext`), hasło od 8 znaków bez reguł składu
(długość daje więcej niż wymuszanie znaków specjalnych), blokada po 5 nieudanych próbach na 5 minut,
limit żądań na trasach logowania.

**Tokeny.** JWT ważny 15 minut i refresh token ważny 30 dni. Refresh token rotuje przy każdym użyciu,
w bazie leży tylko jego skrót SHA-256, a użycie tokenu już zużytego unieważnia wszystkie tokeny tej osoby
(tak wygląda kradzież: dwie strony używają tego samego tokenu). Czas pochodzi z wstrzykniętego `TimeProvider`,
więc testy przesuwają zegar zamiast czekać.

**Rejestracja jednym żądaniem.** Aplikacja zbiera dane w pięciu krokach, ale wysyła je raz, na końcu.
Na serwerze nie ma półkont, których nikt nie dokończył, i nie ma stanu do sprzątania.
Zajętość adresu sprawdza osobny `POST /api/auth/email-check` po pierwszym kroku, żeby nie odkrywać jej po czterech kolejnych.

**Miejsce pogody.** Współrzędne z telefonu są zaokrąglane do 0,1 stopnia (około 11 km) już w aplikacji i jeszcze raz
na serwerze. Do prognozy to wystarcza, a nie pozwala wskazać adresu. Wyszukiwanie miasta (wyjście zapasowe) idzie
przez Open-Meteo, które nie wymaga klucza. Wyniki są porządkowane od największych miejscowości, bez pierwszeństwa
dla żadnego kraju, bo aplikacja ma działać na całym świecie.

**Sylwetki.** Dziesięć rekordów (pięć typów na płeć) o stałych identyfikatorach, wgrywanych przy starcie.
Obrazy to pliki statyczne API. Sylwetka musi zgadzać się z płcią, co sprawdza serwer.

**Usługi zewnętrzne za portami.** Każda ma interfejs w `Core` i dwie implementacje: prawdziwą i deterministyczną atrapę,
wybieraną konfiguracją `Providers:*`. Atrapy nie uruchomią się w środowisku produkcyjnym bez jawnej zgody w konfiguracji.
Dzięki temu całość da się budować i testować bez kont i kluczy, a podłączenie prawdziwej usługi nie zmienia reszty kodu.

**Zadania w tle.** Hangfire na PostgreSQL (jedna baza do utrzymania), panel tylko po podaniu loginu i hasła administratora
w konfiguracji. Kod zleca zadania przez własny `IBackgroundJobs`, który w testach wykonuje je na żądanie.

**Testy integracyjne na prawdziwym PostgreSQL** (Testcontainers), bo dostawca w pamięci nie sprawdza ograniczeń,
typów kolumn ani współbieżności, a właśnie tam leżą błędy.

## 4. Aplikacja mobilna

**Expo z Expo Router.** Jedna baza kodu na iOS i Androida, uruchamianie w Expo Go bez Xcode, nawigacja z plików.
Dostęp do części zalogowanej chroni `Stack.Protected`: po zmianie stanu sesji router sam przenosi na właściwy ekran,
więc ekrany nie zawierają przekierowań.

**Klient API z typów OpenAPI** (`openapi-typescript` i `openapi-fetch`). Zmiana kontraktu na backendzie i jedno polecenie
`npm run gen:api` dają błąd kompilacji w każdym miejscu aplikacji, którego zmiana dotyczy.

**Sesja.** Access token żyje tylko w pamięci, refresh token w SecureStore (Keychain albo Keystore).
Po odpowiedzi 401 klient odświeża sesję i powtarza żądanie. Odświeżenie jest jedno, wspólne dla wszystkich żądań,
które akurat czekają: token rotuje, więc dwa równoległe odświeżenia wyglądałyby dla serwera jak kradzież
i kończyły sesję. Brak sieci nie wylogowuje: aplikacja pokazuje ekran „Nie udało się połączyć” z ponowieniem.

**Stan.** TanStack Query dla danych z serwera, zustand dla dwóch rzeczy lokalnych: sesji i szkicu rejestracji.
Szkic (z hasłem) żyje tylko w pamięci i znika po założeniu konta albo po powrocie na ekran startowy.

**Motyw z tokenów.** Kolory, typografia, odstępy i promienie pochodzą z jednego pliku, zgodnego z makietami
i `.ux-profile.md`: jeden kolor (szałwia), butelkowa zieleń dla akcji, tryb ciemny z osobnym zestawem.
Komponenty nie zawierają własnych kolorów.

**Daty bez stref czasowych.** Data urodzenia jest dniem kalendarzowym. Aplikacja liczy wiek na liczbach
(dzień, miesiąc, rok), tak samo jak serwer, łącznie z urodzonymi 29 lutego.

## 5. Decyzje podjęte bez pytania, do potwierdzenia

| Decyzja | Dlaczego tak | Łatwo zmienić? |
|---|---|---|
| Minimalny wiek 16 lat (ustawienie `Account:MinimumAge`) | próg zgody na przetwarzanie danych w Polsce; otwarta decyzja 8 planu | tak, konfiguracja |
| Dwie wartości płci | tak jest w zaakceptowanych makietach; od płci zależy zestaw sylwetek | wymaga nowych sylwetek |
| Identyfikator aplikacji `pl.fitit.app` | potrzebny w konfiguracji; ostateczny wybór przed pierwszym buildem do sklepu | tak, przed publikacją |
| Na ekranie miasta odnośnik „Pomiń, ustawię później” | bez niego osoba, która odmawia lokalizacji i nie chce podać miasta, nie założy konta; stan „bez miejsca” i tak jest zaprojektowany | tak |
| Brak odnośnika „Nie pamiętasz hasła?” | pojawi się razem z resetem hasła (zadanie 5.2), żeby nie prowadził donikąd | dojdzie w Etapie 5 |
| Zdanie o regulaminie bez odnośników | dokumenty powstają w zadaniu 5.4 | dojdzie w Etapie 5 |
| Edycja daty urodzenia i płci w profilu | makieta pokazuje je jako edytowalne; zmiana płci wymusza wybór nowej sylwetki w tym samym zapisie | tak |

## 6. Skutki decyzji „aplikacja na cały świat”

Specyfikacja była pisana z myślą o polskich testerach. Po decyzji z 6 października 2026:

- wyszukiwanie miejscowości nie faworyzuje żadnego kraju (zrobione),
- interfejs zostaje po polsku, dopóki nie zapadnie decyzja o kolejnych językach; komunikaty są już oddzielone od API kodami błędów, więc tłumaczenie nie wymaga zmian na serwerze,
- „dziś” dla pogody i propozycji trzeba liczyć w strefie czasowej miejsca, a nie w `Europe/Warsaw` (do uwzględnienia w Etapie 3),
- jednostki temperatury (°C i °F) oraz dokumenty prawne dla innych krajów są poza obecnym zakresem i wymagają osobnej decyzji.
