# Etap 3: stylista. Reguły pilnują, model wybiera, a dziś liczy się tam, gdzie jest człowiek

Stan na 7 października 2026. Notatki do pracy pisemnej (zadanie 3.21 planu).
Opisują to, co faktycznie działa w repozytorium, i dlaczego zostało zrobione w ten sposób.
Model językowy stylisty jest w tym etapie zastąpiony atrapą, więc część miar z planu (czas odpowiedzi modelu, jakość zestawów
oceniana przez człowieka, porównanie modelu z samymi regułami) pozostaje do zmierzenia. Sekcje 8 i 10 mówią dokładnie, które.
Notatka obejmuje zadania 3.1 do 3.16 i 3.21. Zadania 3.17 do 3.20 (serwer, wdrożenie, build testowy, wersja dla pięciu osób)
nie dotyczą kodu opisanego tutaj i nie są tu opisane ani potwierdzone.

## 1. Co działa po tym etapie

| Kryterium z planu (bramka etapu) | Wynik | Jak sprawdzono |
|---|---|---|
| Macierz scenariuszy bez naruszeń twardych reguł | tak, 0 naruszeń w 90 scenariuszach na każdego z dwóch stylistów | `FitIt.Eval`, uruchomienie z 7 października; ponowne sprawdzenie każdej odpowiedzi poza potokiem |
| Z wyłączonym modelem aplikacja zwraca propozycje | tak | testy integracyjne `SuggestionApiTests` (awaria, limit czasu, odmowa, wyczerpany budżet AI); dziś ich nie uruchamiałem, bo Docker nie odpowiadał |
| Gdy wśród kandydatów jest zapomniane ubranie, jedna z propozycji po nie sięga | tak dla reguł (85 z 85), 95% (81 z 85) dla atrapy modelu | `FitIt.Eval`; przyczyny czterech braków u atrapy nie badałem |
| Mediana odpowiedzi poniżej 8 s | nie sprawdzono | atrapa odpowiada w ułamku milisekundy, więc liczba nic nie mówi o prawdziwym modelu |
| Co najmniej 70% ręcznie ocenionych zestawów nadaje się do założenia | nie sprawdzono | wymaga prawdziwego modelu i oceniającego człowieka |
| Próba na żywo z własną szafą (zadanie 3.7) | nie wykonano | adaptera Claude w repozytorium nie ma |
| Wersja u pięciu osób | poza tą notatką | zadania 3.17 do 3.20 |

Testy jednostkowe stylisty i pogody, uruchomione 7 października bez bazy danych: 290 przypadków, wszystkie przechodzą
(`WeatherProfileTests`, `OutfitRulesTests`, `RuleBasedStylistTests`, `CandidateFilterTests`, `OpenMeteoWeatherTests`, `EvalTests`).
Testy integracyjne na PostgreSQL (`SuggestionApiTests` 24 metody, `OutfitApiTests` 12, `WeatherServiceTests` 8) istnieją,
ale w czasie pisania notatki ich nie uruchamiałem. Przejścia w symulatorze też nie powtarzałem, więc ta notatka
nie zawiera wyniku ręcznego przejścia przez ekrany "Dziś", propozycji i "Moje outfity".

## 2. Zasada: reguły pilnują, model wybiera

Sam model dobierze ładny zestaw, ale potrafi zaproponować szorty przy pięciu stopniach albo ubranie, którego nie ma w szafie.
Same reguły tego nie zrobią, ale nie mają wyczucia kolorów i proporcji. Podział pracy jest więc taki:

```
1. Kontekst          pogoda, okazja, profil, historia        kod   (WeatherService, StylingCase)
2. Filtr kandydatów  twarde reguły pogody i okazji           kod   (CandidateFilter)
3. Wybór             do trzech zestawów spośród kandydatów   model (IOutfitStylist)
4. Walidacja, ocena  komplet, wymagania pogody, spójność     kod   (OutfitValidator, CoherenceScore)
5. Tryb awaryjny     zestawy z samych reguł                  kod   (RuleBasedStylist)
```

Model dostaje wyłącznie ubrania, które przeszły przez reguły, pod krótkimi aliasami (`T3`, `B2`, `S1`, jedna litera na rolę),
a jego odpowiedź jest sprawdzana, zanim zobaczy ją człowiek. Wszystko, co da się rozstrzygnąć jednoznacznie, rozstrzyga kod.
Modelowi zostaje to, czego kod nie umie: zestawienie kolorów, proporcje, styl i jedno zdanie uzasadnienia.

Dwie konsekwencje, które w pracy warto nazwać wprost:

- **Model nie może złamać twardej reguły.** Może się mylić w aliasie, w roli, w liczbie warstw, ale taki zestaw zostaje odrzucony
  w kroku 4. Gwarancja "0 naruszeń" jest właściwością walidatora, a nie jakości modelu.
