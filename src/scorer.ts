import {
  CheckResult,
  CategoryScore,
  ReadinessBand,
  FixItem,
  ScanSuccessResult,
  ScannedSiteData
} from './types.js';
import { ParsedHtml } from './parser.js';

export function getReadinessBand(score: number): ReadinessBand {
  if (score >= 80) return 'Strong readiness';
  if (score >= 60) return 'Good foundation with gaps';
  if (score >= 40) return 'Needs improvement';
  return 'Significant issues';
}

/**
 * Evaluates Crawlability (25 points max)
 */
export function scoreCrawlability(
  site: ScannedSiteData,
  homeParsed?: ParsedHtml
): CategoryScore {
  const checks: CheckResult[] = [];

  // Check 1: Homepage loads over HTTPS with HTTP 200 (4 pts)
  const isHttps = site.homepage?.isHttps ?? false;
  const is200 = site.homepage?.statusCode === 200;
  if (isHttps && is200) {
    checks.push({
      id: 'crawl_https_200',
      name: 'HTTPS & HTTP 200 Status',
      category: 'crawlability',
      pointsEarned: 4,
      maxPoints: 4,
      status: 'pass',
      detail: 'Homepage loads securely over HTTPS with a clean HTTP 200 status code.'
    });
  } else if (is200 && !isHttps) {
    checks.push({
      id: 'crawl_https_200',
      name: 'HTTPS & HTTP 200 Status',
      category: 'crawlability',
      pointsEarned: 2,
      maxPoints: 4,
      status: 'partial',
      detail: 'Homepage returns HTTP 200 but is not enforcing secure HTTPS.',
      fixText: 'Configure SSL/TLS and redirect all HTTP traffic to HTTPS.'
    });
  } else {
    checks.push({
      id: 'crawl_https_200',
      name: 'HTTPS & HTTP 200 Status',
      category: 'crawlability',
      pointsEarned: 0,
      maxPoints: 4,
      status: 'fail',
      detail: `Homepage returned status ${site.homepage?.statusCode || 'unreachable'}.`,
      fixText: 'Ensure your primary domain is accessible and returns HTTP 200 over HTTPS.'
    });
  }

  // Check 2: robots.txt exists and parses (3 pts)
  if (site.robotsTxt.exists && site.robotsTxt.parses) {
    checks.push({
      id: 'crawl_robots_txt',
      name: 'Valid robots.txt File',
      category: 'crawlability',
      pointsEarned: 3,
      maxPoints: 3,
      status: 'pass',
      detail: 'robots.txt exists at root and parses without syntax errors.'
    });
  } else if (site.robotsTxt.exists && !site.robotsTxt.parses) {
    checks.push({
      id: 'crawl_robots_txt',
      name: 'Valid robots.txt File',
      category: 'crawlability',
      pointsEarned: 1,
      maxPoints: 3,
      status: 'partial',
      detail: 'robots.txt is present but contains syntax issues or unparseable rules.',
      fixText: 'Correct robots.txt syntax according to the standard Robots Exclusion Protocol.'
    });
  } else {
    checks.push({
      id: 'crawl_robots_txt',
      name: 'Valid robots.txt File',
      category: 'crawlability',
      pointsEarned: 0,
      maxPoints: 3,
      status: 'fail',
      detail: 'robots.txt was not found at /robots.txt.',
      fixText: 'Publish a clean robots.txt at your domain root defining crawler guidelines.'
    });
  }

  // Check 3: AI crawlers not blocked (8 pts split across GPTBot, ClaudeBot, PerplexityBot, Google-Extended, CCBot)
  const aiBots = ['GPTBot', 'ClaudeBot', 'PerplexityBot', 'Google-Extended', 'CCBot'];
  const allowedCount = aiBots.filter(bot => site.robotsTxt.allowedBots[bot] !== false).length;
  const aiPoints = Math.round((allowedCount / aiBots.length) * 8 * 10) / 10;
  const blockedBots = aiBots.filter(bot => site.robotsTxt.allowedBots[bot] === false);

  if (allowedCount === aiBots.length) {
    checks.push({
      id: 'crawl_ai_bots',
      name: 'AI Crawler Accessibility',
      category: 'crawlability',
      pointsEarned: 8,
      maxPoints: 8,
      status: 'pass',
      detail: 'All major AI search bots (GPTBot, ClaudeBot, PerplexityBot, Google-Extended, CCBot) are allowed to crawl.'
    });
  } else if (allowedCount > 0) {
    checks.push({
      id: 'crawl_ai_bots',
      name: 'AI Crawler Accessibility',
      category: 'crawlability',
      pointsEarned: aiPoints,
      maxPoints: 8,
      status: 'partial',
      detail: `Blocked AI bots in robots.txt: ${blockedBots.join(', ')}.`,
      fixText: `Remove disallow rules for ${blockedBots.join(', ')} in robots.txt so AI engines can index and cite your content.`
    });
  } else {
    checks.push({
      id: 'crawl_ai_bots',
      name: 'AI Crawler Accessibility',
      category: 'crawlability',
      pointsEarned: 0,
      maxPoints: 8,
      status: 'fail',
      detail: 'All major AI bots are explicitly disallowed in robots.txt.',
      fixText: 'Unblock GPTBot, ClaudeBot, PerplexityBot, Google-Extended, and CCBot in robots.txt.'
    });
  }

  // Check 4: sitemap.xml present and referenced (4 pts)
  const sitemapExists = site.sitemapXml.exists;
  const sitemapReferenced = site.sitemapXml.referencedInRobots;
  if (sitemapExists && sitemapReferenced) {
    checks.push({
      id: 'crawl_sitemap',
      name: 'XML Sitemap & Discovery',
      category: 'crawlability',
      pointsEarned: 4,
      maxPoints: 4,
      status: 'pass',
      detail: 'sitemap.xml is active, contains valid URLs, and is referenced in robots.txt.'
    });
  } else if (sitemapExists && !sitemapReferenced) {
    checks.push({
      id: 'crawl_sitemap',
      name: 'XML Sitemap & Discovery',
      category: 'crawlability',
      pointsEarned: 2,
      maxPoints: 4,
      status: 'partial',
      detail: 'sitemap.xml exists but is not declared with a "Sitemap: ..." directive in robots.txt.',
      fixText: 'Add "Sitemap: https://yourdomain.com/sitemap.xml" to robots.txt to assist bot discovery.'
    });
  } else {
    checks.push({
      id: 'crawl_sitemap',
      name: 'XML Sitemap & Discovery',
      category: 'crawlability',
      pointsEarned: 0,
      maxPoints: 4,
      status: 'fail',
      detail: 'No accessible sitemap.xml was detected.',
      fixText: 'Generate an XML sitemap listing your core pages and reference it in robots.txt.'
    });
  }

  // Check 5: Main content in raw HTML >= 300 words (4 pts)
  const words = homeParsed?.wordCount ?? site.homepage?.wordCount ?? 0;
  if (words >= 300) {
    checks.push({
      id: 'crawl_raw_html_content',
      name: 'Raw HTML Content Depth',
      category: 'crawlability',
      pointsEarned: 4,
      maxPoints: 4,
      status: 'pass',
      detail: `Homepage contains ${words} words of visible text directly in raw HTML.`
    });
  } else if (words >= 150) {
    checks.push({
      id: 'crawl_raw_html_content',
      name: 'Raw HTML Content Depth',
      category: 'crawlability',
      pointsEarned: 2,
      maxPoints: 4,
      status: 'partial',
      detail: `Homepage has ${words} words of raw text, below the recommended 300-word baseline.`,
      fixText: 'Expand primary homepage copy so LLM search crawlers can parse your value proposition without running heavy scripts.'
    });
  } else {
    checks.push({
      id: 'crawl_raw_html_content',
      name: 'Raw HTML Content Depth',
      category: 'crawlability',
      pointsEarned: 0,
      maxPoints: 4,
      status: 'fail',
      detail: `Homepage only contains ${words} visible words in static HTML (content may be locked behind client-side JavaScript).`,
      fixText: 'Pre-render or serve essential company and service descriptions in static server-rendered HTML.'
    });
  }

  // Check 6: No noindex on the homepage (2 pts)
  const hasNoIndex = homeParsed?.hasNoIndex ?? site.homepage?.hasNoIndex ?? false;
  if (!hasNoIndex) {
    checks.push({
      id: 'crawl_noindex',
      name: 'Indexability Status',
      category: 'crawlability',
      pointsEarned: 2,
      maxPoints: 2,
      status: 'pass',
      detail: 'No noindex tags or headers are blocking the homepage from search crawlers.'
    });
  } else {
    checks.push({
      id: 'crawl_noindex',
      name: 'Indexability Status',
      category: 'crawlability',
      pointsEarned: 0,
      maxPoints: 2,
      status: 'fail',
      detail: 'A noindex directive was detected on the homepage, preventing all search indexation.',
      fixText: 'Remove the <meta name="robots" content="noindex"> tag or X-Robots-Tag header from your homepage.'
    });
  }

  const earned = Math.min(25, Math.round(checks.reduce((acc, c) => acc + c.pointsEarned, 0) * 10) / 10);
  return { name: 'Crawlability', earned, max: 25, checks };
}

