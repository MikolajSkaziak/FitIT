# FitIt: makiety aplikacji mobilnej

Plik powstaje z `gen_design.py`. Zmiany wprowadzaj w generatorze, nie tutaj.

- `ekrany/NN-nazwa.html`: każdy ekran jako samodzielna strona. Otwórz ją w przeglądarce; przyciski i zakładki prowadzą do kolejnych ekranów, a w kodzie widać dokładne wymiary, kolory i odstępy.
- `ekrany/NN-nazwa.png`: te same ekrany jako obrazy.
- `zasoby/`: miniatury typów sylwetek.
- `gen_design.py`: źródło makiet. `python3 docs/design/gen_design.py --png` odtwarza strony, obrazy i ten plik.

Wartości zastępcze: rysunki ubrań, miniatury sylwetek, obraz na ekranie „Wizualizacja gotowa” oraz oferta subskrypcji (nazwa, ceny, limity).

## Kierunek: jeden kolor

<table>
<tr>
<td align="center" valign="top"><a href="ekrany/01-Paleta.html"><img src="ekrany/01-Paleta.png" width="640" alt="Paleta, pogoda i pismo"></a><br>Paleta, pogoda i pismo</td>
</tr>
</table>

## Wejście i rejestracja

<table>
<tr>
<td align="center" valign="top"><a href="ekrany/02-Start.html"><img src="ekrany/02-Start.png" width="200" alt="Start"></a><br>Start</td>
<td align="center" valign="top"><a href="ekrany/03-Logowanie.html"><img src="ekrany/03-Logowanie.png" width="200" alt="Logowanie"></a><br>Logowanie</td>
<td align="center" valign="top"><a href="ekrany/04-Rejestracja-konto.html"><img src="ekrany/04-Rejestracja-konto.png" width="200" alt="Rejestracja 1: konto"></a><br>Rejestracja 1: konto</td>
<td align="center" valign="top"><a href="ekrany/05-Rejestracja-o-tobie.html"><img src="ekrany/05-Rejestracja-o-tobie.png" width="200" alt="Rejestracja 2: o Tobie i płeć"></a><br>Rejestracja 2: o Tobie i płeć</td>
</tr>
<tr>
<td align="center" valign="top"><a href="ekrany/06-Rejestracja-sylwetka.html"><img src="ekrany/06-Rejestracja-sylwetka.png" width="200" alt="Rejestracja 3: sylwetki damskie"></a><br>Rejestracja 3: sylwetki damskie</td>
<td align="center" valign="top"><a href="ekrany/07-Rejestracja-sylwetka-meskie.html"><img src="ekrany/07-Rejestracja-sylwetka-meskie.png" width="200" alt="Rejestracja 3: sylwetki męskie"></a><br>Rejestracja 3: sylwetki męskie</td>
<td align="center" valign="top"><a href="ekrany/08-Rejestracja-styl.html"><img src="ekrany/08-Rejestracja-styl.png" width="200" alt="Rejestracja 4: styl"></a><br>Rejestracja 4: styl</td>
<td align="center" valign="top"><a href="ekrany/09-Rejestracja-lokalizacja.html"><img src="ekrany/09-Rejestracja-lokalizacja.png" width="200" alt="Rejestracja 5: pogoda z lokalizacji"></a><br>Rejestracja 5: pogoda z lokalizacji</td>
</tr>
<tr>
<td align="center" valign="top"><a href="ekrany/10-Rejestracja-miasto.html"><img src="ekrany/10-Rejestracja-miasto.png" width="200" alt="Rejestracja 5: miasto, gdy brak lokalizacji"></a><br>Rejestracja 5: miasto, gdy brak lokalizacji</td>
</tr>
</table>

## Dziś i propozycje

