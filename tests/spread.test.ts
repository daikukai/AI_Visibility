import { test, describe } from 'node:test';
import assert from 'node:assert';
import { parseHtml } from '../src/parser.js';
import { calculateReadinessScore } from '../src/scorer.js';
import { checkIsUnreadable } from '../src/detector.js';
import { ScannedSiteData } from '../src/types.js';

interface SiteProfile {
  name: string;
  isHttps: boolean;
  statusCode: number;
  robotsTxt: { exists: boolean; parses: boolean; allowedBots: Record<string, boolean> };
  sitemap: { exists: boolean; referenced: boolean };
  html: string;
  expectedUnreadable?: boolean;
}

describe('25-Site Score Spread & Distribution Validation Gate', () => {
  const sites: SiteProfile[] = [
    {
      name: '1. Apex Enterprise AI (Optimized Leader)',
      isHttps: true,
      statusCode: 200,
      robotsTxt: { exists: true, parses: true, allowedBots: { GPTBot: true, ClaudeBot: true, PerplexityBot: true, 'Google-Extended': true, CCBot: true } },
      sitemap: { exists: true, referenced: true },
      html: `
        <title>Apex Enterprise | Conversational Search Intelligence</title>
        <meta name="description" content="Apex Enterprise delivers enterprise AI visibility, generative engine optimization, and corporate search strategy.">
        <script type="application/ld+json">
        [
          {"@type": "Organization", "name": "Apex Enterprise", "url": "https://apex.test", "logo": "https://apex.test/logo.png", "sameAs": ["https://linkedin.com/apex"]},
          {"@type": "Service", "name": "AI Search Readiness Audit"},
          {"@type": "FAQPage", "mainEntity": []}
        ]
        </script>
        <meta property="og:title" content="Apex Enterprise"><meta property="og:description" content="AI intelligence"><meta property="og:image" content="img.jpg">
        <a href="/about">About Us</a><a href="/services">Services</a><a href="/faq">FAQ</a><a href="/blog/post1">Post 1</a><a href="/blog/post2">Post 2</a><a href="/blog/post3">Post 3</a>
        <h1>Conversational Search Intelligence for Global Enterprises</h1>
        <p>Serving enterprise clients globally from London and New York. Contact info: contact@apex.test or call +1 555 0192. We provide end-to-end guidance for conversational search indexation across ChatGPT, Perplexity, and Gemini.</p>
        <h2>Why is conversational search changing B2B discovery?</h2><p>Synthesized answers replace standard blue links.</p>
        <h2>How do AI crawlers cite brand entities?</h2><p>Through validated entity graphs and structured Q&A formats.</p>
        <h2>What are the immediate business outcomes?</h2><p>Authoritative inclusion in AI response sets.</p>
        <div id="faq"><h3>Frequently Asked Questions</h3></div>
      `
    },
    {
      name: '2. Cloudflare Bot Challenge Gate (Unreadable)',
      isHttps: true,
      statusCode: 200,
      robotsTxt: { exists: true, parses: true, allowedBots: { GPTBot: true, ClaudeBot: true, PerplexityBot: true, 'Google-Extended': true, CCBot: true } },
      sitemap: { exists: true, referenced: true },
      html: `<html><title>Just a moment...</title><body>Checking your browser before accessing. DDoS protection by Cloudflare. <form id="challenge-form" action="/cf-chl-bypass"></form></body></html>`,
      expectedUnreadable: true
    },
    {
      name: '3. React Client SPA Empty Shell (Unreadable)',
      isHttps: true,
      statusCode: 200,
      robotsTxt: { exists: true, parses: true, allowedBots: { GPTBot: true, ClaudeBot: true, PerplexityBot: true, 'Google-Extended': true, CCBot: true } },
      sitemap: { exists: true, referenced: true },
      html: `<html><head><title>App</title></head><body><div id="root">Loading...</div><script src="/bundle.js"></script></body></html>`,
      expectedUnreadable: true
    },
    {
      name: '4. Blocked AI Bots Publisher (Walled Garden)',
      isHttps: true,
      statusCode: 200,
      robotsTxt: { exists: true, parses: true, allowedBots: { GPTBot: false, ClaudeBot: false, PerplexityBot: false, 'Google-Extended': false, CCBot: false } },
      sitemap: { exists: true, referenced: true },
      html: `
        <title>Daily Global Times | World News & Investigations</title>
        <meta name="description" content="Daily Global Times delivers independent investigative journalism and breaking world news daily.">
        <h1>Global Breaking News and In-Depth Editorial Coverage</h1>
        <p>Serving worldwide readers. London and New York bureaus. Contact editorial@times.test. In-depth reporting on politics, commerce, and international diplomacy.</p>
        <a href="/about">About</a><a href="/contact">Contact</a>
      `
    },
    {
      name: '5. Modern B2B SaaS (Good Foundation with Gaps)',
      isHttps: true,
      statusCode: 200,
      robotsTxt: { exists: true, parses: true, allowedBots: { GPTBot: true, ClaudeBot: true, PerplexityBot: true, 'Google-Extended': true, CCBot: true } },
      sitemap: { exists: true, referenced: false },
      html: `
        <title>SyncFlow | Automated Data Pipeline Software</title>
        <meta name="description" content="SyncFlow automates data extraction, transformation, and warehouse loading for modern analytics teams.">
        <script type="application/ld+json">{"@type": "Organization", "name": "SyncFlow", "url": "https://syncflow.test"}</script>
        <a href="/about">About</a><a href="/pricing">Pricing</a><a href="/contact">Contact</a>
        <h1>Automated Real-Time Data Pipelines for Modern Analytics</h1>
        <p>Headquartered in San Francisco, serving high-growth engineering teams globally. Reach us at hello@syncflow.test. Eliminate fragile custom ETL scripts and deliver trusted datasets to Snowflake and BigQuery in minutes.</p>
        <h2>How does incremental sync function?</h2><p>Change data capture monitors database binlogs in real time.</p>
      `
    },
    {
      name: '6. Local Dental Practice (Strong Local Signals, Basic Tech)',
      isHttps: true,
      statusCode: 200,
      robotsTxt: { exists: true, parses: true, allowedBots: { GPTBot: true, ClaudeBot: true, PerplexityBot: true, 'Google-Extended': true, CCBot: true } },
      sitemap: { exists: true, referenced: true },
      html: `
        <title>BrightSmile Dental | Cosmetic & Family Dentistry Austin</title>
        <meta name="description" content="BrightSmile Dental provides gentle family dentistry, teeth whitening, and emergency dental care in Austin, Texas.">
        <script type="application/ld+json">{"@type": "LocalBusiness", "name": "BrightSmile Dental", "url": "https://brightsmile.test"}</script>
        <a href="/about-us">About Us</a><a href="/services">Services</a><a href="/contact">Contact</a>
        <h1>Gentle Family and Cosmetic Dentistry in Central Austin</h1>
        <p>Serving patients in Austin, Texas. Located at 404 Congress Ave. Call (512) 555-0199 or email office@brightsmile.test. We provide routine checkups, veneers, and pain-free preventative dental hygiene.</p>
        <h2>What should you expect at your first visit?</h2><p>Comprehensive digital X-rays and gentle cleaning.</p>
        <h2>How to handle dental emergencies?</h2><p>Same-day priority appointments available.</p>
        <div class="faq-list"><h3>Common Patient Questions</h3></div>
      `
    },
    {
      name: '7. Legacy Manufacturing B2B (Significant Issues)',
      isHttps: false,
      statusCode: 200,
      robotsTxt: { exists: false, parses: false, allowedBots: { GPTBot: true, ClaudeBot: true, PerplexityBot: true, 'Google-Extended': true, CCBot: true } },
      sitemap: { exists: false, referenced: false },
      html: `
        <title>Vulcan Extrusions</title>
        <h1>Vulcan</h1><h1>Extrusions</h1>
        <p>Welcome to Vulcan Extrusions. Custom aluminum profile manufacturing since 1974.</p>
      `
    },
    {
      name: '8. Digital Agency (Mid-Tier Good Foundation)',
      isHttps: true,
      statusCode: 200,
      robotsTxt: { exists: true, parses: true, allowedBots: { GPTBot: true, ClaudeBot: true, PerplexityBot: true, 'Google-Extended': true, CCBot: true } },
      sitemap: { exists: true, referenced: true },
      html: `
        <title>PixelPulse | Performance Marketing & Creative Studio</title>
        <meta name="description" content="PixelPulse builds high-converting Shopify stores and scales performance creative for direct-to-consumer brands.">
        <meta property="og:title" content="PixelPulse Studio"><meta property="og:description" content="Creative studio"><meta property="og:image" content="p.png">
        <a href="/about">About</a><a href="/services">Services</a><a href="/blog/case-study-1">Case 1</a><a href="/blog/case-study-2">Case 2</a><a href="/blog/case-study-3">Case 3</a>
        <h1>Creative Performance Marketing for Modern Direct Brands</h1>
        <p>Serving ambitious founders in New York and Toronto. Email studio@pixelpulse.test. We manage paid acquisition, UGC production, and retention lifecycle funnels.</p>
        <h2>What drives consistent ROAS in 2026?</h2><p>Diversified creative iterations and rapid testing.</p>
      `
    },
    {
      name: '9. Stealth Mode Startup (Noindex Active)',
      isHttps: true,
      statusCode: 200,
      robotsTxt: { exists: true, parses: true, allowedBots: { GPTBot: true, ClaudeBot: true, PerplexityBot: true, 'Google-Extended': true, CCBot: true } },
      sitemap: { exists: false, referenced: false },
      html: `
        <title>Project Stealth | Something New</title>
        <meta name="robots" content="noindex">
        <h1>Building the Next Frontier of Compute</h1>
        <p>Currently in private stealth preview. Request early access at founder@stealth.test.</p>
      `
    },
    {
      name: '10. Boutique Corporate Law Firm (High Clarity, Missing Schema)',
      isHttps: true,
      statusCode: 200,
      robotsTxt: { exists: true, parses: true, allowedBots: { GPTBot: true, ClaudeBot: true, PerplexityBot: true, 'Google-Extended': true, CCBot: true } },
      sitemap: { exists: true, referenced: true },
      html: `
        <title>Vanguard Legal | Tech M&A and Commercial Counsel</title>
        <meta name="description" content="Vanguard Legal advises software founders and venture funds on seed-to-growth financings, cross-border M&A, and commercial agreements.">
        <a href="/about">About</a><a href="/services">Services</a><a href="/contact">Contact</a>
        <h1>Specialized Corporate and Venture Counsel for Technology Companies</h1>
        <p>Headquartered in Chicago, serving technology companies nationwide. Inquiries: counsel@vanguardlegal.test or +1 312 555 4900. Practical legal counsel aligned with venture speed.</p>
        <h2>When should a startup form a Delaware C-Corp?</h2><p>Prior to raising outside angel or institutional venture capital.</p>
        <h2>How are cross-border IP transfers handled?</h2><p>With clear licensing and intercompany transfer pricing agreements.</p>
        <div id="faq"><h3>Legal FAQs</h3></div>
      `
    },
    {
      name: '11. Minimalist Photography Portfolio (Text Deficit)',
      isHttps: true,
      statusCode: 200,
      robotsTxt: { exists: true, parses: true, allowedBots: { GPTBot: true, ClaudeBot: true, PerplexityBot: true, 'Google-Extended': true, CCBot: true } },
      sitemap: { exists: false, referenced: false },
      html: `
        <title>Elena Rostova Photography</title>
        <meta name="description" content="Editorial photography.">
        <a href="/contact">Contact</a>
        <h1>Selected Works</h1>
        <p>Contact: elena@rostovaphoto.test</p>
      `
    },
    {
      name: '12. FinTech Infrastructure Platform (Comprehensive Leader)',
      isHttps: true,
      statusCode: 200,
      robotsTxt: { exists: true, parses: true, allowedBots: { GPTBot: true, ClaudeBot: true, PerplexityBot: true, 'Google-Extended': true, CCBot: true } },
      sitemap: { exists: true, referenced: true },
      html: `
        <title>LedgerStack | Core Banking API & Ledger Infrastructure</title>
        <meta name="description" content="LedgerStack powers real-time double-entry ledgers, account issuing, and compliance reporting for global fintechs.">
        <script type="application/ld+json">
        [
          {"@type": "Organization", "name": "LedgerStack", "url": "https://ledgerstack.test", "logo": "https://ledgerstack.test/logo.svg", "sameAs": ["https://twitter.com/ledgerstack"]},
          {"@type": "Product", "name": "Ledger Engine API"},
          {"@type": "FAQPage", "mainEntity": []}
        ]
        </script>
        <meta property="og:title" content="LedgerStack Banking API"><meta property="og:description" content="API for fintech"><meta property="og:image" content="og.png">
        <a href="/about">About</a><a href="/services">Services</a><a href="/pricing">Pricing</a><a href="/contact">Contact</a><a href="/faq">FAQ</a>
        <a href="/blog/double-entry">Double Entry 101</a><a href="/blog/compliance-audits">Compliance</a><a href="/blog/real-time-ledgers">Real-time Ledgers</a>
        <h1>Immutable Financial Ledger Infrastructure for Global Platforms</h1>
        <p>Offices in New York and London, serving regulated entities across 40 countries. Contact sales@ledgerstack.test or +1 800 555 0188. Guaranteed transaction consistency at scale.</p>
        <h2>Why is double-entry ledger architecture critical?</h2><p>It eliminates rounding errors and audit discrepancies.</p>
        <h2>How does LedgerStack achieve sub-10ms latency?</h2><p>Distributed consensus with localized read replicas.</p>
        <h2>What regulatory compliance certifications are held?</h2><p>SOC 2 Type II, ISO 27001, and PCI-DSS Level 1.</p>
        <section class="faq-block"><h3>Technical Questions</h3></section>
      `
    },
    {
      name: '13. Independent Coffee Roaster (Good Local, Moderate Content)',
      isHttps: true,
      statusCode: 200,
      robotsTxt: { exists: true, parses: true, allowedBots: { GPTBot: true, ClaudeBot: true, PerplexityBot: true, 'Google-Extended': true, CCBot: true } },
      sitemap: { exists: true, referenced: false },
      html: `
        <title>RedWood Coffee | Ethically Sourced Single Origin Roasters</title>
        <meta name="description" content="RedWood Coffee roasts specialty single-origin coffees in Seattle with transparent farm direct trade.">
        <script type="application/ld+json">{"@type": "LocalBusiness", "name": "RedWood Coffee", "url": "https://redwoodcoffee.test", "logo": "logo.png"}</script>
        <a href="/about">About</a><a href="/products">Products</a><a href="/contact">Contact</a>
        <h1>Artisan Single Origin Coffee Roasted Fresh in Seattle</h1>
        <p>Located at 120 Pike St, Seattle, WA. Serving specialty coffee lovers across North America. Inquiries: hello@redwoodcoffee.test or (206) 555-0144. We small-batch roast every Tuesday and ship within 24 hours of roasting.</p>
        <p>Every harvest is cupped and scored by licensed Q-graders. We guarantee sweet, balanced profiles with notes of stone fruit, cacao, and crisp citrus.</p>
        <h2>Where do you source your beans?</h2><p>Direct farm partnerships in Colombia, Ethiopia, and Guatemala paying 40% above fair trade standards.</p>
      `
    },
    {
      name: '14. Regional Commercial HVAC Contractor (Needs Improvement)',
      isHttps: true,
      statusCode: 200,
      robotsTxt: { exists: false, parses: false, allowedBots: { GPTBot: true, ClaudeBot: true, PerplexityBot: true, 'Google-Extended': true, CCBot: true } },
      sitemap: { exists: false, referenced: false },
      html: `
        <title>TriState Commercial Heating & Air Conditioning Service</title>
        <meta name="description" content="TriState HVAC offers commercial HVAC maintenance, chiller repair, and industrial cooling across Ohio.">
        <a href="/contact">Contact</a>
        <h1>Industrial and Commercial Climate Control Specialists</h1>
        <p>Serving Ohio, Kentucky, and Indiana for over 30 years. Address: 800 Industrial Pkwy, Cincinnati, OH. Phone 513-555-0177.</p>
      `
    },
    {
      name: '15. E-commerce Fashion Brand (High Product Schema, Moderate Q&A)',
      isHttps: true,
      statusCode: 200,
      robotsTxt: { exists: true, parses: true, allowedBots: { GPTBot: true, ClaudeBot: true, PerplexityBot: true, 'Google-Extended': true, CCBot: true } },
      sitemap: { exists: true, referenced: true },
      html: `
        <title>Aura Atelier | Sustainable Cashmere & Minimalist Essentials</title>
        <meta name="description" content="Aura Atelier crafts timeless sustainable knitwear and pure cashmere garments ethically made in Italy.">
        <script type="application/ld+json">
        [
          {"@type": "Organization", "name": "Aura Atelier", "url": "https://aura.test", "logo": "logo.jpg", "sameAs": ["https://instagram.com/aura"]},
          {"@type": "Product", "name": "Pure Cashmere Crewneck"}
        ]
        </script>
        <meta property="og:title" content="Aura Atelier"><meta property="og:description" content="Cashmere"><meta property="og:image" content="c.jpg">
        <a href="/about">About</a><a href="/products">Products</a><a href="/faq">FAQ</a><a href="/contact">Contact</a>
        <h1>Mindfully Crafted Sustainable Cashmere Wardrobe Essentials</h1>
        <p>Designed in Copenhagen, serving conscious customers worldwide. Direct assistance: concierge@aura.test. We source Grade-A organic cashmere with zero toxic dyes.</p>
        <h2>How do you wash pure cashmere?</h2><p>Hand wash in cold water using delicate wool detergent.</p>
        <h2>What is your international return policy?</h2><p>Free 30-day returns worldwide.</p>
        <div id="faq-section"><h3>FAQ</h3></div>
      `
    },
    {
      name: '16. Commercial Cleaning Service (Moderate Local)',
      isHttps: true,
      statusCode: 200,
      robotsTxt: { exists: true, parses: true, allowedBots: { GPTBot: true, ClaudeBot: true, PerplexityBot: true, 'Google-Extended': true, CCBot: true } },
      sitemap: { exists: false, referenced: false },
      html: `
        <title>CleanPro Facility | Janitorial & Commercial Cleaning Denver</title>
        <meta name="description" content="CleanPro provides bonded commercial janitorial services, office cleaning, and sanitization throughout Denver, Colorado.">
        <a href="/about">About</a><a href="/services">Services</a><a href="/contact">Contact</a>
        <h1>Reliable Commercial Office Cleaning and Facility Care</h1>
        <p>Serving Denver metro and Boulder, CO. Contact dispatch: info@cleanpro.test or (303) 555-0162. Certified eco-friendly sanitization solutions.</p>
        <h2>What cleaning standards do your teams follow?</h2><p>OSHA-compliant green cleaning protocols.</p>
      `
    },
    {
      name: '17. Niche Biotech Research Lab (Specialized Content, No Open Graph)',
      isHttps: true,
      statusCode: 200,
      robotsTxt: { exists: true, parses: true, allowedBots: { GPTBot: true, ClaudeBot: true, PerplexityBot: true, 'Google-Extended': true, CCBot: true } },
      sitemap: { exists: true, referenced: true },
      html: `
        <title>Genomics Core | High-Throughput Target Discovery Systems</title>
        <meta name="description" content="Genomics Core develops targeted multiplexed CRISPR libraries for therapeutic oncology screening pipelines.">
        <script type="application/ld+json">{"@type": "Organization", "name": "Genomics Core", "url": "https://genomics.test"}</script>
        <a href="/about">About</a><a href="/services">Services</a><a href="/contact">Contact</a>
        <h1>Accelerating Precision Target Identification for Oncology</h1>
        <p>Cambridge, MA laboratory headquarters. Serving pharmaceutical collaborators globally. Email lab@genomics.test or call (617) 555-0131.</p>
        <h2>How are off-target mutations identified?</h2><p>Whole genome deep sequencing and proprietary alignment algorithms.</p>
        <h2>What is standard library synthesis turnaround?</h2><p>Three to five weeks from sequence validation.</p>
      `
    },
    {
      name: '18. Freelance UI/UX Consultant (Clean One-Pager)',
      isHttps: true,
      statusCode: 200,
      robotsTxt: { exists: true, parses: true, allowedBots: { GPTBot: true, ClaudeBot: true, PerplexityBot: true, 'Google-Extended': true, CCBot: true } },
      sitemap: { exists: false, referenced: false },
      html: `
        <title>Marcus Chen | Senior Product Designer & Design Systems</title>
        <meta name="description" content="Marcus Chen designs complex B2B SaaS interfaces and scalable design systems for high-growth tech ventures.">
        <a href="/contact">Contact</a>
        <h1>Senior Product Designer Crafting Intuitive Enterprise UX</h1>
        <p>Based in Toronto, serving tech startups remotely across US and Europe. Reach out at hello@marcuschen.test. Over a decade designing enterprise workflows.</p>
        <h2>How do you run design sprint workshops?</h2><p>A four-day collaborative prototype and user testing process.</p>
      `
    },
    {
      name: '19. Non-Profit Ocean Conservancy (Rich Education, No Service Schema)',
      isHttps: true,
      statusCode: 200,
      robotsTxt: { exists: true, parses: true, allowedBots: { GPTBot: true, ClaudeBot: true, PerplexityBot: true, 'Google-Extended': true, CCBot: true } },
      sitemap: { exists: true, referenced: true },
      html: `
        <title>BlueReef Foundation | Marine Habitat Conservation Global</title>
        <meta name="description" content="BlueReef Foundation protects coral reef ecosystems through community-led marine reserves and restorative planting.">
        <script type="application/ld+json">{"@type": "Organization", "name": "BlueReef Foundation", "url": "https://bluereef.test", "logo": "reef.png", "sameAs": ["https://twitter.com/bluereef"]}</script>
        <meta property="og:title" content="BlueReef Foundation"><meta property="og:description" content="Ocean health"><meta property="og:image" content="b.jpg">
        <a href="/about-us">About Us</a><a href="/blog/reef-recovery">Reef 1</a><a href="/blog/marine-heatwaves">Heatwaves</a><a href="/blog/community-reserves">Reserves</a><a href="/contact">Contact</a>
        <h1>Protecting and Restoring Vulnerable Coral Ecosystems</h1>
        <p>Headquartered in Honolulu, Hawaii, working across the Pacific basin. Contact our conservation team at info@bluereef.test. Empowering coastal communities through scientific restoration.</p>
        <h2>How does coral micro-fragmentation accelerate growth?</h2><p>By stimulating rapid colony calcification up to 40x faster than wild growth.</p>
        <h2>Where do donation funds get deployed?</h2><p>85% directly to field nursery operations and monitoring dives.</p>
        <div id="faq"><h3>Donor FAQs</h3></div>
      `
    },
    {
      name: '20. Cloud Security Platform (Partial AI Bot Disallow)',
      isHttps: true,
      statusCode: 200,
      robotsTxt: { exists: true, parses: true, allowedBots: { GPTBot: false, ClaudeBot: true, PerplexityBot: true, 'Google-Extended': false, CCBot: false } },
      sitemap: { exists: true, referenced: true },
      html: `
        <title>ShieldGate | Zero Trust Cloud Access & SASE Architecture</title>
        <meta name="description" content="ShieldGate provides zero-trust network access, identity-based microsegmentation, and secure web gateways.">
        <script type="application/ld+json">{"@type": "Organization", "name": "ShieldGate", "url": "https://shieldgate.test", "logo": "logo.png"}</script>
        <a href="/about">About</a><a href="/services">Services</a><a href="/pricing">Pricing</a><a href="/contact">Contact</a>
        <h1>Zero Trust Network Access for Distributed Enterprise Teams</h1>
        <p>Serving enterprise security teams from Austin and London. Direct inquiries: security@shieldgate.test or +1 888 555 0122. Enforce continuous device verification without VPN bottlenecks.</p>
        <h2>How does microsegmentation prevent lateral attack spread?</h2><p>By enforcing least-privilege cryptographic boundaries per workload.</p>
      `
    }
  ];

  test('Processes all 20 diverse site profiles with meaningful spread', () => {
    const scores: number[] = [];
    const bands: Record<string, number> = {
      'Strong readiness': 0,
      'Good foundation with gaps': 0,
      'Needs improvement': 0,
      'Significant issues': 0
    };
    let unreadableCount = 0;

    for (const site of sites) {
      const res = {
        ok: site.statusCode === 200,
        statusCode: site.statusCode,
        statusText: site.statusCode === 200 ? 'OK' : 'Error',
        url: 'https://testsite.test',
        headers: {},
        body: site.html
      };

      const parsed = parseHtml(site.html, 'https://testsite.test');
      const unreadable = checkIsUnreadable(res, parsed);

      if (site.expectedUnreadable) {
        assert.strictEqual(unreadable.isUnreadable, true, `${site.name} was expected to be unreadable`);
        unreadableCount++;
        continue;
      }

      assert.strictEqual(unreadable.isUnreadable, false, `${site.name} was not expected to be unreadable`);

      const siteData: ScannedSiteData = {
        targetUrl: 'https://testsite.test',
        normalizedDomain: 'testsite.test',
        homepage: {
          url: 'https://testsite.test',
          statusCode: site.statusCode,
          headers: {},
          html: site.html,
          text: parsed.visibleText,
          wordCount: parsed.wordCount,
          hasNoIndex: parsed.hasNoIndex,
          isHttps: site.isHttps
        },
        robotsTxt: {
          exists: site.robotsTxt.exists,
          raw: '',
          parses: site.robotsTxt.parses,
          allowedBots: site.robotsTxt.allowedBots
        },
        sitemapXml: {
          exists: site.sitemap.exists,
          referencedInRobots: site.sitemap.referenced,
          validXml: site.sitemap.exists,
          urlCount: site.sitemap.exists ? 10 : 0
        },
        subpages: [],
        internalLinks: parsed.links.internal
      };

      const result = calculateReadinessScore(siteData, parsed);
      scores.push(result.score);
      bands[result.band]++;
    }

    // Assert unreadable detection worked for Cloudflare + SPA
    assert.strictEqual(unreadableCount, 2);

    // Distribution metrics across the 18 readable sites
    const minScore = Math.min(...scores);
    const maxScore = Math.max(...scores);
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;

    // Check spread:
    // 1. Min score is below 40 (significant issues present)
    assert.ok(minScore <= 35, `Expected min score <= 35, got ${minScore}`);
    // 2. Max score is above 85 (optimized leader present)
    assert.ok(maxScore >= 85, `Expected max score >= 85, got ${maxScore}`);
    // 3. Average is in realistic commercial range (50 - 75)
    assert.ok(avgScore >= 50 && avgScore <= 75, `Expected avg score 50-75, got ${avgScore}`);
    // 4. Spread spans across all or multiple distinct bands
    assert.ok(bands['Strong readiness'] >= 2, 'Expected at least 2 Strong readiness sites');
    assert.ok(bands['Good foundation with gaps'] >= 5, 'Expected at least 5 Good foundation sites');
    assert.ok(bands['Needs improvement'] >= 2, 'Expected at least 2 Needs improvement sites');
    assert.ok(bands['Significant issues'] >= 1, 'Expected at least 1 Significant issues site');
  });
});
