# Anmeldung und Benutzerverwaltung

Die App hat **zwei Sichten**: die **User-Sicht** (die eigentliche App, z. B.
Notizen) für alle Angemeldeten und die **Admin-Sicht** (Admin-Konsole:
Benutzer, Einstellungen, …) nur für den Admin. Welche Sicht ein Feature hat,
steht in seinem Registry-Eintrag (`view: 'user' | 'admin'`,
[features.js](../public/js/app/features.js)). Der Admin wechselt die Sicht über
den Umschalter in der Kopfzeile, alle anderen sehen ihn nicht. Der Server
schützt `/api/admin/*` unabhängig davon (`requireAdmin`, [lib/auth.js](../lib/auth.js)):
die Sicht entscheidet nur, was angezeigt wird, nicht, was erlaubt ist.

Muster aus schreibwerkstatt (scrypt-Hashes, ENV-Admin als Notfallzugang, eine
Passwort-Sequenz für alle Wege), bewusst schlanker: kein Mailversand, keine
Einladungslinks.

## Wege hinein

| Weg | Wann | Konfiguration |
|---|---|---|
| **Lokal** (E-Mail + Passwort, **Default**) | `auth.method = 'local'` | Konten legt der Admin in der Admin-Konsole an |
| **OIDC** (anbieterunabhängig) | `auth.method = 'oidc'` | Admin-Konsole → Einstellungen, Secret in `.env` (`OIDC_CLIENT_SECRET`) |
| **.env-Admin** | immer, wenn `ADMIN_EMAIL` **und** `ADMIN_PASSWORD` gesetzt sind | nur `.env` |
| **Dev-Bypass** | `LOCAL_DEV_MODE=1` (in Produktion verboten) | `DEV_USER_EMAIL` |

`auth.method` ist ein App-Setting (Admin-Konsole), keine ENV-Variable. Genau
**ein** Verfahren gilt für die normalen Benutzer. Zwei parallele Wege auf
dieselbe Adresse wären zwei Wahrheiten über ein Konto.

## Der Admin: nur über die .env

- **Admin ist genau `ADMIN_EMAIL`** (unter `LOCAL_DEV_MODE` zusätzlich der
  Dev-User). Die Rolle wird bei jedem Request aus der ENV abgeleitet
  ([lib/auth-env.js](../lib/auth-env.js) → `isAdminEmail`), nicht aus der
  Session und nicht aus der DB. Beim Boot gleicht `syncEnvAdmins()` die Spalte
  `app_users.global_role` an und stuft jede andere Admin-Zeile zurück: **die
  Rolle lässt sich nirgends sonst vergeben**, auch nicht in der Konsole.
- **Das Passwort steht nur in `ADMIN_PASSWORD`**, nie in der DB. Der Vergleich
  ist konstantzeitig (`secretsMatch`, beide Seiten SHA-256), und es wird
  zusätzlich ein Dummy-scrypt gerechnet, damit der Admin-Login nicht messbar
  schneller antwortet als ein lokaler.
- **Ein Weg pro Konto:** die Admin-Adresse meldet sich nur mit dem
  .env-Passwort an. Ein OIDC-Callback für diese Adresse wird abgelehnt, ein
  lokales Passwort dafür lässt die Facade nicht zu.
- **In der Konsole schreibgeschützt:** gelistet mit Badge „Admin (.env)“, ohne
  Aktionen. Die Facade lehnt Status, Passwort und Löschen mit `managed by env`
  (409) ab, nicht erst die UI.
- **Notfallzugang:** der .env-Admin funktioniert unter jedem `auth.method`.
  Ein falsch konfigurierter OIDC-Anbieter sperrt die Konsole also nie aus.
- **Produktion** verweigert den Boot bei `ADMIN_PASSWORD` unter 16 Zeichen oder
  `ADMIN_PASSWORD` ohne `ADMIN_EMAIL` ([server.js](../server.js)). Ein neues
  Passwort: `openssl rand -base64 24`, in `/etc/<app>/app.env` eintragen,
  Dienst neu starten.

## Lokale Konten

Der Admin legt ein Konto in der Admin-Sicht → **Benutzer** an: E-Mail, Name,
**Initialpasswort** (der Button „Generieren“ erzeugt 16 Zeichen über
`crypto.getRandomValues`). Er gibt es dem Benutzer auf einem eigenen Kanal
weiter.

1. Der Benutzer meldet sich mit dem Initialpasswort an. `POST /auth/login`
   antwortet `{ ok: true, mustChange: true }` und **öffnet keine Sitzung**.
2. Die Login-Seite wechselt ins Formular „Eigenes Passwort setzen“.
   `POST /auth/password { email, password, newPassword }` **authentifiziert
   erneut** mit dem Initialpasswort, setzt das neue (`must_change = 0`) und
   öffnet erst dann die Sitzung.

**Warum keine halb angemeldete Sitzung:** die müsste ein globaler Guard wieder
einfangen, und jede Route, die das vergisst, wäre ein offenes Konto. Die
erneute Prüfung trägt den Wechsel sichtbar im Request.

