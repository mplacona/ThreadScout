import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { api, type ScanRequest, type ThreadSummary, type StreamingScanEvent } from '@/lib/api';
import { APP_CONFIG } from '@/constants/app';
import { logger } from '@/utils/logger';

interface ScanState {
  isLoading: boolean;
  results: { sessionId: string; threads: ThreadSummary[] } | null;
  scanStatus: string;
  scanProgress: { current: number; total: number } | null;
  currentSessionId: string | null;
  cancelScan: (() => Promise<boolean>) | null;
}

export function useScanState() {
  const [state, setState] = useState<ScanState>({
    isLoading: false,
    results: null,
    scanStatus: '',
    scanProgress: null,
    currentSessionId: null,
    cancelScan: null,
  });

  const updateState = useCallback((updates: Partial<ScanState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const handleScan = useCallback(async (
    selectedSubs: string[],
    selectedKeywords: string[],
    lookbackHours: number,
    threadLimit: number
  ) => {
    if (selectedSubs.length === 0 || selectedKeywords.length === 0) {
      toast.error('Please select at least one subreddit and keyword');
      return;
    }

    updateState({
      isLoading: true,
      scanStatus: 'Initializing scan...',
      scanProgress: null,
      results: null,
    });
    
    const request: ScanRequest = {
      subs: selectedSubs,
      keywords: selectedKeywords,
      lookbackHours,
      threadLimit,
    };

    const { promise, cancel, sessionId } = api.scanThreadsStream(
      request,
      (event: StreamingScanEvent) => {
        switch (event.type) {
          case 'status':
            updateState({ scanStatus: event.message || '' });
            break;
          
          case 'progress':
            updateState({
              scanProgress: { current: event.current || 0, total: event.total || 0 },
              scanStatus: event.message || '',
            });
            break;
          
          case 'thread':
            if (event.thread) {
              setState(prev => ({
                ...prev,
                results: {
                  sessionId,
                  threads: prev.results ? [...prev.results.threads, event.thread!] : [event.thread!]
                }
              }));
            }
            break;
          
          case 'completed':
            setState(prev => ({
              ...prev,
              results: prev.results ? {
                ...prev.results,
                threads: [...prev.results.threads].sort((a, b) => b.score - a.score)
              } : prev.results,
              isLoading: false,
              cancelScan: null,
              currentSessionId: null,
              scanStatus: '',
              scanProgress: null,
            }));
            toast.success(event.message || `Scan completed! Found ${event.totalThreads || 0} threads.`);
            break;
          
          case 'cancelled':
            setState(prev => ({
              ...prev,
              results: prev.results ? {
                ...prev.results,
                threads: [...prev.results.threads].sort((a, b) => b.score - a.score)
              } : prev.results,
              isLoading: false,
              cancelScan: null,
              currentSessionId: null,
              scanStatus: '',
              scanProgress: null,
            }));
            toast.info(event.message || 'Scan was cancelled');
            break;
          
          case 'error':
            updateState({
              isLoading: false,
              cancelScan: null,
              currentSessionId: null,
              scanStatus: '',
              scanProgress: null,
            });
            toast.error(event.details || event.error || 'Scan failed');
            break;
        }
      }
    );

    updateState({
      currentSessionId: sessionId,
      cancelScan: () => cancel,
    });

    try {
      await promise;
    } catch (error) {
      logger.error('Scan error', error);
      updateState({
        isLoading: false,
        cancelScan: null,
        currentSessionId: null,
        scanStatus: '',
        scanProgress: null,
      });
      toast.error(error instanceof Error ? error.message : 'Failed to scan threads');
    }
  }, [updateState]);

  const handleCancelScan = useCallback(async () => {
    if (state.cancelScan) {
      const cancelled = await state.cancelScan();
      if (cancelled) {
        toast.info('Cancelling scan...');
      }
    }
  }, [state]);

  return {
    ...state,
    handleScan,
    handleCancelScan,
    setResults: useCallback((results: { sessionId: string; threads: ThreadSummary[] } | null) => {
      updateState({ results });
    }, [updateState]),
  };
}