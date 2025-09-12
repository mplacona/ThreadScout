import { Hono } from 'hono';
import { RedditClient } from '../services/redditClient.js';

const app = new Hono();

// In-memory cache for subreddit searches
const searchCache = new Map<string, { results: Array<{name: string, subscribers: number, displayName: string}>; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

app.get('/subreddits/search', async (c) => {
  const query = c.req.query('q');
  const limitParam = c.req.query('limit');
  const limit = limitParam ? parseInt(limitParam, 10) : 10;

  if (!query || query.length < 2) {
    return c.json({ subreddits: [] });
  }

  // Check cache first
  const cacheKey = `${query.toLowerCase()}_${limit}`;
  const cached = searchCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log(`🔍 Serving cached subreddit search for "${query}"`);
    return c.json({ subreddits: cached.results });
  }

  try {
    const redditClient = new RedditClient(
      process.env.REDDIT_CLIENT_ID,
      process.env.REDDIT_CLIENT_SECRET,
      process.env.REDDIT_USER_AGENT
    );

    const subreddits = await redditClient.searchSubreddits(query, limit);
    
    // Cache the results
    searchCache.set(cacheKey, {
      results: subreddits,
      timestamp: Date.now()
    });

    // Clean old cache entries (simple cleanup)
    if (searchCache.size > 100) {
      const cutoff = Date.now() - CACHE_DURATION;
      for (const [key, value] of searchCache.entries()) {
        if (value.timestamp < cutoff) {
          searchCache.delete(key);
        }
      }
    }

    console.log(`🔍 Found ${subreddits.length} subreddits for "${query}":`, subreddits.slice(0, 3));
    return c.json({ subreddits });
  } catch (error) {
    console.error('Subreddit search error:', error);
    return c.json({ error: 'Failed to search subreddits' }, 500);
  }
});

export default app;