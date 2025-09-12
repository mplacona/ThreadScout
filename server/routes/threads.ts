import { Hono } from 'hono';
import { makeStorage, StorageKeys } from '../services/storage.js';
import type { SessionData } from '../schemas/thread.js';

const app = new Hono();

// GET /api/threads/recent - Get list of recent sessions (MUST come before /threads route)
app.get('/recent', async (c) => {
  try {
    const storage = makeStorage();
    
    // Get all session files
    const sessionFiles = await storage.list('sessions/');
    
    // Load session metadata (just sessionId, createdAt, and basic scan info)
    const sessions = [];
    
    // Filter for session files and get the most recent 10
    const sessionKeys = sessionFiles
      .filter(key => key.startsWith('sessions/') && key.endsWith('.json'))
      .slice(-10);
    
    for (const key of sessionKeys) {
      try {
        const sessionData = await storage.readJSON<SessionData>(key);
        if (sessionData) {
          sessions.push({
            sessionId: sessionData.sessionId,
            createdAt: sessionData.createdAt,
            threadsCount: sessionData.threads.length,
            scanParams: sessionData.scanParams,
            topScore: sessionData.threads.length > 0 
              ? Math.max(...sessionData.threads.map(t => t.score))
              : 0
          });
        }
      } catch (error) {
        console.error(`Error reading session file ${key}:`, error);
      }
    }
    
    // Sort by creation time (newest first) and limit to 5
    const recentSessions = sessions
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 5);
    
    return c.json(recentSessions);
  } catch (error) {
    console.error('Error fetching recent sessions:', error);
    return c.json({ error: 'Failed to fetch recent sessions' }, 500);
  }
});

// GET /api/threads?sessionId=...
app.get('/', async (c) => {
  const sessionId = c.req.query('sessionId');
  
  if (!sessionId) {
    return c.json({ error: 'sessionId query parameter is required' }, 400);
  }

  try {
    const storage = makeStorage();
    const sessionData = await storage.readJSON<SessionData>(StorageKeys.session(sessionId));
    
    if (!sessionData) {
      return c.json({ error: 'Session not found' }, 404);
    }

    return c.json(sessionData);
  } catch (error) {
    console.error('Error fetching session:', error);
    return c.json({ error: 'Failed to fetch session data' }, 500);
  }
});

// GET /api/threads/:id?sessionId=...
app.get('/:id', async (c) => {
  const threadId = c.req.param('id');
  const sessionId = c.req.query('sessionId');
  
  if (!sessionId) {
    return c.json({ error: 'sessionId query parameter is required' }, 400);
  }

  try {
    const storage = makeStorage();
    const sessionData = await storage.readJSON<SessionData>(StorageKeys.session(sessionId));
    
    if (!sessionData) {
      return c.json({ error: 'Session not found' }, 404);
    }

    const thread = sessionData.threads.find(t => t.thread.id === threadId);
    
    if (!thread) {
      return c.json({ error: 'Thread not found in session' }, 404);
    }

    return c.json(thread);
  } catch (error) {
    console.error('Error fetching thread:', error);
    return c.json({ error: 'Failed to fetch thread data' }, 500);
  }
});

export default app;