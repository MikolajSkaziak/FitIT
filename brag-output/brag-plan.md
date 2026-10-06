# FitIt: plan filmu promocyjnego (20 s)

Źródła: ekrany z `docs/design` (ten sam kod, który rysuje makiety) i `docs/FitIt_Specyfikacja_MVP.md`.

## Odpowiedzi przed planem

- **Co to jest:** aplikacja, która układa zestawy z ubrań, które już masz, na dzisiejszą pogodę i okazję.
- **Dla kogo:** dla osób z pełną szafą, które i tak „nie mają się w co ubrać".
- **Co ją wyróżnia:** niczego nie sprzedaje, korzysta z Twojej szafy; trzy propozycje dziennie, w tym jedna z zapomnianym ubraniem.
- **Najmocniejsze zdanie:** „Trzy zestawy na dziś" z tego, co już masz.
- **Haczyk wizualny:** ściana ubrań zapełnia ekran, a zaznaczenie skacze po niej bez decyzji.
- **Prawdziwy interfejs:** Dodawanie zdjęć → Szafa → Dziś (pogoda z ikoną, okazja) → Propozycje (Pewniak, Odkrycie, Nowe połączenie).
- **Ton:** `polished`: spokojnie, elegancko, bez żartów. Jeden kolor (szałwia), butelkowa zieleń, Bricolage Grotesque i Figtree, jak w makietach.
- **Podpis do udostępnienia:** „Pełna szafa, a nie masz się w co ubrać? FitIt układa trzy zestawy dziennie z tego, co już w niej wisi."

## Kąt

Film zaczyna od pytania, które jest definicją problemu w specyfikacji, i kończy odpowiedzią w dwóch słowach. Pomiędzy pokazuje działającą pętlę produktu w trzech krokach na prawdziwych ekranach.

- **Haczyk:** „Pełna szafa. A nie masz się w co ubrać?"
- **Trzy kroki:** sfotografuj ubrania, wybierz okazję, dostań trzy zestawy.
- **Puenta:** „Już masz." i zestaw, który został wybrany w ostatnim kroku.

## Czego film nie pokazuje

- Obrazu „na sylwetce": nie ma jeszcze żadnego prawdziwego wygenerowanego obrazu, a goły manekin udawałby wynik.
- Subskrypcji: oferta nie jest ustalona.
- Daty premiery ani sklepów: aplikacja nie jest wydana, więc zakończenie mówi tylko „Wkrótce na iOS i Androida".

## Scenariusz (1920×1080, 30 kl./s, takt 0,625 s przy 96 BPM)

| # | Czas | Scena | Na ekranie | Tekst |
|---|---|---|---|---|
| 1 | 0,00–3,75 | Haczyk | Po prawej dwanaście kafli z ubraniami wskakuje jeden po drugim; potem zielona ramka skacze po kaflach bez decyzji. | „Pełna szafa. A nie masz się w co ubrać?" |
| 2 | 3,75–6,25 | Odsłona | Znak i nazwa na środku; na końcu znak zjeżdża do rogu i zostaje tam do finału. | „FitIt" / „Zestawy z tego, co już masz." |
| 3 | 6,25–10,00 | Krok 1: szafa | Wjeżdża telefon z arkuszem „Dodaj ubrania": zdjęcie się wysyła, zamienia w „Ciemne jeansy, gotowe, opisane"; dotknięcie „Gotowe", arkusz zjeżdża, w szafie pojawiają się ubrania. | „Sfotografuj ubrania." / „Aplikacja sama je opisze." |
| 4 | 10,00–13,75 | Krok 2: dziś | Ekran „Dziś" z pogodą i obracającym się słońcem; dotknięcie okazji „Na co dzień", potem „Zaproponuj zestawy"; ekran ładowania. | „Wybierz okazję." / „Pogodę sprawdzamy za Ciebie." |
| 5 | 13,75–17,50 | Krok 3: propozycje | Trzy zestawy po kolei, każdy co dwa takty: kafle wskakują, zakładka się przełącza; na końcu dotknięcie „Zakładam to". | „Trzy zestawy na dziś." / „Pewniak", „Odkrycie", „Nowe połączenie" |
| 6 | 17,50–20,00 | Puenta | Telefon zjeżdża; wybrany zestaw w czterech kaflach, znak wraca na środek. | „Już masz." / „Wkrótce na iOS i Androida" |

Suma: 3,75 + 2,50 + 3,75 + 3,75 + 3,75 + 2,50 = 20,00 s.

Przejścia: stare znika, potem wchodzi nowe (bez nakładania dwóch gęstych układów). Zmiany ekranów dzieją się wewnątrz telefonu, tak jak w aplikacji.

## Dźwięk

Muzyka i efekty napisane razem, w D-dur, w tej samej przestrzeni pogłosu.

- 0,00–6,25: sam pad i pojedyncze dźwięki; wskakujące kafle grają rosnącą pentatonikę; przy odsłonie nazwy dzwonek.
- 6,25–17,50: wchodzi miękka stopa, pstryknięcie, bas i arpeggio ósemkami; zmiany scen i przełączenia propozycji wypadają na takty.
- 17,50: rozwiązanie na tonice z dzwonkami, wybrzmienie do końca.
- Efekty (dotknięcia, szumy przejść, potwierdzenie opisu zdjęcia) są ciche i w tonacji.

## Plakat

Ustalona klatka ze sceny 5 (telefon z propozycją, „Trzy zestawy na dziś." i trzy nazwy), wstawiona jako klatka 0.
