# Etap 2: szafa. Przepływ wysyłki, przetwarzanie i to, czego jeszcze nie zmierzono

Stan na 6 października 2026. Notatki do pracy pisemnej (zadanie 2.16 planu).
Opisują to, co faktycznie działa w repozytorium, i dlaczego zostało zrobione w ten sposób.
Usługi AI i magazyn w chmurze są w tym etapie zastąpione atrapami i lokalnym serwerem, więc część miar z planu
(trafność tagowania, koszt na ubranie, czas przez sieć komórkową) pozostaje do zmierzenia. Sekcja 6 mówi dokładnie, które.

## 1. Co działa po tym etapie

| Kryterium z planu | Wynik | Jak sprawdzono |
|---|---|---|
| Kilka zdjęć wysłanych jedną akcją | tak | symulator iPhone'a 17 Pro: cztery zdjęcia z galerii naraz, wszystkie w magazynie i w bazie |
| Nowe ubranie przechodzi z „opisujemy” w gotowe bez ręcznego odświeżania | tak | symulator: wiersze kolejki i kafle szafy zmieniły stan same |
| Zmiana tagu jest widoczna po ponownym otwarciu | tak | symulator: zmiana nazwy i typu, powrót do szczegółów, rekord w bazie |
| „W praniu” zapisuje się od razu | tak | symulator i rekord w bazie |
| Usunięcie ubrania usuwa rekord i oba pliki | tak | test integracyjny; w symulatorze potwierdzenie z nazwą ubrania i zniknięcie z szafy |
| Bez zgody na AI wysyłka jest odrzucana | tak | test integracyjny; w aplikacji ekran zgody przed pierwszym zdjęciem |
| Limitu dziennego nie da się przekroczyć równoległymi żądaniami | tak | test: 15 żądań naraz na prawdziwym PostgreSQL |
| Awaria dostawcy AI nie blokuje dodawania | tak | testy zadania w tle na atrapach (awaria tła, awaria tagowania, wyczerpany budżet) |
| Obraz czyta tylko posiadacz podpisanego adresu | tak | curl: adres podpisany 200, niepodpisany 403; test dostępu do cudzego ubrania |
| Filtry, wyszukiwanie, stan „nic nie pasuje”, tryb ciemny | tak | symulator |
| 20 ubrań w 10 minut przez sieć komórkową | nie sprawdzono | wymaga prawdziwego telefonu (zadanie 2.15) |
| Trafność kategorii 90% i koloru 80% | nie sprawdzono | wymaga prawdziwego modelu (pomijamy usługi z kluczami) |

Testy: 163 po stronie backendu, 148 po stronie aplikacji. Nie sprawdzono: Androida, aparatu (symulator go nie ma)
i zachowania kolejki przy zerwaniu sieci na żywym urządzeniu (jest pokryte 13 testami jednostkowymi kolejki).

## 2. Przepływ wysyłki

```
telefon                         API                          magazyn (S3)            zadanie w tle
   | zmniejsz do 1280 px, JPEG   |                               |                        |
   | POST /api/uploads --------> | zgoda? limit? -> bilet        |                        |
   | <-- klucz + podpisany PUT - |                               |                        |
   | PUT pliku ------------------------------------------------> |                        |
   | POST /api/clothes (klucz) -> | plik istnieje? typ? rozmiar?  |                        |
   | <-- ubranie „processing” -- | zlecenie -------------------------------------------->  |
   | GET /api/clothes co 2,5 s   |                               | <- wycinek, tagi ----- |
   | <-- ubranie „ready” ------- |                               |                        |
```

**Zdjęcia nie przechodzą przez API.** Telefon dostaje podpisany adres i wysyła plik prosto do magazynu.
API nie trzyma w pamięci cudzych megabajtów, a wąskim gardłem przy 20 zdjęciach jest łącze telefonu, nie serwer.
Ceną jest drugi krok (`POST /api/clothes`), w którym serwer sam sprawdza, czy plik istnieje, ma dozwolony typ
(po pierwszych bajtach, nie po rozszerzeniu) i mieści się w 2 MB. Telefonowi się w tej sprawie nie wierzy.