- **Jakość doboru nie jest gwarantowana przez kod.** Walidator pilnuje poprawności, nie gustu. Czy zestaw nadaje się do założenia,
  oceni dopiero człowiek (cel z planu: co najmniej 70%), i tej oceny jeszcze nie ma.

Całość kroków 3 i 4 oraz powrotu do reguł mieści się w jednej funkcji `StylistPipeline.RunAsync`, która nie dotyka bazy ani zegara.
Ten sam kod uruchamia serwis API i narzędzie `FitIt.Eval`, więc ewaluacja sprawdza dokładnie to, co dostaje użytkownik.

## 3. Profil pogody i przedziały temperatur

**Prognoza.** Open-Meteo, prognoza godzinowa na trzy dni (`forecast_days=3`), pola: temperatura, temperatura odczuwalna,
prawdopodobieństwo opadu, opad w mm, kod pogody. Klucza nie trzeba. Odpowiedź bez użytecznych godzin, błąd sieci i limit czasu
dają jeden wynik: `503 weather_unavailable`. Godzina bez temperatury jest pomijana, brakujący opad liczy się jako zero.
Do logu nie trafiają współrzędne, nawet zaokrąglone.

**Pamięć podręczna.** W pamięci procesu, klucz to zaokrąglone współrzędne. Prognoza jest świeża przez godzinę. Gdy dostawca
nie odpowiada, stara prognoza zastępuje świeżą przez 6 godzin; potem błąd jest zwracany tak, jak jest. Godziny do przodu
zmieniają się w tym czasie mało, a bez tej reguły awaria dostawcy zatrzymywałaby stylistę.

**Okno czasu.** Od początku bieżącej godziny do 22:00. Od 20:00 pytanie dotyczy jutra: okno to jutro od 7:00 do 22:00.
Wszystkie trzy godziny są w konfiguracji (`Weather:*`).

**Z okna powstaje profil** (`WeatherProfile.Build`):

- najniższa i najwyższa temperatura odczuwalna (`feelsMin`, `feelsMax`) i godziny, w których wystąpiły,
- temperatura odniesienia = `feelsMin` z korektą preferencji termicznej: minus 3 stopnie dla "zwykle marznę",
  plus 3 dla "zwykle mi ciepło",
- deszcz, gdy najwyższe prawdopodobieństwo opadu w oknie wynosi co najmniej 50% albo suma opadu co najmniej 1 mm;
  godzina początku deszczu to pierwsza z prawdopodobieństwem co najmniej 50% albo z jakimkolwiek opadem,
- potrzeba warstw, gdy `feelsMax - feelsMin` wynosi co najmniej 8 stopni,
- niebo sprowadzone do pięciu obrazków (słońce, słońce z chmurą, chmury, deszcz, śnieg): śnieg wygrywa z deszczem,
  deszcz z chmurami, w pozostałych przypadkach wygrywa rodzaj nieba, który ma najwięcej godzin, a przy remisie bardziej pochmurny.

**Przedziały.** Progi (25, 18, 11 i 3 stopnie) są w konfiguracji i sprawdzane przy starcie: muszą malejąco rozdzielać przedziały.
Każdy przedział ma jedną regułę (`BandRule`), z której korzystają filtr, walidator i ocena:

| Przedział (temperatura odniesienia) | Suma ciepła¹ | Wykluczone | Wymagane |
|---|---|---|---|
| gorąco, od 25 | 1 do 2 | każde okrycie wierzchnie, elementy o cieple 4 i 5 | nic |
| ciepło, od 18 do 25 | 1 do 3 | elementy o cieple 5 | nic |
| łagodnie, od 11 do 18 | 4 do 6 | elementy o cieple 5, sandały, klapki | warstwa pośrednia albo okrycie (wystarczy jedno) |
| zimno, od 3 do 11 | 6 do 9 | szorty, sandały, klapki, okrycie o cieple poniżej 3 | okrycie o cieple co najmniej 3, zakryte buty |
| mróz, poniżej 3 | 9 do 13 | jak w zimnie, buty o cieple 1, okrycie o cieple poniżej 4 | okrycie o cieple co najmniej 4, warstwa pośrednia, zakryte buty |

¹ Ciepło góry (albo ubrania jednoczęściowego), warstwy pośredniej i okrycia wierzchniego. Dodatki nigdy nie są wykluczane przez pogodę.

Różnica względem specyfikacji: tabela w specyfikacji mówi o temperaturach całkowitych ("3 do 10", "2 i mniej"), kod porównuje
liczby rzeczywiste, więc 10,5 stopnia jest jeszcze w przedziale "zimno", a 2,5 już w "mróz". Granice każdego przedziału
sprawdza `WeatherProfileTests`.

Suma ciepła jest w tym projekcie **karą w ocenie spójności, nie regułą twardą**. Twarde jest to, co wynika z tabeli wprost:
które ubrania wykluczyć i które warstwy są wymagane.

