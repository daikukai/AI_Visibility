import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { checkRateLimit, clearRateLimits, hashIp } from '../src/rateLimiter.js';
import { verifyTurnstileToken } from '../src/turnstile.js';

describe('Phase 5: Security, Abuse & Hardening Unit Tests', () => {
  beforeEach(() => {
    clearRateLimits();
  });

  describe('Per-IP Rate Limiting', () => {
    test('Allows requests within the 5-scan rate limit', () => {
      const testIp = '198.51.100.22';

      for (let i = 1; i <= 5; i++) {
        const result = checkRateLimit(testIp, 'scan');
        assert.strictEqual(result.allowed, true, `Request #${i} should be allowed`);
        assert.strictEqual(result.remaining, 5 - i);
      }
    });

    test('Blocks 6th scan request when exceeding limit with reset countdown', () => {
      const testIp = '198.51.100.23';

      for (let i = 0; i < 5; i++) {
        checkRateLimit(testIp, 'scan');
      }

      // 6th request should be throttled
      const blocked = checkRateLimit(testIp, 'scan');
      assert.strictEqual(blocked.allowed, false);
      assert.strictEqual(blocked.remaining, 0);
      assert.ok(blocked.resetInSeconds > 0 && blocked.resetInSeconds <= 600);
    });

    test('Enforces tighter 3-request limit for lead submissions', () => {
      const testIp = '198.51.100.24';

      assert.strictEqual(checkRateLimit(testIp, 'lead').allowed, true);
      assert.strictEqual(checkRateLimit(testIp, 'lead').allowed, true);
      assert.strictEqual(checkRateLimit(testIp, 'lead').allowed, true);

      // 4th request must be blocked
      const fourth = checkRateLimit(testIp, 'lead');
      assert.strictEqual(fourth.allowed, false);
    });

    test('Hashes visitor IP address so raw IP is never stored or exposed', () => {
      const rawIp = '203.0.113.195';
      const hashed = hashIp(rawIp);

      assert.notStrictEqual(hashed, rawIp);
      assert.strictEqual(typeof hashed, 'string');
      assert.strictEqual(hashed.length, 24);
      assert.ok(!hashed.includes('203.0.113'));
    });
  });

  describe('Cloudflare Turnstile Verification', () => {
    test('Passes gracefully in test/dev when TURNSTILE_SECRET_KEY is absent', async () => {
      delete process.env.TURNSTILE_SECRET_KEY;
      const res = await verifyTurnstileToken(undefined, '127.0.0.1');
      assert.strictEqual(res.valid, true);
    });

    test('Rejects missing token when TURNSTILE_SECRET_KEY is present', async () => {
      process.env.TURNSTILE_SECRET_KEY = '1x0000000000000000000000000000000AA';
      try {
        const res = await verifyTurnstileToken(undefined, '127.0.0.1');
        assert.strictEqual(res.valid, false);
        assert.match(res.error || '', /missing/i);
      } finally {
        delete process.env.TURNSTILE_SECRET_KEY;
      }
    });
  });
});
