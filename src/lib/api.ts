const API_BASE = '/api';

export interface ScanRequest {
  subs: string[];
  keywords: string[];
  lookbackHours: number;
  threadLimit?: number; // Optional - defaults to 10 on backend
  sessionId?: string;
  allowlist?: string[]; // Optional - when omitted, all links are allowed
}

export interface ThreadSummary {
  thread: {
    id: string;
    sub: string;
    title: string;
    author: string;
    permalink: string;
    createdUtc: number;
    upvotes: number;
    comments: number;
    body: string;
    topComments: Array<{
      author: string;
      body: string;
      score: number;
      createdUtc: number;
    }>;
  };
  score: number;
  scoreHint: string;
  whyFit: string;
  rules: {
    linksAllowed: boolean;
    vendorDisclosureRequired: boolean;
    linkLimit: number | null;
    notes: string[];
  };
  risks: string[];
  variantA: {
    text: string;
  };
  variantB: {
    text: string;
    disclosure?: string;
  };
}

export interface ScanResponse {
  sessionId: string;
  threads: ThreadSummary[];
}

export interface SessionData {
  sessionId: string;
  createdAt: number;
  threads: ThreadSummary[];
  scanParams: {
    subs: string[];
    keywords: string[];
    lookbackHours: number;
    allowlist: string[];
  };
}

export interface CreateOutcomeRequest {
  threadId: string;
  commentUrl: string;
  sessionId: string;
}

export interface RecentSession {
  sessionId: string;
  createdAt: number;
  threadsCount: number;
  scanParams: {
    subs: string[];
    keywords: string[];
    lookbackHours: number;
    allowlist: string[];
  };
  topScore: number;
}

export interface StreamingScanEvent {
  type: 'status' | 'progress' | 'thread' | 'completed' | 'cancelled' | 'error';
  message?: string;
  sessionId?: string;
  current?: number;
  total?: number;
  totalThreads?: number;
  thread?: ThreadSummary;
  error?: string;
  details?: string;
}

export class ThreadScoutAPI {
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_BASE}${endpoint}`;
    
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  async scanThreads(request: ScanRequest): Promise<ScanResponse> {
    return this.request<ScanResponse>('/scan', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  // New streaming scan method
  scanThreadsStream(
    request: ScanRequest,
    onEvent: (event: StreamingScanEvent) => void
  ): { 
    promise: Promise<void>, 
    cancel: () => Promise<boolean>,
    sessionId: string 
  } {
    const sessionId = request.sessionId || `scan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    let cancelled = false;

    const cancel = async (): Promise<boolean> => {
      if (cancelled) return false;
      
      try {
        const response = await fetch(`${API_BASE}/scan/cancel/${sessionId}`, {
          method: 'POST',
        });
        cancelled = true;
        return response.ok;
      } catch (error) {
        console.error('Failed to cancel scan:', error);
        return false;
      }
    };

    const promise = this.fetchStreamingScan(request, sessionId, onEvent);

    return { promise, cancel, sessionId };
  }

  private async fetchStreamingScan(
    request: ScanRequest,
    sessionId: string,
    onEvent: (event: StreamingScanEvent) => void
  ): Promise<void> {
    const response = await fetch(`${API_BASE}/scan/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ...request, sessionId }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
      throw new Error('No response body');
    }

    let buffer = '';
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        // Add new chunk to buffer
        buffer += decoder.decode(value, { stream: true });
        
        // Process complete lines
        const lines = buffer.split('\n');
        // Keep the last line in buffer (might be incomplete)
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data) {
              try {
                const event = JSON.parse(data);
                onEvent(event);
                
                if (event.type === 'completed' || event.type === 'cancelled') {
                  return;
                } else if (event.type === 'error') {
                  // Only throw for fatal errors, not individual thread errors
                  if (event.error && !event.message) {
                    throw new Error(event.details || event.error);
                  }
                }
              } catch (parseError) {
                console.error('Failed to parse streaming data:', parseError, 'Raw data:', data);
              }
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async getSession(sessionId: string): Promise<SessionData> {
    return this.request<SessionData>(`/threads?sessionId=${encodeURIComponent(sessionId)}`);
  }

  async getThread(threadId: string, sessionId: string): Promise<ThreadSummary> {
    return this.request<ThreadSummary>(
      `/threads/${encodeURIComponent(threadId)}?sessionId=${encodeURIComponent(sessionId)}`
    );
  }

  async getRecentSessions(): Promise<RecentSession[]> {
    return this.request<RecentSession[]>('/threads/recent');
  }

  async createOutcome(request: CreateOutcomeRequest): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>('/outcomes', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async healthCheck(): Promise<{ status: string; timestamp: number; version: string }> {
    return this.request<{ status: string; timestamp: number; version: string }>('/health');
  }

  async searchSubreddits(query: string, limit: number = 10): Promise<Array<{name: string, subscribers: number, displayName: string}>> {
    const response = await this.request<{ subreddits: Array<{name: string, subscribers: number, displayName: string}> }>(
      `/subreddits/search?q=${encodeURIComponent(query)}&limit=${limit}`
    );
    return response.subreddits;
  }
}

export const api = new ThreadScoutAPI();