# 05 — Day-to-day operations

**When to use this:** Whenever you need to do a routine operational task on
the running deployment.

This is the cheat sheet — one command per row.

---

## Connect to the box

| Method | How |
|---|---|
| Browser | EC2 → Instances → select → **Connect** → **Session Manager** |
| Terminal | `aws ssm start-session --target i-xxxxxxx --region us-east-1` |

There is no SSH. Port 22 is closed on purpose.

After `Connect`, switch to the app user:

```sh
sudo su - ec2-user
cd /srv/wordle
```

## Deploy a code change

```sh
cd /srv/wordle
git pull
make deploy         # builds the React client and restarts the Node server
```

Use `make deploy-full` when you've added or changed npm dependencies.

## Tail logs

```sh
pm2 logs wordle             # Node server (live stream)
pm2 logs wordle --lines 100 # last 100 lines
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

## Restart the Node server

```sh
pm2 restart wordle
```

## Reload nginx (after config change)

```sh
sudo nginx -t          # test config first
sudo systemctl reload nginx
```

## Change the Wordle answer or config

```sh
nano /srv/wordle/server/.env
pm2 restart wordle     # picks up the new env immediately
```

## Rotate a secret

1. SSM in; edit `server/.env`.
2. `pm2 restart wordle`.

## Patch the OS

`dnf-automatic.timer` runs nightly (configured by `user-data.sh`). To check
recent activity:

```sh
sudo dnf history
journalctl -u dnf-automatic.timer
```

Reboot after kernel updates:

```sh
sudo reboot
# wait ~60s, reconnect via Session Manager
# PM2 will restart automatically (pm2 startup was set up in user-data.sh)
```

## Run a backup right now

```sh
sudo systemctl start jjjordle-backup.service
journalctl -u jjjordle-backup.service --no-pager | tail -20
```

## List recent backups

```sh
aws s3 ls s3://jjjordle-backups-<suffix>/daily/ | tail -20
```

## Check the next scheduled backup

```sh
systemctl list-timers jjjordle-backup.timer
```

## Look at EBS snapshots

EC2 → Snapshots → filter by your volume ID. Named by the DLM policy with
a timestamp.

## Check the TLS cert (if Certbot was used)

```sh
echo | openssl s_client -connect <yourdomain>:443 -servername <yourdomain> 2>/dev/null \
  | openssl x509 -noout -dates -issuer
```

Certbot auto-renews via a systemd timer. Verify it's active:

```sh
sudo systemctl status certbot.timer
```

## Resize the instance

When the box runs hot (CPU pegged):

1. EC2 → Instance → **Instance state → Stop**.
2. **Actions → Instance settings → Change instance type** → e.g. `t4g.medium`.
3. **Instance state → Start**.
4. The Elastic IP stays attached. PM2 restarts automatically.

Downtime: ~2 minutes.

## See what's using disk

```sh
df -h
du -sh /srv/wordle/client/dist
du -sh /srv/wordle/server/node_modules
```

## Restore from backup

See [04-restore.md](./04-restore.md).

## Decommission the deployment

If you're shutting it down for good:

1. Take a final snapshot of the EBS volume.
2. Take a final logical backup: `sudo systemctl start jjjordle-backup.service`.
3. Terminate the EC2 instance.
4. Release the Elastic IP (otherwise it costs ~$3.60/mo unattached).
5. Decide on bucket retention. If keeping: lifecycle to Deep Archive.
6. Delete the KMS key (7-day waiting period; you can cancel during the wait).

---

## Monitoring cheatsheet

| Symptom | First place to look |
|---|---|
| Site is down | CloudWatch instance status checks; EC2 → Instances → Status |
| 502 Bad Gateway | `pm2 logs wordle` — Node server likely crashed |
| Guesses not evaluated | `pm2 status` — check `wordle` is `online` |
| Cert expired warning | `sudo systemctl status certbot.timer` |
| Disk full | `df -h` |
| Backups missing | `journalctl -u jjjordle-backup.service` |
