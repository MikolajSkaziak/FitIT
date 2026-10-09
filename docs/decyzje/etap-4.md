# Etap 4: wizualizacja. Obraz na żądanie, przepływ asynchroniczny i limit, który wraca

Stan na 7 października 2026. Notatki do pracy pisemnej (zadanie 4.11 planu).
Opisują to, co faktycznie działa w repozytorium, i dlaczego zostało zrobione w ten sposób.
Generator obrazów jest w tym etapie zastąpiony atrapą, więc czas powstawania obrazu, jego jakość, koszt i odsetek blokad
nie zostały zmierzone. Zmierzone są natomiast własności, które zależą od naszego kodu, nie od dostawcy: brak podwójnych zleceń,
zwrot limitu i zachowanie po awarii. Sekcja 8 mówi dokładnie, czego brakuje.
Notatka obejmuje stronę serwerową (zadania 4.2, 4.3, 4.5 i port z 4.1). Ekranów wizualizacji (zadania 4.6 do 4.8)
w aplikacji nie ma: w czasie pisania tej notatki w `mobile/src` nie ma żadnego wywołania punktów końcowych wizualizacji ani ekranu, który by je pokazywał.

## 1. Co działa po tym etapie

| Kryterium z planu (bramka etapu) | Wynik | Jak sprawdzono |
|---|---|---|
| Powtórzone żądanie nie tworzy drugiego zlecenia | tak | test integracyjny: ten sam klucz zwraca ten sam rekord; osobny test z równoległymi żądaniami o ten sam klucz kończy się jednym zleceniem |
| Ponowione zadanie nie tworzy drugiego zlecenia u dostawcy | tak | test: zadanie przerwane w trakcie odpytywania, uruchomione ponownie, `SubmitCalls == 1`, identyfikator dostawcy bez zmian |
| Przy błędzie i blokadzie limit wraca | tak | testy: blokada, błąd dostawcy, przekroczenie czasu, nieprawidłowy obraz; zwrot do dnia, z którego limit został wzięty |
| Limit dzienny odmawia po wyczerpaniu | tak | test: pięć zleceń, szóste `429 limit_reached`; kolejnego dnia znów można |
| Obraz kopiowany do własnego magazynu osoby | tak | test: plik pod `u/<osoba>/viz/`, nie u dostawcy |
| Mediana czasu poniżej 40 s | nie sprawdzono | atrapa odpowiada po dwóch odpytaniach; liczba nic nie mówi o prawdziwym dostawcy |
| Nagłówki ograniczające przechowywanie u dostawcy (zadanie 4.4) | nie wykonano | adaptera fal.ai w repozytorium nie ma |
| Próba na żywo z trzema zestawami (zadanie 4.1), 15 wizualizacji na telefonie (4.9) | nie wykonano | jw. i brak ekranów w aplikacji |
| "Pokaż na sylwetce", komunikaty blokady i błędu, miniatury (4.6 do 4.8) | nie wykonano | brak w aplikacji |

Testy: `VisualizationTests` ma 38 metod, w tym przepływ pełny, wszystkie ścieżki niepowodzenia i dostęp do cudzych zasobów.
Są to testy integracyjne na PostgreSQL w Testcontainers; w czasie pisania tej notatki Docker nie odpowiadał,
więc ich dzisiaj nie uruchamiałem. Uruchomiłem tylko testy bez bazy (w tym `EvalTests`), które przechodzą.

## 2. Dlaczego obraz powstaje na żądanie, a nie dla każdego zestawu

Prośba o propozycje zwraca trzy zestawy, a człowiek zwykle ogląda kilka, zanim któryś wybierze. Obraz kosztuje według specyfikacji
około 31 gr i powstaje kilkanaście do kilkudziesięciu sekund. Generowanie go dla wszystkich trzech propozycji potroiłoby koszt
i opóźniło pierwszy widok o czas, którego człowiek nie potrzebuje, żeby ocenić kolaż. Dlatego propozycje są widoczne od razu jako kolaże
z prawdziwych zdjęć ubrań, a obraz powstaje dopiero po dotknięciu "Pokaż na sylwetce" przy wybranym zestawie.

