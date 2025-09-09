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

export function hasDisclosure(text: string, disclosure: string): boolean {
  return text.toLowerCase().includes(disclosure.toLowerCase());
}

export function extractDisclosure(text: string): string | null {
  // Common disclosure patterns
  const disclosurePatterns = [
    /\bI work (?:at|on|for) \w+/i,
    /\bI'm affiliated with \w+/i,
    /\bFull disclosure[:\-]\s*.+/i,
    /\bDisclosure[:\-]\s*.+/i,
    /\b(?:disclaimer|note)[:\-]\s*I (?:work|am).+/i,
  ];

  for (const pattern of disclosurePatterns) {
    const match = text.match(pattern);
    if (match) {
      return match[0];
    }
  }

  return null;
}