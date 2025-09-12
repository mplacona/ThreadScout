import dotenv from 'dotenv';
dotenv.config();
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
// import { cors } from 'hono/cors';

// Import route handlers
import scanRoutes from './routes/scan.js';
import streamScanRoutes from './routes/streamScan.js';
import threadsRoutes from './routes/threads.js';
import outcomesRoutes from './routes/outcomes.js';
import toolsRoutes from './routes/tools.js';
import subredditsRoutes from './routes/subreddits.js';

const app = new Hono();

// Basic CORS headers
app.use('/*', async (c, next) => {
  const origin = c.req.header('Origin');
  const allowedOrigins = process.env.NODE_ENV === 'production' 
    ? [] // Configure with your production domain
    : ['http://localhost:5173', 'http://127.0.0.1:5173'];

  if (allowedOrigins.includes(origin || '')) {
    c.header('Access-Control-Allow-Origin', origin || '*');
  }
  
  c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-cron-secret');
  
  if (c.req.method === 'OPTIONS') {
    return c.text('', 200);
  }
  
  await next();
});

// Health check endpoint
app.get('/api/health', (c) => {
  return c.json({ 
    status: 'ok', 
    timestamp: Date.now(),
    version: '1.0.0'
  });
});

// Mount route handlers
app.route('/api', scanRoutes);
app.route('/api', streamScanRoutes);
app.route('/api', threadsRoutes);
app.route('/api', outcomesRoutes);
app.route('/api', toolsRoutes);
app.route('/api', subredditsRoutes);

// Error handling middleware
app.onError((err, c) => {
  console.error('Server error:', err);
  
  return c.json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  }, 500);
});

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Not found' }, 404);
});

const port = parseInt(process.env.PORT || '3000');

console.log(`Starting ThreadScout server on port ${port}...`);
console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);

// Log configuration status
const hasRedditCreds = !!(process.env.REDDIT_CLIENT_ID && process.env.REDDIT_CLIENT_SECRET);
const hasAgentCreds = !!(process.env.AGENT_ENDPOINT_URL && process.env.AGENT_API_KEY);
const hasSpacesCreds = !!(process.env.SPACES_KEY && process.env.SPACES_SECRET);

console.log('Configuration status:');
console.log(`- Reddit API: ${hasRedditCreds ? '✓' : '✗ (using fallback)'}`);
console.log(`- Agent API: ${hasAgentCreds ? '✓' : '✗ (using mock)'}`);
console.log(`- Spaces Storage: ${hasSpacesCreds ? '✓' : '✗ (using local storage)'}`);
console.log(`- Agent Tools: ${process.env.FEATURE_AGENT_TOOLS === 'true' ? '✓' : '✗'}`);

serve({
  fetch: app.fetch,
  port,
}, (info) => {
  console.log(`🚀 ThreadScout server running at http://localhost:${info.port}`);
});