**Klucze obiektów zaczynają się od identyfikatora osoby.** Serwer odrzuca klucz z cudzym prefiksem,
więc znajomość cudzego klucza nic nie daje.

**Zmniejszanie na telefonie.** Dłuższy bok 1280 px, JPEG 0,8, a gdy plik nadal jest za duży, drugi zapis z 0,6.
Zapis od nowa usuwa też położenie i dane aparatu ze zdjęcia. Model opisujący ubranie nie potrzebuje więcej pikseli,
a 20 zdjęć po kilkaset kilobajtów przechodzi przez sieć komórkową w rozsądnym czasie.

**Kolejka wysyłania w aplikacji** jest zwykłym obiektem poza Reactem (`uploadQueue.ts`), a ekran tylko ją obserwuje.
Dzięki temu zamknięcie arkusza nie przerywa wysyłki, a kolejkę da się testować bez renderowania czegokolwiek.
Wysyła dwa pliki równolegle, pokazuje postęp każdego, ponawia po błędzie sieci i rozróżnia błędy, przy których
ponawianie nie ma sensu (limit dzienny, usunięte ubranie).

**Odpytywanie zamiast powiadomień.** Szafa pyta o listę co 2,5 s, ale tylko wtedy, gdy jakieś ubranie jest w stanie
`processing`. Przetwarzanie trwa sekundy, więc kanał push byłby dodatkową infrastrukturą dla zysku, którego nie widać.

## 3. Przetwarzanie w tle

Stany ubrania: `processing → ready | failed | rejected`. Zadanie `ClothingProcessor` robi cztery kroki:
usunięcie tła, zapis wycinka, tagowanie, oznaczenie jako gotowe. Każdy krok ma trzy próby, a całe zadanie jest
idempotentne: uruchomione drugi raz dla tego samego ubrania nie zrobi niczego dwa razy.

Zasada, która porządkuje wszystkie gałęzie błędów: **awaria usługi AI nigdy nie zabiera człowiekowi ubrania.**

| Co zawiodło | Co widzi osoba |
|---|---|
| Usuwanie tła | ubranie jest gotowe, wycinkiem zostaje oryginalne zdjęcie |
| Tagowanie | ubranie czeka na ręczny opis („Uzupełnij”) |
| Na zdjęciu nie ma ubrania | zdjęcie odrzucone, pliki usunięte, wiersz kolejki mówi dlaczego |
| Dzienny budżet AI wyczerpany | ubranie czeka do jutra, potem zadanie samo je podejmie |

Dwa zadania porządkowe: co 5 minut wznowienie ubrań zawieszonych w `processing`, raz na dobę usunięcie plików,
które nie mają rekordu i są starsze niż doba (ktoś wysłał plik i nie dokończył drugiego kroku).

## 4. Limity i koszty

**Liczniki dzienne jednym poleceniem SQL.** `INSERT ... ON CONFLICT DO UPDATE ... WHERE count < limit` albo podnosi
licznik, albo nie zwraca wiersza. Nie ma odczytu, po którym następuje zapis, więc nie ma okna, w którym dwa żądania
zmieszczą się w limicie naraz. Sprawdzone 15 równoległymi żądaniami na prawdziwej bazie.

**Dziennik kosztów AI** (`ai_usage_log`) zapisuje każde wywołanie z ceną, a przed wywołaniem sprawdza globalny budżet
dzienny (10 USD w konfiguracji). To zabezpieczenie przed błędem w pętli albo nadużyciem, a nie element cennika.

Limit nowych ubrań to 50 dziennie. Aplikacja pokazuje, ile jeszcze zostało, odejmując pliki, które są w drodze.

