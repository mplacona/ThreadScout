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

    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data.trim()) {
              try {
                const event = JSON.parse(data);
                onEvent(event);
                
                if (event.type === 'completed' || event.type === 'cancelled') {
                  return;
                } else if (event.type === 'error') {
                  throw new Error(event.details || event.error);
                }
              } catch (error) {
                console.error('Failed to parse streaming data:', error);
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

  async createOutcome(request: CreateOutcomeRequest): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>('/outcomes', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async healthCheck(): Promise<{ status: string; timestamp: number; version: string }> {
    return this.request<{ status: string; timestamp: number; version: string }>('/health');
  }
}

export const api = new ThreadScoutAPI();