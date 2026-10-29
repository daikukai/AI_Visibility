# Kai's Standard Operating Procedure (SOP): 15-Minute Manual AI Visibility Audit

**Target Time Budget:** 15–20 minutes per report  
**Delivery SLA:** Within 24–48 hours of lead submission  
**Sender Mailbox:** Personal inbox (`hello@telzasales.com` or `kai@telzasales.com`)  
**Format:** 1-Page PDF attachment + short personalized email body  

---

## 1. Setup & Environment (Minute 0–2)
1. **Open the Lead Record:**
   - Retrieve the lead details from your alert email or the leads store.
   - Note the **Target Domain**, **Automated Readiness Score**, and **"What They Sell" note** (if provided).
2. **Open the 4 Target AI Engines in Clean Browser Windows:**
   - [ChatGPT Search](https://chatgpt.com) (logged in or incognito)
   - [Perplexity Pro](https://perplexity.ai) (default search model)
   - [Google Gemini](https://gemini.google.com)
   - [Claude 3.5 Sonnet](https://claude.ai)
3. **Open the Results Spreadsheet (`toolkit/results_and_leads_template.csv`):**
   - Record the audit date, auditor (Kai), and logging state.

---

## 2. Prompt Selection & Execution (Minute 2–10)
From `toolkit/question_templates.md`, select the matching industry template (Agency, SaaS, Local, E-commerce, or Manufacturing):
- **4 Category Discovery Prompts:** Paste each prompt into the 4 engines. Observe if the target company is mentioned or cited in the footnotes.
- **1 Comparison Prompt:** Test the target company head-to-head against a known competitor.
- **1 Brand Entity Prompt:** Test what the AI engine knows about the target company's offering and reputation.

### How to Score in the Sheet:
- **Cited (Linked):** The AI engine mentions the brand and includes a clickable footnote link to their domain.
- **Mentioned:** The AI engine writes the brand name in the text response without a link.
- **Absent:** The AI does not mention the brand (and recommends competitors instead).

---

## 3. Populate Report & Export PDF (Minute 10–15)
1. **Open `toolkit/report_template.html` in Chrome/Edge:**
   - The file is `contenteditable="true"` — click directly on text fields to customize:
     - Replace the domain with the client's domain.
     - Update the readiness score & band.
     - Fill the 6-question matrix with your findings (`Cited`, `Mentioned`, or `Absent`).
     - List the top 2–3 competitors that AI engines repeatedly cited.
     - Copy/paste a brief excerpt of how AI engines currently describe their offering.
     - Adjust the top 3 actionable fixes.
2. **Select the Right CTA Button:**
   - **Low Score (< 50) or Unreadable Site:** CTA -> **"Book Strategy Call"** (`https://telzasales.com/book`)
   - **Mid Score (50–79):** CTA -> **"Get Implementation Quote"** (`https://telzasales.com/quote`)
   - **High Score (80–100):** CTA -> **"Schedule Ongoing Monitoring Review"** (`https://telzasales.com/book`)
3. **Export to PDF:**
   - Press `Ctrl + P` (or `Cmd + P`).
   - Destination: **Save as PDF**.
   - Margins: Default.
   - Headers and Footers: Uncheck.
   - Save file as `AI_Visibility_Report_[Domain].pdf`.

---

## 4. Send Email to Lead (Minute 15–18)
Send from your own personal mailbox (`hello@telzasales.com`) with the PDF attached.

### Email Template:
```text
Subject: Your AI Visibility Report for [Domain] (ChatGPT, Perplexity, Gemini)

Hi [First Name or Team],

Thanks for requesting an AI Visibility check on check.telzasales.com.

I've manually run [Domain] through ChatGPT Search, Perplexity Pro, Google Gemini, and Claude 3.5 across 6 buyer queries and competitor comparison prompts.

Attached is your 1-page report: AI_Visibility_Report_[Domain].pdf

A few key takeaways:
1. Technical Readiness: Your website scored [Score]/100 on automated crawling and structured data signals.
2. AI Search Citations: When prospective buyers ask for recommendations in your category, AI engines currently mention your brand in [X]% of queries, while competitors like [Competitor 1] and [Competitor 2] capture the majority of conversational citations.
3. Quickest Fix: [1 concise high-impact recommendation, e.g. "Deploying FAQPage schema markup and an unbranded comparison guide will immediately help Perplexity index your key specs."]

If you'd like to walk through the findings and see how we help companies close these citation gaps, feel free to book a short 20-minute chat here:
https://telzasales.com/book

Best regards,

Kai
Founder, Telza Sales
telzasales.com
```

---

## 5. Follow-Up Cadence & Status Logging
- **Immediately after sending:** Update the lead status in your spreadsheet to `report_sent` with today's date.
- **Day 3 Follow-Up (if no reply):** Send a 2-line direct reply:
  > *"Hi [Name], just checking if you had a chance to review the AI visibility report I sent over for [Domain]. Did the citation gaps in Perplexity match what you're seeing from inbound leads?"*
- **Day 10 Follow-Up (Final):**
  > *"Hi [Name], one quick observation: we just saw Perplexity update its citation index for [their sector]. If you'd like to review the specific fix for your schema markup, let me know. Either way, hope the audit was helpful!"*
- **If they reply or request removal:** Stop automated cadence immediately.
