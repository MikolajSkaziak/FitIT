# Specyfikacja Wymagań i Architektury Systemu "FitIt" (Wersja MVP / Startup)

**Projekt:** FitIt – Inteligentna wirtualna szafa i asystent stylizacji AI  
**Cel:** Praca inżynierska (Politechnika Śląska) / Komercyjne wdrożenie startupowe  
**Wersja:** 1.1 (MVP)  
**Status:** Wdrożeniowa  

---

## 1. Wprowadzenie i Koncepcja Biznesowa

### 1.1. Cel Systemu
Aplikacja **FitIt** to mobilny system oparty na sztucznej inteligencji, którego nadrzędnym celem jest automatyzacja zarządzania prywatną garderobą oraz eliminacja problemu codziennego doboru ubrań („brak w co się ubrać”). Rozwiązanie pozwala na cyfryzację odzieży przy użyciu aparatu w smartfonie, semantyczne tagowanie oraz generowanie gotowych, spójnych zestawów (Virtual Try-On i stylizacje kapsułowe) z wykorzystaniem zaawansowanych modeli AI.

### 1.2. Model Biznesowy i Ekonomia Jednostkowa (Unit Economics)
1. **Plan Basic (Darmowy):**
   * Nielimitowana pojemność szafy (niski koszt składowania metadanych i zdjęć na AWS S3).
   * Limit 3 bezpłatnych wygenerowań outfitu tygodniowo.
   * Dostęp do podstawowego katalogowania i tagowania ubrań.
2. **Plan FitIt PRO (Subskrypcyjny – ok. 29,99 zł / miesięcznie):**
   * Oparty na **systemie kredytów AI (Token Bucket)** zapobiegającym nadużyciom i drenażowi budżetu (np. pula 100 żetonów stylizacji miesięcznie na generowanie wysokiej jakości zdjęć).
   * Generowanie stylizacji Virtual Try-On wysokiej rozdzielczości.
   * Inteligentny moduł pogodowy (rekomendacja stylizacji dostosowana do temperatury i opadów w lokalizacji użytkownika).
   * Asystent pakowania walizki (optymalizacja bagażu pod kątem wyjazdów).
   * Możliwość dokupienia doładowania żetonów (np. pakiet 50 tokenów za 9,99 zł).
3. **Moduł E-commerce i Afiliacja:**
   * Rekomendacja brakujących elementów garderoby (np. „Do tego zestawu pasują białe skórzane sneakersy”) z linkami partnerskimi (Zalando, ASOS, H&M) generującymi prowizję ze sprzedaży (5–15%).

---

## 2. Stos Technologiczny i Narzędziowy

### 2.1. Warstwa Kliencka (Mobile)
* **Framework:** React Native (Expo SDK 51+)
* **Język:** TypeScript (pełne ścisłe typowanie modeli domenowych)
* **Zarządzanie stanem:** Zustand / TanStack Query (React Query) do cachowania zapytań HTTP
* **Nawigacja:** Expo Router (file-based routing)
* **Komunikacja sieciowa:** Axios z interceptorami autoryzacji (odświeżanie tokenów JWT)
* **Natywne API urządzenia:** Expo Camera (aparat i galeria), Expo Location (lokalizacja do modułu pogodowego)

### 2.2. Warstwa Dostępu i Bezpieczeństwa (Edge / Reverse Proxy)
* **Cloudflare:** CDN (Content Delivery Network), WAF (Web Application Firewall), ochrona DDoS, SSL Termination, DNS.
* **Nginx Reverse Proxy:** Ochrona serwera aplikacji Kestrel, trasowanie `/api/*`, obsługa CORS, nagłówki bezpieczeństwa (HSTS, CSP, X-Frame-Options).

