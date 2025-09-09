import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, Copy, ExternalLink, Save, ThumbsUp, MessageCircle, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { api, type ThreadSummary } from '@/lib/api';

export default function Thread() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const sessionId = searchParams.get('sessionId');

  const [thread, setThread] = useState<ThreadSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Draft editing state
  const [variantAText, setVariantAText] = useState('');
  const [variantBText, setVariantBText] = useState('');
  const [showDisclosure, setShowDisclosure] = useState(false);
  
  // Outcome tracking
  const [commentUrl, setCommentUrl] = useState('');
  const [isSavingOutcome, setIsSavingOutcome] = useState(false);

  useEffect(() => {
    if (!id || !sessionId) {
      setError('Missing thread ID or session ID');
      setIsLoading(false);
      return;
    }

    loadThread();
  }, [id, sessionId]);

  const loadThread = async () => {
    if (!id || !sessionId) return;

    try {
      setIsLoading(true);
      const threadData = await api.getThread(id, sessionId);
      setThread(threadData);
      setVariantAText(threadData.variantA.text);
      setVariantBText(threadData.variantB.text);
      setShowDisclosure(!!threadData.variantB.disclosure);
    } catch (err) {
      console.error('Error loading thread:', err);
      setError(err instanceof Error ? err.message : 'Failed to load thread');
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied to clipboard`);
    } catch (err) {
      console.error('Copy failed:', err);
      toast.error('Failed to copy text');
    }
  };

  const saveOutcome = async () => {
    if (!thread || !sessionId || !commentUrl.trim()) {
      toast.error('Please enter a comment URL');
      return;
    }

    // Validate URL
    try {
      const url = new URL(commentUrl);
      if (!url.hostname.includes('reddit.com')) {
        toast.error('Please enter a valid Reddit comment URL');
        return;
      }
    } catch {
      toast.error('Please enter a valid URL');
      return;
    }

    setIsSavingOutcome(true);
    
    try {
      await api.createOutcome({
        threadId: thread.thread.id,
        commentUrl: commentUrl.trim(),
        sessionId,
      });
      
      toast.success('Outcome saved successfully');
      setCommentUrl('');
    } catch (err) {
      console.error('Error saving outcome:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to save outcome');
    } finally {
      setIsSavingOutcome(false);
    }
  };

  const formatTimeAgo = (createdUtc: number) => {
    const hoursAgo = Math.floor((Date.now() / 1000 - createdUtc) / 3600);
    if (hoursAgo < 1) return 'Just now';
    if (hoursAgo < 24) return `${hoursAgo}h ago`;
    const daysAgo = Math.floor(hoursAgo / 24);
    return `${daysAgo}d ago`;
  };

  const getScoreBadgeVariant = (score: number) => {
    if (score >= 70) return 'default';
    if (score >= 50) return 'secondary';
    return 'outline';
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </div>
            <p className="mt-4 text-muted-foreground">Loading thread...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !thread) {
    return (
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="text-center py-12">
          <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Error</h2>
          <p className="text-muted-foreground mb-4">{error || 'Thread not found'}</p>
          <Button onClick={() => navigate('/')} variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Header */}
      <div className="mb-6">
        <Button 
          onClick={() => navigate('/')} 
          variant="outline" 
          size="sm"
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>
        
        <div className="flex items-center gap-4 mb-2">
          <Badge variant="outline">r/{thread.thread.sub}</Badge>
          <Badge variant={getScoreBadgeVariant(thread.score)}>
            Score: {thread.score}
          </Badge>
          <span className="text-sm text-muted-foreground">
            {formatTimeAgo(thread.thread.createdUtc)}
          </span>
        </div>
        
        <h1 className="text-2xl font-bold mb-2">{thread.thread.title}</h1>
        
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>by u/{thread.thread.author}</span>
          <div className="flex items-center gap-1">
            <ThumbsUp className="h-3 w-3" />
            {thread.thread.upvotes}
          </div>
          <div className="flex items-center gap-1">
            <MessageCircle className="h-3 w-3" />
            {thread.thread.comments}
          </div>
          <a 
            href={`https://reddit.com${thread.thread.permalink}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 hover:text-foreground"
          >
            View on Reddit <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Left: Rules & Analysis */}
        <div className="xl:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Analysis</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="font-medium">Why It Fits</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  {thread.whyFit}
                </p>
              </div>

              {thread.risks.length > 0 && (
                <div>
                  <Label className="font-medium text-destructive">Risks</Label>
                  <div className="space-y-1 mt-1">
                    {thread.risks.map((risk, i) => (
                      <Badge key={i} variant="destructive" className="text-xs block w-fit">
                        {risk}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Rules Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Badge 
                  variant={thread.rules.linksAllowed ? "default" : "secondary"}
                  className="text-xs"
                >
                  {thread.rules.linksAllowed ? "Links Allowed" : "No Links"}
                </Badge>
                
                {thread.rules.vendorDisclosureRequired && (
                  <Badge variant="outline" className="text-xs block w-fit">
                    Disclosure Required
                  </Badge>
                )}
                
                {thread.rules.linkLimit && (
                  <Badge variant="outline" className="text-xs block w-fit">
                    Max {thread.rules.linkLimit} link(s)
                  </Badge>
                )}
                
                {thread.rules.notes.map((note, i) => (
                  <Badge key={i} variant="secondary" className="text-xs block w-fit">
                    {note}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Center: Thread Content */}
        <div className="xl:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Thread Content</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {thread.thread.body && (
                <div>
                  <Label className="font-medium">Post Body</Label>
                  <div className="mt-2 p-3 bg-muted rounded-md text-sm whitespace-pre-wrap">
                    {thread.thread.body}
                  </div>
                </div>
              )}

              {thread.thread.topComments.length > 0 && (
                <div>
                  <Label className="font-medium">Top Comments</Label>
                  <div className="mt-2 space-y-3">
                    {thread.thread.topComments.map((comment, i) => (
                      <div key={i} className="p-3 bg-muted rounded-md">
                        <p className="text-xs text-muted-foreground mb-1">
                          u/{comment.author}
                        </p>
                        <p className="text-sm whitespace-pre-wrap">
                          {comment.body}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Draft Variants */}
        <div className="xl:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Reply Drafts</CardTitle>
              <CardDescription>
                Edit and copy your reply variants
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Variant A */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="font-medium">Variant A (Help Only)</Label>
                  <span className="text-xs text-muted-foreground">
                    {variantAText.length} chars
                  </span>
                </div>
                <Textarea
                  value={variantAText}
                  onChange={(e) => setVariantAText(e.target.value)}
                  placeholder="Helpful reply without links..."
                  className="min-h-32 text-sm"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard(variantAText, 'Variant A')}
                  className="mt-2 w-full"
                >
                  <Copy className="mr-2 h-3 w-3" />
                  Copy Variant A
                </Button>
              </div>

              <Separator />

              {/* Variant B */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="font-medium">Variant B (With Link)</Label>
                  <span className="text-xs text-muted-foreground">
                    {variantBText.length} chars
                  </span>
                </div>
                
                {thread.rules.vendorDisclosureRequired && (
                  <div className="flex items-center space-x-2 mb-2">
                    <Switch
                      id="disclosure"
                      checked={showDisclosure}
                      onCheckedChange={setShowDisclosure}
                    />
                    <Label htmlFor="disclosure" className="text-sm">
                      Include disclosure
                    </Label>
                  </div>
                )}
                
                <Textarea
                  value={variantBText}
                  onChange={(e) => setVariantBText(e.target.value)}
                  placeholder="Helpful reply with link and disclosure..."
                  className="min-h-32 text-sm"
                />
                
                {showDisclosure && thread.variantB.disclosure && (
                  <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
                    <strong>Disclosure:</strong> {thread.variantB.disclosure}
                  </div>
                )}
                
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard(variantBText, 'Variant B')}
                  className="mt-2 w-full"
                >
                  <Copy className="mr-2 h-3 w-3" />
                  Copy Variant B
                </Button>
              </div>

              <Separator />

              {/* Outcome Tracking */}
              <div>
                <Label className="font-medium">Track Outcome</Label>
                <p className="text-xs text-muted-foreground mb-2">
                  Paste your comment URL after posting to track results
                </p>
                <Input
                  placeholder="https://reddit.com/r/.../comments/.../..."
                  value={commentUrl}
                  onChange={(e) => setCommentUrl(e.target.value)}
                  className="mb-2"
                />
                <Button
                  size="sm"
                  onClick={saveOutcome}
                  disabled={isSavingOutcome || !commentUrl.trim()}
                  className="w-full"
                >
                  <Save className="mr-2 h-3 w-3" />
                  {isSavingOutcome ? 'Saving...' : 'Save Outcome'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}