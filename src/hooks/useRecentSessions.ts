import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { api, type RecentSession, type ThreadSummary } from '@/lib/api';
import { 
  getRecentSessionsFromStorage, 
  updateRecentSessions, 
  removeSessionFromLocalStorage,
  saveSessionToLocalStorage,
  deleteRecentSession 
} from '@/utils/storage';
import { logger } from '@/utils/logger';

export function useRecentSessions() {
  const [recentSessions, setRecentSessions] = useState<RecentSession[]>([]);

  // Load recent sessions on mount
  useEffect(() => {
    const recent = getRecentSessionsFromStorage();
    setRecentSessions(recent);
    
    // Add sample data for testing in development (only if localStorage is empty)
    if (recent.length === 0 && process.env.NODE_ENV === 'development') {
      const sampleSessions: RecentSession[] = [];
      
      try {
        updateRecentSessions(sampleSessions);
        setRecentSessions(sampleSessions);
      } catch (error) {
        logger.error('Failed to set sample data', error);
      }
    }
  }, []);

  const saveSessionToStorage = useCallback((
    sessionData: { sessionId: string; threads: ThreadSummary[] },
    scanParams: {
      subs: string[];
      keywords: string[];
      lookbackHours: number;
    }
  ) => {
    try {
      const existing = getRecentSessionsFromStorage();
      
      const newSession: RecentSession = {
        sessionId: sessionData.sessionId,
        createdAt: Date.now(),
        threadsCount: sessionData.threads.length,
        scanParams: {
          ...scanParams,
          allowlist: []
        },
        topScore: sessionData.threads.length > 0 
          ? Math.max(...sessionData.threads.map(t => t.score))
          : 0
      };

      const updated = [newSession, ...existing.filter(s => s.sessionId !== sessionData.sessionId)].slice(0, 5);
      
      saveSessionToLocalStorage(sessionData.sessionId, sessionData);
      updateRecentSessions(updated);
      setRecentSessions(updated);
    } catch (error) {
      logger.error('Error saving session to localStorage', error);
    }
  }, []);

  const loadPreviousScan = useCallback(async (sessionId: string): Promise<{ sessionId: string; threads: ThreadSummary[] } | null> => {
    if (sessionId.startsWith('sample_')) {
      toast.info('Sample session - run a real scan to see actual results');
      return null;
    }

    try {
      const localData = localStorage.getItem(`threadscout_session_${sessionId}`);
      if (localData) {
        const sessionData = JSON.parse(localData);
        toast.success('Previous scan results loaded!');
        return {
          sessionId: sessionData.sessionId,
          threads: sessionData.threads
        };
      }

      const sessionData = await api.getSession(sessionId);
      toast.success('Previous scan results loaded!');
      return {
        sessionId: sessionData.sessionId,
        threads: sessionData.threads
      };
    } catch (error) {
      toast.error('This scan is no longer available');
      logger.error('Error loading previous scan', error);
      
      const existing = getRecentSessionsFromStorage();
      const filtered = existing.filter(s => s.sessionId !== sessionId);
      updateRecentSessions(filtered);
      removeSessionFromLocalStorage(sessionId);
      setRecentSessions(filtered);
      return null;
    }
  }, []);

  const deleteSession = useCallback((sessionId: string) => {
    try {
      deleteRecentSession(sessionId);
      const updated = getRecentSessionsFromStorage();
      setRecentSessions(updated);
      toast.success('Session deleted successfully');
    } catch (error) {
      logger.error('Error deleting session', error);
      toast.error('Failed to delete session');
    }
  }, []);

  return {
    recentSessions,
    saveSessionToStorage,
    loadPreviousScan,
    deleteSession,
  };
}