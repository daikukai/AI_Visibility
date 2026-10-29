import crypto from 'node:crypto';
// In-memory window cache
const ipBuckets = new Map();
/**
 * Hashes an IP address using SHA-256 and a secret salt to ensure GDPR/privacy compliance.
 */
export function hashIp(rawIp) {
    const salt = process.env.IP_HASH_SALT || 'telza_default_salt_2026';
    return crypto.createHmac('sha256', salt).update(rawIp.trim()).digest('hex').substring(0, 24);
}
/**
 * Soft per-IP rate limiter.
 * - Window: 10 minutes (600,000 ms)
 * - Default max: 5 requests per window
 */
export function checkRateLimit(rawIp, action = 'scan', customLimit) {
    const ip = rawIp ? rawIp.split(',')[0].trim() : '127.0.0.1';
    const hashedIp = hashIp(ip);
    const key = `${action}_${hashedIp}`;
    const now = Date.now();
    const windowMs = 10 * 60 * 1000; // 10 minutes
    const maxRequests = customLimit ?? (action === 'scan' ? 5 : 3);
    let record = ipBuckets.get(key);
    if (!record || now - record.windowStart > windowMs) {
        // Start fresh window
        record = { count: 1, windowStart: now };
        ipBuckets.set(key, record);
        return {
            allowed: true,
            remaining: maxRequests - 1,
            resetInSeconds: Math.ceil(windowMs / 1000),
            hashedIp
        };
    }
    // Existing window
    const elapsed = now - record.windowStart;
    const resetInSeconds = Math.ceil((windowMs - elapsed) / 1000);
    if (record.count >= maxRequests) {
        return {
            allowed: false,
            remaining: 0,
            resetInSeconds,
            hashedIp
        };
    }
    record.count++;
    return {
        allowed: true,
        remaining: maxRequests - record.count,
        resetInSeconds,
        hashedIp
    };
}
/**
 * Clears rate limiter buckets (for tests)
 */
export function clearRateLimits() {
    ipBuckets.clear();
}