## 5. Decyzje podjęte bez pytania, do potwierdzenia

| Decyzja | Dlaczego tak | Łatwo zmienić? |
|---|---|---|
| Lokalny serwer S3 (versitygw) zamiast Cloudflare R2 | pomijamy usługi wymagające kont; kod magazynu jest ten sam, zmienia się adres i klucze | tak, konfiguracja |
| Atrapy usuwania tła i tagowania wybierane przez `Providers:*` | jak wyżej; atrapa tagowania wybiera jedno z 41 ubrań po kluczu pliku, więc szafa testowa ma góry, doły, buty i okrycia | tak, konfiguracja |
| Kody słownikowe ASCII (`top`, `mid_layer`, `one_piece`) i polskie etykiety w jednym miejscu | ta sama zasada co w Etapie 1; tłumaczenie interfejsu nie dotyka bazy | wymaga migracji danych |
| Kategoria `mid_layer` nazywa się w interfejsie „Warstwa” | krótkie słowo na swetry, bluzy i marynarki; do oceny przy próbie z ludźmi | tak, etykieta |
| Reguła „zapomniane”: flaga „rzadko noszę” albo 30 dni bez noszenia | specyfikacja mówi o odkrywaniu nieużywanych ubrań, próg jest mój | tak, stała |
| Stan „nic nie pasuje do filtrów” bez dużej ikony | z otwartą klawiaturą duża ikona spychała przycisk „Wyczyść filtry” pod klawiaturę | tak |
| Wskaźnik odświeżania szafy tylko po pociągnięciu | sterowany każdym odświeżeniem w tle zawieszał się na iOS nad listą | tak |

## 6. Czego jeszcze nie zmierzono

Plan wymaga w tym zadaniu trzech liczb. Dwóch nie da się uczciwie podać bez prawdziwych usług:

- **Trafność tagowania.** Atrapa nie patrzy na zdjęcie, więc jej trafność nic nie znaczy. Do zmierzenia na 30 zdjęciach
  testowych po podłączeniu prawdziwego modelu (zadanie 2.5 w wersji z kluczem). Bramka: kategoria 90%, kolor główny 80%.
- **Koszt na ubranie.** Dziennik kosztów działa i sumuje, ale atrapy zapisują w nim ceny umowne. Prawdziwa liczba
  wyjdzie z tego samego dziennika po pierwszych kilkudziesięciu ubraniach na prawdziwych usługach.
- **Czas dodania 20 ubrań przez sieć komórkową** (zadanie 2.15). Wymaga telefonu. Magazyn musi być wtedy osiągalny
  z telefonu: `STORAGE_BIND=0.0.0.0` i `Storage__PublicEndpoint` z adresem komputera w sieci lokalnej albo tunelem.

## 7. Co wyszło dopiero na symulatorze

Trzy usterki, których nie złapały testy jednostkowe, kontrola typów ani lint:

1. **Pusty arkusz zgody.** `react-native-screens` szuka przewijanego widoku bezpośrednio pod ekranem arkusza i nadaje mu
   rozmiar całego arkusza. React Native spłaszczał korzeń arkusza, więc `ScrollView` stawał się takim bezpośrednim
   dzieckiem i znikał albo nachodził na nagłówek. Korzeń arkusza ma teraz `collapsable={false}`, a nagłówek stoi przed
   obszarem przewijania.
2. **Zawieszony wskaźnik odświeżania** po powrocie z usuwania ubrania (opis w tabeli wyżej).
3. **Przycisk wyjścia z pustych wyników pod klawiaturą** (opis w tabeli wyżej).

Wniosek do pracy: testy komponentów sprawdzają logikę i dostępność, ale układ na natywnych kontenerach (arkusze,
klawiatura, kontrolki systemowe) trzeba obejrzeć na urządzeniu. Stąd zasada „przejść każdą ścieżkę ręcznie”.
