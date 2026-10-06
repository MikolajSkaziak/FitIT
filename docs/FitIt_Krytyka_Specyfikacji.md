# FitIt — krytyka specyfikacji v1.1

Data: 5 października 2026. Dotyczy pliku `FitIt_Specyfikacja_Techniczna_v2.md`. Odpowiedzią na tę krytykę są [FitIt_Specyfikacja_MVP.md](FitIt_Specyfikacja_MVP.md) (co budujemy) i [FitIt_Plan_MVP.md](FitIt_Plan_MVP.md) (jak i kiedy).

**Założenia przyjęte z Twoich odpowiedzi:** obrona w czerwcu–lipcu 2027, 10–20 godzin tygodniowo, dobra znajomość .NET, aplikacja mobilna do nauczenia, żaden element specyfikacji nie jest nienaruszalny.

Ceny i wersje sprawdzone 5 października 2026; źródła na końcu. Wszystkie kwoty w złotych liczone po kursie NBP 3,89 zł/USD. Koszty wywołań modeli językowych to szacunki do potwierdzenia w Etapie 0 planu.

---

## 1. Werdykt

Pomysł jest wykonalny, a część decyzji w specyfikacji jest trafna. Dokument opisuje jednak produkt na ponad rok pracy zespołu, a nie MVP, i ma trzy błędy, które zatrzymałyby projekt niezależnie od tempa pracy:

1. **Nic w nim nie dobiera ubrań.** Opisany model „wizyjny” nakłada jedno ubranie na zdjęcie osoby; nie wybiera zestawu. Części, która rozwiązuje problem „nie mam się w co ubrać”, w specyfikacji nie ma.
2. **Wskazane modele Virtual Try-On mają licencję niekomercyjną i nie generują pełnego zestawu.**
3. **Cennik sprzedaje generowanie obrazów poniżej kosztu**, a plan darmowy rozdaje najdroższą operację.

Wnioski z tej krytyki są wdrożone w specyfikacji MVP. Zestawy dobiera tam model językowy pilnowany przez reguły w kodzie, obraz na sylwetce generuje Nano Banana na żądanie, a z architektury odpadają Redis, RabbitMQ i panel administratora.

---

## 2. Słabe strony specyfikacji

### 2.1. Krytyczne

#### A. Brak „mózgu stylisty” (sekcje 3.3 i 5.2)

W przepływie 5.2 Worker „wysyła żądanie do modelu wizyjnego” i odbiera gotowy obraz. Modele Try-On przyjmują zdjęcie osoby i zdjęcie jednego ubrania. Nie wiedzą, co jest w szafie, nie znają okazji i niczego nie wybierają. Dobór zestawu to osobny komponent, dla którego specyfikacja nie podaje modelu, algorytmu ani danych wejściowych, a to on jest sednem produktu. Wizualizacja to tylko sposób pokazania wyniku.

Nie wiadomo też, co wykonuje automatyczne tagowanie i usuwanie tła: funkcje są wymienione w sekcji 3.2, technologia nie. Z kolei „OpenAI GPT-4 Vision” figuruje jako alternatywa dla Try-On, choć to model do rozumienia obrazów, a nie ich generowania (i pod tą nazwą od dawna nieaktualny). Pasowałby do tagowania.

#### B. Virtual Try-On: licencja i ograniczenia (sekcje 2.5 i 3.3)

