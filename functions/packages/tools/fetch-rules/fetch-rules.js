// Reddit API client for fetching subreddit rules
async function makeRequest(url, userAgent = 'ThreadScout/1.0') {
    const response = await fetch(url, {
        headers: {
            'User-Agent': userAgent,
        },
    });

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
}

async function getSubredditRules(sub, userAgent = 'ThreadScout/1.0') {
    try {
        const rulesUrl = `https://www.reddit.com/r/${sub}/about/rules.json`;
        const aboutUrl = `https://www.reddit.com/r/${sub}/about.json`;

        const [rulesData, aboutData] = await Promise.all([
            makeRequest(rulesUrl, userAgent).catch(() => ({ rules: [] })),
            makeRequest(aboutUrl, userAgent).catch(() => ({ data: {} })),
        ]);

        const rules = rulesData.rules || [];
        const subredditData = aboutData.data || {};

        // Parse rules to determine link policy
        let linksAllowed = true;
        let vendorDisclosureRequired = false;
        let linkLimit = null;
        const notes = [];

        // Check submission requirements and rules
        const submissionText = subredditData.submission_type || '';
        const description = subredditData.public_description || '';

        for (const rule of rules) {
            const ruleText = `${rule.short_name || ''} ${rule.description || ''}`.toLowerCase();

            if (ruleText.includes('no link') || ruleText.includes('no url') || ruleText.includes('no spam')) {
                linksAllowed = false;
                notes.push('No links allowed');
            }

            if (ruleText.includes('disclosure') || ruleText.includes('affiliate') || ruleText.includes('promotion')) {
                vendorDisclosureRequired = true;
                notes.push('Vendor disclosure required');
            }

            if (ruleText.includes('one link') || ruleText.includes('single link')) {
                linkLimit = 1;
            }

            if (ruleText.includes('friday') && (ruleText.includes('no promo') || ruleText.includes('no promotion'))) {
                notes.push('No promo Fridays');
            }
        }

        // Check if subreddit only allows text posts
        if (submissionText === 'self') {
            notes.push('Text posts only');
        }

        // Include raw rules data for reference
        const rawRules = rules.map(rule => ({
            short_name: rule.short_name || '',
            description: rule.description || '',
            violation_reason: rule.violation_reason || ''
        }));

        return {
            linksAllowed,
            vendorDisclosureRequired,
            linkLimit,
            notes,
            subreddit: sub,
            rawRules,
            submissionType: submissionText,
            publicDescription: description
        };
    } catch (error) {
        console.error(`Failed to get rules for r/${sub}:`, error);

        // Return conservative defaults on failure
        return {
            linksAllowed: false,
            vendorDisclosureRequired: true,
            linkLimit: 1,
            notes: ['Failed to fetch rules - using conservative defaults'],
            subreddit: sub,
            rawRules: [],
            submissionType: 'unknown',
            publicDescription: '',
            error: error.message
        };
    }
}

function main(args) {
    try {
        // Handle both web requests (GET/POST) and direct invocation
        let sub, subreddit;

        if (args.__ow_method) {
            // This is a web request
            const method = args.__ow_method.toUpperCase();

            if (method === 'GET') {
                // Handle GET request - parameters from query string
                sub = args.sub;
                subreddit = args.subreddit;
            } else if (method === 'POST') {
                // Handle POST request - parameters might be directly in args or in body
                if (args.sub || args.subreddit) {
                    // Parameters are directly available (common in OpenWhisk)
                    sub = args.sub;
                    subreddit = args.subreddit;
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
                        sub = data.sub;
                        subreddit = data.subreddit;
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
                    sub = undefined;
                    subreddit = undefined;
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
            sub = args.sub;
            subreddit = args.subreddit;
        }

        // Accept either 'sub' or 'subreddit' parameter
        const subredditName = sub || subreddit;

        if (!subredditName || typeof subredditName !== 'string') {
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify({
                    error: 'sub parameter is required and must be a string (e.g., "webdev")'
                })
            };
        }

        // Clean subreddit name (remove r/ prefix if present)
        const cleanSubreddit = subredditName.replace(/^r\//, '');

        // Validate subreddit name format
        if (!/^[A-Za-z0-9_]+$/.test(cleanSubreddit)) {
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify({
                    error: 'Invalid subreddit name format. Use only letters, numbers, and underscores.'
                })
            };
        }

        return getSubredditRules(cleanSubreddit)
            .then(rules => ({
                statusCode: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({ rules })
            }))
            .catch(error => {
                console.error('Error in fetch-rules function:', error);
                return {
                    statusCode: 500,
                    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                    body: JSON.stringify({
                        error: 'Failed to fetch subreddit rules',
                        details: error.message
                    })
                };
            });
    } catch (error) {
        console.error('Error in fetch-rules function:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({
                error: 'Internal server error',
                details: error.message
            })
        };
    }
}
