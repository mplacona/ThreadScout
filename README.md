# ThreadScout

Find high-intent Reddit threads where your product can help, summarize subreddit rules, score opportunities, draft transparent reply variants, and track outcomes. Human in the loop only. No auto posting.

## Features

- **Thread Discovery**: Search Reddit for relevant discussions using keywords and subreddits
- **Rules Analysis**: Automatically fetch and summarize subreddit rules
- **Opportunity Scoring**: AI-powered scoring of thread relevance (0-100)
- **Draft Generation**: Two reply variants - help-only and help-with-link
- **Link Validation**: Enforces one-link max and domain allowlist
- **Outcome Tracking**: Track comment performance after posting

## App

![ThreadScout App Diagram](https://github.com/user-attachments/assets/51a9a2ac-8f69-4c30-8866-c82fcdaab35e)

## Architecture

![ThreadScout Architecture Diagram](https://github.com/user-attachments/assets/4a49eb50-5ada-49e5-9e92-dc2d77eefef3)

### Frontend

- **Vite + React + TypeScript** with Tailwind CSS and shadcn/ui
- **Two Main Routes**: Dashboard (scan configuration and results) and Thread (detailed analysis and drafting)

### Backend

- **Hono** server with TypeScript
- **Storage Abstraction**: Automatically chooses Spaces (production) or local JSON (development)
- **Reddit Integration**: OAuth or public JSON endpoints
- **Agent Integration**: Gradient AI or mock responses
- **Validation**: Server-side link and disclosure enforcement

### System Components

The diagram above shows how ThreadScout's components work together:

- **Frontend (React+Vite)**: User interface with API wrapper and client libraries
- **Hono API Server**: Central backend with organized routes, schemas, and services
- **External Services**: Reddit API for data and Gradient AI for thread analysis
- **Serverless Functions**: Specialized tools for rule fetching and link validation
- **Storage Layer**: Flexible storage supporting both local development and cloud production

## Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn package manager

### 🚀 Get Started in 3 Steps

1. **Clone and Install**

   ```bash
   git clone git@github.com:mplacona/ThreadScout.git
   cd ThreadScout
   npm install
   ```

2. **Configure Environment** (optional for demo)

   ```bash
   # Create .env file with your API credentials (see configuration section below)
   # The app works without configuration using public APIs and mock responses
   ```

3. **Start Development**

   ```bash
   npm run dev
   ```
   
   This starts:
   - Frontend: http://localhost:5173
   - Backend: http://localhost:3000

That's it! 🎉 The app works without configuration using public Reddit APIs and mock AI responses.

### 📱 Presentation Mode

- **Keyboard Shortcut**: Cmd/Ctrl + K
- **Effect**: Scales the app up to 110% and centers it on the screen

### 🧪 Run Tests

```bash
npm test              # Run all tests
npm test -- filename  # Run specific test file
```

### 🏗️ Build for Production

```bash
npm run build    # Production build
npm run preview  # Preview production build
```

## Environment Configuration

### Required for Production (if not using local storage)

```bash
# DigitalOcean Spaces (for persistent storage)
SPACES_KEY=your_spaces_key
SPACES_SECRET=your_spaces_secret
SPACES_BUCKET=threadscout-prod
SPACES_ENDPOINT=https://nyc3.digitaloceanspaces.com

# Domain allowlist for links
ALLOWED_LINK_DOMAINS=yoursite.com,docs.yoursite.com
```

### Optional Integrations

```bash
# Reddit API (recommended for production)
REDDIT_CLIENT_ID=your_reddit_client_id
REDDIT_CLIENT_SECRET=your_reddit_client_secret
REDDIT_USER_AGENT=ThreadScout/1.0 by yourusername

# Gradient AI Agent (or use mock responses)
AGENT_ENDPOINT_URL=https://api.gradient.ai/your_endpoint
AGENT_API_KEY=your_gradient_api_key

# Feature Flags
FEATURE_AGENT_TOOLS=true  # Enable agent tool calling
SAFE_MODE=true           # Force help-only drafts
```

## Usage

### 1. Dashboard - Scan Configuration

- **Select Subreddits**: Choose from popular options or add custom ones
- **Choose Keywords**: Pick relevant search terms
- **Set Timeframe**: Lookback period (1-168 hours)
- **Configure Allowlist**: Domains permitted in links

### 2. Dashboard - Results

- View discovered threads with scores, engagement metrics, and rule summaries
- Click "Open Thread" to analyze individual opportunities

### 3. Thread Analysis

- **Left Panel**: Analysis summary, rules, and risks
- **Center Panel**: Full thread content and top comments
- **Right Panel**: Editable reply drafts with live character counts

### 4. Reply Variants

- **Variant A**: Help-only response with concrete steps or code
- **Variant B**: Help + one allowlisted link + disclosure (if required)

### 5. Outcome Tracking

- Paste your Reddit comment URL after posting to track performance
- System tracks comment status (alive/removed) and basic metrics

## Storage Structure

```
/.data/                          # Local development storage
  sessions/{sessionId}.json      # Scan results and drafts
  outcomes/{threadId}.json       # Outcome tracking records
  cache/rules/{subreddit}.json   # Cached subreddit rules (24h TTL)
  snapshots/{timestamp}.json     # Thread snapshots (if using tools)
```

## Technologies

- **Frontend**: Vite, React, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Hono, Node.js, TypeScript
- **Testing**: Vitest
- **Deployment**: Static build + Node server
