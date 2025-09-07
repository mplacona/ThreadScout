import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { X, Search, Plus } from "lucide-react";
import { SearchFilters } from "@/types/reddit";

interface ThreadSearchProps {
  onSearch: (filters: SearchFilters) => void;
  isLoading?: boolean;
}

export function ThreadSearch({ onSearch, isLoading }: ThreadSearchProps) {
  const [subreddits, setSubreddits] = useState<string[]>(["webdev", "devops", "startups"]);
  const [keywords, setKeywords] = useState<string[]>(["API", "monitoring", "cloud"]);
  const [lookbackHours, setLookbackHours] = useState(24);
  const [newSubreddit, setNewSubreddit] = useState("");
  const [newKeyword, setNewKeyword] = useState("");

  const handleAddSubreddit = () => {
    if (newSubreddit.trim() && !subreddits.includes(newSubreddit.trim())) {
      setSubreddits([...subreddits, newSubreddit.trim()]);
      setNewSubreddit("");
    }
  };

  const handleAddKeyword = () => {
    if (newKeyword.trim() && !keywords.includes(newKeyword.trim())) {
      setKeywords([...keywords, newKeyword.trim()]);
      setNewKeyword("");
    }
  };

  const handleRemoveSubreddit = (sub: string) => {
    setSubreddits(subreddits.filter(s => s !== sub));
  };

  const handleRemoveKeyword = (keyword: string) => {
    setKeywords(keywords.filter(k => k !== keyword));
  };

  const handleSearch = () => {
    onSearch({
      subreddits,
      keywords,
      lookback_hours: lookbackHours,
      sort_by: "hot"
    });
  };

  return (
    <Card className="p-6 mb-6">
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Search className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Search Reddit Threads</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Subreddits */}
          <div className="space-y-3">
            <Label htmlFor="subreddits">Subreddits</Label>
            <div className="flex gap-2">
              <Input
                id="subreddits"
                placeholder="Enter subreddit name"
                value={newSubreddit}
                onChange={(e) => setNewSubreddit(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddSubreddit()}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleAddSubreddit}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {subreddits.map((sub) => (
                <Badge key={sub} variant="secondary" className="flex items-center gap-1">
                  r/{sub}
                  <X
                    className="h-3 w-3 cursor-pointer hover:text-destructive"
                    onClick={() => handleRemoveSubreddit(sub)}
                  />
                </Badge>
              ))}
            </div>
          </div>

          {/* Keywords */}
          <div className="space-y-3">
            <Label htmlFor="keywords">Keywords</Label>
            <div className="flex gap-2">
              <Input
                id="keywords"
                placeholder="Enter keyword"
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddKeyword()}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleAddKeyword}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {keywords.map((keyword) => (
                <Badge key={keyword} variant="outline" className="flex items-center gap-1">
                  {keyword}
                  <X
                    className="h-3 w-3 cursor-pointer hover:text-destructive"
                    onClick={() => handleRemoveKeyword(keyword)}
                  />
                </Badge>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="space-y-2">
            <Label htmlFor="lookback">Lookback Period</Label>
            <Select
              value={lookbackHours.toString()}
              onValueChange={(value) => setLookbackHours(parseInt(value))}
            >
              <SelectTrigger id="lookback" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 hour</SelectItem>
                <SelectItem value="6">6 hours</SelectItem>
                <SelectItem value="24">24 hours</SelectItem>
                <SelectItem value="168">7 days</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1" />

          <Button 
            onClick={handleSearch} 
            disabled={isLoading}
            className="min-w-32"
          >
            {isLoading ? "Searching..." : "Search Threads"}
          </Button>
        </div>
      </div>
    </Card>
  );
}