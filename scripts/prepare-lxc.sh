#!/usr/bin/env bash
###############################################################################
# prepare-lxc.sh — one-time provisioning of the production LXC
#
# Target: Ubuntu 24.04 LTS LXC on Proxmox, behind Nginx Proxy Manager.
# Full guide: docs/deployment.md.
#
#   sudo ./prepare-lxc.sh                          # defaults below
#   sudo APP_NAME=my-app PORT=3000 REPO_SLUG=me/my-app ./prepare-lxc.sh
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
#   8. GitHub Actions runner download (registration is manual, printed at the end)
###############################################################################

set -euo pipefail

# ── Configuration (override via environment) ────────────────────────────────
APP_NAME="${APP_NAME:-vibe-template}"
PORT="${PORT:-3000}"
REPO_SLUG="${REPO_SLUG:-OWNER/${APP_NAME}}"
NODE_MAJOR="${NODE_MAJOR:-24}"
RUNNER_VERSION="${RUNNER_VERSION:-2.334.0}"   # https://github.com/actions/runner/releases

readonly APP_USER="${APP_NAME}"
readonly RUNNER_USER="github-runner"
readonly RUNNER_DIR="/opt/actions-runner"
readonly APP_DIR="/opt/${APP_NAME}"
readonly DATA_DIR="/var/lib/${APP_NAME}"
readonly CONFIG_DIR="/etc/${APP_NAME}"

log()  { echo -e "\033[1;34m[INFO]\033[0m  $*"; }
warn() { echo -e "\033[1;33m[WARN]\033[0m  $*"; }
err()  { echo -e "\033[1;31m[ERROR]\033[0m $*" >&2; }

[[ $EUID -eq 0 ]] || { err "Run as root."; exit 1; }
[[ "${APP_NAME}" =~ ^[a-z][a-z0-9-]{1,30}$ ]] || { err "APP_NAME must be lowercase [a-z0-9-]: '${APP_NAME}'"; exit 2; }

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

# Hardening. ProtectSystem=strict makes the FS read-only except:
#   ${DATA_DIR}               → SQLite DB (+WAL/SHM), sessions, app.log, backups
#   ${APP_DIR}/public/vendor  → lib/vendor.js copies Alpine there at boot
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=${DATA_DIR} ${APP_DIR}/public/vendor
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

APP_TIMEZONE=Europe/Zurich
LOG_LEVEL=info

# First admin (gets global_role=admin at boot).
ADMIN_EMAIL=

# OIDC — the redirect URI is the PUBLIC https URL behind Nginx Proxy Manager.
OIDC_ISSUER=
OIDC_CLIENT_ID=
OIDC_CLIENT_SECRET=
OIDC_REDIRECT_URI=https://app.example.com/auth/callback
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

# ── 8. GitHub Actions runner ────────────────────────────────────────────────
install_github_runner() {
  if [[ -f "${RUNNER_DIR}/.runner" ]]; then
    log "GitHub runner already configured."
    return
  fi
  log "Downloading GitHub Actions runner v${RUNNER_VERSION}…"
  install -d -o "${RUNNER_USER}" -g "${RUNNER_USER}" -m 0755 "${RUNNER_DIR}"
  local tgz="actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz"
  sudo -u "${RUNNER_USER}" bash -c "cd '${RUNNER_DIR}' && \
    curl -fsSL -o '${tgz}' 'https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/${tgz}' && \
    tar xzf '${tgz}' && rm -f '${tgz}'"
  "${RUNNER_DIR}/bin/installdependencies.sh" >/dev/null 2>&1 || warn "installdependencies.sh reported errors."
}

print_next_steps() {
  local ip
  ip="$(hostname -I | awk '{print $1}')"
  cat <<EOF

────────────────────────────────────────────────────────────────────────────
 Done. Next steps (docs/deployment.md):

 1. Register the runner (token: GitHub → repo → Settings → Actions → Runners
    → New self-hosted runner):

      cd ${RUNNER_DIR}
      sudo -u ${RUNNER_USER} ./config.sh --unattended \\
        --url https://github.com/${REPO_SLUG} --token <TOKEN> \\
        --name \$(hostname) --labels self-hosted,linux,${APP_NAME}
      sudo ./svc.sh install ${RUNNER_USER}
      sudo ./svc.sh start

 2. Fill ${CONFIG_DIR}/app.env (ADMIN_EMAIL, OIDC_*), then
    GitHub → Settings → Variables: DEPLOY_ENABLED=true
    (plus APP_NAME=${APP_NAME} / PORT=${PORT} if not the defaults).

 3. Nginx Proxy Manager: Proxy Host → http://${ip}:${PORT}, SSL on.
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
install_github_runner
print_next_steps
