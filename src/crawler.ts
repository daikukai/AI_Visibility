import robotsParser from 'robots-parser';
import { safeFetch } from './fetcher.js';
import { parseHtml, ParsedHtml } from './parser.js';
import { checkIsUnreadable } from './detector.js';
import { calculateReadinessScore } from './scorer.js';
import {
  ScanResult,
  ScannedSiteData,
  PageContent,
  ScanSuccessResult,
  UnreadableResult
} from './types.js';

export interface CrawlerOptions {
  fetchSubpages?: boolean;
}

/**
 * Normalizes input domain and URL
 */
export function normalizeTarget(rawInput: string): { url: string; domain: string } {
  let cleaned = rawInput.trim();
  if (!cleaned.startsWith('http://') && !cleaned.startsWith('https://')) {
    cleaned = `https://${cleaned}`;
  }
  const parsed = new URL(cleaned);
  const domain = parsed.hostname.toLowerCase();
  const origin = parsed.origin;
  return {
    url: origin,
    domain
  };
}

/**
 * Crawls and scans a target website for AI search readiness.
 */
export async function scanSite(
  inputUrl: string,
  options: CrawlerOptions = {}
): Promise<ScanResult> {
  const { url, domain } = normalizeTarget(inputUrl);
  const now = new Date().toISOString();

  // 1. Initial parallel fetches: Homepage, robots.txt, sitemap.xml
  const robotsUrl = `${url}/robots.txt`;
  const sitemapUrl = `${url}/sitemap.xml`;

  const [homeRes, robotsRes, sitemapRes] = await Promise.all([
    safeFetch(url),
    safeFetch(robotsUrl, { timeoutMs: 4000 }),
    safeFetch(sitemapUrl, { timeoutMs: 4000 })
  ]);

  // Check unreadable condition on homepage response before doing anything heavy
  const unreadableInitial = checkIsUnreadable(homeRes);
  if (unreadableInitial.isUnreadable) {
    return {
      readable: false,
      reason: unreadableInitial.reason || 'Homepage was not accessible',
      url,
      domain,
      scannedAt: now
    };
  }

  // Parse Homepage HTML
  const homeParsed = parseHtml(homeRes.body, homeRes.url || url);

  // Check if homepage is client-side JS empty (< 50 words with scripts)
  const unreadableDeep = checkIsUnreadable(homeRes, homeParsed);
  if (unreadableDeep.isUnreadable) {
    return {
      readable: false,
      reason: unreadableDeep.reason || 'Homepage content requires client-side JavaScript execution',
      url,
      domain,
      scannedAt: now
    };
  }

  // 2. Process robots.txt
  let robotsParses = false;
  const allowedBots: Record<string, boolean> = {
    GPTBot: true,
    ClaudeBot: true,
    PerplexityBot: true,
    'Google-Extended': true,
    CCBot: true
  };
  let robotsSitemaps: string[] = [];

  if (robotsRes.ok && robotsRes.body.trim().length > 0) {
    try {
      const robots = robotsParser(robotsUrl, robotsRes.body);
      robotsParses = true;
      robotsSitemaps = robots.getSitemaps();

      // Evaluate permissions for each AI bot
      const bots = ['GPTBot', 'ClaudeBot', 'PerplexityBot', 'Google-Extended', 'CCBot'];
      for (const bot of bots) {
        // Test root access
        const isAllowed = robots.isAllowed(url, bot);
        // If undefined or true, it's allowed. If explicitly false, it's disallowed.
        allowedBots[bot] = isAllowed !== false;
      }
    } catch {
      robotsParses = false;
    }
  }

  // 3. Process sitemap.xml
  let sitemapExists = sitemapRes.ok && (sitemapRes.body.includes('<urlset') || sitemapRes.body.includes('<sitemapindex'));
  let sitemapReferenced = robotsSitemaps.some(s => s.toLowerCase().includes('sitemap')) ||
    robotsRes.body.toLowerCase().includes('sitemap:');

  // If sitemap.xml at root didn't return 200, but robots.txt declared a sitemap, check that one
  if (!sitemapExists && robotsSitemaps.length > 0) {
    try {
      const altSitemapRes = await safeFetch(robotsSitemaps[0], { timeoutMs: 3500 });
      if (altSitemapRes.ok && (altSitemapRes.body.includes('<urlset') || altSitemapRes.body.includes('<sitemapindex'))) {
        sitemapExists = true;
        sitemapReferenced = true;
      }
    } catch {
      // Ignore
    }
  }

  // 4. Optionally fetch up to 2 subpages (e.g. About or FAQ) to gather additional question headings or schema
  const subpagesContent: PageContent[] = [];
  if (options.fetchSubpages !== false && homeParsed.links.internal.length > 0) {
    // Pick candidate pages: prioritize FAQ and About if available
    const candidates = homeParsed.links.internal
      .filter(link => {
        const lower = link.toLowerCase();
        return (
          lower.includes('faq') ||
          lower.includes('about') ||
          lower.includes('services') ||
          lower.includes('pricing')
        );
      })
      .slice(0, 2);

    if (candidates.length > 0) {
      const subResList = await Promise.all(
        candidates.map(candidateUrl => safeFetch(candidateUrl, { timeoutMs: 3500 }))
      );

      for (const subRes of subResList) {
        if (subRes.ok) {
          const subParsed = parseHtml(subRes.body, subRes.url);
          subpagesContent.push({
            url: subRes.url,
            statusCode: subRes.statusCode,
            headers: subRes.headers,
            html: subRes.body,
            text: subParsed.visibleText,
            wordCount: subParsed.wordCount,
            hasNoIndex: subParsed.hasNoIndex,
            isHttps: subRes.url.startsWith('https://')
          });

          // Aggregate question headings and jsonLdBlocks from subpages
          homeParsed.questionHeadings.push(...subParsed.questionHeadings);
          homeParsed.jsonLdBlocks.push(...subParsed.jsonLdBlocks);
          if (subParsed.faqSectionPresent) {
            homeParsed.faqSectionPresent = true;
          }
        }
      }
    }
  }

  const homepageContent: PageContent = {
    url: homeRes.url || url,
    statusCode: homeRes.statusCode,
    headers: homeRes.headers,
    html: homeRes.body,
    text: homeParsed.visibleText,
    wordCount: homeParsed.wordCount,
    hasNoIndex: homeParsed.hasNoIndex,
    isHttps: (homeRes.url || url).startsWith('https://')
  };

  const siteData: ScannedSiteData = {
    targetUrl: url,
    normalizedDomain: domain,
    homepage: homepageContent,
    robotsTxt: {
      exists: robotsRes.ok && robotsRes.body.trim().length > 0,
      raw: robotsRes.body,
      parses: robotsParses,
      allowedBots
    },
    sitemapXml: {
      exists: sitemapExists,
      referencedInRobots: sitemapReferenced,
      validXml: sitemapExists,
      urlCount: (sitemapRes.body.match(/<loc>/g) || []).length
    },
    subpages: subpagesContent,
    internalLinks: homeParsed.links.internal
  };

  // 5. Score calculation
  const scoreResult = calculateReadinessScore(siteData, homeParsed);

  const successResult: ScanSuccessResult = {
    readable: true,
    url,
    domain,
    scannedAt: now,
    score: scoreResult.score,
    band: scoreResult.band,
    categories: scoreResult.categories,
    topFixes: scoreResult.topFixes
  };

  return successResult;
}
