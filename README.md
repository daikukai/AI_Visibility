# Telza Sales: AI Search Readiness Check

A public, high-converting lead generation tool for Telza Sales (`check.telzasales.com`).

- **Live URL:** `https://check.telzasales.com`
- **Hosting:** Netlify (Free Plan, separate Netlify site)
- **DNS:** Namecheap (`check` CNAME record)
- **Primary Goal:** Instant 0–100 AI Search Readiness score + top 3 fixes &rarr; Business email capture for a 24–48h manual visibility report prepared by Kai.

---

## Architecture Overview

```text
Browser (check.telzasales.com)
  |  POST /.netlify/functions/scan  { url, turnstileToken }
  v
Netlify Function: scan
  - URL Normalization & SSRF Pre-check (DNS resolution, private/loopback/cloud metadata IP guard)
  - 24-Hour Scan Cache (Netlify Blobs)
  - Safe Parallel Fetch (5s timeout, 1MB size cap, max 3 redirect hops re-validated)
  - Rule-Based 4-Pillar Scoring (Crawlability, Clarity, Q&A Content, Structured Data)
  - "Couldn't read site" detection (403, 429, 503, Cloudflare challenge, or JS-only SPA empty shells)
  - Returns: { readable, score, band, categories, topFixes }
  |
Visitor inputs Business Email
  |  POST /.netlify/functions/lead  { email, domain, score, what_they_sell, consent, turnstileToken }
  v
Netlify Function: lead
  - Business Email Filter (rejects @gmail, @yahoo, @outlook, and 20+ disposable domains)
  - Honeypot Anti-Spam Trap
  - Stores Record in Netlify Blobs ('leads' store)
  - Dispatches Instant Alert Email to Kai (Resend API)
```

---

## 4 Scoring Categories (25 Pts Each = 100 Total)

1. **Crawlability (25 pts)**: HTTPS 200 (4), valid `robots.txt` (3), AI bots allowed: GPTBot, ClaudeBot, PerplexityBot, Google-Extended, CCBot (8), `sitemap.xml` declaration (4), raw HTML content $\ge$ 300 words (4), no `noindex` (2).
2. **Company Clarity (25 pts)**: Single descriptive `h1` $\ge$ 3 words (5), calibrated meta description 70–160 chars (5), brand + descriptor title tag (4), About page navigation (4), verified contact channels (4), physical/service area presence (3).
3. **Question-Answering Content (25 pts)**: FAQ section or dedicated page (7), $\ge$ 3 question headings ending in "?" (6), active blog/resources section $\ge$ 3 posts (6), dedicated service or pricing architecture (6).
4. **Structured Data (25 pts)**: Valid JSON-LD block (5), Organization / LocalBusiness entity with name and URL (6), brand logo and `sameAs` social profiles (4), Service / Product markup (5), `FAQPage` markup (3), Open Graph tags (2).

**Score Bands:**
- **80–100**: *Strong readiness*
- **60–79**: *Good foundation with gaps*
- **40–59**: *Needs improvement*
- **0–39**: *Significant issues*

---

## Directory Structure

```text
├── netlify/
│   └── functions/
│       ├── scan.ts              # Netlify serverless scan endpoint with 24h caching
│       └── lead.ts              # Netlify serverless lead capture & alert endpoint
├── public/
│   ├── index.html               # Main public app UI
│   ├── style.css                # Responsive modern dark styling
│   ├── app.js                   # State controller & animation engine
│   ├── about-scanner.html       # Crawler transparency policy for webmasters
│   ├── privacy.html             # GDPR / UK GDPR compliant privacy notice
│   └── _redirects               # Netlify API routing
├── src/
│   ├── ssrf.ts                  # SSRF validator blocking private IPs, LAN, metadata
│   ├── fetcher.ts               # Safe HTTP client with redirect hop re-checking
│   ├── parser.ts                # Cheerio HTML & JSON-LD parser
│   ├── detector.ts              # Unreadable & SPA empty shell detector
│   ├── scorer.ts                # Rule-based scoring engine & top fixes
│   ├── emailValidator.ts        # Corporate email filter & MX resolver
│   ├── storage.ts               # Netlify Blobs dual-mode storage adapter
│   ├── notifier.ts              # Alert dispatcher (Resend API / Telegram)
│   ├── rateLimiter.ts           # Hashed-IP rate limiter (GDPR safe)
│   └── turnstile.ts             # Cloudflare Turnstile token verifier
├── tests/
│   ├── ssrf.test.ts             # 8 SSRF attack vector unit tests
│   ├── detector.test.ts         # 6 Unreadable state unit tests
│   ├── scorer.test.ts           # 6 Scoring engine unit tests
│   ├── spread.test.ts           # 20 diverse commercial profiles validation gate
│   ├── live_scan.test.ts        # Real-world network scan integration test
│   ├── lead.test.ts             # 9 Lead capture and Blobs storage tests
│   └── abuse.test.ts            # 6 Rate limiting & Turnstile abuse tests
├── toolkit/
│   ├── question_templates.md    # Kai's prompt library across 5 sectors
│   ├── results_and_leads_template.csv # Results matrix & leads tracking sheet
│   ├── report_template.html     # 1-Page client printable / PDF report
│   └── protocol_and_sop.md      # 15-minute execution SOP
├── netlify.toml                 # Netlify deployment configuration
└── package.json
```

---

## Environment Variables & Secrets (Netlify Site Settings)

Add these in **Netlify Dashboard &rarr; Site configuration &rarr; Environment variables**:

| Variable | Description |
| :--- | :--- |
| `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile secret key (for server-side token verification). |
| `EMAIL_API_KEY` | Resend API key (e.g. `re_...`) for automated lead alerts to Kai. |
| `ALERT_TO_EMAIL` | Recipient email for lead notifications (default: `kai@telzasales.com`). |
| `ALERT_FROM_EMAIL` | Verified sender domain (e.g. `alerts@check.telzasales.com` or `hello@telzasales.com`). |
| `IP_HASH_SALT` | Secret random salt for hashing visitor IP addresses in the rate limiter. |
| `TELEGRAM_BOT_TOKEN` | *(Optional)* Telegram bot token for instant phone alerts. |
| `TELEGRAM_CHAT_ID` | *(Optional)* Telegram chat ID for instant phone alerts. |

---

## Deployment Instructions

### 1. Connect Repo to Netlify
1. Create a new site in Netlify linked to this repository.
2. Build settings:
   - **Publish directory:** `public`
   - **Functions directory:** `netlify/functions`
   - **Build command:** `npm run build`

### 2. Configure Subdomain DNS in Namecheap
1. Go to **Namecheap &rarr; Domain List &rarr; Manage &rarr; Advanced DNS**.
2. Add a new **CNAME Record**:
   - **Host:** `check`
   - **Value:** `<your-site-name>.netlify.app`
   - **TTL:** Automatic
3. In Netlify &rarr; **Domain Management**, add custom domain: `check.telzasales.com`. Netlify will automatically provision a free Let's Encrypt SSL certificate once DNS resolves.

---

## Testing Commands

Run the full automated test suite:
```bash
npm run test:run
```

Verify clean TypeScript compilation:
```bash
npm run build
```
