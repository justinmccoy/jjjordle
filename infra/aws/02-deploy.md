# 02 — Deploy the app to EC2

**When to use this:** Once, after [01-account-setup.md](./01-account-setup.md),
to spin up the production host. Re-read on subsequent rebuilds.

**Estimated time:** ~60 minutes (plus DNS propagation).

**Outcome:** A single `t4g.small` EC2 instance running nginx (reverse proxy)
+ PM2 (Node process manager) + the pre-built React client, reachable at
your domain, accessible without exposing port 22.

---

## Prerequisites

- [01-account-setup.md](./01-account-setup.md) is done.
- You own the domain and can edit its DNS.
- You're signed in via IAM Identity Center.
- AWS CLI installed locally (optional, but useful for SSM):
  <https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html>
- Session Manager plugin installed locally (only if you want CLI access to the
  instance via the terminal, not just the browser shell):
  <https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-working-with-install-plugin.html>
- GitHub access for cloning the repo onto the EC2 box. If the repo is
  **public**, nothing else is needed. If **private**, follow the deploy-key
  steps in section 6.1.

## 1. Networking

### 1.1 Use the default VPC

VPC → Your VPCs → confirm one is marked **Default**. Don't create a custom
VPC for this — it adds complexity for no benefit at this scale.

### 1.2 Create the security group

EC2 → Security Groups → Create security group:

- Name: `jjjordle-web`
- VPC: default
- Inbound rules — only these two:

  | Type  | Protocol | Port | Source        | Reason                         |
  |-------|----------|------|---------------|--------------------------------|
  | HTTP  | TCP      | 80   | `0.0.0.0/0`   | Site traffic (TLS via Certbot) |
  | HTTPS | TCP      | 443  | `0.0.0.0/0`   | The actual site                |

  **No port 22.** SSM Session Manager is the access path.

- Outbound: leave the default "all traffic" rule.

### 1.3 Allocate an Elastic IP

EC2 → Elastic IPs → Allocate. Note the address (e.g. `54.x.x.x`).

> ⚠️ An *unattached* EIP costs ~$3.60/mo. Attach it to the instance immediately
> after launch (step 3.3) and the cost goes to zero.

## 2. IAM role for the instance

IAM → Roles → Create role → AWS service → EC2:

1. Attach the AWS managed policy: `AmazonSSMManagedInstanceCore`
   (lets you connect via Session Manager).
2. Name the role: `jjjordle-ec2-role`.

We'll attach the S3-backup policy later in [03-backup.md](./03-backup.md).

## 3. Launch the instance

EC2 → Instances → Launch instances:

1. **Name:** `jjjordle-web`
2. **AMI:** Amazon Linux 2023, **64-bit (Arm)** variant.
3. **Instance type:** `t4g.small`.
4. **Key pair:** "Proceed without a key pair" — we're using SSM.
5. **Network settings:**
   - VPC: default
   - Auto-assign public IP: **Disable** (we use the EIP)
   - Firewall: existing security group → `jjjordle-web`
6. **Storage:** 20 GB gp3, **Encrypt this volume** ✅ (default `aws/ebs` KMS
   key is free), Delete on termination ✅.
7. **Advanced details:**
   - IAM instance profile: `jjjordle-ec2-role`
   - User data: paste the contents of [`user-data.sh`](./user-data.sh).
8. **Tags:** add `Backup=daily` (so the snapshot policy in
   [03-backup.md](./03-backup.md) picks up the volume).
9. Launch.

### 3.3 Attach the Elastic IP

EC2 → Elastic IPs → select yours → **Actions → Associate** → pick the new
instance.

## 4. First connection via SSM

EC2 → Instances → select the instance → **Connect** → **Session Manager** tab
→ Connect.

A browser shell opens, logged in as `ssm-user`. Switch to the normal user:

```sh
sudo su - ec2-user
node --version    # confirms user-data finished
nginx -v
pm2 --version
```

If Session Manager says "not available," wait 60 seconds for the SSM agent to
register and refresh.

## 5. DNS

### Option A — Keep DNS at your current registrar (recommended)

Wherever your DNS lives now (Cloudflare, Namecheap, …):

1. Add an `A` record: `<yourdomain>` → `54.x.x.x` (your EIP).
2. Optionally add a `CNAME` for `www.<yourdomain>` → `<yourdomain>`.
3. From your laptop: `dig <yourdomain>` should return the EIP within a few
   minutes.

### Option B — Move DNS to Route 53

Costs $0.50/mo for the hosted zone. Skip unless you want the integration.

## 6. Deploy the app

### 6.1 Add a deploy key (private repo only)

If the GitHub repo is **public**, skip this section — `git clone` over HTTPS
needs no auth. If it's **private**, generate a read-only deploy key on the box:

In the SSM session as `ec2-user`:

```sh
ssh-keygen -t ed25519 -f ~/.ssh/github-jjjordle -C "ec2-jjjordle-deploy" -N ""

cat >> ~/.ssh/config <<'EOF'
Host github.com
  HostName github.com
  User git
  IdentityFile ~/.ssh/github-jjjordle
  IdentitiesOnly yes
EOF
chmod 600 ~/.ssh/config

cat ~/.ssh/github-jjjordle.pub
```

Add the public key to your GitHub repo: **Settings → Deploy keys → Add deploy
key**. Leave "Allow write access" **unchecked**. Then verify:

```sh
ssh -T git@github.com
# Expected: "Hi …! You've successfully authenticated…"
```

### 6.2 Clone and set up the app

In the SSM session as `ec2-user`:

```sh
sudo mkdir -p /srv/wordle
sudo chown ec2-user:ec2-user /srv/wordle
cd /srv/wordle

# Clone (use SSH URL if private repo, HTTPS if public):
git clone git@github.com:<you>/jjjordle.git .
# or: git clone https://github.com/<you>/jjjordle.git .

# Create the env file and fill it in.
cp server/.env.example server/.env
nano server/.env     # set WORDLE_ANSWER, WORDLE_SENTENCE, etc.

# Install server dependencies.
npm install --prefix server --omit=dev

# Build the React client.
npm install --prefix client
npm run build --prefix client
```

### 6.3 Configure nginx

```sh
sudo cp /srv/wordle/nginx.conf /etc/nginx/conf.d/wordle.conf
sudo nginx -t         # test the config
sudo systemctl enable nginx
sudo systemctl start nginx
```

If you have a domain with HTTPS, install Certbot and obtain a certificate:

```sh
sudo dnf install -y certbot python3-certbot-nginx
sudo certbot --nginx -d <yourdomain>
# Follow the prompts; Certbot will edit your nginx config automatically.
```

### 6.4 Start the Node server with PM2

```sh
cd /srv/wordle
pm2 start ecosystem.config.json
pm2 save            # persist the process list across reboots
```

Verify PM2 picks it up on boot:

```sh
# The startup command was already run by user-data.sh.
# Confirm the service is enabled:
sudo systemctl status pm2-ec2-user
```

---

## Verify

- [ ] `http://<yourdomain>` or `http://<EIP>` loads the Wordle game.
- [ ] `https://<yourdomain>` loads with a valid cert (if Certbot was run).
- [ ] `pm2 list` shows the `wordle` process as `online`.
- [ ] `sudo systemctl status nginx` is `active (running)`.
- [ ] `/api/guess` responds (try a guess in the game UI).
- [ ] Security group has **no port 22 rule**.
- [ ] You're signed in via Identity Center, not root.

## Next

[03-backup.md](./03-backup.md) — set up automated backups.