### 2.3. Warstwa Aplikacyjna (Backend)
* **Główne Web API:** .NET 8 (C#)
  * Architektura: Clean Architecture / Modular Monolith (podział na Core/Domain, Application, Infrastructure, API).
  * Komunikacja: RESTful API, JSON, OpenAPI (Swagger / Swashbuckle).
  * Bezpieczeństwo i tożsamość: ASP.NET Core Identity, JWT (Access Token + Refresh Token).
  * ORM: Entity Framework Core 8 z migracjami.
* **Worker AI (Background Service):** .NET 8 Worker Service (C#)
  * Asynchroniczny konsument kolejki wiadomości, odciążający API z czasochłonnych zadań graficznych.
  * Biblioteki: `MassTransit` lub oficjalny klient `RabbitMQ.Client`.

### 2.4. Warstwa Danych i Kolejek
* **PostgreSQL 16:** Główna relacyjna baza danych (zgodność z ACID).
  * Rozszerzenie: `pgvector` pod kątem przyszłego wyszukiwania wektorowego i embeddingów odzieży.
* **Redis 7 (In-Memory Data Store):**
  * Cache sesji i danych profilowych użytkownika.
  * Distributed Lock (blokady rozproszone) oraz mechanizm Rate Limiting (limitowanie liczby zapytań na minutę).
* **RabbitMQ 3.13+:** Broker wiadomości (AMQP) realizujący asynchroniczne kolejkowanie zleceń generowania stylizacji.

### 2.5. Usługi Chmurowe i Zewnętrzne API
* **AWS S3 (Simple Storage Service):** Magazyn obiektowy na zdjęcia ubrań i wygenerowane outfity. Wykorzystanie wzorca **Pre-signed URLs** (klient wysyła plik bezpośrednio do S3 z pominięciem serwera .NET).
* **AI Image / Virtual Try-On API:** Fal.ai / Replicate (modele wyspecjalizowane typu IDM-VTON / OOTDiffusion zachowujące fakturę i krój ubrań) lub OpenAI GPT-4 Vision.
* **Weather API:** OpenWeatherMap API (dane meteorologiczne pod stylizacje pogodowe).

---

## 3. Szczegółowy Zakres Funkcjonalny – Użytkownik Aplikacji

### 3.1. Uwierzytelnianie i Profil Użytkownika
* Rejestracja konta przy użyciu adresu e-mail i hasła (wymóg silnego hasła).
* Logowanie z wykorzystaniem pary tokenów: `Access Token` (krótkoterminowy) oraz `Refresh Token` (długoterminowy, przechowywany w bezpiecznym magazynie telefonu SecureStore/Keystore).
* Logowanie społecznościowe (Social Auth: Google, Apple ID).
* Procedura resetu i zmiany hasła z wykorzystaniem tokenów jednorazowych wysyłanych na e-mail.
* Zarządzanie danymi profilowymi: imię, płeć, preferowany styl ubioru (np. casual, streetwear, business, smart-casual), dominująca paleta barw.
* Wybór awatara sylwetki: możliwość wgrania zdjęcia całej sylwetki lub wybór predefiniowanego modelu ciała do przymierzalni AI.

### 3.2. Cyfrowa Szafa (Garderoba)
* **Wgrywanie zdjęć:**
  * Wykonanie zdjęcia bezpośrednio z aparatu telefonu lub import z galerii.
  * Pobieranie z backendu jednorazowego adresu URL (Pre-signed URL) i bezpośredni upload do AWS S3.
* **Automatyczna i ręczna segmentacja:**
  * Automatyczne wycinanie tła ze zdjęć ubrań (background removal).
  * Przypisywanie atrybutów: Kategoria nadrzędna (Góra, Dół, Obuwie, Okrycie wierzchnie, Dodatki), Podkategoria (np. Koszula, T-shirt, Jeansy, Chinosy, Sztyblety).
  * Wybór koloru, materiału oraz sezonu (Wiosna/Lato, Jesień/Zima, Całoroczne).
  * Oznaczanie ubrań jako „Ulubione” lub „W praniu” (wykluczenie z generowania stylizacji na dany dzień).
* **Wyszukiwanie i filtrowanie:**
  * Filtrowanie szafy po kolorze, porze roku, typie odzieży oraz tagach.
  * Podgląd szczegółów ubrania z datą dodania i historią użycia w outfitach.
* **Zarządzanie garderobą:**
  * Edycja parametrów ubrań, zastępowanie zdjęć, usuwanie z szafy (wraz z usunięciem powiązanych plików z AWS S3).

### 3.3. Inteligentny Wirtualny Stylista (Moduł AI)
* **Zlecenie generowania outfitu:**
  * Wybór okazji (np. Spotkanie biznesowe, Randka, Trening, Wyjście ze znajomymi).
  * Opcja "Zaskocz mnie" (generowanie na podstawie bieżącego nastroju lub najrzadziej noszonych ubrań).
  * Wybór konkretnego elementu szafy jako bazy (np. "Dobierz mi coś do tych bordowych spodni").
* **Asynchroniczny proces generowania (Try-On):**
  * Wysłanie zlecenia do RabbitMQ; użytkownik widzi estetyczny loader z powiadomieniem push/in-app po ukończeniu generowania.
  * Otrzymanie fotorealistycznej wizualizacji sylwetki w wygenerowanym zestawie.
* **Zarządzanie stylizacjami:**
  * Zapisywanie wygenerowanego outfitu do biblioteki „Moje Outfity”.
  * Ocenianie stylizacji (kciuk w górę/dół) w celu douczania preferencji użytkownika.
  * Planowanie kalendarza: przypisywanie zestawu ubrań do konkretnego dnia w kalendarzu.

### 3.4. Moduły Zaawansowane (Plan PRO)
* **Integracja z Pogodą:**
  * Automatyczne pobranie geolokalizacji, weryfikacja temperatury oraz opadów i wykluczanie z outfitu ubrań nieadekwatnych (np. szortów w deszczowy dzień).
* **Asystent Walizki (Smart Packing):**
  * Wskazanie celu podróży, dat i limitu sztuk odzieży.
  * AI generuje kapsułową szafę wyjazdową (np. 10 elementów, z których można złożyć 7 unikalnych zestawów).
* **Zarządzanie Kredytami:**
  * Podgląd dostępnej puli żetonów AI w danym okresie rozliczeniowym.
  * Zakup dodatkowych tokenów za pośrednictwem płatności mobilnych (In-App Purchases / Stripe).

---

## 4. Szczegółowy Zakres Funkcjonalny – Panel Administratora (Backoffice)

Dostępny jako moduł webowy z uprawnieniami typu `Role: Administrator` / `SuperAdmin`.

### 4.1. Dashboard i Analityka Główna (KPI)
* Liczba aktywnych użytkowników (DAU / MAU) oraz wskaźniki retencji.
* Liczba skatalogowanych ubrań w systemie i wygenerowanych outfitów w ujęciu dobowym/miesięcznym.
* Całkowity koszt zapytań do zewnętrznych dostawców AI (Fal.ai, OpenAI).
* Przychód z subskrypcji (MRR – Monthly Recurring Revenue) oraz wskaźnik konwersji Basic -> PRO.

### 4.2. Zarządzanie Użytkownikami (User Management)
* Wyszukiwarka i lista użytkowników z filtrowaniem po statusie subskrypcji, dacie rejestracji i adresie e-mail.
* Podgląd profilu: statystyki szafy użytkownika, historia wygenerowanych zestawów, logi aktywności.
* Akcje administratorskie:
  * Blokowanie/banowanie kont naruszających regulamin.
  * Resetowanie limitu kredytów / ręczne dodawanie tokenów wsparcia technicznego.
  * Zmiana statusu konta (ręczne nadanie roli PRO lub Administratora).
  * Obsługa procedury usuwania konta zgodnie z RODO (GDPR Data Purge).

### 4.3. Moderacja i Bezpieczeństwo Treści
* Monitorowanie zdjęć pod kątem treści niedozwolonych (wulgarnych, erotycznych) – integracja z filtrami wizyjnymi.
* Ręczne usuwanie zakwestionowanych elementów z szafy użytkownika.
* Przegląd logów błędów generowania AI oraz powiadomień o nieudanych transakcjach płatniczych.

### 4.4. Zarządzanie Modelami AI i Kolejkami
* Podgląd stanu kolejki RabbitMQ: liczba zadań oczekujących (`Ready`), w trakcie (`Unacked`) oraz zakończonych niepowodzeniem (`Dead Letter Queue`).
* Możliwość przełączania aktywnych dostawców AI w czasie rzeczywistym (np. w przypadku awarii jednego API przełączenie na model zapasowy bez restartu aplikacji).
* Konfiguracja promptów systemowych (prompt engineering) dla modułu stylisty.

### 4.5. Panel Afiliacyjny i Reklamowy
* Zarządzanie linkami partnerskimi i bazą produktów od partnerów (np. Zalando).
* Śledzenie liczby kliknięć w rekomendowane produkty (Click-Through Rate) i wygenerowanego zysku z prowizji.

---

## 5. Przepływ Danych i Kluczowe Wzorce Architektoniczne

### 5.1. Wzorzec Pre-signed URLs (Optymalizacja Transferu Obrazów)
1. Aplikacja mobilna wysyła zapytanie do API: `POST /api/clothes/upload-ticket` z rozszerzeniem i rozmiarem pliku.
2. API .NET weryfikuje uprawnienia i generuje unikalny token AWS S3 Pre-signed URL z ważnością np. 5 minut.
3. API zwraca link mobilnemu klientowi.
4. Telefon przesyła surowe zdjęcie bezpośrednio do bucketa AWS S3 przy użyciu metody HTTP `PUT`.
5. Po udanym uploadzie klient wysyła do API potwierdzenie: `POST /api/clothes`, a API zapisuje metadane rekordu w PostgreSQL.
*Rezultat:* Serwery backendowe .NET nie zużywają pamięci RAM ani pasma sieciowego na pośredniczenie w transferze ciężkich plików graficznych.

### 5.2. Asynchroniczne Generowanie Stylizacji (Odporność na Timeouty)
1. Użytkownik klika „Generuj Outfit”.
2. API sprawdza w Redis liczbę dostępnych kredytów użytkownika i blokuje 1 żeton (Distributed Lock).
3. API tworzy zadanie w bazie ze statusem `Pending` i publikuje zdarzenie `GenerateOutfitCommand` do RabbitMQ.
4. API natychmiast zwraca kod `202 Accepted` z identyfikatorem zlecenia do aplikacji mobilnej.
5. `Worker AI (.NET)` w tle odbiera wiadomość z kolejki.
6. Worker wysyła żądanie do modelu wizyjnego.
7. Po odebraniu odpowiedzi Worker pobiera gotowy plik, umieszcza go na AWS S3 i aktualizuje rekord w bazie PostgreSQL na status `Completed`.
8. Za pośrednictwem powiadomienia WebSocket / Push Notification aplikacja mobilna pobiera gotowy outfit.

---

## 6. Weryfikacja Prawna i Prawa Własności Intelektualnej
1. **Własność Kodu:** Zgodnie z art. 15a Ustawy o prawie autorskim i prawach pokrewnych, autorskie prawa majątkowe do oprogramowania stworzonego przez studenta w ramach pracy dyplomowej przysługują twórcy (studentowi), o ile nie zawarto odrębnej umowy.
2. **Autonomia Środowiska:** Wszelkie prace programistyczne, procesy wdrażania i konta chmurowe (AWS, Cloudflare, OpenAI/Fal.ai) są utrzymywane z zasobów prywatnych autora. Politechnika Śląska zachowuje jedynie uprawnienia do publikacji i archiwizacji części opisowej pracy oraz weryfikacji w Jednolitym Systemie Antyplagiatowym (JSA).
3. **Zgodność RODO (GDPR):** Przechowywane dane biometryczne (wizerunek użytkownika) podlegają klauzulom wyraźnej zgody (`Explicit Consent`) oraz prawu do bycia zapomnianym (usunięcie konta usuwa wszystkie powiązane zdjęcia z S3 oraz wpisy bazy danych w kaskadowy sposób).
