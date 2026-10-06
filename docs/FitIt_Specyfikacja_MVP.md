# FitIt — specyfikacja MVP i architektura

- **Wersja:** 2.4, 6 października 2026
- **Zmiany:** 2.1 — sylwetka wybierana z gotowych przy zakładaniu konta, bez zdjęć użytkownika; 2.2 — produkt zdefiniowany przez problem „pełna szafa, a nie mam się w co ubrać”, stąd typy propozycji i zapomniane ubrania; 2.3 — język wizualny aplikacji i wzorce ekranów (sekcja 10.1, plik `.ux-profile.md`); 2.4 — zgodnie z zaakceptowanymi makietami (`docs/design`): rejestracja w pięciu krokach z imieniem, datą urodzenia i płcią, dziesięć typów sylwetek dobieranych do płci, pogoda z lokalizacji telefonu z miastem jako wyjściem zapasowym, jeden kolor (szałwia)
- **Zastępuje:** `FitIt_Specyfikacja_Techniczna_v2.md` w zakresie pierwszej wersji produktu
- **Dokumenty towarzyszące:** [FitIt_Plan_MVP.md](FitIt_Plan_MVP.md) (plan działania: etapy, zadania, harmonogram, budżet) i [FitIt_Krytyka_Specyfikacji.md](FitIt_Krytyka_Specyfikacji.md) (krytyka poprzedniej specyfikacji)

Ceny sprawdzone 5 października 2026, przeliczone po kursie NBP 3,89 zł/USD. Koszty wywołań modeli językowych to szacunki oparte na przewidywanej liczbie tokenów; potwierdzi je Etap 0 planu.

---

## 1. Produkt

**Problem:** pełna szafa ubrań, a mimo to „nie mam się w co ubrać”.

Założenie robocze: stoją za tym trzy rzeczy. Nie pamiętamy, co mamy. Nosimy w kółko ten sam mały fragment szafy. Rano nie ma czasu na układanie zestawów.

**Rozwiązanie:** FitIt układa zestawy z ubrań, które użytkownik już ma. Użytkownik fotografuje swoje ubrania, a aplikacja sama je opisuje. Na podstawie pogody i wybranej okazji proponuje trzy zestawy z jego szafy, celowo sięgając także po rzeczy zapomniane, i krótko uzasadnia wybór. Wybrany zestaw można zobaczyć na sylwetce wybranej przy zakładaniu konta, jako obraz wygenerowany przez Nano Banana.

Aplikacja jest dla każdego, kto ma ten problem, bez podziału na płeć czy styl. Nie namawia do kupowania; jej miarą jest to, ile z własnej szafy użytkownik faktycznie nosi.

Pętla MVP: **dodaj ubrania → „Co dziś ubrać?” → trzy propozycje → zobacz na sylwetce → „Zakładam to”**.

Hipoteza do sprawdzenia w becie: osoba z pełną szafą, która w ok. 10 minut doda kilkanaście ubrań, dostanie z nich zestaw nadający się do założenia przy dzisiejszej pogodzie, wróci po następny i sięgnie po rzeczy, których dotąd nie nosiła.

| Miara w becie (10–20 osób) | Próg |
|---|---|
| Mediana liczby ubrań dodanych w pierwszej sesji | co najmniej 10 |
| Testerzy, którzy poprosili o propozycję | co najmniej 70% |
| Propozycje ocenione kciukiem w górę | co najmniej 60% |
| Testerzy, którzy choć raz kliknęli „Zakładam to” | co najmniej 40% |
| Testerzy, którzy założyli zestaw z zapomnianym ubraniem | co najmniej 30% |
| Testerzy aktywni w drugim tygodniu | co najmniej 30% |

---

## 2. Zakres MVP

**Konto**
- Rejestracja w pięciu krokach: e-mail i hasło; imię, data urodzenia i płeć; typ sylwetki (pięć gotowych dla wybranej płci); preferowane style; pogoda. Do tego logowanie, automatyczne odświeżanie sesji, wylogowanie, usunięcie konta z aplikacji.
- Profil: imię, data urodzenia, płeć, preferowane style, źródło pogody (lokalizacja telefonu albo wpisane miasto), preferencja termiczna („zwykle marznę”, „normalnie”, „zwykle mi ciepło”), zmiana sylwetki.
- Data urodzenia służy do potwierdzenia wieku: konto może założyć osoba, która ukończyła 16 lat (próg z konfiguracji).
- Zgoda na przetwarzanie zdjęć ubrań przez zewnętrzne AI.

**Szafa**
- Dodawanie zdjęć z aparatu lub galerii, wiele naraz; zmniejszanie na telefonie; wysyłka przez pre-signed URL.
- Przetwarzanie w tle: usunięcie tła i automatyczne tagowanie.
- Poprawianie tagów, lista z filtrem kategorii, szczegóły, usuwanie, oznaczenia „w praniu” i „rzadko noszę”.
- Wskaźnik wykorzystania szafy (ile ubrań było w założonych zestawach w ostatnich 30 dniach) i filtr zapomnianych ubrań.

**Stylista**
- Ekran „Dziś”: pogoda, wybór okazji (sześć gotowych), opcjonalna notatka („prezentacja przed klientem”) i opcjonalne ubranie bazowe.
- Trzy propozycje z własnej szafy, dobrane pod pogodę i okazję: pewniak, odkrycie z zapomnianym ubraniem i nowe połączenie. Każda jako kolaż wyciętych zdjęć z uzasadnieniem po polsku.
- Zapis do „Moje outfity”, ocena kciukiem, „Zakładam to”.

**Wizualizacja**
- „Pokaż na sylwetce” przy wybranej propozycji: obraz generowany w tle przez Nano Banana.
- Obraz powstaje na sylwetce wybranej przy rejestracji. Aplikacja nie przyjmuje zdjęć użytkownika.

**Fundament**
- Dzienne limity i dziennik kosztów AI, tryby awaryjne dla każdej usługi zewnętrznej, testy, CI, rejestrowanie błędów, wdrożenie na jeden serwer.

MVP to wyłącznie aplikacja mobilna na iOS i Androida, budowana z jednego kodu. Poza MVP zostają świadomie: własne zdjęcie sylwetki, płatności i kredyty, panel administratora, strona promująca, afiliacja, asystent walizki, kalendarz, logowanie społecznościowe, powiadomienia push. Uzasadnienie w sekcji 15.

---

## 3. Trzy role AI

Poprzednia specyfikacja miała jeden „model wizyjny”. W rzeczywistości są to trzy różne zadania, z różnymi modelami, kosztami i trybami pracy.

| Rola | Co robi | Model | Tryb | Szacunkowy koszt |
|---|---|---|---|---|
| Tagowanie | Zamienia zdjęcie ubrania w atrybuty i opis | Claude Opus 5.5; tańsza opcja: Haiku 4.5 | W tle, raz na ubranie | ok. 9 gr; na Haiku ok. 1,5 gr |
| Dobór zestawu | Wybiera trzy zestawy spośród ubrań dopuszczonych przez reguły | Claude Opus 5.5 | Synchronicznie, kilka sekund | ok. 14 gr za trzy propozycje |
| Wizualizacja | Rysuje sylwetkę w wybranym zestawie | Nano Banana 2 przez fal.ai | W tle, na żądanie | 0,08 USD, czyli ok. 31 gr za obraz |
| Usuwanie tła (pomocniczo) | Wycina ubranie ze zdjęcia | BiRefNet przez fal.ai | W tle, raz na ubranie | ok. 1 gr |