- **Licencja.** IDM-VTON i OOTDiffusion są udostępnione na CC BY-NC-SA 4.0, czyli bez prawa do użycia komercyjnego; dotyczy to także modelu freemium. To wyklucza je z „komercyjnego wdrożenia startupowego”. Komercyjne odpowiedniki na fal.ai kosztują ok. 0,07–0,075 USD za obraz (Kling Kolors, FASHN).
- **Jedno ubranie na przebieg.** Klasyczne modele Try-On obsługują pojedynczą kategorię (góra, dół albo sukienka) w warunkach studyjnych. Buty, dodatki i warstwy, np. kurtka na koszuli, są poza zasięgiem większości z nich. Pełny zestaw to 2–3 przebiegi, czyli 2–3 razy wyższy koszt i czas oraz narastające zniekształcenia. Alternatywą są modele edycji z wieloma obrazami wejściowymi (np. Nano Banana Pro, ok. 0,15 USD za obraz), które słabiej trzymają detale ubrania.
- **Jakość wejścia.** Modele uczono na czystych zdjęciach produktowych. Użytkownik dostarczy pogniecioną koszulę sfotografowaną na łóżku.
- **Odbiór.** Chodzi o własną twarz i sylwetkę. Lekkie zniekształcenie wystarczy, żeby użytkownik odrzucił wynik.

Wniosek: Try-On wymaga próby na własnych zdjęciach, zanim cokolwiek zostanie wokół niego zbudowane (Etap 0 planu), i nie powinien być warunkiem działania aplikacji.

#### C. Ekonomia jednostkowa (sekcja 1.2)

Przy cenach z października 2026 (0,07–0,15 USD za obraz), jeśli jeden żeton to jeden obraz:

| Pozycja | Wpływ netto¹ | Koszt AI przy pełnym wykorzystaniu | Wynik |
|---|---|---|---|
| Plan darmowy, ok. 13 generacji miesięcznie | 0 zł | 3,5–7,6 zł | strata 3,5–7,6 zł na użytkownika |
| PRO 29,99 zł, 100 żetonów | 20,7 zł | 27–58 zł | strata 7–38 zł |
| Doładowanie 9,99 zł, 50 żetonów | 6,9 zł | 14–29 zł | strata 7–22 zł |

¹ Po odjęciu VAT 23% i prowizji sklepu 15% (stawka dla małych wydawców; standardowa to 30%).

Nie każdy wykorzysta całą pulę, więc realny wynik będzie lepszy niż w tabeli. Problem jest jednak strukturalny: cena żetonu (ok. 0,21 zł netto w PRO, 0,14 zł w doładowaniu) jest niższa niż koszt jednego obrazu (0,27–0,58 zł), a pełny zestaw w klasycznym Try-On to co najmniej dwa obrazy.

Do tego:

- **Paywall jest odwrócony.** Plan darmowy rozdaje najdroższą operację (generowanie obrazu), a PRO zamyka najtańsze: pogoda to jedno zapytanie do API pogodowego, walizka to jedno zapytanie tekstowe do modelu językowego.
- **Darmowi użytkownicy dominują.** W modelach freemium płaci zwykle kilka procent użytkowników, więc jeden abonent musi pokryć koszt kilkudziesięciu darmowych kont.
- **„Nielimitowana szafa” nie jest darmowa.** Koszt nie leży w składowaniu, tylko w przetworzeniu każdego zdjęcia (usunięcie tła i tagowanie, szacunkowo od 2,5 do 10 gr za sztukę, zależnie od modelu). Bez dziennego limitu to otwarte drzwi do nadużyć.
- **„In-App Purchases / Stripe” to nie jest wybór.** Subskrypcje i żetony kupowane w aplikacji iOS/Android co do zasady muszą przejść przez płatności sklepu, z prowizją 15–30%. Wyjątki regionalne się zmieniają; do sprawdzenia przed etapem monetyzacji.
- **Afiliacja.** Stawki w programach Zalando, ASOS i H&M to ok. 5–10%, nie 5–15%. Programy wymagają akceptacji w sieci afiliacyjnej, a dopasowanie rekomendacji do konkretnych produktów to osobny, duży projekt (feed produktowy, wyszukiwanie). Afiliacja kłóci się też z obietnicą „noś to, co już masz”.

#### D. To nie jest MVP (cały dokument)

