# 01 — AWS account setup

**When to use this:** Once, before anything else. Skip any step you've already done.

**Estimated time:** ~45 minutes.

**Outcome:** A locked-down AWS account with billing alarms, a non-root admin
identity, and a chosen home region. After this, you can launch infrastructure
without using the root user.

---

## Prerequisites

- A working email address you can receive at, ideally an alias you don't
  reuse elsewhere (e.g. `aws-root+jjjordle@yourdomain.com`)
- A credit card (AWS will pre-authorize $1 and refund it)
- An authenticator app (1Password, Authy, etc.) for MFA

## 1. Create the account

1. Go to <https://aws.amazon.com> → "Create an AWS account"
2. Use the root email alias above. Treat this email like a master key.
3. Set a long random password and save it in your password manager.
4. Choose **Basic Support** (free).

## 2. Lock down the root user

The root user can do anything, including delete the account. After this step
you never sign in as root again.

1. Sign in at <https://console.aws.amazon.com>.
2. Top-right → account name → **Security credentials**.
3. **Multi-factor authentication (MFA)** → Assign MFA device → authenticator
   app. Save the recovery codes.
4. Confirm there are **no access keys** for the root user. Delete any that
   exist.

## 3. Billing alarms

A misconfigured anything can ring up surprising bills overnight. Catch it.

1. Top-right → **Billing and Cost Management** → **Billing preferences** →
   enable "Receive Free Tier usage alerts" and "Receive billing alerts".
2. **CloudWatch** → Alarms → Create alarm:
   - Metric: Billing → Total Estimated Charge → USD
   - Threshold: $10 (create a second at $25 and a third at $50)
   - Action: Create an SNS topic, subscribe your email.
3. Confirm the SNS subscription email AWS sends you.

If an alarm fires unexpectedly in week one, **something is wrong** — investigate
before it becomes a $1000 bill.

## 4. Create an IAM Identity Center user

Modern, free, single-user-friendly. Replaces the old "create an IAM user with
access keys" pattern.

1. Search **IAM Identity Center** → Enable.
2. When prompted, choose **Enable with AWS Organizations** (free).
3. Identity source: **Identity Center directory** (default).
4. **Users** → Add user → your real email.
5. **Groups** → create `Administrators`, add yourself.
6. **Permission sets** → create one called `AdministratorAccess` from the AWS
   managed policy of the same name.
7. **AWS accounts** → select your account → **Assign users** → assign yourself
   with the `AdministratorAccess` permission set.
8. You'll get a sign-in URL like `https://d-xxxxxxx.awsapps.com/start`.
   Bookmark it. **From now on, sign in here, not the root URL.**

Sign out as root. Sign in via Identity Center. Verify you can open the
EC2 console.

## 5. Pick a region and stick to it

Top-right region selector:

- **`us-east-1` (N. Virginia)** — recommended (cheapest, default for new
  services)
- `us-west-2` (Oregon) — also cheap, lower west-coast latency

Every other runbook assumes `us-east-1`. If you pick differently, keep the
selector consistent across sessions.

---

## Verify

- [ ] You can sign in via the Identity Center URL.
- [ ] Root user has MFA and no access keys.
- [ ] A test email from SNS arrived (subscription confirmation).
- [ ] The region selector matches what the next runbook assumes.

## Next

[02-deploy.md](./02-deploy.md) — launch the EC2 instance and deploy the app.
