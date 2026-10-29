/**
 * Dispatches an immediate lead notification alert to Kai.
 * Supports Resend API, Telegram/Slack optional channels, and mock fallback for zero-cost testing.
 */
export async function sendLeadAlert(lead) {
    const alertTo = process.env.ALERT_TO_EMAIL || 'kai@telzasales.com';
    const alertFrom = process.env.ALERT_FROM_EMAIL || 'alerts@check.telzasales.com';
    const apiKey = process.env.EMAIL_API_KEY || process.env.RESEND_API_KEY;
    const scoreText = lead.unreadable_reason
        ? `Unreadable (${lead.unreadable_reason})`
        : `${lead.score} / 100`;
    const emailSubject = `[New Lead] AI Visibility Report Request: ${lead.domain} (Score: ${scoreText})`;
    const emailHtml = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
      <h2 style="color: #111827; margin-bottom: 8px;">New AI Visibility Report Requested</h2>
      <p style="color: #6b7280; font-size: 14px; margin-bottom: 20px;">A prospective client submitted their business email for a manual AI visibility audit.</p>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
        <tr style="border-bottom: 1px solid #f3f4f6;">
          <td style="padding: 10px 0; color: #4b5563; font-weight: 600; width: 140px;">Company Domain:</td>
          <td style="padding: 10px 0; color: #111827;"><a href="${lead.url}" target="_blank" style="color: #4f46e5; text-decoration: underline;">${lead.domain}</a></td>
        </tr>
        <tr style="border-bottom: 1px solid #f3f4f6;">
          <td style="padding: 10px 0; color: #4b5563; font-weight: 600;">Business Email:</td>
          <td style="padding: 10px 0; color: #111827;"><strong>${lead.email}</strong></td>
        </tr>
        <tr style="border-bottom: 1px solid #f3f4f6;">
          <td style="padding: 10px 0; color: #4b5563; font-weight: 600;">Readiness Score:</td>
          <td style="padding: 10px 0; color: #111827;">${scoreText}</td>
        </tr>
        <tr style="border-bottom: 1px solid #f3f4f6;">
          <td style="padding: 10px 0; color: #4b5563; font-weight: 600;">What They Sell:</td>
          <td style="padding: 10px 0; color: #111827;">${lead.what_they_sell || '<em>Not provided</em>'}</td>
        </tr>
        <tr style="border-bottom: 1px solid #f3f4f6;">
          <td style="padding: 10px 0; color: #4b5563; font-weight: 600;">Lead ID:</td>
          <td style="padding: 10px 0; color: #6b7280; font-family: monospace; font-size: 12px;">${lead.id}</td>
        </tr>
        <tr>
          <td style="padding: 10px 0; color: #4b5563; font-weight: 600;">Submitted At:</td>
          <td style="padding: 10px 0; color: #6b7280; font-size: 13px;">${lead.created_at}</td>
        </tr>
      </table>

      <div style="background: #f9fafb; padding: 16px; border-radius: 6px; margin-bottom: 20px;">
        <h4 style="margin: 0 0 8px 0; color: #111827; font-size: 14px;">Next Steps for Kai:</h4>
        <ol style="margin: 0; padding-left: 20px; color: #4b5563; font-size: 13px; line-height: 1.6;">
          <li>Copy lead details into the working results spreadsheet.</li>
          <li>Execute the 6 category + 2 comparison prompts in ChatGPT, Perplexity, and Gemini.</li>
          <li>Export the 1-page PDF report and email it from hello@telzasales.com within 24–48 hours.</li>
        </ol>
      </div>

      <p style="color: #9ca3af; font-size: 12px; margin: 0;">Sent automatically by Telza AI Search Readiness Check (check.telzasales.com).</p>
    </div>
  `;
    // 1. If Resend / Email API key is configured, send live email
    if (apiKey) {
        try {
            const response = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    from: alertFrom,
                    to: [alertTo],
                    subject: emailSubject,
                    html: emailHtml
                })
            });
            if (!response.ok) {
                const errorText = await response.text();
                console.error('[Notifier] Resend email dispatch failed:', errorText);
                return { sent: false, provider: 'failed', error: errorText };
            }
            return { sent: true, provider: 'resend' };
        }
        catch (err) {
            console.error('[Notifier] Exception sending email alert:', err);
            return { sent: false, provider: 'failed', error: err.message };
        }
    }
    // 2. Optional Telegram Webhook
    const tgToken = process.env.TELEGRAM_BOT_TOKEN;
    const tgChatId = process.env.TELEGRAM_CHAT_ID;
    if (tgToken && tgChatId) {
        try {
            const tgMsg = `🚨 *New AI Report Lead*\n\n*Domain:* ${lead.domain}\n*Email:* ${lead.email}\n*Score:* ${scoreText}\n*Note:* ${lead.what_they_sell || 'N/A'}`;
            await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: tgChatId, text: tgMsg, parse_mode: 'Markdown' })
            });
        }
        catch (tgErr) {
            console.warn('[Notifier] Telegram notification failed:', tgErr);
        }
    }
    // 3. Fallback mock driver (for development & unit tests)
    console.log(`[Notifier] Mock Alert Dispatched for ${lead.domain} (${lead.email}) -> ${alertTo}`);
    return { sent: true, provider: 'mock' };
}
