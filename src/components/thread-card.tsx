import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ArrowUp, MessageCircle, Clock, ExternalLink } from "lucide-react";
import { RedditThread, OpportunityScore, SubredditRules } from "@/types/reddit";

interface ThreadCardProps {
  thread: RedditThread;
  opportunity?: OpportunityScore;
  rules?: SubredditRules;
  onViewDetails: (threadId: string) => void;
}

export function ThreadCard({ thread, opportunity, rules, onViewDetails }: ThreadCardProps) {
  const getScoreColor = (score: number) => {
    if (score >= 80) return "bg-green-500";
    if (score >= 60) return "bg-yellow-500";
    return "bg-red-500";
  };

  const getTimeAgo = (timestamp: number) => {
    const hours = Math.floor((Date.now() / 1000 - timestamp) / 3600);
    if (hours < 1) return "< 1h ago";
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const getRuleBadges = () => {
    if (!rules) return [];
    
    const badges = [];
    
    if (rules.links_allowed) {
      badges.push({ text: "Links OK", variant: "default" as const });
    } else {
      badges.push({ text: "No Links", variant: "destructive" as const });
    }
    
    if (rules.vendor_disclosure_required) {
      badges.push({ text: "Disclosure Req", variant: "secondary" as const });
    }
    
    if (rules.no_promo_days) {
      badges.push({ text: `No Promo ${rules.no_promo_days}d`, variant: "outline" as const });
    }
    
    return badges;
  };

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg leading-tight mb-2 line-clamp-2">
              {thread.title}
            </h3>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span>r/{thread.subreddit}</span>
              <span>by u/{thread.author}</span>
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {getTimeAgo(thread.created_utc)}
              </div>
            </div>
          </div>
          
          {opportunity && (
            <Badge 
              className={`text-white ${getScoreColor(opportunity.score)} min-w-12 justify-center`}
            >
              {opportunity.score}
            </Badge>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {getRuleBadges().map((badge, idx) => (
            <Badge key={idx} variant={badge.variant} className="text-xs">
              {badge.text}
            </Badge>
          ))}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {thread.selftext && (
          <p className="text-sm text-muted-foreground line-clamp-3">
            {thread.selftext}
          </p>
        )}

        {opportunity && (
          <p className="text-sm font-medium text-foreground">
            {opportunity.why_fit}
          </p>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <ArrowUp className="h-4 w-4" />
              {thread.score}
            </div>
            <div className="flex items-center gap-1">
              <MessageCircle className="h-4 w-4" />
              {thread.num_comments}
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(`https://reddit.com${thread.permalink}`, "_blank")}
            >
              <ExternalLink className="h-4 w-4 mr-1" />
              Reddit
            </Button>
            <Button
              size="sm"
              onClick={() => onViewDetails(thread.id)}
            >
              View Details
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}