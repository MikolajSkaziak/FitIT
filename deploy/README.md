# Wdrożenie FitIt na jednej maszynie wirtualnej

Ten katalog zawiera wszystko, co potrzebne do uruchomienia FitIt na jednej małej VM z Ubuntu LTS (1 do 2 GB pamięci, zalecane 2 GB):
API (.NET 10), PostgreSQL 18 i Caddy, który sam zdobywa certyfikat HTTPS. Zdjęcia nie przechodzą przez serwer: telefon wysyła je prosto do Cloudflare R2.

```
telefon ──HTTPS──► Caddy (80/443) ──► API (5080, wewnątrz Dockera) ──► PostgreSQL (wewnątrz Dockera)
   └────PUT zdjęcia (podpisany adres)────────────────────────────────► Cloudflare R2
```

Na zewnątrz widać tylko porty 22 (SSH), 80 i 443. API i baza nie mają opublikowanych portów.

| Plik | Do czego służy |
|---|---|
| `compose.yml` | API (obraz z `backend/Dockerfile`, użytkownik bez uprawnień roota), PostgreSQL z wolumenem i healthcheckiem, Caddy |
| `Caddyfile` | HTTPS, nagłówki bezpieczeństwa, limit ciała żądania 256 KB, kompresja, ukryty `/hangfire` i `/openapi`, strony `/regulamin` i `/prywatnosc` |
| `.env.example` | Szablon pliku z sekretami. Każda zmienna ma komentarz z kluczem konfiguracji API, którego dotyczy |
| `backup.sh` | Nocny zrzut bazy, retencja, opcjonalna kopia do R2 |
| `restore.sh` | Próbne odtworzenie ostatniej kopii do tymczasowej bazy |
| `server-setup.sh` | Jednorazowa konfiguracja czystej VM |
| `legal/` | Dokumenty `regulamin.html` i `prywatnosc.html` (do dodania później) |

## 1. Pierwsze wdrożenie

### 1.1. Przed wejściem na serwer

1. Kup lub wynajmij VM z Ubuntu LTS (22.04 albo 24.04), z kluczem SSH, który masz na swoim komputerze. Dla 1 GB pamięci skrypt dodaje 2 GB swapu, ale budowanie obrazu .NET na tak małej maszynie jest wolne; 2 GB działa wygodnie.
2. Ustaw w DNS rekord `A` (i `AAAA`, jeśli VM ma IPv6) dla wybranej nazwy, na przykład `api.twojadomena.pl`, na adres VM. Caddy zdobędzie certyfikat dopiero wtedy, gdy nazwa wskazuje na serwer, więc sprawdź przez `dig +short api.twojadomena.pl`.
3. Załóż bucket i token w R2 według sekcji 4. Będziesz potrzebować czterech wartości: adresu (`Storage__Endpoint`), nazwy bucketu, Access Key ID i Secret Access Key.

### 1.2. Konfiguracja serwera

Z własnego komputera skopiuj skrypt i uruchom go jako root:

```bash
scp deploy/server-setup.sh root@ADRES_VM:
ssh root@ADRES_VM
chmod +x server-setup.sh && ./server-setup.sh
```

Skrypt jest idempotentny, można go uruchomić ponownie. Tworzy użytkownika `deploy` (bez sudo), instaluje Dockera z oficjalnego repozytorium, włącza zaporę (tylko 22, 80, 443), automatyczne aktualizacje bezpieczeństwa z restartem o 04:30, swap, katalogi `/opt/fitit` i `/etc/fitit` oraz wpis cron z kopią o 03:15. Klucz SSH dla `deploy` kopiuje z `/root/.ssh/authorized_keys`; inny klucz podaj przez `DEPLOY_SSH_KEY="ssh-ed25519 AAAA..."`.

