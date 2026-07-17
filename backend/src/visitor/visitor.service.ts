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
   * Builds the Set-Cookie header value for visitor_id.
   * `secure` should be true whenever the request is served over HTTPS
   * (always true in production; can be false for local http development).
   */
  buildVisitorCookieHeader(visitorId: string, secure: boolean): string {
    return buildSetCookieHeader(VISITOR_ID_COOKIE_NAME, visitorId, {
      path: '/',
      maxAgeSeconds: VISITOR_ID_COOKIE_MAX_AGE_SECONDS,
      sameSite: 'Lax',
      httpOnly: true,
      secure,
    });
  }
}
