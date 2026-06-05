# Deployment runbook

> **Audience:** the engineer responsible for shipping changes. Two live environments are in play. The day-to-day deploy is `git push origin main` — everything else is one-off.

## At a glance

| Environment | Where | How a change reaches it | Latency to live |
|---|---|---|---|
| **AWS EC2 (PRIMARY)** | http://13.205.80.177 | `git push origin main` → GitHub Actions → ECR → SSM → `docker compose pull/up` on EC2 | ~3 min (cached build) / ~10 min (cold build) |
| **Render (parallel fallback)** | https://pharmacare-web.onrender.com | Same push — Render's Blueprint watcher rebuilds both services from the same `main` | ~5–8 min |
| **Local dev** | http://localhost:3000 | `make build && make up` from your laptop | ~30 s |

Both AWS and Render rebuild **on the same git push**. There is currently no way to deploy to one but not the other (until you decommission Render — see [PRODUCTION.md](PRODUCTION.md)).

---

## Deploy flow (text sketch)

```
   developer
       │ git push origin main
       ▼
   GitHub
       │
       ├──────────────────────────────────┬──────────────────────────────┐
       ▼                                  ▼                              ▼
   GHA workflow (deploy.yml)         Render Blueprint                    │
       │                                  │                              │
       │ OIDC → assume                    │ docker build (slower         │
       │   pharmacare-gha-deploy          │  containers, no cache         │
       │                                  │  across deploys)              │
       │ buildx linux/arm64               │                              │
       │   → push to ECR                  │ deploy both services         │
       │                                  │                              │
       │ resolve EC2 instance + IP        │                              │
       │                                  │                              │
       │ SSM SendCommand → EC2:           │                              │
       │   • write /opt/.../compose.yml   │                              │
       │   • write /opt/.../nginx.conf    │                              │
       │   • regenerate /opt/.../.env     │                              │
       │     from SSM Parameter Store     │                              │
       │   • docker compose pull          │                              │
       │   • docker compose up -d         │                              │
       │   • verify /api/health locally   │                              │
       │                                  │                              │
       │ smoke test from GHA runner       │                              │
       │   GET http://<EIP>/api/health    │                              │
       ▼                                  ▼                              │
   ✓ AWS live (commit pinned        ✓ Render live (commit pinned        │
     in image tag sha-XXX)            in container manifest)            │
                                                                         │
            Both connect to the same MongoDB Atlas cluster ◄─────────────┘
```

---

## Day-to-day: shipping a code change

1. Make your change locally; verify with `make build && make up` and exercise the affected page.
2. `git add` / `git commit` / `git push origin main`.
3. Two GHA-watchable URLs:
   - **AWS workflow**: https://github.com/abhishekSonawane97/pharmacare/actions (Deploy to EC2)
   - **Render dashboard**: https://dashboard.render.com (filter by `pharmacare-*`)
4. When the AWS workflow turns green, smoke-test http://13.205.80.177 manually.
5. Done. No further steps.