/**
 * Evaluates Company Clarity (25 points max)
 */
export function scoreCompanyClarity(
  site: ScannedSiteData,
  homeParsed?: ParsedHtml
): CategoryScore {
  const checks: CheckResult[] = [];
  const parsed = homeParsed;

  // Check 1: One descriptive h1 (3+ words) (5 pts)
  const h1s = parsed?.h1List || [];
  if (h1s.length === 1 && h1s[0].split(/\s+/).length >= 3) {
    checks.push({
      id: 'clarity_h1',
      name: 'Clear Primary H1 Heading',
      category: 'clarity',
      pointsEarned: 5,
      maxPoints: 5,
      status: 'pass',
      detail: `Single clear H1 heading found: "${h1s[0]}".`
    });
  } else if (h1s.length > 0) {
    checks.push({
      id: 'clarity_h1',
      name: 'Clear Primary H1 Heading',
      category: 'clarity',
      pointsEarned: 3,
      maxPoints: 5,
      status: 'partial',
      detail: h1s.length > 1
        ? `Multiple (${h1s.length}) H1 tags found. A single descriptive H1 is best practice.`
        : `H1 tag "${h1s[0]}" is very short (< 3 words).`,
      fixText: 'Use a single descriptive H1 tag (3+ words) stating clearly what your business does.'
    });
  } else {
    checks.push({
      id: 'clarity_h1',
      name: 'Clear Primary H1 Heading',
      category: 'clarity',
      pointsEarned: 0,
      maxPoints: 5,
      status: 'fail',
      detail: 'No H1 tag was found on the homepage.',
      fixText: 'Add a prominent <h1> tag articulating your core service and target audience.'
    });
  }

  // Check 2: Meta description present, 70–160 characters (5 pts)
  const metaDesc = parsed?.metaDescription || '';
  if (metaDesc.length >= 70 && metaDesc.length <= 160) {
    checks.push({
      id: 'clarity_meta_desc',
      name: 'Optimized Meta Description',
      category: 'clarity',
      pointsEarned: 5,
      maxPoints: 5,
      status: 'pass',
      detail: `Meta description is well-calibrated (${metaDesc.length} characters).`
    });
  } else if (metaDesc.length > 0) {
    checks.push({
      id: 'clarity_meta_desc',
      name: 'Optimized Meta Description',
      category: 'clarity',
      pointsEarned: 3,
      maxPoints: 5,
      status: 'partial',
      detail: metaDesc.length < 70
        ? `Meta description is short (${metaDesc.length} chars, recommended 70-160).`
        : `Meta description is overly long (${metaDesc.length} chars, recommended 70-160).`,
      fixText: 'Refine your meta description to between 70 and 160 characters summarizing your exact offering.'
    });
  } else {
    checks.push({
      id: 'clarity_meta_desc',
      name: 'Optimized Meta Description',
      category: 'clarity',
      pointsEarned: 0,
      maxPoints: 5,
      status: 'fail',
      detail: 'No meta description tag was found.',
      fixText: 'Add an informative <meta name="description"> (70-160 characters) describing your business.'
    });
  }

  // Check 3: Title tag includes brand name plus a descriptor, matching brand token (4 pts)
  const title = parsed?.title || '';
  const domainBrand = site.normalizedDomain.split('.')[0].toLowerCase();
  const hasSeparator = title.includes('|') || title.includes('-') || title.includes('—') || title.includes(':');
  const hasBrand = title.toLowerCase().includes(domainBrand) || (parsed?.h1List[0] && title.toLowerCase().includes(parsed.h1List[0].split(' ')[0].toLowerCase()));

  if (title.length >= 15 && hasSeparator && hasBrand) {
    checks.push({
      id: 'clarity_title',
      name: 'Descriptive Brand Title Tag',
      category: 'clarity',
      pointsEarned: 4,
      maxPoints: 4,
      status: 'pass',
      detail: `Title tag balances brand identity and service descriptor: "${title}".`
    });
  } else if (title.length > 0) {
    checks.push({
      id: 'clarity_title',
      name: 'Descriptive Brand Title Tag',
      category: 'clarity',
      pointsEarned: 2,
      maxPoints: 4,
      status: 'partial',
      detail: `Title tag "${title}" could be more descriptive with a brand name + category descriptor.`,
      fixText: 'Update the <title> tag to format "Brand Name | Clear Offering & Value Proposition".'
    });
  } else {
    checks.push({
      id: 'clarity_title',
      name: 'Descriptive Brand Title Tag',
      category: 'clarity',
      pointsEarned: 0,
      maxPoints: 4,
      status: 'fail',
      detail: 'Missing or empty <title> tag on homepage.',
      fixText: 'Provide a unique <title> tag with your brand name and primary business service.'
    });
  }

  // Check 4: About page linked (4 pts)
  if (parsed?.links.hasAboutLink) {
    checks.push({
      id: 'clarity_about_link',
      name: 'About Page Navigation',
      category: 'clarity',
      pointsEarned: 4,
      maxPoints: 4,
      status: 'pass',
      detail: 'About / Company background page is clearly linked from the homepage.'
    });
  } else {
    checks.push({
      id: 'clarity_about_link',
      name: 'About Page Navigation',
      category: 'clarity',
      pointsEarned: 0,
      maxPoints: 4,
      status: 'fail',
      detail: 'No link to an About or Company story page detected in navigation.',
      fixText: 'Link an "About Us" page from the main header or footer establishing company history and credibility.'
    });
  }

  // Check 5: Contact page, email, or phone visible (4 pts)
  const contactSignals = parsed?.contactSignals;
  const hasContact = parsed?.links.hasContactLink || contactSignals?.hasEmailOrMailto || contactSignals?.hasPhoneOrTel;
  if (hasContact) {
    checks.push({
      id: 'clarity_contact',
      name: 'Verified Contact Accessibility',
      category: 'clarity',
      pointsEarned: 4,
      maxPoints: 4,
      status: 'pass',
      detail: 'Clear contact channel found (contact page link, direct business email, or telephone).'
    });
  } else {
    checks.push({
      id: 'clarity_contact',
      name: 'Verified Contact Accessibility',
      category: 'clarity',
      pointsEarned: 0,
      maxPoints: 4,
      status: 'fail',
      detail: 'No direct contact link, email address, or telephone number found.',
      fixText: 'Include visible contact information (contact page link, business email, or phone number) in your footer.'
    });
  }

  // Check 6: Location or service-area text present (3 pts)
  if (contactSignals?.hasLocationOrServiceArea) {
    checks.push({
      id: 'clarity_location',
      name: 'Geographic / Service Area Presence',
      category: 'clarity',
      pointsEarned: 3,
      maxPoints: 3,
      status: 'pass',
      detail: 'Physical address, headquarters location, or service area coverage detected.'
    });
  } else {
    checks.push({
      id: 'clarity_location',
      name: 'Geographic / Service Area Presence',
      category: 'clarity',
      pointsEarned: 0,
      maxPoints: 3,
      status: 'fail',
      detail: 'No explicit physical address, city, country, or "serving [region]" statement detected.',
      fixText: 'Specify your office location, country, or primary service regions in footer text or schema markup.'
    });
  }

  const earned = Math.min(25, checks.reduce((acc, c) => acc + c.pointsEarned, 0));
  return { name: 'Company Clarity', earned, max: 25, checks };
}

