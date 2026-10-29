import { validateBusinessEmail } from '../../src/emailValidator.js';
import { saveLeadRecord } from '../../src/storage.js';
import { sendLeadAlert } from '../../src/notifier.js';
import { checkRateLimit } from '../../src/rateLimiter.js';
import { verifyTurnstileToken } from '../../src/turnstile.js';
const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
};
export const handler = async (event, context) => {
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
        // 1. Per-IP Rate Limiting Check for leads (max 3 per 10 mins)
        const rateCheck = checkRateLimit(clientIp, 'lead');
        if (!rateCheck.allowed) {
            return {
                statusCode: 429,
                headers: {
                    ...CORS_HEADERS,
                    'Retry-After': String(rateCheck.resetInSeconds)
                },
                body: JSON.stringify({
                    error: 'Too many report requests from this IP. Please try again later.',
                    resetInSeconds: rateCheck.resetInSeconds
                })
            };
        }
        if (!event.body) {
            return {
                statusCode: 400,
                headers: CORS_HEADERS,
                body: JSON.stringify({ error: 'Request body is required' })
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
                body: JSON.stringify({ error: 'Malformed JSON payload' })
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
        // 1. Honeypot check
        if (payload.company_website_hp || payload.honeypot) {
            // Quietly succeed to fool bots without storing
            return {
                statusCode: 200,
                headers: CORS_HEADERS,
                body: JSON.stringify({ success: true, leadId: 'hp_ignored' })
            };
        }
        // 2. Consent check
        if (!payload.consent) {
            return {
                statusCode: 400,
                headers: CORS_HEADERS,
                body: JSON.stringify({ error: 'Consent to receive the manual report and follow-up is required.' })
            };
        }
        // 3. Email validation (Business email only, MX check enabled)
        const emailValidation = await validateBusinessEmail(payload.email);
        if (!emailValidation.valid) {
            return {
                statusCode: 400,
                headers: CORS_HEADERS,
                body: JSON.stringify({
                    error: emailValidation.reason || 'Invalid business email address.'
                })
            };
        }
        // 4. Construct LeadRecord
        const timestamp = Date.now();
        const randomSuffix = Math.random().toString(36).substring(2, 7);
        const leadId = `lead_${timestamp}_${randomSuffix}`;
        const domain = (payload.domain || payload.url || 'unknown.com')
            .replace(/^https?:\/\//i, '')
            .split('/')[0]
            .toLowerCase();
        const lead = {
            id: leadId,
            created_at: new Date().toISOString(),
            email: emailValidation.normalizedEmail,
            domain,
            url: payload.url || `https://${domain}`,
            score: payload.score ?? null,
            unreadable_reason: payload.unreadable_reason || null,
            what_they_sell: payload.what_they_sell ? String(payload.what_they_sell).slice(0, 200) : null,
            consent_at: new Date().toISOString(),
            status: 'new',
            report_sent_at: null,
            notes: null
        };
        // 5. Save to Netlify Blobs storage
        await saveLeadRecord(lead);
        // 6. Send alert notification to Kai (Resend / Mock / Telegram)
        await sendLeadAlert(lead);
        return {
            statusCode: 200,
            headers: CORS_HEADERS,
            body: JSON.stringify({
                success: true,
                leadId: lead.id,
                message: 'Lead captured successfully. Report will be emailed within 24-48 hours.'
            })
        };
    }
    catch (err) {
        console.error('[LeadHandler] Exception processing lead:', err);
        return {
            statusCode: 500,
            headers: CORS_HEADERS,
            body: JSON.stringify({
                error: 'An internal error occurred while processing your request.',
                details: err.message
            })
        };
    }
};
