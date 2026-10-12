# Lista przed wysłaniem do App Store: co zostaje po stronie właściciela

Kod jest przygotowany (zgoda na AI w kontekście i do wycofania, zgłaszanie problemu z obrazem, oznaczenie opisów AI, podanie Open-Meteo, ustawienia kompilacji w `mobile/app.json`). Poniżej to, czego kod nie załatwi. Stan na 11 października 2026.

## Przed pierwszym wysłaniem

- [ ] **Polityka prywatności i regulamin pod prawdziwymi adresami.** Szkice są w `docs/prawne/` (przed publikacją przegląd prawnika, zob. `docs/prawne/README.md`; teksty o zgodzie na AI trzeba przepisać zgodnie z zmianami z 11 X). Gdy strony stoją, ustaw `EXPO_PUBLIC_SITE_URL` (strony `/privacy` i `/terms`; można też `EXPO_PUBLIC_PRIVACY_POLICY_URL` i `EXPO_PUBLIC_TERMS_URL`) w ustawieniach builda. Bez tego aplikacja nie pokazuje odnośników, a Apple wymaga adresu polityki w App Store Connect i w aplikacji.
- [ ] **Odpowiedzi „App Privacy” w App Store Connect.** Zbierane dane, wszystkie powiązane z kontem, żadne nie służą do śledzenia (tracking = nie): e-mail, imię, data urodzenia, płeć, zdjęcia (ubrania i opcjonalne selfie; selfie jest usuwane zaraz po analizie), przybliżona lokalizacja (współrzędne zaokrąglone do 0,1°, do pogody). Cel: funkcje aplikacji. Wspomnij, że zdjęcia trafiają do usług AI (Google, fal.ai) za zgodą. Odpowiedzi muszą zgadzać się z polityką.
- [ ] **Konto demonstracyjne dla recenzenta.** Konto z wypełnioną szafą (kilkanaście ubrań z opisami), z udzieloną zgodą na AI, z gotowymi zestawami i co najmniej jednym obrazem na sylwetce. Dane logowania wpisz w „App Review Information”. W notatce dla recenzenta opisz, gdzie jest zgoda na AI (arkusz przed pierwszym zdjęciem, przełącznik w Profilu, „About”) i gdzie zgłasza się problem z obrazem („Report a problem” pod obrazem).
- [ ] **Produkcyjne API przez HTTPS.** Adres w `EXPO_PUBLIC_API_URL` musi być `https://` (iOS blokuje zwykły HTTP). Prawdziwe klucze dostawców (Google Gemini, fal.ai), magazyn plików (Cloudflare R2) i poczta jako sekrety serwera, nigdy w repozytorium. Zob. `docs/dostawcy.md`. Klucz Gemini z projektu z włączonym rozliczeniem (bezpłatny poziom używa treści do ulepszania produktów Google).
- [ ] **Ocena wiekowa (age rating).** Konto od 16 lat, treści generowane przez AI, brak treści użytkowników widocznych dla innych. Odpowiedz na kwestionariusz zgodnie z tym; zgłaszanie obrazów jest w aplikacji.
- [ ] **Opis, zrzuty ekranu, adres wsparcia, kategoria.** Zrzuty z prawdziwej aplikacji; podpisy nie mogą obiecywać czegoś, czego nie ma.
- [ ] **Umowy z dostawcami.** Umowy powierzenia (art. 28 RODO) z Cloudflare, Google i fal.ai; sprawdzenie okresów przechowywania i zakazu trenowania na danych (zob. `docs/prawne/README.md`, punkt 2).

## Kompilacja

- [ ] `ITSAppUsesNonExemptEncryption: false`, `buildNumber` 1 i `versionCode` 1 są już w `app.json`. Przy każdej kolejnej wysyłce zwiększ numer buildu (iOS) i `versionCode` (Android).
- [ ] Zbuduj i wyślij (EAS albo Xcode) dopiero po powyższych punktach. Tego kod nie robi.

## Gdy dojdą nowe funkcje

- [ ] **Logowanie przez Google ⇒ także Sign in with Apple.** Jeśli aplikacja zaoferuje logowanie przez konto zewnętrzne (Google), wytyczne Apple wymagają równorzędnej opcji Sign in with Apple (lub innej, która spełnia warunki wytycznej 4.8). Dziś logowanie jest tylko e-mailem i hasłem, więc nie dotyczy.
- [ ] **Subskrypcje (RevenueCat) ⇒ wymagania Apple.** Produkty subskrypcyjne w App Store Connect, wyraźna cena i okres odnawiania na ekranie zakupu, przycisk „Restore purchases”, odnośniki do regulaminu i polityki przy zakupie, opis subskrypcji w regulaminie, umowa o płatnych aplikacjach i dane podatkowe/bankowe w App Store Connect, konto testowe sandbox dla recenzenta. Przed płatnościami sprawdź też warunki komercyjnego użycia Open-Meteo (zob. `docs/dostawcy.md`).
