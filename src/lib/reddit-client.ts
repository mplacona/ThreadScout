import { RedditThread, SubredditRules, SearchFilters } from "@/types/reddit";

// Mock Reddit client for development
export class RedditClient {
  private isDevelopment = import.meta.env.DEV;

  async searchThreads(filters: SearchFilters): Promise<RedditThread[]> {
    if (this.isDevelopment) {
      return this.getMockThreads(filters);
    }
    
    // TODO: Implement actual Reddit API calls
    throw new Error("Reddit API not implemented yet");
  }

  async getSubredditRules(subreddit: string): Promise<SubredditRules> {
    if (this.isDevelopment) {
      return this.getMockRules(subreddit);
    }
    
    // TODO: Implement actual Reddit API calls
    throw new Error("Reddit API not implemented yet");
  }

  private getMockThreads(filters: SearchFilters): RedditThread[] {
    const mockThreads: RedditThread[] = [
      {
        id: "thread_1",
        title: "Best practices for API rate limiting in production?",
        author: "dev_looking_for_help",
        subreddit: "webdev",
        permalink: "/r/webdev/comments/abc123/best_practices_for_api_rate_limiting/",
        url: "https://reddit.com/r/webdev/comments/abc123/best_practices_for_api_rate_limiting/",
        selftext: "I'm building a REST API that's getting hammered with requests. What are the best practices for implementing rate limiting? Looking for both technical solutions and policy recommendations.",
        score: 34,
        num_comments: 12,
        created_utc: Date.now() / 1000 - 3600, // 1 hour ago
        upvote_ratio: 0.89
      },
      {
        id: "thread_2", 
        title: "How to monitor microservices effectively?",
        author: "startup_cto",
        subreddit: "devops",
        permalink: "/r/devops/comments/def456/how_to_monitor_microservices_effectively/",
        url: "https://reddit.com/r/devops/comments/def456/how_to_monitor_microservices_effectively/",
        selftext: "We have 15 microservices running in production and our current monitoring is a mess. What tools and strategies do you recommend for getting visibility into the whole system?",
        score: 67,
        num_comments: 23,
        created_utc: Date.now() / 1000 - 7200, // 2 hours ago  
        upvote_ratio: 0.92
      },
      {
        id: "thread_3",
        title: "Choosing between cloud providers for new startup",
        author: "founding_engineer",
        subreddit: "startups",
        permalink: "/r/startups/comments/ghi789/choosing_between_cloud_providers/",
        url: "https://reddit.com/r/startups/comments/ghi789/choosing_between_cloud_providers/",
        selftext: "We're launching our MVP next month and need to decide on cloud infrastructure. Budget is tight but we need something that can scale. What would you recommend?",
        score: 45,
        num_comments: 31,
        created_utc: Date.now() / 1000 - 1800, // 30 minutes ago
        upvote_ratio: 0.85
      }
    ];

    // Filter by subreddits
    const filtered = mockThreads.filter(thread => 
      filters.subreddits.length === 0 || 
      filters.subreddits.includes(thread.subreddit)
    );

    return filtered;
  }

  private getMockRules(subreddit: string): SubredditRules {
    const rulesets: Record<string, SubredditRules> = {
      webdev: {
        subreddit: "webdev",
        rules: [
          { kind: "link", description: "Links to your own content are allowed if you participate in the community", short_name: "Self-promotion OK with participation" },
          { kind: "text", description: "Be respectful and constructive", short_name: "Be respectful" }
        ],
        description: "A subreddit for web developers to discuss technologies, tools, and best practices.",
        links_allowed: true,
        vendor_disclosure_required: true,
        link_limit: 1,
        notes: "Active community, disclosure required for commercial links"
      },
      devops: {
        subreddit: "devops", 
        rules: [
          { kind: "link", description: "No promotional content without prior approval", short_name: "No unsolicited promotion" },
          { kind: "text", description: "Keep discussions technical and relevant", short_name: "Stay technical" }
        ],
        description: "DevOps practices, tools, and culture discussion.",
        links_allowed: false,
        vendor_disclosure_required: true,
        link_limit: 0,
        no_promo_days: 30,
        notes: "Strict on promotion, focus on helping"
      },
      startups: {
        subreddit: "startups",
        rules: [
          { kind: "link", description: "Helpful resources are welcome", short_name: "Helpful resources OK" },
          { kind: "text", description: "No spam or excessive self-promotion", short_name: "No spam" }
        ],
        description: "Community for startup founders and early employees.",
        links_allowed: true,
        vendor_disclosure_required: false,
        link_limit: 2,
        notes: "Entrepreneur-friendly, resources appreciated"
      }
    };

    return rulesets[subreddit] || {
      subreddit,
      rules: [],
      description: "",
      links_allowed: false,
      vendor_disclosure_required: true,
      link_limit: 0,
      notes: "Rules unknown - help only recommended"
    };
  }
}

export const redditClient = new RedditClient();