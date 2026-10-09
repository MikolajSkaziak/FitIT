#!/usr/bin/env bash
# First-time setup of an Ubuntu LTS VM for FitIt. Run as root, once; running it again changes nothing that is already in place.
#
#   sudo ./server-setup.sh
#
# What it does:
#   1. creates an unprivileged deploy user (no sudo) and gives it your SSH key
#   2. installs Docker Engine and the Compose plugin from Docker's official apt repository
#   3. firewall (ufw): allows only SSH, 80 and 443 (tcp, and 443/udp for HTTP/3), everything else inbound is denied
#   4. unattended security upgrades (with an automatic reboot at 04:30 when one is needed, after the nightly backup)
#   5. a swap file (a 1-2 GB VM runs out of memory during a .NET image build without one)
#   6. /opt/fitit (the checkout), /etc/fitit (the env file, outside the repository), the backup directory,
#      and a cron entry for the nightly backup at 03:15
#
# Optional settings, as environment variables:
#   DEPLOY_USER=deploy        name of the unprivileged user
#   DEPLOY_SSH_KEY="ssh-ed25519 AAAA... you@laptop"   public key for that user; by default root's authorized_keys is copied
#   APP_DIR=/opt/fitit        where the repository is checked out
#   BACKUP_DIR=/var/backups/fitit
#   SWAP_SIZE=2G              "0" skips the swap file
#   AUTO_REBOOT=yes           "no" disables the automatic reboot after upgrades
#   HARDEN_SSH=no             "yes": no password login over SSH, and root only with a key. Switch it on only AFTER you have
#                             logged in as the deploy user with your key from a second terminal.
set -euo pipefail

DEPLOY_USER=${DEPLOY_USER:-deploy}
DEPLOY_SSH_KEY=${DEPLOY_SSH_KEY:-}
APP_DIR=${APP_DIR:-/opt/fitit}
ENV_DIR=/etc/fitit
BACKUP_DIR=${BACKUP_DIR:-/var/backups/fitit}
SWAP_SIZE=${SWAP_SIZE:-2G}
AUTO_REBOOT=${AUTO_REBOOT:-yes}
HARDEN_SSH=${HARDEN_SSH:-no}

script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

log() {
  printf '\n== %s\n' "$*"
}

if [ "$(id -u)" -ne 0 ]; then
  echo "Run as root: sudo $0" >&2
  exit 1
fi

# shellcheck disable=SC1091
. /etc/os-release
if [ "${ID:-}" != "ubuntu" ]; then
  echo "This script is for Ubuntu (found: ${PRETTY_NAME:-unknown})." >&2
  exit 1
fi
case "${VERSION:-}" in
  *LTS*) ;;
  *) echo "Warning: ${PRETTY_NAME} is not an LTS release; an LTS is recommended for a server." >&2 ;;
esac
export DEBIAN_FRONTEND=noninteractive

log "Packages"
apt-get update -y
apt-get install -y --no-install-recommends ca-certificates curl gnupg ufw unattended-upgrades cron logrotate rclone git

log "Deploy user: $DEPLOY_USER"
if ! id -u "$DEPLOY_USER" >/dev/null 2>&1; then
  adduser --disabled-password --gecos "" "$DEPLOY_USER"
fi
ssh_dir="/home/$DEPLOY_USER/.ssh"
install -d -m 0700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$ssh_dir"
touch "$ssh_dir/authorized_keys"
if [ -n "$DEPLOY_SSH_KEY" ]; then
  grep -qxF "$DEPLOY_SSH_KEY" "$ssh_dir/authorized_keys" || printf '%s\n' "$DEPLOY_SSH_KEY" >>"$ssh_dir/authorized_keys"
elif [ ! -s "$ssh_dir/authorized_keys" ] && [ -s /root/.ssh/authorized_keys ]; then
  cp /root/.ssh/authorized_keys "$ssh_dir/authorized_keys"
fi
chown "$DEPLOY_USER:$DEPLOY_USER" "$ssh_dir/authorized_keys"
chmod 0600 "$ssh_dir/authorized_keys"
if [ ! -s "$ssh_dir/authorized_keys" ]; then
  echo "Warning: $DEPLOY_USER has no SSH key yet. Pass DEPLOY_SSH_KEY=\"<public key>\" and run again." >&2
fi

