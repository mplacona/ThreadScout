import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Search, TrendingUp, MessageCircle, ThumbsUp, ExternalLink, X, Eye, Copy, Clock, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';
import { api, type ScanRequest, type ThreadSummary, type StreamingScanEvent, type RecentSession } from '@/lib/api';
import { FormattedText } from '@/components/ui/formatted-text';
import { SubredditAutocomplete } from '@/components/ui/subreddit-autocomplete';


const COMMON_KEYWORDS = [
  'help', 'problem', 'stuck', 'how to', 'best way', 'recommendations',
  'tool', 'solution', 'advice', 'experience', 'struggling', 'analytics'
];

export default function Dashboard() {
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<{ sessionId: string; threads: ThreadSummary[] } | null>(null);
  
  // Recent sessions state (localStorage-based)
  const [recentSessions, setRecentSessions] = useState<RecentSession[]>([]);
  
  // Streaming scan state
  const [scanStatus, setScanStatus] = useState<string>('');
  const [scanProgress, setScanProgress] = useState<{ current: number; total: number } | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [cancelScan, setCancelScan] = useState<(() => Promise<boolean>) | null>(null);
  
  // UI state for response previews
  const [expandedResponses, setExpandedResponses] = useState<Set<string>>(new Set());

  // Form state
  const [selectedSubs, setSelectedSubs] = useState<string[]>(['linkedin', 'linkedinads', 'linkedintips']);
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>(['help', 'analytics']);
  const [customKeyword, setCustomKeyword] = useState('');
  const [lookbackHours, setLookbackHours] = useState(24);
  const [threadLimit, setThreadLimit] = useState(5);
  // Removed allowlist for simplicity - links allowed by default

  // localStorage utilities for recent sessions
  const getRecentSessionsFromStorage = (): RecentSession[] => {
    try {
      const stored = localStorage.getItem('threadscout_recent_sessions');
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error reading recent sessions from localStorage:', error);
      return [];
    }
  };

  const saveSessionToStorage = useCallback((sessionData: { sessionId: string; threads: ThreadSummary[] }) => {
    try {
      const existing = getRecentSessionsFromStorage();
      
      // Create new session summary
      const newSession: RecentSession = {
        sessionId: sessionData.sessionId,
        createdAt: Date.now(),
        threadsCount: sessionData.threads.length,
        scanParams: {
          subs: selectedSubs,
          keywords: selectedKeywords,
          lookbackHours,
          allowlist: []
        },
        topScore: sessionData.threads.length > 0 
          ? Math.max(...sessionData.threads.map(t => t.score))
          : 0
      };

      // Add to beginning and keep only last 5
      const updated = [newSession, ...existing.filter(s => s.sessionId !== sessionData.sessionId)].slice(0, 5);
      
      // Also store the full session data for offline access
      localStorage.setItem(`threadscout_session_${sessionData.sessionId}`, JSON.stringify(sessionData));
      localStorage.setItem('threadscout_recent_sessions', JSON.stringify(updated));
      setRecentSessions(updated);
    } catch (error) {
      console.error('Error saving session to localStorage:', error);
    }
  }, [selectedSubs, selectedKeywords, lookbackHours]);

  // Load recent sessions on component mount
  useEffect(() => {
    const recent = getRecentSessionsFromStorage();
    setRecentSessions(recent);
    
    // Add sample data for testing (only if localStorage is empty)
    if (recent.length === 0 && process.env.NODE_ENV === 'development') {
      const sampleSessions: RecentSession[] = [
        // {
        //   sessionId: 'sample_1',
        //   createdAt: Date.now() - 2 * 60 * 60 * 1000, // 2 hours ago
        //   threadsCount: 5,
        //   topScore: 87,
        //   scanParams: {
        //     subs: ['linkedin', 'linkedinads'],
        //     keywords: ['help', 'analytics'],
        //     lookbackHours: 24,
        //     allowlist: []
        //   }
        // },
        // {
        //   sessionId: 'sample_2', 
        //   createdAt: Date.now() - 24 * 60 * 60 * 1000, // 1 day ago
        //   threadsCount: 3,
        //   topScore: 72,
        //   scanParams: {
        //     subs: ['startups', 'entrepreneur'], 
        //     keywords: ['problem', 'solution'],
        //     lookbackHours: 48,
        //     allowlist: []
        //   }
        // }
      ];
      
      try {
        localStorage.setItem('threadscout_recent_sessions', JSON.stringify(sampleSessions));
        setRecentSessions(sampleSessions);
      } catch (error) {
        console.error('Failed to set sample data:', error);
      }
    }
  }, []);

  // Save to localStorage when a scan completes (when results change from null to actual results)
  useEffect(() => {
    if (results && !isLoading && results.threads.length > 0) {
      // Only save if this is a completed scan (not loading and has threads)
      saveSessionToStorage(results);
    }
  }, [results, isLoading, saveSessionToStorage]);


  const handleKeywordToggle = (keyword: string) => {
    setSelectedKeywords(prev => 
      prev.includes(keyword) 
        ? prev.filter(k => k !== keyword)
        : [...prev, keyword]
    );
  };

  const handleAddCustomKeyword = () => {
    if (customKeyword.trim() && !selectedKeywords.includes(customKeyword.trim())) {
      setSelectedKeywords(prev => [...prev, customKeyword.trim()]);
      setCustomKeyword('');
    }
  };

  const handleScan = async () => {
    if (selectedSubs.length === 0 || selectedKeywords.length === 0) {
      toast.error('Please select at least one subreddit and keyword');
      return;
    }

    setIsLoading(true);
    setScanStatus('Initializing scan...');
    setScanProgress(null);
    setResults(null);
    
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
            setScanStatus(event.message || '');
            break;
          
          case 'progress':
            setScanProgress({ current: event.current || 0, total: event.total || 0 });
            setScanStatus(event.message || '');
            break;
          
          case 'thread':
            if (event.thread) {
              setResults(prev => ({
                sessionId,
                threads: prev ? [...prev.threads, event.thread!] : [event.thread!]
              }));
            }
            break;
          
          case 'completed':
            // Sort threads by score (highest to lowest) when streaming completes
            setResults(prev => prev ? ({
              ...prev,
              threads: [...prev.threads].sort((a, b) => b.score - a.score)
            }) : prev);
            setIsLoading(false);
            setCancelScan(null);
            setCurrentSessionId(null);
            setScanStatus('');
            setScanProgress(null);
            toast.success(event.message || `Scan completed! Found ${event.totalThreads || 0} threads.`);
            break;
          
          case 'cancelled':
            // Sort threads by score (highest to lowest) even when cancelled
            setResults(prev => prev ? ({
              ...prev,
              threads: [...prev.threads].sort((a, b) => b.score - a.score)
            }) : prev);
            setIsLoading(false);
            setCancelScan(null);
            setCurrentSessionId(null);
            setScanStatus('');
            setScanProgress(null);
            toast.info(event.message || 'Scan was cancelled');
            break;
          
          case 'error':
            setIsLoading(false);
            setCancelScan(null);
            setCurrentSessionId(null);
            setScanStatus('');
            setScanProgress(null);
            toast.error(event.details || event.error || 'Scan failed');
            break;
        }
      }
    );

    setCurrentSessionId(sessionId);
    setCancelScan(() => cancel);

    try {
      await promise;
    } catch (error) {
      console.error('Scan error:', error);
      setIsLoading(false);
      setCancelScan(null);
      setCurrentSessionId(null);
      setScanStatus('');
      setScanProgress(null);
      toast.error(error instanceof Error ? error.message : 'Failed to scan threads');
    }
  };

  const handleCancelScan = async () => {
    if (cancelScan) {
      const cancelled = await cancelScan();
      if (cancelled) {
        toast.info('Cancelling scan...');
      }
    }
  };

  const toggleResponseExpansion = (threadId: string) => {
    setExpandedResponses(prev => {
      const newSet = new Set(prev);
      if (newSet.has(threadId)) {
        newSet.delete(threadId);
      } else {
        newSet.add(threadId);
      }
      return newSet;
    });
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied to clipboard!`);
    } catch (error) {
      toast.error('Failed to copy to clipboard');
    }
  };

  const loadPreviousScan = async (sessionId: string) => {
    // For sample sessions, show a message that real data isn't available
    if (sessionId.startsWith('sample_')) {
      toast.info('Sample session - run a real scan to see actual results');
      return;
    }

    try {
      // First try to load from localStorage
      const localData = localStorage.getItem(`threadscout_session_${sessionId}`);
      if (localData) {
        const sessionData = JSON.parse(localData);
        setResults({
          sessionId: sessionData.sessionId,
          threads: sessionData.threads
        });
        toast.success('Previous scan results loaded!');
        return;
      }

      // Fallback to server if not in localStorage
      const sessionData = await api.getSession(sessionId);
      setResults({
        sessionId: sessionData.sessionId,
        threads: sessionData.threads
      });
      toast.success('Previous scan results loaded!');
    } catch (error) {
      toast.error('This scan is no longer available');
      console.error('Error loading previous scan:', error);
      
      // Remove the invalid session from localStorage
      const existing = getRecentSessionsFromStorage();
      const filtered = existing.filter(s => s.sessionId !== sessionId);
      localStorage.setItem('threadscout_recent_sessions', JSON.stringify(filtered));
      localStorage.removeItem(`threadscout_session_${sessionId}`);
      setRecentSessions(filtered);
    }
  };

  const formatTimeAgo = (timestamp: number) => {
    const hoursAgo = Math.floor((Date.now() - timestamp) / (1000 * 60 * 60));
    if (hoursAgo < 1) return 'Just now';
    if (hoursAgo < 24) return `${hoursAgo}h ago`;
    const daysAgo = Math.floor(hoursAgo / 24);
    return `${daysAgo}d ago`;
  };

  const getScoreBadgeVariant = (score: number) => {
    if (score >= 70) return 'default'; // green
    if (score >= 50) return 'secondary'; // yellow
    return 'outline'; // red
  };

  const formatThreadTimeAgo = (createdUtc: number) => {
    const hoursAgo = Math.floor((Date.now() / 1000 - createdUtc) / 3600);
    if (hoursAgo < 1) return 'Just now';
    if (hoursAgo < 24) return `${hoursAgo}h ago`;
    const daysAgo = Math.floor(hoursAgo / 24);
    return `${daysAgo}d ago`;
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Logo and Brand Header */}
      <div className="mb-8 text-center">
        <div className="flex items-center justify-center mb-4">
          <div className="flex items-center space-x-3">
            <img 
              src="/logo.svg" 
              alt="ThreadScout Logo" 
              className="h-12 w-12"
            />
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                ThreadScout
              </h1>
            </div>
          </div>
        </div>
        <p className="text-lg text-muted-foreground mb-6">
          Find high-intent Reddit threads where your product can help
        </p>
      </div>


      {/* Dashboard Content */}
      <div className="mb-6">
        <h2 className="text-2xl font-semibold mb-2">New Scan</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Scan Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Scan Configuration</CardTitle>
            <CardDescription>
              Configure your thread discovery parameters
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Subreddits */}
            <div>
              <Label className="text-base font-medium">Subreddits</Label>
              <div className="mt-2">
                <SubredditAutocomplete
                  selectedSubs={selectedSubs}
                  onSubsChange={setSelectedSubs}
                  placeholder="Type to search and add subreddits..."
                  disabled={isLoading}
                />
              </div>
            </div>

            <Separator />

            {/* Keywords */}
            <div>
              <Label className="text-base font-medium">Keywords</Label>
              <div className="flex flex-wrap gap-2 mt-2 mb-3">
                {COMMON_KEYWORDS.map(keyword => (
                  <Badge
                    key={keyword}
                    variant={selectedKeywords.includes(keyword) ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => handleKeywordToggle(keyword)}
                  >
                    {keyword}
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Add custom keyword..."
                  value={customKeyword}
                  onChange={(e) => setCustomKeyword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddCustomKeyword()}
                />
                <Button variant="outline" onClick={handleAddCustomKeyword}>
                  Add
                </Button>
              </div>
              {selectedKeywords.length > 0 && (
                <div className="mt-2">
                  <p className="text-sm text-muted-foreground mb-1">Selected:</p>
                  <div className="flex flex-wrap gap-1">
                    {selectedKeywords.map(keyword => (
                      <Badge key={keyword} variant="secondary" className="text-xs">
                        {keyword}
                        <button
                          className="ml-1 hover:text-destructive"
                          onClick={() => handleKeywordToggle(keyword)}
                        >
                          ×
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <Separator />

            {/* Time Range and Thread Limit */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="lookback">Lookback Hours</Label>
                <Input
                  id="lookback"
                  type="number"
                  min="1"
                  max="168"
                  value={lookbackHours}
                  onChange={(e) => setLookbackHours(parseInt(e.target.value) || 24)}
                />
              </div>
              <div>
                <Label htmlFor="threadLimit">Max Threads</Label>
                <Input
                  id="threadLimit"
                  type="number"
                  min="1"
                  max="50"
                  value={threadLimit}
                  onChange={(e) => setThreadLimit(parseInt(e.target.value) || 5)}
                />
              </div>
            </div>

            {/* Allowlist removed for simplicity */}

            {isLoading ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{scanStatus}</span>
                  {scanProgress && (
                    <span className="text-muted-foreground">
                      {scanProgress.current}/{scanProgress.total}
                    </span>
                  )}
                </div>
                {scanProgress && (
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${(scanProgress.current / scanProgress.total) * 100}%` }}
                    ></div>
                  </div>
                )}
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    onClick={handleCancelScan}
                    className="flex-1"
                    size="lg"
                  >
                    <X className="mr-2 h-4 w-4" />
                    Cancel Scan
                  </Button>
                </div>
              </div>
            ) : (
              <Button 
                onClick={handleScan} 
                disabled={selectedSubs.length === 0 || selectedKeywords.length === 0} 
                className="w-full"
                size="lg"
              >
                <Search className="mr-2 h-4 w-4" />
                Scan Threads
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Results */}
        <Card>
          <CardHeader>
            <CardTitle>Results</CardTitle>
            <CardDescription>
              {isLoading && results ? 
                `Found ${results.threads.length} threads (scanning...)` :
                results ? 
                `Found ${results.threads.length} threads` : 
                'No scan results yet'
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {results ? (
              <div className="space-y-4">
                {results.threads.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    No threads found matching your criteria
                  </p>
                ) : (
                  results.threads.map((thread) => (
                    <div key={thread.thread.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            r/{thread.thread.sub}
                          </Badge>
                          <Badge variant={getScoreBadgeVariant(thread.score)} title={thread.scoreHint}>
                            {thread.score}
                          </Badge>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatThreadTimeAgo(thread.thread.createdUtc)}
                        </span>
                      </div>
                      
                      <h3 className="font-medium mb-2 line-clamp-2">
                        {thread.thread.title}
                      </h3>
                      
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                        <div className="flex items-center gap-1">
                          <ThumbsUp className="h-3 w-3" />
                          {thread.thread.upvotes}
                        </div>
                        <div className="flex items-center gap-1">
                          <MessageCircle className="h-3 w-3" />
                          {thread.thread.comments}
                        </div>
                      </div>

                      <p className="text-sm text-muted-foreground mb-2">
                        {thread.whyFit}
                      </p>
                      
                      <p className="text-xs text-blue-600 mb-3 italic">
                        Score rationale: {thread.scoreHint}
                      </p>

                      <div className="flex flex-wrap gap-1 mb-3">
                        {thread.rules.linksAllowed ? (
                          <Badge variant="outline" className="text-xs">
                            Links OK
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            No Links
                          </Badge>
                        )}
                        {thread.rules.vendorDisclosureRequired && (
                          <Badge variant="outline" className="text-xs">
                            Disclosure Required
                          </Badge>
                        )}
                        {thread.rules.notes.map((note, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {note}
                          </Badge>
                        ))}
                      </div>

                      <div className="flex gap-2 mb-3">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => toggleResponseExpansion(thread.thread.id)}
                        >
                          <Eye className="mr-1 h-3 w-3" />
                          {expandedResponses.has(thread.thread.id) ? 'Hide' : 'Show'} Responses
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => window.open(`https://www.reddit.com${thread.thread.permalink}`, '_blank')}
                        >
                          Open Thread
                          <ExternalLink className="ml-1 h-3 w-3" />
                        </Button>
                      </div>

                      {expandedResponses.has(thread.thread.id) && (
                        <div className="space-y-3 mt-4 p-3 bg-gray-50 rounded-lg">
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="font-medium text-sm">Variant A (Safe Response)</h4>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => copyToClipboard(thread.variantA.text, 'Variant A')}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                            <FormattedText className="text-sm bg-white p-3 rounded border">
                              {thread.variantA.text}
                            </FormattedText>
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="font-medium text-sm">
                                Variant B {thread.rules.linksAllowed ? '(With Links)' : '(Safe Response)'}
                              </h4>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => copyToClipboard(thread.variantB.text, 'Variant B')}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                            <FormattedText className="text-sm bg-white p-3 rounded border">
                              {thread.variantB.text}
                            </FormattedText>
                            {thread.variantB.disclosure && (
                              <div className="text-xs text-muted-foreground mt-1 italic">
                                Disclosure: {thread.variantB.disclosure}
                              </div>
                            )}
                          </div>

                          {thread.risks.length > 0 && (
                            <div>
                              <h4 className="font-medium text-sm mb-2">Risks & Considerations</h4>
                              <ul className="text-sm space-y-1">
                                {thread.risks.map((risk, i) => (
                                  <li key={i} className="text-orange-600">• {risk}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
                
                {/* Show recent scans at bottom when there are current results */}
                {recentSessions.length > 0 && (
                  <div className="mt-8 pt-6 border-t">
                    <h3 className="text-sm font-medium mb-3 flex items-center gap-2 text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      Recent Scans
                    </h3>
                    <div className="grid grid-cols-1 gap-2">
                      {recentSessions.slice(0, 3).map((session) => (
                        <div 
                          key={session.sessionId} 
                          className={`flex items-center justify-between p-3 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer ${
                            session.sessionId.startsWith('sample_') ? 'bg-blue-50' : 'bg-gray-50'
                          }`}
                          onClick={() => loadPreviousScan(session.sessionId)}
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="text-xs">
                                {session.threadsCount}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {session.topScore}
                              </Badge>
                              {session.sessionId.startsWith('sample_') && (
                                <Badge variant="outline" className="text-xs text-blue-600">
                                  Sample
                                </Badge>
                              )}
                            </div>
                            <div className="text-sm">
                              r/{session.scanParams.subs.slice(0, 2).join(', ')}
                              {session.scanParams.subs.length > 2 && '...'}
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatTimeAgo(session.createdAt)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div>
                {/* Show recent scans when no current results */}
                {recentSessions.length > 0 ? (
                  <div>
                    <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
                      <Clock className="h-5 w-5" />
                      Recent Scans
                    </h3>
                    <div className="space-y-3">
                      {recentSessions.map((session) => (
                        <div 
                          key={session.sessionId} 
                          className={`border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer ${
                            session.sessionId.startsWith('sample_') ? 'bg-blue-50 border-blue-200' : ''
                          }`}
                          onClick={() => loadPreviousScan(session.sessionId)}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="text-xs">
                                {session.threadsCount} threads
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                <BarChart3 className="h-3 w-3 mr-1" />
                                {session.topScore}
                              </Badge>
                              {session.sessionId.startsWith('sample_') && (
                                <Badge variant="outline" className="text-xs text-blue-600">
                                  Sample
                                </Badge>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {formatTimeAgo(session.createdAt)}
                            </span>
                          </div>
                          
                          <div className="text-sm font-medium mb-1">
                            r/{session.scanParams.subs.slice(0, 2).join(', ')}
                            {session.scanParams.subs.length > 2 && ` +${session.scanParams.subs.length - 2}`}
                          </div>
                          
                          <div className="text-xs text-muted-foreground">
                            Keywords: {session.scanParams.keywords.slice(0, 2).join(', ')}
                            {session.scanParams.keywords.length > 2 && '...'}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">
                      Configure your scan parameters and click "Scan Threads" to get started
                    </p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}