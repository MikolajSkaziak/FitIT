# Dokumenty prawne FitIt: szkice

> **To są szkice, nie gotowe dokumenty. Przed publikacją musi je przejrzeć prawnik.** Nie wolno ich publikować ani linkować z aplikacji w obecnej postaci. Zawierają miejsca do uzupełnienia, założenia o funkcjach, których jeszcze nie ma, i pytania, na które odpowiedzieć może tylko właściciel albo prawnik. Napisano je pod RODO i prawo polskie, na podstawie stanu repozytorium z 9 października 2026 (specyfikacja v2.4, plan v3.3, kod do etapu 2 oraz nowy, dłuższy przewodnik po założeniu konta).

> **Zmiany z 9 października 2026.** (1) Zgoda na przetwarzanie przez usługi AI jest udzielana przez samo założenie konta (zdanie pod przyciskiem „Create account” z odnośnikami do regulaminu i polityki), a osobny ekran zgody przed pierwszym zdjęciem zniknął. Przełącznik wycofania zgody w profilu zostaje. (2) Dochodzi dobrowolna analiza kolorów ze zdjęcia twarzy (selfie), z alternatywą bez zdjęcia. (3) Płeć ma cztery wartości (kobieta, mężczyzna, osoba niebinarna, wolę nie podawać). (4) Ubrania mają sezony. **Najważniejsze nowe pytanie jest w punkcie 2, pozycja 0.**

> **Zmiany z 11 października 2026 (gotowość do App Store).** (1) **Zgoda na AI jest znowu wyraźna i udzielana w kontekście.** Założenie konta jej nie daje (serwer nie zapisuje `ai_consent_at` przy rejestracji), a zdanie pod „Create account” brzmi „By creating an account you agree to the Terms and Privacy Policy.”. Przed pierwszym zdjęciem ubrania i przed selfie aplikacja pokazuje arkusz „Before your photos leave your phone” (co wychodzi, kto to dostaje, co się z tym dzieje, odnośnik do polityki; „Allow and continue” / „Not now”). Zgoda jest jedna, dla obu rodzajów zdjęć, i **do wycofania w Profilu** (grupa „About”, „Send photos to AI services”; wycofanie niczego nie usuwa). Ubrania startowe z katalogu zgody nie wymagają. **Teksty polityki (punkt 4) i regulaminu (punkty 2.2 i 6.4), które mówią, że zgodą jest założenie konta, trzeba przepisać** przed publikacją. (2) **Zgłoszenia problemów z obrazem na sylwetce** trafiają do tabeli `visualization_reports` (osoba, obraz, powód, czas; bez treści obrazu) i do dziennika serwera; zgłoszenie „inappropriate” od razu usuwa obraz. Do polityki: jak długo przechowujemy zgłoszenia (znikają razem z kontem) i że obraz zgłoszony jako niewłaściwy usuwamy. Do regulaminu: że można zgłaszać obrazy. (3) Aplikacja oznacza opisy ubrań napisane przez model („Described by AI”) i podaje Open-Meteo jako źródło pogody.

Zadanie 5.4 planu: polityka prywatności i regulamin jako statyczna strona pod domeną, z odnośnikami w aplikacji.

| Plik | Zawartość |
|---|---|
| [polityka-prywatnosci.md](polityka-prywatnosci.md) | Jakie dane, po co, na jakiej podstawie, jak długo. Odbiorcy danych, przekazywanie poza EOG, prawa użytkownika |
| [regulamin.md](regulamin.md) | Usługa, konto i wiek, zasady i zakazane treści, licencja na zdjęcia, charakter propozycji, limity, beta, usunięcie konta, reklamacje, zmiany |

W obu dokumentach bloki `UWAGA DLA WŁAŚCICIELA` to uwagi robocze. Trzeba je usunąć przed publikacją po rozstrzygnięciu.

## 1. Miejsca do uzupełnienia

W szkicach jest łącznie 33 miejsca `[DO UZUPEŁNIENIA: ...]` (19 w polityce, 14 w regulaminie). Numery to numery punktów dokumentu.

### Polityka prywatności (19)

