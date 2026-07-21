# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Runner** — a mobile-first group running app inspired by university face-recognition check-in systems. Combines real-time GPS tracking, running groups (域/PlayGround), social sharing, and data analytics. Chinese-language app targeting runners. Dark-themed UI with orange accent (#FF5F1F), designed via Pencil and implemented with shadcn/ui.

## Essential Commands

```bash
# Install (pnpm recommended)
pnpm install

# Environment
cp .env.example .env   # then fill in MySQL, Redis, better-auth, Resend, Amap keys

# Database
pnpm prisma:deploy     # apply migrations to DB
pnpm prisma:generate   # regenerate Prisma client after schema changes
pnpm prisma:dev        # create new migration from schema changes
pnpm prisma:fmt        # format all Prisma schema files

# Development
pnpm dev               # Next.js dev server on :3000 (Turbopack)

# Build & Production
pnpm build             # production build (Turbopack)
pnpm start             # start production server

# Lint & Format
pnpm lint              # ESLint check
pnpm lint:fix          # ESLint auto-fix
pnpm fmt               # Prettier format all files
```

## Tech Stack

| Layer       | Technology                                            | Version |
| ----------- | ----------------------------------------------------- | ------- |
| Framework   | Next.js (App Router)                                  | 15.5    |
| UI          | React                                                 | 19.1    |
| Styling     | Tailwind CSS + tw-animate-css                         | 4.x     |
| Components  | shadcn/ui (`radix-nova` style, `neutral` base)        | 4.11    |
| Icons       | lucide-react                                          | 1.21    |
| ORM         | Prisma (multi-file schema in `prisma/models/`)        | 7.8     |
| Database    | MySQL via MariaDB adapter (`@prisma/adapter-mariadb`) | 8.4     |
| Cache       | Redis (via `redis` npm package)                       | 7       |
| Auth        | better-auth (email/password + OTP)                    | 1.6     |
| Email       | Resend                                                | 6.x     |
| Testing     | Vitest                                                | 3.x     |
| Runtime     | Node.js (TypeScript 5.8+)                             | 22 LTS  |
| Package mgr | pnpm (primary, `pnpm-lock.yaml`) / bun (`bun.lock`)   | —       |
| Deployment  | Docker Compose (Redis + app)                          | 27+     |

Third-party APIs: **高德 (Amap) JS SDK 2.0** for maps/tracking, **高德 Web API** for geocoding. Keys in env: `NEXT_PUBLIC_AMAP_KEY`, `NEXT_PUBLIC_AMAP_SECURITY_CODE`.

## Architecture

### Directory Layout

```
src/
  app/                    # Next.js App Router
    api/[...all]/route.ts # better-auth handler (all auth routes)
    globals.css           # Theme tokens, Tailwind v4 @theme inline, dark mode (default)
    layout.tsx            # Root layout with fonts (Inter, Geist, Geist Mono), dark class
    page.tsx              # Home page (WIP — landing/marketing)
  lib/
    auth.ts               # Server-side better-auth instance (Prisma adapter + MySQL)
    auth-client.ts         # Client-side auth client (signIn, signUp, useSession)
    prisma.ts              # PrismaClient singleton with MariaDB driver adapter
    redis.ts               # Redis client (stub)
    actions.ts             # Server Actions (stub)
    utils.ts               # cn() utility (clsx + tailwind-merge)
  components/ui/           # 16 installed shadcn components (button, card, dialog, tabs, etc.)
prisma/
  models/                  # Split Prisma schema: user, account, session, verification,
                           #   playground, runrecord, rankinglist, schedule
  migrations/              # Migration history
prisma.config.ts           # Prisma config (datasource from MYSQL_URL env)
```

### Authentication Flow (better-auth)

- **Server**: `src/lib/auth.ts` exports `auth` — configured with Prisma adapter (`provider: "mysql"`), `emailAndPassword` enabled, secret from `BETTER_AUTH_SECRET`, base URL from `BETTER_AUTH_URL`.
- **API Handler**: `src/app/api/[...all]/route.ts` uses `toNextJsHandler(auth)` — all better-auth endpoints (`/api/auth/*`) route through here.
- **Client**: `src/lib/auth-client.ts` exports `signIn`, `signUp`, `useSession` from `createAuthClient()`.
- **OTP Flow**: User signs up → server sends 6-digit OTP via Resend → user verifies OTP → email marked verified → session created. Same pattern for password reset.

