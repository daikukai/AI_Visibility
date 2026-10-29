import { scanSite, normalizeTarget } from '../../src/crawler.js';
import { validateUrlForSSRF } from '../../src/ssrf.js';
import { getScanCache, setScanCache } from '../../src/storage.js';
import { checkRateLimit } from '../../src/rateLimiter.js';
import { verifyTurnstileToken } from '../../src/turnstile.js';
const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
};
export const handler = async (event, context) => {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 204,
            headers: CORS_HEADERS,
            body: ''
        };
    }
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers: CORS_HEADERS,
            body: JSON.stringify({ error: 'Method Not Allowed. Use POST.' })
        };
    }
    try {
        // Extract client IP
        const clientIp = event.headers['x-nf-client-connection-ip'] ||
            event.headers['client-ip'] ||
            event.headers['x-forwarded-for'] ||
            '127.0.0.1';
        // 1. Per-IP Rate Limiting Check
        const rateCheck = checkRateLimit(clientIp, 'scan');
        if (!rateCheck.allowed) {
            return {
                statusCode: 429,
                headers: {
                    ...CORS_HEADERS,
                    'Retry-After': String(rateCheck.resetInSeconds)
                },
                body: JSON.stringify({
                    error: 'Rate limit exceeded. Too many scans from this IP.',
                    resetInSeconds: rateCheck.resetInSeconds
                })
            };
        }
        if (!event.body) {
            return {
                statusCode: 400,
                headers: CORS_HEADERS,
                body: JSON.stringify({ error: 'Request body is empty' })
            };
        }
        let payload;
        try {
            payload = JSON.parse(event.body);
        }
        catch {
            return {
                statusCode: 400,
                headers: CORS_HEADERS,
                body: JSON.stringify({ error: 'Invalid JSON in request body' })
            };
        }
        // 2. Cloudflare Turnstile Verification
        const turnstileCheck = await verifyTurnstileToken(payload.turnstileToken, clientIp);
        if (!turnstileCheck.valid) {
            return {
                statusCode: 403,
                headers: CORS_HEADERS,
                body: JSON.stringify({ error: turnstileCheck.error || 'Security check failed' })
            };
        }
        const rawUrl = payload.url?.trim();
        if (!rawUrl) {
            return {
                statusCode: 400,
                headers: CORS_HEADERS,
                body: JSON.stringify({ error: 'URL parameter is required' })
            };
        }
        // SSRF Pre-validation
        const ssrfCheck = await validateUrlForSSRF(rawUrl);
        if (!ssrfCheck.valid) {
            return {
                statusCode: 400,
                headers: CORS_HEADERS,
                body: JSON.stringify({
                    readable: false,
                    reason: `Invalid or restricted target URL: ${ssrfCheck.reason}`,
                    error: ssrfCheck.reason
                })
            };
        }
        // Check 24-hour scan cache
        const { domain } = normalizeTarget(rawUrl);
        const cachedResult = await getScanCache(domain);
        if (cachedResult) {
            return {
                statusCode: 200,
                headers: {
                    ...CORS_HEADERS,
                    'X-Cache-Status': 'HIT'
                },
                body: JSON.stringify(cachedResult)
            };
        }
        // Perform fresh scan
        const result = await scanSite(rawUrl);
        // If scan was readable and successful, cache for 24h
        if (result.readable) {
            await setScanCache(domain, result);
        }
        return {
            statusCode: 200,
            headers: {
                ...CORS_HEADERS,
                'X-Cache-Status': 'MISS'
            },
            body: JSON.stringify(result)
        };
    }
    catch (err) {
        return {
            statusCode: 500,
            headers: CORS_HEADERS,
            body: JSON.stringify({
                readable: false,
                error: 'An internal error occurred during the scan',
                reason: err.message || 'Unknown scanning failure'
            })
        };
    }
};
