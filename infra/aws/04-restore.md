# 04 — Restore

**When to use this:** When something has gone wrong, OR for a scheduled
restore drill (quarterly).

**RTO target:** ~10 minutes for the common case.
**RPO target:** Up to 24 h (last night's logical backup).

Read the scenario header first — pick the one that matches your situation.

---

## Prerequisites

- SSM Session Manager access to the EC2 instance (or a replacement).
- `aws` CLI on the box (already installed via user-data).
- The bucket name and KMS key ARN handy. Confirm:

  ```sh
  cat /etc/jjjordle-backup.env
  ```

---

## Scenario A — `.env` corrupted or lost

The Wordle answer and all server config lives in `server/.env`. If it is
mangled, deleted, or rotated incorrectly, restore from the last S3 bundle.

```sh
# 1. SSM into the box.
cd /tmp && rm -rf restore && mkdir restore && cd restore

# 2. List available bundles.
aws s3 ls s3://jjjordle-backups-<suffix>/daily/

# 3. Pick the most recent good one.
STAMP=2026-05-26T03-30-00Z

# 4. Download and verify.
aws s3 cp s3://jjjordle-backups-<suffix>/daily/$STAMP/bundle.tgz .
aws s3 cp s3://jjjordle-backups-<suffix>/daily/$STAMP/bundle.tgz.sha256 .
sha256sum -c bundle.tgz.sha256    # must print: bundle.tgz: OK
tar xzf bundle.tgz                # -> env.txt, client-dist.tgz

# 5. Restore .env.
cp /tmp/restore/env.txt /srv/wordle/server/.env
chmod 600 /srv/wordle/server/.env

# 6. Optionally restore the built client (only if client/dist/ was deleted).
#    Skip if it's still intact.
cd /srv/wordle
tar xzf /tmp/restore/client-dist.tgz

# 7. Restart the Node server.
pm2 restart wordle
```

**Verify:**
- The game loads in a browser.
- A valid guess returns coloured tiles.

**Common failure modes:**

| Failure | Fix |
|---|---|
| SHA256 mismatch | Try the previous day's bundle. |
| `pm2 restart` shows error | Check `pm2 logs wordle` — likely a bad env var. |

---

## Scenario B — Whole instance is gone

The EC2 is terminated, the AZ is on fire, or you nuked it. Two paths.

### B.1 — Fast path: restore from EBS snapshot (~10 min)

1. EC2 → **Snapshots** → pick the most recent → **Create Volume from snapshot**
   - Same AZ as your new instance.
2. Launch a new EC2 from the Amazon Linux 2023 arm64 AMI:
   - Same security group, same IAM role.
3. Stop the new instance, detach its empty root volume, attach the restored
   volume as `/dev/xvda`. Start it.
4. Reassociate the Elastic IP to the new instance.
5. Site is back, exactly where it was, within snapshot age.

### B.2 — Slow path: rebuild from S3 bundle (~30 min)

If snapshots are also unavailable (region outage, snapshots disabled, etc.).

1. Launch a fresh EC2 (follow [02-deploy.md](./02-deploy.md) steps 1–4).
2. `git clone` the repo into `/srv/wordle`.
3. Pull the bundle:

   ```sh
   cd /tmp && mkdir restore && cd restore
   aws s3 cp s3://jjjordle-backups-<suffix>/daily/<STAMP>/bundle.tgz .
   sha256sum -c bundle.tgz.sha256
   tar xzf bundle.tgz
   ```

4. Restore `.env`:

   ```sh
   cp /tmp/restore/env.txt /srv/wordle/server/.env
   chmod 600 /srv/wordle/server/.env
   ```

5. Restore the built client (or rebuild it):

   ```sh
   # Option A: restore from backup.
   cd /srv/wordle
   tar xzf /tmp/restore/client-dist.tgz

   # Option B: rebuild from source.
   npm install --prefix client
   npm run build --prefix client
   ```

6. Install server deps, configure nginx, start PM2 (follow 02-deploy.md steps
   6.3 and 6.4).

7. Reassociate the Elastic IP.

---

## Scenario C — Quarterly restore drill (no real outage)

Goal: verify Scenario A actually works, without touching production.

On your **laptop** (not the EC2 instance):

```sh
mkdir /tmp/jjjordle-drill && cd /tmp/jjjordle-drill
git clone https://github.com/<you>/jjjordle.git .

# Pull last night's bundle (requires AWS creds locally).
aws s3 cp s3://jjjordle-backups-<suffix>/daily/<latest>/bundle.tgz .
tar xzf bundle.tgz

# Restore .env.
cp env.txt server/.env

# Install deps and start the server locally.
npm install --prefix server --omit=dev
npm install --prefix client
npm run build --prefix client
node server/index.js &

# Open http://localhost:3001 — verify the game loads and guesses work.

# Cleanup.
kill %1
rm -rf /tmp/jjjordle-drill
```

If anything failed: file an issue *immediately*. A failed drill is the only
warning you get before a failed real restore.

---

## Verify (after any real restore)

- [ ] Game loads at the public URL.
- [ ] A guess returns coloured tiles (the server is reading `.env`).
- [ ] Game ends and the reveal sentence appears correctly.
- [ ] `pm2 list` shows `wordle` as `online`.
- [ ] Next backup runs on schedule (`systemctl list-timers`).

## Next

[05-operations.md](./05-operations.md) — day-to-day operations cheat sheet.
