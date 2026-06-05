# GitHub repo + CI/CD setup

> **Audience:** the engineer setting up GitHub access for the first time on a new machine, OR setting up a fresh repo. The current repo is already wired — see "Current state" below.

## Current state

| | |
|---|---|
| Repo | https://github.com/abhishekSonawane97/pharmacare |
| Default branch | `main` |
| CI/CD workflow | `.github/workflows/deploy.yml` — fires on push to `main` |
| Required secret | `AWS_DEPLOY_ROLE_ARN` = `arn:aws:iam::059567100086:role/pharmacare-gha-deploy` |
| Auth model | **GitHub OIDC** (no long-lived AWS keys in GitHub) |
| Trust pinned to | `repo:abhishekSonawane97/pharmacare:ref:refs/heads/main` only |

Every push to `main`:
1. GHA workflow assumes the AWS role via OIDC token exchange
2. Builds ARM64 images for `apps/api` and `apps/web`
3. Pushes both to ECR (private registry in `ap-south-1`)
4. SSMs into the EC2 instance and runs `docker compose pull && up -d`
5. Smoke-tests `http://<EIP>/api/health`

Total time: ~3 min cached, ~10 min cold. See [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) and [DEPLOY.md](DEPLOY.md) for the full breakdown.

---

## Day-to-day: pushing changes

```bash
git add -A
git commit -m "what changed"
git push origin main
```

That's it. GHA picks it up. Watch progress at https://github.com/abhishekSonawane97/pharmacare/actions.

---

## First-time access on a new machine

### 1. Clone

```bash
git clone git@github.com:abhishekSonawane97/pharmacare.git
cd pharmacare
```

For SSH to work, your machine's SSH public key (`~/.ssh/id_ed25519.pub` or `id_rsa.pub`) must be registered at https://github.com/settings/keys.

If you prefer HTTPS, use a Personal Access Token (PAT) when git asks for a password:
1. https://github.com/settings/tokens/new — classic token
2. Note: `pharmacare-deploy`
3. Expiration: 90 days
4. Scope: tick **repo** (top-level)
5. Generate, copy, paste when git asks for "Password"

### 2. Local dev

```bash
cp .env.example .env
# edit .env — fill in MONGO_URI, JWT_*_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD
make build && make up
```

