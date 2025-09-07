import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ThreadSearch } from "@/components/thread-search";
import { ThreadCard } from "@/components/thread-card";
import { useToast } from "@/hooks/use-toast";
import { RedditThread, OpportunityScore, ReplyDraft, SubredditRules, SearchFilters } from "@/types/reddit";
import { redditClient } from "@/lib/reddit-client";
import { agentClient } from "@/lib/agent-client";

interface ThreadWithData {
  thread: RedditThread;
  opportunity: OpportunityScore;
  draft: ReplyDraft;
  rules: SubredditRules;
}

const Index = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [threads, setThreads] = useState<ThreadWithData[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleSearch = async (filters: SearchFilters) => {
    setIsLoading(true);
    try {
      // Fetch threads from Reddit
      const foundThreads = await redditClient.searchThreads(filters);
      
      // Process each thread with AI scoring and draft generation
      const threadsWithData: ThreadWithData[] = [];
      
      for (const thread of foundThreads) {
        try {
          const rules = await redditClient.getSubredditRules(thread.subreddit);
          const { opportunity, draft } = await agentClient.scoreAndDraft(
            thread,
            rules,
            ["digitalocean.com", "docs.digitalocean.com"]
          );
          
          threadsWithData.push({
            thread,
            opportunity,
            draft,
            rules
          });
        } catch (error) {
          console.error(`Error processing thread ${thread.id}:`, error);
        }
      }
      
      // Sort by opportunity score
      threadsWithData.sort((a, b) => b.opportunity.score - a.opportunity.score);
      
      setThreads(threadsWithData);
      
      toast({
        title: "Search Complete",
        description: `Found ${threadsWithData.length} relevant threads`
      });
    } catch (error) {
      console.error("Search error:", error);
      toast({
        title: "Search Error",
        description: "Failed to search threads. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewDetails = (threadId: string) => {
    navigate(`/thread/${threadId}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-4 max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">ThreadScout</h1>
          <p className="text-muted-foreground">
            Find high-intent Reddit threads where your product can help. 
            Search, analyze, and draft helpful replies.
          </p>
        </div>

        {/* Search Controls */}
        <ThreadSearch onSearch={handleSearch} isLoading={isLoading} />

        {/* Results */}
        {threads.length > 0 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Search Results</h2>
              <p className="text-sm text-muted-foreground">
                {threads.length} threads found, sorted by opportunity score
              </p>
            </div>

            <div className="grid gap-4">
              {threads.map(({ thread, opportunity, rules }) => (
                <ThreadCard
                  key={thread.id}
                  thread={thread}
                  opportunity={opportunity}
                  rules={rules}
                  onViewDetails={handleViewDetails}
                />
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && threads.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              Use the search controls above to find Reddit threads where your product can help.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;