Dwie zasady, które z tego wynikają:

1. **Tani mózg, drogi obraz.** Dobór zestawu działa na tekście i kosztuje grosze, więc jest dostępny przy każdym otwarciu aplikacji. Obraz jest kilkukrotnie droższy i powstaje tylko wtedy, gdy użytkownik o niego poprosi.
2. **Opis powstaje raz.** Model ogląda zdjęcie ubrania tylko przy tagowaniu. Stylista i generator obrazu korzystają potem z gotowego opisu tekstowego.

Każdy model jest schowany za interfejsem, a jego identyfikator jest w konfiguracji. Zmiana modelu to zmiana ustawienia, nie kodu.

---

## 4. Architektura

```
Telefon (Expo)
  │
  ├── HTTPS / JSON ──► Caddy ──► Backend .NET 10 ─────────► PostgreSQL
  │                               │  moduły: Konto, Szafa,     (dane i kolejka zadań)
  │                               │  Stylista, Wizualizacja
  │                               │  Hangfire: zadania w tle
  │                               │
  │                               ├──► fal.ai: usuwanie tła, Nano Banana
  │                               ├──► Claude: tagowanie, dobór zestawu
  │                               └──► Open-Meteo: prognoza pogody
  │
  └── PUT pliku (pre-signed URL) ──► magazyn plików (R2) ◄── backend (podpisy, wyniki)
```

Zdjęcia nigdy nie przechodzą przez backend. Telefon wysyła je prosto do magazynu, a dostawcy AI pobierają je przez krótkotrwałe podpisane adresy. Backend przenosi tylko wynik wizualizacji z serwera dostawcy do własnego magazynu.

### 4.1. Stos

| Warstwa | Wybór |
|---|---|
| Aplikacja | Aktualne Expo SDK, Expo Router, TypeScript w trybie ścisłym, TanStack Query, klient generowany z OpenAPI, `expo-image-picker`, `expo-image-manipulator`, `expo-image`, `expo-secure-store`, opcjonalnie `expo-location` |
| Backend | .NET 10, ASP.NET Core, EF Core, Identity z JWT i rotowanym refresh tokenem, Hangfire z magazynem w PostgreSQL |
| Integracje | Oficjalny pakiet `Anthropic` dla .NET; zwykły `HttpClient` do kolejki fal.ai i do Open-Meteo |
| Dane | PostgreSQL; magazyn plików zgodny z S3 (Cloudflare R2) |
| Development | PostgreSQL w Docker Compose; API lokalnie przez `dotnet watch` albo w tym samym Compose; osobny bucket deweloperski w R2 |
| Wdrożenie | Jedna VM, ten sam Docker Compose, Caddy z automatycznym TLS; najpierw dla testerów, osobne środowisko komercyjne w ostatnim etapie |

### 4.2. Moduły backendu

Jeden wdrażany proces, trzy projekty (`FitIt.Api`, `FitIt.Core`, `FitIt.Infrastructure`) i testy. `Core` nie zna dostawców; zależy tylko od interfejsów.

| Moduł | Odpowiada za | Interfejsy do świata zewnętrznego |
|---|---|---|
| Konto | Rejestracja, sesje, profil, zgody, usuwanie konta | — |
| Szafa | Ubrania, wysyłka zdjęć, przetwarzanie w tle | `IImageStorage`, `IBackgroundRemover`, `IGarmentTagger` |
| Stylista | Profil pogody, okazje, filtr kandydatów, dobór, walidacja, zestawy | `IWeatherProvider`, `IOutfitStylist` |
| Wizualizacja | Sylwetki, zlecenia obrazów, statusy | `IOutfitVisualizer`, `IImageStorage` |
| Wspólne | Liczniki limitów, dziennik kosztów AI | — |

---

## 5. Szafa: przetwarzanie i schemat tagów

### 5.1. Dodanie ubrania

1. Telefon zmniejsza zdjęcie do 1280 px na dłuższym boku i zapisuje jako JPEG (ok. 200–350 kB).
2. `POST /api/uploads` zwraca pre-signed URL ważny 5 minut; telefon wysyła plik prosto do magazynu.
3. `POST /api/clothes` z kluczem obiektu. Backend sprawdza w magazynie typ i rozmiar pliku, zwiększa dzienny licznik, tworzy rekord `Processing` i zleca zadanie.
4. Zadanie: usunięcie tła → zapis wycinka → tagowanie → `Ready`. Do trzech ponowień. Gdy usuwanie tła zawiedzie, wycinkiem zostaje oryginał; gdy zawiedzie tagowanie, ubranie przechodzi w `Failed` i czeka na ręczne uzupełnienie tagów.
5. Aplikacja pokazuje ubranie od razu jako „w trakcie” i odpytuje listę co 2–3 sekundy, dopóki coś się przetwarza.
6. Raz na dobę zadanie cykliczne usuwa pliki bez rekordu starsze niż 24 godziny.

### 5.2. Schemat tagów

Wszystkie listy są zamknięte. Dzięki temu filtry działają, a reguły stylisty mają na czym się oprzeć.

| Atrybut | Wartości |
|---|---|
| `category` | góra, warstwa (sweter, bluza, kardigan, marynarka, kamizelka), dół, jednoczęściowe, okrycie wierzchnie, obuwie, dodatki |
| `subcategory` | Lista ok. 45 typów przypisanych do kategorii, np. koszula, T-shirt, jeansy, szorty, sukienka, płaszcz, sneakersy, sandały, szalik |
| `colors` | Kolor główny i opcjonalnie drugi, ze słownika 17 nazw |
| `pattern` | gładki, paski, krata, kwiaty, nadruk, inny |
| `material` | bawełna, denim, wełna, len, skóra, zamsz, syntetyk, dzianina, jedwab, puch, inny |
| `formality` | 1 sportowe lub domowe · 2 codzienne · 3 smart casual · 4 biznesowe · 5 formalne lub wieczorowe |
| `warmth` | 1 na upał · 2 lekkie · 3 przejściowe · 4 ciepłe · 5 na mróz |
| `rain_ok` | Czy nadaje się na deszcz |
| `styles` | Podzbiór z: casual, smart, elegancki, sportowy, streetwear |
| `name` | Krótka nazwa po polsku do wyświetlenia, np. „Granatowa koszula oxford” |
| `description` | Jedno zdanie po angielsku dla modeli: krój, kolor, detale |

W poprzedniej specyfikacji brakowało kategorii jednoczęściowych, warstwy pośredniej, formalności, ciepła i odporności na deszcz. Bez nich nie da się dobrać stroju ani do okazji, ani do pogody.

Skale `formality` i `warmth` są opisane w zapytaniu do modelu przykładami kotwiczącymi (ciepło 1: T-shirt, szorty, sandały; ciepło 3: sweter, jeansy, kurtka przejściowa; ciepło 5: kurtka puchowa, buty zimowe). Bez kotwic ten sam sweter raz dostałby 3, raz 4.