W **nowym terminalu** sprawdź, że logowanie działa: `ssh deploy@ADRES_VM`. Dopiero wtedy możesz zamknąć sesję roota. Gdy wszystko działa, uruchom skrypt jeszcze raz z `HARDEN_SSH=yes ./server-setup.sh`, co wyłącza logowanie hasłem przez SSH, a root może wchodzić już tylko kluczem (potrzebne do aktualizacji pakietów).

### 1.3. Kod na serwerze

Jako `deploy`:

```bash
ssh-keygen -t ed25519 -C "fitit-deploy" -N "" -f ~/.ssh/github_deploy
cat ~/.ssh/github_deploy.pub
```

Wklej klucz publiczny w GitHubie (repozytorium, Settings, Deploy keys, bez zaznaczania zapisu), potem:

```bash
GIT_SSH_COMMAND="ssh -i ~/.ssh/github_deploy -o IdentitiesOnly=yes" git clone git@github.com:MikolajSkaziak/FitIT.git /opt/fitit
cd /opt/fitit && git config core.sshCommand "ssh -i ~/.ssh/github_deploy -o IdentitiesOnly=yes"
```

### 1.4. Plik z sekretami

Sekrety leżą w `/etc/fitit/fitit.env`, poza repozytorium (`.gitignore` ignoruje też każdy `.env.*` poza przykładem). Plik ma właściciela `deploy` i prawa `600`: czyta go tylko ten użytkownik (i root). `server-setup.sh` kopiuje tam szablon, jeśli uruchomiono go z kopii repozytorium; w przeciwnym razie skopiuj go sam:

```bash
cp /opt/fitit/deploy/.env.example /etc/fitit/fitit.env && chmod 600 /etc/fitit/fitit.env
nano /etc/fitit/fitit.env
```

Wygeneruj sekrety i wpisz je do pliku:

```bash
openssl rand -hex 24        # POSTGRES_PASSWORD (tylko litery i cyfry, bo trafia do connection stringa)
openssl rand -base64 48     # JWT_SIGNING_KEY (co najmniej 32 bajty)
```

Uzupełnij `DOMAIN`, `ACME_EMAIL`, `STORAGE_*`. Sprawdź, że nie został żaden placeholder:

```bash
grep -n CHANGE_ME /etc/fitit/fitit.env      # ma nic nie wypisać
```

Każda zmienna jest opisana w `.env.example`. Zmiana pliku działa po `docker compose up -d`.

### 1.5. Uruchomienie

W sesji logowania (`ssh deploy@ADRES_VM`) komendy `docker compose` znają już plik Compose i plik ze środowiskiem (zmienne `COMPOSE_FILE` i `COMPOSE_ENV_FILES` z `/etc/profile.d/fitit.sh`):

```bash
cd /opt/fitit
docker compose up -d --build       # pierwszy raz kilka minut: budowanie obrazu API
docker compose ps                  # db i api mają być "healthy", caddy "running"
docker compose logs -f api         # migracje bazy przy starcie, potem "Now listening"
curl -fsS https://api.twojadomena.pl/health
```

`/health` ma odpowiedzieć kodem 200 i `ok` przez HTTPS pod własną domeną (kryterium zadania 3.18). Certyfikat pojawia się w kilkanaście sekund po starcie; jeśli nie, `docker compose logs caddy` pokaże powód (zwykle DNS jeszcze nie wskazuje na serwer albo zapora blokuje 80/443).

Sprawdź też, że to, co ma być ukryte, jest ukryte: `curl -i https://api.twojadomena.pl/hangfire` i `/openapi/v1.json` mają dać 404.

### 1.6. Pierwsza kopia i próbne odtworzenie

```bash
/opt/fitit/deploy/backup.sh
/opt/fitit/deploy/restore.sh
```

Pierwsza komenda robi zrzut, druga odtwarza go do tymczasowej bazy `fitit_restore_test` w tym samym kontenerze, wypisuje tabele z liczbą wierszy i ją usuwa. Szczegóły w sekcji 3.

## 2. Aktualizacja

