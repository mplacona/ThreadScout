// Server-side validators - duplicated to avoid importing client code

export function extractLinks(text: string): string[] {
  const urlRegex = /https?:\/\/[^\s<>"\[\]{}|\\^`]+/gi;
  return text.match(urlRegex) || [];
}

export interface LinkValidationResult {
  ok: boolean;
  cleaned: string;
  count: number;
}

export function enforceOneLink(text: string): LinkValidationResult {
  const links = extractLinks(text);
  
  if (links.length <= 1) {
    return {
      ok: true,
      cleaned: text,
      count: links.length,
    };
  }

  // Remove all links except the first one
  const firstLink = links[0];
  let cleaned = text;
  
  // Remove all other links
  for (let i = 1; i < links.length; i++) {
    cleaned = cleaned.replace(links[i], '');
  }

  // Clean up any double spaces or formatting issues
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  return {
    ok: false,
    cleaned,
    count: links.length,
  };
}

export interface AllowlistValidationResult {
  ok: boolean;
  cleaned: string;
  violations: string[];
}

export function enforceAllowlist(text: string, allowlist: string[] = []): AllowlistValidationResult {
  // If no allowlist provided, allow all valid URLs
  if (allowlist.length === 0) {
    return {
      ok: true,
      cleaned: text,
      violations: [],
    };
  }
  const links = extractLinks(text);
  const violations: string[] = [];
  let cleaned = text;

  for (const link of links) {
    try {
      const url = new URL(link);
      const domain = url.hostname.toLowerCase();
      
      // Remove 'www.' prefix for comparison
      const normalizedDomain = domain.replace(/^www\./, '');
      
      // Check if domain or any parent domain is in allowlist
      const isAllowed = allowlist.some(allowedDomain => {
        const normalizedAllowed = allowedDomain.toLowerCase().replace(/^www\./, '');
        return normalizedDomain === normalizedAllowed || 
               normalizedDomain.endsWith('.' + normalizedAllowed);
      });

      if (!isAllowed) {
        violations.push(domain);
        cleaned = cleaned.replace(link, '');
      }
    } catch (error) {
      // Invalid URL, remove it
      violations.push(link);
      cleaned = cleaned.replace(link, '');
    }
  }

  // Clean up formatting after removing links
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  return {
    ok: violations.length === 0,
    cleaned,
    violations,
  };
}

export function ensureDisclosure(text: string, disclosure: string): string {
  // Check if disclosure is already present (case insensitive)
  const lowerText = text.toLowerCase();
  const lowerDisclosure = disclosure.toLowerCase();
  
  if (lowerText.includes(lowerDisclosure)) {
    return text;
  }

  // Add disclosure at the end
  const trimmedText = text.trim();
  
  // Add appropriate punctuation if needed
  let separator = '';
  if (!trimmedText.endsWith('.') && !trimmedText.endsWith('!') && !trimmedText.endsWith('?')) {
    separator = '.';
  }
  
  return `${trimmedText}${separator}\n\n${disclosure}`;
}