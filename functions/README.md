# ThreadScout - DigitalOcean AI Agent Functions

This directory contains serverless functions that power ThreadScout's Reddit thread analysis and content generation capabilities. ThreadScout helps identify high-intent Reddit threads where your product can provide value and generates compliant, helpful responses.

## Overview

ThreadScout functions are designed to work together as a cohesive system for:
- Fetching and analyzing Reddit subreddit rules
- Validating content against community guidelines
- Generating contextual, compliant responses for Reddit threads

## Agent Prompt

**Role**: You are ThreadScout. You find high-intent Reddit threads where our product can help and draft helpful, transparent replies.

### Tools Available

- `validate-links`: Validates and cleans text content to ensure it complies with link posting policies. It enforces a maximum of one link per text and restricts links to only allowed domains from a configurable allowlist.

### Tool Usage Guidelines

**ALWAYS call validate-links when:**
- Generating draft replies or comments that may contain links
- Processing user-submitted content before posting to platforms like Reddit
- Validating text before submitting to communities with strict link policies
- Cleaning up AI-generated content that may have multiple links
- Ensuring compliance with subreddit rules that limit links

**NEVER call validate-links when:**
- Processing text that definitely contains no links
- Working with read-only content that will not be posted anywhere
- Analyzing existing content for research purposes (not for posting)
- Processing internal notes or documentation

### Response Requirements

For each thread, produce:
1. A score from 0 to 100 with a one-line rationale
   - When scoring, ensure the thread's content aligns with our goal and our product; if not, deduct points
2. A rules summary from the provided rules
3. Two drafts:
   - **Variant A**: Help only, no links, include 3 concrete steps or a tiny code block
   - **Variant B**: Help with exactly one allowlisted link and a short disclosure
4. Your drafts must use the knowledge base you have been trained on, and should mention the product's URL or hint at it when possible. The goal is to produce answers I can copy and paste into Reddit to promote my product
5. Never use language that is a dead giveaway that you are an AI agent. For example, avoid using em dashes; use commas, brackets, or other punctuation instead
6. It is OK to not find a good fit for Variant B. In that case, return an empty variant. Do not force it, since this can get us banned. Update whyFit to say it is not a fit
7. Never be tempted to return any code snippets unless the thread explicitly asks for it

### Compliance Step

Before returning JSON, if any output is intended for posting and may contain links, call validate-links on that text and ensure it still follows all rules. If rules are unclear, default to help-only and add a note.

### Restrictions

- One link maximum
- Never invent claims or benchmarks. English only
- If rules are unclear, default to help-only and add a note
- In every subreddit's description you can find guidelines; use those to ensure your advice is correct on whether to post something or not

### Expected JSON Response Format

```json
{
  "score": number,
  "whyFit": "one sentence",
  "rulesSummary": ["..."],
  "risks": ["..."],
  "variantA": { "text": "..." },
  "variantB": { "text": "...", "disclosure": "I work on the product" }
}
```

## Available Functions

### fetch-rules

**Purpose**: Fetches and analyzes subreddit rules from Reddit's API to determine posting policies and content restrictions.

**Location**: `tools/fetch-rules/`

**Key Features**:
- Retrieves subreddit rules and metadata from Reddit API
- Analyzes rules to determine link policies and restrictions
- Identifies vendor disclosure requirements
- Detects link limits and promotional restrictions
- Returns conservative defaults on API failures

**Parameters**:
- `sub` or `subreddit` (string): Subreddit name (with or without "r/" prefix)

**Response**:
```json
{
  "rules": {
    "linksAllowed": boolean,
    "vendorDisclosureRequired": boolean,
    "linkLimit": number | null,
    "notes": string[],
    "subreddit": string,
    "rawRules": object[],
    "submissionType": string,
    "publicDescription": string
  }
}
```

**Example Usage**:
```javascript
// Fetch rules for r/webdev
const result = await fetchRules({ sub: "webdev" });
```

### validate-links

**Purpose**: Validates and sanitizes text content to ensure compliance with link posting policies and community guidelines.

**Location**: `tools/validate-links/`

**Key Features**:
- Enforces one-link-per-post policy
- Validates links against domain allowlists
- Removes unauthorized links while preserving content
- Cleans up formatting after link removal
- Provides detailed violation reporting

**Parameters**:
- `text` (string): Text content to validate and clean
- `allowlist` (string[]): Array of allowed domains

**Response**:
```json
{
  "ok": boolean,
  "cleaned": string,
  "violations": string[]
}
```

**Example Usage**:
```javascript
// Validate a post with multiple links
const result = await validateLinks({
  text: "Check out https://example.com and https://another.com",
  allowlist: ["example.com"]
});
// Result: { ok: false, cleaned: "Check out https://example.com", violations: [...] }
```

## Function Architecture

### Error Handling

All functions implement consistent error handling:
- **400 Bad Request**: Invalid parameters or malformed input
- **500 Internal Server Error**: Unexpected errors with detailed logging
- **Conservative Defaults**: When external APIs fail, functions return safe defaults

### CORS Support

All functions include CORS headers for cross-origin requests:
```javascript
'Access-Control-Allow-Origin': '*'
```

### Response Format

All functions return standardized HTTP responses:
```javascript
{
  statusCode: number,
  headers: { 'Content-Type': 'application/json' },
  body: string // JSON stringified response
}
```

## Development

### Local Testing

Each function can be tested locally by importing and calling the `main` function:

```javascript
const { main } = require('./tools/fetch-rules/index.js');

const result = main({ sub: 'webdev' });
console.log(result);
```

### Adding New Functions

1. Create a new directory under `tools/`
2. Add `index.js` with a `main` function export
3. Include `package.json` for dependencies
4. Follow the established error handling patterns
5. Update this README with function documentation

## Dependencies

Functions are designed to be lightweight with minimal dependencies:
- **fetch-rules**: No external dependencies (uses native `fetch`)
- **validate-links**: No external dependencies (uses native URL parsing)

## Security Considerations

- All functions validate input parameters
- URL parsing uses native browser APIs for security
- No user data is stored or logged permanently
- Conservative defaults prevent accidental policy violations
- Domain allowlists prevent unauthorized link injection

## Contributing

When contributing new functions or modifications:
1. Maintain the established error handling patterns
2. Include comprehensive input validation
3. Add appropriate CORS headers
4. Update this documentation
5. Test with various edge cases and malformed inputs
