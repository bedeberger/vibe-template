#!/usr/bin/env bash
###############################################################################
# prepare-lxc.sh — one-time provisioning of the production LXC
#
# Target: Ubuntu 24.04 LTS LXC on Proxmox, behind Nginx Proxy Manager.
# Full guide: docs/deployment.md.
#
#   sudo ./prepare-lxc.sh                          # defaults below
#   sudo APP_NAME=my-app PORT=3000 REPO_SLUG=me/my-app ./prepare-lxc.sh
#   sudo APP_NAME=my-app REPO_SLUG=me/my-app RUNNER_TOKEN=<token> ./prepare-lxc.sh
#
# RUNNER_TOKEN is the short-lived REGISTRATION token (GitHub → repo → Settings
# → Actions → Runners → New self-hosted runner). With it, the runners are
# registered and started as services right away; without it they are only
# downloaded and the script prints the commands.
#
# SELF-CONTAINED on purpose: the usual way onto a fresh, empty LXC is to paste
# this file's content and run it — there is no checkout yet. Everything it puts
# on the machine (systemd unit, app.env skeleton, journald config, sudoers) is a
# heredoc IN this file. Keep it that way when extending it.
#
# Idempotent — safe to run again (e.g. after changing the unit):
#   1. system packages + build tools (better-sqlite3 compiles natively)
#   2. Node.js LTS via NodeSource
#   3. two users: <APP_NAME> (runs the service) + github-runner (deploys)
#   4. directories /opt/<app> (code), /var/lib/<app> (DB, logs, backups),
#      /etc/<app> (app.env with secrets)
#   5. hardened systemd unit
#   6. journald retention
#   7. sudoers: the runner may restart the unit and back up the DB
#   8. Playwright system libraries (for self-hosted CI; browser binary is per run)
#   9. RUNNER_COUNT GitHub Actions runners (/opt/actions-runner-<n>), registered
#      with the label <APP_NAME> and installed as services if RUNNER_TOKEN is set
#  10. runner watchdog (systemd timer) against the dead broker session
###############################################################################

set -euo pipefail

# ── Configuration (override via environment) ────────────────────────────────
APP_NAME="${APP_NAME:-vibe-template}"
PORT="${PORT:-3000}"
REPO_SLUG="${REPO_SLUG:-OWNER/${APP_NAME}}"
NODE_MAJOR="${NODE_MAJOR:-24}"
RUNNER_VERSION="${RUNNER_VERSION:-2.334.0}"   # https://github.com/actions/runner/releases
# Two by default: a runner takes ONE job at a time — with a single one, a PR
# check waits behind a running deploy (and vice versa).
RUNNER_COUNT="${RUNNER_COUNT:-2}"
RUNNER_TOKEN="${RUNNER_TOKEN:-}"
# Watchdog: it CHECKS every interval but restarts only on evidence (see there).
WATCHDOG_INTERVAL="${WATCHDOG_INTERVAL:-5min}"
WATCHDOG_GRACE="${WATCHDOG_GRACE:-120}"            # s — never restart a fresh session
WATCHDOG_STALE_AFTER="${WATCHDOG_STALE_AFTER:-900}" # s — silent _diag log = dead loop
WATCHDOG_MAX_SESSION="${WATCHDOG_MAX_SESSION:-21600}" # s — precautionary renewal (6 h)

readonly APP_USER="${APP_NAME}"
readonly RUNNER_USER="github-runner"
readonly RUNNER_BASE="/opt/actions-runner"      # runner n lives in ${RUNNER_BASE}-n
readonly APP_DIR="/opt/${APP_NAME}"
readonly DATA_DIR="/var/lib/${APP_NAME}"
readonly CONFIG_DIR="/etc/${APP_NAME}"

log()  { echo -e "\033[1;34m[INFO]\033[0m  $*"; }
warn() { echo -e "\033[1;33m[WARN]\033[0m  $*"; }
err()  { echo -e "\033[1;31m[ERROR]\033[0m $*" >&2; }

