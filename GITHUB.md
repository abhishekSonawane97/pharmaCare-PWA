# Pushing this project to GitHub

Pick **one** of the two methods below.

---

## Method A — git CLI (recommended, 2 minutes)

This is what works for the long term. Set it up once and every future change is `git add . && git commit && git push`.

### A1. Create the empty repo on GitHub
1. <https://github.com/new>
2. Name: `pharmacare` (or anything you like)
3. **Private** is recommended for client work
4. **Do NOT** check "Add a README", "Add .gitignore", or "Add a license" — we already have those, checking them creates a merge conflict on first push
5. **Create repository**
6. The next page shows a URL like `https://github.com/<your-username>/pharmacare.git` — copy it

### A2. Push from your machine
From the project root (`/home/abhishek/Desktop/a`):

```bash
# (skip if a previous attempt already initialized git)
git init
git add -A

# first commit
git commit -m "Initial commit: PharmaCare v1.0 (Atlas + Render-ready)"

# point at your new GitHub repo and push
git branch -M main
git remote add origin <PASTE_YOUR_REPO_URL_HERE>
git push -u origin main
```

You'll be prompted for credentials. **Use a Personal Access Token, not your password** (GitHub doesn't accept passwords for git anymore):
1. <https://github.com/settings/tokens/new> → "classic" token
2. Note: `pharmacare-deploy`
3. Expiration: 90 days (or longer)
4. Scopes: tick **repo** (top-level)
5. Generate, copy, paste when git asks for "Password"

### A3. Future updates
```bash
git add -A
git commit -m "describe what changed"
git push
```

---

## Method B — Drag-and-drop (no terminal, easier first time)

Use this if you'd rather not deal with git CLI.

### B1. Create the repo (same as A1)

### B2. Upload the folder
1. On your new repo's empty page, click **uploading an existing file** in the suggested commands box (or **Add file → Upload files**)
2. **Drag the contents of `/home/abhishek/Desktop/a` into the browser** — DO NOT drag the folder itself, drag what's inside it. Otherwise the repo will have a single nested folder
3. ⚠️ **Stop before clicking commit.** Verify these files are NOT in the upload preview:
   - `.env`        ← real secrets
   - `backup-2026-05-05.gz`        ← database dump
   - any `node_modules/`           ← dependencies, huge
   - any `.next/` or `dist/`       ← build output
4. If any of those appear, remove them from the upload before committing
5. Commit message: `Initial commit: PharmaCare v1.0`
6. Click **Commit changes**

### B3. Future updates
You'd repeat the drag-and-drop for each change. **This is painful** — at some point you'll want to switch to Method A. The git CLI is far less work after the one-time setup.

---

## ⚠️ Critical: do NOT upload these files

Both methods exclude these via `.gitignore`, but double-check before committing:

| File / folder | Why excluded |
|---|---|
| `.env` | Real Atlas password and JWT secrets |
| `backup-2026-05-05.gz` | Database dump with user data |
| `node_modules/` | Dependencies — installed at build time |
| `.next/` `dist/` | Build artifacts |
| `*.log` | Runtime logs |

The `.env.example` file IS uploaded (and should be) — it has placeholder values, not real ones.

---

## After pushing

Open [DEPLOY.md](DEPLOY.md) for the Render deployment walkthrough — it picks up where this guide ends.