### 5.3. Odpowiedź modelu tagującego

Wymuszona schematem JSON (structured outputs), więc zawsze da się ją sparsować:

```json
{
  "is_supported": true,
  "reject_reason": null,
  "category": "góra",
  "subcategory": "koszula",
  "name": "Granatowa koszula oxford",
  "description": "navy blue oxford cotton shirt, button-down collar, long sleeves, regular fit",
  "colors": ["granatowy"],
  "pattern": "gładki",
  "material": "bawełna",
  "formality": 4,
  "warmth": 2,
  "rain_ok": false,
  "styles": ["smart", "elegancki"]
}
```

`is_supported` ma wartość `false`, gdy na zdjęciu nie ma ubrania, jest kilka ubrań naraz albo jest to bielizna lub strój kąpielowy. Takie zdjęcie nie trafia do szafy, a użytkownik dostaje wyjaśnienie.

---

## 6. Stylista: dobór pod pogodę i okazję

### 6.1. Zasada: reguły pilnują, model wybiera

Sam model językowy dobierze ładny zestaw, ale czasem zaproponuje szorty przy pięciu stopniach albo ubranie, którego nie ma w szafie. Same reguły nigdy tak nie zrobią, ale nie mają wyczucia stylu. Dlatego silnik składa się z pięciu kroków:

```
1. Kontekst          pogoda, okazja, profil, historia            kod
2. Filtr kandydatów  twarde reguły pogody i okazji               kod
3. Wybór             trzy zestawy spośród kandydatów             Claude
4. Walidacja, ocena  komplet, wymagania pogody, spójność         kod
5. Tryb awaryjny     zestaw z samych reguł, gdy krok 3 zawiedzie kod
```

Model dostaje wyłącznie ubrania, które już przeszły przez reguły, a jego odpowiedź jest sprawdzana, zanim zobaczy ją użytkownik. Wszystko, co da się rozstrzygnąć jednoznacznie, rozstrzyga kod; model zostaje przy tym, w czym jest dobry: zestawianiu kolorów, proporcji i stylu oraz tłumaczeniu wyboru.

Cel doboru wynika wprost z problemu. Zestaw ma nadawać się do założenia dziś, a kolejne propozycje mają poszerzać to, co użytkownik nosi, zamiast podsuwać w kółko te same bezpieczne rzeczy. Dlatego każda z trzech propozycji jest innego typu:

| Typ propozycji | Zasada |
|---|---|
| Pewniak | Ubrania lubiane i często wybierane; najbezpieczniejszy wybór na dziś |
| Odkrycie | Zawiera co najmniej jedno zapomniane ubranie |
| Nowe połączenie | Zestawienie góry i dołu, którego użytkownik jeszcze nie założył |

**Zapomniane ubranie** to takie, które użytkownik oznaczył jako „rzadko noszę”, albo takie, którego nie wybrał przez „Zakładam to” od 30 dni. W pierwszym miesiącu aplikacja zna tylko oznaczenia, dlatego onboarding prosi o dodanie także kilku rzeczy leżących bez użycia.

### 6.2. Profil pogody

Prognoza godzinowa dla miejsca z profilu, pobierana z Open-Meteo i zapamiętywana na godzinę. Miejsce to domyślnie lokalizacja telefonu: aplikacja prosi o zgodę systemową, zaokrągla współrzędne do 0,1° i zapisuje je w profilu razem z nazwą miejscowości. Gdy zgody nie ma albo użytkownik woli, podaje miasto ręcznie (wyszukiwarka miejscowości Open-Meteo). Okno czasu: od teraz do 22:00, a po 20:00 jutrzejszy dzień od 7:00 do 22:00.

Z prognozy powstają: `feelsMin` i `feelsMax` (temperatura odczuwalna), `rainProb` (najwyższe prawdopodobieństwo opadu) i `rainMm` (suma opadu). Temperatura odniesienia to `T = feelsMin` z korektą profilu: minus 3°C dla „zwykle marznę”, plus 3°C dla „zwykle mi ciepło”.

| T | Wymagane | Wykluczone | Suma ciepła¹ |
|---|---|---|---|
| 25°C i więcej | — | okrycie wierzchnie; elementy o cieple 4–5 | 1–2 |
| 18–24°C | — | elementy o cieple 5 | 1–3 |
| 11–17°C | warstwa pośrednia lub okrycie | sandały, klapki; elementy o cieple 5 | 4–6 |
| 3–10°C | okrycie o cieple co najmniej 3; zakryte buty | szorty, sandały, klapki | 6–9 |
| 2°C i mniej | okrycie o cieple co najmniej 4 i warstwa pośrednia; zakryte buty | jak wyżej oraz buty o cieple 1 | 9–13 |

¹ Góra + warstwa pośrednia + okrycie wierzchnie.

Dodatkowo:

- **Deszcz** (`rainProb` od 50% albo `rainMm` od 1 mm): wymagane okrycie z `rain_ok`, jeśli jest w szafie; buty z zamszu wykluczone, jeśli zostaje alternatywa. Gdy szafa nie ma nic na deszcz, propozycja dostaje notkę „weź parasol”.
- **Duża amplituda** (`feelsMax − feelsMin` od 8°C): model dostaje polecenie ułożenia zestawu warstwowego, z warstwą do zdjęcia w cieplejszej części dnia.

Progi to wartości startowe trzymane w konfiguracji. Są do skalibrowania na testerach.

### 6.3. Okazje

| Okazja | Formalność | Dodatkowa reguła |
|---|---|---|
| Na co dzień | 1–3 | — |
| Praca lub uczelnia | 2–4 | bez stylu sportowego |
| Spotkanie biznesowe | 4–5 | — |
| Randka lub wieczorne wyjście | 2–4 | preferowany styl elegancki |
| Wyjście ze znajomymi | 1–3 | — |
| Trening | 1 | tylko styl sportowy |

Do okazji można dopisać notatkę wolnym tekstem. Okazja wyznacza twardy zakres, notatka trafia do modelu jako niuans.

### 6.4. Filtr kandydatów

Kolejno odpadają ubrania: nieprzetworzone i „w praniu”; wykluczone przez pogodę; spoza zakresu formalności; niezgodne z regułą stylu.

Szafa w MVP będzie mała, więc filtr musi umieć ustąpić. Gdy do wymaganej roli nie zostaje żaden kandydat, reguły są luzowane tylko dla tej roli, w kolejności: zakres formalności szerszy o 1 → bez reguły stylu → ciepło z tolerancją o 1. Każde poluzowanie jest zapisywane i pokazywane użytkownikowi („Nie masz formalnego okrycia na tę temperaturę, więc proponuję najcieplejsze, jakie jest”). Gdy rola dalej jest pusta, backend nie wywołuje modelu, tylko odpowiada, czego brakuje w szafie.

Do modelu trafia najwyżej 12 kandydatów na rolę w zestawie: połowa spośród lubianych i często wybieranych, połowa spośród zapomnianych. Model ma dzięki temu z czego ułożyć i pewniaka, i odkrycie.

### 6.5. Zapytanie do modelu