```bash
cd /opt/fitit
./deploy/backup.sh                                  # kopia przed zmianą
git pull --ff-only
docker tag fitit-api:current fitit-api:previous     # zapas do cofnięcia
docker compose up -d --build                        # przebuduje API i uruchomi ponownie tylko to, co się zmieniło
docker compose ps
curl -fsS https://api.twojadomena.pl/health
docker image prune -f                               # sprząta stare warstwy, żeby nie zapełnić dysku
```

Migracje bazy uruchamiają się przy starcie API (`Database__MigrateOnStartup`), więc kolejność jest zawsze ta sama.

Cofnięcie. Gdy wydanie nie zmieniało schematu bazy: `git checkout <poprzedni commit>`, potem `docker tag fitit-api:previous fitit-api:current && docker compose up -d --no-build api`. Gdy zmieniało schemat, stare API może nie pasować do nowej bazy; wtedy przywróć kopię z kroku pierwszego (sekcja 3, odtwarzanie do prawdziwej bazy opisane tam wprost).

Pakiety systemowe aktualizują się same (poprawki bezpieczeństwa). Pakiety Dockera pochodzą z jego własnego repozytorium, więc raz w miesiącu wykonaj jako root (`ssh root@ADRES_VM`) `apt update && apt upgrade`. Obraz `caddy:2-alpine` i `postgres:18-alpine` odświeżysz przez `docker compose pull db caddy && docker compose up -d`.

## 3. Kopie zapasowe i odtwarzanie

`backup.sh` robi `pg_dump` w formacie skompresowanym (`.dump`) do `/var/backups/fitit/fitit-RRRRMMDD-GGMMSSZ.dump`, sprawdza plik przez `pg_restore --list`, kasuje lokalne kopie starsze niż `BACKUP_KEEP_DAYS` (domyślnie 14) i kończy się kodem różnym od zera przy każdym błędzie. Cron uruchamia go o 03:15, a wynik trafia do `/var/backups/fitit/backup.log`.

Kopia obejmuje bazę (konta, ubrania, zestawy, kolejka zadań). Zdjęcia są w R2 i nie wchodzą do zrzutu.

Dwa dodatki, oba opcjonalne i ustawiane w pliku z sekretami:

- Kopia poza VM. Utwórz **drugi** bucket w R2 (na przykład `fitit-backups`) z osobnym tokenem tylko do niego i wpisz `BACKUP_R2_*`. Skrypt użyje `rclone` (instaluje go `server-setup.sh`). Osobny bucket i token sprawiają, że wyciek tokena aplikacji nie pozwala skasować kopii. W buckecie dodaj regułę cyklu życia (Settings, Object lifecycle rules), która usuwa obiekty po 30 dniach.
- Alarm, gdy kopia przestanie się robić. Wpisz w `BACKUP_PING_URL` adres z darmowej usługi typu healthchecks.io. Skrypt woła go po sukcesie i z dopiskiem `/fail` po błędzie; brak sygnału o 03:15 oznacza kłopot.

### Próbne odtworzenie na serwerze

```bash
/opt/fitit/deploy/restore.sh                 # ostatnia kopia
/opt/fitit/deploy/restore.sh PLIK.dump       # konkretna kopia
/opt/fitit/deploy/restore.sh --keep          # zostaw bazę fitit_restore_test do oglądania
```

Skrypt nigdy nie dotyka prawdziwej bazy. Wykonuj go po pierwszym wdrożeniu i potem co miesiąc: kopia, której nie próbowano odtworzyć, nie jest kopią.

### Próbne odtworzenie lokalnie (kryterium zadania 3.18)

Na swoim komputerze, przy działającym lokalnym `docker compose up -d db` z głównego katalogu repozytorium:

```bash
scp deploy@ADRES_VM:/var/backups/fitit/fitit-RRRRMMDD-GGMMSSZ.dump .
docker compose exec -T db psql -U fitit -d postgres -c "CREATE DATABASE fitit_restore_test"
docker compose exec -T db pg_restore -U fitit --no-owner --exit-on-error -d fitit_restore_test < fitit-RRRRMMDD-GGMMSSZ.dump
docker compose exec db psql -U fitit -d fitit_restore_test -c '\dt'
docker compose exec -T db psql -U fitit -d postgres -c "DROP DATABASE fitit_restore_test"
```

