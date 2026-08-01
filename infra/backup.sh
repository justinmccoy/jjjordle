#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# infra/backup.sh — bundle server/.env and client/dist into S3.
#
# Invoked by the jjjordle-backup.timer systemd unit nightly. Produces one
# object per run under s3://$BACKUP_BUCKET/daily/<UTC-timestamp>/.
#
# Required environment (passed via the systemd unit's EnvironmentFile
# at /etc/jjjordle-backup.env):
#   BACKUP_BUCKET       S3 bucket for backup objects
#   BACKUP_KMS_KEY_ID   KMS key ID/ARN/alias for SSE-KMS encryption
#   APP_ROOT            Absolute path to the deployed repo (holds server/.env)
# -----------------------------------------------------------------------------
set -euo pipefail

: "${BACKUP_BUCKET:?BACKUP_BUCKET required}"
: "${BACKUP_KMS_KEY_ID:?BACKUP_KMS_KEY_ID required}"
: "${APP_ROOT:?APP_ROOT required}"

STAMP="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

echo "[backup ${STAMP}] starting"

# 1. .env — the Wordle answer and all secrets.
cp "${APP_ROOT}/server/.env" "$WORK/env.txt"
echo "[backup ${STAMP}] env.txt $(wc -c < "$WORK/env.txt") bytes"

# 2. Built React client — fast to restore instead of rebuilding.
tar czf "$WORK/client-dist.tgz" -C "${APP_ROOT}" client/dist
echo "[backup ${STAMP}] client-dist $(wc -c < "$WORK/client-dist.tgz") bytes"

# 3. Bundle + checksum.
tar czf "$WORK/bundle.tgz" -C "$WORK" env.txt client-dist.tgz
( cd "$WORK" && sha256sum bundle.tgz > bundle.tgz.sha256 )

# 4. Upload with SSE-KMS.
DEST="s3://${BACKUP_BUCKET}/daily/${STAMP}"
aws s3 cp "$WORK/bundle.tgz"        "${DEST}/bundle.tgz" \
  --sse aws:kms --sse-kms-key-id "$BACKUP_KMS_KEY_ID"
aws s3 cp "$WORK/bundle.tgz.sha256" "${DEST}/bundle.tgz.sha256" \
  --sse aws:kms --sse-kms-key-id "$BACKUP_KMS_KEY_ID"

echo "[backup ${STAMP}] uploaded to ${DEST}"