Dokument nosi nazwę „Wersja MVP”, a zawiera 28 funkcji użytkownika, 18 funkcji administratora w pięciu modułach, trzy źródła przychodu i osiem komponentów infrastruktury do utrzymania. Nie ma priorytetów, więc nie wiadomo, co ciąć, gdy zabraknie czasu. Przy jednej osobie i 10–20 godzinach tygodniowo to ryzyko, że w dniu obrony żadna ścieżka nie działa od początku do końca.

Przykłady rzeczy bez znaczenia dla pierwszej wersji: dashboard z MRR i DAU/MAU przy zerze użytkowników, przełączanie dostawców AI „w czasie rzeczywistym”, panel afiliacyjny, asystent walizki, kalendarz, logowanie społecznościowe.

#### E. Onboarding, największe ryzyko produktu, jest pominięty (sekcja 3.2)

Aplikacja nie daje żadnej wartości, dopóki użytkownik nie sfotografuje kilkunastu rzeczy. Żmudna digitalizacja to znana przyczyna porzucania aplikacji tego typu. Specyfikacja opisuje dodawanie pojedynczo, z ręcznym wyborem pięciu atrybutów na każde ubranie. MVP musi robić odwrotnie: przyjmować wiele zdjęć naraz, tagować automatycznie (użytkownik tylko poprawia), przetwarzać w tle i dawać pierwszy zestaw już przy ok. ośmiu ubraniach.

Brakuje też odpowiedzi na pytanie, dla kogo to jest i czym różni się od konkurencji. Według porównań z 2026 roku Whering, Acloset i Indyx mają dojrzałe darmowe szafy, a Alta jest darmowa, finansowana afiliacją i ma przymierzanie na awatarze. Specyfikacja zakłada pobieranie 29,99 zł miesięcznie za coś, co konkurent daje za darmo.

### 2.2. Poważne (architektura i prawo)

#### F. Kredyty w Redis i brak obsługi błędów (sekcja 5.2)

- Saldo kredytów to dane o charakterze pieniężnym; źródłem prawdy powinna być baza transakcyjna. W PostgreSQL wystarczy jedno atomowe `UPDATE ... SET credits = credits - 1 WHERE user_id = @id AND credits > 0` w tej samej transakcji, która tworzy zlecenie. Redis z blokadą rozproszoną dokłada drugi magazyn stanu, który może się rozjechać z bazą.
- Przepływ nie mówi, co się dzieje przy błędzie: kiedy żeton wraca, ile jest ponowień, jaki jest timeout, kto obsługuje Dead Letter Queue.
- RabbitMQ dostarcza wiadomości co najmniej raz, więc to samo zlecenie może zostać przetworzone dwukrotnie i dwukrotnie opłacone u dostawcy AI. Brakuje idempotencji.
- „Token Bucket” to algorytm ograniczania częstości żądań (wiadro uzupełniane w stałym tempie). Opisany mechanizm to miesięczna pula kredytów. Recenzent pracy to wychwyci.

#### G. Przewymiarowana infrastruktura (sekcje 2.2–2.4)

Każdy komponent to konfiguracja, monitoring, kopie zapasowe i kolejny punkt awarii, a utrzymuje to jedna osoba.

| Komponent | Dlaczego zbędny w MVP |
|---|---|
| Redis | Przy JWT nie ma sesji do cache’owania; ograniczanie częstości żądań jest wbudowane w ASP.NET Core; kredyty należą do bazy. |
| RabbitMQ i osobny Worker | Dla kilkudziesięciu użytkowników wystarczy kolejka zadań utrwalana w PostgreSQL (Hangfire), z ponowieniami i dashboardem w pakiecie. |
| MassTransit | Od wersji 9 płatny; wersja 8 ma zapowiedziane poprawki tylko do końca 2026 roku. |
| Nginx i Cloudflare WAF | Wystarczy jeden reverse proxy z automatycznym TLS. CORS i CSP, wymienione w specyfikacji, dotyczą przeglądarek, a nie natywnej aplikacji mobilnej. |
| pgvector | Dodany „na przyszłość”; żadna funkcja z niego nie korzysta. |