/**
 * Evaluates Question-answering content (25 points max)
 */
export function scoreQuestionAnswering(
  site: ScannedSiteData,
  homeParsed?: ParsedHtml
): CategoryScore {
  const checks: CheckResult[] = [];
  const parsed = homeParsed;

  // Check 1: FAQ section or FAQ page present (7 pts)
  if (parsed?.faqSectionPresent) {
    checks.push({
      id: 'qa_faq_present',
      name: 'FAQ Section / Dedicated Page',
      category: 'qa_content',
      pointsEarned: 7,
      maxPoints: 7,
      status: 'pass',
      detail: 'FAQ section or linked FAQ page found, directly addressing customer queries.'
    });
  } else {
    checks.push({
      id: 'qa_faq_present',
      name: 'FAQ Section / Dedicated Page',
      category: 'qa_content',
      pointsEarned: 0,
      maxPoints: 7,
      status: 'fail',
      detail: 'No FAQ section or dedicated FAQ page found.',
      fixText: 'Add an FAQ section or page answering top buyer questions to feed AI question-answering engines.'
    });
  }

  // Check 2: 3 or more question-style headings across scanned pages (6 pts)
  const questionHeadings = parsed?.questionHeadings || [];
  if (questionHeadings.length >= 3) {
    checks.push({
      id: 'qa_question_headings',
      name: 'Question-Formatted Headings',
      category: 'qa_content',
      pointsEarned: 6,
      maxPoints: 6,
      status: 'pass',
      detail: `Found ${questionHeadings.length} question-formatted headings (e.g. "${questionHeadings[0]}").`
    });
  } else if (questionHeadings.length > 0) {
    checks.push({
      id: 'qa_question_headings',
      name: 'Question-Formatted Headings',
      category: 'qa_content',
      pointsEarned: 3,
      maxPoints: 6,
      status: 'partial',
      detail: `Only ${questionHeadings.length} question-style heading(s) found (recommended 3+).`,
      fixText: 'Structure content sections with natural question headings (e.g., "How does X work?", "Why choose Y?").'
    });
  } else {
    checks.push({
      id: 'qa_question_headings',
      name: 'Question-Formatted Headings',
      category: 'qa_content',
      pointsEarned: 0,
      maxPoints: 6,
      status: 'fail',
      detail: 'No question-style headings (ending in "?") detected in scanned content.',
      fixText: 'Format key sections as user questions to align with conversational search queries.'
    });
  }

  // Check 3: Blog/resources section with 3 or more linked posts (6 pts)
  const hasBlog = parsed?.links.hasBlogLink;
  const blogPosts = parsed?.blogPostCount || 0;
  if (hasBlog && blogPosts >= 3) {
    checks.push({
      id: 'qa_blog_resources',
      name: 'Active Insights & Resources Hub',
      category: 'qa_content',
      pointsEarned: 6,
      maxPoints: 6,
      status: 'pass',
      detail: `Blog/resources section active with ${blogPosts} detected article links.`
    });
  } else if (hasBlog) {
    checks.push({
      id: 'qa_blog_resources',
      name: 'Active Insights & Resources Hub',
      category: 'qa_content',
      pointsEarned: 3,
      maxPoints: 6,
      status: 'partial',
      detail: 'Blog or resources section linked, but fewer than 3 individual articles detected.',
      fixText: 'Publish and feature at least 3 in-depth educational articles addressing industry topics.'
    });
  } else {
    checks.push({
      id: 'qa_blog_resources',
      name: 'Active Insights & Resources Hub',
      category: 'qa_content',
      pointsEarned: 0,
      maxPoints: 6,
      status: 'fail',
      detail: 'No blog, insights, or knowledge base section detected.',
      fixText: 'Create a resources or blog section providing authoritative guides and industry solutions.'
    });
  }

  // Check 4: Service, product, or pricing page linked from homepage (6 pts)
  if (parsed?.links.hasServicePricingLink) {
    checks.push({
      id: 'qa_service_pricing_link',
      name: 'Service / Product Architecture',
      category: 'qa_content',
      pointsEarned: 6,
      maxPoints: 6,
      status: 'pass',
      detail: 'Direct links to specific service, product, or pricing pages detected.'
    });
  } else {
    checks.push({
      id: 'qa_service_pricing_link',
      name: 'Service / Product Architecture',
      category: 'qa_content',
      pointsEarned: 0,
      maxPoints: 6,
      status: 'fail',
      detail: 'No dedicated service, solution, or pricing page links found in navigation.',
      fixText: 'Provide dedicated landing pages for individual services or pricing to establish topical authority.'
    });
  }

  const earned = Math.min(25, checks.reduce((acc, c) => acc + c.pointsEarned, 0));
  return { name: 'Question-Answering Content', earned, max: 25, checks };
}

