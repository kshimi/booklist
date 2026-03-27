# Enrich Gemini

Run the Gemini bibliographic enrichment script and commit the results.

## Prerequisites

- `GEMINI_API_KEY` is stored in 1Password and resolved via `.env` (`op://API/gemini_booklist/...`)
- `data/books.json` must exist (run `node scripts/process.js` if missing)

## Procedure

### 1. Confirm the run mode

Ask the user which mode to use if not specified:

| Mode | Command | Description |
|------|---------|-------------|
| Diff (default) | `node scripts/enrich-gemini.js` | Unprocessed books only (author empty or pages null, not yet in enrichment.json) |
| All | `node scripts/enrich-gemini.js --all` | Re-query all books with missing author or pages |

For routine updates, default to **diff mode**.

### 2. Check current state

Before running, report:
- Total books: `node -e "const b=require('./data/books.json'); console.log(b.length)"`
- Already enriched: `node -e "try { const e=require('./data/book-gemini-enrichment.json'); console.log(Object.keys(e).length); } catch { console.log(0); }"`
- Books missing author: `node -e "const b=require('./data/books.json'); console.log(b.filter(x=>!x.author).length)"`
- Books missing pages: `node -e "const b=require('./data/books.json'); console.log(b.filter(x=>x.pages===null).length)"`

### 3. Run the script

```bash
op run --env-file=.env -- node scripts/enrich-gemini.js [options]
```

Monitor output:
- Progress is printed per book: `[N/total] 「title」... 完了`
- **429 quota exceeded**: Script stops safely; already-saved enrichments are preserved
- On parse failure: logged and skips to next book
- On other error per book: logged and continues to next book

### 4. Report results

After the script finishes, report:
- How many entries were newly saved
- How many total entries are now in `data/book-gemini-enrichment.json`
- Whether a quota limit was hit (and how many were saved before the limit)

### 5. Commit the updated file

```bash
git add data/book-gemini-enrichment.json
git commit -m "chore: update Gemini bibliographic enrichment data"
```

- Do NOT include `GEMINI_API_KEY` or any credentials in the commit
- Only commit `data/book-gemini-enrichment.json`

### 6. Remind user to regenerate books.json

Enrichment data is applied during `process.js` execution. Remind the user to run:

```bash
node scripts/process.js
```

to reflect the enriched author/pages values in `data/books.json`.

## Error Handling

| Error | Action |
|-------|--------|
| `GEMINI_API_KEY is not set` | Verify `.env` has the `op://` reference and `op whoami` succeeds |
| `books.json not found` | Run `node scripts/process.js` first |
| 429 quota exceeded | Stop; report how many were saved; suggest running again tomorrow |
| JSON parse failure per book | Log and skip; book remains unenriched |
| Other per-book error | Log and continue; report failed books at the end |

## Notes

- Enrichments are saved incrementally — a quota cutoff does not lose already-generated data
- Re-running in diff mode is safe and idempotent for already-enriched books
- After enrichment, run `node scripts/process.js` to apply changes to `books.json`