### Odtworzenie do prawdziwej bazy po awarii

1. `docker compose stop api` (baza zostaje włączona).
2. `docker compose exec -T db psql -U fitit -d postgres -c "DROP DATABASE fitit WITH (FORCE)" -c "CREATE DATABASE fitit"`
3. `docker compose exec -T db pg_restore -U fitit --no-owner --exit-on-error -d fitit < /var/backups/fitit/PLIK.dump`
4. `docker compose up -d api`

Na zupełnie nowej VM: wykonaj sekcję 1 do kroku uruchomienia, zatrzymaj API, odtwórz bazę jak wyżej, uruchom API. Ten sam `JWT_SIGNING_KEY` pozwala zachować sesje; z innym wszyscy zalogują się ponownie.

## 4. Cloudflare R2

Aplikacja używa R2 przez protokół S3 (`S3ImageStorage`): odczytuje metadane, pobiera, zapisuje, usuwa i listuje obiekty, a telefonowi wystawia krótkotrwałe podpisane adresy do wysłania (`PUT`) i odczytu (`GET`). Bucket nie może być publiczny.

1. **Bucket.** R2, Create bucket, nazwa `fitit-files` (zgodna z `STORAGE_BUCKET`). Specyfikacja (sekcja 12) zakłada jurysdykcję UE: wybierz ją przy tworzeniu. Wtedy adres S3 ma postać `https://<ID_KONTA>.eu.r2.cloudflarestorage.com`, a bez jurysdykcji `https://<ID_KONTA>.r2.cloudflarestorage.com`. To wartość `STORAGE_ENDPOINT`. Nie włączaj publicznego dostępu ani `r2.dev`. Regionem jest `auto`; kod i `compose.yml` już go tak ustawiają.
2. **Token.** R2, Manage API tokens, Create API token. Uprawnienia: Object Read & Write. Zakres: Apply to specific buckets only, wybierz `fitit-files`. Dostaniesz Access Key ID i Secret Access Key (drugi widać tylko raz); to `STORAGE_ACCESS_KEY` i `STORAGE_SECRET_KEY`. Token zakresowy nie pozwala ani zakładać, ani kasować buckets, dlatego API w produkcji ma `Storage__CreateBucket=false`. Nie używaj globalnego klucza API Cloudflare.
3. **CORS.** Aplikacja wysyła zdjęcie przez `XMLHttpRequest` w React Native (`mobile/src/features/wardrobe/putFile.ts`): `PUT` na podpisany adres, z jednym nagłówkiem, `Content-Type: image/jpeg` (API podpisuje go razem z adresem, więc musi być dokładnie taki). Natywna aplikacja nie podlega CORS, więc na telefonie reguła nie jest potrzebna. Przydaje się, gdy wysyłka idzie z przeglądarki (Expo Web, narzędzia deweloperskie). Reguła w R2 (Settings, CORS Policy, Add CORS policy, edycja JSON), z własnymi adresami zamiast przykładowego:

   ```json
   [
     {
       "AllowedOrigins": ["https://twoja-aplikacja-webowa.example"],
       "AllowedMethods": ["PUT", "GET", "HEAD"],
       "AllowedHeaders": ["content-type"],
       "ExposeHeaders": ["ETag"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```

   Nie dawaj `*` w `AllowedOrigins`, jeśli nie musisz.
4. **Kopie bazy** (opcjonalnie): drugi bucket `fitit-backups` i osobny token, jak w sekcji 3.

Test: dodaj ubranie w aplikacji podłączonej do VM. W logu API nie powinno być błędów, a w buckecie pojawi się obiekt z prefiksem użytkownika.

## 5. Panel zadań Hangfire

