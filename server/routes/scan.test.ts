import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import scanRoutes from './scan';

// Mock dependencies
vi.mock('../services/redditClient.js', () => ({
  RedditClient: vi.fn().mockImplementation(() => ({
    searchThreads: vi.fn().mockResolvedValue([
      {
        id: 'test123',
        sub: 'webdev',
        title: 'Need help with React',
        author: 'testuser',
        permalink: '/r/webdev/comments/test123/need_help_with_react/',
        createdUtc: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
        upvotes: 5,
        comments: 3,
      }
    ]),
    getThread: vi.fn().mockResolvedValue({
      id: 'test123',
      sub: 'webdev',
      title: 'Need help with React',
      author: 'testuser',
      permalink: '/r/webdev/comments/test123/need_help_with_react/',
      createdUtc: Math.floor(Date.now() / 1000) - 3600,
      upvotes: 5,
      comments: 3,
      body: 'I am struggling with React hooks...',
      topComments: [
        { author: 'helper', body: 'Try using useState hook' }
      ]
    })
  }))
}));

vi.mock('../services/agentClient.js', () => ({
  AgentClient: vi.fn().mockImplementation(() => ({
    scoreAndDraft: vi.fn().mockResolvedValue({
      score: 75,
      whyFit: 'User is asking a direct question about React',
      rulesSummary: ['Links allowed', 'Helpful community'],
      risks: [],
      variantA: {
        text: 'Try using the useState hook for managing component state.'
      },
      variantB: {
        text: 'Try using the useState hook. Check out https://example.com/react-guide for more details.',
        disclosure: 'I work on example.com'
      }
    })
  }))
}));

vi.mock('../services/rulesCache.js', () => ({
  RulesCache: vi.fn().mockImplementation(() => ({
    getRules: vi.fn().mockResolvedValue({
      linksAllowed: true,
      vendorDisclosureRequired: false,
      linkLimit: 1,
      notes: ['Be helpful']
    })
  }))
}));

vi.mock('../services/storage.js', () => ({
  makeStorage: vi.fn().mockReturnValue({
    writeJSON: vi.fn().mockResolvedValue(undefined),
    readJSON: vi.fn().mockResolvedValue(null)
  }),
  StorageKeys: {
    session: (id: string) => `sessions/${id}.json`
  }
}));

describe('Scan API', () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
    app.route('/', scanRoutes);
    vi.clearAllMocks();
  });

  it('should validate request schema', async () => {
    const response = await app.request('/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        // Missing required fields
      })
    });

    expect(response.status).toBe(400);
  });

  it('should scan threads successfully', async () => {
    const requestBody = {
      subs: ['webdev'],
      keywords: ['react', 'help'],
      lookbackHours: 24,
      allowlist: ['example.com']
    };

    const response = await app.request('/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    expect(response.status).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty('sessionId');
    expect(data).toHaveProperty('threads');
    expect(Array.isArray(data.threads)).toBe(true);
    
    if (data.threads.length > 0) {
      const thread = data.threads[0];
      expect(thread).toHaveProperty('thread');
      expect(thread).toHaveProperty('score');
      expect(thread).toHaveProperty('whyFit');
      expect(thread).toHaveProperty('rules');
      expect(thread).toHaveProperty('variantA');
      expect(thread).toHaveProperty('variantB');
      
      expect(typeof thread.score).toBe('number');
      expect(thread.score).toBeGreaterThanOrEqual(0);
      expect(thread.score).toBeLessThanOrEqual(100);
    }
  });

  it('should handle empty subreddits array', async () => {
    const requestBody = {
      subs: [],
      keywords: ['react'],
      lookbackHours: 24
    };

    const response = await app.request('/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    expect(response.status).toBe(400);
  });

  it('should handle empty keywords array', async () => {
    const requestBody = {
      subs: ['webdev'],
      keywords: [],
      lookbackHours: 24
    };

    const response = await app.request('/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    expect(response.status).toBe(400);
  });

  it('should validate lookback hours range', async () => {
    const requestBody = {
      subs: ['webdev'],
      keywords: ['react'],
      lookbackHours: 200 // Over the 168 hour limit
    };

    const response = await app.request('/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    expect(response.status).toBe(400);
  });
});