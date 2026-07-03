# GitHub Setup

Run these once, from the repo root, to put Tulip on GitHub under `wpf002`.

## 1. Initialize and first commit

```bash
cd tulip
git init
git add .
git commit -m "chore: initial Tulip scaffold (monorepo, core engines, roadmap)"
git branch -M main
```

## 2. Create the remote

Option A — GitHub CLI (recommended):
```bash
gh repo create wpf002/tulip --private --source=. --remote=origin --push
```

Option B — manual:
```bash
# create an empty repo named "tulip" at github.com/new (no README/gitignore/license)
git remote add origin https://github.com/wpf002/tulip.git
git push -u origin main
```

## 3. Verify

```bash
git remote -v
git log --oneline -1
```

## 4. Branch-per-phase (matches CLAUDE.md)

```bash
git checkout -b phase-1-aggregation
# ...work, commit...
git push -u origin phase-1-aggregation
# open a PR, merge to main, repeat per phase
```