<table>
<tr>
<td align="center" valign="top"><a href="ekrany/11-Dzis.html"><img src="ekrany/11-Dzis.png" width="200" alt="Dziś"></a><br>Dziś</td>
<td align="center" valign="top"><a href="ekrany/12-Dzis-bez-lokalizacji.html"><img src="ekrany/12-Dzis-bez-lokalizacji.png" width="200" alt="Dziś: brak lokalizacji"></a><br>Dziś: brak lokalizacji</td>
<td align="center" valign="top"><a href="ekrany/13-Dzis-brakuje.html"><img src="ekrany/13-Dzis-brakuje.png" width="200" alt="Dziś: deszcz i brak okrycia"></a><br>Dziś: deszcz i brak okrycia</td>
<td align="center" valign="top"><a href="ekrany/14-Propozycje-ladowanie.html"><img src="ekrany/14-Propozycje-ladowanie.png" width="200" alt="Propozycje: ładowanie"></a><br>Propozycje: ładowanie</td>
</tr>
<tr>
<td align="center" valign="top"><a href="ekrany/15-Propozycje-pewniak.html"><img src="ekrany/15-Propozycje-pewniak.png" width="200" alt="Propozycje: pewniak"></a><br>Propozycje: pewniak</td>
<td align="center" valign="top"><a href="ekrany/16-Propozycje-odkrycie.html"><img src="ekrany/16-Propozycje-odkrycie.png" width="200" alt="Propozycje: odkrycie"></a><br>Propozycje: odkrycie</td>
<td align="center" valign="top"><a href="ekrany/17-Propozycje-nowe.html"><img src="ekrany/17-Propozycje-nowe.png" width="200" alt="Propozycje: nowe połączenie"></a><br>Propozycje: nowe połączenie</td>
<td align="center" valign="top"><a href="ekrany/18-Wizualizacja-postep.html"><img src="ekrany/18-Wizualizacja-postep.png" width="200" alt="Wizualizacja w toku"></a><br>Wizualizacja w toku</td>
</tr>
<tr>
<td align="center" valign="top"><a href="ekrany/19-Wizualizacja-wynik.html"><img src="ekrany/19-Wizualizacja-wynik.png" width="200" alt="Wizualizacja gotowa"></a><br>Wizualizacja gotowa</td>
</tr>
</table>

## Szafa

<table>
<tr>
<td align="center" valign="top"><a href="ekrany/20-Szafa.html"><img src="ekrany/20-Szafa.png" width="200" alt="Szafa"></a><br>Szafa</td>
<td align="center" valign="top"><a href="ekrany/21-Szafa-pusta.html"><img src="ekrany/21-Szafa-pusta.png" width="200" alt="Szafa: pusta"></a><br>Szafa: pusta</td>
<td align="center" valign="top"><a href="ekrany/22-Zgoda.html"><img src="ekrany/22-Zgoda.png" width="200" alt="Zgoda na AI"></a><br>Zgoda na AI</td>
<td align="center" valign="top"><a href="ekrany/23-Dodawanie.html"><img src="ekrany/23-Dodawanie.png" width="200" alt="Dodawanie zdjęć"></a><br>Dodawanie zdjęć</td>
</tr>
<tr>
<td align="center" valign="top"><a href="ekrany/24-Ubranie.html"><img src="ekrany/24-Ubranie.png" width="200" alt="Ubranie"></a><br>Ubranie</td>
</tr>
</table>

## Outfity, profil i subskrypcja

<table>
<tr>
<td align="center" valign="top"><a href="ekrany/25-Outfity.html"><img src="ekrany/25-Outfity.png" width="200" alt="Outfity"></a><br>Outfity</td>
<td align="center" valign="top"><a href="ekrany/26-Profil.html"><img src="ekrany/26-Profil.png" width="200" alt="Profil"></a><br>Profil</td>
<td align="center" valign="top"><a href="ekrany/27-Subskrypcja.html"><img src="ekrany/27-Subskrypcja.png" width="200" alt="Subskrypcja: zakup"></a><br>Subskrypcja: zakup</td>
<td align="center" valign="top"><a href="ekrany/28-Usun-konto.html"><img src="ekrany/28-Usun-konto.png" width="200" alt="Usuwanie konta"></a><br>Usuwanie konta</td>
</tr>
</table>

## Tryb ciemny

<table>
<tr>
<td align="center" valign="top"><a href="ekrany/29-Ciemny-dzis.html"><img src="ekrany/29-Ciemny-dzis.png" width="200" alt="Ciemny: Dziś"></a><br>Ciemny: Dziś</td>
<td align="center" valign="top"><a href="ekrany/30-Ciemny-propozycje.html"><img src="ekrany/30-Ciemny-propozycje.png" width="200" alt="Ciemny: Propozycje"></a><br>Ciemny: Propozycje</td>
<td align="center" valign="top"><a href="ekrany/31-Ciemny-szafa.html"><img src="ekrany/31-Ciemny-szafa.png" width="200" alt="Ciemny: Szafa"></a><br>Ciemny: Szafa</td>
</tr>
</table>
