import { Hono } from 'hono';
import { makeStorage, StorageKeys } from '../services/storage.js';
import type { SessionData } from '../schemas/thread.js';

const app = new Hono();

// GET /api/threads?sessionId=...
app.get('/threads', async (c) => {
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
app.get('/threads/:id', async (c) => {
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