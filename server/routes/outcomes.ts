import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { CreateOutcomeRequestSchema } from '../schemas/outcomes.js';
import { makeStorage, StorageKeys } from '../services/storage.js';
import type { OutcomeRecord } from '../schemas/outcomes.js';

const app = new Hono();

// POST /api/outcomes
app.post(
  '/outcomes', 
  zValidator('json', CreateOutcomeRequestSchema),
  async (c) => {
    const { threadId, commentUrl, sessionId } = c.req.valid('json');

    try {
      // Validate comment URL is from Reddit
      const url = new URL(commentUrl);
      if (!url.hostname.includes('reddit.com')) {
        return c.json({ error: 'Comment URL must be from Reddit' }, 400);
      }

      const storage = makeStorage();
      
      // Check if outcome already exists
      const existingOutcome = await storage.readJSON<OutcomeRecord>(
        StorageKeys.outcome(threadId)
      );
      
      if (existingOutcome) {
        return c.json({ error: 'Outcome already exists for this thread' }, 409);
      }

      // Create new outcome record
      const outcome: OutcomeRecord = {
        threadId,
        commentUrl,
        status: 'pending',
        insertedAt: Date.now(),
        sessionId,
      };

      await storage.writeJSON(StorageKeys.outcome(threadId), outcome);

      return c.json({
        success: true,
        outcome,
      });
    } catch (error) {
      console.error('Error creating outcome:', error);
      return c.json({ error: 'Failed to create outcome record' }, 500);
    }
  }
);

// POST /api/cron/outcomes
app.post('/cron/outcomes', async (c) => {
  const cronSecret = c.req.header('x-cron-secret');
  
  if (!cronSecret || cronSecret !== process.env.CRON_SECRET) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const storage = makeStorage();
    
    // Get all outcome files
    const outcomeKeys = await storage.list('outcomes/');
    
    let processed = 0;
    let updated = 0;
    let errors = 0;

    for (const key of outcomeKeys) {
      try {
        const outcome = await storage.readJSON<OutcomeRecord>(key);
        
        if (!outcome || outcome.status !== 'pending') {
          continue;
        }

        processed++;

        // Check comment status (simplified - would need real Reddit API integration)
        // For now, just mark as alive after 24 hours for demo
        const hoursSinceInsert = (Date.now() - outcome.insertedAt) / (1000 * 60 * 60);
        
        if (hoursSinceInsert >= 1) { // Check after 1 hour for demo
          const updatedOutcome: OutcomeRecord = {
            ...outcome,
            status: Math.random() > 0.2 ? 'alive' : 'removed', // 80% alive rate for demo
            checkedAt: Date.now(),
            upvotes24h: Math.floor(Math.random() * 20),
            replies24h: Math.floor(Math.random() * 10),
          };

          await storage.writeJSON(key, updatedOutcome);
          updated++;
        }
      } catch (error) {
        console.error(`Error processing outcome ${key}:`, error);
        errors++;
      }
    }

    return c.json({
      processed,
      updated,
      errors,
      lastRun: Date.now(),
    });
  } catch (error) {
    console.error('Cron job error:', error);
    return c.json({ error: 'Failed to process outcomes' }, 500);
  }
});

export default app;