log "Docker Engine and Compose plugin"
if ! docker compose version >/dev/null 2>&1; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  cat >/etc/apt/sources.list.d/docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: ${UBUNTU_CODENAME:-$VERSION_CODENAME}
Components: stable
Signed-By: /etc/apt/keyrings/docker.asc
EOF
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
systemctl enable --now docker
# Members of the docker group can start containers, which is root-equivalent on this machine. That is the price of
# deploying without sudo; keep the deploy user's SSH key as protected as root's.
usermod -aG docker "$DEPLOY_USER"

log "Firewall"
ssh_port=$(sshd -T 2>/dev/null | awk '$1 == "port" { print $2; exit }' || true)
ssh_port=${ssh_port:-22}
ufw default deny incoming
ufw default allow outgoing
ufw limit "${ssh_port}/tcp"
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp
ufw --force enable
# Docker publishes container ports around ufw. That is why compose.yml publishes only Caddy's 80 and 443 and nothing else.

log "Unattended security upgrades"
cat >/etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
EOF
if [ "$AUTO_REBOOT" = "yes" ]; then
  cat >/etc/apt/apt.conf.d/52fitit-unattended-upgrades <<'EOF'
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-Time "04:30";
EOF
else
  rm -f /etc/apt/apt.conf.d/52fitit-unattended-upgrades
fi
# Docker's own packages come from Docker's repository, which unattended-upgrades does not touch: update them by hand (README.md).

log "Swap"
if [ "$SWAP_SIZE" != "0" ] && [ -z "$(swapon --show --noheadings)" ]; then
  if [ ! -f /swapfile ]; then
    fallocate -l "$SWAP_SIZE" /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
  fi
  swapon /swapfile
  grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >>/etc/fstab
  echo 'vm.swappiness=10' >/etc/sysctl.d/90-fitit-swap.conf
  sysctl -q -p /etc/sysctl.d/90-fitit-swap.conf
fi

log "Directories and shell defaults"
install -d -m 0755 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$APP_DIR"
install -d -m 0700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$ENV_DIR"
install -d -m 0700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$BACKUP_DIR"
if [ ! -e "$ENV_DIR/fitit.env" ] && [ -f "$script_dir/.env.example" ]; then
  install -m 0600 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$script_dir/.env.example" "$ENV_DIR/fitit.env"
  echo "Created $ENV_DIR/fitit.env from the template: fill it in."
fi
# Login shells (the deploy user over SSH) get `docker compose ...` pointed at the checkout and the env file.
cat >/etc/profile.d/fitit.sh <<EOF
export COMPOSE_FILE=$APP_DIR/deploy/compose.yml
export COMPOSE_ENV_FILES=$ENV_DIR/fitit.env
EOF

log "Nightly backup (03:15) and its log"
cat >/etc/cron.d/fitit-backup <<EOF
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
15 3 * * * $DEPLOY_USER $APP_DIR/deploy/backup.sh >> $BACKUP_DIR/backup.log 2>&1
EOF
chmod 0644 /etc/cron.d/fitit-backup
cat >/etc/logrotate.d/fitit-backup <<EOF
$BACKUP_DIR/backup.log {
    su $DEPLOY_USER $DEPLOY_USER
    weekly
    rotate 8
    compress
    missingok
    notifempty
}
EOF
systemctl enable --now cron

if [ "$HARDEN_SSH" = "yes" ]; then
  log "SSH hardening"
  if [ ! -s "$ssh_dir/authorized_keys" ]; then
    echo "Refusing: $DEPLOY_USER has no SSH key, you would lock yourself out." >&2
    exit 1
  fi
  # Named 00-: sshd uses the first value it reads, and cloud images ship drop-ins that enable password login.
  cat >/etc/ssh/sshd_config.d/00-fitit.conf <<'EOF'
PermitRootLogin prohibit-password
PasswordAuthentication no
KbdInteractiveAuthentication no
EOF
  sshd -t
  systemctl reload ssh
fi

log "Done"
cat <<EOF
Next steps:
  1. From your computer, in a NEW terminal: ssh $DEPLOY_USER@<this server>   (must work before you close this session)
  2. As $DEPLOY_USER: git clone <repository> $APP_DIR
  3. Edit $ENV_DIR/fitit.env (copy $APP_DIR/deploy/.env.example there if it was not created), then follow deploy/README.md.
  4. Optionally run this script again with HARDEN_SSH=yes.
EOF
