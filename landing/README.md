# fitit. — strona lądowania

Marketingowa strona aplikacji (sam front end): React 19, Vite, TypeScript w trybie strict, animacje w `motion`.
Język wizualny jest ten sam co w aplikacji (`docs/design/redesign/`, `mobile/src/theme/tokens.ts`).

## Uruchomienie

```bash
npm install
npm run dev        # serwer deweloperski (domyślnie http://localhost:5173)
npm run typecheck  # tsc --noEmit
npm run build      # typecheck + produkcyjny build do dist/
npm run preview    # podgląd zbudowanej strony
```

W Claude Code jest też konfiguracja `landing` w `.claude/launch.json` (port 5199).

## Gdzie co jest

| Co | Gdzie |
| --- | --- |
| Teksty, linki, ceny, limity, dane w makietach | `src/content.ts` |
| Tokeny (kolory, kroje, krzywe, odstępy) | `src/styles/base.css`, blok `:root` |
| Język aplikacji wewnątrz telefonu (port `fitit.css`) | `src/styles/app.css` |
| Układ sekcji | `src/styles/sections.css` |
| Ekrany aplikacji odtworzone w React | `src/screens/` |
| Sekcje strony | `src/sections/` |
| Ramka telefonu, przycisk CTA, zakładki, nawigacja | `src/components/` |
| Teksty prawne (polityka prywatności, regulamin) i ich układ | `src/legal/`, `src/components/LegalPage.tsx`, `src/styles/legal.css` |
| Obrazy (webp) | `src/assets/`, favicon i obraz OG w `public/` |

## Do uzupełnienia przed publikacją

Wszystko jest w `src/content.ts` i jest tam oznaczone słowem `PLACEHOLDER`:

- `STORE_LINKS` — linki do App Store i Google Play (teraz `#`).
- `CONTACT_EMAIL` — adres kontaktowy. `LEGAL_LINKS` już wskazują `/terms` i `/privacy` (zob. niżej).
- `QR_CODE_IMAGE` — obraz prawdziwego kodu QR (teraz pusta ramka z napisem „QR code”).
- `PLUS_PRICE_MONTHLY`, `PLUS_PRICE_YEARLY`, `PLUS_PRICE_YEARLY_PER_MONTH` — ceny Plus; `null` wyświetla się jako `$—`.
- `FREE_/PLUS_OUTFIT_SUGGESTIONS_PER_DAY`, `FREE_/PLUS_TRY_ONS_PER_DAY` — dzienne limity; `null` wyświetla się jako „— a day”.
- `FREE_/PLUS_OUTFIT_CALENDAR`, `FREE_/PLUS_COLOR_ANALYSIS` — wartości z makiety subskrypcji, do potwierdzenia.
- `FAQ` — odpowiedzi opisują aplikację według projektu; odpowiedź o zdjęciach trzeba zgodzić z polityką prywatności.

Dopóki którakolwiek cena lub limit jest `null`, w sekcji cennika widać etykietę „To be announced”.

W `index.html` znacznik `og:image` wskazuje `/og.jpg`; po wybraniu domeny warto podać pełny adres i dodać `og:url`.

## Regulamin i polityka prywatności (`/terms`, `/privacy`)

Aplikacja mobilna linkuje do tych dwóch podstron (`EXPO_PUBLIC_TERMS_URL`, `EXPO_PUBLIC_PRIVACY_POLICY_URL`).

- **Teksty** leżą jako dane w `src/legal/terms.ts` i `src/legal/privacy.ts` (po jednym pliku na dokument; typy w `types.ts`).
  W tekście działa prosty znacznik: `**pogrubienie**`, `` `kod` ``, `[tekst](/adres)` i `[TO BE COMPLETED: ...]` — to ostatnie
  strona rysuje jako widoczne, przerywane pole do uzupełnienia. Wszystkie pola są tam, gdzie w szkicu było `[DO UZUPEŁNIENIA: ...]`
  (19 w polityce, 14 w regulaminie; wyszukaj `TO BE COMPLETED`).
- **Układ** jest wspólny: `src/components/LegalPage.tsx` (nawigacja i stopka strony, wąska kolumna, spis treści, nagłówki, tabele jako wpisy).
- **To tłumaczenia szkiców z `docs/prawne/`** (`polityka-prywatnosci.md`, `regulamin.md`), nie osobne dokumenty. Teksty angielskie
  **wymagają przeglądu prawnika przed publikacją**, tak samo jak polskie szkice. Przy zmianie szkicu trzeba zmienić też plik w `src/legal/`.
  Bloki „UWAGA DLA WŁAŚCICIELA” ze szkiców są notatkami roboczymi i celowo nie trafiają na stronę.
- Dopóki teksty są szkicami, każda strona ma etykietę „Draft — not yet in force” (pole `draft` w pliku dokumentu; po publikacji ustaw `null`)
  oraz `<meta name="robots" content="noindex">` w `privacy/index.html` i `terms/index.html` (usuń ją razem z etykietą).
- **Routing bez biblioteki i bez konfiguracji serwera:** build wielostronicowy Vite (`vite.config.ts`, `build.rollupOptions.input`).
  Oprócz `index.html` powstają `dist/privacy/index.html` i `dist/terms/index.html`, więc zwykły hosting statyczny (Netlify, Cloudflare Pages,
  GitHub Pages, S3 + CDN, nginx) obsłuży `/privacy` i `/terms` bez przepisywania adresów. Wszystkie trzy HTML-e ładują ten sam
  `src/main.tsx`, który po `window.location.pathname` wybiera stronę (zwykły przełącznik, bez routera). Każda podstrona ma własne
  `<title>` i opis; `LegalPage` ustawia je też po stronie klienta, na wypadek gdyby host zwrócił dla `/privacy` stronę główną
  (tak robi `vite preview` dla adresu bez ukośnika na końcu; wtedy i tak wyświetla się właściwa treść).
- Linki w nawigacji i stopce podstron prowadzą z powrotem do `/#sekcja` na stronie głównej.

## Ekrany i animacje

Telefony nie są zrzutami ekranu: to komponenty rysowane w szerokości 393 pt i skalowane jednym `transform`
(zmienna `--pw` w `app.css`). Telefony są dekoracją (`aria-hidden`, `inert`), znaczenie niesie tekst obok.

- Hero: ekran Today, zakładki okazji i karuzela trzech stylizacji przełączają się same.
- „From photo to wardrobe”: od 900 px szerokości telefon jest przypięty, a kroki zmienia przewijanie;
  na mniejszych ekranach i przy `prefers-reduced-motion` kroki są ułożone pod telefonem.
- „Dressed for the weather”, „See it on you”: zakładki obsługiwane myszą i klawiaturą; automatyczne
  przełączanie kończy się po pierwszym wyborze.
- Przy `prefers-reduced-motion` nic nie przełącza się samo, a półka ze stylami staje się zwykłą przewijaną listą.

## Obrazy

Wycięte ubrania, figury, zdjęcia stylów i zdjęcia redakcyjne pochodzą z repozytorium (`backend/.../wwwroot`,
`docs/design`). Dwa obrazy wygenerowano w fal.ai (`fal-ai/nano-banana-2/edit`): `src/assets/photos/raw.webp`
(kurtka na łóżku, „surowe” zdjęcie) i `src/assets/photos/tryon.webp` (manekin w stylizacji).
