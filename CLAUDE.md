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
- **Routes**: `/api/scan`, `/api/scan/stream`, `/api/threads`, `/api/threads/recent`, `/api/outcomes`, `/api/tools`, `/api/subreddits/search`
- **Storage Abstraction**: Auto-selects between DigitalOcean Spaces (production) or local JSON (development)
- **Services**: Reddit client, agent client, validators, rules cache, subreddit search
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

- **No Reddit creds**: Uses public JSON endpoints (limited rate limits)
- **No Agent creds**: Throws error instead of mock responses (agent required for scoring)
- **No Spaces creds**: Uses local storage in `./.data/` directory
- **Feature flags**: `FEATURE_AGENT_TOOLS`, `SAFE_MODE`

### API Integration Points
- **Reddit**: OAuth or public endpoints via `server/services/redditClient.ts`
  - Thread search with keyword filtering and time limits
  - Subreddit search with subscriber counts and public-only filtering
  - Rules fetching with intelligent parsing for link policies
- **Agent**: Gradient AI integration via `server/services/agentClient.ts`
  - Sends Reddit thread JSON URLs directly to agent
  - Robust JSON parsing with error recovery for malformed responses
  - No fallback to mock responses (agent required for functionality)
- **Validation**: Link allowlist and disclosure rules enforced server-side

### Frontend-Backend Communication
- Frontend uses TanStack Query for API calls
- Vite dev proxy forwards `/api/*` to backend on port 3000
- CORS configured for development origins
- Real-time streaming scan updates via Server-Sent Events (SSE)

## Key Features

### Subreddit Autocomplete
- **Component**: `src/components/ui/subreddit-autocomplete.tsx`
- **Real-time search**: Fetches live subreddit data from Reddit's public API
- **Subscriber display**: Shows formatted subscriber counts (397K subs, 2M subs)
- **Filtering**: Only returns public subreddits
- **Caching**: Client and server-side caching (5-minute duration)
- **Fallback**: Graceful degradation to popular subreddits list

### Thread Analysis & Scoring
- **Score-based sorting**: Threads automatically sorted by AI score (highest first)
- **Score hints**: Auto-generated hints based on score ranges (Excellent fit, Good opportunity, etc.)
- **Streaming scans**: Real-time progress updates with cancellation support
- **Robust parsing**: Handles malformed JSON from AI agent with multiple recovery strategies

### Text Formatting
- **Component**: `src/components/ui/formatted-text.tsx`
- **Escape handling**: Converts `\\n` sequences to proper line breaks
- **Markdown support**: Basic **bold**, *italic*, and `code` formatting
- **Preserved formatting**: Maintains original spacing and structure

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