| Punkt | Co wstawić |
|---|---|
| Góra | Data wejścia w życie |
| 2 | Imię i nazwisko administratora |
| 2 | Adres administratora do korespondencji |
| 2 i 15 | E-mail do kontaktu w sprawach prywatności (dwa miejsca) |
| 3 | Czy wizualizację można usunąć osobno (zależy od wdrożenia) |
| 3 | Jak długo przechowywane są wpisy dziennika kosztów AI |
| 3 | Okres przechowywania dzienników serwera (adresy IP, błędy) |
| 3 | Okres przechowywania korespondencji z użytkownikami |
| 4 | Okres przechowywania danych u Google (Gemini API) (po sprawdzeniu warunków) |
| 4 | Okres przechowywania danych u fal.ai i Google (po sprawdzeniu warunków) |
| 4 | Potwierdzenie, że dostawcy nie trenują modeli na przesłanych danych |
| 6 | Dostawca serwera (hosting) |
| 6 | Dostawca poczty (kod resetu hasła) |
| 6 | Narzędzie do rejestrowania błędów i dostawca aktualizacji aplikacji, jeśli będą używane, wraz z zakresem danych |
| 7 | Podstawa przekazania danych poza EOG dla każdego dostawcy |
| 8 | Kopie zapasowe: czy są, jak długo, kiedy znikną z nich dane usuniętego konta |
| 14 | Z jakim wyprzedzeniem informujemy o zmianach polityki |

### Regulamin (14)

| Punkt | Co wstawić |
|---|---|
| Góra | Data wejścia w życie |
| 1 | Imię i nazwisko usługodawcy, adres, e-mail (trzy miejsca, te same dane co w polityce) |
| 1 | Adres strony z polityką prywatności |
| 3 | Minimalne wersje iOS i Androida |
| 9 | Z jakim wyprzedzeniem informujemy o zakończeniu usługi (propozycja: 30 dni) |
| 9 | Co dzieje się z kontami testerów po zakończeniu bety |
| 11 | Okres wypowiedzenia umowy przez usługodawcę |
| 12 | E-mail do reklamacji |
| 12 | Termin odpowiedzi na reklamację (propozycja: 14 dni) |
| 14 | Czy zmiany regulaminu ogłaszamy także e-mailem |
| 14 | Liczba dni wyprzedzenia przed zmianą regulaminu (propozycja: 14) |
| 15 | Adres strony z regulaminem |

Dane administratora, e-mail i data muszą być spójne w obu dokumentach.

## 2. Otwarte pytania dla właściciela

Uwagi są też wpisane w dokumentach przy odpowiednich punktach.