Weitere Admin-Aktionen pro Konto: **Initialpasswort neu setzen** (erzwingt
wieder einen Wechsel), **Sperren/Entsperren**, **Löschen**. Sperren und Löschen
beenden eine **offene** Sitzung sofort: der Guard prüft das Konto bei jedem
Request (`requireAuth`), nicht erst beim Ablauf des Cookies.

### Invarianten ([lib/user-store.js](../lib/user-store.js))

- E-Mails werden getrimmt und kleingeschrieben gespeichert: ein Konto pro Adresse.
- **Hashes:** scrypt aus dem Node-Core (N=2^15, r=8, p=1), Format
  `scrypt$N$r$p$salt$hash`. Die Parameter stehen im String, damit ein
  angehobener Kostenfaktor alte Hashes weiter verifiziert; `needsRehash`
  rechnet sie beim nächsten erfolgreichen Login neu ([lib/password.js](../lib/password.js)).
- **Policy:** mindestens 12 Zeichen, höchstens 1024 Byte, keine
  Zeichenklassen-Pflicht. Erzwungene Sonderzeichen treiben Passwörter Richtung
  `Passwort1!`, die Länge ist die Schraube, die wirkt.
- **Kein Konto-Orakel:** eine unbekannte Adresse rechnet gegen einen festen
  Dummy-Hash und kostet dieselbe Zeit. Ein gesperrtes Konto meldet `403` erst
  **nach** korrektem Passwort, vorher heisst es für alle `401 invalid credentials`.
- `user_credentials` ist eine eigene Tabelle (FK auf `app_users.email`,
  `ON DELETE CASCADE`). OIDC-Benutzer und der Admin haben schlicht keine Zeile,
  es gibt keine NULL-Spalte, die etwas bedeutet.

### Härtung

Alle Passwortwege (`/auth/login`, `/auth/password`) laufen durch dieselbe
Sequenz: **Rate-Limit → Prüfung → Sitzung**. Der Bucket ist **einer pro IP**
([lib/login-ratelimit.js](../lib/login-ratelimit.js)): 5 Fehlversuche in 15 min
sperren die IP für 15 min (`429` + `Retry-After`), über beide Wege hinweg.
Schlüssel ist `req.ip` über den einen vertrauten Proxy-Hop, nie ein vom Client
gesetztes `X-Forwarded-For`. Vor jeder Sitzung läuft `session.regenerate()`
gegen Session-Fixation.

## Endpunkte

| Methode | Pfad | Wer | Zweck |
|---|---|---|---|
| GET | `/login` | öffentlich | Login-Seite ([login.html](../public/login.html) + [login.js](../public/js/login.js)) |
| GET | `/auth/methods` | öffentlich | `{ method, adminLogin, devMode }`, was die Login-Seite anbietet |
| POST | `/auth/login` | öffentlich | Passwort-Login (.env-Admin oder lokal) |
| POST | `/auth/password` | öffentlich | eigenes Passwort ersetzen (mit dem aktuellen) |
| GET | `/auth/login`, `/auth/callback` | öffentlich | OIDC |
| GET | `/auth/logout` | – | Sitzung beenden |
| GET | `/api/me` | Sitzung | `{ email, display_name, role }` |
| GET/POST | `/api/admin/users` | Admin | Liste / anlegen |
| PATCH | `/api/admin/users/:email` | Admin | `{ display_name?, status? }` |
| PUT | `/api/admin/users/:email/password` | Admin | neues Initialpasswort |
| DELETE | `/api/admin/users/:email` | Admin | löschen |

Fehlertexte sind API-Vertrag (das Frontend übersetzt sie): `invalid credentials`
401 · `account disabled` 403 · `rate limited` 429 · `admin required` 403 ·
`valid email required` / `password too short` / `password too long` /
`password unchanged` 400 · `user exists` / `managed by env` 409 · `not found` 404.

## Lokal ausprobieren

`npm run dev` meldet dich als Dev-User an, der unter `LOCAL_DEV_MODE` Admin
ist. Der Dev-Seed legt `anna@local` (aktiv) und `ben@local` (gesperrt) mit dem
Initialpasswort `dev-passwort-123` an ([lib/dev-seed.js](../lib/dev-seed.js)).
Den Wechsel-Flow siehst du nach `/auth/logout` auf `/login` mit `anna@local`.

## Tests

[tests/unit/password.test.js](../tests/unit/password.test.js),
[user-store.test.js](../tests/unit/user-store.test.js),
[login-ratelimit.test.js](../tests/unit/login-ratelimit.test.js) ·
[tests/integration/auth-local.test.js](../tests/integration/auth-local.test.js) (ganzer Fluss über HTTP) ·
[tests/e2e/users-card.spec.js](../tests/e2e/users-card.spec.js),
[login-page.spec.js](../tests/e2e/login-page.spec.js) (Mocks in
[tests/mocks/auth-users.js](../tests/mocks/auth-users.js)) · Smoke durchläuft beide Sichten.
