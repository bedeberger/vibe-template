# Deployment — LXC hinter Nginx Proxy Manager

Produktion läuft in **einem LXC-Container** (Ubuntu 24.04 auf Proxmox) als
gehärteter systemd-Dienst. **Nginx Proxy Manager (NPM)** davor terminiert TLS und
leitet an den Container weiter. Deploys laufen automatisch: ein grüner CI-Lauf auf
`main` löst [deploy.yml](../.github/workflows/deploy.yml) aus, das auf einem
**self-hosted GitHub-Runner im selben LXC** läuft — kein SSH, keine
Deploy-Secrets in GitHub.

```
 push main ──► CI (GitHub-hosted, oder die LXC-Runner mit SELF_HOSTED_CI=true:
                   audit, gitleaks, unit, integration, e2e, e2e-app)
                 │ grün
                 ▼
            deploy.yml auf dem LXC-Runner
              DB-Backup → Migrations-Probelauf auf Kopie → rsync → Restart
              → GET /healthz → (Rollback bei Fehler)
                 │
   Internet ──► NPM (TLS, Let's Encrypt) ──► http://<LXC-IP>:3000
```

## 1. LXC anlegen (Proxmox)

UI: *Create CT* — oder auf dem Proxmox-Host:

```bash
pveam update && pveam download local ubuntu-24.04-standard_24.04-2_amd64.tar.zst
pct create 120 local:vztmpl/ubuntu-24.04-standard_24.04-2_amd64.tar.zst \
  --hostname my-app --unprivileged 1 --features nesting=1 \
  --cores 2 --memory 2048 --swap 512 --rootfs local-lvm:8 \
  --net0 name=eth0,bridge=vmbr0,ip=192.168.1.120/24,gw=192.168.1.1 \
  --onboot 1 --start 1
```

- **Unprivileged** genügt; `nesting=1` hält das systemd-Sandboxing
  (`ProtectSystem=`, `PrivateTmp=`) im Container funktionsfähig.
- **Statische IP** (oder DHCP-Reservierung): NPM leitet dorthin weiter.
- Grösse: die App braucht ~150–250 MB RAM. 2 GB lassen Platz für `npm ci`
  (nativer Build von better-sqlite3) während Deploys. Läuft auch CI hier
  (`SELF_HOSTED_CI=true`), 4 GB / 4 Kerne geben — schwer ist Playwrights
  Chromium, nicht die App.
- Das Rootfs auf einen Storage legen, der im Proxmox-Backup-Job ist — die
  SQLite-DB liegt in `/var/lib/<app>`.

## 2. Einrichten (einmalig, als root im LXC)

[scripts/prepare-lxc.sh](../scripts/prepare-lxc.sh) ist **eigenständig** — kein
Checkout nötig. Inhalt in den Container einfügen und ausführen:

```bash
pct enter 120                    # oder: ssh root@192.168.1.120
nano prepare-lxc.sh              # einfügen, speichern
chmod +x prepare-lxc.sh
# RUNNER_TOKEN = Registrierungs-Token: GitHub → Repo → Settings → Actions →
# Runners → New self-hosted runner (gültig ~1 h). Ohne ihn werden die Runner nur
# heruntergeladen; das Skript später mit dem Token erneut ausführen.
APP_NAME=my-app PORT=3000 REPO_SLUG=you/my-app RUNNER_TOKEN=<token> ./prepare-lxc.sh
```

Es ist idempotent und richtet ein:

| Was | Wo |
| --- | --- |
| Node.js 24 LTS, Build-Tools, sqlite3, jq, rsync, acl | System |
| Dienstbenutzer `<app>`, Deploy-Benutzer `github-runner` | `/etc/passwd` |
| App-Code (bei jedem Deploy ersetzt) | `/opt/<app>` (Runner darf per ACL schreiben) |
| SQLite-DB + WAL, Sessions, `app.log*`, `backups/` | `/var/lib/<app>` (0750) |
| Secrets | `/etc/<app>/app.env` (`root:<app>`, 0640) — `SESSION_SECRET` wird generiert |
| Gehärtete Unit `<app>.service` | `/etc/systemd/system/` |
| journald-Aufbewahrung (persistent, 500 MB / 1 Monat) | `/etc/systemd/journald.conf.d/` |
| sudoers: Runner darf `systemctl restart/start/stop/status <app>` und `env`/`sqlite3` als `<app>` ausführen | `/etc/sudoers.d/<app>-runner` |
| Playwright-Systembibliotheken für Chromium (für self-hosted CI) | System |
| `RUNNER_COUNT` (Standard 2) GitHub-Actions-Runner, Label `<app>`, registriert + als Dienste laufend, wenn `RUNNER_TOKEN` gesetzt ist | `/opt/actions-runner-<n>` |
| Runner-Watchdog (Timer, alle 5 min) | `/usr/local/sbin/<app>-runner-watchdog` |

