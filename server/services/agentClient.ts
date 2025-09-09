import type { FullThread, RulesSummary } from './redditClient.js';

export interface AgentResponse {
  score: number;
  whyFit: string;
  rulesSummary: string[];
  risks: string[];
  variantA: { text: string };
  variantB: { text: string; disclosure?: string };
}

export interface AgentRequest {
  thread: FullThread;
  rules: RulesSummary;
  docsContext?: string;
  allowlist: string[];
}

export class AgentClient {
  constructor(
    private endpointUrl?: string,
    private apiKey?: string
  ) {}

  async scoreAndDraft(
    thread: FullThread,
    rules: RulesSummary,
    docsContext: string = '',
    allowlist: string[]
  ): Promise<AgentResponse> {
    console.log(`🤖 AgentClient.scoreAndDraft called for thread: ${thread.title}`);
    console.log(`📊 Thread data: ${thread.body?.length || 0} chars body, ${thread.topComments.length} comments`);
    
    if (!this.endpointUrl || !this.apiKey) {
      console.log(`⚠️  No agent credentials - using mock response`);
      return this.getMockResponse(thread, rules, allowlist);
    }
    
    console.log(`🌐 Calling real agent at: ${this.endpointUrl}/api/v1/chat/completions`);

    try {
      // Create a detailed prompt for the agent
      const prompt = this.createAgentPrompt(thread, rules, docsContext, allowlist);
      
      const chatRequest = {
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 3000,
        stream: false
      };

      const response = await fetch(`${this.endpointUrl}/api/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(chatRequest),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error(`Agent API error ${response.status}: ${errorText}`);
        throw new Error(`Agent API error: ${response.status}`);
      }

      const data = await response.json();
      console.log(`✅ Agent response received, processing...`);
      
      // Parse the agent response and convert to our format
      const agentResponse = this.parseAgentResponse(data, thread, rules, allowlist);
      
      return agentResponse;
    } catch (error: unknown) {
      console.error('Agent client error:', error);
      return this.getMockResponse(thread, rules, allowlist);
    }
  }

  private createAgentPrompt(
    thread: FullThread, 
    rules: RulesSummary, 
    docsContext: string, 
    allowlist: string[]
  ): string {
    return `You are an expert at analyzing Reddit threads and creating helpful responses that build trust and provide value.

THREAD TO ANALYZE:
Title: ${thread.title}
Subreddit: r/${thread.sub}
Author: ${thread.author}
Upvotes: ${thread.upvotes}, Comments: ${thread.comments}
Body: ${thread.body || '(No body text)'}

TOP COMMENTS:
${thread.topComments.map(comment => 
  `- ${comment.author}: ${comment.body.slice(0, 200)}... (${comment.score} upvotes)`
).join('\n')}

SUBREDDIT RULES:
- Links allowed: ${rules.linksAllowed}
- Vendor disclosure required: ${rules.vendorDisclosureRequired}
- Link limit: ${rules.linkLimit || 'No limit'}
- Additional notes: ${rules.notes.join(', ') || 'None'}

${allowlist.length > 0 ? `ALLOWED DOMAINS: ${allowlist.join(', ')}` : 'NO DOMAIN RESTRICTIONS'}

TASK:
Analyze this thread and provide a JSON response with the following structure:
{
  "score": number (1-100, how good an opportunity this is),
  "whyFit": "Brief explanation of why this is a good/bad opportunity",
  "rulesSummary": ["array", "of", "key", "rules"],
  "risks": ["potential", "risks", "or", "concerns"],
  "variantA": {
    "text": "Helpful response with no links - focus on being genuinely useful"
  },
  "variantB": {
    "text": "Helpful response with a relevant link if appropriate",
    "disclosure": "Optional disclosure statement if needed"
  }
}

Make both variants genuinely helpful and focused on the user's needs. If links aren't allowed, make variantB the same as variantA.`;
  }

  private parseAgentResponse(
    data: any, 
    thread: FullThread, 
    rules: RulesSummary, 
    allowlist: string[]
  ): AgentResponse {
    try {
      // The response should be in the format: { choices: [{ message: { content: "..." } }] }
      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error('No content in agent response');
      }

      // Try to parse the JSON content
      let parsed;
      try {
        parsed = JSON.parse(content);
      } catch (parseError) {
        console.warn('Failed to parse agent JSON response, using mock');
        throw new Error('Invalid JSON in agent response');
      }

      // Validate the parsed response has the expected structure
      if (this.isValidAgentResponse(parsed)) {
        console.log(`🎯 Agent provided score: ${parsed.score}/100`);
        return parsed;
      } else {
        console.warn('Agent response missing required fields, using mock');
        throw new Error('Invalid agent response structure');
      }
    } catch (error) {
      console.warn('Error parsing agent response:', error);
      return this.getMockResponse(thread, rules, allowlist);
    }
  }

  private isValidAgentResponse(data: any): data is AgentResponse {
    return (
      typeof data.score === 'number' &&
      typeof data.whyFit === 'string' &&
      Array.isArray(data.rulesSummary) &&
      Array.isArray(data.risks) &&
      typeof data.variantA?.text === 'string' &&
      typeof data.variantB?.text === 'string'
    );
  }

  private getMockResponse(
    thread: FullThread,
    rules: RulesSummary,
    allowlist: string[]
  ): AgentResponse {
    // Generate a deterministic but varied score based on thread characteristics
    const titleWords = thread.title.toLowerCase().split(' ');
    const hasQuestion = thread.title.includes('?') || titleWords.includes('how') || titleWords.includes('what');
    const hasHelpKeywords = ['help', 'problem', 'issue', 'error', 'stuck'].some(word => 
      titleWords.includes(word)
    );
    
    let baseScore = 45;
    if (hasQuestion) baseScore += 20;
    if (hasHelpKeywords) baseScore += 15;
    if (thread.upvotes > 5) baseScore += 10;
    if (thread.comments > 3) baseScore += 5;
    
    const score = Math.min(85, Math.max(25, baseScore + (thread.id.charCodeAt(0) % 20) - 10));

    const whyFit = hasQuestion 
      ? 'User is asking a direct question that our product could help answer'
      : hasHelpKeywords
      ? 'User is experiencing a problem that our product might solve'
      : 'Thread shows moderate engagement and relevant topic discussion';

    const rulesSummary: string[] = [];
    if (!rules.linksAllowed) rulesSummary.push('No links allowed');
    if (rules.vendorDisclosureRequired) rulesSummary.push('Vendor disclosure required');
    if (rules.linkLimit) rulesSummary.push(`Maximum ${rules.linkLimit} link(s)`);
    rulesSummary.push(...rules.notes);

    const risks: string[] = [];
    if (!rules.linksAllowed) risks.push('Links not permitted in this subreddit');
    if (thread.upvotes < 2) risks.push('Low engagement thread');

    // Generate helpful variant A (no links)
    const variantA = {
      text: this.generateVariantA(thread)
    };

    // Generate variant B with link (if allowed)
    const variantB = this.generateVariantB(thread, rules.linksAllowed, allowlist);

    return {
      score,
      whyFit,
      rulesSummary,
      risks,
      variantA,
      variantB,
    };
  }

  private generateVariantA(thread: FullThread): string {
    const isQuestion = thread.title.includes('?');
    
    if (isQuestion) {
      return `Here are 3 steps that might help with your question:

1. First, try checking if there are any error messages or logs that could give more specific details about what's happening
2. Look through the official documentation for any similar examples or troubleshooting guides
3. Consider creating a minimal test case to isolate the specific part that's not working

Let me know if you need clarification on any of these steps!`;
    }

    return `I've run into similar challenges before. Here are some approaches that have worked:

1. Start by documenting exactly what you're trying to achieve and what's currently happening instead
2. Break down the problem into smaller, testable pieces that you can validate individually  
3. Check if there are any recent changes or updates that might have affected the behavior

Hope this helps point you in the right direction!`;
  }

  private generateVariantB(thread: FullThread, linksAllowed: boolean, allowlist: string[]): { text: string; disclosure?: string } {
    if (!linksAllowed || allowlist.length === 0) {
      return {
        text: this.generateVariantA(thread),
      };
    }

    const domain = allowlist[0]; // Use first allowlisted domain
    const isQuestion = thread.title.includes('?');
    
    const text = isQuestion
      ? `Here are 3 steps that might help with your question:

1. First, try checking if there are any error messages or logs that could give more specific details
2. Look through the official documentation for any similar examples
3. You might also find this resource helpful: https://${domain}/docs - it has some good guides for similar issues

Let me know if you need clarification on any of these steps!`
      : `I've run into similar challenges before. Here are some approaches:

1. Start by documenting exactly what you're trying to achieve
2. Break down the problem into smaller, testable pieces
3. This guide might also be useful: https://${domain}/guides - it covers some similar scenarios

Hope this helps point you in the right direction!`;

    return {
      text,
      disclosure: `I work on ${domain.split('.')[0]}`,
    };
  }
}