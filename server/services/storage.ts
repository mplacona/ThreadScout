import { LocalJSONStorage } from './localStorage.js';
import { SpacesStorage } from './spacesStorage.js';

export interface StorageProvider {
  readJSON<T>(key: string): Promise<T | null>;
  writeJSON<T>(key: string, data: T): Promise<void>;
  list(prefix: string): Promise<string[]>;
}

export function makeStorage(): StorageProvider {
  const hasSpacesCredentials = 
    process.env.SPACES_KEY && 
    process.env.SPACES_SECRET && 
    process.env.SPACES_ENDPOINT && 
    process.env.SPACES_BUCKET;

  if (hasSpacesCredentials) {
    return new SpacesStorage({
      endpoint: process.env.SPACES_ENDPOINT!,
      bucket: process.env.SPACES_BUCKET!,
      accessKeyId: process.env.SPACES_KEY!,
      secretAccessKey: process.env.SPACES_SECRET!,
    });
  }

  return new LocalJSONStorage('./.data');
}

// Storage key helpers
export const StorageKeys = {
  session: (sessionId: string) => `sessions/${sessionId}.json`,
  outcome: (threadId: string) => `outcomes/${threadId}.json`,
  rulesCache: (sub: string) => `cache/rules/${sub}.json`,
  snapshot: (timestamp: number) => `snapshots/${timestamp}.json`,
} as const;