# Implement Issue

Implement changes based on an approved design document.

## Prerequisites

- A GitHub Issue number must be provided by the user
- The design document for the issue must exist in `docs/app/design/` and be approved by the user
- Specifications in `docs/app/spec/` must be updated to reflect the design document

## Procedure

1. Read the GitHub Issue: `gh issue view <number>`
2. Find and read the design document in `docs/app/design/`
3. Read relevant specifications in `docs/app/spec/`
4. Create a feature branch:
   - Naming: `<type>/<issue-number>-<short-description>`
   - Types: `feature`, `fix`, `docs`, `refactor`
   - Example: `feature/12-user-auth`, `fix/15-date-offset`
   ```
   git checkout -b <type>/<issue-number>-<short-description>
   ```
5. Implement changes across all necessary files
6. Run tests in Docker:
   ```
   docker compose exec <service> npm test
   ```
   - Ensure all tests pass before proceeding
7. Commit with a descriptive message referencing the issue:
   ```
   git commit -m "<type>: <description> (#<issue-number>)"
   ```
8. Push the branch and create a PR:
   ```
   git push -u origin <branch-name>
   gh pr create --title "<type>: <description> (#<issue-number>)" --body "..."
   ```
   - Use the PR template structure
   - Reference the GitHub Issue in the PR body

## Branch Naming Convention

| Type | Usage | Example |
|------|-------|---------|
| feature | New feature | `feature/12-user-auth` |
| fix | Bug fix | `fix/15-date-offset` |
| docs | Documentation | `docs/18-api-reference` |
| refactor | Refactoring | `refactor/20-component-split` |

## Output

- Feature branch with implementation
- All tests passing
- Pull Request created and linked to the Issue
