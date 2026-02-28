# Development Environment Setup

## Prerequisites

- Docker and Docker Compose installed
- Git configured
- GitHub CLI (`gh`) authenticated

## Initial Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd <project-directory>
```

### 2. Start Docker Containers

```bash
docker compose up -d
```

### 3. Install Dependencies

```bash
docker compose exec <service> npm install
```

### 4. Database Setup

```bash
# Run migrations
docker compose exec <service> npx prisma migrate dev

# Seed initial data (if applicable)
docker compose exec <service> npx prisma db seed
```

### 5. Environment Variables

Copy the example environment file and configure:

```bash
cp .env.example .env
```

<!-- List required environment variables and their purposes -->

## Verification

```bash
# Verify the application starts
docker compose exec <service> npm run dev

# Run tests to verify setup
docker compose exec <service> npm test
```

## Common Commands

| Command | Description |
|---------|-------------|
| `docker compose up -d` | Start containers |
| `docker compose down` | Stop containers |
| `docker compose exec <service> npm test` | Run tests |
| `docker compose exec <service> npm run lint` | Run linter |
| `docker compose exec <service> npx prisma studio` | Open DB GUI |
