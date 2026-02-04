# DOE Tocantins

Sistema de monitoramento do Diário Oficial do Estado do Tocantins.

## Architecture

```
doe/
├── backend/          # Fastify + Prisma + BullMQ API server
├── mobile/           # React Native CLI mobile app
├── docker-compose.yml
├── package.json      # npm workspaces root
└── .gitignore
```

- **Backend**: Node.js with Fastify, Prisma ORM (PostgreSQL), BullMQ (Redis) for job processing
- **Mobile**: React Native CLI with TypeScript, Google OAuth, FCM push notifications

## Prerequisites

- Node.js >= 18
- Docker and Docker Compose
- Android SDK (for mobile development)
- Xcode (for iOS development, macOS only)

## Getting Started

### 1. Clone and install dependencies

```bash
git clone <repo-url>
cd doe
npm install
```

### 2. Start infrastructure services

```bash
npm run docker:up
```

This starts PostgreSQL (port 5433) and Redis (port 6380).

### 3. Configure environment

```bash
cp backend/.env.example backend/.env
cp mobile/.env.example mobile/.env
```

Edit the `.env` files with your configuration values.

### 4. Run database migrations

```bash
npm run db:migrate
```

### 5. Start development

```bash
# Backend
npm run dev:backend

# Mobile (in a separate terminal)
npm run dev:mobile
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev:backend` | Start backend in development mode |
| `npm run dev:mobile` | Start React Native Metro bundler |
| `npm run build:backend` | Build backend TypeScript |
| `npm run test` | Run tests across all workspaces |
| `npm run lint` | Lint all workspaces |
| `npm run format` | Format code with Prettier |
| `npm run docker:up` | Start Docker services |
| `npm run docker:down` | Stop Docker services |
| `npm run db:migrate` | Run Prisma migrations |
| `npm run db:generate` | Generate Prisma client |

## Docker Services

| Service | Port | Credentials |
|---------|------|-------------|
| PostgreSQL 15 | 5433 | `doe_user` / `doe_password` / `doe_tocantins` |
| Redis 7 | 6380 | No auth |