Stała część (rola, zasady komponowania, trzy typy propozycji, język uzasadnienia) siedzi w prompcie systemowym, wersjonowanym w repozytorium. Część zmienna to jeden obiekt JSON:

```json
{
  "weather": { "feels_min": 4, "feels_max": 9, "rain": true, "needs_layers": false,
               "requires": ["okrycie o cieple >= 3", "zakryte buty", "okrycie na deszcz"] },
  "occasion": { "name": "Praca lub uczelnia", "formality": [2, 4],
                "note": "prezentacja przed klientem" },
  "profile": { "styles": ["smart"], "thermal": "zwykle marznę" },
  "base_item": "T3",
  "relaxations": [],
  "recent": [["T1", "B2", "S1"]],
  "liked": [["T3", "M1", "B1", "S2"]],
  "disliked": [["T5", "B4", "S3"]],
  "candidates": [
    { "id": "T3", "role": "góra", "sub": "koszula", "colors": ["granatowy"], "pattern": "gładki",
      "formality": 4, "warmth": 2, "worn": 6, "forgotten": false,
      "desc": "navy oxford shirt, button-down collar" }
  ]
}
```

Ubrania mają w zapytaniu krótkie aliasy (`T3`, `B2`) zamiast identyfikatorów GUID. To mniej tokenów i mniej okazji do przekręcenia identyfikatora.

Odpowiedź jest wymuszona stałym schematem JSON:

```json
{
  "outfits": [
    { "kind": "pewniak", "top": "T3", "mid": "M1", "bottom": "B1", "one_piece": null,
      "outerwear": "O2", "shoes": "S2", "accessories": ["A1"],
      "reasoning": "Granat i szarość dają spokojną bazę pod prezentację, a wełniany płaszcz wystarczy na 4 stopnie.",
      "weather_note": "Po południu ma padać, płaszcz jest wodoodporny." }
  ]
}
```

Schemat jest ten sam dla wszystkich żądań. Schemat budowany osobno dla każdego użytkownika (z listą dozwolonych aliasów) wymusiłby poprawne identyfikatory już w modelu, ale każdy nowy schemat jest kompilowany przy pierwszym użyciu, co wydłużyłoby każdą odpowiedź. Poprawność identyfikatorów sprawdza więc walidator.

Ustawienia startowe: `claude-opus-5-5`, niski poziom `effort`. Do pomiaru w Etapie 0.

### 6.6. Walidator i ocena

**Twarde reguły.** Zestaw, który je łamie, jest odrzucany.

- Każdy alias istnieje wśród kandydatów i pasuje do swojej roli.
- Jest góra i dół albo rzecz jednoczęściowa; są buty.
- Warstwa pośrednia pochodzi z kategorii „warstwa” i nie jest tym samym ubraniem co góra.
- Są wszystkie elementy wymagane przez pogodę.
- Żadne ubranie nie powtarza się w zestawie; ubranie bazowe jest w każdej propozycji.
- Propozycje różnią się między sobą co najmniej dwoma elementami, o ile szafa na to pozwala.

**Typ propozycji** jest sprawdzany osobno. Etykieta „Odkrycie” albo „Nowe połączenie” pojawia się tylko wtedy, gdy zestaw faktycznie spełnia jej warunek. Zestaw, który go nie spełnia, zostaje, ale bez etykiety.

**Ocena spójności.** Liczba od 0 do 100, według której propozycje są sortowane.

| Kryterium | Kara |
|---|---|
| Suma ciepła poza zakresem z tabeli pogody | 15 punktów za każdy punkt odchylenia |
| Rozrzut formalności między elementami większy niż 2 | 10 za każdy punkt ponad |
| Więcej niż trzy kolory spoza neutralnych | 10 za każdy dodatkowy |
| Więcej niż jeden wyrazisty wzór | 10 za każdy dodatkowy |
| Element z zestawu założonego w ostatnich dwóch dniach | 5 za element |

Gdy po walidacji nie zostaje żadna propozycja, backend ponawia zapytanie raz, dołączając listę błędów. Potem przechodzi w tryb awaryjny.

### 6.7. Tryb awaryjny

Generator regułowy losuje 20 poprawnych zestawów z kandydatów, ocenia je tą samą funkcją i zwraca trzy z szablonowym uzasadnieniem: najlepiej oceniony, najlepszy z zapomnianym ubraniem i najlepszy różny od obu. Uruchamia się, gdy model nie odpowiada, odmawia (`stop_reason: "refusal"`), dwa razy zwraca niepoprawne zestawy albo przekroczony jest dzienny budżet AI.

Ma dwie funkcje. Aplikacja działa, gdy model jest niedostępny. I jest punktem odniesienia: porównanie zestawów modelu z zestawami samych reguł pokazuje, ile model faktycznie wnosi.

### 6.8. Uczenie się preferencji

Bez trenowania własnego modelu. Do zapytania trafia pięć ostatnich polubionych i pięć ostatnich odrzuconych zestawów jako przykłady. Ubrania z zestawów założonych w ostatnich dwóch dniach mają niższy priorytet. Preferencja termiczna przesuwa progi pogody. Liczniki noszenia i oznaczenie „rzadko noszę” decydują o tym, co jest pewniakiem, a co odkryciem. Każda ocena i każde „Zakładam to” są zapisywane razem z pogodą i okazją, więc dane do późniejszej, lepszej personalizacji zbierają się od pierwszego dnia.

### 6.9. Jak sprawdzić, że dobiera sensownie

Projekt konsolowy `FitIt.Eval` uruchamia silnik na macierzy scenariuszy: trzy przykładowe szafy (12, 30 i 60 ubrań) × pięć przedziałów pogody × sześć okazji.

- Automatycznie: liczba naruszeń twardych reguł (ma wynosić 0), odsetek odpowiedzi z poprawnym odkryciem, gdy wśród kandydatów jest zapomniane ubranie, odsetek żądań obsłużonych trybem awaryjnym, czas i koszt.
- Ręcznie, na próbce: czy zestaw nadaje się do założenia (cel: co najmniej 70%).
- Porównawczo: model kontra same reguły, na tej samej próbce.

Ten sam zestaw scenariuszy uruchamia się przed każdą zmianą promptu lub modelu. To zabezpieczenie przed regresją i gotowy materiał do rozdziału o testach.

---

## 7. Wizualizacja na sylwetce (Nano Banana)

### 7.1. Zasada: obraz na żądanie

Propozycje są widoczne natychmiast jako kolaże. Obraz powstaje dopiero po dotknięciu „Pokaż na sylwetce” przy wybranym zestawie. Użytkownik zwykle przegląda kilka propozycji, zanim którąś wybierze, a obraz kosztuje ok. 31 gr i powstaje kilkanaście do kilkudziesięciu sekund. Generowanie go dla każdej propozycji pomnożyłoby koszt bez korzyści.

Kolaż zostaje widoczny także obok gotowego obrazu. Pokazuje prawdziwe zdjęcia ubrań, więc jest wiernym odniesieniem, a obraz jest podpisany jako wizualizacja poglądowa.

### 7.2. Dlaczego Nano Banana, a nie klasyczny Try-On