## 4. Filtr kandydatów i kolejność luzowania reguł

Filtr (`CandidateFilter.Select`) odpowiada na pytanie, z czego model w ogóle może układać.

1. Odpadają ubrania w praniu. Do szafy stylisty trafiają tylko ubrania w stanie "gotowe" z opisanymi tagami.
2. Dla każdej roli zostają ubrania, które przechodzą trzy reguły naraz: pogoda (tabela wyżej), zakres formalności okazji
   i reguła stylu okazji.
3. Okazje: na co dzień (formalność 1 do 3), praca lub uczelnia (2 do 4, bez stylu sportowego), spotkanie biznesowe (4 do 5),
   randka lub wieczorne wyjście (2 do 4, preferowany styl elegancki), wyjście ze znajomymi (1 do 3), trening (tylko 1 i tylko styl sportowy).
   "Preferowany" nie wyklucza niczego: to wskazówka dla modelu.
4. **Luzowanie.** Szafa w MVP jest mała, więc reguły muszą umieć ustąpić, ale tylko dla roli, która jest jednocześnie wymagana
   i pusta, i tylko tak daleko, jak trzeba. Kolejność, kumulatywnie:

   | Poziom | Co ustępuje |
   |---|---|
   | 1 | zakres formalności szerszy o 1 z obu stron |
   | 2 | to samo i brak reguły stylu okazji |
   | 3 | to samo i tolerancja ciepła 1 (limit ciepła elementu, minimalne ciepło okrycia i butów) |

   Rodzaj ubrania nigdy nie ustępuje: szorty nie wejdą do zimna i sandały do mrozu, ile by ich nie było.
   Rolą wymaganą jest zawsze obuwie, "góra z dołem albo ubranie jednoczęściowe" oraz warstwy, których żąda przedział.
   Role, których pogoda akurat nie wymaga (dodatki, a w ciepły dzień także warstwa pośrednia i okrycie), nie są luzowane nigdy.
5. Każde poluzowanie jest zapisywane (`Relaxation`: rola i reguła, tylko gdy któryś zachowany kandydat faktycznie łamie
   pierwotną regułę), przechodzi do zapytania do modelu, do zapisu zestawu i na ekran jako zdanie
   "Nie masz okrycia wierzchniego na tę temperaturę, więc proponuję to, co jest najbliżej."
6. **Deszcz.** Jeśli w szafie jest okrycie na deszcz (`rain_ok`), tylko ono zostaje kandydatem i staje się wymaganiem.
   Zamszowe buty odpadają, o ile zostają jakiekolwiek inne. Gdy okrycia na deszcz nie ma, odpowiedź niesie znacznik
   "weź parasol" (`umbrella`).
7. **Najwyżej 12 kandydatów na rolę**, po sześciu z dwóch grup: lubiane (najpierw według liczby polubionych zestawów,
   potem liczby założeń) i zapomniane (najpierw te noszone najmniej). Gdy jedna połowa jest za krótka, uzupełnia ją druga.
   Dzięki temu model ma z czego ułożyć i pewniaka, i odkrycie.
8. **"Dobierz do tego".** Wskazane ubranie jest w każdej propozycji bez względu na reguły i nic nie konkuruje o jego miejsce.
   Gdy to góra albo dół, ubrania jednoczęściowe odpadają; gdy jednoczęściowe, odpadają góry i dołu nie trzeba.

**Gdy roli nadal brakuje**, odpowiedź brzmi "brakuje w szafie": lista ról, z których każda jest wymagana
(`missing`), i osobna lista ról, z których wystarczyłaby dowolna jedna (`missingEither`, czyli warstwa pośrednia albo okrycie).
Model nie jest wtedy pytany, a prośba nie jest liczona do dziennego limitu.

**Różnica między propozycjami.** Dwa zestawy z jednej odpowiedzi mają się różnić co najmniej dwoma miejscami, ale tylko o tyle,
o ile szafa daje wybór. `CandidateSet.MinDifference` liczy, w ilu miejscach wybór w ogóle istnieje, i nie przekracza 2.
Ten sam zestaw dwa razy jest odrzucany zawsze.

## 5. Walidator, ocena spójności i etykiety

**Twarde reguły** (`OutfitValidator`). Zestaw, który łamie którąkolwiek, nie jest pokazywany. Kody naruszeń:

| Kod | Znaczenie |
|---|---|
| `UnknownAlias` | alias nie należy do kandydatów |
| `WrongRole` | ubranie stoi w miejscu innej roli (sweter jako góra) |
| `Repeated` | to samo ubranie dwa razy |
| `NoShoes` | brak butów |
| `NoBody`, `MixedBody` | brak góry z dołem albo ubrania jednoczęściowego; ubranie jednoczęściowe razem z górą lub dołem |
| `MissingOuterwear`, `MissingMidLayer`, `MissingLayer` | brak tego, czego żąda pogoda |
| `NoRainOuterwear` | w deszcz wybrano okrycie, które deszczu nie znosi, choć w szafie jest takie, które znosi |
| `MissingBaseItem` | brak ubrania, wokół którego miał powstać zestaw |
| `TooSimilar` | zestaw różni się od wcześniejszego w tej samej odpowiedzi w mniej niż wymaganej liczbie miejsc |

