/**
 * Minimal, dependency-free helpers for reading/building cookie headers.
 * We intentionally avoid `cookie-parser` and other third-party packages.
 */

export function parseCookies(cookieHeader?: string): Record<string, string> {
  if (!cookieHeader) return {};

  return cookieHeader.split(';').reduce<Record<string, string>>((acc, pair) => {
    const separatorIndex = pair.indexOf('=');
    if (separatorIndex === -1) return acc;

    const key = pair.slice(0, separatorIndex).trim();
    const value = pair.slice(separatorIndex + 1).trim();
    if (!key) return acc;

    try {
      acc[key] = decodeURIComponent(value);
    } catch {
      acc[key] = value;
    }

    return acc;
  }, {});
}

export interface CookieOptions {
  path?: string;
  domain?: string;
  maxAgeSeconds?: number;
  sameSite?: 'Lax' | 'Strict' | 'None';
  httpOnly?: boolean;
  secure?: boolean;
}

export function buildSetCookieHeader(
  name: string,
  value: string,
  options: CookieOptions = {},
): string {
  const attributes = [`${name}=${encodeURIComponent(value)}`];

  attributes.push(`Path=${options.path ?? '/'}`);

  if (options.domain) {
    attributes.push(`Domain=${options.domain}`);
  }

  if (options.maxAgeSeconds !== undefined) {
    attributes.push(`Max-Age=${options.maxAgeSeconds}`);
  }

  attributes.push(`SameSite=${options.sameSite ?? 'Lax'}`);

  if (options.httpOnly) attributes.push('HttpOnly');
  if (options.secure) attributes.push('Secure');

  return attributes.join('; ');
}
