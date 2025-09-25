export interface RedditThread {
  id: string;
  title: string;
  author: string;
  subreddit: string;
  permalink: string;
  url: string;
  selftext: string;
  score: number;
  num_comments: number;
  created_utc: number;
  upvote_ratio: number;
}

export interface SubredditRules {
  subreddit: string;
  rules: Array<{
    kind: string;
    description: string;
    short_name: string;
  }>;
  description: string;
  links_allowed: boolean;
  vendor_disclosure_required: boolean;
  link_limit: number;
  no_promo_days?: number;
  notes?: string;
}

export interface OpportunityScore {
  thread_id: string;
  score: number;
  why_fit: string;
  rule_risk: string[];
}

export interface ReplyDraft {
  thread_id: string;
  variant_a: {
    text: string;
    type: "help_only";
  };
  variant_b: {
    text: string;
    type: "help_with_link";
    disclosure: string;
    links: string[];
  };
}

export interface SearchFilters {
  subreddits: string[];
  keywords: string[];
  lookback_hours: number;
  min_score?: number;
  sort_by?: "hot" | "new" | "top";
}