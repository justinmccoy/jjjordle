#!/bin/bash
# -----------------------------------------------------------------------------
# user-data.sh — EC2 first-boot bootstrap for the jjjordle host.
#
# Pasted into the "User data" field when launching the instance (or passed
# via `--user-data file://infra/aws/user-data.sh` to the CLI). Cloud-init runs
# this once, as root, on first boot.
#
# Targets: Amazon Linux 2023 on arm64 (e.g. t4g.small).
# Side effects:
#   - installs Node.js 20, Caddy, git, make
#   - installs PM2 globally
#   - enables caddy.service
#   - turns on dnf-automatic for unattended security updates
#
# Idempotent within the same boot; cloud-init won't re-run it on reboot.
# -----------------------------------------------------------------------------
set -euxo pipefail

dnf update -y
dnf install -y nodejs npm git make

# Install Caddy — download the official binary directly from GitHub.
# The COPR repo does not have an Amazon Linux 2023 / aarch64 build.
ARCH=$(uname -m)
case "$ARCH" in
  aarch64) CADDY_ARCH="arm64" ;;
  x86_64)  CADDY_ARCH="amd64" ;;
esac
CADDY_VERSION=$(curl -fsSL https://api.github.com/repos/caddyserver/caddy/releases/latest \
  | grep '"tag_name"' | sed 's/.*"v\([^"]*\)".*/\1/')
curl -fsSL "https://github.com/caddyserver/caddy/releases/download/v${CADDY_VERSION}/caddy_${CADDY_VERSION}_linux_${CADDY_ARCH}.tar.gz" \
  | tar -xz -C /usr/local/bin caddy
chmod +x /usr/local/bin/caddy

# Create system user, dirs, and systemd unit (mirrors the official package layout)
groupadd --system caddy 2>/dev/null || true
useradd --system --gid caddy --no-create-home --home /var/lib/caddy \
  --shell /usr/sbin/nologin --comment "Caddy web server" caddy 2>/dev/null || true
mkdir -p /etc/caddy /var/lib/caddy /var/log/caddy
chown -R caddy:caddy /var/lib/caddy /var/log/caddy
curl -fsSL "https://raw.githubusercontent.com/caddyserver/dist/master/init/caddy.service" \
  -o /etc/systemd/system/caddy.service
systemctl daemon-reload
systemctl enable caddy

# PM2 process manager for keeping the Node server alive across reboots.
npm install -g pm2

# Startup hook: pm2 resurrect will be configured after the app is deployed.
pm2 startup systemd -u ec2-user --hp /home/ec2-user || true

# Unattended security updates.
dnf install -y dnf-automatic
sed -i 's/^apply_updates = no/apply_updates = yes/' /etc/dnf/automatic.conf
systemctl enable --now dnf-automatic.timer
