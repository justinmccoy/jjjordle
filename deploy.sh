#!/usr/bin/env bash
# deploy.sh — run once on a fresh Amazon Linux 2023 / Ubuntu 22.04 instance
# Usage:  chmod +x deploy.sh && sudo ./deploy.sh
set -euo pipefail

APP_DIR=/srv/wordle

echo "==> Installing Node.js 20 + git"
if command -v dnf &>/dev/null; then
  dnf install -y nodejs npm git
else
  apt-get update -y
  apt-get install -y nodejs npm git
fi

echo "==> Installing Caddy (official binary)"
# Downloads the latest stable release for the current arch directly from GitHub.
# Works on Amazon Linux 2023 (arm64 or x86_64) and Ubuntu — no package repo needed.
ARCH=$(uname -m)
case "$ARCH" in
  aarch64) CADDY_ARCH="arm64" ;;
  x86_64)  CADDY_ARCH="amd64" ;;
  *)        echo "Unsupported arch: $ARCH"; exit 1 ;;
esac
CADDY_VERSION=$(curl -fsSL https://api.github.com/repos/caddyserver/caddy/releases/latest \
  | grep '"tag_name"' | sed 's/.*"v\([^"]*\)".*/\1/')
curl -fsSL "https://github.com/caddyserver/caddy/releases/download/v${CADDY_VERSION}/caddy_${CADDY_VERSION}_linux_${CADDY_ARCH}.tar.gz" \
  | tar -xz -C /usr/local/bin caddy
chmod +x /usr/local/bin/caddy

# Create the caddy system user, dirs, and systemd unit (mirrors the official package layout)
groupadd --system caddy 2>/dev/null || true
useradd --system --gid caddy --no-create-home --home /var/lib/caddy \
  --shell /usr/sbin/nologin --comment "Caddy web server" caddy 2>/dev/null || true
mkdir -p /etc/caddy /var/lib/caddy /var/log/caddy
chown -R caddy:caddy /var/lib/caddy /var/log/caddy

# Install the systemd unit from the official Caddy repo
curl -fsSL "https://raw.githubusercontent.com/caddyserver/dist/master/init/caddy.service" \
  -o /etc/systemd/system/caddy.service
systemctl daemon-reload

echo "==> Installing PM2 globally"
npm install -g pm2

echo "==> Creating app directory"
mkdir -p "$APP_DIR"

echo ""
echo "──────────────────────────────────────────────────────────────────"
echo "  Next steps (manual):"
echo ""
echo "  1. Copy your project into $APP_DIR:"
echo "       rsync -av ./ ec2-user@<IP>:$APP_DIR/"
echo ""
echo "  2. Create the env file:"
echo "       cp $APP_DIR/server/.env.example $APP_DIR/server/.env"
echo "       nano $APP_DIR/server/.env      # set WORDLE_ANSWER, WORDLE_SENTENCE, …"
echo ""
echo "  3. Install server dependencies:"
echo "       cd $APP_DIR/server && npm install --omit=dev"
echo ""
echo "  4. Build the React client:"
echo "       cd $APP_DIR/client && npm install && npm run build"
echo ""
echo "  5. Copy Caddyfile and start Caddy:"
echo "       sudo cp $APP_DIR/Caddyfile /etc/caddy/Caddyfile"
echo "       # Edit /etc/caddy/Caddyfile and replace <yourdomain> with your domain"
echo "       sudo systemctl enable caddy && sudo systemctl restart caddy"
echo ""
echo "  6. Start the Node server via PM2:"
echo "       cd $APP_DIR && pm2 start ecosystem.config.json"
echo "       pm2 save && pm2 startup"
echo ""
echo "  Done!  Visit https://<yourdomain>  (cert issued automatically by Caddy)"
echo "──────────────────────────────────────────────────────────────────"
