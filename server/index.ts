import dotenv from 'dotenv';
dotenv.config();
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { serveStatic } from '@hono/node-server/serve-static';
import { readFileSync } from 'fs';
import { join } from 'path';
// import { cors } from 'hono/cors';

// Import route handlers
import scanRoutes from './routes/scan.js';
import streamScanRoutes from './routes/streamScan.js';
import threadsRoutes from './routes/threads.js';
import outcomesRoutes from './routes/outcomes.js';
import toolsRoutes from './routes/tools.js';
import subredditsRoutes from './routes/subreddits.js';

// Import startup banner
import { displayStartupBanner, displayServerError } from './utils/startup-banner.js';

const app = new Hono();

// Basic CORS headers
app.use('/*', async (c, next) => {
  const origin = c.req.header('Origin');
  const allowedOrigins = process.env.NODE_ENV === 'production' 
    ? [process.env.FRONTEND_URL || '*'] // Configure with your production domain
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

// Serve static files from dist directory
app.use('/assets/*', serveStatic({ root: './dist' }));
app.use('/favicon.ico', serveStatic({ path: './dist/favicon.ico' }));
app.use('/logo.svg', serveStatic({ path: './dist/logo.svg' }));
app.use('/placeholder.svg', serveStatic({ path: './dist/placeholder.svg' }));
app.use('/robots.txt', serveStatic({ path: './dist/robots.txt' }));
app.use('/favicons/*', serveStatic({ root: './dist' }));

// Serve React app for all non-API routes (SPA fallback)
app.get('*', (c) => {
  const path = c.req.path;
  
  // Skip API routes
  if (path.startsWith('/api/')) {
    return c.json({ error: 'API endpoint not found' }, 404);
  }
  
  try {
    // Serve the React app's index.html for all other routes
    const html = readFileSync(join(process.cwd(), 'dist', 'index.html'), 'utf-8');
    return c.html(html);
  } catch (error) {
    console.error('Error serving index.html:', error);
    return c.text('Frontend not found. Make sure to run "npm run build" first.', 404);
  }
});

// Error handling middleware
app.onError((err, c) => {
  console.error('Server error:', err);
  
  return c.json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  }, 500);
});

const port = parseInt(process.env.PORT || '3000');

// Gather configuration status
const hasRedditCreds = !!(process.env.REDDIT_CLIENT_ID && process.env.REDDIT_CLIENT_SECRET);
const hasAgentCreds = !!(process.env.AGENT_ENDPOINT_URL && process.env.AGENT_API_KEY);
const hasSpacesCreds = !!(process.env.SPACES_KEY && process.env.SPACES_SECRET);
const hasAgentTools = process.env.FEATURE_AGENT_TOOLS === 'true';
const environment = process.env.NODE_ENV || 'development';

try {
  serve({
    fetch: app.fetch,
    port,
  }, (info) => {
    displayStartupBanner({
      port: info.port,
      environment,
      hasRedditCreds,
      hasAgentCreds,
      hasSpacesCreds,
      hasAgentTools
    });
  });
} catch (error) {
  displayServerError(error as Error, port);
  process.exit(1);
}