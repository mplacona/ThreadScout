import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { enforceOneLink, enforceAllowlist } from '../services/validators.js';
import { makeStorage, StorageKeys } from '../services/storage.js';
import { RedditClient } from '../services/redditClient.js';
import type { OutcomeRecord } from '../schemas/outcomes.js';

const app = new Hono();

// POST /api/tools/validate-links
const ValidateLinksSchema = z.object({
  text: z.string(),
  allowlist: z.array(z.string()),
});

app.post(
  '/tools/validate-links',
  zValidator('json', ValidateLinksSchema),
  async (c) => {
    const { text, allowlist } = c.req.valid('json');

    const oneLinkResult = enforceOneLink(text);
    const allowlistResult = enforceAllowlist(oneLinkResult.cleaned, allowlist);

    return c.json({
      ok: oneLinkResult.ok && allowlistResult.ok,
      cleaned: allowlistResult.cleaned,
      violations: [
        ...(oneLinkResult.ok ? [] : [`Too many links: ${oneLinkResult.count} found, max 1 allowed`]),
        ...allowlistResult.violations.map(v => `Disallowed domain: ${v}`),
      ],
    });
  }
);

// POST /api/tools/snapshot-thread
const SnapshotThreadSchema = z.object({
  permalink: z.string(),
  note: z.string().optional(),
});

app.post(
  '/tools/snapshot-thread',
  zValidator('json', SnapshotThreadSchema),
  async (c) => {
    const { permalink, note } = c.req.valid('json');

    try {
      const storage = makeStorage();
      const redditClient = new RedditClient(
        process.env.REDDIT_CLIENT_ID,
        process.env.REDDIT_CLIENT_SECRET,
        process.env.REDDIT_USER_AGENT
      );

      // Get thread data
      const thread = await redditClient.getThread(permalink);
      
      // Create snapshot
      const timestamp = Date.now();
      const snapshot = {
        thread,
        note,
        snapshotAt: timestamp,
        permalink,
      };

      const key = StorageKeys.snapshot(timestamp);
      await storage.writeJSON(key, snapshot);

      return c.json({ key });
    } catch (error) {
      console.error('Error creating snapshot:', error);
      return c.json({ error: 'Failed to create snapshot' }, 500);
    }
  }
);

// POST /api/tools/log-outcome
const LogOutcomeSchema = z.object({
  thread_id: z.string(),
  comment_url: z.string().url(),
  status: z.enum(['pending', 'alive', 'removed']).default('pending'),
});

app.post(
  '/tools/log-outcome',
  zValidator('json', LogOutcomeSchema),
  async (c) => {
    const { thread_id, comment_url, status } = c.req.valid('json');

    try {
      const storage = makeStorage();
      
      const outcome: OutcomeRecord = {
        threadId: thread_id,
        commentUrl: comment_url,
        status,
        insertedAt: Date.now(),
      };

      const key = StorageKeys.outcome(thread_id);
      await storage.writeJSON(key, outcome);

      return c.json({ ok: true, key });
    } catch (error) {
      console.error('Error logging outcome:', error);
      return c.json({ error: 'Failed to log outcome' }, 500);
    }
  }
);

// Optional discovery tools (disabled by default)
const ENABLE_DISCOVERY_TOOLS = process.env.FEATURE_AGENT_TOOLS === 'true';

if (ENABLE_DISCOVERY_TOOLS) {
  // POST /api/tools/reddit-search
  const RedditSearchSchema = z.object({
    subs: z.array(z.string()).max(5),
    keywords: z.array(z.string()).max(10),
    lookback_hours: z.number().min(1).max(168),
  });

  app.post(
    '/tools/reddit-search',
    zValidator('json', RedditSearchSchema),
    async (c) => {
      const { subs, keywords, lookback_hours } = c.req.valid('json');

      try {
        const redditClient = new RedditClient(
          process.env.REDDIT_CLIENT_ID,
          process.env.REDDIT_CLIENT_SECRET,
          process.env.REDDIT_USER_AGENT
        );

        const threads = await redditClient.searchThreads(subs, keywords, lookback_hours);
        
        return c.json({ threads });
      } catch (error) {
        console.error('Error searching Reddit:', error);
        return c.json({ error: 'Failed to search Reddit' }, 500);
      }
    }
  );

  // POST /api/tools/fetch-thread
  const FetchThreadSchema = z.object({
    permalink: z.string(),
  });

  app.post(
    '/tools/fetch-thread',
    zValidator('json', FetchThreadSchema),
    async (c) => {
      const { permalink } = c.req.valid('json');

      try {
        const redditClient = new RedditClient(
          process.env.REDDIT_CLIENT_ID,
          process.env.REDDIT_CLIENT_SECRET,
          process.env.REDDIT_USER_AGENT
        );

        const thread = await redditClient.getThread(permalink);
        
        return c.json({ thread });
      } catch (error) {
        console.error('Error fetching thread:', error);
        return c.json({ error: 'Failed to fetch thread' }, 500);
      }
    }
  );

  // POST /api/tools/fetch-rules
  const FetchRulesSchema = z.object({
    sub: z.string(),
  });

  app.post(
    '/tools/fetch-rules',
    zValidator('json', FetchRulesSchema),
    async (c) => {
      const { sub } = c.req.valid('json');

      try {
        const redditClient = new RedditClient(
          process.env.REDDIT_CLIENT_ID,
          process.env.REDDIT_CLIENT_SECRET,
          process.env.REDDIT_USER_AGENT
        );

        const rules = await redditClient.getSubredditRules(sub);
        
        return c.json({ rules });
      } catch (error) {
        console.error('Error fetching rules:', error);
        return c.json({ error: 'Failed to fetch rules' }, 500);
      }
    }
  );
}

export default app;