Panel jest domyślnie wyłączony: API uruchamia go tylko, gdy `HANGFIRE_DASHBOARD_USER` i `HANGFIRE_DASHBOARD_PASSWORD` są niepuste, i chroni hasłem (Basic auth). Mimo to Caddy zwraca z internetu 404 dla `/hangfire`. Gdy chcesz zajrzeć:

1. Wpisz użytkownika i hasło do `/etc/fitit/fitit.env` i wykonaj `docker compose up -d`.
2. Na serwerze: `docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}} {{end}}' fitit-prod-api-1` (pierwszy adres z wyniku).
3. Na swoim komputerze: `ssh -L 5080:ADRES_Z_KROKU_2:5080 deploy@ADRES_VM`, potem w przeglądarce `http://localhost:5080/hangfire`.
4. Po pracy opróżnij oba pola w pliku i wykonaj `docker compose up -d`.

## 6. Logi i diagnostyka

```bash
docker compose ps
docker compose logs --tail 100 api        # też: db, caddy
docker stats --no-stream                  # zużycie pamięci względem limitów z compose.yml
df -h / ; docker system df                # miejsce na dysku
```

Logi kontenerów są rotowane (3 pliki po 10 MB na usługę). Dziennik Caddy zawiera adres żądania razem z parametrami zapytania (na przykład szukany tekst miasta); nagłówki `Authorization` i ciasteczka Caddy zastępuje napisem REDACTED.

## 7. Lista kontrolna przed prawdziwymi użytkownikami

- [ ] `PROVIDER_BACKGROUND_REMOVER` i `PROVIDER_GARMENT_TAGGER` wskazują prawdziwych dostawców, a `ALLOW_FAKES_IN_PRODUCTION=false`. Teraz istnieją tylko atrapy, więc w wersji dla testerów zdjęcie samo jest wycinkiem, a tagi pochodzą ze stałej listy.
- [ ] Dokumenty `legal/regulamin.html` i `legal/prywatnosc.html` są dodane, dostępne pod `/regulamin` i `/prywatnosc` i podlinkowane w aplikacji. Polityka opisuje odbiorców danych i transfer poza EOG (specyfikacja, sekcja 12).
- [ ] Umowy powierzenia z dostawcami (Cloudflare, fal.ai, Anthropic) i sprawdzone warunki retencji.
- [ ] Kopia działa co noc, jest kopia poza VM, alarm `BACKUP_PING_URL` ustawiony, a próbne odtworzenie wykonane w ostatnim miesiącu.
- [ ] Zewnętrzny monitoring `https://domena/health` (na przykład UptimeRobot) z powiadomieniem na telefon.
- [ ] Z innej maszyny `nmap -Pn ADRES_VM` pokazuje otwarte tylko 22, 80, 443. SSH działa wyłącznie na klucz (`HARDEN_SSH=yes`).
- [ ] W `/etc/fitit/fitit.env` nie ma `CHANGE_ME`, plik ma prawa `600`, a sekretów nie ma w repozytorium ani w historii gita.
- [ ] Limit dzienny `LIMIT_AI_BUDGET_USD_PER_DAY` ustawiony świadomie, a u dostawców AI włączone własne limity wydatków i alerty.
- [ ] Usunięcie konta w aplikacji faktycznie czyści pliki w R2 (sprawdź ręcznie na koncie testowym).
- [ ] Limit prób logowania liczy się na adres odwiedzającego, nie Caddy'ego: z jednego telefonu wykonaj ponad `RATE_LIMIT_AUTH_PER_MINUTE` prób logowania i sprawdź, że druga osoba z innej sieci nadal może się zalogować.
- [ ] Dysk ma zapas (`df -h`), pamięć mieści się w limitach (`docker stats`), restart całej VM kończy się działającą aplikacją (`reboot` jako root, potem `/health`).
- [ ] Środowisko komercyjne jest osobne od środowiska testerów (plan, Etap 6): osobna VM, osobne buckety, osobne sekrety.