/**
 * Evaluates Structured Data (25 points max)
 */
export function scoreStructuredData(
  site: ScannedSiteData,
  homeParsed?: ParsedHtml
): CategoryScore {
  const checks: CheckResult[] = [];
  const jsonLd = homeParsed?.jsonLdBlocks || [];

  // Flatten any nested schemas
  const allSchemas: any[] = [];
  for (const item of jsonLd) {
    allSchemas.push(item);
    if (Array.isArray(item['@graph'])) {
      allSchemas.push(...item['@graph']);
    }
  }

  // Helper to test schema types
  const hasType = (types: string[]): any => {
    return allSchemas.find(s => {
      const t = s['@type'];
      if (!t) return false;
      if (Array.isArray(t)) {
        return t.some(val => types.includes(val));
      }
      return types.includes(t);
    });
  };

  // Check 1: At least one valid JSON-LD block parses (5 pts)
  if (jsonLd.length > 0) {
    checks.push({
      id: 'schema_valid_jsonld',
      name: 'Valid JSON-LD Block',
      category: 'structured_data',
      pointsEarned: 5,
      maxPoints: 5,
      status: 'pass',
      detail: `Found ${jsonLd.length} valid JSON-LD schema block(s).`
    });
  } else {
    checks.push({
      id: 'schema_valid_jsonld',
      name: 'Valid JSON-LD Block',
      category: 'structured_data',
      pointsEarned: 0,
      maxPoints: 5,
      status: 'fail',
      detail: 'No JSON-LD structured data blocks detected on the homepage.',
      fixText: 'Add schema.org JSON-LD markup to your HTML <head> so AI bots can unambiguously read your entity details.'
    });
  }

  // Check 2: Organization or LocalBusiness with name and url (6 pts)
  const orgSchema = hasType(['Organization', 'Corporation', 'LocalBusiness', 'ProfessionalService']);
  if (orgSchema && orgSchema.name && orgSchema.url) {
    checks.push({
      id: 'schema_organization',
      name: 'Organization / Business Entity',
      category: 'structured_data',
      pointsEarned: 6,
      maxPoints: 6,
      status: 'pass',
      detail: `Complete ${orgSchema['@type']} schema detected with name and URL.`
    });
  } else if (orgSchema) {
    checks.push({
      id: 'schema_organization',
      name: 'Organization / Business Entity',
      category: 'structured_data',
      pointsEarned: 3,
      maxPoints: 6,
      status: 'partial',
      detail: `${orgSchema['@type']} schema found but missing required 'name' or 'url' properties.`,
      fixText: 'Include full "name", "url", and "description" fields in your Organization schema markup.'
    });
  } else {
    checks.push({
      id: 'schema_organization',
      name: 'Organization / Business Entity',
      category: 'structured_data',
      pointsEarned: 0,
      maxPoints: 6,
      status: 'fail',
      detail: 'No Organization or LocalBusiness schema entity detected.',
      fixText: 'Implement schema.org/Organization markup with official name, URL, and corporate details.'
    });
  }

  // Check 3: Logo and sameAs links present (4 pts)
  const hasLogo = orgSchema && Boolean(orgSchema.logo || orgSchema.image);
  const hasSameAs = orgSchema && Boolean(orgSchema.sameAs && (Array.isArray(orgSchema.sameAs) ? orgSchema.sameAs.length > 0 : true));
  if (hasLogo && hasSameAs) {
    checks.push({
      id: 'schema_logo_sameas',
      name: 'Entity Brand & Social Profiles (sameAs)',
      category: 'structured_data',
      pointsEarned: 4,
      maxPoints: 4,
      status: 'pass',
      detail: 'Organization schema defines brand logo and verified sameAs social profile links.'
    });
  } else if (hasLogo || hasSameAs) {
    checks.push({
      id: 'schema_logo_sameas',
      name: 'Entity Brand & Social Profiles (sameAs)',
      category: 'structured_data',
      pointsEarned: 2,
      maxPoints: 4,
      status: 'partial',
      detail: hasLogo
        ? 'Logo defined in schema, but sameAs social links are missing.'
        : 'sameAs social links defined, but brand logo property is missing.',
      fixText: 'Add both "logo" and "sameAs" (LinkedIn, Twitter, YouTube links) to your Organization schema to link entity nodes.'
    });
  } else {
    checks.push({
      id: 'schema_logo_sameas',
      name: 'Entity Brand & Social Profiles (sameAs)',
      category: 'structured_data',
      pointsEarned: 0,
      maxPoints: 4,
      status: 'fail',
      detail: 'Neither logo nor sameAs social links are declared in structured data.',
      fixText: 'Add "logo" and "sameAs" social profile URLs inside Organization schema for entity reconciliation.'
    });
  }

  // Check 4: Service, Product, or Offer markup present (5 pts)
  const serviceProduct = hasType(['Service', 'Product', 'Offer', 'SoftwareApplication', 'WebSite']);
  if (serviceProduct && ['Service', 'Product', 'Offer', 'SoftwareApplication'].includes(serviceProduct['@type'])) {
    checks.push({
      id: 'schema_service_product',
      name: 'Service / Product Structured Schema',
      category: 'structured_data',
      pointsEarned: 5,
      maxPoints: 5,
      status: 'pass',
      detail: `${serviceProduct['@type']} schema markup successfully identified.`
    });
  } else {
    checks.push({
      id: 'schema_service_product',
      name: 'Service / Product Structured Schema',
      category: 'structured_data',
      pointsEarned: 0,
      maxPoints: 5,
      status: 'fail',
      detail: 'No Service, Product, or Offer schema found.',
      fixText: 'Add schema.org/Service or schema.org/Product markup detailing your deliverables and specifications.'
    });
  }

  // Check 5: FAQPage markup present (3 pts)
  const faqSchema = hasType(['FAQPage']);
  if (faqSchema) {
    checks.push({
      id: 'schema_faq',
      name: 'FAQPage Schema Markup',
      category: 'structured_data',
      pointsEarned: 3,
      maxPoints: 3,
      status: 'pass',
      detail: 'FAQPage schema markup active, formatting Q&A pairs for direct LLM ingestion.'
    });
  } else {
    checks.push({
      id: 'schema_faq',
      name: 'FAQPage Schema Markup',
      category: 'structured_data',
      pointsEarned: 0,
      maxPoints: 3,
      status: 'fail',
      detail: 'No FAQPage schema markup detected.',
      fixText: 'Wrap FAQ content in schema.org/FAQPage markup with Question and Answer pairs.'
    });
  }

  // Check 6: Basic Open Graph tags (2 pts)
  const og = homeParsed?.openGraph;
  const ogCount = (og?.title ? 1 : 0) + (og?.description ? 1 : 0) + (og?.image ? 1 : 0);
  if (ogCount === 3) {
    checks.push({
      id: 'schema_open_graph',
      name: 'Open Graph Social Meta Tags',
      category: 'structured_data',
      pointsEarned: 2,
      maxPoints: 2,
      status: 'pass',
      detail: 'All essential Open Graph meta tags (og:title, og:description, og:image) are present.'
    });
  } else if (ogCount > 0) {
    checks.push({
      id: 'schema_open_graph',
      name: 'Open Graph Social Meta Tags',
      category: 'structured_data',
      pointsEarned: 1,
      maxPoints: 2,
      status: 'partial',
      detail: `Partial Open Graph tags found (${ogCount}/3 present).`,
      fixText: 'Complete your Open Graph tags by providing og:title, og:description, and og:image.'
    });
  } else {
    checks.push({
      id: 'schema_open_graph',
      name: 'Open Graph Social Meta Tags',
      category: 'structured_data',
      pointsEarned: 0,
      maxPoints: 2,
      status: 'fail',
      detail: 'Missing Open Graph meta tags (og:title, og:description, og:image).',
      fixText: 'Add og:title, og:description, and og:image tags for rich social snippets and AI citation card previews.'
    });
  }

  const earned = Math.min(25, checks.reduce((acc, c) => acc + c.pointsEarned, 0));
  return { name: 'Structured Data', earned, max: 25, checks };
}