If the **GHA workflow fails** at any step, see [Troubleshooting](#troubleshooting) below. The previous deploy continues to run — failed deploys do not bring the site down.

---

## Manual redeploy (without a code push)

Useful after changing SSM env vars (e.g. updating `CORS_ORIGIN`) — the running container has the old value until restarted.

```bash
# From your machine, with AWS_PROFILE=pharmacare-boot set:
gh workflow run deploy.yml --ref main

# OR re-run the latest workflow:
gh run rerun $(gh run list --workflow=deploy.yml --limit=1 --json databaseId -q '.[0].databaseId')

# OR send the SSM deploy step directly (skips image rebuild):
aws ssm send-command --instance-ids i-0e4e1b0ced7aeb3cb \
  --document-name AWS-RunShellScript \
  --parameters 'commands=["cd /opt/pharmacare && docker compose restart"]' \
  --region ap-south-1
```

The first option (`gh workflow run`) is the only one that rebuilds images. The third option just restarts containers with whatever's already on disk.

---

## Rollback to a previous SHA

Every deploy tags images as `sha-<12-char-shortsha>` in ECR. Last 10 are retained (lifecycle rule).

```bash
# Find the SHA you want to roll back to
git log --oneline -10

# Re-run the workflow against that ref (no rebuild — uses cached image if same SHA)
gh workflow run deploy.yml --ref <commit-sha>

# OR SSH in and override IMAGE_TAG manually
ssh -i ~/.ssh/pharmacare-keypair.pem ubuntu@13.205.80.177
cd /opt/pharmacare
IMAGE_TAG=sha-<old> docker compose up -d
```

Rollback takes ~10 seconds (pull cached image + up -d). Atlas data is unaffected.

---

## First-time AWS deploy (already done, for reference)

If you ever need to rebuild from scratch:

### 1. Prep

```bash
# AWS account ready, IAM admin user `pharmacare-bootstrap` created, $100 credit applied
aws configure --profile pharmacare-boot
export AWS_PROFILE=pharmacare-boot

# EC2 key pair (skipped if reusing)
aws ec2 create-key-pair --key-name pharmacare-keypair \
  --query KeyMaterial --output text > ~/.ssh/pharmacare-keypair.pem
chmod 400 ~/.ssh/pharmacare-keypair.pem
```

### 2. Deploy infrastructure

```bash
aws cloudformation deploy \
  --stack-name pharmacare-prod \
  --template-file infra/cloudformation.yaml \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides KeyName=pharmacare-keypair SshCidr=<your-ip>/32 \
  --no-fail-on-empty-changeset
```

Reads stack outputs:

```bash
aws cloudformation describe-stacks --stack-name pharmacare-prod \
  --query 'Stacks[0].Outputs' --output table
```

Take note of `PublicIp`, `GhaDeployRoleArn`, `EcrApiUri`, `EcrWebUri`, `InstanceId`.

### 3. Seed SSM Parameter Store

```bash
cp scripts/seed-ssm.sh.template scripts/seed-ssm.sh
# Edit scripts/seed-ssm.sh — fill in MONGO_URI, JWT_*_SECRET (from local .env or fresh)
bash scripts/seed-ssm.sh
```

This populates 12 parameters under `/pharmacare/env/*`. The filled file is gitignored.

### 4. Update `CORS_ORIGIN` with the actual EIP

```bash
EIP=<from stack outputs>
aws ssm put-parameter --name /pharmacare/env/CORS_ORIGIN \
  --value "http://$EIP" --type String --overwrite --region ap-south-1
```

### 5. Set the GitHub secret

Open **https://github.com/abhishekSonawane97/pharmacare/settings/secrets/actions/new** (or use `gh secret set` if you have a PAT):

- Name: `AWS_DEPLOY_ROLE_ARN`
- Value: the `GhaDeployRoleArn` from stack outputs (e.g. `arn:aws:iam::059567100086:role/pharmacare-gha-deploy`)

### 6. Trigger the first deploy

```bash
# Either push any commit to main, or manually fire the workflow:
gh workflow run deploy.yml --ref main
gh run watch
```

First build is ~8–10 min (QEMU cold-start for ARM64 cross-build). Subsequent builds use GHA cache (~2–3 min).

### 7. Smoke-test

```bash
IP=<your-eip>
curl -fsS "http://$IP/api/health"                      # → {"status":"ok",...}
curl -fsS -o /dev/null -w "HTTP %{http_code}\n" "http://$IP/"  # → 200
curl -fsS -X POST "http://$IP/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"shaikhabusaeed1@gmail.com","password":"admin123"}'
```

### 8. (Optional but recommended) Bootstrap account cleanup

After first successful deploy:

```bash
# Delete the bootstrap IAM access key — all future deploys use OIDC
aws iam delete-access-key --user-name pharmacare-bootstrap \
  --access-key-id <key-id>
```

---

## Render parallel deployment (legacy, kept during cutover)

Render is wired up via [`render.yaml`](render.yaml) Blueprint. **No manual steps are required** — pushing to `main` triggers a Render rebuild automatically.

### How Render was set up (already done)
1. https://dashboard.render.com → **New +** → **Blueprint**
2. Connect GitHub → pick `pharmacare` repo
3. Render reads `render.yaml` → spins up `pharmacare-api` + `pharmacare-web`
4. Secret env vars (`MONGO_URI`, `ADMIN_PASSWORD`) set during setup

### To redeploy Render manually
1. https://dashboard.render.com → `pharmacare-api` (or `-web`) → **Manual Deploy** → **Deploy latest commit**

### To decommission Render (post-cutover)
See [PRODUCTION.md → Decommission Render](PRODUCTION.md#decommission-render).

---

## Local dev (no deploy involved)

```bash
cp .env.example .env
# edit .env — MONGO_URI, JWT_*_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD
make build
make up
make seed      # one-time, optional
```

See [README.md → Quick start](README.md#quick-start-local-dev-5-minutes) for details.

---

## Troubleshooting

### GHA workflow fails at "Send deploy command"

**Symptom**: step shows red ✗, error message about `ssm:SendCommand` denied.

**Cause**: IAM policy condition. The `aws:ResourceTag/Project=pharmacare` filter should apply only to the EC2 instance, not the AWS-managed `AWS-RunShellScript` document.

**Fix**: ensure [`infra/cloudformation.yaml`](infra/cloudformation.yaml) `GhaDeployRole` has the `ssm:SendCommand` statement **split into two**:
```yaml
- Effect: Allow
  Action: ssm:SendCommand
  Resource: arn:aws:ssm:ap-south-1::document/AWS-RunShellScript
- Effect: Allow
  Action: ssm:SendCommand
  Resource: arn:aws:ec2:ap-south-1:*:instance/*
  Condition:
    StringEquals: { aws:ResourceTag/Project: pharmacare }
```

If you deployed before this was fixed, redeploy CFN:
```bash
aws cloudformation deploy --stack-name pharmacare-prod --template-file infra/cloudformation.yaml --capabilities CAPABILITY_NAMED_IAM --parameter-overrides KeyName=pharmacare-keypair SshCidr=0.0.0.0/0
```

### GHA workflow fails at "Wait for SSM command to finish" with `Illegal option -o pipefail`

**Cause**: AWS-RunShellScript runs via `/bin/sh` = dash, which doesn't support bash's `set -o pipefail`.

**Fix**: in `.github/workflows/deploy.yml`, the SSM command list uses `set -eux` (no pipefail). The actual deploy logic lives in `/tmp/remote-deploy.sh` with `#!/usr/bin/env bash` so it retains bash semantics.

### EC2 health check fails after deploy

**Symptom**: GHA smoke test step never gets a 200 from `/api/health`.

**Likely causes**:
1. Container couldn't start — check `docker compose logs api` via SSM Session Manager
2. Mongoose can't reach Atlas — verify Atlas allowlist still has `0.0.0.0/0` OR the EIP `/32`
3. `.env` not regenerated correctly — check `cat /opt/pharmacare/.env | grep -v SECRET` on the box

```bash
# SSM session into the box (no SSH needed)
aws ssm start-session --target i-0e4e1b0ced7aeb3cb --region ap-south-1

# On the box:
cd /opt/pharmacare
docker compose ps
docker compose logs --tail=100 api
docker compose logs --tail=100 nginx
docker compose logs --tail=100 web
```

### Browser shows 502 from `http://<EIP>/`

**Cause (historical)**: Next.js standalone server defaults to binding `localhost` on some versions, so Render's edge router couldn't reach it.

**Fix already in `deploy/docker-compose.yml`**: the web container has `HOSTNAME=0.0.0.0` set so Next.js binds all interfaces. If you see this on AWS, check that `expose: ["3000"]` is in the compose and that `HOSTNAME` is exported to the web container.

### Atlas connection drops mid-deploy

**Cause**: Atlas M0 occasionally has 30-60s blips, especially under cold-start.

**Fix**: the api has `restart: unless-stopped` in compose, so Docker re-runs it on crash. After ~3 retries it should stick. Verify in `docker compose logs api`.

### "Permission denied" reading SSM parameters from the GHA runner

**Cause**: the OIDC trust policy on `pharmacare-gha-deploy` is ref-pinned to `repo:abhishekSonawane97/pharmacare:ref:refs/heads/main`. PRs and feature branches can't assume the role.

**Fix**: if you need to deploy from a branch, add another `StringLike` condition in the trust policy. **Do not loosen this for PRs from forks** — any contributor's PR could then assume the role.

### Render deploy succeeds but AWS workflow fails (or vice versa)

They're independent. Whichever side is broken: read its logs.
- Render: dashboard → service → Logs tab
- AWS: GHA run summary → click failed step

Both deployments use the same Atlas, so a Mongo issue affects both equally.

---

## Important note about `make seed`

**`make seed` is destructive.** It wipes all collections in Atlas and reinserts sample data. Since AWS and Render share the same Atlas, **running `make seed` locally wipes production data too**.

Before running:
1. If real customer data exists, take a `mongodump` first (see [README.md → Backup](README.md#backup--restore)).
2. Confirm you really want to reset the DB.

Pre-production checklist item: add backups before allowing `make seed` near production data. See [PRODUCTION.md → Backups](PRODUCTION.md#backups).
