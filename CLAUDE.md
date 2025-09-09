# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Core Commands
- `npm run dev` - Start development servers (Vite frontend on :5173, Hono backend on :3000)
- `npm run build` - Build for production (frontend + server bundle)
- `npm run build:dev` - Build for development environment
- `npm test` - Run Vitest test suite
- `npm run lint` - Run ESLint
- `npm run preview` - Preview production build

### Single Test Execution
Tests use Vitest with global setup. Run single tests with:
```bash
npm test -- filename
npm test -- --run  # for CI mode
```

## Architecture Overview

ThreadScout is a Reddit thread discovery and analysis tool with a React frontend and Hono backend.

### Frontend Structure (src/)
- **Two-page app**: Dashboard (scan configuration/results) and Thread (detailed analysis)
- **Stack**: Vite + React + TypeScript + Tailwind + shadcn/ui + TanStack Query
- **Routing**: React Router with `/` (Dashboard) and `/thread/:id` (Thread analysis)
- **Aliases**: `@/` resolves to `src/`

### Backend Structure (server/)
- **Framework**: Hono with Node.js adapter
- **Routes**: `/api/scan`, `/api/threads`, `/api/outcomes`, `/api/tools`, `/api/stream-scan`
- **Storage Abstraction**: Auto-selects between DigitalOcean Spaces (production) or local JSON (development)
- **Services**: Reddit client, agent client, validators, rules cache
- **Schemas**: Zod validation for threads, outcomes, drafts

### Storage System
The storage abstraction (`server/services/storage.ts`) automatically chooses:
- **Spaces Storage**: When all DO Spaces env vars are present
- **Local JSON Storage**: Falls back to `./.data/` directory

Storage keys follow patterns:
- Sessions: `sessions/{sessionId}.json`
- Outcomes: `outcomes/{threadId}.json` 
- Rules Cache: `cache/rules/{subreddit}.json`
- Snapshots: `snapshots/{timestamp}.json`

### Environment Configuration
Copy `.env.example` to `.env`. The app gracefully degrades:
- **No Reddit creds**: Uses public JSON endpoints
- **No Agent creds**: Uses mock responses
- **No Spaces creds**: Uses local storage
- **Feature flags**: `FEATURE_AGENT_TOOLS`, `SAFE_MODE`

### API Integration Points
- **Reddit**: OAuth or public endpoints via `server/services/redditClient.ts`
- **Agent**: Gradient AI or mock responses via `server/services/agentClient.ts`
- **Validation**: Link allowlist and disclosure rules enforced server-side

### Frontend-Backend Communication
- Frontend uses TanStack Query for API calls
- Vite dev proxy forwards `/api/*` to backend on port 3000
- CORS configured for development origins

## Key Development Patterns

### Testing Setup
- Vitest with Node environment
- Global test setup in `test/setup.ts`
- Mocked environment variables and console methods
- Test files can be adjacent to source files

### Build Process
- Frontend: Standard Vite build to `dist/`
- Backend: Custom script creates server launcher in `dist/server.mjs`
- Production uses `tsx` to run TypeScript server directly

### Error Handling
- Server has global error middleware
- Development mode exposes full error messages
- Production mode sanitizes error responses