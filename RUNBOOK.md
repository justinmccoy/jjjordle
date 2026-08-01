# jjjordle Runbook

Master index of every operational procedure for this project. Each phase is
its own file under [`infra/aws/`](./infra/aws/) so you can follow it on a
phone, on a tablet, or printed out at 3 AM when the laptop is somewhere else.

Read this file top-to-bottom the first time. After that, jump straight to
the runbook that matches what you need to do.

---

## Choose your situation

| I want to… | Open |
|---|---|
| Set up AWS for the first time | [01 — Account setup](./infra/aws/01-account-setup.md) |
| Spin up the production host | [02 — Deploy](./infra/aws/02-deploy.md) |
| Configure backups | [03 — Backup](./infra/aws/03-backup.md) |
| Restore from a backup (or run a drill) | [04 — Restore](./infra/aws/04-restore.md) |
| Do a routine ops task on the running site | [05 — Operations](./infra/aws/05-operations.md) |

---

## The plan in one paragraph

A single `t4g.small` EC2 instance in `us-east-1` runs Caddy (reverse proxy +
automatic HTTPS via Let's Encrypt) and the Node.js/Express server managed by
PM2. The pre-built React client is served as static files from `client/dist/`
by Caddy; all `/api/` requests are proxied to the Node process on port 3001.
DNS points at an Elastic IP. Access is via SSM Session Manager — port 22 is
closed. Backups run in two independent layers: daily EBS snapshots (fast
restore) and nightly logical bundles to an S3 bucket (`.env` + built client,
KMS-encrypted, lifecycled to Glacier). Expected total cost: ~$14–15 / month.

## What this plan is, and isn't

**This plan optimizes for:** lowest cost, smallest amount of AWS to learn,
easy escape hatch to another host, no unnecessary complexity.

**This plan does NOT include:** load balancer, CDN, multi-AZ, WAF, staging
environment, CI/CD, autoscaling. Each is a deliberate "later" that can be
added without re-architecting.

---

## File map

```
RUNBOOK.md                              this file — start here
Caddyfile                               Caddy config (auto-HTTPS + reverse proxy)
Makefile                                dev, build, and deploy shortcuts
infra/
  backup.sh                             nightly bundler (.env + client/dist -> S3)
  aws/
    01-account-setup.md                 root lockdown, billing alarms, Identity Center
    02-deploy.md                        VPC, EC2, EIP, Caddy, PM2, DNS, app bring-up
    03-backup.md                        S3 bucket, KMS, DLM snapshots, systemd timer
    04-restore.md                       Scenarios A-C (lost .env / full instance / drill)
    05-operations.md                    deploy, patch, resize, monitor cheatsheet
    user-data.sh                        EC2 first-boot bootstrap (Node + nginx + PM2)
    jjjordle-backup.service             systemd unit that runs infra/backup.sh
    jjjordle-backup.timer               systemd timer (nightly at 03:30 UTC)
    iam-policies/
      ec2-trust.json                    trust policy for the EC2 role
      ec2-s3-backup.json                inline policy for S3 + KMS backup writes
```

## First-time setup order

1. [01-account-setup.md](./infra/aws/01-account-setup.md) — ~45 min, one-time.
2. [02-deploy.md](./infra/aws/02-deploy.md) — ~60 min plus DNS propagation.
3. [03-backup.md](./infra/aws/03-backup.md) — ~30 min.
4. [04-restore.md](./infra/aws/04-restore.md) Scenario C — run a drill the
   first weekend after going live.

After that, you only re-open these when something happens.

## Recurring calendar items

Put these on a real calendar — not just memory.

| Cadence | Action | Time | Runbook |
|---|---|---|---|
| Monthly | Verify last night's backup bundle exists + checksum matches | 2 min | [04-restore.md](./infra/aws/04-restore.md) |
| Quarterly | Full restore drill on a throwaway local machine | 15 min | [04-restore.md Scenario C](./infra/aws/04-restore.md#scenario-c--quarterly-restore-drill-no-real-outage) |
| Annually | Full DR drill — second EC2 from snapshot, test subdomain | 45 min | [04-restore.md Scenario B.1](./infra/aws/04-restore.md#b1--fast-path-restore-from-ebs-snapshot-10-min) |
| Annually | Rotate `WORDLE_ANSWER` if needed | 2 min | [05-operations.md](./infra/aws/05-operations.md#change-the-wordle-answer-or-config) |

## When something is on fire

1. **Don't panic. Don't `git push --force` anything.**
2. Identify the symptom: open [05-operations.md](./infra/aws/05-operations.md#monitoring-cheatsheet) → "Monitoring cheatsheet."
3. If `.env` is corrupted or missing: [04-restore.md Scenario A](./infra/aws/04-restore.md#scenario-a--env-corrupted-or-lost).
4. If the instance is unreachable: try a reboot first (EC2 → Instance state →
   Reboot). If that fails, [04-restore.md Scenario B](./infra/aws/04-restore.md#scenario-b--whole-instance-is-gone).

## Cost recap

| Item | Monthly |
|---|---|
| EC2 `t4g.small` | ~$12.00 |
| EBS 20 GB gp3 | ~$1.60 |
| Elastic IP (while attached) | $0 |
| Data transfer out (~5 GB) | ~$0.45 |
| Backups (EBS snapshots + S3 + KMS + alarms) | ~$1.50 |
| Route 53 hosted zone (only if you moved DNS to AWS) | $0.50 |
| **Total** | **~$14–$15 / month** |

## Conventions used in every runbook

- Replace `<placeholder>` with the real value.
- Replace `jjjordle-backups-<suffix>` with your actual S3 bucket name.
- Replace `i-xxxxxxx` with your actual EC2 instance ID.
- All times in runbooks are UTC.
- `$ ` is a host shell prompt; `# ` is root.
- Commands assume Amazon Linux 2023 on arm64.