/**
 * Derives Top 3 prioritized fixes from all checks with lost points.
 */
export function extractTopFixes(categories: CategoryScore[]): FixItem[] {
  const fixCandidates: FixItem[] = [];

  for (const cat of categories) {
    for (const check of cat.checks) {
      const lost = check.maxPoints - check.pointsEarned;
      if (lost > 0 && check.fixText) {
        let impact: 'High' | 'Medium' | 'Low' = 'Low';
        if (lost >= 5) {
          impact = 'High';
        } else if (lost >= 3) {
          impact = 'Medium';
        }

        fixCandidates.push({
          id: check.id,
          title: check.name,
          category: cat.name,
          pointsLost: Math.round(lost * 10) / 10,
          fix: check.fixText,
          impact
        });
      }
    }
  }

  // Sort descending by pointsLost
  fixCandidates.sort((a, b) => b.pointsLost - a.pointsLost);

  // Return top 3
  return fixCandidates.slice(0, 3);
}

/**
 * Calculates complete AI Search Readiness Score
 */
export function calculateReadinessScore(
  site: ScannedSiteData,
  homeParsed?: ParsedHtml
): {
  score: number;
  band: ReadinessBand;
  categories: {
    crawlability: CategoryScore;
    clarity: CategoryScore;
    qa_content: CategoryScore;
    structured_data: CategoryScore;
  };
  topFixes: FixItem[];
} {
  const crawlability = scoreCrawlability(site, homeParsed);
  const clarity = scoreCompanyClarity(site, homeParsed);
  const qa_content = scoreQuestionAnswering(site, homeParsed);
  const structured_data = scoreStructuredData(site, homeParsed);

  const rawScore = crawlability.earned + clarity.earned + qa_content.earned + structured_data.earned;
  const score = Math.min(100, Math.max(0, Math.round(rawScore)));
  const band = getReadinessBand(score);

  const topFixes = extractTopFixes([crawlability, clarity, qa_content, structured_data]);

  return {
    score,
    band,
    categories: {
      crawlability,
      clarity,
      qa_content,
      structured_data
    },
    topFixes
  };
}
