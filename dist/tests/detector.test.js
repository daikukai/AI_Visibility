import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { checkIsUnreadable } from '../src/detector.js';
import { parseHtml } from '../src/parser.js';
describe('Unreadable State Detector Unit Tests', () => {
    const fixturesDir = path.resolve('tests/fixtures');
    test('Flags HTTP 403 Forbidden as unreadable', () => {
        const res = {
            ok: false,
            statusCode: 403,
            statusText: 'Forbidden',
            url: 'https://protected.com',
            headers: {},
            body: ''
        };
        const result = checkIsUnreadable(res);
        assert.strictEqual(result.isUnreadable, true);
        assert.match(result.reason || '', /403/);
    });
    test('Flags HTTP 429 Rate Limit as unreadable', () => {
        const res = {
            ok: false,
            statusCode: 429,
            statusText: 'Too Many Requests',
            url: 'https://throttled.com',
            headers: {},
            body: ''
        };
        const result = checkIsUnreadable(res);
        assert.strictEqual(result.isUnreadable, true);
        assert.match(result.reason || '', /429/);
    });
    test('Flags HTTP 503 Service Unavailable / bot challenge as unreadable', () => {
        const res = {
            ok: false,
            statusCode: 503,
            statusText: 'Service Unavailable',
            url: 'https://challenge.com',
            headers: {},
            body: ''
        };
        const result = checkIsUnreadable(res);
        assert.strictEqual(result.isUnreadable, true);
        assert.match(result.reason || '', /503/);
    });
    test('Flags Cloudflare bot challenge page as unreadable even if HTTP 200', () => {
        const challengeHtml = fs.readFileSync(path.join(fixturesDir, 'bot_challenge.html'), 'utf-8');
        const res = {
            ok: true,
            statusCode: 200,
            statusText: 'OK',
            url: 'https://cloudflare-protected.com',
            headers: {},
            body: challengeHtml
        };
        const parsed = parseHtml(challengeHtml, res.url);
        const result = checkIsUnreadable(res, parsed);
        assert.strictEqual(result.isUnreadable, true);
        assert.match(result.reason || '', /challenge/i);
    });
    test('Flags JS-only SPA (<50 words with scripts) as unreadable', () => {
        const jsOnlyHtml = fs.readFileSync(path.join(fixturesDir, 'js_only_site.html'), 'utf-8');
        const res = {
            ok: true,
            statusCode: 200,
            statusText: 'OK',
            url: 'https://react-spa.com',
            headers: {},
            body: jsOnlyHtml
        };
        const parsed = parseHtml(jsOnlyHtml, res.url);
        const result = checkIsUnreadable(res, parsed);
        assert.strictEqual(result.isUnreadable, true);
        assert.match(result.reason || '', /JavaScript/i);
    });
    test('Passes normal HTML website as readable', () => {
        const normalHtml = fs.readFileSync(path.join(fixturesDir, 'optimized_site.html'), 'utf-8');
        const res = {
            ok: true,
            statusCode: 200,
            statusText: 'OK',
            url: 'https://example.com',
            headers: {},
            body: normalHtml
        };
        const parsed = parseHtml(normalHtml, res.url);
        const result = checkIsUnreadable(res, parsed);
        assert.strictEqual(result.isUnreadable, false);
    });
});
