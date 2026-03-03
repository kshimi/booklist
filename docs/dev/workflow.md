# Development Workflow

This document defines Claude Code's behavior during development.
Referenced from `CLAUDE.md` as the governing workflow specification.

## Role Division

| Role | Owner | Responsibilities |
|------|-------|-----------------|
| Task Direction & Review | Developer (User) | Issue creation, design review, code review, merge decision |
| Design & Implementation | Claude Code | Design docs, spec updates, coding, testing, commits, PR creation |

## Workflow Overview

```
Issue Creation (Developer)
  │
  ▼
Design Instruction (Developer → Claude Code: design-doc skill)
  │
  ▼
Design Document Creation (Claude Code → docs/app/design/<NNN>-<desc>.md)
  │
  ▼
Design Review & Approval (Developer)
  │  ← Return to design if revisions needed
  ▼
Specification Update (Claude Code: design-doc skill continues → docs/app/spec/)
  │
  ▼
Implementation Instruction (Developer → Claude Code: implement skill)
  │
  ▼
Branch Creation + Implementation + Testing (Claude Code)
  │
  ▼
Commit + PR Creation (Claude Code: commit skill)
  │
  ▼
Review (Developer, optionally Claude Code: review skill → PR comment)
  │  ← Return to implementation if revisions needed
  ▼
Merge + Issue Close (Developer)
  │
  ▼
Branch Deletion (Developer confirms)
```

## Detailed Steps

### Step 1: Issue Confirmation

When the developer provides an issue number:

1. Read the issue: `gh issue view <number>`
2. Understand requirements, acceptance criteria, and scope
3. Check for related issues or dependencies

### Step 2: Design Document Creation (design-doc skill)

1. Analyze the issue requirements
2. Explore the existing codebase for relevant architecture
3. Read existing specifications in `docs/app/spec/`
4. Create design document at `docs/app/design/<NNN>-<description>.md`
   - Use 3-digit sequential numbering
   - Write in Japanese (user review target)
5. Commit the design document
6. Post link on the GitHub Issue: `gh issue comment <number> --body "..."`
7. Wait for developer approval before proceeding

### Step 3: Specification Update (after design approval)

1. Update `docs/app/spec/functional/` with functional specification changes
2. Update `docs/app/spec/system/` with system specification changes
3. Reflect design decisions as system-wide specifications
4. Commit the specification updates

### Step 4: Implementation (implement skill)

1. Create a feature branch: `<type>/<issue-number>-<description>`
2. Implement changes based on design document and specifications
3. Write or update tests
4. Run all tests inside Docker:
   ```
   docker compose exec <service> npm test
   ```
5. Ensure all tests pass

### Step 5: Commit & PR (commit skill)

1. Stage changes: `git add <files>`
2. Commit with convention: `<type>: <description> (#<issue-number>)`
3. Push branch: `git push -u origin <branch>`
4. Create PR: `gh pr create ...`
   - Reference the issue
   - Use PR template structure

### Step 6: Review Response

If the developer requests changes after review:

1. Read review comments
2. Make requested changes
3. Run tests again
4. Commit fixes with descriptive message
5. Push updates

## Branch Strategy

### Naming Convention

`<type>/<issue-number>-<short-description>`

| Type | Usage | Example |
|------|-------|---------|
| feature | New feature | `feature/12-user-auth` |
| fix | Bug fix | `fix/15-date-offset` |
| docs | Documentation | `docs/18-api-reference` |
| refactor | Refactoring | `refactor/20-component-split` |

### Rules

- Always branch from `main`
- One branch per issue
- Delete branch after merge (developer confirms)

## Commit Message Convention

```
<type>: <short description in English> (#<issue-number>)
```

