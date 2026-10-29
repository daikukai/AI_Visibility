import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { parseHtml } from '../src/parser.js';
import { calculateReadinessScore, getReadinessBand } from '../src/scorer.js';
import { ScannedSiteData } from '../src/types.js';

describe('Readiness Scoring Engine Unit Tests', () => {
  const fixturesDir = path.resolve('tests/fixtures');

  test('Correctly maps readiness score bands', () => {
    assert.strictEqual(getReadinessBand(95), 'Strong readiness');
    assert.strictEqual(getReadinessBand(80), 'Strong readiness');
    assert.strictEqual(getReadinessBand(79), 'Good foundation with gaps');
    assert.strictEqual(getReadinessBand(60), 'Good foundation with gaps');
    assert.strictEqual(getReadinessBand(59), 'Needs improvement');
    assert.strictEqual(getReadinessBand(40), 'Needs improvement');
    assert.strictEqual(getReadinessBand(39), 'Significant issues');
    assert.strictEqual(getReadinessBand(10), 'Significant issues');
  });

  test('High-quality optimized site achieves Strong readiness (80-100)', () => {
    const html = fs.readFileSync(path.join(fixturesDir, 'optimized_site.html'), 'utf-8');
    const parsed = parseHtml(html, 'https://example.com');

    const siteData: ScannedSiteData = {
      targetUrl: 'https://example.com',
      normalizedDomain: 'example.com',
      homepage: {
        url: 'https://example.com',
        statusCode: 200,
        headers: {},
        html,
        text: parsed.visibleText,
        wordCount: parsed.wordCount,
        hasNoIndex: false,
        isHttps: true
      },
      robotsTxt: {
        exists: true,
        raw: 'User-agent: *\nAllow: /\nSitemap: https://example.com/sitemap.xml',
        parses: true,
        allowedBots: {
          GPTBot: true,
          ClaudeBot: true,
          PerplexityBot: true,
          'Google-Extended': true,
          CCBot: true
        }
      },
      sitemapXml: {
        exists: true,
        referencedInRobots: true,
        validXml: true,
        urlCount: 15
      },
      subpages: [],
      internalLinks: parsed.links.internal
    };

    const result = calculateReadinessScore(siteData, parsed);
    assert.ok(result.score >= 85, `Score was ${result.score}, expected >= 85`);
    assert.strictEqual(result.band, 'Strong readiness');
    assert.strictEqual(result.categories.crawlability.earned, 25);
    assert.strictEqual(result.categories.structured_data.earned, 25);
  });

  test('Basic site scores in mid-range with actionable fixes', () => {
    const html = fs.readFileSync(path.join(fixturesDir, 'basic_site.html'), 'utf-8');
    const parsed = parseHtml(html, 'https://bluecloud.test');

    const siteData: ScannedSiteData = {
      targetUrl: 'https://bluecloud.test',
      normalizedDomain: 'bluecloud.test',
      homepage: {
        url: 'https://bluecloud.test',
        statusCode: 200,
        headers: {},
        html,
        text: parsed.visibleText,
        wordCount: parsed.wordCount,
        hasNoIndex: false,
        isHttps: true
      },
      robotsTxt: {
        exists: true,
        raw: 'User-agent: *\nAllow: /',
        parses: true,
        allowedBots: {
          GPTBot: true,
          ClaudeBot: true,
          PerplexityBot: true,
          'Google-Extended': true,
          CCBot: true
        }
      },
      sitemapXml: {
        exists: false,
        referencedInRobots: false,
        validXml: false,
        urlCount: 0
      },
      subpages: [],
      internalLinks: parsed.links.internal
    };

    const result = calculateReadinessScore(siteData, parsed);
    assert.ok(result.score >= 40 && result.score <= 75, `Score was ${result.score}, expected 40-75`);
    assert.strictEqual(result.topFixes.length, 3);
    assert.ok(result.topFixes[0].pointsLost >= result.topFixes[1].pointsLost);
  });

  test('Poor site scores low and lands in Significant issues', () => {
    const html = fs.readFileSync(path.join(fixturesDir, 'poor_site.html'), 'utf-8');
    const parsed = parseHtml(html, 'http://poor.test');

    const siteData: ScannedSiteData = {
      targetUrl: 'http://poor.test',
      normalizedDomain: 'poor.test',
      homepage: {
        url: 'http://poor.test',
        statusCode: 200,
        headers: {},
        html,
        text: parsed.visibleText,
        wordCount: parsed.wordCount,
        hasNoIndex: true, // Has noindex
        isHttps: false   // Not https
      },
      robotsTxt: {
        exists: false,
        raw: '',
        parses: false,
        allowedBots: {
          GPTBot: false,
          ClaudeBot: false,
          PerplexityBot: false,
          'Google-Extended': false,
          CCBot: false
        }
      },
      sitemapXml: {
        exists: false,
        referencedInRobots: false,
        validXml: false,
        urlCount: 0
      },
      subpages: [],
      internalLinks: []
    };

    const result = calculateReadinessScore(siteData, parsed);
    assert.ok(result.score < 40, `Score was ${result.score}, expected < 40`);
    assert.strictEqual(result.band, 'Significant issues');
  });

  test('Malformed JSON-LD is handled gracefully without exception', () => {
    const html = fs.readFileSync(path.join(fixturesDir, 'malformed_schema.html'), 'utf-8');
    assert.doesNotThrow(() => {
      const parsed = parseHtml(html, 'https://brokenschema.test');
      assert.strictEqual(parsed.jsonLdBlocks.length, 0);
    });
  });

  test('Robots.txt AI bots blocked check loses full 8 points', () => {
    const html = fs.readFileSync(path.join(fixturesDir, 'basic_site.html'), 'utf-8');
    const parsed = parseHtml(html, 'https://blocked.test');

    const siteData: ScannedSiteData = {
      targetUrl: 'https://blocked.test',
      normalizedDomain: 'blocked.test',
      homepage: {
        url: 'https://blocked.test',
        statusCode: 200,
        headers: {},
        html,
        text: parsed.visibleText,
        wordCount: 350,
        hasNoIndex: false,
        isHttps: true
      },
      robotsTxt: {
        exists: true,
        raw: 'Disallow: /',
        parses: true,
        allowedBots: {
          GPTBot: false,
          ClaudeBot: false,
          PerplexityBot: false,
          'Google-Extended': false,
          CCBot: false
        }
      },
      sitemapXml: { exists: true, referencedInRobots: true, validXml: true, urlCount: 5 },
      subpages: [],
      internalLinks: []
    };

    const result = calculateReadinessScore(siteData, parsed);
    const aiBotCheck = result.categories.crawlability.checks.find(c => c.id === 'crawl_ai_bots');
    assert.strictEqual(aiBotCheck?.pointsEarned, 0);
    assert.strictEqual(aiBotCheck?.status, 'fail');
  });
});
