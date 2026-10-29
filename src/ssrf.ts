import dns from 'node:dns/promises';
import ipaddr from 'ipaddr.js';

export interface SSRFValidationResult {
  valid: boolean;
  reason?: string;
  normalizedUrl?: URL;
  resolvedIp?: string;
}

/**
 * Checks whether an IP string is public and safe to request.
 * Disallows loopback, private, link-local, broadcast, carrier-grade NAT,
 * cloud metadata (169.254.169.254), documentation ranges, and IPv6 equivalents.
 */
export function isPublicIp(ipString: string): boolean {
  try {
    let addr = ipaddr.parse(ipString);

    // If it's an IPv4-mapped IPv6 address (e.g., ::ffff:127.0.0.1), unmap it
    if (addr.kind() === 'ipv6') {
      const ipv6Addr = addr as ipaddr.IPv6;
      if (ipv6Addr.isIPv4MappedAddress()) {
        addr = ipv6Addr.toIPv4Address();
      }
    }

    const range = addr.range();

    // Dangerous / private ranges in ipaddr.js
    const blockedRanges: string[] = [
      'unspecified',
      'broadcast',
      'linkLocal',
      'loopback',
      'private',
      'carrierGradeNat',
      'reserved',
      'uniqueLocal'
    ];

    if (blockedRanges.includes(range)) {
      return false;
    }

    // Explicit check for cloud metadata address 169.254.169.254
    if (addr.toString() === '169.254.169.254') {
      return false;
    }

    // Check for documentation networks (RFC 5737: 192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24)
    if (addr.kind() === 'ipv4') {
      const octets = (addr as ipaddr.IPv4).octets;
      if (
        (octets[0] === 192 && octets[1] === 0 && octets[2] === 2) ||
        (octets[0] === 198 && octets[1] === 51 && octets[2] === 100) ||
        (octets[0] === 203 && octets[1] === 0 && octets[2] === 113)
      ) {
        return false;
      }
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Validates a target URL against SSRF rules:
 * - Only http: and https: protocols
 * - Standard ports (80, 443, or unspecified)
 * - Valid hostnames (no raw numeric private IPs, no localhost)
 * - DNS resolution resolves to public IP addresses only
 */
export async function validateUrlForSSRF(rawUrl: string): Promise<SSRFValidationResult> {
  let parsed: URL;
  try {
    let toParse = rawUrl.trim();
    if (!toParse.startsWith('http://') && !toParse.startsWith('https://')) {
      toParse = `https://${toParse}`;
    }
    parsed = new URL(toParse);
  } catch (err) {
    return { valid: false, reason: 'Invalid URL format' };
  }

  // Enforce protocol
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { valid: false, reason: 'Only HTTP and HTTPS protocols are allowed' };
  }

  // Enforce port
  if (parsed.port && parsed.port !== '80' && parsed.port !== '443') {
    return { valid: false, reason: 'Only standard web ports (80, 443) are allowed' };
  }

  const hostname = parsed.hostname.toLowerCase();

  // Block localhost and standard loopback hostnames
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal')
  ) {
    return { valid: false, reason: 'Local and internal domains are not permitted' };
  }

  // Check if hostname is directly an IP literal
  if (ipaddr.isValid(hostname)) {
    if (!isPublicIp(hostname)) {
      return { valid: false, reason: 'Direct connection to private/internal IP is prohibited' };
    }
  }

  // Resolve hostname through DNS
  try {
    const records = await dns.lookup(hostname, { all: true });
    if (!records || records.length === 0) {
      return { valid: false, reason: 'Host could not be resolved in DNS' };
    }

    for (const record of records) {
      if (!isPublicIp(record.address)) {
        return {
          valid: false,
          reason: `Resolved IP ${record.address} belongs to an internal, private, or metadata range`
        };
      }
    }

    return {
      valid: true,
      normalizedUrl: parsed,
      resolvedIp: records[0].address
    };
  } catch (dnsErr: any) {
    return { valid: false, reason: `DNS lookup failed: ${dnsErr.message || 'unknown error'}` };
  }
}
