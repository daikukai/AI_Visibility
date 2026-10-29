import dns from 'node:dns/promises';

export interface EmailValidationResult {
  valid: boolean;
  reason?: string;
  normalizedEmail?: string;
  domain?: string;
}

// Blocked personal & free webmail providers
export const FREE_WEBMAIL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com',
  'yahoo.com', 'yahoo.co.uk', 'yahoo.fr', 'yahoo.de', 'yahoo.es', 'yahoo.com.br',
  'hotmail.com', 'hotmail.co.uk', 'hotmail.fr', 'hotmail.de',
  'outlook.com', 'outlook.co.uk', 'live.com', 'msn.com',
  'icloud.com', 'me.com', 'mac.com',
  'aol.com', 'aim.com',
  'mail.com', 'email.com',
  'proton.me', 'protonmail.com', 'pm.me',
  'zoho.com',
  'yandex.com', 'yandex.ru',
  'gmx.com', 'gmx.net', 'gmx.de',
  'tutanota.com', 'tutamail.com',
  'fastmail.com'
]);

// Blocked disposable / temporary email domains
export const DISPOSABLE_EMAIL_DOMAINS = new Set([
  'mailinator.com', 'guerrillamail.com', '10minutemail.com', 'tempmail.com',
  'temp-mail.org', 'throwawaymail.com', 'yopmail.com', 'sharklasers.com',
  'dispostable.com', 'getairmail.com', 'mohmal.com', 'fakeinbox.com',
  'trashmail.com', 'mytemp.email', 'tempail.com', 'burnermail.io'
]);

/**
 * Validates whether an email is a legitimate business email address.
 * Rejects personal webmail, disposable services, and unresolvable domains.
 */
export async function validateBusinessEmail(
  rawEmail: string,
  options: { checkMx?: boolean } = { checkMx: true }
): Promise<EmailValidationResult> {
  if (!rawEmail || typeof rawEmail !== 'string') {
    return { valid: false, reason: 'Email address is required.' };
  }

  const email = rawEmail.trim().toLowerCase();

  // Basic RFC syntax check
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  if (!emailRegex.test(email) || email.length > 254) {
    return { valid: false, reason: 'Invalid email address format.' };
  }

  const parts = email.split('@');
  if (parts.length !== 2) {
    return { valid: false, reason: 'Invalid email format.' };
  }

  const [localPart, domain] = parts;

  // Local part constraints
  if (localPart.length > 64) {
    return { valid: false, reason: 'Email username is too long.' };
  }

  // Check against free webmail providers
  if (FREE_WEBMAIL_DOMAINS.has(domain)) {
    return {
      valid: false,
      reason: 'Please use your official company/work email. Personal webmail (Gmail, Yahoo, Outlook, etc.) is not accepted.',
      domain
    };
  }

  // Check against disposable temporary domains
  if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) {
    return {
      valid: false,
      reason: 'Temporary and disposable email addresses are not accepted.',
      domain
    };
  }

  // MX record lookup (optional or when network permits)
  if (options.checkMx) {
    try {
      const mxRecords = await dns.resolveMx(domain);
      if (!mxRecords || mxRecords.length === 0) {
        return {
          valid: false,
          reason: `Domain ${domain} does not have valid mail exchange (MX) records.`,
          domain
        };
      }
    } catch (err: any) {
      // In air-gapped or test environments, if domain fails resolution, flag domain
      if (err.code === 'ENOTFOUND' || err.code === 'ENODATA') {
        return {
          valid: false,
          reason: `Domain ${domain} has no active mail server (MX record not found).`,
          domain
        };
      }
    }
  }

  return {
    valid: true,
    normalizedEmail: email,
    domain
  };
}