Błędy aliasów są zgłaszane osobno, a reszta reguł jest sprawdzana dopiero dla zestawu, w którym każdy alias został zrozumiany,
żeby jeden błąd nie wracał do modelu jako dwa. Każdy kod ma jedno zdanie po angielsku (`Violation.Describe`), które wraca
do modelu przy ponowieniu.

**Etykieta typu** jest sprawdzana osobno i nie powoduje odrzucenia. Zestaw zachowuje etykietę tylko wtedy, gdy ją zasłużył,
a w przeciwnym razie zostaje bez niej:

- "Pewniak": brak zapomnianego ubrania w zestawie,
- "Odkrycie": co najmniej jedno zapomniane ubranie,
- "Nowe połączenie": para góra i dół, której osoba jeszcze nie założyła ("Zakładam to").

Różnice względem specyfikacji: sekcja 6.1 opisuje pewniaka jako zestaw z ubrań "lubianych i często wybieranych", a kod sprawdza
tylko brak zapomnianych. "Nowe połączenie" porównuje się z parami z zestawów faktycznie założonych, a prompt mówi modelowi
o `recent` i `liked`; para z polubionego, ale niezałożonego zestawu jest więc dla kodu nowa.

**Ocena spójności** (`CoherenceScore`) to liczba od 0 do 100: zestaw zaczyna od 100 i płaci za każdy z pięciu powodów.
Propozycje są zapisywane od najlepiej ocenionej, także gdy wybierał model (kolejność modelu nie jest zachowywana).

| Kryterium | Kara |
|---|---|
| suma ciepła (góra albo ubranie jednoczęściowe, warstwa, okrycie) poza zakresem przedziału | 15 za każdy punkt odchylenia |
| rozrzut formalności między elementami większy niż 2 | 10 za każdy punkt ponad 2 |
| więcej niż 3 kolory spoza neutralnych (biel, krem, beż, szarość, czerń, granat, brąz) | 10 za każdy dodatkowy |
| więcej niż jeden wzór | 10 za każdy dodatkowy |
| element z zestawu założonego w ostatnich dwóch dniach | 5 za element |

Różnica względem specyfikacji: wzór "wyrazisty" to w kodzie każdy wzór inny niż gładki (paski, krata, kwiaty, nadruk, inny),
bo w tagach nie ma osobnej cechy "wyrazistość". Każde z pięciu kryteriów ma własny test w `OutfitRulesTests`.

## 6. Tryb awaryjny, port stylisty i atrapa

**Generator regułowy** (`RuleBasedStylist`) losuje do 20 różnych poprawnych zestawów (najwyżej 400 prób, bo w małej szafie losowania
się powtarzają), ocenia je tą samą funkcją co zestawy modelu i wybiera trzy: najlepszy, najlepszy z zapomnianym ubraniem
i najlepszy różny od obu. Gdy brakuje różnicy o wymaganą liczbę miejsc, wymaganie spada do jednego miejsca, ale ten sam zestaw
nigdy nie wraca. Uzasadnienia są szablonami po polsku, w drugiej osobie, bez form zależnych od płci. Notka pogodowa pojawia się
przy deszczu (jeśli okrycie go znosi) i przy dużej amplitudzie. Dla stałego ziarna wynik jest zawsze ten sam, co umożliwia
ewaluację; w serwisie ziarno jest losowe.

Generator ma dwie funkcje. Aplikacja działa, gdy model jest niedostępny, i jest on punktem odniesienia dla modelu.
Ma też ograniczenie: **nie bierze pod uwagę ani stylów z profilu osoby, ani stylu preferowanego przez okazję**. Te dane trafiają
wyłącznie do zapytania do modelu.

**Kiedy reguły przejmują odpowiedź** (`FallbackReason`):

| Powód | Co się dzieje |
|---|---|
| model nie został zapytany (brak modelu w konfiguracji albo wyczerpany dzienny budżet AI) | od razu reguły |
| model zawiódł albo przekroczył czas | od razu reguły, bez drugiej próby |
| model odmówił (`refusal`) | od razu reguły, bez drugiej próby |
| żaden zestaw z odpowiedzi nie przeszedł walidatora | druga próba z listą błędów ("Outfit 2: A one-piece cannot be combined with a top or a bottom."), potem reguły |

Wystarczy jeden poprawny zestaw z odpowiedzi modelu: pozostałe są odrzucane, a model nie jest pytany drugi raz o brakujące.
Odpowiedź może więc mieć od jednego do trzech zestawów; aplikacja i ewaluacja to dopuszczają. Reguły nie dopełniają
odpowiedzi modelu do trzech.

