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

# Install Caddy from the official COPR repo
dnf install -y 'dnf-command(copr)' || true
dnf copr enable -y @caddy/caddy || true
dnf install -y caddy

systemctl enable caddy

# PM2 process manager for keeping the Node server alive across reboots.
npm install -g pm2

# Startup hook: pm2 resurrect will be configured after the app is deployed.
pm2 startup systemd -u ec2-user --hp /home/ec2-user || true

# Unattended security updates.
dnf install -y dnf-automatic
sed -i 's/^apply_updates = no/apply_updates = yes/' /etc/dnf/automatic.conf
systemctl enable --now dnf-automatic.timer