Die Unit fixiert `NODE_ENV=production`, `PORT`, `DB_PATH` und `LOG_PATH`. Unter
`NODE_ENV=production` **verweigert** [server.js](../server.js) den Boot mit
`LOCAL_DEV_MODE=1` oder einem `SESSION_SECRET` unter 32 Zeichen, setzt das
Session-Cookie `Secure` und vertraut genau einem Proxy-Hop (`trust proxy = 1`).

## 3. Runner

Mit `RUNNER_TOKEN` registriert das Skript `RUNNER_COUNT` Runner namens
`<hostname>-<n>` mit den Labels `self-hosted,linux,<APP_NAME>` und startet sie
als Dienste. Prüfen: GitHub → *Settings → Actions → Runners* zeigt sie *Idle*;
auf der Maschine `systemctl list-units 'actions.runner.*'`.

- **Warum zwei:** ein Runner nimmt einen Job aufs Mal. Mit einem wartet ein
  PR-Check hinter einem laufenden Deploy. Mehr sind billig (`RUNNER_COUNT=3`,
  Skript erneut ausführen — bestehende Runner bleiben unberührt).
- **Das Label muss `APP_NAME` entsprechen:** deploy.yml (und self-hosted CI)
  zielen auf `[self-hosted, linux, <APP_NAME>]`, damit Jobs nie auf der Maschine
  einer anderen App landen.
- **Watchdog:** ein Runner verliert manchmal direkt nach einem Job die
  Broker-Verbindung und fragt nie mehr nach Arbeit, während GitHub ihn noch als
  online zeigt (Jobs hängen in "Waiting for a runner"). Der Timer prüft jeden
  Runner und startet einen nur auf Beleg neu — Broker-Fehler als letztes
  `_diag`-Ereignis, ein seit 15 min stilles `_diag`-Log oder eine Session älter
  als 6 h — nie während er einen Job ausführt, nie innerhalb von 2 min nach einem
  Start. `journalctl -u <app>-runner-watchdog.service`.
- Stattdessen von Hand registrieren (z. B. Token mitten im Lauf abgelaufen):

  ```bash
  cd /opt/actions-runner-1
  sudo -u github-runner ./config.sh --unattended --replace \
    --url https://github.com/you/my-app --token <TOKEN> \
    --name $(hostname)-1 --labels self-hosted,linux,my-app
  sudo ./svc.sh install github-runner && sudo ./svc.sh start
  ```

## 4. Konfigurieren und aktivieren

1. `nano /etc/my-app/app.env` — `ADMIN_EMAIL` und die `OIDC_*`-Werte setzen.
   `OIDC_REDIRECT_URI` ist die **öffentliche** URL: `https://my-app.example.com/auth/callback`
   (dieselbe URI beim Identity-Provider registrieren).
   Nie `LOCAL_DEV_MODE`, `PORT` oder `DB_PATH` hier eintragen — die gehören der Unit.
2. GitHub → *Settings → Secrets and variables → Actions → Variables*:

   | Variable | Wert |
   | --- | --- |
   | `DEPLOY_ENABLED` | `true` (der Deploy-Job wird übersprungen, bis dies gesetzt ist) |
   | `SELF_HOSTED_CI` | `true`, um CI auf den LXC-Runnern laufen zu lassen (Fork-PRs bleiben immer GitHub-hosted) |
   | `APP_NAME` | `my-app` (nur wenn nicht `vibe-template`) |
   | `PORT` | nur wenn nicht `3000` |

3. Erster Deploy: Push auf `main` (oder *Actions → Deploy (prod) → Run workflow*).
   Auf dem LXC prüfen: `curl -s http://127.0.0.1:3000/healthz` → `{"status":"ok"}`.

## 5. Nginx Proxy Manager

*Hosts → Proxy Hosts → Add Proxy Host*:

