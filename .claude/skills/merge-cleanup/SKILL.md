# Merge Cleanup

Sync master after a PR is merged and clean up the feature branch.

## Prerequisites

- A Pull Request number must be provided by the user
- The PR must already be merged by the user on GitHub

## Procedure

1. Verify merge and issue state:
   ```bash
   gh pr view <number> --json state,mergedAt,mergeCommit
   gh issue view <issue-number> --json state,title
   ```
   - Confirm `state: MERGED`
   - If the issue is not closed, close it manually: `gh issue close <number>`

2. Stash any local uncommitted changes on the current branch:
   ```bash
   git stash
   ```
   Skip if there are no local changes.

3. Switch to master and pull:
   ```bash
   git checkout master
   git pull origin master
   ```

4. Re-apply stashed changes if any:
   ```bash
   git stash pop
   ```

5. Run tests to confirm everything passes:
   ```bash
   npm test
   ```
   If tests fail, diagnose and fix before proceeding.

6. Commit and push any remaining local changes:
   - Do NOT commit generated files (`data/books.json`, `data/book-metadata.json`, etc.)
   - Commit message format: `fix: <description> (#<issue-number>)`
   ```bash
   git add <files>
   git commit -m "fix: <description> (#<issue-number>)"
   git push origin master
   ```
   Skip if there are no changes to commit.

7. Delete the local feature branch:
   ```bash
   git branch -d <branch-name>
   ```

## Notes

- Generated files (`data/books.json`, `data/book-metadata.json`) must NOT be committed
- If `git branch -d` fails due to unmerged commits, investigate before using `-D`

## Output Language

Japanese
