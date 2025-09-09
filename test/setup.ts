// Vitest setup file
import { vi } from 'vitest';

// Mock environment variables for tests
process.env.NODE_ENV = 'test';
process.env.ALLOWED_LINK_DOMAINS = 'example.com,docs.example.com';
process.env.CRON_SECRET = 'test-secret';

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
};