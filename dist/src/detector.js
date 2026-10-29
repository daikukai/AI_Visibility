/**
 * Detects whether a website could not be read properly by an automated scanner.
 * Covers:
 * - HTTP status codes: 403 (Forbidden), 429 (Rate limited), 503 (Service unavailable / Cloudflare challenge)
 * - Bot/Cloudflare challenge pages (e.g. Cloudflare 'Just a moment...', captcha, DDoS protection)
 * - Timeouts and network connection errors
 * - Single-Page Apps (SPA) / Heavy JS: fewer than 50 visible words with script tags present
 */
export function checkIsUnreadable(response, parsed) {
    // 1. Connection errors / timeouts
    if (!response.ok) {
        if (response.statusCode === 403) {
            return {
                isUnreadable: true,
                reason: 'HTTP 403: Site blocks automated crawlers or requests'
            };
        }
        if (response.statusCode === 429) {
            return {
                isUnreadable: true,
                reason: 'HTTP 429: Rate limit exceeded or access throttled'
            };
        }
        if (response.statusCode === 503) {
            return {
                isUnreadable: true,
                reason: 'HTTP 503: Service temporarily unavailable or bot challenge active'
            };
        }
        if (response.statusCode === 504 || response.error?.includes('timed out')) {
            return {
                isUnreadable: true,
                reason: 'Gateway timeout: The website took too long to respond (>6s)'
            };
        }
        if (response.error?.includes('SSRF')) {
            return {
                isUnreadable: true,
                reason: `Blocked by security policy: ${response.error}`
            };
        }
        return {
            isUnreadable: true,
            reason: `HTTP ${response.statusCode || 'Error'}: ${response.error || response.statusText}`
        };
    }
    const bodyLower = response.body.toLowerCase();
    // 2. Bot challenge signatures (Cloudflare, PerimeterX, Datadome, Incapsula, etc.)
    const challengeSignatures = [
        'cf-chl-bypass',
        'cloudflare ray id',
        'challenge-platform',
        'just a moment...',
        'please wait while your request is being verified',
        'checking your browser before accessing',
        'ddos protection by cloudflare',
        'attention required! | cloudflare',
        'security check to access',
        'distil_r_captcha',
        'geo.captcha',
        '_px3'
    ];
    for (const sig of challengeSignatures) {
        if (bodyLower.includes(sig)) {
            return {
                isUnreadable: true,
                reason: 'Bot challenge detected (Cloudflare / anti-bot verification page)'
            };
        }
    }
    // 3. JavaScript-only / SPA check: fewer than 50 visible words while HTML contains client script bundles
    if (parsed) {
        // Match script tags that are NOT application/ld+json (e.g. src="...", module scripts, or inline JS)
        const hasExecutableScripts = /<script(?![^>]*application\/ld\+json)[^>]*>[\s\S]*?<\/script>/i.test(response.body) ||
            /<script(?![^>]*application\/ld\+json)[^>]*src=/i.test(response.body);
        if (parsed.wordCount < 50 && hasExecutableScripts) {
            return {
                isUnreadable: true,
                reason: 'Client-rendered site: Fewer than 50 words of visible text in raw HTML (requires JavaScript)'
            };
        }
    }
    return { isUnreadable: false };
}
