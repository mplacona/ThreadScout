import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Search, TrendingUp, MessageCircle, ThumbsUp, ExternalLink, X, Eye, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { api, type ScanRequest, type ThreadSummary, type StreamingScanEvent } from '@/lib/api';

const POPULAR_SUBREDDITS = [
  'webdev', 'reactjs', 'javascript', 'programming', 'webdesign',
  'startups', 'entrepreneur', 'smallbusiness', 'marketing', 'seo'
];

const COMMON_KEYWORDS = [
  'help', 'problem', 'stuck', 'how to', 'best way', 'recommendations',
  'tool', 'solution', 'advice', 'experience', 'struggling'
];

export default function Dashboard() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<{ sessionId: string; threads: ThreadSummary[] } | null>(null);
  
  // Streaming scan state
  const [scanStatus, setScanStatus] = useState<string>('');
  const [scanProgress, setScanProgress] = useState<{ current: number; total: number } | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [cancelScan, setCancelScan] = useState<(() => Promise<boolean>) | null>(null);
  
  // UI state for response previews
  const [expandedResponses, setExpandedResponses] = useState<Set<string>>(new Set());

  // Form state
  const [selectedSubs, setSelectedSubs] = useState<string[]>(['webdev', 'reactjs']);
  const [customSub, setCustomSub] = useState('');
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>(['help', 'problem']);
  const [customKeyword, setCustomKeyword] = useState('');
  const [lookbackHours, setLookbackHours] = useState(24);
  const [threadLimit, setThreadLimit] = useState(5);
  // Removed allowlist for simplicity - links allowed by default

  const handleSubToggle = (sub: string) => {
    setSelectedSubs(prev => 
      prev.includes(sub) 
        ? prev.filter(s => s !== sub)
        : [...prev, sub]
    );
  };

  const handleAddCustomSub = () => {
    if (customSub.trim() && !selectedSubs.includes(customSub.trim())) {
      setSelectedSubs(prev => [...prev, customSub.trim()]);
      setCustomSub('');
    }
  };

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
            setIsLoading(false);
            setCancelScan(null);
            setCurrentSessionId(null);
            setScanStatus('');
            setScanProgress(null);
            toast.success(event.message || `Scan completed! Found ${event.totalThreads || 0} threads.`);
            break;
          
          case 'cancelled':
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

  const getScoreBadgeVariant = (score: number) => {
    if (score >= 70) return 'default'; // green
    if (score >= 50) return 'secondary'; // yellow
    return 'outline'; // red
  };

  const formatTimeAgo = (createdUtc: number) => {
    const hoursAgo = Math.floor((Date.now() / 1000 - createdUtc) / 3600);
    if (hoursAgo < 1) return 'Just now';
    if (hoursAgo < 24) return `${hoursAgo}h ago`;
    const daysAgo = Math.floor(hoursAgo / 24);
    return `${daysAgo}d ago`;
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">ThreadScout Dashboard</h1>
        <p className="text-muted-foreground">
          Find high-intent Reddit threads where your product can help
        </p>
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
              <div className="flex flex-wrap gap-2 mt-2 mb-3">
                {POPULAR_SUBREDDITS.map(sub => (
                  <Badge
                    key={sub}
                    variant={selectedSubs.includes(sub) ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => handleSubToggle(sub)}
                  >
                    r/{sub}
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Add custom subreddit..."
                  value={customSub}
                  onChange={(e) => setCustomSub(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddCustomSub()}
                />
                <Button variant="outline" onClick={handleAddCustomSub}>
                  Add
                </Button>
              </div>
              {selectedSubs.length > 0 && (
                <div className="mt-2">
                  <p className="text-sm text-muted-foreground mb-1">Selected:</p>
                  <div className="flex flex-wrap gap-1">
                    {selectedSubs.map(sub => (
                      <Badge key={sub} variant="secondary" className="text-xs">
                        r/{sub}
                        <button
                          className="ml-1 hover:text-destructive"
                          onClick={() => handleSubToggle(sub)}
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
                          <Badge variant={getScoreBadgeVariant(thread.score)}>
                            {thread.score}
                          </Badge>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatTimeAgo(thread.thread.createdUtc)}
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

                      <p className="text-sm text-muted-foreground mb-3">
                        {thread.whyFit}
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
                          onClick={() => navigate(`/thread/${thread.thread.id}?sessionId=${results.sessionId}`)}
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
                            <div className="text-sm bg-white p-3 rounded border whitespace-pre-wrap">
                              {thread.variantA.text}
                            </div>
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
                            <div className="text-sm bg-white p-3 rounded border whitespace-pre-wrap">
                              {thread.variantB.text}
                            </div>
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
              </div>
            ) : (
              <div className="text-center py-12">
                <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  Configure your scan parameters and click "Scan Threads" to get started
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}