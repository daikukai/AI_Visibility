import * as cheerio from 'cheerio';

export interface ParsedHtml {
  title: string;
  metaDescription: string;
  hasNoIndex: boolean;
  h1List: string[];
  questionHeadings: string[];
  visibleText: string;
  wordCount: number;
  openGraph: {
    title: boolean;
    description: boolean;
    image: boolean;
  };
  jsonLdBlocks: any[];
  links: {
    internal: string[];
    hasAboutLink: boolean;
    hasContactLink: boolean;
    hasFaqLink: boolean;
    hasBlogLink: boolean;
    hasServicePricingLink: boolean;
  };
  contactSignals: {
    hasEmailOrMailto: boolean;
    hasPhoneOrTel: boolean;
    hasLocationOrServiceArea: boolean;
  };
  faqSectionPresent: boolean;
  blogPostCount: number;
}

/**
 * Extracts visible plain text from HTML, stripping non-content elements.
 */
export function extractVisibleText($: cheerio.CheerioAPI): string {
  // Clone to avoid mutating
  const clone = cheerio.load($.html());
  clone('script, style, noscript, svg, path, iframe, template, [hidden]').remove();
  const text = clone('body').text() || clone.root().text();
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Counts words in a plain text string.
 */
export function countWords(text: string): number {
  if (!text) return 0;
  const matches = text.match(/[\p{L}\p{N}'-]+/gu);
  return matches ? matches.length : 0;
}

/**
 * Analyzes raw HTML string of a page and extracts all structured readiness signals.
 */
export function parseHtml(html: string, baseUrl: string): ParsedHtml {
  const $ = cheerio.load(html);
  const base = new URL(baseUrl);

  // 1. Title & Meta tags
  const title = $('title').first().text().trim();
  const metaDescription =
    $('meta[name="description" i]').attr('content')?.trim() ||
    $('meta[property="og:description" i]').attr('content')?.trim() ||
    '';

  const metaRobots = $('meta[name="robots" i]').attr('content')?.toLowerCase() || '';
  const hasNoIndex = metaRobots.includes('noindex');

  // 2. Open Graph
  const ogTitle = Boolean($('meta[property="og:title" i]').attr('content'));
  const ogDesc = Boolean($('meta[property="og:description" i]').attr('content'));
  const ogImage = Boolean($('meta[property="og:image" i]').attr('content'));

  // 3. Headings
  const h1List: string[] = [];
  $('h1').each((_, el) => {
    const text = $(el).text().replace(/\s+/g, ' ').trim();
    if (text) h1List.push(text);
  });

  const questionHeadings: string[] = [];
  $('h1, h2, h3, h4').each((_, el) => {
    const text = $(el).text().replace(/\s+/g, ' ').trim();
    if (text.endsWith('?') || /^(what|why|how|who|where|when|can|is|are|do|does|will|should)\b/i.test(text)) {
      questionHeadings.push(text);
    }
  });

  // 4. Visible Text & Word Count
  const visibleText = extractVisibleText($);
  const wordCount = countWords(visibleText);

  // 5. JSON-LD scripts
  const jsonLdBlocks: any[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const raw = $(el).html()?.trim();
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          jsonLdBlocks.push(...parsed);
        } else if (parsed && typeof parsed === 'object') {
          if (Array.isArray(parsed['@graph'])) {
            jsonLdBlocks.push(...parsed['@graph']);
          } else {
            jsonLdBlocks.push(parsed);
          }
        }
      }
    } catch {
      // Invalid JSON block ignored
    }
  });

  // 6. Links and Navigation
  const internalLinks = new Set<string>();
  let hasAboutLink = false;
  let hasContactLink = false;
  let hasFaqLink = false;
  let hasBlogLink = false;
  let hasServicePricingLink = false;
  let blogPostCount = 0;

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href')?.trim();
    const linkText = $(el).text().toLowerCase();
    if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;

    try {
      const resolved = new URL(href, baseUrl);
      if (resolved.hostname === base.hostname) {
        internalLinks.add(resolved.toString());

        const pathLower = resolved.pathname.toLowerCase();
        if (pathLower.includes('about') || linkText.includes('about us') || linkText === 'about') {
          hasAboutLink = true;
        }
        if (pathLower.includes('contact') || linkText.includes('contact')) {
          hasContactLink = true;
        }
        if (pathLower.includes('faq') || pathLower.includes('frequently-asked') || linkText.includes('faq')) {
          hasFaqLink = true;
        }
        if (
          pathLower.includes('blog') ||
          pathLower.includes('articles') ||
          pathLower.includes('insights') ||
          pathLower.includes('resources') ||
          linkText.includes('blog') ||
          linkText.includes('resources')
        ) {
          hasBlogLink = true;
          // Count potential blog post links
          if (
            (pathLower.startsWith('/blog/') && pathLower.length > 7) ||
            (pathLower.startsWith('/articles/') && pathLower.length > 10) ||
            (pathLower.startsWith('/resources/') && pathLower.length > 11)
          ) {
            blogPostCount++;
          }
        }
        if (
          pathLower.includes('service') ||
          pathLower.includes('pricing') ||
          pathLower.includes('product') ||
          pathLower.includes('solutions') ||
          linkText.includes('services') ||
          linkText.includes('pricing') ||
          linkText.includes('solutions')
        ) {
          hasServicePricingLink = true;
        }
      }
    } catch {
      // Invalid URL in href
    }
  });

  // 7. Contact & Location Signals
  const rawHtml = $.html();
  const hasMailto = $('a[href^="mailto:"]').length > 0;
  const hasEmailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(visibleText);
  const hasTel = $('a[href^="tel:"]').length > 0;
  const hasPhoneRegex = /(\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}/.test(visibleText);

  const locationKeywords = [
    'address', 'serving', 'serves', 'headquarters', 'hq', 'located in', 'office',
    'united states', 'usa', 'uk', 'canada', 'australia', 'london', 'new york', 'singapore'
  ];
  const hasLocationOrServiceArea =
    locationKeywords.some(keyword => visibleText.toLowerCase().includes(keyword)) ||
    Boolean($('address').length) ||
    jsonLdBlocks.some(block => block.address || block.areaServed);

  // 8. FAQ Section Present
  const hasFaqClassOrId = $('[id*="faq" i], [class*="faq" i], details summary').length > 0;
  const faqSectionPresent = hasFaqLink || hasFaqClassOrId;

  return {
    title,
    metaDescription,
    hasNoIndex,
    h1List,
    questionHeadings,
    visibleText,
    wordCount,
    openGraph: {
      title: ogTitle,
      description: ogDesc,
      image: ogImage
    },
    jsonLdBlocks,
    links: {
      internal: Array.from(internalLinks),
      hasAboutLink,
      hasContactLink,
      hasFaqLink,
      hasBlogLink,
      hasServicePricingLink
    },
    contactSignals: {
      hasEmailOrMailto: hasMailto || hasEmailRegex,
      hasPhoneOrTel: hasTel || hasPhoneRegex,
      hasLocationOrServiceArea
    },
    faqSectionPresent,
    blogPostCount
  };
}