Kolaż zostaje obok gotowego obrazu jako wierne odniesienie: obraz jest podpisany jako poglądowy, bo model obrazu może inaczej oddać
wzór, napis albo krój. Ta rola kolażu jest zapisana w opisie kontraktu API (`VisualizationResponse`).

Dostęp do generatora ma ograniczenie, które wynika z tej zasady: zlecenie wolno złożyć tylko dla zestawu, który już istnieje
i należy do osoby. Cudzy zestaw wygląda jak nieistniejący (`404 not_found`), a test `AccessTests` pilnuje tego dla każdej trasy z identyfikatorem.

## 3. Przepływ asynchroniczny i maszyna stanów

```
telefon                     API                              zadanie w tle (Hangfire)            dostawca obrazów
   | POST /outfits/{id}/visualizations                        |                                   |
   |   Idempotency-Key: ...   |                                |                                   |
   |------------------------> | zgoda? budżet? w jednej        |                                   |
   |                          | transakcji: licznik + rekord   |                                   |
   | <------ 202 pending ---- | zlecenie zadania ------------> |                                   |
   |                          |                                | zgoda? budżet? podpisane adresy   |
   |                          |                                | SubmitAsync ----------------------> przyjmuje, daje id
   |                          |                                | zapis id, stan running            |
   | GET /visualizations/{id} |                                | co 3 s kolejne uruchomienie:      |
   | <------ running -------- |                                | GetStatusAsync -------------------> queued / running
   |                          |                                | ...                               | completed
   |                          |                                | GetResultAsync <------------------| bajty obrazu
   |                          |                                | kopia do własnego magazynu        |
   | <--- completed + adres - |                                | stan completed                    |
```

**Rekord `Visualization` jest jedynym zapisem zlecenia.** Ma stan, identyfikator zlecenia u dostawcy, klucz idempotencji,
dzień limitu, który zlecenie opłacił, liczbę prób, model i wersję szablonu zapytania (`visualizer-v1`) oraz koszt.

Stany:

```
            +--> Failed    (zgoda wycofana, budżet wyczerpany, dostawca odmawia po 3 próbach, limit czasu)
Pending ----+
            +--> Running --+--> Completed
                           +--> Blocked   (filtr bezpieczeństwa dostawcy)
                           +--> Failed    (dostawca zgłosił błąd, limit czasu, odpowiedź nie jest obrazem)
```

`Completed`, `Failed` i `Blocked` są końcowe. Przejście do stanu końcowego jest jednym warunkowym poleceniem SQL
(`UPDATE ... WHERE status IN (pending, running)`), więc dwa uruchomienia zadania, które kończą to samo zlecenie jednocześnie,
nie mogą obie go zakończyć ani obie zwrócić limitu.

**Kody niepowodzenia** to stałe teksty ASCII (`content_blocked`, `provider_failed`, `timeout`, `invalid_image`,
`budget_exhausted`, `consent_withdrawn`), a nie zdania: tak jak w całym API, słowa należą do aplikacji.
`Blocked` jest zwykłym wynikiem, nie błędem: Google zaostrzył filtr obrazów w 2026 roku i część zwykłych zdjęć modowych jest odrzucana.

**Zadanie wykonuje jeden krok i planuje następne**, zamiast czekać (`jobs.Schedule(..., PollInterval)`), więc zlecenie, które czeka
na dostawcę, nie zajmuje wątku roboczego. Za każdym uruchomieniem:

1. zlecenie nieistniejące (zestaw usunięto) albo końcowe: koniec bez skutków;
2. od przyjęcia zlecenia przez dostawcę (a gdy nie przyjął, od utworzenia rekordu) minęło 180 sekund: `Failed` z kodem `timeout`;
3. brak identyfikatora dostawcy: sprawdzenie zgody i budżetu, złożenie zlecenia, **zapis identyfikatora** i dopiero potem odpytywanie;
4. odpytanie o stan: w kolejce lub w toku, to kolejne uruchomienie za 3 sekundy; błąd odpytania też oznacza kolejne uruchomienie,
   bo zlecenie nadal istnieje, a o czasie decyduje limit trzech minut;
