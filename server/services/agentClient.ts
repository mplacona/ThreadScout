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
    rules: RulesSummary
  ): Promise<AgentResponse> {
    console.log(`🤖 AgentClient.scoreAndDraft called for thread: ${thread.title}`);
    console.log(`📊 Thread permalink: ${thread.permalink}`);
    
    if (!this.endpointUrl || !this.apiKey) {
      throw new Error('Agent credentials not configured');
    }
    
    console.log(`🌐 Calling real agent at: ${this.endpointUrl}/api/v1/chat/completions`);

    try {
      // Send just the Reddit thread URL with .json - let the agent handle everything
      const redditJsonUrl = `https://www.reddit.com${thread.permalink}.json`;
      console.log(`🔗 Sending Reddit JSON URL to agent: ${redditJsonUrl}`);
      
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

      console.log('📤 Full request payload being sent to agent:');
      console.log(JSON.stringify(chatRequest, null, 2));

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
      console.log('📥 Raw agent response:');
      console.log(JSON.stringify(data, null, 2));
      
      // Parse the agent response and convert to our format
      const agentResponse = this.parseAgentResponse(data);
      
      return agentResponse;
    } catch (error: unknown) {
      console.error('Agent client error:', error);
      
      // Check if it's a rate limit error
      if (error instanceof Error && error.message.includes('429')) {
        console.log('🚦 Rate limit detected - throwing error instead of using mock');
        throw new Error('Rate limit exceeded - please try again in a moment');
      }
      
      // For other errors, still throw instead of using mock
      console.log('❌ Agent API failed - throwing error instead of using mock');
      throw error;
    }
  }


  private parseAgentResponse(data: any): AgentResponse {
    try {
      // The response should be in the format: { choices: [{ message: { content: "..." } }] }
      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error('No content in agent response');
      }

      console.log('🔍 Agent response content (before parsing):');
      console.log(content);

      // Try to parse the JSON content
      let parsed: any;
      try {
        parsed = JSON.parse(content);
        console.log('✅ Successfully parsed agent JSON');
      } catch (parseError) {
        console.warn('Failed to parse agent JSON response, attempting to fix common issues...');
        console.error('Parse error:', parseError);
        console.log('Raw content causing error:');
        console.log(content);
        
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
        fixedContent = fixedContent.replace(/"\s*\n\s*\]/g, '"\n]');
        fixedContent = fixedContent.replace(/(\w+"\s*)\n(\s*\])/g, '$1$2');
        
        // Fix unescaped quotes in strings (more conservative approach)
        fixedContent = fixedContent.replace(/: "([^"]*)"([^",:}\]]*)"([^",:}\]]*)/g, ': "$1\\"$2\\"$3');
        
        // Fix common patterns where quotes are not properly escaped
        fixedContent = fixedContent.replace(/: "([^"]*https?:\/\/[^"]*)"([^",:}\]]*)"([^,:}\]]*)/g, ': "$1$2$3"');
        
        try {
          parsed = JSON.parse(fixedContent);
          console.log('🔧 Successfully fixed and parsed JSON');
        } catch (secondError) {
          console.error('Still failed to parse after fixes:', secondError);
          
          // Last resort: try to extract a valid JSON object using regex
          try {
            const jsonMatch = fixedContent.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              let extractedJson = jsonMatch[0];
              // Try one more time with more aggressive fixes
              extractedJson = extractedJson.replace(/([^,{\[s])\s*\n\s*"/g, '$1,\n"');
              extractedJson = extractedJson.replace(/([^,{\[s])\s*\n\s*]/g, '$1\n]');
              parsed = JSON.parse(extractedJson);
              console.log('🔧 Successfully extracted and parsed JSON');
            } else {
              throw new Error('No JSON object found');
            }
          } catch (finalError) {
            console.error('Final parsing attempt failed:', finalError);
            console.log('Content excerpt around error:');
            const errorPos = (secondError as any).message.match(/position (\d+)/)?.[1];
            if (errorPos) {
              const pos = parseInt(errorPos);
              console.log(fixedContent.substring(Math.max(0, pos - 50), pos + 50));
            }
            throw new Error('Invalid JSON in agent response');
          }
        }
      }

      // Validate the parsed response has the expected structure
      if (this.isValidAgentResponse(parsed)) {
        console.log(`🎯 Agent provided score: ${parsed.score}/100`);
        return parsed;
      } else {
        console.warn('Agent response missing required fields');
        throw new Error('Invalid agent response structure');
      }
    } catch (error) {
      console.warn('Error parsing agent response:', error);
      throw new Error('Failed to parse agent response');
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

}