Modele z poprzedniej specyfikacji (IDM-VTON, OOTDiffusion) nakładają jedno ubranie na przebieg i mają licencję niekomercyjną. Nano Banana to model edycji obrazu przyjmujący do 14 obrazów wejściowych, więc cały zestaw, łącznie z butami i okryciem, powstaje w jednym przebiegu, na warunkach komercyjnego API.

| Wariant | Cena za obraz 1K | Rola |
|---|---|---|
| Nano Banana 2 Lite | ok. 0,03 USD (13 gr) w API Google | Najszybszy i najtańszy; do sprawdzenia, czy trzyma detale ubrań |
| Nano Banana 2 | 0,08 USD (31 gr) na fal.ai | Domyślny |
| Nano Banana Pro | 0,15 USD (58 gr) na fal.ai | Najwyższa jakość; rezerwa, gdyby wierność wersji 2 nie wystarczała |

Etap 0 porównuje wszystkie trzy na tych samych dziesięciu zestawach. Gdyby żaden nie spełnił kryteriów, za tym samym interfejsem `IOutfitVisualizer` można podstawić dedykowany model przymierzania (FASHN, Kling Kolors) kosztem ograniczenia do góry i dołu.

Dostęp przez fal.ai, a nie bezpośrednio przez API Google, bo fal.ai przyjmuje obrazy jako adresy URL (backend nie przesyła bajtów), ma wbudowaną kolejkę i jest już używany do usuwania tła. Jedna integracja obsługuje oba zadania i pozwala zmieniać modele jednym ustawieniem.

### 7.3. Sylwetka

Użytkownik podaje płeć, a potem wybiera jeden z pięciu gotowych typów sylwetki dla tej płci; może go zmienić w profilu. Aplikacja nie przyjmuje zdjęć użytkownika.

- **Pochodzenie.** Sylwetki to obrazy wygenerowane raz, tym samym modelem, więc nie przedstawiają żadnej prawdziwej osoby. Nie zawierają danych użytkownika, dlatego są zwykłymi publicznymi plikami.
- **Zestaw startowy.** Dziesięć sylwetek. Damskie: klepsydra, gruszka, jabłko, kolumna, kielich. Męskie: trójkąt, odwrócony trójkąt, prostokąt, owal, trapez. To zwykłe wiersze w tabeli `avatars` (z płcią i typem) i pliki statyczne, więc dodanie kolejnych nie wymaga zmian w kodzie. Do czasu przygotowania docelowych renderów używane są miniatury zastępcze z `docs/design/zasoby`.
- **Jednolity standard.** Kadr 3:4, cała postać przodem w neutralnej pozie, jasne jednolite tło, równe światło, gładki dopasowany strój bazowy. Strój zakrywa ciało, co zmniejsza liczbę blokad filtra, i łatwo daje się zastąpić ubraniami z szafy.
- **Wybór.** Sylwetki są pokazywane z nazwą typu, bo przy pięciu wariantach same miniatury trudno odróżnić; użytkownik wskazuje najbliższą sobie.

Skutki tej decyzji: MVP nie przetwarza niczyjego wizerunku, więc odpada osobna zgoda, kontrola zdjęć i ryzyko wgrania cudzej fotografii. Ceną jest słabszy efekt „to ja”. Własne zdjęcie można dodać później bez zmian w przepływie, jako kolejny rodzaj rekordu w `avatars`.

### 7.4. Zapytanie do modelu obrazu

Wejście: obraz wybranej sylwetki i wycinki ubrań w kolejności ról; do obrazu trafiają najwyżej dwa dodatki. Parametry: rozdzielczość 1K, proporcje 3:4, format JPEG. Treść powstaje z szablonu wypełnionego opisami z tagowania:

```
Image 1 shows a person. The other images show individual garments:
2: navy blue oxford cotton shirt, button-down collar (top)
3: beige slim chinos (bottom)
4: white leather low-top sneakers (shoes)
5: grey wool overcoat, worn open (outerwear)
Generate a photorealistic full-body photo of the same person wearing exactly these garments.
Keep the face, hair, skin tone, body shape and pose unchanged.
Reproduce the colour, pattern, cut and details of every garment exactly.
Do not add, remove or restyle garments.
Plain light studio background, soft even light, whole body visible including shoes.
```

Zapytanie powstaje w całości na serwerze. Użytkownik nie wpisuje własnego tekstu do generatora obrazu, a jego notatka do okazji trafia tylko do stylisty.

### 7.5. Przepływ

1. `POST /api/outfits/{id}/visualizations` z nagłówkiem `Idempotency-Key` (identyfikator losowany przez aplikację przy dotknięciu przycisku).
2. W jednej transakcji backend zwiększa dzienny licznik, o ile nie przekroczył limitu, i tworzy rekord `Pending`. Odpowiada kodem 202.
3. Zadanie w tle wysyła zlecenie do kolejki fal.ai i od razu zapisuje identyfikator zlecenia dostawcy. Potem odpytuje o status.
4. Zakończenie:
   - sukces: obraz jest kopiowany do własnego magazynu, status `Completed`;
   - blokada filtra bezpieczeństwa: status `Blocked`;
   - błąd albo brak wyniku po 3 minutach: status `Failed`.

   Przy `Blocked` i `Failed` licznik jest cofany.
5. Aplikacja odpytuje `GET /api/visualizations/{id}` co 2–3 sekundy. Po wyjściu z ekranu wynik czeka przy zestawie.

To jest wzorzec z sekcji 5.2 poprzedniej specyfikacji, poprawiony w trzech miejscach:

- **Limit w bazie, nie w Redis.** Licznik to jedno atomowe polecenie PostgreSQL w tej samej transakcji, która tworzy zlecenie.
- **Brak podwójnych zleceń.** Identyfikator zlecenia dostawcy jest zapisywany przed odpytywaniem, więc ponowione zadanie wznawia odpytywanie zamiast zamawiać drugi obraz. Powtórzone żądanie aplikacji z tym samym kluczem zwraca istniejący rekord.
- **Zwrot przy niepowodzeniu.** Użytkownik nie traci limitu na obraz, którego nie dostał.

Gdy w przyszłości pojawią się płatne kredyty, licznik dzienny zostanie zastąpiony saldem, a reszta przepływu się nie zmieni.

### 7.6. Znane ograniczenia

- **Filtry bezpieczeństwa.** Google w 2026 roku zaostrzył klasyfikator obrazów i blokuje część zwykłych zdjęć modowych (stroje kąpielowe, bielizna, odsłonięta skóra). Dlatego MVP nie obsługuje bielizny i strojów kąpielowych, a `Blocked` jest zwykłym wynikiem z czytelnym komunikatem, a nie błędem.
- **Wierność.** Drobne wzory, napisy i logotypy mogą wyjść inaczej niż na zdjęciu, a postać może nieznacznie różnić się od wybranej sylwetki. Stąd kolaż obok obrazu i podpis „wizualizacja poglądowa”.
- **Nadużycia.** Do generatora nie trafia zdjęcie żadnej prawdziwej osoby ani tekst wpisany przez użytkownika, a bielizna i stroje kąpielowe są odrzucane przy tagowaniu. Zostaje ryzyko wgrania jako „ubrania” czegoś, co ubraniem nie jest; ogranicza je odrzucanie przy tagowaniu i filtr dostawcy.
- **Oznaczenie.** Obrazy z modeli Google zawierają niewidoczny znak wodny SynthID.