[[ $EUID -eq 0 ]] || { err "Run as root."; exit 1; }
[[ "${APP_NAME}" =~ ^[a-z][a-z0-9-]{1,30}$ ]] || { err "APP_NAME must be lowercase [a-z0-9-]: '${APP_NAME}'"; exit 2; }
[[ "${RUNNER_COUNT}" =~ ^[1-9]$ ]] || { err "RUNNER_COUNT must be 1–9: '${RUNNER_COUNT}'"; exit 2; }
if [[ -n "${RUNNER_TOKEN}" && "${REPO_SLUG}" == OWNER/* ]]; then
  err "RUNNER_TOKEN given but REPO_SLUG is still the placeholder '${REPO_SLUG}'."; exit 2
fi

# ── 1. System packages ──────────────────────────────────────────────────────
install_system_packages() {
  log "Installing system packages…"
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq
  apt-get upgrade -y -qq
  # build-essential + python3: better-sqlite3 falls back to node-gyp when no
  # prebuild matches. sqlite3: DB backups. jq/curl: health check. acl/rsync:
  # deploy. libicu74: the Actions runner (.NET) needs it.
  apt-get install -y -qq \
    ca-certificates curl gnupg openssl sudo \
    build-essential python3 git \
    sqlite3 jq rsync acl unzip libicu74
}

# ── 2. Node.js ──────────────────────────────────────────────────────────────
install_nodejs() {
  if command -v node >/dev/null 2>&1 && node --version | grep -q "^v${NODE_MAJOR}\."; then
    log "Node.js ${NODE_MAJOR}.x already installed: $(node --version)"
    return
  fi
  log "Installing Node.js ${NODE_MAJOR}…"
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y -qq nodejs
  log "Installed: node $(node --version), npm $(npm --version)"
}

# ── 3. Users ────────────────────────────────────────────────────────────────
create_users() {
  for user in "${APP_USER}" "${RUNNER_USER}"; do
    if id "${user}" >/dev/null 2>&1; then
      log "User '${user}' exists."
    else
      log "Creating user '${user}'…"
      useradd --system --create-home --shell /bin/bash "${user}"
    fi
  done
}

# ── 4. Directories ──────────────────────────────────────────────────────────
setup_directories() {
  log "Creating directories…"
  install -d -o "${APP_USER}" -g "${APP_USER}" -m 0755 "${APP_DIR}"
  install -d -o "${APP_USER}" -g "${APP_USER}" -m 0750 "${DATA_DIR}"
  install -d -o "${APP_USER}" -g "${APP_USER}" -m 0750 "${DATA_DIR}/backups"
  install -d -o root          -g "${APP_USER}" -m 0750 "${CONFIG_DIR}"
  # The runner deploys (rsync) into the app dir.
  setfacl -R -m "u:${RUNNER_USER}:rwx" "${APP_DIR}"
  setfacl -R -d -m "u:${RUNNER_USER}:rwx" "${APP_DIR}"
}

# ── 5. systemd unit + app.env ───────────────────────────────────────────────
create_systemd_unit() {
  log "Writing systemd unit ${APP_NAME}.service (:${PORT})…"
  cat > "/etc/systemd/system/${APP_NAME}.service" <<EOF
[Unit]
Description=${APP_NAME} (Node.js/Express)
Documentation=https://github.com/${REPO_SLUG}
After=network.target

[Service]
Type=simple
User=${APP_USER}
Group=${APP_USER}
WorkingDirectory=${APP_DIR}

# Secrets from /etc (NOT in the repo). Paths and NODE_ENV are pinned HERE, so a
# stray line in app.env can neither point at an empty DB nor drop the
# production hardening (server.js refuses to boot insecurely under production).
EnvironmentFile=${CONFIG_DIR}/app.env
Environment=NODE_ENV=production
Environment=PORT=${PORT}
Environment=DB_PATH=${DATA_DIR}/app.db
Environment=LOG_PATH=${DATA_DIR}/app.log

# server.js imports db/schema at boot → pending migrations run as ${APP_USER}.
ExecStart=/usr/bin/node ${APP_DIR}/server.js
Restart=on-failure
RestartSec=5

StandardOutput=journal
StandardError=journal
SyslogIdentifier=${APP_NAME}

# Hardening. ProtectSystem=strict makes the FS read-only except ${DATA_DIR}
# (SQLite DB + WAL/SHM, sessions, app.log, backups). The code dir stays
# read-only for the service: vendored assets are committed (public/vendor/).
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=${DATA_DIR}
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true
RestrictNamespaces=true
LockPersonality=true
RestrictRealtime=true

[Install]
WantedBy=multi-user.target
EOF

  if [[ ! -f "${CONFIG_DIR}/app.env" ]]; then
    log "Creating ${CONFIG_DIR}/app.env (SESSION_SECRET generated)…"
    local secret
    secret="$(openssl rand -hex 32)"
    cat > "${CONFIG_DIR}/app.env" <<EOF
# ${APP_NAME} — production config. Belongs to this machine, NEVER to the repo.
#
# NO LOCAL_DEV_MODE here — it bypasses the login entirely (server.js refuses to
# boot with it under NODE_ENV=production anyway).
# PORT, DB_PATH, LOG_PATH and NODE_ENV are set by the systemd unit.

# Signs the session cookies. Generated — rotating it logs everyone out.
SESSION_SECRET=${secret}

LOG_LEVEL=info

# The admin — always signs in with this password, also when OIDC is down.
# Password ≥ 16 chars (openssl rand -base64 24).
ADMIN_EMAIL=
ADMIN_PASSWORD=

# Only the OIDC secret lives here. Issuer, client id, redirect URI, sign-in
# method, timezone etc. are set in the app: admin console → Settings.
OIDC_CLIENT_SECRET=
EOF
    chown root:"${APP_USER}" "${CONFIG_DIR}/app.env"
    chmod 0640 "${CONFIG_DIR}/app.env"
  else
    log "${CONFIG_DIR}/app.env exists (unchanged)."
  fi

  systemctl daemon-reload
  systemctl enable "${APP_NAME}.service" >/dev/null
  log "Service registered (first start happens with the first deploy)."
}

# ── 6. journald ─────────────────────────────────────────────────────────────
configure_journald() {
  log "Configuring journald retention…"
  install -d -m 0755 /etc/systemd/journald.conf.d
  cat > "/etc/systemd/journald.conf.d/${APP_NAME}.conf" <<EOF
# Written by prepare-lxc.sh — do not edit by hand.
[Journal]
Storage=persistent
SystemMaxUse=500M
MaxRetentionSec=1month
EOF
  systemctl restart systemd-journald
}

# ── 7. sudoers ──────────────────────────────────────────────────────────────
configure_sudoers() {
  log "Writing sudoers rule for ${RUNNER_USER}…"
  local f="/etc/sudoers.d/${APP_NAME}-runner"
  # Explicit lines per verb — NO wildcard on the unit name
  # (`systemctl restart *` would let the runner control every service).
  {
    echo "# ${RUNNER_USER} may control the ${APP_NAME} service"
    for verb in restart start stop status; do
      echo "${RUNNER_USER} ALL=(root) NOPASSWD: /usr/bin/systemctl ${verb} ${APP_NAME}.service"
    done
    # The exact diagnostic call deploy.yml makes on a failed health check —
    # sudoers matches the WHOLE argument list.
    echo "${RUNNER_USER} ALL=(root) NOPASSWD: /usr/bin/systemctl status ${APP_NAME}.service --no-pager -l -n 50"
    echo ""
    echo "# Pre-deploy DB backup / dry-run copy / rollback as the service user"
    echo "${RUNNER_USER} ALL=(${APP_USER}) NOPASSWD: /usr/bin/env, /usr/bin/sqlite3"
  } > "$f"
  chmod 0440 "$f"
  visudo -cf "$f" >/dev/null
}

# ── 8. Playwright system libraries ─────────────────────────────────────────
# Self-hosted CI runs e2e/e2e-app here. The runner user has no sudo for apt,
# so `playwright install --with-deps` can't run in the job — the OS libs
# (libnss3, libasound2t64, …) are installed once here, as root; the job only
# downloads the browser binary into the runner's cache. Playwright's own
# resolver picks the package list, so it doesn't drift.
install_playwright_deps() {
  log "Installing Playwright system libraries for Chromium…"
  export DEBIAN_FRONTEND=noninteractive
  if ! (cd /tmp && npx --yes playwright install-deps chromium >/dev/null); then
    warn "playwright install-deps reported errors — check before the first self-hosted CI run."
  fi
}

# ── 9. GitHub Actions runners ───────────────────────────────────────────────
runner_labels() { echo "self-hosted,linux,${APP_NAME}"; }

install_github_runners() {
  local arch="x64"
  case "$(uname -m)" in aarch64|arm64) arch="arm64" ;; esac
  local tgz="actions-runner-linux-${arch}-${RUNNER_VERSION}.tar.gz"
  local cache="/var/cache/actions-runner"
  install -d -m 0755 "${cache}"
  if [[ ! -f "${cache}/${tgz}" ]]; then
    log "Downloading GitHub Actions runner v${RUNNER_VERSION}…"
    curl -fsSL --retry 5 -o "${cache}/${tgz}.part" \
      "https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/${tgz}"
    mv "${cache}/${tgz}.part" "${cache}/${tgz}"
  fi

  local n dir name
  for n in $(seq 1 "${RUNNER_COUNT}"); do
    dir="${RUNNER_BASE}-${n}"
    name="$(hostname)-${n}"
    if [[ ! -x "${dir}/config.sh" ]]; then
      log "Unpacking runner ${n} → ${dir}"
      install -d -o "${RUNNER_USER}" -g "${RUNNER_USER}" -m 0755 "${dir}"
      sudo -u "${RUNNER_USER}" tar xzf "${cache}/${tgz}" -C "${dir}"
      "${dir}/bin/installdependencies.sh" >/dev/null 2>&1 || warn "installdependencies.sh reported errors (libicu74 is installed)."
    fi
    if [[ -f "${dir}/.runner" ]]; then
      log "Runner ${n} already registered."
    elif [[ -n "${RUNNER_TOKEN}" ]]; then
      log "Registering runner ${name} (labels $(runner_labels))…"
      # --replace: re-running the script after a wiped box reuses the name
      # instead of failing on "a runner with this name already exists".
      sudo -u "${RUNNER_USER}" bash -c "cd '${dir}' && ./config.sh --unattended --replace \
        --url 'https://github.com/${REPO_SLUG}' --token '${RUNNER_TOKEN}' \
        --name '${name}' --labels '$(runner_labels)' --work _work"
    else
      continue
    fi
    # Service (idempotent: svc.sh install fails if the unit exists).
    if ! systemctl list-unit-files 'actions.runner.*' --no-legend 2>/dev/null | grep -q "\.${name}\.service"; then
      (cd "${dir}" && ./svc.sh install "${RUNNER_USER}" >/dev/null)
    fi
    (cd "${dir}" && ./svc.sh start >/dev/null) || warn "Runner ${n}: service start failed."
  done
}

# ── 10. Runner watchdog ─────────────────────────────────────────────────────
# A runner occasionally loses its long-poll connection to the GitHub broker
# on the busy → idle transition and never asks for work again — process and
# heartbeat live on, GitHub shows it "online", jobs hang in "Waiting for a
# runner to pick up this job". A timer checks every runner and renews a dead
# session.
#
# IT CHECKS OFTEN AND RESTARTS RARELY. Restarting on every idle check loses
# jobs: between "GitHub assigned the job" and "Runner.Worker exists" lie a few
# seconds in which the runner looks idle; a restart there drops the job and
# GitHub fails it after exactly 10 minutes ("lost communication", zero steps).
# Hence: restart only on evidence, never within the grace period.
#
# Quoted heredoc: the watchdog's ${…} are ITS runtime variables; thresholds
# reach it via Environment= of its service unit.
install_runner_watchdog() {
  log "Installing runner watchdog…"
  local bin="/usr/local/sbin/${APP_NAME}-runner-watchdog"
  cat > "${bin}" <<'WATCHDOG'
#!/usr/bin/env bash
# Runner watchdog — GENERATED by scripts/prepare-lxc.sh (the source is there).
# For every actions.runner.* service: restart ONLY if one indicator holds —
#   1. the broker failure is the LAST broker event in the runner's _diag log,
#   2. the _diag log hasn't grown for STALE_AFTER s (dead message loop),
#   3. the session is older than MAX_SESSION s (blunt fallback).
# Never while a job runs (Runner.Worker of THAT runner), never within GRACE s
# of a start. Every decision is logged:
#   journalctl -u <app>-runner-watchdog.service --since '-1h'
set -euo pipefail
[[ ${EUID} -eq 0 ]] || { echo "runner-watchdog: must run as root." >&2; exit 1; }

GRACE="${WATCHDOG_GRACE:-120}"
STALE_AFTER="${WATCHDOG_STALE_AFTER:-900}"
MAX_SESSION="${WATCHDOG_MAX_SESSION:-21600}"

session_age() {
  local started now_us
  started="$(systemctl show -p ActiveEnterTimestampMonotonic --value "$1" 2>/dev/null || echo 0)"
  [[ -z "${started}" || "${started}" == "0" ]] && { echo 0; return; }  # unknown = fresh
  now_us="$(awk '{ printf "%d", $1 * 1000000 }' /proc/uptime)"
  echo $(( (now_us - started) / 1000000 ))
}

# Newest _diag log of a runner dir; prints nothing (and doesn't fail) if none.
diag_log() {
  local newest
  newest="$(ls -1t "$1/_diag"/Runner_*.log 2>/dev/null | head -n 1 || true)"
  [[ -n "${newest}" ]] && echo "${newest}"
  return 0
}

# A single broker error is normal; dead = no recovery line after the last one.
broker_dead() {
  local log; log="$(diag_log "$1")"
  [[ -z "${log}" ]] && return 1
  tail -n 400 "${log}" 2>/dev/null | awk '
    /Listening for Jobs|Runner connect|Fetched message/ { dead = 0 }
    /BrokerMessageListener.*cancelled|BrokerServer.*SocketException|Back off .* before next retry/ { dead = 1 }
    END { exit dead ? 0 : 1 }'
}

check_unit() {
  local unit="$1" dir age quiet log
  dir="$(systemctl show -p WorkingDirectory --value "${unit}")"
  if [[ -n "${dir}" ]] && pgrep -f "${dir}/bin/Runner.Worker" >/dev/null 2>&1; then
    echo "${unit}: job running — no restart."; return
  fi
  if ! systemctl is-active --quiet "${unit}"; then
    echo "${unit}: not active — starting."; systemctl start "${unit}"; return
  fi
  age="$(session_age "${unit}")"
  if (( age < GRACE )); then echo "${unit}: session ${age}s old (grace ${GRACE}s) — no restart."; return; fi
  log="$(diag_log "${dir}")"
  quiet=""; [[ -n "${log}" ]] && quiet=$(( $(date +%s) - $(stat -c %Y "${log}") ))
  if broker_dead "${dir}"; then
    echo "${unit}: broker failure is the last event — restarting."; systemctl restart "${unit}"
  elif [[ -n "${quiet}" ]] && (( quiet >= STALE_AFTER )); then
    echo "${unit}: _diag log silent for ${quiet}s — restarting."; systemctl restart "${unit}"
  elif (( age >= MAX_SESSION )); then
    echo "${unit}: session ${age}s old — precautionary restart."; systemctl restart "${unit}"
  else
    echo "${unit}: healthy (age ${age}s, log quiet ${quiet:-?}s)."
  fi
}

units="$(systemctl list-units --type=service --all --plain --no-legend 'actions.runner.*' | awk '{ print $1 }')"
[[ -z "${units}" ]] && { echo "runner-watchdog: no actions.runner.* service — nothing to do."; exit 0; }
for u in ${units}; do check_unit "${u}"; done
WATCHDOG
  chmod 0755 "${bin}"

  cat > "/etc/systemd/system/${APP_NAME}-runner-watchdog.service" <<EOF
# Written by prepare-lxc.sh — do not edit by hand.
[Unit]
Description=Runner watchdog: renews dead GitHub runner broker sessions

[Service]
Type=oneshot
Environment=WATCHDOG_GRACE=${WATCHDOG_GRACE}
Environment=WATCHDOG_STALE_AFTER=${WATCHDOG_STALE_AFTER}
Environment=WATCHDOG_MAX_SESSION=${WATCHDOG_MAX_SESSION}
ExecStart=${bin}
EOF
  cat > "/etc/systemd/system/${APP_NAME}-runner-watchdog.timer" <<EOF
# Written by prepare-lxc.sh — do not edit by hand.
[Unit]
Description=Run the runner watchdog periodically

[Timer]
OnBootSec=2min
OnUnitActiveSec=${WATCHDOG_INTERVAL}
AccuracySec=30s

[Install]
WantedBy=timers.target
EOF
  systemctl daemon-reload
  systemctl enable --now "${APP_NAME}-runner-watchdog.timer" >/dev/null
}

print_next_steps() {
  local ip registered
  ip="$(hostname -I | awk '{print $1}')"
  registered="$( (ls -d "${RUNNER_BASE}"-*/.runner 2>/dev/null || true) | wc -l)"
  echo
  echo "────────────────────────────────────────────────────────────────────────────"
  echo " Done: ${APP_NAME} on :${PORT}, ${registered}/${RUNNER_COUNT} runner(s) registered."
  echo " Next steps (docs/deployment.md):"
  if (( registered < RUNNER_COUNT )); then
    cat <<EOF

 • Register the runners: get a registration token (GitHub → repo → Settings →
   Actions → Runners → New self-hosted runner) and re-run this script with
     RUNNER_TOKEN=<token> APP_NAME=${APP_NAME} REPO_SLUG=${REPO_SLUG} ./prepare-lxc.sh
   (labels: $(runner_labels)).
EOF
  fi
  cat <<EOF

 • Fill ${CONFIG_DIR}/app.env (ADMIN_EMAIL, ADMIN_PASSWORD[, OIDC_CLIENT_SECRET]).
 • GitHub → Settings → Variables: DEPLOY_ENABLED=true, optionally
   SELF_HOSTED_CI=true (tests run here instead of on GitHub-hosted runners),
   plus APP_NAME=${APP_NAME} / PORT=${PORT} if not the defaults.
 • Nginx Proxy Manager: Proxy Host → http://${ip}:${PORT}, SSL on.

 Service:  systemctl status ${APP_NAME}   ·   journalctl -u ${APP_NAME} -f
 Runners:  systemctl list-units 'actions.runner.*'
 Watchdog: journalctl -u ${APP_NAME}-runner-watchdog.service --since '-1h'
────────────────────────────────────────────────────────────────────────────
EOF
}

install_system_packages
install_nodejs
create_users
setup_directories
create_systemd_unit
configure_journald
configure_sudoers
install_playwright_deps
install_github_runners
install_runner_watchdog
print_next_steps
