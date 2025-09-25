export type CandidateThread = {
  id: string;
  sub: string;
  title: string;
  author: string;
  permalink: string;
  createdUtc: number;
  upvotes: number;
  comments: number;
};

export type FullThread = CandidateThread & {
  body: string;
  topComments: { 
    author: string; 
    body: string;
    score: number;
    createdUtc: number;
  }[];
};

export type RulesSummary = {
  linksAllowed: boolean;
  vendorDisclosureRequired: boolean;
  linkLimit: number | null;
  notes: string[];
};

type RedditSubredditData = {
  display_name: string;
  subscribers: number;
  subreddit_type: string;
};

type RedditSubredditChild = {
  data: RedditSubredditData;
};

type RedditCommentData = {
  author: string;
  body: string;
  score: number;
  created_utc: number;
};

type RedditComment = {
  data: RedditCommentData;
};

export class RedditClient {
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor(
    private clientId?: string,
    private clientSecret?: string,
    private userAgent: string = 'ThreadScout/1.0'
  ) {}

  private async getAccessToken(): Promise<string | null> {
    if (!this.clientId || !this.clientSecret) {
      console.log('⚠️  No Reddit credentials - will use public API');
      return null;
    }

    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
      
      console.log('🔑 Getting Reddit OAuth token...');
      const response = await fetch('https://www.reddit.com/api/v1/access_token', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'User-Agent': this.userAgent,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Reddit auth failed: ${response.status} - ${errorText}`);
        throw new Error(`Reddit auth failed: ${response.status}`);
      }

      const data = await response.json();
      this.accessToken = data.access_token;
      this.tokenExpiry = Date.now() + (data.expires_in * 1000) - 30000; // 30s buffer
      
      console.log('✅ Reddit OAuth token obtained');
      return this.accessToken;
    } catch (error) {
      console.error('Failed to get Reddit access token:', error);
      return null;
    }
  }

  private async makeRequest(endpoint: string): Promise<unknown> {
    const token = await this.getAccessToken();
    
    const headers: Record<string, string> = {
      'User-Agent': this.userAgent,
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
      console.log('🔐 Using OAuth token for request');
    } else {
      console.log('🌐 Using public API (no auth)');
    }

    const response = await fetch(endpoint, { 
      headers,
      // Add a timeout to prevent hanging requests
      signal: AbortSignal.timeout(10000) // 10 second timeout
    });
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error(`Reddit API error ${response.status}: ${errorText}`);
      
      // If 403 and we have credentials, the credentials might be bad
      if (response.status === 403 && token) {
        console.error('❌ 403 with OAuth token - check your Reddit app credentials');
        this.accessToken = null; // Reset token to force refresh next time
      }
      
      throw new Error(`Reddit API error: ${response.status}`);
    }

    return response.json();
  }

  async searchThreads(
    subs: string[], 
    keywords: string[], 
    lookbackHours: number
  ): Promise<CandidateThread[]> {
    const candidates: CandidateThread[] = [];
    const cutoffTime = Math.floor((Date.now() - (lookbackHours * 60 * 60 * 1000)) / 1000);
    
    console.log(`🔍 Searching Reddit: subs=${subs.join(',')} keywords=${keywords.join(',')} lookback=${lookbackHours}h`);
    console.log(`⏰ Cutoff time: ${new Date(cutoffTime * 1000).toISOString()}`);

    for (const sub of subs) {
      try {
        // Get token to determine which API domain to use
        const token = await this.getAccessToken();
        
        // Search using Reddit's search API
        const query = keywords.join(' OR ');
        const baseUrl = token ? 'https://oauth.reddit.com' : 'https://www.reddit.com';
        const searchUrl = `${baseUrl}/r/${sub}/search.json?q=${encodeURIComponent(query)}&restrict_sr=1&sort=new&t=week&limit=100`;
        
        console.log(`🌐 Fetching: ${searchUrl}`);
        const data = await this.makeRequest(searchUrl);
        
        console.log(`📊 Reddit API response for r/${sub}: ${data?.data?.children?.length || 0} posts`);
        
        if (data?.data?.children) {
          let timeFiltered = 0;
          let keywordFiltered = 0;
          let stickyFiltered = 0;
          
          for (const post of data.data.children) {
            const postData = post.data;
            
            if (postData.stickied) {
              stickyFiltered++;
              continue;
            }
            
            if (postData.created_utc < cutoffTime) {
              timeFiltered++;
              continue;
            }
            
            // Check if any keywords match in title or body
            const searchText = `${postData.title} ${postData.selftext || ''}`.toLowerCase();
            const hasKeywordMatch = keywords.some(keyword => 
              searchText.includes(keyword.toLowerCase())
            );
            
            if (!hasKeywordMatch) {
              keywordFiltered++;
              continue;
            }

            console.log(`✅ Found match: "${postData.title}" (${postData.score} upvotes, ${postData.num_comments} comments)`);
            
            candidates.push({
              id: postData.id,
              sub: postData.subreddit,
              title: postData.title,
              author: postData.author,
              permalink: postData.permalink,
              createdUtc: postData.created_utc,
              upvotes: postData.score || 0,
              comments: postData.num_comments || 0,
            });
          }
          
          console.log(`🔍 r/${sub} filtering: ${stickyFiltered} sticky, ${timeFiltered} too old, ${keywordFiltered} no keyword match`);
        }
      } catch (error) {
        console.error(`Failed to search r/${sub}:`, error);
        // Continue with other subreddits even if one fails
      }
    }

    console.log(`🎯 Total candidates found: ${candidates.length}`);
    
    // Sort by recency and engagement
    const sorted = candidates
      .sort((a, b) => {
        const scoreA = (a.createdUtc / 3600) + (a.upvotes * 0.1) + (a.comments * 0.2);
        const scoreB = (b.createdUtc / 3600) + (b.upvotes * 0.1) + (b.comments * 0.2);
        return scoreB - scoreA;
      })
      .slice(0, 50); // Limit to top 50 candidates
      
    console.log(`📋 Returning ${sorted.length} sorted candidates`);
    return sorted;
  }

  async getThread(permalink: string): Promise<FullThread> {
    try {
      const token = await this.getAccessToken();
      
      // Ensure permalink ends with .json for full thread data
      const cleanPermalink = permalink.replace(/\.json$/, ''); // Remove .json if already there
      const baseUrl = token ? 'https://oauth.reddit.com' : 'https://www.reddit.com';
      const url = `${baseUrl}${cleanPermalink}.json`;
      
      console.log(`📖 Fetching full thread: ${url}`);
      const data = await this.makeRequest(url);
      
      const postData = data[0]?.data?.children?.[0]?.data;
      const commentsData = data[1]?.data?.children || [];
      
      if (!postData) {
        throw new Error('Thread not found');
      }

      console.log(`💬 Thread has ${commentsData.length} top-level comments`);

      // Get more comments and include deeper analysis
      const topComments = commentsData
        .slice(0, 10) // Get top 10 comments instead of 5
        .filter((comment: RedditComment) => comment.data?.body && comment.data.body !== '[deleted]' && comment.data.body !== '[removed]')
        .map((comment: RedditComment) => ({
          author: comment.data.author,
          body: comment.data.body.slice(0, 800), // Longer excerpts for better context
          score: comment.data.score || 0,
          createdUtc: comment.data.created_utc,
        }))
        .sort((a, b) => b.score - a.score); // Sort by score for most relevant comments

      return {
        id: postData.id,
        sub: postData.subreddit,
        title: postData.title,
        author: postData.author,
        permalink: postData.permalink,
        createdUtc: postData.created_utc,
        upvotes: postData.score || 0,
        comments: postData.num_comments || 0,
        body: postData.selftext || '',
        topComments,
      };
    } catch (error) {
      console.error(`Failed to get thread ${permalink}:`, error);
      throw error;
    }
  }

  async getSubredditRules(sub: string): Promise<RulesSummary> {
    try {
      const rulesUrl = `https://www.reddit.com/r/${sub}/about/rules.json`;
      const aboutUrl = `https://www.reddit.com/r/${sub}/about.json`;
      
      const [rulesData, aboutData] = await Promise.all([
        this.makeRequest(rulesUrl).catch(() => ({ rules: [] })),
        this.makeRequest(aboutUrl).catch(() => ({ data: {} })),
      ]);

      const rules = rulesData.rules || [];
      const subredditData = aboutData.data || {};
      
      // Parse rules to determine link policy
      let linksAllowed = true;
      let vendorDisclosureRequired = false;
      let linkLimit: number | null = null;
      const notes: string[] = [];

      // Check submission requirements and rules
      const submissionText = subredditData.submission_type || '';
      const description = subredditData.public_description || '';
      
      for (const rule of rules) {
        const ruleText = `${rule.short_name || ''} ${rule.description || ''}`.toLowerCase();
        
        if (ruleText.includes('no link') || ruleText.includes('no url') || ruleText.includes('no spam')) {
          linksAllowed = false;
          notes.push('No links allowed');
        }
        
        if (ruleText.includes('disclosure') || ruleText.includes('affiliate') || ruleText.includes('promotion')) {
          vendorDisclosureRequired = true;
          notes.push('Vendor disclosure required');
        }
        
        if (ruleText.includes('one link') || ruleText.includes('single link')) {
          linkLimit = 1;
        }
        
        if (ruleText.includes('friday') && (ruleText.includes('no promo') || ruleText.includes('no promotion'))) {
          notes.push('No promo Fridays');
        }
      }

      // Check if subreddit only allows text posts
      if (submissionText === 'self') {
        notes.push('Text posts only');
      }

      return {
        linksAllowed,
        vendorDisclosureRequired,
        linkLimit,
        notes,
      };
    } catch (error) {
      console.error(`Failed to get rules for r/${sub}:`, error);
      
      // Return conservative defaults on failure
      return {
        linksAllowed: false,
        vendorDisclosureRequired: true,
        linkLimit: 1,
        notes: ['Failed to fetch rules - using conservative defaults'],
      };
    }
  }

