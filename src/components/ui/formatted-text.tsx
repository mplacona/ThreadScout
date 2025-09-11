import React from 'react';

interface FormattedTextProps {
  children: string;
  className?: string;
}

/**
 * Simple component to render basic markdown formatting without external dependencies
 * Handles: **bold**, *italic*, `code`, and preserves line breaks
 */
export function FormattedText({ children, className = '' }: FormattedTextProps) {
  const formatText = (text: string) => {
    // Split by line breaks to preserve them
    const lines = text.split('\n');
    
    return lines.map((line, lineIndex) => {
      const parts: React.ReactNode[] = [];
      let currentIndex = 0;
      
      // Process the line for formatting
      let processedLine = line;
      const patterns = [
        { regex: /\*\*(.*?)\*\*/g, component: 'strong' },
        { regex: /\*(.*?)\*/g, component: 'em' },
        { regex: /`(.*?)`/g, component: 'code' },
      ];
      
      // Find all matches for all patterns
      const allMatches: Array<{
        start: number;
        end: number;
        content: string;
        component: string;
        fullMatch: string;
      }> = [];
      
      patterns.forEach(({ regex, component }) => {
        let match;
        const regexCopy = new RegExp(regex.source, regex.flags);
        while ((match = regexCopy.exec(line)) !== null) {
          allMatches.push({
            start: match.index,
            end: match.index + match[0].length,
            content: match[1],
            component,
            fullMatch: match[0],
          });
        }
      });
      
      // Sort matches by start position
      allMatches.sort((a, b) => a.start - b.start);
      
      // Remove overlapping matches (keep the first one)
      const nonOverlappingMatches = [];
      let lastEnd = 0;
      for (const match of allMatches) {
        if (match.start >= lastEnd) {
          nonOverlappingMatches.push(match);
          lastEnd = match.end;
        }
      }
      
      // Build the formatted line
      let currentPos = 0;
      nonOverlappingMatches.forEach((match, matchIndex) => {
        // Add text before this match
        if (match.start > currentPos) {
          parts.push(line.slice(currentPos, match.start));
        }
        
        // Add the formatted element
        const key = `${currentPos}-${matchIndex}`;
        if (match.component === 'strong') {
          parts.push(<strong key={key}>{match.content}</strong>);
        } else if (match.component === 'em') {
          parts.push(<em key={key}>{match.content}</em>);
        } else if (match.component === 'code') {
          parts.push(
            <code key={key} className="bg-gray-100 px-1 py-0.5 rounded text-sm font-mono">
              {match.content}
            </code>
          );
        }
        
        currentPos = match.end;
      });
      
      // Add remaining text
      if (currentPos < line.length) {
        parts.push(line.slice(currentPos));
      }
      
      // If no formatting was found, just return the original line
      if (parts.length === 0) {
        parts.push(line);
      }
      
      return (
        <span key={lineIndex}>
          {parts}
          {lineIndex < lines.length - 1 && <br />}
        </span>
      );
    });
  };

  return (
    <div className={className}>
      {formatText(children)}
    </div>
  );
}