---

## 8. Model danych

| Tabela | Najważniejsze pola |
|---|---|
| `users` (Identity) | `display_name`, `birth_date`, `gender`, `style_preferences`, `thermal_preference`, `location_source` (Device, Manual), `location_name`, `lat`, `lon`, `avatar_id`, `ai_consent_at` |
| `refresh_tokens` | `user_id`, `token_hash`, `expires_at`, `revoked_at` |
| `clothing_items` | `user_id`, `status`, `original_key`, `cutout_key`, atrybuty z sekcji 5.2, `in_laundry`, `rarely_worn`, `wear_count`, `last_worn_on` |
| `avatars` | `gender`, `body_type`, `label`, `image_path`, `thumb_path`, `sort_order`, `is_active`; dziesięć wierszy wgrywanych przy starcie |
| `outfits` | `user_id`, `request_id` (łączy trzy propozycje z jednego żądania), `occasion`, `occasion_note`, `weather_snapshot`, `relaxations`, `source` (Model, Rules), `kind` (pewniak, odkrycie, nowe połączenie albo brak), `score`, `reasoning`, `weather_note`, `rating`, `is_saved`, `worn_on`, `prompt_version`, `model` |
| `outfit_items` | `outfit_id`, `clothing_item_id`, `slot` |
| `visualizations` | `user_id`, `outfit_id`, `avatar_id`, `status` (Pending, Running, Completed, Failed, Blocked), `model`, `provider_request_id`, `image_key`, `error_code`, `idempotency_key`, `cost_usd` |
| `usage_counters` | `user_id`, `day`, `kind` (ItemAdded, Suggestion, Visualization), `count` |
| `ai_usage_log` | `user_id`, `operation`, `model`, `cost_usd`, `duration_ms`, `success` |

`weather_snapshot` i `occasion` są zapisywane przy każdym zestawie razem z oceną. Każda propozycja staje się więc rekordem „kontekst → wybór → reakcja”, czyli danymi do kalibracji progów i do późniejszej personalizacji.

---

## 9. API

```
Konto
GET    /api/avatars?gender=   lista gotowych sylwetek dla płci; dostępna bez logowania
GET    /api/dictionaries      kody i polskie nazwy słowników; dostępne bez logowania
POST   /api/auth/email-check  czy adres jest wolny (pierwszy krok rejestracji)
POST   /api/auth/register     e-mail, hasło, imię, data urodzenia, płeć, sylwetka, style, preferencja termiczna, miejsce pogody
POST   /api/auth/login | refresh | logout
GET    /api/locations?query=  wyszukiwanie miejscowości, gdy nie ma lokalizacji telefonu
GET    /api/me                PATCH /api/me              DELETE /api/me
GET    /api/me/usage          pozostałe limity na dziś

Szafa
POST   /api/uploads           pre-signed URL i klucz obiektu dla zdjęcia ubrania
POST   /api/clothes           GET /api/clothes?q=&category=&forgotten=
GET    /api/clothes/stats     wykorzystanie szafy w ostatnich 30 dniach
GET    /api/clothes/{id}      PATCH /api/clothes/{id}    DELETE /api/clothes/{id}
POST   /api/clothes/{id}/reprocess

Stylista
GET    /api/weather/today     profil pogody dla miejsca z profilu
POST   /api/outfits/suggestions    okazja, notatka, ubranie bazowe → trzy propozycje
GET    /api/outfits?saved=true     GET /api/outfits/{id}
PATCH  /api/outfits/{id}           zapis, ocena, „Zakładam to”
DELETE /api/outfits/{id}

Wizualizacja
POST   /api/outfits/{id}/visualizations    202 i rekord Pending
GET    /api/visualizations/{id}            status i adres obrazu

GET    /health
```

Zdjęcia leżą w prywatnym magazynie. API zwraca do nich podpisane adresy ważne godzinę, a aplikacja zapamiętuje obrazy pod kluczem obiektu (`cacheKey` w `expo-image`), żeby zmieniający się podpis nie wymuszał ponownego pobierania.

---

## 10. Aplikacja mobilna

Cztery zakładki: Dziś, Szafa, Outfity, Profil. Wygląd każdego ekranu i jego stanów jest w `docs/design` (strony HTML, obrazy PNG i generator); to one są wzorcem przy implementacji. Ekrany:

| Ekran | Zawartość |
|---|---|
| Start | Mozaika ubrań, znak, hasło, „Załóż konto” i „Mam już konto” |
| Logowanie | Formularz e-mail i hasło |
| Rejestracja | Pięć kroków: konto; imię, data urodzenia i płeć; typ sylwetki; styl (można pominąć); pogoda z lokalizacji i odczuwanie temperatury, z ekranem zapasowym do wpisania miasta |
| Dziś | Pogoda bez ramki (miejsce, temperatura, jedno zdanie, ikona nieba), kafle okazji, notatka, „Zaproponuj zestawy”; stan bez lokalizacji i stan „brakuje w szafie” |
| Propozycje | Trzy zakładki, po jednej na propozycję: etykieta typu, kolaż, uzasadnienie, notka pogodowa, kciuki, „Zapisz”, „Zakładam to”, „Pokaż na sylwetce” z postępem i wynikiem |
| Szafa | Siatka ubrań, wyszukiwanie po nazwie, filtr kategorii i zapomnianych, wskaźnik wykorzystania szafy, stany „w trakcie” i „błąd” |
| Dodawanie | Aparat lub galeria, wiele zdjęć, kolejka wysyłania |
| Ubranie | Wycinek, edycja tagów, „w praniu”, „rzadko noszę”, „Dobierz do tego”, usuwanie |
| Outfity | Zapisane zestawy z miniaturami obrazów |
| Profil | Imię, data urodzenia, płeć, źródło pogody, preferencja termiczna, style, zmiana sylwetki, limity, zgoda na AI, usuwanie konta |

Aplikacja jest cienkim klientem: wyświetla dane i wysyła żądania. Cała logika doboru, limitów i walidacji jest na backendzie.

### 10.1. Język wizualny

Wygląd został ustalony w czterech rundach makiet i jest zapisany w `docs/design`. Zachowanie i strukturę wyznaczają pakiety VectorLab (wzorce stron, formularze, stany, teksty, ruch), a zakazy szablonowych wzorców `design-taste-frontend` i `anti-slop`. Wszystkie są pisane pod strony WWW, więc w aplikacji obowiązują w przekładzie na tokeny React Native. Wiążący, szczegółowy zapis to plik `.ux-profile.md` w katalogu głównym repozytorium; ta sekcja jest jego streszczeniem.

Gdy źródła są sprzeczne, pierwszeństwo mają kolejno: wymogi platformy i dostępności, makiety z `docs/design`, profil, pakiet VectorLab właściwy dla zadania, `design-taste-frontend`. Ten ostatni wprost wyłącza natywne aplikacje mobilne i w pełni obowiązuje dopiero przy stronie promującej.