5. gotowe: pobranie obrazu, sprawdzenie pierwszych bajtów (JPEG albo PNG), kopia do magazynu osoby i `Completed`.

Aplikacja ma pytać `GET /api/visualizations/{id}` co 2 do 3 sekund; po wyjściu z ekranu wynik czeka przy zestawie,
bo lista zestawów niesie najnowszą wizualizację każdego z nich. Ta strona przepływu nie jest zbudowana.

## 4. Idempotencja: trzy warstwy

Cel: żadne powtórzenie, ponowienie ani awaria nie może zamówić u dostawcy drugiego obrazu za jedno dotknięcie przycisku.
Każda warstwa łapie inny rodzaj powtórzenia.

1. **Klucz idempotencji z aplikacji.** Nagłówek `Idempotency-Key` (od 8 do 64 znaków: litery, cyfry, myślnik, podkreślenie;
   inaczej `400 idempotency_key_invalid`) losuje aplikacja przy każdym dotknięciu przycisku. Para (osoba, klucz) ma w bazie unikalny
   indeks. Ten sam klucz zwraca istniejący rekord z kodem 200 i nie liczy się drugi raz. Ten sam klucz użyty dla innego zestawu
   to `409 idempotency_key_reused`. Gdy dwa żądania z tym samym kluczem dotrą naraz, wygrywa jedno, a przegrane przechwytuje
   naruszenie unikalności, wycofuje swoją transakcję (razem z licznikiem) i zwraca zwycięzcę.
2. **Zlecenie w toku dla zestawu.** Jeśli dla tego zestawu jest już zlecenie w stanie `Pending` albo `Running`, to ono jest zwracane,
   także gdy klucz jest inny. Obejmuje to podwójne dotknięcie po ponownym wejściu na ekran, gdy aplikacja wylosowała nowy klucz.
   Dopiero po zakończeniu zlecenia można poprosić o nowy obraz tego samego zestawu i jest on liczony.
3. **Identyfikator dostawcy zapisany przed odpytywaniem.** Zadanie, które uruchomi się ponownie (ponowienie Hangfire albo
   przeczekane przez sweep), widzi identyfikator i tylko pyta o stan. Test przerywa zadanie w środku odpytywania i potwierdza
   jedno wywołanie `SubmitAsync`.

Zlecenie, którego zadanie zginęło (restart w złym momencie), podejmuje cykliczne zadanie `visualization-requeue` raz na minutę:
uruchamia ponownie zadanie dla zleceń w stanie `Pending` albo `Running`, których `UpdatedAt` jest starsze niż minuta.
Jeśli minęły trzy minuty, zadanie samo oznaczy je jako `Failed` i zwróci limit.

## 5. Licznik dzienny i zwrot

**Pobranie.** Limit to 5 wizualizacji dziennie na osobę (`Limits:VisualizationsPerDay`). Licznik jest jednym poleceniem
`INSERT ... ON CONFLICT DO UPDATE ... WHERE count < limit` (tak jak limity z Etapu 2, bez odczytu przed zapisem), wykonanym
**w tej samej transakcji, która tworzy rekord zlecenia**. Albo oba zapisy, albo żaden: odmowa, duplikat i błąd zapisu nie kosztują niczego.
Dzień licznika to dzień osoby, w miejscu jej pogody (sekcja 7 notatki Etapu 3), zapisany w rekordzie jako `UsageDay`.

**Zwrot.** Gdy zlecenie kończy się `Failed` albo `Blocked`, limit wraca o jeden: `UPDATE ... SET count = count - 1 ... AND count > 0`,
w tej samej transakcji co zmiana stanu i tylko dla tego uruchomienia, które faktycznie zakończyło zlecenie. Zwrot idzie do dnia zapisanego
w `UsageDay`, nie do bieżącego: test przesuwa zegar o 26 godzin, tak że zlecenie kończy się już następnego dnia, i sprawdza,
że wraca do licznika dnia, z którego został wzięty. Licznik nigdy nie spada poniżej zera.

