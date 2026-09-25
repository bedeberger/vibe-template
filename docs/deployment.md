# Deployment — LXC behind Nginx Proxy Manager

Production runs in **one LXC container** (Ubuntu 24.04 on Proxmox) as a hardened
systemd service. **Nginx Proxy Manager (NPM)** in front terminates TLS and
proxies to the container. Deploys are automatic: a green CI run on `main`
triggers [deploy.yml](../.github/workflows/deploy.yml), which runs on a
**self-hosted GitHub runner inside the same LXC** — no SSH, no deploy secrets in
GitHub.

```
 push main ──► CI (GitHub-hosted, or the LXC runners with SELF_HOSTED_CI=true:
                   audit, gitleaks, unit, integration, e2e, e2e-app)
                 │ green
                 ▼
            deploy.yml on the LXC runner
              backup DB → migration dry run on a copy → rsync → restart
              → GET /healthz → (rollback on failure)
                 │
   Internet ──► NPM (TLS, Let's Encrypt) ──► http://<LXC-IP>:3000
```

## 1. Create the LXC (Proxmox)

UI: *Create CT* — or on the Proxmox host:

```bash
pveam update && pveam download local ubuntu-24.04-standard_24.04-2_amd64.tar.zst
pct create 120 local:vztmpl/ubuntu-24.04-standard_24.04-2_amd64.tar.zst \
  --hostname my-app --unprivileged 1 --features nesting=1 \
  --cores 2 --memory 2048 --swap 512 --rootfs local-lvm:8 \
  --net0 name=eth0,bridge=vmbr0,ip=192.168.1.120/24,gw=192.168.1.1 \
  --onboot 1 --start 1
```

- **Unprivileged** is fine; `nesting=1` keeps systemd's sandboxing
  (`ProtectSystem=`, `PrivateTmp=`) working inside the container.
- **Static IP** (or a DHCP reservation): NPM forwards to it.
- Size: the app needs ~150–250 MB RAM. 2 GB leaves room for `npm ci`
  (native build of better-sqlite3) during deploys. If CI runs here too
  (`SELF_HOSTED_CI=true`), give it 4 GB / 4 cores — Playwright's Chromium is
  the heavy part, not the app.
- Put the rootfs on storage that is in your Proxmox backup job — the SQLite DB
  lives in `/var/lib/<app>`.

## 2. Provision it (once, as root in the LXC)

[scripts/prepare-lxc.sh](../scripts/prepare-lxc.sh) is **self-contained** — no
checkout needed. Paste its content into the container and run it:

```bash
pct enter 120                    # or: ssh root@192.168.1.120
nano prepare-lxc.sh              # paste, save
chmod +x prepare-lxc.sh
# RUNNER_TOKEN = registration token: GitHub → repo → Settings → Actions →
# Runners → New self-hosted runner (valid ~1 h). Without it the runners are only
# downloaded; re-run the script with the token later.
APP_NAME=my-app PORT=3000 REPO_SLUG=you/my-app RUNNER_TOKEN=<token> ./prepare-lxc.sh
```

It is idempotent and sets up:

| What | Where |
| --- | --- |
| Node.js 24 LTS, build tools, sqlite3, jq, rsync, acl | system |
| Service user `<app>`, deploy user `github-runner` | `/etc/passwd` |
| App code (replaced on every deploy) | `/opt/<app>` (runner may write via ACL) |
| SQLite DB + WAL, sessions, `app.log*`, `backups/` | `/var/lib/<app>` (0750) |
| Secrets | `/etc/<app>/app.env` (`root:<app>`, 0640) — `SESSION_SECRET` is generated |
| Hardened unit `<app>.service` | `/etc/systemd/system/` |
| journald retention (persistent, 500 MB / 1 month) | `/etc/systemd/journald.conf.d/` |
| sudoers: runner may `systemctl restart/start/stop/status <app>` and run `env`/`sqlite3` as `<app>` | `/etc/sudoers.d/<app>-runner` |
| Playwright OS libraries for Chromium (for self-hosted CI) | system |
| `RUNNER_COUNT` (default 2) GitHub Actions runners, label `<app>`, registered + running as services when `RUNNER_TOKEN` is set | `/opt/actions-runner-<n>` |
| Runner watchdog (timer, every 5 min) | `/usr/local/sbin/<app>-runner-watchdog` |