| Obszar | Zasada |
|---|---|
| Kolory | Wyłącznie przez tokeny, w wariancie jasnym i ciemnym, zgodnie z ustawieniem systemu. Jasny: tło `#F5F7F3`, powierzchnia `#FFFFFF`, tekst `#1F2A25`, tekst drugorzędny `#57625C`, linie `#E1E6DF`, obramowanie pól `#838A84`. Jeden kolor: szałwia `#DCE7DA` jako tło każdego ubrania i sylwetki, wypełnienie zaznaczenia i najwyżej jeden panel wyróżnienia na ekran. |
| Akcent | Butelkowa zieleń `#2F5D4C` dla przycisku głównego, linków, postępu, aktywnej zakładki i akcentu w nagłówku. Czerwień `#A33B3B` tylko przy usuwaniu. Żadnych innych barw. |
| Typografia | Nagłówki Bricolage Grotesque 600, tekst Figtree 400 i 600. Skala: 12, 14, 16, 19, 23, 33. Treść nigdy poniżej 14; rozmiar 12 tylko dla metadanych. |
| Kształt | Kontrolki 10, karty 16, kafle ubrań 12, arkusze 20; pigułki tylko dla zakładek propozycji i filtrów. Linia 1 px zamiast cieni. Treść leży wprost na ekranie, a ramki są wyjątkiem: pogoda, wskaźnik wykorzystania szafy i nagłówek profilu nie mają ramek. |
| Odstępy | Wartości 4, 8, 12, 16, 24, 32, 48, 64. Margines ekranu 16, odstęp między sekcjami 32, wysokość kontrolek 48. |
| Stany | Każdy ekran ma stan ładowania, pusty i błędu. Do 100 ms nic się nie pokazuje, do sekundy wskaźnik w miejscu, dłużej szkielet w kształcie docelowego układu. Stan pusty zostaje w ramie ekranu i ma jedno działanie. |
| Formularze | Etykieta nad polem; walidacja po opuszczeniu pola; przycisk wysyłki zawsze aktywny; błąd pod polem, znika przy poprawce. Kontrast tekstu co najmniej 4,5:1. |
| Ruch | Czasy 100, 150, 200 i 300 ms, bez sprężynowania. Tylko przezroczystość i przesunięcie. Wyłączany przy systemowym ograniczeniu ruchu. |
| Ikony | Jedna rodzina (Phosphor) w grubości bold; ikony pogody w wariancie duotone z szałwiowym wypełnieniem. Bez emoji i bez ręcznie rysowanych ikon. |
| Teksty | Ciepły, prosty polski. Przyciski zaczynają się od czasownika. Błędy nie obwiniają i podają wyjście. Bez pauz, sloganów i zmyślonych liczb. Jedno działanie ma w całej aplikacji jedną nazwę. |

Każdy ekran ma jeden nazwany wzorzec z katalogu VectorLab:

| Ekran | Wzorzec |
|---|---|
| Start, logowanie, reset hasła | Formularz uwierzytelniania, bez paska zakładek |
| Rejestracja (pięć kroków) | Formularz w krokach z paskiem postępu |
| Dziś | Formularz: pogoda jako opis, okazja, notatka, jedno działanie |
| Propozycje | Szczegóły rekordu z trzema zakładkami, po jednej na propozycję |
| Szafa, Outfity | Lista: wyszukiwanie, jeden filtr, siatka kafli w ramce, licznik pozycji |
| Ubranie, zapisany zestaw | Szczegóły rekordu |
| Dodawanie zdjęć | Arkusz nad Szafą, nie osobna strona |
| Profil | Ustawienia: sekcje jedna pod drugą, strefa niebezpieczna na końcu |

---

## 11. Limity i koszty

### 11.1. Limity dzienne w becie

| Operacja | Limit na użytkownika |
|---|---|
| Nowe ubrania | 50 |
| Prośby o propozycje | 20 |
| Wizualizacje | 5 |

Do tego globalny dzienny budżet AI (startowo 10 USD). Po jego przekroczeniu tagowanie czeka do następnego dnia, stylista przechodzi w tryb awaryjny, a wizualizacje są wstrzymane. Limity i budżet są w konfiguracji.

### 11.2. Koszt aktywnego użytkownika

Założenia: 60 ubrań w szafie, jedna prośba o propozycje dziennie, osiem wizualizacji miesięcznie.

| Pozycja | Opus 5.5 w obu rolach | Haiku 4.5 do tagowania |
|---|---|---|
| Zbudowanie szafy, jednorazowo | ok. 5,8 zł | ok. 1,3 zł |
| Stylista, miesięcznie | ok. 4,1 zł | ok. 4,1 zł |
| Wizualizacje, miesięcznie | ok. 2,5 zł | ok. 2,5 zł |
| Beta 20 osób, pierwszy miesiąc | ok. 250 zł | ok. 160 zł |

Pełna szafa to raczej 150 ubrań niż 60. Jednorazowy koszt jej zbudowania rośnie wtedy do ok. 15 zł na Opus 5.5 i ok. 3 zł na Haiku 4.5, a miesiąc bety, w którym każdy z 20 testerów doda tyle ubrań, do ok. 430 zł albo ok. 200 zł. To najmocniejszy argument za tańszym modelem do tagowania.

### 11.3. Wniosek dla przyszłego cennika

- Darmowe powinno być to, co tanie: stylista z dziennym limitem. Płatne to, co drogie: wizualizacje.
- Abonament 29,99 zł daje 20,7 zł po VAT i prowizji sklepu. Przy marży 50% mieści stylistę i ok. 20 wizualizacji miesięcznie, a nie 100.
- Przy dużej liczbie darmowych użytkowników o ekonomii zdecyduje model stylisty: codzienne użycie kosztuje ok. 4 zł miesięcznie na Opus 5.5 i ok. 0,7 zł na Haiku 4.5. W becie to bez znaczenia; przed publicznym wydaniem warto zmierzyć, czy tańszy model dobiera równie dobrze.

---

## 12. Prywatność i bezpieczeństwo

**Dane.** E-mail, imię, data urodzenia (do potwierdzenia wieku), płeć (do doboru typów sylwetki), zdjęcia ubrań, miejsce pogody (współrzędne z telefonu albo wybranego miasta, zaokrąglone do 0,1°, bez historii miejsc), zestawy i oceny. Aplikacja nie przyjmuje zdjęć użytkownika, więc nie przetwarza niczyjego wizerunku.

**Odbiorcy.**

| Odbiorca | Co dostaje |
|---|---|
| Cloudflare R2 | Wszystkie pliki; bucket z jurysdykcją UE |
| fal.ai, a przez niego Google | Zdjęcia ubrań (usuwanie tła); wycinki ubrań i gotowa sylwetka (wizualizacja) |
| Anthropic | Wycinki ubrań (tagowanie); opisy tekstowe ubrań i kontekst (dobór) |
| Open-Meteo | Zaokrąglone współrzędne, bez identyfikatora użytkownika |

**Zgoda.** Jedna, przed pierwszym wysłaniem zdjęcia ubrania, z nazwami odbiorców, z datą w profilu i możliwością wycofania. Spełnia to wytyczną Apple 5.1.2(i).

