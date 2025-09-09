import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { ScanRequestSchema } from '../schemas/draft.js';
import { RedditClient } from '../services/redditClient.js';
import { AgentClient } from '../services/agentClient.js';
import { RulesCache } from '../services/rulesCache.js';
import { makeStorage, StorageKeys } from '../services/storage.js';
import { enforceOneLink, enforceAllowlist, ensureDisclosure } from '../services/validators.js';
import type { SessionData, ThreadAnalysis } from '../schemas/thread.js';

const app = new Hono();

// Store active scans to allow cancellation
const activeScans = new Map<string, { cancelled: boolean }>();

app.post(
  '/scan/stream',
  zValidator('json', ScanRequestSchema),
  async (c) => {
    const { subs, keywords, lookbackHours, threadLimit, sessionId, allowlist } = c.req.valid('json');

    // Generate session ID
    const finalSessionId = sessionId || `scan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Register this scan
    activeScans.set(finalSessionId, { cancelled: false });

    // Set up SSE headers
    c.header('Content-Type', 'text/event-stream');
    c.header('Cache-Control', 'no-cache');
    c.header('Connection', 'keep-alive');
    c.header('Access-Control-Allow-Origin', '*');
    c.header('Access-Control-Allow-Headers', 'Cache-Control');

    const stream = new ReadableStream({
      start(controller) {
        scanWithStreaming(
          controller,
          finalSessionId,
          { subs, keywords, lookbackHours, threadLimit, allowlist: allowlist || [] }
        ).catch(error => {
          console.error('Streaming scan error:', error);
          controller.enqueue(`data: ${JSON.stringify({ 
            type: 'error', 
            error: 'Scan failed',
            details: error.message 
          })}\n\n`);
          controller.close();
        });
      }
    });

    return new Response(stream);
  }
);

app.post('/scan/cancel/:sessionId', async (c) => {
  const sessionId = c.req.param('sessionId');
  const scan = activeScans.get(sessionId);
  
  if (scan) {
    scan.cancelled = true;
    console.log(`🛑 Scan ${sessionId} cancelled by user`);
    return c.json({ success: true, message: 'Scan cancelled' });
  }
  
  return c.json({ success: false, message: 'Scan not found' }, 404);
});

async function scanWithStreaming(
  controller: ReadableStreamDefaultController,
  sessionId: string,
  scanParams: { subs: string[]; keywords: string[]; lookbackHours: number; threadLimit?: number; allowlist: string[] }
) {
  const { subs, keywords, lookbackHours, threadLimit, allowlist } = scanParams;
  const scanControl = activeScans.get(sessionId)!;
  
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

    // Send initial status
    controller.enqueue(`data: ${JSON.stringify({
      type: 'status',
      message: `Starting scan: ${subs.length} subs, ${keywords.length} keywords, ${lookbackHours}h lookback`,
      sessionId
    })}\n\n`);

    // Search for candidate threads
    controller.enqueue(`data: ${JSON.stringify({
      type: 'status',
      message: 'Searching Reddit for candidate threads...'
    })}\n\n`);

    const candidates = await redditClient.searchThreads(subs, keywords, lookbackHours);
    
    if (scanControl.cancelled) {
      controller.enqueue(`data: ${JSON.stringify({ type: 'cancelled' })}\n\n`);
      controller.close();
      return;
    }

    // Process candidates one by one (limit based on threadLimit parameter)
    const maxThreads = threadLimit || 10;
    
    controller.enqueue(`data: ${JSON.stringify({
      type: 'status',
      message: `Found ${candidates.length} candidate threads, analyzing top ${maxThreads}...`
    })}\n\n`);

    const topCandidates = candidates.slice(0, maxThreads);
    const analyses: ThreadAnalysis[] = [];
    
    for (let i = 0; i < topCandidates.length; i++) {
      if (scanControl.cancelled) {
        controller.enqueue(`data: ${JSON.stringify({ type: 'cancelled' })}\n\n`);
        break;
      }

      const candidate = topCandidates[i];
      
      try {
        // Send progress update
        controller.enqueue(`data: ${JSON.stringify({
          type: 'progress',
          current: i + 1,
          total: topCandidates.length,
          message: `Analyzing: "${candidate.title.slice(0, 50)}..."`
        })}\n\n`);

        // Get subreddit rules
        const rules = await rulesCache.getRules(candidate.sub);
        
        // Get full thread details
        const fullThread = await redditClient.getThread(candidate.permalink);
        
        // Get AI analysis and drafts
        const agentResponse = await agentClient.scoreAndDraft(
          fullThread,
          rules,
          '', // docsContext
          allowlist
        );

        // Validate and clean variants (same logic as original scan)
        const variantAOneLink = enforceOneLink(agentResponse.variantA.text);
        const variantAAllowlist = enforceAllowlist(variantAOneLink.cleaned, allowlist);
        
        let variantBCleaned = agentResponse.variantB.text;
        const variantBOneLink = enforceOneLink(variantBCleaned);
        const variantBAllowlist = enforceAllowlist(variantBOneLink.cleaned, allowlist);
        variantBCleaned = variantBAllowlist.cleaned;

        let variantBDisclosure = agentResponse.variantB.disclosure;
        if (rules.vendorDisclosureRequired && variantBAllowlist.ok && variantBCleaned.includes('http')) {
          if (!variantBDisclosure) {
            const firstDomain = allowlist[0];
            variantBDisclosure = `I work on ${firstDomain?.split('.')[0] || 'this product'}`;
          }
          variantBCleaned = ensureDisclosure(variantBCleaned, variantBDisclosure);
        }

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

        // Send the completed thread analysis
        controller.enqueue(`data: ${JSON.stringify({
          type: 'thread',
          thread: {
            thread: analysis.thread,
            score: analysis.score,
            whyFit: analysis.whyFit,
            rules: analysis.rules,
            risks: analysis.risks,
            variantA: analysis.variantA,
            variantB: analysis.variantB,
          }
        })}\n\n`);

      } catch (error) {
        console.error(`Error processing thread ${candidate.id}:`, error);
        controller.enqueue(`data: ${JSON.stringify({
          type: 'error',
          message: `Failed to process thread: ${candidate.title.slice(0, 50)}...`
        })}\n\n`);
      }
    }

    // Store session data
    const sessionData: SessionData = {
      sessionId,
      createdAt: Date.now(),
      threads: analyses,
      scanParams: {
        subs,
        keywords,
        lookbackHours,
        allowlist,
      },
    };

    await storage.writeJSON(StorageKeys.session(sessionId), sessionData);

    // Send completion
    if (scanControl.cancelled) {
      controller.enqueue(`data: ${JSON.stringify({
        type: 'completed',
        sessionId,
        message: `Scan cancelled. Analyzed ${analyses.length} of ${topCandidates.length} threads.`,
        totalThreads: analyses.length
      })}\n\n`);
    } else {
      controller.enqueue(`data: ${JSON.stringify({
        type: 'completed',
        sessionId,
        message: `Scan completed! Analyzed ${analyses.length} threads.`,
        totalThreads: analyses.length
      })}\n\n`);
    }

    controller.close();
  } catch (error) {
    console.error('Streaming scan error:', error);
    controller.enqueue(`data: ${JSON.stringify({
      type: 'error',
      error: 'Scan failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    })}\n\n`);
    controller.close();
  } finally {
    // Clean up
    activeScans.delete(sessionId);
  }
}

export default app;