  async searchSubreddits(query: string, limit: number = 10): Promise<Array<{name: string, subscribers: number, displayName: string}>> {
    // Helper function to format subscriber count (round up to next integer)
    const formatSubscribers = (count: number): string => {
      if (count >= 1000000) {
        return Math.ceil(count / 1000000) + 'M';
      } else if (count >= 1000) {
        return Math.ceil(count / 1000) + 'K';
      } else {
        return count.toString();
      }
    };

    try {
      // Use Reddit's public search API to find subreddits (no auth needed)
      const url = `https://www.reddit.com/subreddits/search.json?q=${encodeURIComponent(query)}&limit=5&type=sr&include_over_18=off`;
      
      // Make a direct fetch request with proper headers (bypass OAuth)
      const response = await fetch(url, {
        headers: {
          'User-Agent': this.userAgent,
        },
      });

      if (!response.ok) {
        // If we get a 403, 429, or other rate limit/access error, fall back to local search
        if (response.status === 403 || response.status === 429 || response.status === 401) {
          console.warn(`Reddit API returned ${response.status}, falling back to local search`);
          throw new Error(`Rate limited or access denied: ${response.status}`);
        }
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      
      if (data?.data?.children) {
        return data.data.children
          .map((child: RedditSubredditChild) => {
            const subredditData = child.data;
            return {
              name: subredditData.display_name,
              subscribers: subredditData.subscribers || 0,
              subredditType: subredditData.subreddit_type,
              displayName: `${subredditData.display_name} (${formatSubscribers(subredditData.subscribers || 0)} Subs)`
            };
          })
          .filter((sub) => 
            sub.name && 
            typeof sub.name === 'string' && 
            sub.subredditType === 'public' // Only include public subreddits
          )
          .slice(0, limit);
      }
      
      return [];
    } catch (error) {
      console.error('Failed to search subreddits:', error);
      // Fallback to basic string matching if API fails
      const commonSubs = [
        'linkedin', 'linkedinads', 'linkedintips', 'webdev', 'reactjs', 'javascript', 
        'programming', 'webdesign', 'startups', 'entrepreneur', 'smallbusiness', 
        'marketing', 'seo', 'learnprogramming', 'Frontend', 'Backend', 'DevOps',
        'MachineLearning', 'artificial', 'webDevelopment', 'ProgrammerHumor',
        'SaaS', 'saas', 'software', 'microsaas', 'indiehackers', 'nocode', 
        'lowcode', 'productivity', 'business', 'analytics', 'automation',
        'apis', 'databases', 'cloud', 'aws', 'azure', 'googlecloud'
      ];
      
      const lowerQuery = query.toLowerCase();
      return commonSubs
        .filter(sub => sub.toLowerCase().includes(lowerQuery))
        .slice(0, limit)
        .map(name => ({ name, subscribers: 0, displayName: name }));
    }
  }
}