**Port.** `IOutfitStylist` ma jedną metodę, `SuggestAsync(StylistRequest)`, i jedną właściwość, `PromptVersion`.
Zapytanie niesie przypadek (`StylingCase`) i listę błędów z poprzedniej próby. Odpowiedź niesie zestawy pod aliasami,
znacznik odmowy i koszt. Awaria dostawcy i odpowiedź, która nie jest umówionym JSON-em, to `ProviderException`, brak odpowiedzi
w czasie to anulowanie. Te dwa wyjątki są jedynymi, które potok zamienia na tryb awaryjny; każdy inny jest błędem programisty
i leci dalej.

**Zapytanie do modelu** (`StylingCase.Brief()`) to jeden obiekt JSON z kluczami w `snake_case`: pogoda (z wymaganiami wypisanymi
słowami), okazja z zakresem formalności i notatką, profil, ewentualne ubranie bazowe, poluzowane reguły, do pięciu ostatnich
polubionych i do pięciu odrzuconych zestawów, zestawy założone w ostatnich dwóch dniach i kandydaci z krótkimi aliasami.
Zestaw z historii jest pomijany, gdy mniej niż dwa jego ubrania są dziś kandydatami. Stała część zapytania to prompt systemowy
`stylist-v1.md`, wersjonowany w repozytorium i wbudowany w bibliotekę; jego wersja jest zapisywana przy każdym zestawie.
Prompt mówi modelowi wprost, że notatka człowieka jest daną, nie poleceniem, i nie zmienia reguł.

**Atrapa.** `FakeOutfitStylist` składa poprawne zestawy generatorem regułowym (z ziarnem z identyfikatorów ubrań, więc te same
ubrania dają ten sam wynik) i przypisuje etykiety po kolei: pewniak, odkrycie, nowe połączenie. Dzięki niej ekrany i cały potok
dało się zbudować i przetestować bez klucza. W testach integracyjnych używany jest osobny `ScriptedStylist`, który odpowiada
zaplanowanymi odpowiedziami, odmawia, zawodzi i przekracza czas.

**Adaptera na prawdziwy model w repozytorium nie ma.** `Providers:OutfitStylist` przyjmuje dziś tylko `Fake`; wpisanie `Claude`
zatrzymuje start aplikacji z czytelnym komunikatem (test `A_stylist_that_does_not_exist_yet_stops_the_application_from_starting`).
Zadanie 3.7 jest więc zrealizowane po stronie portu, promptu, zapytania, walidacji i ponawiania, ale nie po stronie wywołania modelu.
Nie istnieje też wymuszony schemat odpowiedzi po stronie dostawcy (specyfikacja, sekcja 6.5): format opisuje prompt,
a typowaną postacią odpowiedzi jest `StylistOutfit`, który walidator sprawdza.

**Serwis** (`StylistService`) spina całość w jednym żądaniu `POST /api/outfits/suggestions`:

1. wczytuje szafę, miejsce i preferencje, buduje profil pogody, filtruje kandydatów;
2. przy niekompletnej szafie odpowiada "brakuje w szafie" i kończy, bez liczenia limitu i bez pytania modelu;
3. bierze jedną sztukę z dziennego limitu (20 prośb, atomowe polecenie SQL jak w Etapie 2);
4. sprawdza dzienny budżet AI; bez budżetu model w ogóle nie jest wołany;
5. uruchamia potok, a każde wywołanie modelu, także nieudane, zapisuje w dzienniku kosztów;
6. zapisuje do trzech zestawów (źródło `model` albo `rules`, wersja promptu, model, migawka pogody, poluzowane reguły,
   znacznik parasola, identyfikator całej prośby) i odpowiada.

Gdy po wzięciu limitu cokolwiek wyrzuci wyjątek, limit jest zwracany. Przejście na reguły nie jest wyjątkiem: człowiek dostał
propozycje, więc prośba się liczy. W odpowiedzi jest znacznik `fallback`, a aplikacja mówi wtedy:
"Ten zestaw ułożyliśmy według prostych reguł, bo stylista AI jest teraz niedostępny."

**Pozostałe punkty końcowe.** `GET /api/weather/today`, lista zestawów, szczegóły, zapis, ocena (kciuk w górę i w dół),
"Zakładam to" (liczy każde ubranie raz na dzień, ten sam przycisk wciśnięty drugi raz niczego nie zmienia) i usuwanie.
Cudzy zestaw wygląda dokładnie jak nieistniejący (`404 not_found`).

## 7. Strefa czasowa: "dziś" jest tam, gdzie jest człowiek

