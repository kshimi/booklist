# Booklist

## Project Overview

Personal book catalog system. Parses metadata from ~1,900 Google Drive PDF filenames, generates a normalized book catalog (`data/books.json`), and provides a static React SPA for searching, filtering, and browsing 819 unique books.

### Tech Stack

| Category | Technology |
|----------|-----------|
| Frontend | React (SPA) + Vite |
| Styling | Tailwind CSS |
| Data | JSON (`data/books.json`) |
| Data Processing | Node.js scripts |
| Infrastructure | Static hosting (no backend server) |

## Coding Standards

<!-- Customize per project -->

- Use function components with props destructuring
- Follow project naming conventions
- Keep components focused and single-responsibility

### File Naming

| Type | Convention | Example |
|------|-----------|---------|
| Components | PascalCase | `UserProfile.tsx` |
| Utilities | camelCase | `formatDate.ts` |
| Hooks | camelCase with `use` prefix | `useAuth.ts` |
| Pages | PascalCase | `Dashboard.tsx` |

## Development Environment

### Commands

```bash
# Install dependencies
npm install

# Generate books.json from CSV (data processing pipeline)
node scripts/process.js

# Generate AI recommendation comments for daily suggestion
# Always use the shell wrapper: it injects GEMINI_API_KEY from 1Password via `op run`.
bash scripts/generate-ai-comments.sh              # diff mode: ungenerated books only
bash scripts/generate-ai-comments.sh --days 30    # prioritize next 30 days' featured books
bash scripts/generate-ai-comments.sh --all        # regenerate all books

# Start development server
npm run dev

# Run tests
npm test

# Run linter
npm run lint

# Build for production
npm run build
```

### Important Notes

- Input data: `data/booklist.csv` (exported from Google Drive via Google Apps Script)
- Generated catalog: `data/books.json` (do not edit manually; regenerate via `process.js`)
- AI comments: `data/book-ai-comments.json` (do not edit manually; regenerate via `generate-ai-comments.sh`)
- No backend server — all runtime logic runs in the browser
- `GEMINI_API_KEY` is required by `generate-ai-comments.js`, but never set it by hand: `.env` holds a
  1Password reference (`op://API/gemini_booklist/...`) and `scripts/generate-ai-comments.sh` resolves it
  via `op run`. Always invoke the `.sh` wrapper. See `docs/dev/gemini-api-setup.md`

## Project Workflow Settings

> スキルが参照する機械向け正本は `.claude/workflow.json`。下表は人間向け概要。

| Key | Value |
|-----|-------|
| Base branch | `master` |
| Dev command | `npm run dev` |
| Test command | `npm test` |
| Lint command | `npm run lint` |
| Build command | `npm run build` |
| Data update command | `op run --env-file=.env -- node scripts/process.js` |
| Generated files | `data/books.json`, `data/book-ai-comments.json` |
| Secrets vault | `API` |
| Secrets items | `gemini_booklist` |
| Secret injection | `wrapped` |
| Special notes | Manual bibliographic edits to `data/books.json` are tracked as Issue #48 |

## Document References

| Document | Path | Description |
|----------|------|-------------|
| Setup (Claude Code) | `docs/dev/setup.md` | Environment setup procedure |
| Architecture | `docs/app/architecture.md` | System architecture and books.json schema |
| Design Documents | `docs/app/design/` | Per-issue design documents |
| Functional Spec | `docs/app/spec/functional/` | Functional specifications |
| Requirements | `docs/requirements/` | Requirements definition |
