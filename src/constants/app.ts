export const APP_CONFIG = {
  SCAN: {
    DEFAULT_LOOKBACK_HOURS: 24,
    DEFAULT_THREAD_LIMIT: 5,
    MAX_LOOKBACK_HOURS: 168,
    MAX_THREAD_LIMIT: 50,
    MIN_LOOKBACK_HOURS: 1,
    MIN_THREAD_LIMIT: 1,
    AGENT_REQUEST_DELAY: 2000, // 2 seconds between requests
  },
  STORAGE: {
    RECENT_SESSIONS_KEY: 'threadscout_recent_sessions',
    SESSION_KEY_PREFIX: 'threadscout_session_',
    MAX_RECENT_SESSIONS: 5,
  },
  SCORES: {
    EXCELLENT_THRESHOLD: 70,
    GOOD_THRESHOLD: 50,
    MODERATE_THRESHOLD: 40,
  },
  TIME: {
    MILLISECONDS_PER_HOUR: 60 * 60 * 1000,
    MILLISECONDS_PER_DAY: 24 * 60 * 60 * 1000,
  },
} as const;

export const COMMON_KEYWORDS = [
  'help', 'problem', 'stuck', 'how to', 'best way', 'recommendations',
  'tool', 'solution', 'advice', 'experience', 'struggling', 'analytics'
] as const;

export const DEFAULT_SUBREDDITS = [
  'linkedin', 'linkedinads', 'linkedintips'
] as const;

export const DEFAULT_KEYWORDS = [
  'help', 'analytics'
] as const;

export const SCORE_HINTS = {
  EXCELLENT: 'Excellent fit for engagement',
  GOOD: 'Good opportunity to engage', 
  MODERATE: 'Moderate fit - consider context',
  LOW: 'Lower priority thread',
} as const;