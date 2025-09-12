import { enforceOneLink, enforceAllowlist } from '../../shared/validators.js';

interface ValidateLinksRequest {
  text: string;
  allowlist: string[];
}

interface ValidateLinksResponse {
  ok: boolean;
  cleaned: string;
  violations: string[];
}

export default async function handler(req: Request): Promise<Response> {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { text, allowlist }: ValidateLinksRequest = await req.json();

    if (typeof text !== 'string' || !Array.isArray(allowlist)) {
      return new Response(JSON.stringify({ error: 'Invalid request format' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const oneLinkResult = enforceOneLink(text);
    const allowlistResult = enforceAllowlist(oneLinkResult.cleaned, allowlist);

    const response: ValidateLinksResponse = {
      ok: oneLinkResult.ok && allowlistResult.ok,
      cleaned: allowlistResult.cleaned,
      violations: [
        ...(oneLinkResult.ok ? [] : [`Too many links: ${oneLinkResult.count} found, max 1 allowed`]),
        ...allowlistResult.violations.map(v => `Disallowed domain: ${v}`),
      ],
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('Error in validate-links function:', error);
    return new Response(JSON.stringify({ error: 'Invalid request' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
}