### Database (Prisma + MariaDB)

- `src/lib/prisma.ts` creates a **singleton** `PrismaClient` using `@prisma/adapter-mariadb` driver adapter (direct TCP connection, no connection pool URL).
- Schema split across `prisma/models/*.prisma` — Prisma 7.x multi-file schema with `prisma.config.ts` pointing `schema: "prisma"`.
- Connection uses individual env vars: `MYSQL_HOST`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_NAME` (NOT `MYSQL_URL` for the adapter — only for `prisma.config.ts` datasource URL).

### Domain Model (核心概念)

- **User** — basic profile + auth (better-auth compliant: sessions, accounts, email verification)
- **PlayGround (域)** — a running group. Has members via `PlayGroundUser` (OWNER/USER roles). Can be public (约跑) or private (个人). Permanently exists until explicitly deleted.
- **RunRecord** — individual run data (startTime, endTime, duration, distance, avgPace). Linked to User and optionally to PlayGroundRankingList.
- **TotalRunRecord** — aggregated lifetime stats per user (totalTime, totalDistance, avgPace).
- **PlayGroundRankingList** — leaderboard within a PlayGround, linked to RunRecords.
- **Schedule** — community schedule system. PlayGrounds upload schedules, users select and import to personal calendar.
- All models carry `createdAt`/`updatedAt` with `@db.Timestamp(3)`.

### Core User Flows (from `docs/核心流程.md`)

1. **Personal Run**: Home → create private 域 → select record info → start running → GPS tracking → stop → data summary
2. **Group Run (约跑)**: Home → create public 域 (generates invite code) OR join via invite code → each member sets run preferences → start → real-time sharing (position, HR, pace) → stop → aggregate leaderboard
3. **Community**: Upload schedule → users join schedule → configure mic/volume/shared music → start → data summary
4. **Voice**: Peer-to-peer voice via server relay. User opens mic → client packs audio + 域 info → server fetches 域 members → relays to all members.

### Design System (matching `docs/pages.pen`)

- **Mode**: Dark by default (`<html class="dark">`), light fallback via CSS variables
- **Colors**: Background `#080808`, Cards `#121212`, Accent orange `#FF5F1F` (oklch(0.64 0.22 42)), Card borders `#FFFFFF12`
- **Typography**: Inter (body, `--font-sans`), Geist (headings, `--font-heading`), Geist Mono (data/numbers, `--font-mono`)
- **Radius**: `--radius: 0.75rem` (12px base, Pencil-consistent)
- **Components**: All shadcn primitives use CSS theme tokens (`bg-background`, `text-foreground`, `border-border`, etc.) — never ad-hoc hex values

### Docker

`compose.yaml` runs two services: `redis` (7-alpine, port 6379, persistent volume) and `runner` (builds from Dockerfile, port 3000). MySQL expected externally (not in compose).

## Git Conventions

Branch naming: `feature/*`, `fix/*`, `release/*` off `main`. Git-Flow (next) CLI used for topic branch management. All PRs require approval from all other members. Current active branch: `feature/plantform-dev`.

## Key Environment Variables

| Variable                             | Purpose                           |
| ------------------------------------ | --------------------------------- |
| `MYSQL_HOST/USER/PASSWORD/NAME/PORT` | MySQL connection (Prisma adapter) |
| `MYSQL_URL`                          | Prisma config datasource URL      |
| `REDIS_HOST/PORT/PASSWORD/DB`        | Redis connection                  |
| `BETTER_AUTH_SECRET`                 | Auth token signing secret         |
| `BETTER_AUTH_URL`                    | Auth base URL                     |
| `RESEND_API_KEY`                     | Email (OTP) service               |
| `NEXT_PUBLIC_AMAP_KEY`               | Amap maps SDK (client-side)       |
| `NEXT_PUBLIC_AMAP_SECURITY_CODE`     | Amap security code                |

## Shadcn Component Notes

- Use `bunx shadcn@latest add <name>` to install components (pnpm has module resolution issues with shadcn CLI).
- The `sonner` component replaces the deprecated `toast`. Import `{ Toaster } from "sonner"`.
- shadcn style is `radix-nova` (not default/new-york) — components use the unified `radix-ui` package.
- After `shadcn init`: always fix the `--font-sans: var(--font-sans)` circular reference in `@theme inline` by replacing with literal font names per Tailwind v4 runtime variable limitation.