Specyfikacja powstała z myślą o polskich testerach i liczyła "dziś" w `Europe/Warsaw`. Po decyzji z 6 października
(aplikacja ma działać na całym świecie) to byłby błąd: dla osoby w Tokio jest wtedy już jutro, a dla osoby w Limie jeszcze wczoraj.
W kodzie "dziś" potrzebne jest w trzech różnych miejscach i każde ma inne rozwiązanie.

**1. Okno pogody.** Open-Meteo jest pytane z `timezone=auto`, więc w odpowiedzi jest identyfikator strefy dla współrzędnych,
a godziny prognozy przychodzą jako chwile (`timeformat=unixtime`). Serwer zamienia je na zegar tej strefy. Profil buduje się
od "teraz" przeliczonego na przesunięcie najbliższej godziny prognozy, więc o oknie, godzinie 20:00 i "jutrze" decyduje zegar miejsca,
nie serwera. Test: 23:30 w Greenwich 5 października to 8:30 w Tokio 6 października, czyli poranek, a nie późny wieczór.
Gdy system nie zna strefy z odpowiedzi, serwer używa przesunięcia podanego w odpowiedzi (test `A_zone_this_system_does_not_know...`).

**2. Dzień osoby.** Dzienne limity, data założenia zestawu, próg "zapomnianego" (30 dni), okno "ostatnich dwóch dni"
i godzina, o której limity się odnawiają, liczą się według dnia kalendarzowego w miejscu pogody osoby.
`PersonalCalendar` ustala strefę z współrzędnych **bez sieci** (biblioteka GeoTimeZone), raz na żądanie, żeby wszystkie liczenia
w jednym żądaniu zgadzały się co do tego, jaki to dzień. Dla osoby bez miejsca dzień liczy się w strefie z konfiguracji.
Test `The_day_an_outfit_is_worn_on_is_the_day_where_the_person_is` wybiera miejsce (Kiritimati albo Pago Pago), w którym kalendarz
pokazuje inną datę niż w Greenwich w chwili uruchomienia testu, i sprawdza datę założenia zestawu i ubrań.
Test w Etapie 4 sprawdza, że zwrot limitu wraca do dnia, z którego został wzięty, nawet gdy w międzyczasie zaczął się nowy.

**3. Data na ekranie.** Aplikacja bierze datę z zegara miejsca prognozy (pole `from`), nie z zegara telefonu.

**Co zostaje w strefie z konfiguracji** (`App:TimeZone`, domyślnie `Europe/Warsaw`): dzień globalnego budżetu AI (jest wspólny dla
wszystkich, więc musi mieć jeden dzień), osoby bez miejsca, godziny zadań cyklicznych i sprawdzanie wieku przy rejestracji.

Skutek uboczny, który wynika z kodu, a którego nie testowałem: osoba, która zmieni miejsce na leżące bardziej na wschód,
dostaje od razu nowy dzień z nowymi licznikami. Daje to najwyżej drugi komplet dziennych limitów w jednej dobie i hamuje go
globalny budżet AI. Nie znalazłem też testu dla stref, w których przesunięcie czasu letniego następuje o północy.

## 8. FitIt.Eval: co mierzy i co pokazało

Narzędzie konsolowe `backend/tools/FitIt.Eval`, uruchamiane poleceniem
`dotnet run --project tools/FitIt.Eval -- report.md [--stylist Fake] [--visualizations 10]`.
Zapisuje raport w Markdown i kończy się kodem 1, gdy jakakolwiek twarda reguła została złamana (bramka dla budowania), a 2 przy błędnych argumentach.

**Macierz** (specyfikacja, sekcja 6.9): 3 szafy (12, 30 i 60 ubrań) razy 5 pogód (28, 20, 14, 6 i minus 5 stopni) razy 6 okazji,
czyli 90 scenariuszy, osobno dla skonfigurowanego stylisty i dla generatora regułowego jako punktu odniesienia.
Szafy powstają z katalogu ubrań atrapy tagowania, więc są takie same na każdym komputerze: co trzecie ubranie jest zapomniane,
reszta była noszona od jednego do sześciu razy, część z nich polubiono, a kilka noszono w ostatnich dwóch dniach.

**Ponowne sprawdzenie.** Każda odpowiedź jest sprawdzana jeszcze raz, osobno od potoku: od jednego do trzech zestawów,
każdy przechodzi walidator, składa się wyłącznie z kandydatów, nie zawiera niczego, co wyklucza pogoda, i mieści się
w formalności i stylu okazji, chyba że dla tej roli reguła ustąpiła. Scenariusz, w którym szafa nie może ubrać osoby, jest liczony osobno
(`missing_garments`), a nie jako błąd.

**Wyniki** (uruchomienie z 7 października, liczby w tabeli nie zależą od zegara, czasy tak):

