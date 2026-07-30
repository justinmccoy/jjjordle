#!/usr/bin/env bash
# deploy.sh — run once on a fresh Amazon Linux 2023 / Ubuntu 22.04 instance
# Usage:  chmod +x deploy.sh && sudo ./deploy.sh
set -euo pipefail

APP_DIR=/srv/wordle

echo "==> Installing Node.js 20 + nginx + git"
if command -v dnf &>/dev/null; then
  dnf install -y nodejs npm nginx git
else
  apt-get update -y
  apt-get install -y nodejs npm nginx git
fi

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
echo "  5. Copy nginx config:"
echo "       cp $APP_DIR/nginx.conf /etc/nginx/conf.d/wordle.conf"
echo "       systemctl enable nginx && systemctl restart nginx"
echo ""
echo "  6. Start the Node server via PM2:"
echo "       cd $APP_DIR && pm2 start ecosystem.config.json"
echo "       pm2 save && pm2 startup"
echo ""
echo "  Done!  Visit http://<your-public-ip>"
echo "──────────────────────────────────────────────────────────────────"