Zwrot dotyczy każdego niepowodzenia, także wtedy, gdy wina leży po naszej stronie: wycofana zgoda, wyczerpany budżet AI, obraz,
który nie jest obrazem, przekroczenie trzech minut. Zasada brzmi: człowiek nie płaci za obraz, którego nie dostał.

**Dziennik kosztów.** Zlecenie, które dotarło do dostawcy, trafia do `ai_usage_log` bez względu na wynik (z kosztem, jeśli dostawca go
podał, i z czasem od przyjęcia do końca). Zlecenie, które nigdy nie wyszło, nie jest wywołaniem i nie jest zapisywane.
Wizualizacje podlegają też wspólnemu dziennemu budżetowi AI: przy wyczerpanym budżecie prośba kończy się `503 visualizations_paused`
i niczego nie liczy, a zlecenie czekające na wysłanie kończy się `budget_exhausted` ze zwrotem.

Kody odpowiedzi przy złożeniu zlecenia: 202 (nowe), 200 (istniejące), 400 (zły klucz), 403 `consent_required` (brak zgody na AI),
404, 409, 429 `limit_reached` (z polami `kind`, `limit`, `resetsAt`), 503 `visualizations_paused`.

## 6. Co trafia do dostawcy, a co celowo nie

Zlecenie składa się z trzech rzeczy (`VisualizationInput`):

| Co | Skąd |
|---|---|
| tekst zapytania | szablon `visualizer-v1.md` z repozytorium, wypełniony opisami ubrań i nazwą roli każdego (po angielsku, `top`, `bottom`, `outerwear`, `one piece` ...) |
| obraz 1: sylwetka | kopia sylwetki wybranej przy zakładaniu konta, zapisana w prefiksie osoby (`u/<osoba>/sil/...`) |
| obrazy 2 i dalsze: ubrania | wycinki ubrań zestawu, w kolejności ról, nie więcej niż dwa dodatki |

Wszystkie obrazy to **podpisane adresy ważne 15 minut**, odnowione przy każdej próbie złożenia zlecenia. Dostawca pobiera je sam,
backend nie przesyła bajtów.

Opisy, które trafiają do zapytania, są albo zdaniem napisanym przez model tagujący, albo (gdy człowiek poprawił ubranie) zdaniem
zbudowanym z wartości słownikowych tagów (kolor, wzór, materiał, rodzaj). **Nazwa ubrania wpisana przez człowieka nigdy nie wchodzi do
zapytania do generatora obrazów.**

Czego do dostawcy nie wysyłamy. Test `The_provider_gets_the_silhouette_and_the_cutouts...` potwierdza kształt zlecenia i brak notatki; reszta wynika z budowy zlecenia w `BuildInputAsync`, które czyta tylko opisy, role i klucze plików:

- notatki do okazji (test: tekst "kolacja z klientem" nie występuje w zapytaniu); notatka trafia tylko do stylisty,
- imienia, adresu e-mail, daty urodzenia, płci, miejsca pogody ani niczyjego zdjęcia (aplikacja nie przyjmuje zdjęć osób,
  sylwetki są gotowymi obrazami niebędącymi niczyim wizerunkiem),
- ubrań spoza zestawu ani żadnych danych o zestawie poza tym, co wyżej.

Rzeczy, które dostawca jednak widzi, a które warto nazwać:

- **Identyfikator osoby w adresach.** Klucz obiektu zaczyna się od identyfikatora osoby (`u/<32 znaki szesnastkowe>/`) i jest częścią
  adresu. To losowy identyfikator bez e-maila i bez imienia, ale dostawca widzi, że kilka zleceń pochodzi od tej samej osoby.
- **Oryginalne zdjęcie, gdy usuwanie tła zawiodło.** Obrazem ubrania jest wtedy zdjęcie oryginalne (`ImageKey = CutoutKey ?? OriginalKey`),
  a nie wycinek. Telefon usuwa z niego dane położenia i aparatu przy zmniejszaniu (Etap 2), ale tło zostaje.
