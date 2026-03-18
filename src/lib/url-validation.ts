/**
 * URL validation utilities to prevent SSRF attacks.
 * Block requests to private/internal IP ranges.
 */

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