| Miara | Atrapa modelu | Generator regułowy |
|---|---:|---:|
| Scenariusze | 90 | 90 |
| Szafa nie może ubrać osoby | 1 (12 ubrań, mróz, trening: brak warstwy pośredniej) | 1 (ten sam) |
| Naruszenia twardych reguł | 0 | 0 |
| Odpowiedzi z poprawnym odkryciem, gdy wśród kandydatów jest zapomniane | 81 z 85 (95%) | 85 z 85 (100%) |
| Odpowiedzi z trzema zestawami | 75 z 89 (84%) | 84 z 89 (94%) |
| Zestawy z etykietą | 148 z 250 (59%) | 179 z 259 (69%) |
| Średnia ocena spójności | 98,5 | 98,4 |
| Mediana czasu potoku | 0,27 ms | 0,25 ms |

Dodatkowo w zadaniu 4.5 narzędzie zamawia dziesięć obrazów u atrapy dostawcy obrazów; wynik opisuje notatka Etapu 4.

**Jak to czytać.**

- **Zero naruszeń jest prawdziwe, ale mówi o kodzie, nie o modelu.** Atrapa składa zestawy tym samym generatorem co tryb awaryjny,
  więc nie ma tu wyboru modelu, który walidator mógłby odrzucić. Pokazuje to, że filtr, walidator i generator są ze sobą spójne
  na 90 scenariuszach, nie że prawdziwy model ich nie łamie.
- **Porównanie "model kontra same reguły", którego żąda plan (3.21), nie jest możliwe.** Obie kolumny to w istocie ten sam algorytm.
  Różnice w tabeli (84% wobec 94% odpowiedzi z trzema zestawami, 59% wobec 69% etykiet) biorą się z tego, że odpowiedź atrapy
  przechodzi przez walidator, a odpowiedź generatora nie. Wniosek z lektury kodu, bez osobnego testu: walidator wymaga różnicy
  `MinDifference` (do 2 miejsc), a generator przy braku wyboru schodzi do 1 miejsca, więc część trzecich zestawów walidator odrzuca.
- **Ocena spójności prawie się nie zmienia (98,5 wobec 98,4).** Kandydaci są już po filtrze, więc kar jest mało. Czy ocena
  zgadza się z oceną człowieka, nie jest zmierzone.
- **Czasy niczego nie mówią.** Mierzą sam kod potoku bez sieci i bez modelu. W raporcie zapisanym wcześniej w repozytorium
  (`report-sample.md`) mediana wynosi 0,59 ms, w moim uruchomieniu 0,27 ms: różnią się między uruchomieniami.
- **Macierz nie obejmuje deszczu, dużej amplitudy, historii ocen ani "Dobierz do tego".** Pogoda w scenariuszach jest płaska
  i bez opadu, bez historii. Te ścieżki pokrywają testy jednostkowe i integracyjne, ale nie ewaluacja.
- **Jakość zestawów oceni człowiek.** Plan przewiduje ręczną ocenę próbki; do niej potrzebny jest prawdziwy model.

## 9. Aplikacja

Ekrany Etapu 3 istnieją w katalogu `mobile/src` i mają testy komponentów:

- "Dziś": data i pogoda miejsca (zakres temperatur, niebo, kiedy zacznie padać, wskazówka o warstwach), wybór okazji,
  notatka, "Zaproponuj zestawy" z liczbą propozycji pozostałych na dziś, stan "bez miejsca" z dwiema drogami (lokalizacja telefonu
  albo miasto) i pusta szafa jako zaproszenie do dodawania ubrań (`features/weather`, `app/(app)/(tabs)/index.tsx`);
- propozycje: stan oczekiwania, przewijane strony z etykietą typu, kolażem, uzasadnieniem, notką pogodową, poluzowanymi regułami
  i parasolem, kciukami, "Zapisz" i "Zakładam to", a przy niekompletnej szafie panel "Brakuje ..." z podpowiedzią, co dodać;
  błąd brakującego miejsca prowadzi do wyboru miejsca, a wyczerpany limit do powrotu (`app/(app)/proposals.tsx`);
- "Dobierz do tego" z ekranu ubrania: arkusz wyboru okazji, po którym propozycje zawierają wskazane ubranie (`app/(app)/occasion.tsx`);
- kolaż układa od trzech do siedmiu wycinków według ról, największy element (góra albo ubranie jednoczęściowe) jest zawsze największy
  (`components/Collage.tsx`, `features/styling/collage.ts`);
- szczegóły zestawu, "Moje outfity" i miejsce pogody z preferencją termiczną w profilu. Miejsce pobrane z telefonu jest odświeżane
  przy otwarciu aplikacji, miejsce wpisane ręcznie nigdy.

Każda prośba o propozycje ma w aplikacji własny identyfikator trasy, a odpowiedź nie jest odświeżana sama (`staleTime: Infinity`, bez
automatycznych ponowień), więc powrót na ekran nie zadaje pytania ponownie, a nieudana prośba jest ponawiana tylko przyciskiem.
Chroni to dzienny limit przed zużyciem przez samo przechodzenie między ekranami; tej właściwości nie sprawdzałem osobnym testem.

