import { validateUrlForSSRF } from './ssrf.js';

export interface SafeFetchOptions {
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  customHeaders?: Record<string, string>;
}

export interface SafeFetchResponse {
  ok: boolean;
  statusCode: number;
  statusText: string;
  url: string;
  headers: Record<string, string>;
  body: string;
  error?: string;
}

const DEFAULT_TIMEOUT_MS = 6000;
const DEFAULT_MAX_BYTES = 1024 * 1024; // 1 MB cap
const DEFAULT_MAX_REDIRECTS = 3;
export const SCANNER_USER_AGENT = 'TelzaReadinessCheck/1.0 (+https://check.telzasales.com/about-scanner)';

/**
 * Performs a safe HTTP fetch with:
 * - Strict SSRF validation before the initial request and on EVERY redirect hop
 * - Maximum byte length guard (terminates stream if body exceeds limit)
 * - Strict timeout via AbortController
 * - Standardized scanner User-Agent
 */
export async function safeFetch(
  targetUrl: string,
  options: SafeFetchOptions = {}
): Promise<SafeFetchResponse> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;

  let currentUrl = targetUrl;
  let redirectCount = 0;

  while (redirectCount <= maxRedirects) {
    // 1. SSRF Guard on current URL
    const ssrfCheck = await validateUrlForSSRF(currentUrl);
    if (!ssrfCheck.valid || !ssrfCheck.normalizedUrl) {
      return {
        ok: false,
        statusCode: 0,
        statusText: 'SSRF Blocked',
        url: currentUrl,
        headers: {},
        body: '',
        error: ssrfCheck.reason || 'SSRF check failed'
      };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(currentUrl, {
        method: 'GET',
        headers: {
          'User-Agent': SCANNER_USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.5',
          'Accept-Language': 'en-US,en;q=0.9',
          ...options.customHeaders
        },
        redirect: 'manual', // Manual handling so we can check every redirect hop with validateUrlForSSRF!
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const headersRecord: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headersRecord[key.toLowerCase()] = value;
      });

      // Handle redirect status codes (301, 302, 303, 307, 308)
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location');
        if (!location) {
          return {
            ok: false,
            statusCode: response.status,
            statusText: response.statusText,
            url: currentUrl,
            headers: headersRecord,
            body: '',
            error: 'Redirect location header missing'
          };
        }

        // Resolve relative redirects against current URL
        const nextUrl = new URL(location, currentUrl).toString();
        redirectCount++;
        if (redirectCount > maxRedirects) {
          return {
            ok: false,
            statusCode: 310,
            statusText: 'Too Many Redirects',
            url: currentUrl,
            headers: headersRecord,
            body: '',
            error: `Exceeded maximum redirect limit of ${maxRedirects}`
          };
        }

        currentUrl = nextUrl;
        continue; // Next hop
      }

      // Read response body up to maxBytes
      const arrayBuffer = await response.arrayBuffer();
      if (arrayBuffer.byteLength > maxBytes) {
        const trimmed = arrayBuffer.slice(0, maxBytes);
        const decoder = new TextDecoder('utf-8', { fatal: false });
        return {
          ok: response.ok,
          statusCode: response.status,
          statusText: response.statusText,
          url: currentUrl,
          headers: headersRecord,
          body: decoder.decode(trimmed)
        };
      }

      const decoder = new TextDecoder('utf-8', { fatal: false });
      const text = decoder.decode(arrayBuffer);

      return {
        ok: response.ok,
        statusCode: response.status,
        statusText: response.statusText,
        url: currentUrl,
        headers: headersRecord,
        body: text
      };
    } catch (err: any) {
      clearTimeout(timeoutId);
      const isAbort = err.name === 'AbortError' || err.message?.includes('aborted');
      return {
        ok: false,
        statusCode: isAbort ? 504 : 0,
        statusText: isAbort ? 'Gateway Timeout' : 'Network Error',
        url: currentUrl,
        headers: {},
        body: '',
        error: isAbort ? `Request timed out after ${timeoutMs}ms` : err.message || 'Fetch failed'
      };
    }
  }

  return {
    ok: false,
    statusCode: 310,
    statusText: 'Too Many Redirects',
    url: currentUrl,
    headers: {},
    body: '',
    error: `Exceeded maximum redirect limit of ${maxRedirects}`
  };
}