See [README.md → Quick start](README.md#quick-start-local-dev-5-minutes).

---

## What lives in the repo vs what doesn't

### ✅ Committed
- All source code (`apps/api`, `apps/web`)
- Infrastructure: `infra/cloudformation.yaml`
- Production compose: `deploy/docker-compose.yml`, `deploy/nginx.conf`
- Local dev: `docker-compose.yml`, `Makefile`, `scripts/preflight.sh`
- CI/CD: `.github/workflows/deploy.yml`
- Template only: `scripts/seed-ssm.sh.template` (filled version is gitignored)
- `.env.example` (template with placeholders, no real secrets)

### ❌ Never committed (in `.gitignore`)
- `.env` (real Atlas password + JWT secrets)
- `scripts/seed-ssm.sh` (filled SSM seed script with secrets)
- `*.pem` (SSH keys)
- `*.log`, `node_modules/`, `.next/`, `dist/`
- `backup-*.gz`, `*.dump` (DB dumps)

Before any commit, double-check `git diff --cached` — accidentally committing `.env` is a multi-hour rotation exercise.

---

## CI/CD secrets

Only **one GitHub secret** exists, set at the repo level:

| Name | Value | Where to set |
|---|---|---|
| `AWS_DEPLOY_ROLE_ARN` | `arn:aws:iam::059567100086:role/pharmacare-gha-deploy` | https://github.com/abhishekSonawane97/pharmacare/settings/secrets/actions |

**Why only one?** All other AWS resources (ECR, EC2, SSM params) are accessed via the assumed role's IAM policy — no other keys/tokens needed. AWS itself authenticates GitHub via OIDC; secrets in the role's policy live in AWS, not GitHub.

### How OIDC works (one-paragraph summary)

GitHub Actions runtime mints a short-lived JWT signed by GitHub's OIDC provider. AWS IAM trusts that provider, validates the JWT's `sub` claim matches `repo:abhishekSonawane97/pharmacare:ref:refs/heads/main`, and returns temporary AWS credentials (valid for ~1 hour). The GHA workflow uses those credentials and they expire when the job ends. **No AWS keys ever sit in GitHub.**

If the workflow is run from any other branch or another fork, the `sub` claim won't match → role assumption fails → deploy fails → safe by default.

---

## Updating the GitHub secret

If the role ARN ever changes (e.g. after `cloudformation delete-stack + redeploy`):

1. Open https://github.com/abhishekSonawane97/pharmacare/settings/secrets/actions
2. Click the pencil icon next to `AWS_DEPLOY_ROLE_ARN`
3. Update the value
4. Save

Re-running the workflow then uses the new value.

---

## Branch strategy

Currently: **trunk-based**. `main` is the only long-lived branch. Feature work happens on short-lived branches that merge fast.

Why no `develop` / `staging`: single-engineer maintenance, no staging environment yet. If you add a staging environment later, you'd add a `staging` branch + a corresponding GHA workflow.

### Recommended branch naming

| Prefix | Example | Use for |
|---|---|---|
| `infra/` | `infra/aws-migration` | Infrastructure changes (CFN, GHA, Docker) |
| `feat/` | `feat/customer-loyalty-tiers` | New features |
| `fix/` | `fix/modal-overflow` | Bug fixes |
| `chore/` | `chore/bump-mongoose` | Dependency updates, tidying |
| `docs/` | `docs/runbook-refresh` | Documentation-only changes |

Merge to `main` via squash by default.

---

## What auto-deploys on push

Each push to `main` triggers **two** independent deploys:

| Platform | What it builds | How long |
|---|---|---|
| **AWS (GHA)** | ARM64 docker images, then `docker compose pull/up` on EC2 | 2–3 min cached / 8–10 min cold |
| **Render (Blueprint)** | Render rebuilds both `pharmacare-api` and `pharmacare-web` from source | 5–8 min |

Both write to the **same Atlas DB**, so changes are visible everywhere immediately once whichever rolls out first.

If you only want to deploy to AWS (not Render), the cleanest path is to **decommission Render** after the cutover stabilizes. See [PRODUCTION.md → Decommission Render](PRODUCTION.md#decommission-render).

---

## Recreating the GitHub secret from scratch

If this README is being read on a fresh repo / fork:

```bash
# Get the role ARN from a CFN stack output
aws cloudformation describe-stacks --stack-name pharmacare-prod \
  --query 'Stacks[0].Outputs[?OutputKey==`GhaDeployRoleArn`].OutputValue' \
  --output text

# Set it as the GitHub secret — either via UI:
#   https://github.com/<owner>/<repo>/settings/secrets/actions/new
#   Name: AWS_DEPLOY_ROLE_ARN
#   Value: <the ARN>

# Or via gh CLI (requires `gh auth login`):
gh secret set AWS_DEPLOY_ROLE_ARN --body "<the ARN>"
```

---

## Important: do NOT commit these files

`.gitignore` excludes them, but double-check before pushing:

| File / folder | Why excluded |
|---|---|
| `.env` | Real Atlas password and JWT secrets |
| `scripts/seed-ssm.sh` | Filled SSM seed script (contains secrets when filled) |
| `*.pem` | SSH private keys |
| `backup-*.gz`, `*.dump` | DB dumps with customer data |
| `node_modules/` | Dependencies — installed at build time |
| `.next/`, `dist/` | Build artifacts |
| `*.log` | Runtime logs |

The `.env.example` and `scripts/seed-ssm.sh.template` ARE committed (template files with placeholders, not real values).

---

## Where to read more

- **[README.md](README.md)** — project entry point
- **[ARCHITECTURE.md](ARCHITECTURE.md)** — the OIDC trust + IAM role details
- **[DEPLOY.md](DEPLOY.md)** — deployment runbook
- **[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)** — the workflow itself
- **[`infra/cloudformation.yaml`](infra/cloudformation.yaml)** — `GhaDeployRole` definition (search for `pharmacare-gha-deploy`)