| Tab | Einstellung |
| --- | --- |
| Details | **Domain Names:** `my-app.example.com` · **Scheme:** `http` · **Forward Hostname/IP:** `192.168.1.120` · **Forward Port:** `3000` · **Block Common Exploits:** an · **Websockets Support:** an (harmlos, nötig sobald SSE/WebSockets dazukommen) |
| SSL | **Request a new SSL Certificate** (Let's Encrypt) · **Force SSL:** an · **HTTP/2 Support:** an · **HSTS Enabled:** an (erst wenn die Domain definitiv ist) |
| Advanced | meist leer. Für Uploads über 1 MB `client_max_body_size 20m;` ergänzen |

NPM sendet bereits `X-Forwarded-For`, `X-Forwarded-Proto` und `X-Real-IP`, was
`trust proxy = 1` erwartet. Voraussetzungen: DNS-`A`/`AAAA`-Record zeigt auf den
NPM-Host, und die Ports 80/443 erreichen NPM (Let's-Encrypt-HTTP-Challenge —
oder eine DNS-Challenge für rein interne Hosts).

**Access List (optional):** für eine rein interne App eine NPM-*Access List*
anlegen (LAN-/VPN-Bereich erlauben) und an den Proxy-Host hängen.

**Nur NPM soll Port 3000 erreichen.** Die App spricht reines HTTP. Im LXC
einschränken (oder mit der Proxmox-Firewall auf dem CT):

```bash
apt-get install -y ufw
ufw allow OpenSSH
ufw allow from <NPM-IP> to any port 3000 proto tcp
ufw enable
```

Der Runner braucht nur **ausgehendes** HTTPS zu GitHub — keinen eingehenden Port.

## Was ein Deploy tut

[deploy.yml](../.github/workflows/deploy.yml), auf dem LXC-Runner, für genau den
Commit, den CI getestet hat:

1. `npm ci --omit=dev` (kompiliert better-sqlite3 für `/usr/bin/node` des LXC).
2. Liest den letzten erfolgreich deployten Commit aus `~/.<app>-deploy/prod.sha`
   (Rollback-Basis).
3. **DB-Backup** als Dienstbenutzer via `sqlite3 .backup` nach
   `/var/lib/<app>/backups/<timestamp>/` (die neuesten 10 bleiben). Ein
   fehlschlagendes Backup einer bestehenden DB bricht den Deploy ab.
4. **Migrations-Probelauf**: zählt ausstehende Migrationen
   ([scripts/pending-migrations.js](../scripts/pending-migrations.js)) und führt
   die neue Kette gegen eine **Kopie** der Live-DB aus. Wirft sie, stoppt der
   Deploy, und die laufende Instanz bleibt unberührt.
5. Leert `/opt/<app>` und rsynct den neuen Code.
6. `systemctl restart` — ausstehende Migrationen laufen beim Boot (`server.js`
   importiert `db/schema`).
7. **Healthcheck** `GET /healthz` (bis 30 s).
8. Hält den Commit als neue Rollback-Basis fest.

**Rollback** (Schritt 6 oder 7 fehlgeschlagen): stoppen, die DB **nur dann**
wiederherstellen, **wenn dieser Deploy ausstehende Migrationen hatte** (`-1` =
unbekannt gilt als ja — ohne Migration verlöre ein Restore nur die neuesten Daten
der Benutzer), den vorherigen Commit auschecken und neu synchronisieren, neu
starten, erneut Healthcheck. Der Job bleibt so oder so rot.

## Betrieb

```bash
systemctl status my-app
journalctl -u my-app -f                    # Live-Log (Winston → stdout → journald)
tail -f /var/lib/my-app/app.log            # Datei-Log, rotiert selbst (5 MB × 5)
curl -s http://127.0.0.1:3000/healthz

# Manuelles Backup
sudo -u my-app sqlite3 /var/lib/my-app/app.db ".backup /var/lib/my-app/backups/manual-$(date +%F).db"

# Restore
systemctl stop my-app
sudo -u my-app cp /var/lib/my-app/backups/<ts>/app.db /var/lib/my-app/app.db
sudo -u my-app rm -f /var/lib/my-app/app.db-wal /var/lib/my-app/app.db-shm
systemctl start my-app

# Nur-Lese-Blick in die Live-DB
sqlite3 'file:/var/lib/my-app/app.db?mode=ro' 'select count(*) from app_users;'
```

In die DB immer **als Dienstbenutzer** schreiben (`sudo -u my-app …`): ein
Schreibzugriff als root hinterlässt ein root-eigenes `app.db-wal`/`-shm`, das der
Dienst nicht mehr öffnen kann.

Zeitgesteuerte Jobs (Cron) laufen im App-Prozess mit, es braucht dafür keinen
System-Cron und keinen systemd-Timer. Jeder Lauf ist eine Zeile in `jobs`, zum
Beispiel `sqlite3 'file:/var/lib/my-app/app.db?mode=ro' "select id,type,status,finished_at from jobs where note_id is null order by id desc limit 10;"`.
Während eines Deploys verpasste Minuten werden nicht nachgeholt
([routes/jobs/CLAUDE.md](../routes/jobs/CLAUDE.md#zeitgesteuerte-jobs-cron)).

## Bekannte Grenzen

- Ein Prozess, keine horizontale Skalierung (SQLite-Datei-Lock) — gewollt.
- Kein TLS in der App — der Reverse-Proxy ist Pflicht.
- `ProtectSystem=strict`: nur `/var/lib/<app>` ist beschreibbar. Code, der
  anderswo schreibt, scheitert mit `EROFS` → den Pfad in prepare-lxc.sh zu
  `ReadWritePaths` hinzufügen und das Skript erneut ausführen.
- Eine Staging-Stufe ist nicht eingerichtet. Für eine zweite einen zweiten LXC
  mit eigenem `APP_NAME` (z. B. `my-app-staging`) und einen zweiten
  Deploy-Workflow für einen `develop`-Branch betreiben — Unit, Pfade und
  Runner-Label leiten sich alle von `APP_NAME` ab.