The unit pins `NODE_ENV=production`, `PORT`, `DB_PATH` and `LOG_PATH`. Under
`NODE_ENV=production` [server.js](../server.js) **refuses to boot** with
`LOCAL_DEV_MODE=1` or a `SESSION_SECRET` shorter than 32 characters, sets the
session cookie `Secure` and trusts exactly one proxy hop (`trust proxy = 1`).

## 3. Runners

With `RUNNER_TOKEN` the script registers `RUNNER_COUNT` runners named
`<hostname>-<n>` with the labels `self-hosted,linux,<APP_NAME>` and starts them
as services. Check: GitHub → *Settings → Actions → Runners* shows them *Idle*;
on the box `systemctl list-units 'actions.runner.*'`.

- **Why two:** a runner takes one job at a time. With one, a PR check waits
  behind a running deploy. More are cheap (`RUNNER_COUNT=3`, re-run the script —
  existing runners are left alone).
- **The label must equal `APP_NAME`:** deploy.yml (and self-hosted CI) target
  `[self-hosted, linux, <APP_NAME>]`, so jobs never land on another app's box.
- **Watchdog:** a runner sometimes loses its broker connection right after a
  job and never asks for work again while GitHub still shows it online (jobs
  hang in "Waiting for a runner"). The timer checks every runner and restarts
  one only on evidence — broker failure as the last `_diag` event, a `_diag` log
  silent for 15 min, or a session older than 6 h — never while it runs a job,
  never within 2 min of a start. `journalctl -u <app>-runner-watchdog.service`.
- Registering by hand instead (e.g. a token expired mid-run):

  ```bash
  cd /opt/actions-runner-1
  sudo -u github-runner ./config.sh --unattended --replace \
    --url https://github.com/you/my-app --token <TOKEN> \
    --name $(hostname)-1 --labels self-hosted,linux,my-app
  sudo ./svc.sh install github-runner && sudo ./svc.sh start
  ```

## 4. Configure and enable

1. `nano /etc/my-app/app.env` — set `ADMIN_EMAIL` and the `OIDC_*` values.
   `OIDC_REDIRECT_URI` is the **public** URL: `https://my-app.example.com/auth/callback`
   (register the same URI at your identity provider).
   Never put `LOCAL_DEV_MODE`, `PORT` or `DB_PATH` here — the unit owns them.
2. GitHub → *Settings → Secrets and variables → Actions → Variables*:

   | Variable | Value |
   | --- | --- |
   | `DEPLOY_ENABLED` | `true` (the deploy job is skipped until this is set) |
   | `SELF_HOSTED_CI` | `true` to run CI on the LXC runners (fork PRs always stay GitHub-hosted) |
   | `APP_NAME` | `my-app` (only if not `vibe-template`) |
   | `PORT` | only if not `3000` |

3. First deploy: push to `main` (or *Actions → Deploy (prod) → Run workflow*).
   Check on the LXC: `curl -s http://127.0.0.1:3000/healthz` → `{"status":"ok"}`.

## 5. Nginx Proxy Manager

*Hosts → Proxy Hosts → Add Proxy Host*:

| Tab | Setting |
| --- | --- |
| Details | **Domain Names:** `my-app.example.com` · **Scheme:** `http` · **Forward Hostname/IP:** `192.168.1.120` · **Forward Port:** `3000` · **Block Common Exploits:** on · **Websockets Support:** on (harmless, needed once you add SSE/WebSockets) |
| SSL | **Request a new SSL Certificate** (Let's Encrypt) · **Force SSL:** on · **HTTP/2 Support:** on · **HSTS Enabled:** on (only once the domain is final) |
| Advanced | usually empty. For uploads larger than 1 MB add `client_max_body_size 20m;` |

NPM already sends `X-Forwarded-For`, `X-Forwarded-Proto` and `X-Real-IP`, which
is what `trust proxy = 1` expects. Prerequisites: DNS `A`/`AAAA` record points
to the NPM host, and ports 80/443 reach NPM (Let's Encrypt HTTP challenge — or
use a DNS challenge for internal-only hosts).

**Access list (optional):** for an internal-only app, create an NPM *Access
List* (allow your LAN/VPN range) and attach it to the proxy host.

**Only NPM should reach port 3000.** The app speaks plain HTTP. Restrict it in
the LXC (or with the Proxmox firewall on the CT):

```bash
apt-get install -y ufw
ufw allow OpenSSH
ufw allow from <NPM-IP> to any port 3000 proto tcp
ufw enable
```

The runner needs only **outbound** HTTPS to GitHub — no inbound port.

## What a deploy does

[deploy.yml](../.github/workflows/deploy.yml), on the LXC runner, for the exact
commit CI tested:

1. `npm ci --omit=dev` (compiles better-sqlite3 for the LXC's `/usr/bin/node`).
2. Reads the last successfully deployed commit from `~/.<app>-deploy/prod.sha`
   (rollback base).
3. **DB backup** as the service user via `sqlite3 .backup` into
   `/var/lib/<app>/backups/<timestamp>/` (newest 10 kept). A failing backup of an
   existing DB aborts the deploy.
4. **Migration dry run**: counts pending migrations
   ([scripts/pending-migrations.js](../scripts/pending-migrations.js)) and runs
   the new chain against a **copy** of the live DB. If it throws, the deploy
   stops and the running instance is untouched.
5. Empties `/opt/<app>` and rsyncs the new code.
6. `systemctl restart` — pending migrations run at boot (`server.js` imports
   `db/schema`).
7. **Health check** `GET /healthz` (up to 30 s).
8. Records the commit as the new rollback base.

**Rollback** (step 6 or 7 failed): stop, restore the DB **only if this deploy
had pending migrations** (`-1` = unknown counts as yes — without a migration a
restore would just lose the users' newest data), check out and resync the
previous commit, restart, health-check again. The job stays red either way.

## Operations

```bash
systemctl status my-app
journalctl -u my-app -f                    # live log (Winston → stdout → journald)
tail -f /var/lib/my-app/app.log            # file log, rotates itself (5 MB × 5)
curl -s http://127.0.0.1:3000/healthz

# Manual backup
sudo -u my-app sqlite3 /var/lib/my-app/app.db ".backup /var/lib/my-app/backups/manual-$(date +%F).db"

# Restore
systemctl stop my-app
sudo -u my-app cp /var/lib/my-app/backups/<ts>/app.db /var/lib/my-app/app.db
sudo -u my-app rm -f /var/lib/my-app/app.db-wal /var/lib/my-app/app.db-shm
systemctl start my-app

# Read-only look into the live DB
sqlite3 'file:/var/lib/my-app/app.db?mode=ro' 'select count(*) from app_users;'
```

Always write to the DB **as the service user** (`sudo -u my-app …`): a write as
root leaves a root-owned `app.db-wal`/`-shm` that the service can no longer
open.

## Known limits

- Single process, no horizontal scaling (SQLite file lock) — by design.
- No TLS in the app — the reverse proxy is mandatory.
- `ProtectSystem=strict`: only `/var/lib/<app>` is writable. Code writing elsewhere fails with `EROFS` → add the path to
  `ReadWritePaths` in prepare-lxc.sh and re-run it.
- A staging stage is not set up. To add one, run a second LXC with its own
  `APP_NAME` (e.g. `my-app-staging`) and a second deploy workflow for a
  `develop` branch — the unit, paths and runner label all derive from
  `APP_NAME`.