- **Limity przechowywania u dostawcy** (nagłówki `X-Fal-Store-IO` i `X-Fal-Object-Lifecycle-Preference` ze specyfikacji, zadanie 4.4)
  nie są ustawiane, bo adaptera nie ma. To warunek, który trzeba spełnić przed pierwszym prawdziwym zleceniem.
  Umowy powierzenia i opis transferu poza EOG są wymagane przed publicznym wydaniem, nie w becie.

## 7. Odporność na awarie

| Zdarzenie | Co się dzieje |
|---|---|
| Dostawca odmawia przyjęcia zlecenia | trzy próby (ponowienia zadania), potem `Failed` z `provider_failed` i zwrot; każda próba trafia do dziennika kosztów jako nieudana |
| Dostawca nie umie powiedzieć, jak stoi zlecenie | odpytywanie trwa do upływu trzech minut |
| Dostawca zwraca blokadę filtra | `Blocked` z `content_blocked`, zwrot, koszt zapisany, jeśli dostawca go podał |
| Dostawca zwraca coś, co nie jest JPEG ani PNG | `Failed` z `invalid_image`, zwrot, nic nie trafia do magazynu osoby |
| Zadanie ginie w trakcie (restart) | sweep co minutę uruchamia je ponownie; zlecenie nie jest składane drugi raz, jeśli identyfikator został zapisany |
| Zgoda na AI wycofana, gdy zlecenie czeka | nic nie jest wysyłane, `Failed` z `consent_withdrawn`, zwrot |
| Zestaw usunięty w trakcie | wiersze znikają kaskadowo razem z zestawem; plik, który powstał w międzyczasie, jest usuwany od razu |
| Usunięcie zestawu lub ubrania | pliki obrazów są usuwane po usunięciu wierszy; gdy się nie uda, usuwa je nocne sprzątanie plików bez wiersza |
| Usunięcie konta | wszystko pod prefiksem osoby, w tym obrazy i kopia sylwetki (Etap 5) |

## 8. Znane ograniczenia i czego jeszcze nie zmierzono

**Ograniczenia kodu**, widoczne w lekturze, które warto nazwać w pracy:

- **Okno przed zapisem identyfikatora.** Zlecenie jest zapisywane po tym, jak dostawca je przyjął. Gdyby proces zginął między
  przyjęciem a zapisem, ponowione zadanie złożyłoby drugie zlecenie. Okno jest krótkie, a całkiem usunąć mogłaby je tylko idempotencja po stronie
  dostawcy, o ile ją oferuje; tego nie sprawdzono, bo adaptera nie ma.
- **Brak blokady między dwoma jednoczesnymi uruchomieniami zadania** dla zlecenia bez identyfikatora dostawcy. Ochroną jest
  to, że sweep rusza dopiero po minucie bez ruchu, więc dwa zadania zbiegają się zwykle dopiero wtedy, gdy jedno z nich trwa dłużej niż minutę.
- **Usunięcie zestawu w trakcie zlecenia nie zwraca limitu** (zlecenie znika razem z zestawem, zanim ktokolwiek je zakończy)
  i, gdy dostawca już generował obraz, **nie zapisuje jego kosztu w dzienniku**. Dziennik może więc zaniżać koszt o takie obrazy.
  To wniosek z lektury kodu (`KeepResultAsync`, `GiveUpAsync` nie są wtedy wywoływane); osobnego testu na zwrot w tym przypadku nie ma.
- **Dzień budżetu AI jest liczony w strefie serwera** (`Europe/Warsaw`), a limit osoby w jej własnej. Dla osoby w innej strefie
  oba "dni" nie zaczynają się równocześnie.
- **Obraz nie jest oceniany.** Nie ma w kodzie kontroli, czy postać na obrazie to ta sama sylwetka ani czy ubrania się zgadzają;
  to właśnie dlatego kolaż zostaje obok obrazu.

**Czego nie zmierzono** (plan wymaga w tym miejscu trzech liczb):