#### H. Nieaktualne wersje (sekcja 2)

- **.NET 8 traci wsparcie 10 listopada 2026**, czyli za pięć tygodni. Nowy projekt powinien startować na .NET 10 (LTS do listopada 2028).
- Expo SDK 51 pochodzi z 2024 roku; od czerwca 2026 dostępne jest SDK 57.
- PostgreSQL 16, Redis 7 i RabbitMQ 3.13 są starsze o jedną do trzech głównych wersji. Swashbuckle zniknął z szablonów .NET; od wersji 9 generowanie OpenAPI jest wbudowane.

#### I. Luki w przepływie uploadu (sekcja 5.1)

- Brak zmniejszania zdjęć na telefonie. Zdjęcie z aparatu ma kilka megabajtów (na iPhonie w formacie HEIC); na łączu komórkowym dodanie 20 ubrań trwałoby wiele minut.
- Nikt nie sprawdza, co faktycznie trafiło do magazynu (rozmiar, typ pliku).
- Brak sprzątania plików, których klient nie potwierdził.
- Nie wiadomo, w którym kroku działa usuwanie tła i tagowanie.

#### J. Prywatność i wymogi sklepów (sekcje 4.2, 4.3 i 6)

- **Transfer do dostawców AI.** Zdjęcia sylwetki trafiają do zewnętrznych firm (fal.ai, Replicate, OpenAI). Specyfikacja mówi o zgodzie i usuwaniu danych u siebie, ale nie o umowach powierzenia, transferze poza EOG ani o retencji po stronie dostawcy. Usunięcie konta w FitIt nie usuwa kopii u nich.
- **Apple, wytyczna 5.1.2(i).** Od listopada 2025 aplikacja musi przed przekazaniem danych osobowych zewnętrznemu AI wyświetlić osobną prośbę o zgodę, wskazującą odbiorcę i zakres danych. Sam zapis w polityce prywatności nie wystarcza.
- **Usuwanie konta.** Specyfikacja umieszcza je w panelu administratora. Apple wymaga, by użytkownik mógł usunąć konto samodzielnie z poziomu aplikacji.
- **Logowanie przez Google** wymusza dodanie równoważnej opcji w rodzaju Sign in with Apple.
- **Moderacja przez administratora.** Zdjęcia w szafie są prywatne i nikt poza właścicielem ich nie widzi. Ręczne przeglądanie ich przez administratora nie ma uzasadnienia i samo narusza zasadę minimalizacji danych.
- **„Dane biometryczne”.** Zdjęcie jest daną biometryczną w rozumieniu RODO dopiero wtedy, gdy jest przetwarzane technicznie w celu jednoznacznej identyfikacji osoby (motyw 51). Tu tak nie jest; to wizerunek. W pracy dyplomowej warto to nazwać precyzyjnie.
- **Art. 15a prawa autorskiego** dotyczy pierwszeństwa uczelni w opublikowaniu pracy (6 miesięcy od obrony), a nie tego, komu przysługują prawa majątkowe; te wynikają z zasady ogólnej, czyli należą do twórcy. Wniosek w specyfikacji jest zasadniczo słuszny, podstawa prawna źle wskazana. Sprawdź też regulamin własności intelektualnej Politechniki Śląskiej. To nie jest porada prawna.

### 2.3. Braki i niedopowiedzenia

- Brak modelu danych, kontraktu API, wymagań niefunkcjonalnych (czas odpowiedzi, limity), strategii testów, CI/CD, rejestrowania błędów i limitu wydatków na AI.
- Brak mierzalnych kryteriów sukcesu MVP.
- Taksonomia ubrań nie ma kategorii jednoczęściowych (sukienka, kombinezon) ani atrybutów formalności i ciepła, bez których nie da się dobrać stroju do okazji i pogody.
- Funkcje bez pokrycia: „bieżący nastrój” (skąd aplikacja ma go znać?), „najrzadziej noszone” i „historia użycia” (wymagają rejestrowania, co użytkownik faktycznie założył), „douczanie preferencji” kciukami (jak?).
- Krok 8 przepływu 5.2 zakłada WebSocket lub push, których nie ma w stosie technologicznym.
- Stan repozytorium: katalog `fit-it` to nietknięty szablon Vite + React (aplikacja webowa) z 2025 roku, niezgodny ze specyfikacją. W praktyce projekt startuje od zera.

