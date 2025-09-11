import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { ScanRequestSchema, ScanResponseSchema } from '../schemas/draft.js';
import { RedditClient } from '../services/redditClient.js';
import { AgentClient } from '../services/agentClient.js';
import { RulesCache } from '../services/rulesCache.js';
import { makeStorage, StorageKeys } from '../services/storage.js';
import { enforceOneLink, enforceAllowlist, ensureDisclosure } from '../services/validators.js';
import type { SessionData, ThreadAnalysis } from '../schemas/thread.js';

const app = new Hono();

app.post(
  '/scan',
  zValidator('json', ScanRequestSchema),
  async (c) => {
    const { subs, keywords, lookbackHours, threadLimit, sessionId, allowlist } = c.req.valid('json');

    try {
      const storage = makeStorage();
      
      // Initialize services
      const redditClient = new RedditClient(
        process.env.REDDIT_CLIENT_ID,
        process.env.REDDIT_CLIENT_SECRET,
        process.env.REDDIT_USER_AGENT
      );
      
      const agentClient = new AgentClient(
        process.env.AGENT_ENDPOINT_URL,
        process.env.AGENT_API_KEY
      );
      
      const rulesCache = new RulesCache(storage, redditClient);

      // Use empty allowlist by default (allows all links)
      const effectiveAllowlist = allowlist || [];

      // Search for candidate threads
      console.log(`🚀 Starting scan: ${subs.length} subs, ${keywords.length} keywords, ${lookbackHours}h lookback`);
      const candidates = await redditClient.searchThreads(subs, keywords, lookbackHours);
      
      console.log(`🔍 Reddit search returned ${candidates.length} candidates`);
      
      // Process top candidates (limit based on threadLimit parameter)
      const maxThreads = threadLimit || 10;
      const topCandidates = candidates.slice(0, maxThreads);
      const analyses: ThreadAnalysis[] = [];
      
      console.log(`🤖 Processing ${topCandidates.length} candidates with agent`);
      console.log(`📊 AGENT REQUEST TRACKING: Will process ${topCandidates.length} threads, expecting ${topCandidates.length} agent requests`);
      let agentRequestCount = 0;

      if (topCandidates.length === 0) {
        console.log(`⚠️  No candidates found - scan will return empty results`);
      }

      for (let i = 0; i < topCandidates.length; i++) {
        const candidate = topCandidates[i];
        
        // Add delay between requests to avoid rate limiting (except for first request)
        if (i > 0) {
          console.log(`⏱️  Adding 2s delay before processing thread ${i + 1} to avoid rate limits`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        try {
          // Get subreddit rules
          const rules = await rulesCache.getRules(candidate.sub);
          
          // Get full thread details
          console.log(`📖 Getting full thread data for: ${candidate.title}`);
          const fullThread = await redditClient.getThread(candidate.permalink);
          
          console.log(`🤖 Calling agent with thread: ${fullThread.title.slice(0, 50)}... (${fullThread.topComments.length} comments)`);
          
          // Get AI analysis and drafts
          agentRequestCount++;
          console.log(`📈 Making agent request ${agentRequestCount}/${topCandidates.length} for thread: ${fullThread.id}`);
          
          const agentResponse = await agentClient.scoreAndDraft(
            fullThread,
            rules,
            '', // docsContext - could be populated from config
            effectiveAllowlist
          );
          
          console.log(`🎯 Agent scored thread ${fullThread.id}: ${agentResponse.score}/100 - ${agentResponse.whyFit}`);
          
          // DEBUG: Log raw agent response variants
          console.log('🔍 DEBUG - Raw Agent Response Variants:');
          console.log('Variant A:', JSON.stringify(agentResponse.variantA, null, 2));
          console.log('Variant B:', JSON.stringify(agentResponse.variantB, null, 2));

          // Validate and clean variant A
          const variantAOneLink = enforceOneLink(agentResponse.variantA.text);
          const variantAAllowlist = enforceAllowlist(variantAOneLink.cleaned, effectiveAllowlist);
          
          // Validate and clean variant B
          let variantBCleaned = agentResponse.variantB.text;
          const variantBOneLink = enforceOneLink(variantBCleaned);
          const variantBAllowlist = enforceAllowlist(variantBOneLink.cleaned, effectiveAllowlist);
          variantBCleaned = variantBAllowlist.cleaned;

          // Add disclosure to variant B if required and links are present
          let variantBDisclosure = agentResponse.variantB.disclosure;
          if (rules.vendorDisclosureRequired && variantBAllowlist.ok && variantBCleaned.includes('http')) {
            if (!variantBDisclosure) {
              // Generate default disclosure
              const firstDomain = effectiveAllowlist[0];
              variantBDisclosure = `I work on ${firstDomain?.split('.')[0] || 'this product'}`;
            }
            variantBCleaned = ensureDisclosure(variantBCleaned, variantBDisclosure);
          }
          
          // DEBUG: Log processed variants
          console.log('🔧 DEBUG - After Processing:');
          console.log('Variant A (cleaned):', JSON.stringify(variantAAllowlist.cleaned, null, 2));
          console.log('Variant B (cleaned):', JSON.stringify(variantBCleaned, null, 2));
          console.log('Variant B (disclosure):', JSON.stringify(variantBDisclosure, null, 2));

          const analysis: ThreadAnalysis = {
            thread: fullThread,
            score: agentResponse.score,
            whyFit: agentResponse.whyFit,
            rules,
            risks: agentResponse.risks,
            variantA: {
              text: variantAAllowlist.cleaned,
            },
            variantB: {
              text: variantBCleaned,
              disclosure: variantBDisclosure,
            },
          };

          analyses.push(analysis);
        } catch (error) {
          console.error(`Error processing thread ${candidate.id}:`, error);
          // Continue with other threads
        }
      }

      // Generate session ID
      const finalSessionId = sessionId || `scan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Store session data
      const sessionData: SessionData = {
        sessionId: finalSessionId,
        createdAt: Date.now(),
        threads: analyses,
        scanParams: {
          subs,
          keywords,
          lookbackHours,
          allowlist: effectiveAllowlist,
        },
      };

      await storage.writeJSON(StorageKeys.session(finalSessionId), sessionData);

      // Return response
      const response = {
        sessionId: finalSessionId,
        threads: analyses.map(analysis => ({
          thread: analysis.thread,
          score: analysis.score,
          whyFit: analysis.whyFit,
          rules: analysis.rules,
          risks: analysis.risks,
          variantA: analysis.variantA,
          variantB: analysis.variantB,
        })),
      };

      console.log(`📊 AGENT REQUEST SUMMARY: Made ${agentRequestCount} agent requests for ${analyses.length} successful threads`);
      return c.json(response);
    } catch (error) {
      console.error('Scan error:', error);
      return c.json(
        { 
          error: 'Failed to scan threads',
          details: error instanceof Error ? error.message : 'Unknown error'
        },
        500
      );
    }
  }
);

export default app;