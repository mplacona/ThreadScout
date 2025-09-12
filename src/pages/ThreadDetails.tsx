import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Copy, ExternalLink, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { RedditThread, OpportunityScore, ReplyDraft, SubredditRules } from "@/types/reddit";
import { FormattedText } from "@/components/ui/formatted-text";
import { redditClient } from "@/lib/reddit-client";
import { agentClient } from "@/lib/agent-client";

export default function ThreadDetails() {
  const { threadId } = useParams<{ threadId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [thread, setThread] = useState<RedditThread | null>(null);
  const [opportunity, setOpportunity] = useState<OpportunityScore | null>(null);
  const [draft, setDraft] = useState<ReplyDraft | null>(null);
  const [rules, setRules] = useState<SubredditRules | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedVariant, setCopiedVariant] = useState<string | null>(null);

  useEffect(() => {
    if (threadId) {
      loadThreadDetails();
    }
  }, [threadId, loadThreadDetails]);

  const loadThreadDetails = useCallback(async () => {
    if (!threadId) return;
    
    setLoading(true);
    try {
      // Mock data for now - in real app this would fetch from API
      const mockThreads = await redditClient.searchThreads({ 
        subreddits: [], 
        keywords: [], 
        lookback_hours: 24 
      });
      
      const foundThread = mockThreads.find(t => t.id === threadId);
      if (!foundThread) {
        navigate("/");
        return;
      }

      setThread(foundThread);
      
      const threadRules = await redditClient.getSubredditRules(foundThread.subreddit);
      setRules(threadRules);
      
      const { opportunity: threadOpportunity, draft: threadDraft } = await agentClient.scoreAndDraft(
        foundThread,
        threadRules,
        ["digitalocean.com", "docs.digitalocean.com"]
      );
      
      setOpportunity(threadOpportunity);
      setDraft(threadDraft);
    } catch (error) {
      console.error("Error loading thread details:", error);
      toast({
        title: "Error",
        description: "Failed to load thread details",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [threadId, navigate, toast]);

  const copyToClipboard = async (text: string, variant: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedVariant(variant);
      setTimeout(() => setCopiedVariant(null), 2000);
      toast({
        title: "Copied!",
        description: `${variant} copied to clipboard`
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy to clipboard",
        variant: "destructive"
      });
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600 bg-green-50 border-green-200";
    if (score >= 60) return "text-yellow-600 bg-yellow-50 border-yellow-200";
    return "text-red-600 bg-red-50 border-red-200";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <Button variant="ghost" onClick={() => navigate("/")} size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Search
            </Button>
          </div>
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading thread details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!thread || !opportunity || !draft || !rules) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <Button variant="ghost" onClick={() => navigate("/")} size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Search
            </Button>
          </div>
          <div className="text-center py-12">
            <p className="text-muted-foreground">Thread not found</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" onClick={() => navigate("/")} size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Search
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Rules & Analysis */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Opportunity Score
                  <Badge className={`${getScoreColor(opportunity.score)} border`}>
                    {opportunity.score}/100
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm">{opportunity.why_fit}</p>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">Risk Factors</Label>
                  {opportunity.rule_risk.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {opportunity.rule_risk.map((risk, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {risk}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">No significant risks identified</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Subreddit Rules</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={rules.links_allowed ? "default" : "destructive"}>
                      {rules.links_allowed ? "Links OK" : "No Links"}
                    </Badge>
                    {rules.vendor_disclosure_required && (
                      <Badge variant="secondary">Disclosure Req</Badge>
                    )}
                    {rules.no_promo_days && (
                      <Badge variant="outline">No Promo {rules.no_promo_days}d</Badge>
                    )}
                  </div>
                </div>
                <Separator />
                <div className="space-y-2">
                  {rules.rules.map((rule, idx) => (
                    <div key={idx} className="text-sm">
                      <p className="font-medium">{rule.short_name}</p>
                      <p className="text-muted-foreground text-xs">{rule.description}</p>
                    </div>
                  ))}
                </div>
                {rules.notes && (
                  <>
                    <Separator />
                    <p className="text-xs text-muted-foreground">{rules.notes}</p>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Center Column - Thread Content */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <h1 className="text-xl font-bold leading-tight">{thread.title}</h1>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span>r/{thread.subreddit}</span>
                      <span>by u/{thread.author}</span>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(`https://reddit.com${thread.permalink}`, "_blank")}
                  >
                    <ExternalLink className="h-4 w-4 mr-1" />
                    View on Reddit
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {thread.selftext && (
                  <div className="prose prose-sm max-w-none">
                    <p className="whitespace-pre-wrap">{thread.selftext}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Reply Drafts */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Variant A - Help Only</CardTitle>
                <p className="text-sm text-muted-foreground">Helpful response with no links</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormattedText className="min-h-32 p-3 border rounded-md bg-muted/50">
                  {draft.variant_a.text}
                </FormattedText>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{draft.variant_a.text.length} characters</span>
                  <Button
                    size="sm"
                    onClick={() => copyToClipboard(draft.variant_a.text, "Variant A")}
                    className="h-8"
                  >
                    {copiedVariant === "Variant A" ? (
                      <Check className="h-4 w-4 mr-1" />
                    ) : (
                      <Copy className="h-4 w-4 mr-1" />
                    )}
                    {copiedVariant === "Variant A" ? "Copied!" : "Copy"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Variant B - Help + Link</CardTitle>
                <p className="text-sm text-muted-foreground">Helpful response with relevant link and disclosure</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormattedText className="min-h-32 p-3 border rounded-md bg-muted/50">
                  {draft.variant_b.text}
                </FormattedText>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">Links Found</Label>
                  {draft.variant_b.links.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {draft.variant_b.links.map((link, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {new URL(link).hostname}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">No links detected</p>
                  )}
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{draft.variant_b.text.length} characters</span>
                  <Button
                    size="sm"
                    onClick={() => copyToClipboard(draft.variant_b.text, "Variant B")}
                    className="h-8"
                  >
                    {copiedVariant === "Variant B" ? (
                      <Check className="h-4 w-4 mr-1" />
                    ) : (
                      <Copy className="h-4 w-4 mr-1" />
                    )}
                    {copiedVariant === "Variant B" ? "Copied!" : "Copy"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}