### 2.4. Co zostaje

Pre-signed URLs, natychmiastowa odpowiedź i przetwarzanie długich zadań w tle, modularny monolit zamiast mikroserwisów, .NET z PostgreSQL i EF Core, React Native z Expo, a także to, że koszty jednostkowe i RODO pojawiają się już na etapie specyfikacji.

---

## Źródła

Licencje i ograniczenia Try-On:
- [FASHN: przewodnik po licencjach modeli VTON](https://fashn.ai/blog/so-you-want-to-build-a-virtual-try-on-app-a-developers-guide-to-not-getting)
- [Porównanie otwartych modeli Try-On (2026)](https://fashiolabs.com/blog/open-source-virtual-try-on-compared)
- [Garments2Look, CVPR 2026](https://openaccess.thecvf.com/content/CVPR2026/papers/Hu_Garments2Look_A_Multi-Reference_Dataset_for_High-Fidelity_Outfit-Level_Virtual_Try-On_with_CVPR_2026_paper.pdf)
- [Tstars-Tryon 1.0](https://arxiv.org/pdf/2604.19748)

Ceny:
- [FASHN Try-On na fal.ai](https://fal.ai/models/fal-ai/fashn/tryon/v1.5)
- [Kling Kolors Virtual Try-On na fal.ai](https://fal.ai/models/fal-ai/kling/v1-5/kolors-virtual-try-on)
- [Nano Banana Pro (edycja) na fal.ai](https://fal.ai/models/fal-ai/nano-banana-pro/edit)
- [BiRefNet v2 na fal.ai](https://fal.ai/models/fal-ai/birefnet/v2)
- [Cloudflare R2: pre-signed URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/)
- [Kurs USD według NBP](https://www.totalmoney.pl/kursy-walut/nbp/kurs-USD)

Wersje i licencje narzędzi:
- [Microsoft: koniec wsparcia .NET 8 i 9](https://devblogs.microsoft.com/dotnet/dotnet-8-9-end-of-support/)
- [Expo SDK 57](https://expo.dev/changelog/sdk-57)
- [MediatR i MassTransit przechodzą na licencję komercyjną](https://milanjovanovic.tech/blog/mediatr-and-masstransit-going-commercial-what-this-means-for-you)
- [Hangfire](https://www.hangfire.io/)

Rynek:
- [Porównanie aplikacji-stylistów AI (2026)](https://portal-f4u.com/best-ai-stylist-apps/)
- [Porównanie aplikacji-szaf (2026)](https://wardrowbe.com/blog/best-wardrobe-apps-2026/)
- [Indyx: najlepsze aplikacje-szafy](https://www.myindyx.com/blog/the-best-wardrobe-apps)
- [Elara: digitalizacja szafy](https://joinelara.com/blog/digitize-wardrobe-app-guide)
- [Program afiliacyjny ASOS](https://getlasso.co/affiliate/asos/)
- [Program afiliacyjny Zalando](https://danielproctor.com/how-to-join-zalando-affiliate-program/)
- [Program afiliacyjny H&M](https://www.creator-hero.com/blog/h-m-affiliate-program-in-depth-review-pros-and-cons)

Prawo i wymogi sklepów:
- [Apple: aktualizacja App Review Guidelines, listopad 2025](https://developer.apple.com/news/?id=ey6d8onl)
- [Art. 15a ustawy o prawie autorskim i prawach pokrewnych](https://przepisy.gofin.pl/przepisyno,1022,206653,0,0,20160520,3,0.html)
