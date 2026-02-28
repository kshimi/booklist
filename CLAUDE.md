# {{PROJECT_NAME}}

## Project Overview

{{PROJECT_DESCRIPTION}}

### Tech Stack

| Category | Technology |
|----------|-----------|
| Frontend | {{TECH_STACK}} |
| Backend | {{TECH_STACK}} |
| Database | {{TECH_STACK}} |
| Infrastructure | Docker Compose |

## Language Policy

| Target | Language | Scope |
|--------|----------|-------|
| Claude Code | English | CLAUDE.md, skills, commit messages, PR, setup.md, workflow.md |
| User (Developer) | Japanese | Issue templates, docs/app/, docs/requirements/, user guidance docs |

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

### Docker Commands

```bash
# Start development environment
docker compose up -d

# Run tests
docker compose exec {{DOCKER_SERVICE}} npm test

# Run linter
docker compose exec {{DOCKER_SERVICE}} npm run lint
```

### Important Notes

- Do NOT install Node.js packages locally; always use Docker
- Run all commands inside Docker containers

## Workflow Reference

Claude Code's development workflow is defined in `docs/dev/workflow.md`.
This document governs Claude Code's behavior during development.
Always follow the workflow defined there.

## Document References

| Document | Path | Description |
|----------|------|-------------|
| Workflow (Claude Code) | `docs/dev/workflow.md` | Development workflow rules |
| Setup (Claude Code) | `docs/dev/setup.md` | Environment setup procedure |
| Architecture | `docs/app/architecture.md` | System architecture |
| Database | `docs/app/database.md` | Database design |
| Design Documents | `docs/app/design/` | Per-issue design documents |
| Functional Spec | `docs/app/spec/functional/` | Functional specifications |
| System Spec | `docs/app/spec/system/` | System specifications |
| Requirements | `docs/requirements/` | Requirements definition |

## Project Principles

1. **Simplicity** - Prefer simple solutions over complex ones
2. **Document-driven** - Design before implementation
3. **Test-first** - Write tests alongside implementation
4. **Issue-based** - All work traces back to a GitHub Issue
5. **Minimal context** - Keep CLAUDE.md lean; reference docs/ for details
