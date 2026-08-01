# 03 — Backups

**When to use this:** Once, after [02-deploy.md](./02-deploy.md). After that,
the only follow-up is the testing schedule at the bottom.

**Estimated time:** ~30 minutes.

**Outcome:** Two independent backup layers:
- **EBS snapshots** (fast restore, captures whole disk) — daily, ~7+4 kept.
- **Logical bundles to S3** (durable, captures `.env` and the built client)
  — nightly, encrypted, versioned, lifecycled to Glacier.

A single failure mode can't take both out.

---

## What gets backed up

| Data | Lives in | Layer |
|---|---|---|
| `server/.env` (answer + all secrets) | file on disk | A + B |
| Built React client (`client/dist/`) | file on disk | A + B |
| App code | git | neither (it's in git) |

> jjjordle has no database — the Wordle answer and config live exclusively in
> `.env`. The S3 bundle is therefore small (< 1 MB) and fast.

## Prerequisites

- [02-deploy.md](./02-deploy.md) is done; the box is up and serving.
- The EBS volume is tagged `Backup=daily` (set in step 3.8 of 02-deploy.md).

## 1. Create the S3 backup bucket

S3 → Create bucket:

- **Name:** `jjjordle-backups-<random-suffix>` (S3 names are global)
- **Region:** same as the EC2 instance (`us-east-1`)
- **Block all public access:** ✅ (default — leave it)
- **Bucket versioning:** ✅ Enable
- **Default encryption:** SSE-S3 (free) or SSE-KMS with `aws/s3` (also free)

Add a **Lifecycle rule** to age data out:

- After 30 days → Glacier Instant Retrieval (~85% cheaper, ms retrieval)
- After 180 days → Glacier Deep Archive (cheapest, ~12 h retrieval)
- After 365 days → Expire

## 2. Create a KMS key

KMS → Customer managed keys → Create key → Symmetric:

- Alias: `jjjordle-backups`
- Key administrators: your Identity Center user
- Key users: leave empty for now; granted via the policy below.

Cost: $1/month flat. Skippable if you cost-minimize — SSE-KMS with the
default `aws/s3` key still encrypts at rest.

## 3. Attach the S3-backup IAM policy

IAM → Roles → `jjjordle-ec2-role` → **Add permissions → Create inline policy**.

Use [`iam-policies/ec2-s3-backup.json`](./iam-policies/ec2-s3-backup.json),
replacing `REPLACE_WITH_BUCKET_NAME` with your bucket name and
`REPLACE_WITH_KMS_KEY_ARN` with the ARN from step 2.

Note: the policy has **no `s3:DeleteObject`**. The box uploads; lifecycle
expires. If the box is compromised, the attacker can't wipe backup history.

## 4. EBS snapshot lifecycle

EC2 → Lifecycle Manager → Create lifecycle policy → **EBS snapshot policy**:

- **Target resources:** Volumes tagged `Backup=daily`
- **Schedule:** Daily, 04:00 UTC, retention 7 snapshots
- **Optional second schedule:** Weekly (Sunday), retention 4 snapshots

## 5. Install the logical-backup script on the box

SSM into the instance, then:

```sh
cd /srv/wordle
git pull       # picks up infra/backup.sh and infra/aws/jjjordle-backup.*

# Environment file for the systemd unit.
sudo tee /etc/jjjordle-backup.env >/dev/null <<EOF
BACKUP_BUCKET=jjjordle-backups-<suffix>
BACKUP_KMS_KEY_ID=arn:aws:kms:us-east-1:<acct>:key/<id>
APP_ROOT=/srv/wordle
EOF
sudo chmod 600 /etc/jjjordle-backup.env

# Install the systemd unit + timer.
sudo cp infra/aws/jjjordle-backup.service /etc/systemd/system/
sudo cp infra/aws/jjjordle-backup.timer   /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now jjjordle-backup.timer

# Smoke test: run it once and confirm a bundle lands in S3.
sudo systemctl start jjjordle-backup.service
journalctl -u jjjordle-backup.service --no-pager | tail -20
aws s3 ls s3://jjjordle-backups-<suffix>/daily/
```

You should see today's timestamp directory containing `bundle.tgz` and
`bundle.tgz.sha256`.

## 6. Monitoring

Two CloudWatch alarms catch silent failures:

1. **No backup uploaded in the last 26 hours.** Create a CloudWatch alarm on
   S3 `NumberOfObjects` for the `daily/` prefix, threshold `< 1 change in 26
   hours`.
2. **DLM snapshot failed.** EventBridge rule on `aws.dlm` →
   `DLM Policy Action Failed` → SNS topic.

Both subscribe to the same SNS topic from
[01-account-setup.md](./01-account-setup.md).

---

## Testing schedule

A backup you haven't restored isn't a backup. Put these on your calendar:

| Cadence | Drill | Time |
|---|---|---|
| Monthly | Pull last night's bundle, verify SHA256, list contents. | ~2 min |
| Quarterly | Full restore drill on a throwaway local machine. | ~15 min |
| Annually | Full DR drill — second EC2 from snapshot, test subdomain. | ~45 min |

The quarterly drill runbook is in [04-restore.md](./04-restore.md) Scenario D.

---

## Verify

- [ ] Bucket exists, versioned, with lifecycle rule.
- [ ] KMS key alias `jjjordle-backups` exists.
- [ ] `jjjordle-ec2-role` has the inline S3 + KMS policy.
- [ ] `sudo systemctl list-timers jjjordle-backup.timer` shows next run.
- [ ] At least one bundle is visible in S3.
- [ ] At least one EBS snapshot is visible after the next 04:00 UTC fire.
- [ ] Both CloudWatch alarms are in `OK` state.

## Cost

| Item | Monthly |
|---|---|
| EBS snapshots (7+4 retained, ~20 GB, low churn) | ~$0.20 |
| S3 backup bucket (< 1 MB hot + Glacier tiers) | ~$0.01 |
| KMS customer-managed key | $1.00 |
| CloudWatch alarms + SNS | ~$0.20 |
| **Total** | **~$1.50 / month** |

## Next

[04-restore.md](./04-restore.md) — restore procedures for when something
actually goes wrong.
