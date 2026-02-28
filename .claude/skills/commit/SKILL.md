# Commit Changes

Stage and commit changes following the project's commit conventions.

## Procedure

1. Review the current changes: `git diff` and `git status`
2. Stage relevant files: `git add <files>`
   - Do NOT stage unrelated changes
   - Do NOT stage sensitive files (.env, credentials, etc.)
3. Commit with a properly formatted message

## Commit Message Format

```
<type>: <short description in English> (#<issue-number>)
```

### Rules

- **Language**: English
- **Length**: 72 characters or less
- **Issue reference**: Always include `(#<issue-number>)` when working on an issue
- **Format**: Conventional Commits

### Types

| Type | Usage |
|------|-------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation changes |
| `refactor` | Code refactoring (no feature change) |
| `test` | Adding or modifying tests |
| `chore` | Maintenance tasks |

### Examples

```
feat: add user authentication flow (#12)
fix: correct date offset calculation (#15)
docs: update API reference (#18)
refactor: split dashboard component (#20)
test: add unit tests for validation (#22)
chore: update dependencies (#25)
```

## Pre-commit Checks

Before committing, run:
- Linter (if configured)
- Tests (if changes affect logic)
