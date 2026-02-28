# Create Design Document

Create a design document based on a GitHub Issue and update detailed specifications after approval.

## Prerequisites

- A GitHub Issue number must be provided by the user

## Procedure

### Phase 1: Design Document Creation

1. Read the GitHub Issue: `gh issue view <number>`
2. Explore the existing codebase to understand current architecture
3. Read relevant specifications in `docs/app/spec/` if they exist
4. Write the design document in **Japanese** (user review target)
5. Include the following sections:
   - 概要 (Overview)
   - 技術的アプローチ (Technical Approach)
   - 影響範囲 (Scope of Impact)
   - テスト計画 (Test Plan)
   - If multiple approaches exist, present a comparison table (比較表)
6. Save to `docs/app/design/<NNN>-<description>.md`
   - `<NNN>`: 3-digit sequential number (check existing files for next number)
   - `<description>`: kebab-case English description
   - Example: `001-initial-setup.md`, `002-auth-integration.md`
7. Commit the design document
8. Post a comment on the GitHub Issue with a link to the design document:
   ```
   gh issue comment <number> --body "Design document created: docs/app/design/<NNN>-<description>.md"
   ```

### Phase 2: Specification Update (after user approval)

After the user reviews and approves the design document:

1. Update relevant specifications in `docs/app/spec/` based on the design document
   - `docs/app/spec/functional/` for functional specifications
   - `docs/app/spec/system/` for system specifications
2. Reflect the design decisions as system-wide specifications
3. Commit the specification updates

## Output

- Design document: `docs/app/design/<NNN>-<description>.md`
- Updated specifications: `docs/app/spec/` (after approval)
- GitHub Issue comment with design document link
