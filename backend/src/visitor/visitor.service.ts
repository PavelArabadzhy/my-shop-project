import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { buildSetCookieHeader, parseCookies } from './cookie.util';
import {
  VISITOR_ID_COOKIE_MAX_AGE_SECONDS,
  VISITOR_ID_COOKIE_NAME,
} from './visitor.constants';

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class VisitorService {
  /** Guards against trusting arbitrary client input as a cookie value. */
  isValidVisitorId(value: unknown): value is string {
    return typeof value === 'string' && UUID_V4_REGEX.test(value);
  }

  generateVisitorId(): string {
    return randomUUID();
  }

  getVisitorIdFromCookieHeader(cookieHeader?: string): string | undefined {
    return parseCookies(cookieHeader)[VISITOR_ID_COOKIE_NAME];
  }

  /**
   * Builds the Set-Cookie header value for visitor_id, per Stape Cookie
   * Keeper's "User Identifier: Cookie" requirements:
   *  - HttpOnly MUST be false (Cookie Keeper / GTM need JS-side visibility)
   *  - Secure MUST be true (site is HTTPS-only in production)
   *  - Domain should cover the whole site, e.g. ".stapesite.com", so the
   *    cookie is valid across subdomains, not just the exact host
   *  - Duration is 400 days, and the cookie must be re-issued (with a fresh
   *    Max-Age) on every request so it never expires for active visitors
   */
  buildVisitorCookieHeader(
    visitorId: string,
    secure: boolean,
    domain?: string,
  ): string {
    return buildSetCookieHeader(VISITOR_ID_COOKIE_NAME, visitorId, {
      path: '/',
      domain,
      maxAgeSeconds: VISITOR_ID_COOKIE_MAX_AGE_SECONDS,
      sameSite: 'Lax',
      httpOnly: false,
      secure,
    });
  }
}