- Language: English
- Length: 72 characters or less
- Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`
- Always reference the issue number

## Test Execution

- **Environment**: Docker container (mandatory)
- **Command**: `docker compose exec <service> npm test`
- **Timing**: After implementation, before commit
- **Requirement**: All tests must pass before creating a PR

## Specification Update Rules

- Update `docs/app/spec/` **after** design approval, **before** implementation
- Functional specifications → `docs/app/spec/functional/`
- System specifications → `docs/app/spec/system/`
- Specifications should reflect system-wide design decisions, not issue-specific details

## Data Maintenance

Some recurring tasks fall outside the standard Issue → Design → Implement workflow.
These are data curation tasks performed directly by the developer (or on their behalf).

### Author Correction Workflow

When books have empty author fields that heuristic patterns could not resolve,
the developer manually populates `data/book-corrections.json`.

Steps:

1. List unregistered books with missing authors:
   ```bash
   node scripts/list-missing-authors.js
   ```
2. Edit `data/book-corrections.json` — fill in `title` and `author` fields for each entry.
3. Regenerate `data/books.json`:
   ```bash
   node scripts/process.js
   ```
4. Commit both changed files:
   ```bash
   git add data/book-corrections.json data/books.json
   git commit -m "chore: add author corrections (#<issue-number if applicable>)"
   ```

When Claude Code is asked to assist with this task, follow the steps above
rather than the full design-doc → spec → implement workflow.

### Book Metadata Enrichment Workflow

`scripts/enrich.js` pre-fetches bibliographic data (cover image, publisher, publication year,
synopsis) from external APIs and saves it to `data/book-metadata.json`.
Run this manually after `process.js` when new books are added, or to fill gaps from prior runs.

Steps:

1. Run the enrichment script (incremental — skips already-fetched ISBNs):
   ```bash
   node scripts/enrich.js
   ```
2. Review the completion summary printed to stdout (hit count per API, total unfetched).
3. `data/book-metadata.json` is **not committed to Git** — it is generated locally in each
   environment and excluded via `.gitignore`.

Options:
- `--force` — re-fetch all ISBNs regardless of existing data
- `--skip-google` — skip Google Books API calls (conserves the daily quota)

When Claude Code is asked to assist with this task, run the script and report the summary.
Do not commit `data/book-metadata.json`.

## UI Component Reference

### Component Structure

| Component | Path | Feature |
|-----------|------|---------|
| App | `src/App.jsx` | Root; page routing, cross-page filter state |
| Navigation | `src/components/Navigation.jsx` | Tab navigation between pages |
| BookListPage | `src/pages/BookListPage.jsx` | S-1 orchestration (search, filter, sort, pagination) |
| SearchBar | `src/components/SearchBar.jsx` | F-5 keyword search input |
| GenreFilter | `src/components/GenreFilter.jsx` | F-6 two-level genre filter |
| AuthorFilter | `src/components/AuthorFilter.jsx` | F-7 author dropdown filter |
| SortControl | `src/components/SortControl.jsx` | F-8 sort key and order selection |
| Pagination | `src/components/Pagination.jsx` | F-9 page navigation |
| ResultSummary | `src/components/ResultSummary.jsx` | Filtered result count display |
| BookGrid | `src/components/BookGrid.jsx` | Book card grid layout |
| BookCard | `src/components/BookCard.jsx` | Individual book display card |
| StatsDashboardPage | `src/pages/StatsDashboardPage.jsx` | S-3 stats dashboard orchestration |
| GenreChart | `src/components/GenreChart.jsx` | F-12 genre bar chart (recharts) |
| AuthorRanking | `src/components/AuthorRanking.jsx` | F-13 author ranking table |
| AuthorRankingRow | `src/components/AuthorRankingRow.jsx` | Single row in author ranking table |

### UI Feature Spec

Refer to `docs/app/spec/functional/ui-features.md` for UI feature definitions (F-5 through F-13).

### Implementation Status

| Screen | Status | Implemented Features |
|--------|--------|---------------------|
| S-1: Book List | Complete | F-5 search, F-6 genre filter, F-7 author filter, F-8 sort, F-9 pagination |
| S-2: Book Detail | Complete | F-10 basic info, F-11 external API enrichment |
| S-3: Statistics Dashboard | Complete | F-12 genre stats, F-13 author ranking |