- **Czas powstania obrazu.** Bramka: mediana poniżej 40 s, twardy limit 3 minuty. Atrapa kończy zlecenie po dwóch odpytaniach.
  W raporcie `FitIt.Eval` dziesięć zleceń do atrapy daje dziesięć obrazów (`Completed`), zero blokad i zero błędów, a czas liczony
  w milisekundach. To sprawdza, że kod przechodzi cały przepływ, a nie że obraz powstaje szybko. Pomiar na 15 wizualizacjach z własnej szafy na telefonie (zadanie 4.9) wymaga prawdziwego dostawcy i ekranów w aplikacji.
- **Odsetek blokad filtra.** Atrapa nigdy nie blokuje. Prawdziwa liczba pokaże się w `visualizations_by_outcome` (Etap 5)
  po pierwszych zleceniach u prawdziwego dostawcy.
- **Koszt jednego obrazu.** Atrapa zapisuje zero. Specyfikacja (sekcja 7.2) podaje ceny wariantów modelu (0,03 do 0,15 USD za obraz),
  które są cennikiem dostawcy, nie moim pomiarem.
- **Wierność obrazu.** Czy wzory, kroje i napisy są oddane, ocenia człowiek na próbie; w repozytorium nie ma tej oceny.
- **Wybór modelu obrazu** (porównanie trzech wariantów na tych samych dziesięciu zestawach, Etap 0) nie jest częścią kodu i nie jest tu opisany.

## 9. Decyzje podjęte bez pytania, do potwierdzenia

| Decyzja | Dlaczego tak | Łatwo zmienić? |
|---|---|---|
| Zlecenie w toku dla zestawu jest zwracane także przy innym kluczu | druga warstwa idempotencji: aplikacja losuje nowy klucz przy każdym dotknięciu, więc sam klucz nie chroni przed ponownym wejściem na ekran | tak, jedno zapytanie w `VisualizationService.RequestAsync` |
| Po zakończeniu zlecenia ten sam zestaw można zamówić ponownie, a nowy obraz się liczy | specyfikacja tego nie rozstrzyga; zamknięcie możliwości po pierwszym obrazie odebrałoby ponowienie po zablokowaniu albo słabym wyniku | tak |
| Zwrot limitu przy każdym niepowodzeniu, także z naszej winy (wycofana zgoda, budżet, zły obraz, czas) | zasada "człowiek nie płaci za obraz, którego nie dostał" | tak, jedno miejsce (`GiveUpAsync`) |
| Kod błędu w odpowiedzi to stała ASCII, treść komunikatu po stronie aplikacji | ta sama zasada co w całym API (Etap 1) | tak |
| Zadanie planuje następny krok zamiast czekać w pętli | zlecenie czekające na dostawcę nie zajmuje wątku, a restart nie traci stanu | tak, `VisualizationOptions` (odstęp 3 s, limit 180 s) |
| Sweep zleceń raz na minutę, "zawieszone" po minucie bez ruchu | trzeba odróżnić zlecenie, które czeka, od takiego, którego zadanie zginęło | tak, stałe |
| Trzy próby złożenia zlecenia, potem rezygnacja | zgodnie z globalnym ustawieniem ponowień zadań (3) | tak, stała `MaxAttempts` |
| Do obrazu najwyżej dwa dodatki | specyfikacja (7.4); reszta zestawu zawsze się mieści | tak |
| Sylwetka kopiowana do prefiksu osoby, a adres jest podpisany jak każdy inny | generator nie powinien zależeć od tego, gdzie publikowane jest API, a kopia znika razem z kontem | tak |
| Atrapa dostawcy obrazów oddaje jako "wynik" samą sylwetkę (prawdziwy JPEG) | dzięki temu magazyn, adresy i ekran dałoby się przetestować, zanim będzie dostawca | tak, konfiguracja `Providers:OutfitVisualizer` |
| Adaptera fal.ai nie ma; `Providers:OutfitVisualizer=Fal` (i każda inna wartość poza `Fake`) zatrzymuje start | pomijamy usługi wymagające kluczy | tak, jeden adapter za istniejącym portem |
| Ekranów wizualizacji w aplikacji nie zbudowano | ta notatka obejmuje serwer; ekrany czekają na prawdziwego dostawcę, bez którego nie da się ocenić wyglądu stanów | tak |
