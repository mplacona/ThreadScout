import { RedditThread, SubredditRules, OpportunityScore, ReplyDraft } from "@/types/reddit";

interface AgentResponse {
  score: number;
  why_fit: string;
  rules_summary: string[];
  risks: string[];
  variantA: { text: string };
  variantB: { text: string; disclosure: string };
}

export class AgentClient {
  private isDevelopment = import.meta.env.DEV;
  private apiKey = import.meta.env.VITE_AGENT_API_KEY;
  private endpoint = import.meta.env.VITE_AGENT_ENDPOINT_URL;

  async scoreAndDraft(
    thread: RedditThread, 
    rules: SubredditRules, 
    allowlistedDomains: string[]
  ): Promise<{ opportunity: OpportunityScore; draft: ReplyDraft }> {
    
    if (this.isDevelopment) {
      return this.getMockResponse(thread, rules);
    }

    if (!this.apiKey || !this.endpoint) {
      throw new Error("Agent API credentials not configured");
    }

    // TODO: Implement actual API call to DigitalOcean Gradient Agents
    const prompt = this.buildPrompt(thread, rules, allowlistedDomains);
    
    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ prompt })
    });

    if (!response.ok) {
      throw new Error(`Agent API error: ${response.statusText}`);
    }

    const agentResult: AgentResponse = await response.json();
    return this.transformResponse(thread, agentResult);
  }

  private buildPrompt(thread: RedditThread, rules: SubredditRules, allowlist: string[]): string {
    return `Identity: You are ThreadScout. You surface Reddit threads where our product can help and draft helpful, transparent replies.

Objective: Summarize the user need. Check subreddit rules. Score 0 to 100 with rationale. Produce two drafts:
- Variant A: help only, no links.
- Variant B: help plus one allowlisted link and a short disclosure.

Restrictions: one link max, use allowlist only (${allowlist.join(", ")}), never invent claims or benchmarks, English only. If rules are unclear, prepare help-only and mark as Help-only.

Thread: "${thread.title}"
Content: "${thread.selftext}"
Subreddit: r/${thread.subreddit}
Rules: ${JSON.stringify(rules)}

Output JSON shape:
{
  score: number,
  why_fit: string,
  rules_summary: string[],
  risks: string[],
  variantA: { text: string },
  variantB: { text: string, disclosure: string }
}`;
  }

  private getMockResponse(thread: RedditThread, rules: SubredditRules): { opportunity: OpportunityScore; draft: ReplyDraft } {
    const scores: Record<string, number> = {
      "thread_1": 85,
      "thread_2": 72,
      "thread_3": 91
    };

    const mockTexts: Record<string, { variantA: string; variantB: string }> = {
      "thread_1": {
        variantA: "Rate limiting is crucial for API stability. Here are 3 concrete steps:\n\n1. Implement token bucket algorithm with configurable limits per endpoint\n2. Add rate limit headers (X-RateLimit-*) so clients know their status\n3. Use Redis for distributed rate limiting across multiple servers\n\nStart with conservative limits and monitor your metrics to adjust.",
        variantB: "Rate limiting is crucial for API stability. Here are 3 concrete steps:\n\n1. Implement token bucket algorithm with configurable limits per endpoint\n2. Add rate limit headers (X-RateLimit-*) so clients know their status  \n3. Use Redis for distributed rate limiting across multiple servers\n\nFor production-grade solutions, DigitalOcean's managed databases work well for Redis clustering. Start with conservative limits and monitor your metrics to adjust.\n\nDisclosure: I work with cloud infrastructure tools."
      },
      "thread_2": {
        variantA: "Microservices monitoring requires a multi-layer approach:\n\n1. Centralized logging with structured JSON logs\n2. Distributed tracing to follow requests across services\n3. Service mesh for automatic metrics collection\n\nStart with ELK stack or similar for logs, then add Jaeger for tracing. Focus on golden signals: latency, traffic, errors, saturation.",
        variantB: "Microservices monitoring requires a multi-layer approach:\n\n1. Centralized logging with structured JSON logs\n2. Distributed tracing to follow requests across services\n3. Service mesh for automatic metrics collection\n\nDigitalOcean's managed Kubernetes includes monitoring tools that can help with the infrastructure layer. Start with ELK stack or similar for logs, then add Jaeger for tracing.\n\nDisclosure: I work with cloud infrastructure tools."
      },
      "thread_3": {
        variantA: "For startup cloud choice, consider these factors:\n\n1. Start simple with managed services to reduce ops overhead\n2. Pick a provider with good startup credits and support\n3. Ensure the platform can scale without major rewrites\n\nFocus on time-to-market over premature optimization. Most providers offer similar core services, so developer experience and pricing matter more initially.",
        variantB: "For startup cloud choice, consider these factors:\n\n1. Start simple with managed services to reduce ops overhead\n2. Pick a provider with good startup credits and support\n3. Ensure the platform can scale without major rewrites\n\nDigitalOcean offers competitive startup packages and simpler pricing than the big three. Focus on time-to-market over premature optimization initially.\n\nDisclosure: I work with cloud infrastructure tools."
      }
    };

    const score = scores[thread.id] || 75;
    const texts = mockTexts[thread.id] || mockTexts["thread_1"];

    const opportunity: OpportunityScore = {
      thread_id: thread.id,
      score,
      why_fit: this.generateWhyFit(thread, score),
      rule_risk: this.assessRuleRisks(rules),
      intent_clarity: Math.min(score + 10, 100),
      product_fit: score - 5,
      timing_score: this.calculateTimingScore(thread),
      community_safety: rules.links_allowed ? 85 : 60
    };

    const draft: ReplyDraft = {
      thread_id: thread.id,
      variant_a: {
        text: texts.variantA,
        type: "help_only"
      },
      variant_b: {
        text: texts.variantB,
        type: "help_with_link",
        disclosure: "Disclosure: I work with cloud infrastructure tools.",
        links: ["https://digitalocean.com"]
      }
    };

    return { opportunity, draft };
  }

  private transformResponse(thread: RedditThread, response: AgentResponse): { opportunity: OpportunityScore; draft: ReplyDraft } {
    const opportunity: OpportunityScore = {
      thread_id: thread.id,
      score: response.score,
      why_fit: response.why_fit,
      rule_risk: response.risks,
      intent_clarity: response.score,
      product_fit: response.score,
      timing_score: this.calculateTimingScore(thread),
      community_safety: 75
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
        links: this.extractLinks(response.variantB.text)
      }
    };

    return { opportunity, draft };
  }

  private generateWhyFit(thread: RedditThread, score: number): string {
    if (score > 80) return "High-intent technical question with clear product fit";
    if (score > 60) return "Good technical discussion, moderate product relevance";
    return "General question, limited product fit opportunity";
  }

  private assessRuleRisks(rules: SubredditRules): string[] {
    const risks: string[] = [];
    if (!rules.links_allowed) risks.push("No links allowed");
    if (rules.no_promo_days) risks.push(`No promo for ${rules.no_promo_days} days`);
    if (rules.vendor_disclosure_required) risks.push("Disclosure required");
    return risks;
  }

  private calculateTimingScore(thread: RedditThread): number {
    const ageHours = (Date.now() / 1000 - thread.created_utc) / 3600;
    if (ageHours < 2) return 95;
    if (ageHours < 6) return 85;
    if (ageHours < 24) return 70;
    return 50;
  }

  private extractLinks(text: string): string[] {
    const linkRegex = /https?:\/\/[^\s]+/g;
    return text.match(linkRegex) || [];
  }
}

export const agentClient = new AgentClient();