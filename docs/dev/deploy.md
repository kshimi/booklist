# Deployment Guide (GitHub Pages)

This document defines the procedure for deploying the booklist SPA to GitHub Pages.
Referenced from `deploy_user_guidance.md` for user-facing instructions.

## Target URL

```
https://kshimi.github.io/booklist/
```

## One-Time Setup

### 1. Add Vite base option

Add `base: '/booklist/'` to `vite.config.mjs` so that asset paths are correctly resolved
under the `/booklist/` subpath:

```js
export default defineConfig({
  base: '/booklist/',
  plugins: [react(), serveDataPlugin()],
  publicDir: false,
});
```

> `fetch('./data/books.json')` uses a relative URL and resolves correctly without changes.

### 2. Create GitHub Actions workflow

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [master]
  workflow_dispatch:

permissions:
  contents: read

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    permissions:
      pages: write
      id-token: write
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

### 3. Enable GitHub Pages in repository settings

1. Open the repository on GitHub
2. Go to **Settings > Pages**
3. Under **Source**, select **GitHub Actions**
4. Save

## Deployment Trigger

- Automatic: push to `master` branch
- Manual: **Actions** tab → **Deploy to GitHub Pages** → **Run workflow**

## Updating Book Data

When `data/books.json` is updated (after re-running `node scripts/process.js`),
commit and push to `master`. The workflow rebuilds and redeploys automatically.

## Verification

After deployment completes, open `https://kshimi.github.io/booklist/` and confirm:

- Book list loads
- Genre filter and search work
- Book detail page opens (check that Google Drive PDF links open)
- Statistics dashboard displays charts

## Notes

- The workflow does **not** run `node scripts/process.js`. Keep `data/books.json`
  committed in the repository so the build step can include it.
- `data/booklist.csv` is excluded from the build (only `books.json` is copied to `dist/`).