## 10. Czego jeszcze nie zmierzono

Plan wymaga w tej notatce wyników ewaluacji i porównania modelu z samymi regułami. Prawdziwe liczby wymagają prawdziwego modelu:

- **Czas odpowiedzi modelu.** Bramka: mediana poniżej 8 s, 95. percentyl poniżej 15 s (specyfikacja, sekcja 13). Do zmierzenia po
  napisaniu adaptera, najlepiej z poziomu `FitIt.Eval --stylist ...`, który ma na to miejsce w argumentach.
- **Odsetek zestawów nadających się do założenia.** Bramka: 70%. Wymaga oceny człowieka na próbce z prawdziwego modelu.
- **Wkład modelu względem reguł.** Wymaga uruchomienia obu stylistów na tych samych scenariuszach z prawdziwym modelem; narzędzie jest gotowe.
- **Koszt jednej prośby.** Dziennik kosztów działa i zapisuje każde wywołanie, ale atrapa zapisuje zero. Specyfikacja (sekcja 11.2)
  szacuje koszt stylisty na około 4 zł miesięcznie na aktywną osobę na Opusie 5.5; to szacunek, nie pomiar.
- **Czy próg temperatury jest trafny.** Progi są wartościami startowymi z konfiguracji i mają być skalibrowane na testerach.

## 11. Decyzje podjęte bez pytania, do potwierdzenia

| Decyzja | Dlaczego tak | Łatwo zmienić? |
|---|---|---|
| "Dziś" liczone w strefie miejsca pogody, strefa z współrzędnych bez sieci (GeoTimeZone), zegar serwera tylko dla budżetu AI, osób bez miejsca i zadań cyklicznych | aplikacja ma działać na całym świecie; wymaganie padło 6 października, sposób wykonania jest mój | średnio: jedna klasa (`PersonalCalendar`, `AppClock.DayAt`), ale zmienia się data zapisana w licznikach |
| Stara prognoza zastępuje świeżą do 6 godzin przy awarii dostawcy | specyfikacja mówi "ostatnia zapamiętana prognoza" bez granicy; sześć godzin to mój próg | tak, stała (`WeatherService.Usable`) |
| Pamięć podręczna prognoz w pamięci procesu, nie w bazie | jedna instancja API w MVP; po restarcie pierwsze pytanie idzie do dostawcy | tak, przy kilku instancjach trzeba wspólnego magazynu |
| Okno pogody zaczyna się od początku bieżącej godziny, nie od "teraz" | prognoza jest godzinowa, a bieżąca godzina jeszcze trwa | tak, konfiguracja i jedna linia |
| Suma ciepła jako kara w ocenie, nie reguła twarda | specyfikacja wymienia ją w tabeli pogody i w karach; twarde jest to, co da się powiedzieć o roli ("okrycie o cieple co najmniej 3") | tak, jedna reguła w walidatorze |
| Wzór "wyrazisty" to każdy wzór inny niż gładki | w tagach nie ma stopnia wyrazistości | tak, po dodaniu cechy do tagów |
| Etykieta "Pewniak" wymaga tylko braku zapomnianych ubrań | prostsze niż "lubiane i często noszone"; progu "często" nie ustalono | tak, `OutfitDraft.Confirm` |
| Model nie dostaje drugiej próby po awarii, limicie czasu i odmowie; druga próba tylko przy braku poprawnych zestawów | zgodnie ze specyfikacją; kolejne wywołanie nieodpowiadającego modelu wydłużałoby czas ponad 8 s | tak, `StylistPipeline.ModelAttempts` |
| Odpowiedź modelu z jednym albo dwoma poprawnymi zestawami jest pokazywana bez dopełniania regułami | specyfikacja tego nie rozstrzyga; dopełnienie mieszałoby dwa źródła w jednej odpowiedzi | tak |
| Generator regułowy ignoruje style z profilu i styl preferowany przez okazję | te dane nie są częścią twardych reguł, a tryb awaryjny ma być prosty | tak, dopisanie do funkcji oceny |
| Zestawy zapisywane według oceny spójności, nie według kolejności modelu | specyfikacja: "propozycje są sortowane według oceny" | tak |
| Prośba liczona do limitu także wtedy, gdy odpowiedziały reguły; zwrot tylko przy wyjątku | człowiek dostał propozycje; zwrot przy każdej awarii modelu pozwalałby obchodzić limit | tak |
| Adaptera Claude nie ma; `Providers:OutfitStylist=Claude` zatrzymuje start | pomijamy usługi wymagające kluczy (ta sama zasada co w Etapie 2) | tak, jeden adapter za istniejącym portem |
| Prompt systemowy po angielsku, uzasadnienia po polsku | model lepiej trzyma się reguł po angielsku, a język interfejsu jest polski | tak, treść pliku |
