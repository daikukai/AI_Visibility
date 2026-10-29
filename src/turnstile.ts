export interface TurnstileVerificationResult {
  valid: boolean;
  error?: string;
  hostname?: string;
}

/**
 * Validates a Cloudflare Turnstile token server-side.
 * If TURNSTILE_SECRET_KEY is not configured (e.g. in test or local dev),
 * the validation is bypassed gracefully so tests run without mock friction.
 */
export async function verifyTurnstileToken(
  token?: string,
  remoteIp?: string
): Promise<TurnstileVerificationResult> {
  const secretKey = process.env.TURNSTILE_SECRET_KEY;

  // Graceful bypass in development or test environments without secrets
  if (!secretKey) {
    return { valid: true };
  }

  if (!token) {
    return {
      valid: false,
      error: 'Bot verification token is missing. Please complete the security check.'
    };
  }

  try {
    const formData = new URLSearchParams();
    formData.append('secret', secretKey);
    formData.append('response', token);
    if (remoteIp) {
      formData.append('remoteip', remoteIp);
    }

    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: formData,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    const outcome: any = await response.json();

    if (outcome.success) {
      return {
        valid: true,
        hostname: outcome.hostname
      };
    }

    const errorCodes = outcome['error-codes']?.join(', ') || 'Verification failed';
    return {
      valid: false,
      error: `Security verification failed: ${errorCodes}`
    };
  } catch (err: any) {
    console.error('[Turnstile] Verification exception:', err);
    return {
      valid: false,
      error: 'Security challenge service temporarily unreachable.'
    };
  }
}