0. **UWAGA, PRIORYTET: zgoda a zdjęcie twarzy.** *(Stan z 11 X: zgoda jest już osobną czynnością, w kontekście, z własnym brzmieniem dla selfie, i można ją wycofać; poniższe pytanie o ważność zgody wiązanej z kontem jest w tej części nieaktualne. Zostaje pytanie, czy brzmienie arkusza dla selfie wystarcza dla art. 9 RODO.)* Zgoda na AI była udzielana przez założenie konta, a nie osobną czynnością. Czy taka zgoda jest ważna (dobrowolna, konkretna, świadoma, jednoznaczna, art. 4 pkt 11 i art. 7 RODO), skoro bez niej nie da się korzystać z aplikacji (art. 7 ust. 4)? Dla zdjęć ubrań może wystarczyć umowa (art. 6 ust. 1 lit. b) albo uzasadniony interes dla części operacji, ale **zdjęcie twarzy do analizy kolorów** jest wrażliwsze: może zostać uznane za dane szczególnej kategorii (dane biometryczne, art. 9 RODO), jeśli służy do jednoznacznej identyfikacji, albo za wnioskowanie o cechach osobistych. Użytkownicy mają od 16 lat, więc w grę wchodzą też osoby niepełnoletnie. Z tego powodu **ekran selfie ma własną, zawsze widoczną informację** („Your photo is sent to our AI service for this analysis and deleted right after. We keep only your palette.”), bez pola wyboru i bez dodatkowego kroku, a analiza jest w pełni opcjonalna (jest wariant bez zdjęcia: trzy pytania, i można pominąć krok). Do rozstrzygnięcia z prawnikiem: czy ta informacja wystarcza, czy dla selfie potrzebna jest osobna, wyraźna zgoda (art. 9 ust. 2 lit. a), czy zgodę na ogół AI oddzielić od założenia konta, oraz jak to opisać w regulaminie i polityce (punkt 4 polityki, punkt 6 regulaminu).
1. **Status administratora.** Administrator jest osobą fizyczną. Czy bezpłatna beta to jeszcze nie działalność gospodarcza? Co z płatną subskrypcją? Od tego zależy, czy stosują się przepisy konsumenckie i jak opisać administratora.
2. **Przekazywanie danych do USA.** Google (Gemini API) i fal.ai prawdopodobnie przetwarzają dane poza EOG. Jaka jest podstawa (Data Privacy Framework, standardowe klauzule)? Zdanie pod „Create account” i ekran selfie nie wspominają o USA. Czy je uzupełnić?
3. **Umowy powierzenia (art. 28 RODO).** Dziś ich nie ma. Spec. sekcja 12 mówi, że mają być przed publicznym wydaniem: z Cloudflare, Google (Gemini API) i fal.ai (oraz sprawdzenie podwykonawców).
4. **Retencja i trenowanie u dostawców.** Warunki Google (Gemini API) i fal.ai trzeba sprawdzić i wpisać. Do tego czasu dokumenty nie mogą twierdzić, że dostawcy nie trenują na danych.
5. **Wiek zgody poza Polską.** 16 lat jest najwyższym progiem w UE, więc powinno wystarczyć w Unii. Co z krajami spoza UE (USA: COPPA 13 lat, inne kraje)? Czy ograniczyć dostępność aplikacji do wybranych krajów?
6. **Małoletni 16 i 17 lat.** Mają ograniczoną zdolność do czynności prawnych. Czy dla bezpłatnej usługi wystarczy oświadczenie o wieku, czy potrzebna jest zgoda opiekuna?
7. **Aplikacja na cały świat.** Czy dokumenty mają dotyczyć tylko RODO i prawa polskiego (tak jest teraz), czy potrzebne są dodatki dla wybranych krajów (USA, Wielka Brytania, Brazylia)? Czy wybór prawa polskiego dla użytkowników z całego świata jest akceptowalny?
8. **Data urodzenia.** Kod przechowuje datę na stałe i pozwala ją edytować, choć komentarz mówi, że służy tylko do potwierdzenia wieku. Czy wystarczy zapisać sam fakt „ukończone 16 lat”? To otwarta decyzja nr 8 planu.
9. **Wycofanie zgody na AI.** Co ma się stać z dobieraniem zestawów (stylista wysyła opisy do Google (Gemini API)), gdy zgoda zostanie wycofana? Kod wstrzymuje tylko opisywanie zdjęć. Co z danymi, które już są u dostawców?
10. **Notatka do okazji** jest wolnym tekstem wysyłanym do Google (Gemini API). Czy ograniczyć ją (długość, ostrzeżenie w polu), żeby nie trafiały tam dane osobowe?
11. **Zdjęcia osób.** Aplikacja nie może technicznie wykluczyć zdjęcia z osobą (na przykład ubranie na wieszaku z odbiciem w lustrze). Dokumenty przerzucają to na użytkownika. Czy prawnik uznaje to za wystarczające?
11a. **Dodatkowe zdjęcia ubrania (od 11 października 2026).** Ubranie może mieć do czterech dodatkowych zdjęć (tył, detal, „jak leży”), które **mogą pokazywać osobę**. Są przechowywane w magazynie plików jak pozostałe zdjęcia, widzi je tylko właściciel, **nie są wysyłane do dostawców AI** (bez usuwania tła, tagowania i przymiarki) i znikają razem ze zdjęciem, ubraniem albo kontem. Tekstów polityki i regulaminu nie zmieniono: do rozstrzygnięcia, czy trzeba to w nich opisać (zakres danych, wizerunek osób trzecich na takim zdjęciu).
12. **Eksport danych.** Aplikacja nie ma eksportu. Czy prawo do przenoszenia danych realizujemy ręcznie na prośbę e-mailem?
13. **Kopie zapasowe** bazy i plików: czy będą, jak długo, i jak to wpływa na „usuwamy najpóźniej w ciągu doby”.
14. **Prawa do wyników AI.** Czy warunki Google (Gemini API) i fal.ai pozwalają użytkownikowi używać wygenerowanych obrazów i opisów do własnych celów (regulamin 6.6 to obiecuje)?
15. **Ograniczenie odpowiedzialności** (regulamin, punkt 10) i **prawo właściwe** (punkt 13): do oceny prawnika.
16. **Co po becie.** Co dzieje się z kontami i danymi testerów po jej zakończeniu?
17. **Strefa czasowa limitów.** Regulamin mówi „czas polski” dla osób bez miejsca pogody. Sprawdź, czy tak jest w konfiguracji `App:TimeZone`.
18. **Apple i Google.** Czy w App Store używamy standardowej umowy licencyjnej Apple, czy własnej? Etykiety prywatności w sklepach (Apple, Google Data safety) trzeba wypełnić zgodnie z polityką.

