import { StorageKeys, type StorageProvider } from './storage.js';
import type { RulesSummary, RedditClient } from './redditClient.js';

interface CachedRules {
  rules: RulesSummary;
  cachedAt: number;
}

export class RulesCache {
  private static readonly CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

  constructor(
    private storage: StorageProvider,
    private redditClient: RedditClient
  ) {}

  async getRules(subreddit: string): Promise<RulesSummary> {
    const cacheKey = StorageKeys.rulesCache(subreddit);
    
    try {
      const cached = await this.storage.readJSON<CachedRules>(cacheKey);
      
      if (cached && this.isCacheValid(cached.cachedAt)) {
        return cached.rules;
      }
    } catch (error) {
      console.error(`Error reading cached rules for r/${subreddit}:`, error);
    }

    // Cache miss or expired, fetch fresh rules
    try {
      const rules = await this.redditClient.getSubredditRules(subreddit);
      
      // Cache the result
      await this.storage.writeJSON<CachedRules>(cacheKey, {
        rules,
        cachedAt: Date.now(),
      });
      
      return rules;
    } catch (error) {
      console.error(`Error fetching rules for r/${subreddit}:`, error);
      
      // Return conservative defaults if we can't fetch rules
      return {
        linksAllowed: false,
        vendorDisclosureRequired: true,
        linkLimit: 1,
        notes: ['Failed to fetch rules - using conservative defaults'],
      };
    }
  }

  private isCacheValid(cachedAt: number): boolean {
    return Date.now() - cachedAt < RulesCache.CACHE_DURATION_MS;
  }

  async clearCache(subreddit?: string): Promise<void> {
    if (subreddit) {
      // Clear specific subreddit cache
      const cacheKey = StorageKeys.rulesCache(subreddit);
      try {
        await this.storage.writeJSON(cacheKey, null);
      } catch (error) {
        console.error(`Error clearing cache for r/${subreddit}:`, error);
      }
    } else {
      // Clear all cached rules
      try {
        const cacheKeys = await this.storage.list('cache/rules/');
        
        for (const key of cacheKeys) {
          await this.storage.writeJSON(key, null);
        }
      } catch (error) {
        console.error('Error clearing all rules cache:', error);
      }
    }
  }
}