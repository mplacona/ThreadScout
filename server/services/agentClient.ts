import type { FullThread, RulesSummary } from './redditClient.js';
import { logger } from '../utils/logger.js';

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
    rules: RulesSummary
  ): Promise<AgentResponse> {
    logger.agent.info(`scoreAndDraft called for thread: ${thread.title}`);
    logger.agent.debug(`Thread permalink: ${thread.permalink}`);
    
    if (!this.endpointUrl || !this.apiKey) {
      throw new Error('Agent credentials not configured');
    }
    
    logger.agent.info(`Calling real agent at: ${this.endpointUrl}/api/v1/chat/completions`);

    try {
      // Send just the Reddit thread URL with .json - let the agent handle everything
      const redditJsonUrl = `https://www.reddit.com${thread.permalink}.json`;
      logger.agent.debug(`Sending Reddit JSON URL to agent: ${redditJsonUrl}`);
      
      const chatRequest = {
        messages: [
          {
            role: 'user',
            content: redditJsonUrl
          }
        ],
        temperature: 0.7,
        max_tokens: 3000,
        stream: false
      };

      logger.agent.debug('Full request payload being sent to agent:', chatRequest);

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
        logger.agent.error(`Agent API error ${response.status}: ${errorText}`);
        throw new Error(`Agent API error: ${response.status}`);
      }

      const data = await response.json();
      logger.agent.info('Agent response received, processing...');
      logger.agent.debug('Raw agent response:', data);
      
      // Parse the agent response and convert to our format
      const agentResponse = this.parseAgentResponse(data);
      
      return agentResponse;
    } catch (error: unknown) {
      logger.agent.error('Agent client error:', error);
      
      // Check if it's a rate limit error
      if (error instanceof Error && error.message.includes('429')) {
        logger.agent.warn('Rate limit detected - throwing error instead of using mock');
        throw new Error('Rate limit exceeded - please try again in a moment');
      }
      
      // For other errors, still throw instead of using mock
      logger.agent.error('Agent API failed - throwing error instead of using mock');
      throw error;
    }
  }


  private parseAgentResponse(data: { choices?: Array<{ message?: { content?: string } }> }): AgentResponse {
    try {
      // The response should be in the format: { choices: [{ message: { content: "..." } }] }
      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error('No content in agent response');
      }

      logger.agent.debug('Agent response content (before parsing):', { content });

      // Try to parse the JSON content
      let parsed: unknown;
      try {
        parsed = JSON.parse(content);
        logger.agent.debug('Successfully parsed agent JSON');
      } catch (parseError) {
        logger.agent.warn('Failed to parse agent JSON response, attempting to fix common issues...', parseError);
        logger.agent.debug('Raw content causing error:', { content });
        
        // Try to fix common JSON issues
        let fixedContent = content;
        
        // Fix trailing commas in arrays and objects
        fixedContent = fixedContent.replace(/,(\s*[\]}])/g, '$1');
        
        // Fix missing commas between array elements (common LLM error)
        fixedContent = fixedContent.replace(/"\s*\n\s*"/g, '",\n"');
        fixedContent = fixedContent.replace(/}\s*\n\s*{/g, '},\n{');
        fixedContent = fixedContent.replace(/]\s*\n\s*\[/g, '],\n[');
        
        // Fix missing commas after array/object elements
        fixedContent = fixedContent.replace(/"\s*\n\s*{/g, '",\n{');
        fixedContent = fixedContent.replace(/}\s*\n\s*"/g, '},\n"');
        fixedContent = fixedContent.replace(/]\s*\n\s*"/g, '],\n"');
        
        // Fix specific array comma issues (based on the error at position 782)
        fixedContent = fixedContent.replace(/"\s*\n\s*]/g, '"\n]');
        fixedContent = fixedContent.replace(/(\w+"\s*)\n(\s*])/g, '$1$2');
        
        // Fix unescaped quotes in strings (more conservative approach)
        fixedContent = fixedContent.replace(/: "([^"]*)"([^",:}\]]*)"([^",:}\]]*)/g, ': "$1\\"$2\\"$3');
        
        // Fix common patterns where quotes are not properly escaped
        fixedContent = fixedContent.replace(/: "([^"]*https?:\/\/[^"]*)"([^",:}\]]*)"([^,:}\]]*)/g, ': "$1$2$3"');
        
        try {
          parsed = JSON.parse(fixedContent);
          logger.agent.debug('Successfully fixed and parsed JSON');
        } catch (secondError) {
          logger.agent.error('Still failed to parse after fixes:', secondError);
          
          // Last resort: try to extract a valid JSON object using regex
          try {
            const jsonMatch = fixedContent.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              let extractedJson = jsonMatch[0];
            // Try one more time with more aggressive fixes
            extractedJson = extractedJson.replace(/([^,{[s])\s*\n\s*"/g, '$1,\n"');
            extractedJson = extractedJson.replace(/([^,{[s])\s*\n\s*]/g, '$1\n]');
              parsed = JSON.parse(extractedJson);
              logger.agent.debug('Successfully extracted and parsed JSON');
            } else {
              throw new Error('No JSON object found');
            }
          } catch (finalError) {
            logger.agent.error('Final parsing attempt failed:', finalError);
            const errorPos = (secondError as Error).message.match(/position (\d+)/)?.[1];
            if (errorPos) {
              const pos = parseInt(errorPos);
              logger.agent.debug('Content excerpt around error:', {
                excerpt: fixedContent.substring(Math.max(0, pos - 50), pos + 50)
              });
            }
            throw new Error('Invalid JSON in agent response');
          }
        }
      }

      // Validate the parsed response has the expected structure
      if (this.isValidAgentResponse(parsed)) {
        logger.agent.info(`Agent provided score: ${parsed.score}/100`);
        return parsed;
      } else {
        logger.agent.warn('Agent response missing required fields');
        throw new Error('Invalid agent response structure');
      }
    } catch (error) {
      logger.agent.warn('Error parsing agent response:', error);
      throw new Error('Failed to parse agent response');
    }
  }

  private isValidAgentResponse(data: unknown): data is AgentResponse {
    if (!data || typeof data !== 'object') return false;
    const obj = data as Record<string, unknown>;
    return (
      typeof obj.score === 'number' &&
      typeof obj.whyFit === 'string' &&
      Array.isArray(obj.rulesSummary) &&
      Array.isArray(obj.risks) &&
      typeof (obj.variantA as Record<string, unknown>)?.text === 'string' &&
      typeof (obj.variantB as Record<string, unknown>)?.text === 'string'
    );
  }

}