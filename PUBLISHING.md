# Publishing & Consuming `@codevuk/route-ink`

This package is published to GitHub Packages as a private package under the `@codevuk` scope. This doc covers everything needed to publish a new version and to consume it from another repo (locally and in CI).

---

## 1. Prep your GitHub account (one-time)

1. **Email privacy.** GitHub → Settings → Emails → enable **"Keep my email addresses private"**. Note the `<id>+codevuk@users.noreply.github.com` alias shown — that's what will appear as the maintainer email on the published package.
2. **Personal access token.** GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic) → **Generate new token**:
   - Scopes: `write:packages`, `read:packages`, `delete:packages` (last one optional — lets you unpublish).
   - Name it `route-ink publish` (or similar).
   - Copy the token immediately — it cannot be viewed again.

---

## 2. Publish from this repo

### One-time setup

This repo ships a gitignored `.npmrc` at the root. Open it and replace the placeholder with the PAT from step 1:

```
; .npmrc
//npm.pkg.github.com/:_authToken=ghp_yourPublishTokenHere
```

The file is in `.gitignore`, so the token never leaves your machine. The registry itself is set via `publishConfig` in `package.json`, so this is the only line you need.

### Per-release

```bash
pnpm version patch       # or `minor` / `major`
pnpm publish             # runs prepublishOnly -> builds -> publishes
```

Verify the release at: <https://github.com/codevuk/route-ink/packages>

---

## 3. Consume from a monorepo

### 3a. Add `.npmrc` to the monorepo root

Commit this file:

```
@codevuk:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```

### 3b. Set `NODE_AUTH_TOKEN` locally

Use a separate PAT with **only `read:packages`** scope (different from the publish token).

In `~/.zshrc` (or `.bashrc`):

```bash
export NODE_AUTH_TOKEN=ghp_yourtokenhere
```

Reload: `source ~/.zshrc`.

### 3c. Install the package

```bash
pnpm --filter db add -D @codevuk/route-ink
```

(adjust `--filter db` to the actual package that owns your `schema.prisma`)

### 3d. Configure `schema.prisma`

The bin name is unscoped, so the `provider` value stays the same:

```prisma
generator zod {
  provider       = "route-ink-prisma-generator"
  output         = "./generated"
  modelOutputDir = "../../../schemas/src/zod/models"
  enumOutputDir  = "../../../schemas/src/zod/enums"
}
```

### 3e. Run the generator

```bash
pnpm --filter db exec prisma generate
```

---

## 4. CI/CD (GitHub Actions)

```yaml
name: generate

permissions:
  packages: read              # required for GITHUB_TOKEN to read packages

jobs:
  generate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          registry-url: https://npm.pkg.github.com
      - run: pnpm install
        env:
          NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      - run: pnpm --filter db exec prisma generate
```

The built-in `secrets.GITHUB_TOKEN` carries `read:packages` permission when `permissions.packages: read` is set in the workflow — no extra PAT needs to be stored as a secret.

### Non-GitHub CI providers

Vercel, CircleCI, Render, etc. don't have a built-in `GITHUB_TOKEN`. Create a dedicated PAT with `read:packages` and store it as a CI secret named `NODE_AUTH_TOKEN`.

---

## 5. Common gotchas

| Symptom | Cause | Fix |
|---|---|---|
| `npm ERR! 403 Forbidden` at publish | PAT is missing `write:packages` | Regenerate PAT with correct scope |
| `npm ERR! 401 Unauthorized` at install | `NODE_AUTH_TOKEN` not set or lacks `read:packages` | Verify env var, check PAT scopes |
| CI install auth fails even with `GITHUB_TOKEN` | Workflow missing `permissions.packages: read` | Add the permissions block |
| Stale version returned from cache | pnpm cached a previous version | `pnpm store prune` or bump patch version |
| Classic PAT expired | Default lifetime is 90 days | Rotate locally; CI `GITHUB_TOKEN` doesn't expire |

---

## 6. Tarball contents (what actually gets published)

Controlled by the `files` field in `package.json`. Currently only:

- `dist/` (built JS + d.ts + templates)
- `README.md`
- `package.json`

The `src/`, tests, configs, and any source maps are **not** published. Verify before any release:

```bash
npm pack --dry-run
```