## 3. Miejsca, w których dokumenty zakładają funkcje jeszcze niezaimplementowane

Do sprawdzenia na gotowej aplikacji przed publikacją.

| Założenie w dokumentach | Gdzie | Stan na 6 X 2026 |
|---|---|---|
| Konto usuwa się w aplikacji (profil), dane znikają z bazy, pliki usuwa zadanie w tle najpóźniej w ciągu doby | Polityka 8, regulamin 11 | Zadanie 5.1, powstaje równolegle. Ekran profilu nie ma jeszcze usuwania konta |
| Wpisy dziennika kosztów AI zostają po usunięciu konta bez powiązania z użytkownikiem | Polityka 3 i 8 | W schemacie bazy tak (usunięcie osoby ustawia pole na null). Sprawdzić po wdrożeniu usuwania konta |
| Reset hasła kodem z e-maila i dostawca poczty | Polityka 6, regulamin 4 | Zadanie 5.2, powstaje równolegle. Brak funkcji zmiany hasła (regulamin 4.4 odsyła do kontaktu e-mailowego) |
| Zgodę na AI można wycofać (i przywrócić) w profilu. Zgoda jest udzielana w arkuszu przed pierwszym zdjęciem, a nie przy zakładaniu konta | Polityka 4, regulamin 2.2 i 6.4 | Tak (od 11 X): serwer nie zapisuje zgody przy rejestracji i obsługuje udzielenie oraz wycofanie, aplikacja ma arkusz zgody i przełącznik w Profilu (grupa „About”). Teksty dokumentów wymagają przepisania |
| Po wycofaniu zgody przestają wychodzić zdjęcia, a ubrania czekają na ręczny opis | Polityka 4, regulamin 6.4 | W kodzie dla opisywania zdjęć tak. Stylista powstaje w etapie 3 |
| Odnośniki do regulaminu i polityki w aplikacji (zdanie pod „Create account”, arkusz zgody, profil) | Regulamin 15, polityka 4 | Zdanie z odnośnikami jest w aplikacji. Odnośniki działają, gdy ustawione są adresy EXPO_PUBLIC_TERMS_URL i EXPO_PUBLIC_PRIVACY_POLICY_URL (zadanie 5.4). Do tego czasu słowa są zwykłym tekstem |
| Analiza kolorów: selfie wysyłane do dostawcy AI, usuwane w tym samym żądaniu, zapisywany tylko wynik; wariant bez zdjęcia | Polityka 3 i 4, regulamin 6.5 | Kod i testy są. Adapter Google Gemini jest w kodzie; domyślnie działa atrapa (Providers:ColorAnalyst = Fake), prawdziwą usługę włącza się ustawieniem (docs/dostawcy.md) |
| Sylwetka jest wybierana przy zakładaniu konta (wymagana) i służy tylko do obrazu na sylwetce | Polityka 3, regulamin 6.6 | Tak |
| Stylista: propozycje, notatka do okazji, tryb awaryjny bez modelu, ocena kciukiem | Polityka 3, 4, 12, regulamin 2, 7 | Etap 3. Adapter Google Gemini jest w kodzie i wysyła to, co opisuje punkt 6 polityki; domyślnie działa atrapa |
| Wizualizacja na sylwetce, znak SynthID, zwrot limitu przy niepowodzeniu | Polityka 4, regulamin 7, 8 | Etap 4 |
| Usuwanie tła i opisywanie przez prawdziwe usługi (fal.ai, Google Gemini) | Polityka 4, 6 | Adaptery są w kodzie, domyślnie działają atrapy. Gemini sprawdzony na żywo 2026-10-09; fal.ai tylko testami kontraktowymi (brak klucza). Włączanie: docs/dostawcy.md |
| Wyłączenie przechowywania treści u fal.ai | Polityka 4 | Ustawienie `Fal:DisablePayloadStorage` istnieje, domyślnie wyłączone; do sprawdzenia z prawdziwym kluczem. Skracania czasu życia plików nie wdrożono |
| Pliki w Cloudflare R2, bucket w jurysdykcji UE | Polityka 6 | Dziś lokalny serwer zastępczy. Sprawdzić, że prawdziwy bucket i adres usługi mają jurysdykcję UE |
| Dzienniki bez danych wrażliwych i bez podpisanych adresów | Polityka 10 | Zadanie 5.6 |
| Brak reklam, narzędzi analitycznych i śledzących | Polityka 13 | Prawda dziś. Zweryfikować po dodaniu rejestrowania błędów (zadanie 5.5) i usługi aktualizacji |
| Limity 20 propozycji i 5 obrazów na dobę oraz wyświetlanie pozostałych | Regulamin 8 | Limit 50 ubrań działa i jest pokazywany. Pozostałe limity w etapach 3 i 4 |
| Zdjęcie po zmniejszeniu traci dane o położeniu i aparacie | Polityka 4 | Opis z notatek do etapu 2. Sprawdzić na prawdziwym telefonie (symulator nie ma aparatu) |
| Blokada logowania po 5 nieudanych próbach na 5 minut, limit żądań | Polityka 3 i 10 | Zrobione w etapie 1 |

