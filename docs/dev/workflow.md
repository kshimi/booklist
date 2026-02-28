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
