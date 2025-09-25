// Validation functions
function extractLinks(text) {
    const urlRegex = /https?:\/\/[^\s<>"[\]{}|\\^`]+/gi;
    return text.match(urlRegex) || [];
}

function enforceOneLink(text) {
    const links = extractLinks(text);

    if (links.length <= 1) {
        return {
            ok: true,
            cleaned: text,
            count: links.length,
        };
    }

    // Remove all links except the first one
    let cleaned = text;

    // Remove all other links
    for (let i = 1; i < links.length; i++) {
        // Remove link and clean up surrounding punctuation/spaces
        cleaned = cleaned.replace(new RegExp(`\\s*${links[i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*`, 'g'), ' ');
    }

    // Clean up any double spaces but preserve line breaks
    cleaned = cleaned.replace(/[ \t]+/g, ' ').replace(/\n\s*\n\s*\n+/g, '\n\n').trim();

    return {
        ok: false,
        cleaned,
        count: links.length,
    };
}

function enforceAllowlist(text, allowlist = []) {
    // If no allowlist provided, allow all valid URLs
    if (allowlist.length === 0) {
        return {
            ok: true,
            cleaned: text,
            violations: [],
        };
    }
    const links = extractLinks(text);
    const violations = [];
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
                // Remove link and clean up surrounding punctuation/spaces
                cleaned = cleaned.replace(new RegExp(`\\s*${link.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*`, 'g'), ' ');
            }
        } catch (error) {
            // Invalid URL, remove it
            violations.push(link);
            // Remove link and clean up surrounding punctuation/spaces
            cleaned = cleaned.replace(new RegExp(`\\s*${link.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*`, 'g'), ' ');
        }
    }

    // Clean up formatting after removing links but preserve line breaks
    cleaned = cleaned.replace(/[ \t]+/g, ' ').replace(/\n\s*\n\s*\n+/g, '\n\n').trim();

    return {
        ok: violations.length === 0,
        cleaned,
        violations,
    };
}

function main(args) {
    try {
        // Handle both web requests (GET/POST) and direct invocation
        let text, allowlist;

        if (args.__ow_method) {
            // This is a web request
            const method = args.__ow_method.toUpperCase();

            if (method === 'GET') {
                // Handle GET request - parameters from query string
                text = args.text || '';
                allowlist = args.allowlist ? JSON.parse(args.allowlist) : [];
            } else if (method === 'POST') {
                // Handle POST request - parameters might be directly in args or in body
                if (args.text !== undefined || args.allowlist !== undefined) {
                    // Parameters are directly available (common in OpenWhisk)
                    text = args.text || '';
                    allowlist = args.allowlist || [];
                } else if (args.__ow_body) {
                    // Parameters are in body
                    try {
                        let body = '{}';
                        // Try to decode as base64 first, fall back to direct string
                        try {
                            body = Buffer.from(args.__ow_body, 'base64').toString();
                        } catch (decodeError) {
                            body = args.__ow_body;
                        }
                        const data = JSON.parse(body);
                        text = data.text || '';
                        allowlist = data.allowlist || [];
                    } catch (parseError) {
                        return {
                            statusCode: 400,
                            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                            body: JSON.stringify({
                                error: 'Invalid JSON in request body',
                                details: parseError.message,
                                receivedBody: args.__ow_body ? args.__ow_body.substring(0, 100) : 'null'
                            })
                        };
                    }
                } else {
                    // No parameters found
                    text = '';
                    allowlist = [];
                }
            } else {
                return {
                    statusCode: 405,
                    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                    body: JSON.stringify({ error: 'Method not allowed' })
                };
            }
        } else {
            // Direct invocation (non-web)
            text = args.text || '';
            allowlist = args.allowlist || [];
        }

        if (typeof text !== 'string' || !Array.isArray(allowlist)) {
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify({ error: 'Invalid request format: text must be string, allowlist must be array' })
            };
        }

        const oneLinkResult = enforceOneLink(text);
        const allowlistResult = enforceAllowlist(oneLinkResult.cleaned, allowlist);

        const response = {
            ok: oneLinkResult.ok && allowlistResult.ok,
            cleaned: allowlistResult.cleaned,
            violations: [
                ...(oneLinkResult.ok ? [] : [`Too many links: ${oneLinkResult.count} found, max 1 allowed`]),
                ...allowlistResult.violations.map(v => `Disallowed domain: ${v}`),
            ],
        };

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify(response)
        };
    } catch (error) {
        console.error('Error in validate-links function:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
}