## 4. Rozbieżności znalezione między specyfikacją a kodem

1. **Data urodzenia.** Specyfikacja (sekcja 2) i profil w aplikacji traktują ją jako edytowalne pole profilu. Komentarz w `AppUser.cs` mówi, że przechowuje się ją tylko po to, żeby potwierdzić wiek przy rejestracji. Dokumenty opisują stan faktyczny (przechowywana i edytowalna) i zgłaszają to pytaniem.
2. **Usunięcie konta.** Specyfikacja (sekcja 12) mówi, że wszystkie rekordy znikają kaskadowo. W schemacie bazy wpisy dziennika kosztów AI zostają po usunięciu konta, ale z usuniętym identyfikatorem użytkownika. Polityka opisuje to zgodnie z kodem.
3. **Open-Meteo.** Tabela odbiorców w specyfikacji (sekcja 12) wymienia tylko współrzędne. Wyszukiwanie miasta wysyła do Open-Meteo także wpisaną nazwę miejscowości (notatki do etapu 1). Polityka to uwzględnia.
4. **Zgoda a USA.** Arkusz zgody (od 11 X) nazywa odbiorców (Google i fal.ai; przy selfie tylko Google) i mówi, że działają na własnych warunkach, ale nie mówi o przekazaniu poza EOG ani o Cloudflare i Open-Meteo; to jest w polityce prywatności, do której arkusz odsyła. To luka, nie sprzeczność.
5. **„Nie wysyłamy zdjęć osób”** (dawny ekran zgody; dziś z wyjątkiem opcjonalnego selfie do analizy kolorów) i „aplikacja nie przetwarza niczyjego wizerunku” (specyfikacja) to zamierzenie, którego aplikacja nie jest w stanie wymusić technicznie. Dokumenty ujmują to jako zakaz dla użytkownika i opis działania modelu, a nie gwarancję.
6. **Stan nieukończony.** Opis dostawców i przepływów w polityce pochodzi ze specyfikacji, bo część kodu (stylista, wizualizacja, prawdziwe usługi) jeszcze nie istnieje. Zob. punkt 3.

## 5. Przed publikacją

1. Uzupełnić wszystkie miejsca z punktu 1 i rozstrzygnąć pytania z punktu 2.
2. Sprawdzić punkty z listy w punkcie 3 na gotowej aplikacji.
3. Oddać do przeglądu prawnikowi (w szczególności: status administratora, przekazywanie danych poza EOG, wiek, prawo właściwe, ograniczenie odpowiedzialności).
4. Usunąć bloki `UWAGA DLA WŁAŚCICIELA` i banery „SZKIC”.
5. Opublikować jako statyczną stronę pod domeną i dodać odnośniki w aplikacji (zdanie pod „Create account”, profil).