**Minimalizacja u dostawców.** W wywołaniach fal.ai wyłączone jest przechowywanie treści żądań, a czas życia plików skrócony do minimum (nagłówki `X-Fal-Store-IO` i `X-Fal-Object-Lifecycle-Preference`).

**Usunięcie konta.** Dostępne z aplikacji. Rekordy znikają kaskadowo, a zadanie w tle usuwa wszystkie pliki użytkownika z magazynu, najpóźniej w ciągu doby.

**Kontrola dostępu.** Każde zapytanie do bazy jest filtrowane po `user_id`. Klucze obiektów mają prefiks użytkownika. Podpisane adresy nie trafiają do logów.

**Przed publicznym wydaniem.** Umowy powierzenia z dostawcami, opis transferu poza EOG w polityce prywatności, sprawdzenie warunków retencji u każdego dostawcy.

---

## 13. Wymagania niefunkcjonalne i zachowanie przy awariach

| Wymaganie | Cel |
|---|---|
| Propozycje zestawów | mediana poniżej 8 s, 95. percentyl poniżej 15 s |
| Przetworzenie ubrania | mediana poniżej 20 s od wysłania zdjęcia |
| Wizualizacja | mediana poniżej 40 s, twardy limit 3 minuty |
| Naruszenia twardych reguł w zwróconych zestawach | 0 |
| Dodanie 20 ubrań przez sieć komórkową | do 10 minut |

Żadna usługa zewnętrzna nie może zatrzymać aplikacji:

| Awaria | Zachowanie |
|---|---|
| Usuwanie tła | Wycinkiem zostaje oryginalne zdjęcie |
| Tagowanie | Ubranie czeka na ręczne tagi; można ponowić |
| Prognoza pogody | Ostatnia zapamiętana prognoza; bez niej propozycje z notką „brak danych o pogodzie” |
| Model stylisty | Tryb awaryjny z reguł |
| Generator obrazu | Zwrot limitu, komunikat, kolaż zostaje |
| Przekroczony budżet AI | Jak w sekcji 11.1 |

---

## 14. Testy

- **Jednostkowe:** profil pogody, filtr kandydatów z luzowaniem, walidator, funkcja oceny, liczniki limitów. To czysta logika bez zależności i tu powinna być największa gęstość testów.
- **Integracyjne:** API na prawdziwym PostgreSQL (Testcontainers) z atrapami dostawców AI. Ścieżki: konto, dodanie ubrania, propozycje, pełny cykl wizualizacji z niepowodzeniem i zwrotem limitu, usunięcie konta. Osobno testy, że użytkownik nie odczyta ani nie zmieni cudzych zasobów.
- **Ewaluacja AI:** `FitIt.Eval` z sekcji 6.9, do tego 30 zdjęć testowych dla tagowania i 10 zestawów dla wizualizacji. Uruchamiana ręcznie przed zmianą promptu lub modelu, nie w CI.

---

## 15. Świadomie poza MVP

| Funkcja | Powód |
|---|---|
| Własne zdjęcie sylwetki | Daje silniejszy efekt „to ja”, ale wymaga osobnej zgody, kontroli zdjęć i zabezpieczeń przed wgraniem cudzej fotografii. Do rozważenia po becie; przepływ wizualizacji się nie zmieni. |
| Strona promująca | Ostatni etap planu, po becie: potrzebuje prawdziwych zrzutów ekranu i wniosków od testerów. |
| Płatności, kredyty, subskrypcja | Najpierw trzeba sprawdzić, czy ktoś tego używa. Limity dzienne wystarczą, a przepływ wizualizacji jest gotowy na kredyty. Ekran zakupu subskrypcji jest zaprojektowany (`docs/design`, „Subskrypcja: zakup”), ale nie jest wdrażany: oferta, ceny i rozliczenia przez sklepy nie są ustalone. |
| Panel administratora | Zastępuje go dashboard Hangfire i zapytania SQL do `ai_usage_log`. |
| Afiliacja | Namawianie do zakupów kłóci się z problemem, który aplikacja rozwiązuje, a do tego wymaga ruchu, umów i feedu produktów. Odpowiedź „brakuje w szafie” z sekcji 6.4 zostaje informacją, a nie reklamą. |
| Poranna propozycja z powiadomieniem push | Wymaga konfiguracji powiadomień i zadań cyklicznych na użytkownika. |
| Kalibracja ciepła z pytania „jak było?” | Dobre rozwinięcie preferencji termicznej, ale potrzebuje danych z bety. |
| Automatyczna kontrola jakości obrazu | Drugi model oceniający wynik podwaja koszt. Decyzja po zmierzeniu odsetka nieudanych obrazów. |
| Asystent walizki, kalendarz, logowanie społecznościowe | Osobne przypadki użycia albo wygoda. |
| Redis, RabbitMQ, pgvector | Żadna funkcja MVP ich nie potrzebuje. |

---

## Źródła

Nano Banana:
- [Nano Banana 2 Edit na fal.ai](https://fal.ai/models/fal-ai/nano-banana-2/edit)
- [Nano Banana Pro Edit na fal.ai](https://fal.ai/models/fal-ai/nano-banana-pro/edit)
- [Ceny Nano Banana, 2 i Pro](https://benchlm.ai/media-pricing/nano-banana)
- [Nano Banana 2 Lite: przegląd cen](https://www.eesel.ai/blog/nano-banana-2-lite-pricing)
- [Nano Banana 2 Lite: premiera](https://venturebeat.com/technology/google-unveils-nano-banana-2-lite-aka-gemini-3-1-flash-lite-for-low-cost-4-second-fast-enterprise-image-generations)
- [Przymierzanie ubrań z Nano Banana, przykład implementacji](https://developer.vonage.com/en/blog/virtually-try-clothes-on-with-gemini-nano-banana-via-rcs)
- [Przewodnik po przymierzaniu w Nano Banana Pro](https://aitryon.art/blog/detail/The-Ultimate-Guide-to-AI-Clothes-Try-On-with-Nano-Banana-Pro-a0512f17d177/)
- [Forum Google: blokady zdjęć modowych przez IMAGE_SAFETY](https://discuss.ai.google.dev/t/nano-banana-pro-non-nsfw-fashion-images-blocked-due-to-aggressive-image-safety-filtering/121805)
- [Dlaczego Gemini blokuje zdjęcia modowe](https://vdobloom.com/blog/gemini-nano-banana-blocking-fashion-swimwear-images-alternative/)

Pozostałe usługi:
- [BiRefNet v2 na fal.ai](https://fal.ai/models/fal-ai/birefnet/v2)
- [fal.ai: FAQ, przechowywanie danych](https://docs.fal.ai/model-apis/faq)
- [fal.ai: czas życia plików](https://fal.ai/docs/documentation/model-apis/media-expiration)
- [Open-Meteo: cennik](https://open-meteo.com/en/pricing)
- [Open-Meteo: warunki](https://open-meteo.com/en/terms)
- [Kurs USD według NBP](https://www.totalmoney.pl/kursy-walut/nbp/kurs-USD)

Źródła dotyczące licencji modeli Try-On, wersji narzędzi i wymogów Apple są w [FitIt_Krytyka_Specyfikacji.md](FitIt_Krytyka_Specyfikacji.md).
