# Code Review

Review code quality and post feedback as a PR review comment.

## Prerequisites

- A Pull Request number or branch must be specified by the user

## Procedure

1. Read the PR details: `gh pr view <number>`
2. Read the PR diff: `gh pr diff <number>`
3. If a design document exists for the related issue, read it for context
4. Review the changes against the following criteria
5. Post the review as a PR comment: `gh pr review <number> --comment --body "..."`

## Review Criteria

### 1. Code Quality & Best Practices
- Clean, readable code
- Consistent naming conventions
- No code duplication
- Proper error handling
- No security vulnerabilities (XSS, SQL injection, etc.)

### 2. Potential Bugs & Edge Cases
- Null/undefined handling
- Boundary conditions
- Race conditions
- Error propagation

### 3. Documentation Consistency
- Changes align with design document
- Specifications in `docs/app/spec/` are up to date
- Code comments where necessary (non-obvious logic only)

### 4. Test Coverage
- New features have corresponding tests
- Edge cases are tested
- Tests are meaningful (not just for coverage)

## Output Format

Post a structured review in English on the PR:

```markdown
## Code Review

### Summary
<brief overall assessment>

### Findings

#### Issues
- [ ] <issue description and suggestion>

#### Suggestions
- <improvement suggestion>

#### Positive
- <what's done well>
```

## Output Language

English
