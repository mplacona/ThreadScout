import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Input } from './input';
import { Button } from './button';
import { Badge } from './badge';
import { X, ChevronDown } from 'lucide-react';
import { api } from '@/lib/api';

interface SubredditAutocompleteProps {
  selectedSubs: string[];
  onSubsChange: (subs: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
}

// Client-side cache for subreddit searches
const searchCache = new Map<string, { results: Array<{name: string, subscribers: number, displayName: string}>; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export function SubredditAutocomplete({
  selectedSubs,
  onSubsChange,
  placeholder = "Type to search subreddits...",
  disabled = false
}: SubredditAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<Array<{name: string, subscribers: number, displayName: string}>>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();

  // Popular subreddits as fallback/initial suggestions
  const popularSubs = [
    { name: 'webdev', subscribers: 0, displayName: 'webdev' },
    { name: 'reactjs', subscribers: 0, displayName: 'reactjs' },
    { name: 'javascript', subscribers: 0, displayName: 'javascript' },
    { name: 'programming', subscribers: 0, displayName: 'programming' },
    { name: 'webdesign', subscribers: 0, displayName: 'webdesign' },
    { name: 'startups', subscribers: 0, displayName: 'startups' },
    { name: 'entrepreneur', subscribers: 0, displayName: 'entrepreneur' },
    { name: 'smallbusiness', subscribers: 0, displayName: 'smallbusiness' },
    { name: 'marketing', subscribers: 0, displayName: 'marketing' },
    { name: 'seo', subscribers: 0, displayName: 'seo' },
    { name: 'linkedin', subscribers: 0, displayName: 'linkedin' },
    { name: 'linkedinads', subscribers: 0, displayName: 'linkedinads' },
    { name: 'linkedintips', subscribers: 0, displayName: 'linkedintips' },
    { name: 'learnprogramming', subscribers: 0, displayName: 'learnprogramming' }
  ];

  const searchSubreddits = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSuggestions(popularSubs.filter(sub => !selectedSubs.includes(sub.name)));
      return;
    }

    // Check cache first
    const cacheKey = query.toLowerCase();
    const cached = searchCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      setSuggestions(cached.results.filter(sub => !selectedSubs.includes(sub.name)));
      return;
    }

    setIsSearching(true);
    try {
      const results = await api.searchSubreddits(query, 10);
      
      // Cache the results
      searchCache.set(cacheKey, {
        results,
        timestamp: Date.now()
      });
      
      // Filter out already selected subreddits
      const filteredResults = results.filter(sub => !selectedSubs.includes(sub.name));
      setSuggestions(filteredResults);
    } catch (error) {
      console.error('Failed to search subreddits:', error);
      // Fallback to local filtering
      const fallbackResults = popularSubs.filter(sub => 
        sub.name.toLowerCase().includes(query.toLowerCase()) && !selectedSubs.includes(sub.name)
      );
      setSuggestions(fallbackResults);
    } finally {
      setIsSearching(false);
    }
  }, [selectedSubs]);

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      searchSubreddits(inputValue);
    }, 300); // Debounce search

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [inputValue, selectedSubs, searchSubreddits]);

  const addSubreddit = (sub: string) => {
    if (!selectedSubs.includes(sub)) {
      onSubsChange([...selectedSubs, sub]);
    }
    setInputValue('');
    setOpen(false);
  };

  const removeSubreddit = (sub: string) => {
    onSubsChange(selectedSubs.filter(s => s !== sub));
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      e.preventDefault();
      const sub = inputValue.trim();
      if (!selectedSubs.includes(sub)) {
        addSubreddit(sub);
      }
    }
  };

  return (
    <div className="space-y-2">
      {/* Selected subreddits */}
      {selectedSubs.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedSubs.map((sub) => (
            <Badge key={sub} variant="secondary" className="flex items-center gap-1">
              r/{sub}
              {!disabled && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-3 w-3 p-0 hover:bg-transparent"
                  onClick={() => removeSubreddit(sub)}
                >
                  <X className="h-2 w-2" />
                </Button>
              )}
            </Badge>
          ))}
        </div>
      )}

      {/* Autocomplete input */}
      <div className="relative">
        <Input
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setOpen(true);
          }}
          onKeyDown={handleInputKeyDown}
          onFocus={() => {
            setOpen(true);
            if (!inputValue) {
              setSuggestions(popularSubs.filter(sub => !selectedSubs.includes(sub.name)));
            }
          }}
          placeholder={placeholder}
          disabled={disabled}
          className="pr-8"
        />
        <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        
        {/* Simple dropdown - no Popover for now */}
        {open && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
            {suggestions.length === 0 && !isSearching ? (
              <div className="px-3 py-2 text-sm text-gray-500">
                {inputValue.length < 2 
                  ? "Type at least 2 characters to search" 
                  : "No subreddits found"}
              </div>
            ) : (
              <>
                {suggestions.slice(0, 8).map((sub) => (
                  <div
                    key={sub.name}
                    onClick={() => addSubreddit(sub.name)}
                    className="px-3 py-2 text-sm cursor-pointer hover:bg-gray-100"
                  >
                    r/{sub.displayName}
                  </div>
                ))}
                {isSearching && (
                  <div className="px-3 py-2 text-sm text-gray-500">
                    Searching...
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
      
      {/* Click outside to close */}
      {open && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setOpen(false)}
        />
      )}
    </div>
  );
}