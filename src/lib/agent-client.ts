import { RedditThread, SubredditRules, OpportunityScore, ReplyDraft } from "@/types/reddit";
import { extractLinks } from "@/lib/linkValidator";

interface AgentResponse {
  score: number;
  why_fit: string;
  risks: string[];
  variantA: { text: string };
  variantB: { text: string; disclosure: string };
}

export class AgentClient {
  private apiKey = import.meta.env.VITE_AGENT_API_KEY;
  private endpoint = import.meta.env.VITE_AGENT_ENDPOINT_URL;

  async scoreAndDraft(
    thread: RedditThread,
    rules: SubredditRules,
    allowlistedDomains: string[]
  ): Promise<{ opportunity: OpportunityScore; draft: ReplyDraft }> {
    if (!this.apiKey || !this.endpoint) {
      throw new Error("Agent API credentials not configured");
    }

    // Send structured data to trained DigitalOcean Gradient AI agent
    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        thread: {
          title: thread.title,
          content: thread.selftext,
          subreddit: thread.subreddit,
          author: thread.author,
          score: thread.score,
          num_comments: thread.num_comments
        },
        rules,
        allowlistedDomains
      })
    });

    if (!response.ok) {
      throw new Error(`Agent API error: ${response.statusText}`);
    }

    const agentResult: AgentResponse = await response.json();
    return this.transformResponse(thread, agentResult);
  }



  private transformResponse(thread: RedditThread, response: AgentResponse): { opportunity: OpportunityScore; draft: ReplyDraft } {
    const opportunity: OpportunityScore = {
      thread_id: thread.id,
      score: response.score,
      why_fit: response.why_fit,
      rule_risk: response.risks
    };

    const draft: ReplyDraft = {
      thread_id: thread.id,
      variant_a: {
        text: response.variantA.text,
        type: "help_only"
      },
      variant_b: {
        text: response.variantB.text,
        type: "help_with_link",
        disclosure: response.variantB.disclosure,
        links: extractLinks(response.variantB.text)
      }
    };

    return { opportunity, draft };
  }



}

export const agentClient = new AgentClient();