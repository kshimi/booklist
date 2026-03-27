# Generate AI Comments

Run the AI recommendation comment generation script and commit the results.

## Prerequisites

- `GEMINI_API_KEY` is stored in 1Password and resolved via `.env` (`op://API/gemini_booklist/...`)
- `data/books.json` must exist (run `node scripts/process.js` if missing)
- `data/book-metadata.json` should exist for best results (run `node scripts/enrich.js` if missing)
- `data/book-gemini-enrichment.json` should exist for best author/pages coverage (run `node scripts/enrich-gemini.js` if missing; requires `GEMINI_API_KEY`)

## Procedure

### 1. Confirm the run mode

Ask the user which mode to use if not specified:

| Mode | Command | Description |
|------|---------|-------------|
| Diff (default) | `node scripts/generate-ai-comments.js` | Ungenerated books only |
| N-day window | `node scripts/generate-ai-comments.js --days N` | Prioritize next N days' daily picks |
| All | `node scripts/generate-ai-comments.js --all` | Regenerate all books |

For routine updates, default to **diff mode**.

### 2. Check current state

Before running, report:
- Total books: `node -e "const b=require('./data/books.json'); console.log(b.length)"`
- Already generated: `node -e "const c=require('./data/book-ai-comments.json'); console.log(Object.keys(c).length)"`

### 3. Run the script

```bash
op run --env-file=.env -- node scripts/generate-ai-comments.js [options]
```

Monitor output:
- Progress is printed per book: `[N/total] 「title」... 完了`
- **429 quota exceeded**: Script stops safely; already-saved comments are preserved
- On error per book: logged and continues to next book

### 4. Report results

After the script finishes, report:
- How many comments were newly generated
- How many total comments are now in `data/book-ai-comments.json`
- Whether a quota limit was hit (and how many were saved before the limit)

### 5. Commit the updated file

```bash
git add data/book-ai-comments.json
git commit -m "chore: update AI recommendation comments"
```

- Do NOT include `GEMINI_API_KEY` or any credentials in the commit
- Only commit `data/book-ai-comments.json`

## Error Handling

| Error | Action |
|-------|--------|
| `GEMINI_API_KEY is not set` | Verify `.env` has the `op://` reference and `op whoami` succeeds |
| `books.json not found` | Run `node scripts/process.js` first |
| 429 quota exceeded | Stop; report how many were saved; suggest running again tomorrow |
| Individual book error | Log and continue; report failed books at the end |

## Notes

- Comments are saved incrementally — a quota cutoff does not lose already-generated comments
- The `--days N` mode is recommended before expected daily picks to ensure coverage
- Re-running in diff mode is safe and idempotent for already-generated books
