/**
 * URL validation utilities to prevent SSRF attacks.
 * Block requests to private/internal IP ranges.
 */

import { lookup } from 'dns/promises';
import net from 'net';

const PRIVATE_IP_RANGES = [
  // IPv4
  /^127\./,                    // Loopback
  /^10\./,                     // Class A private
  /^172\.(1[6-9]|2\d|3[01])\./, // Class B private
  /^192\.168\./,               // Class C private
  /^169\.254\./,               // Link-local
  /^0\./,                      // Current network
  // IPv6
  /^\[::1\]/,                  // Loopback
  /^\[fc/i,                    // Unique local
  /^\[fd/i,                    // Unique local
  /^\[fe80:/i,                 // Link-local
];

/**
 * Check if a hostname resolves to a private/internal IP address.
 * Returns true if the URL targets a private network.
 *
 * NOTE: this is a *string* check on the hostname only. It cannot see a public
 * hostname that resolves to a private address, and it says nothing about where
 * a redirect leads. Prefer `safeFetch` for anything that actually makes a
 * request; this remains for cheap pre-checks and for callers that only have a
 * URL string (e.g. publish.ts image rewriting).
 */
export function isPrivateUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    const hostname = url.hostname;

    // Check hostname directly against private IP patterns
    for (const pattern of PRIVATE_IP_RANGES) {
      if (pattern.test(hostname)) return true;
    }

    // Block localhost variants
    if (hostname === 'localhost' || hostname === '[::1]') return true;

    // Block metadata endpoints (cloud providers)
    if (hostname === '169.254.169.254') return true;
    if (hostname === 'metadata.google.internal') return true;

    return false;
  } catch {
    return true; // Invalid URL = block
  }
}

/** Thrown when a URL is rejected by the SSRF guard. Callers should treat as 400. */
export class BlockedUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BlockedUrlError';
  }
}

function ipv4IsPublic(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return false;
  const [a, b] = parts;
  if (a === 0) return false;                                   // 0.0.0.0/8
  if (a === 10) return false;                                  // private
  if (a === 127) return false;                                 // loopback
  if (a === 169 && b === 254) return false;                    // link-local + metadata
  if (a === 172 && b >= 16 && b <= 31) return false;           // private
  if (a === 192 && b === 168) return false;                    // private
  if (a === 192 && b === 0) return false;                      // IETF protocol assignments
  if (a === 100 && b >= 64 && b <= 127) return false;          // CGNAT
  if (a === 198 && (b === 18 || b === 19)) return false;        // benchmarking
  if (a >= 224) return false;                                  // multicast + reserved
  return true;
}

function ipv6IsPublic(ip: string): boolean {
  const addr = ip.toLowerCase();

  // IPv4-mapped addresses must be judged by the embedded IPv4 address.
  // Two spellings reach us: the dotted form (::ffff:127.0.0.1) and the hex
  // form (::ffff:7f00:1), because the WHATWG URL parser normalises the former
  // into the latter. Missing the hex form let ::ffff:127.0.0.1 through.
  const mappedDotted = addr.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mappedDotted) return ipv4IsPublic(mappedDotted[1]);

  const mappedHex = addr.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (mappedHex) {
    const hi = parseInt(mappedHex[1], 16);
    const lo = parseInt(mappedHex[2], 16);
    const dotted = [hi >> 8, hi & 0xff, lo >> 8, lo & 0xff].join('.');
    return ipv4IsPublic(dotted);
  }
  if (addr === '::' || addr === '::1') return false;           // unspecified, loopback
  if (/^f[cd]/.test(addr)) return false;                       // unique local fc00::/7
  if (/^fe[89ab]/.test(addr)) return false;                    // link-local fe80::/10
  if (/^ff/.test(addr)) return false;                          // multicast
  return true;
}

function addressIsPublic(ip: string): boolean {
  const version = net.isIP(ip);
  if (version === 4) return ipv4IsPublic(ip);
  if (version === 6) return ipv6IsPublic(ip);
  return false;
}

/**
 * Resolve a URL's hostname and reject it unless EVERY resolved address is
 * public. Resolving every address matters: a hostname can return both a public
 * and a private record, and picking one at fetch time is the attacker's choice,
 * not ours.
 */
export async function assertPublicUrl(urlString: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    throw new BlockedUrlError('Invalid URL format');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new BlockedUrlError(`Unsupported URL scheme: ${url.protocol}`);
  }

  // Cheap string check first — catches literal IPs and localhost without DNS.
  if (isPrivateUrl(url.toString())) {
    throw new BlockedUrlError('URLs pointing to private or internal networks are not allowed');
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, '');

  // A literal IP needs no lookup; validate it directly.
  if (net.isIP(hostname)) {
    if (!addressIsPublic(hostname)) {
      throw new BlockedUrlError('URLs pointing to private or internal networks are not allowed');
    }
    return url;
  }

  let addresses: Array<{ address: string }>;
  try {
    addresses = await lookup(hostname, { all: true });
  } catch (err) {
    throw new BlockedUrlError(
      `Could not resolve host: ${err instanceof Error ? err.message : 'lookup failed'}`
    );
  }

  if (addresses.length === 0) {
    throw new BlockedUrlError('Could not resolve host');
  }

  for (const { address } of addresses) {
    if (!addressIsPublic(address)) {
      throw new BlockedUrlError('URLs pointing to private or internal networks are not allowed');
    }
  }

  return url;
}

/**
 * fetch() with SSRF protection on every hop.
 *
 * Redirects are followed manually so each destination is revalidated —
 * `redirect: 'follow'` would let a public URL bounce to 127.0.0.1 or a cloud
 * metadata endpoint after the initial check passed.
 *
 * Throws BlockedUrlError when any hop fails validation; callers should map
 * that to a 400.
 */
export async function safeFetch(
  urlString: string,
  init: RequestInit = {},
  maxRedirects = 5
): Promise<Response> {
  let current = (await assertPublicUrl(urlString)).toString();

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const res = await fetch(current, { ...init, redirect: 'manual' });

    const isRedirect = res.status >= 300 && res.status < 400 && res.headers.has('location');
    if (!isRedirect) return res;

    const location = res.headers.get('location') as string;
    const next = new URL(location, current).toString();
    await assertPublicUrl(next); // revalidate before following
    current = next;
  }

  throw new BlockedUrlError(`Too many redirects (>${maxRedirects})`);
}
