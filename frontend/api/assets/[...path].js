/**
 * Same Origin Proxy — Vercel Edge Function
 *
 * Proxies all requests from:
 *   https://www.stapesite.com/assets/*
 * to:
 *   https://edge.stapesite.com/*
 *
 * Why Edge (not Node.js serverless):
 *   - Runs at the CDN edge, closest to the user → lowest latency
 *   - Native Request/Response streaming — no body buffering
 *   - No cold starts
 *   - Ideal for transparent pass-through proxies
 *
 * Required headers per Stape docs:
 *   X-Forwarded-For   — real client IP
 *   X-From-Cdn        — identifies the CDN (must be "cf-stape")
 *   Host              — target sGTM hostname
 *   CF-Connecting-IP  — real client IP (Cloudflare-style)
 *   X-Stape-Host      — your site's public hostname (required when
 *                       proxying to a standard Stape subdomain, not custom)
 */

export const config = {
  runtime: 'edge',
};

const STAPE_ORIGIN = 'https://edge.stapesite.com';
const STAPE_HOST   = 'edge.stapesite.com';
// Your Vercel domain — tells Stape which site the events belong to
// Must match exactly what is configured in Stape Dashboard (without www)
const SITE_HOST    = 'stapesite.com';

export default async function handler(request) {
  const url = new URL(request.url);

  // Strip the Vercel-internal prefix (/api/assets or /assets) to get
  // the real sGTM path, e.g. /api/assets/g/collect → /g/collect
  const sgtmPath = url.pathname
    .replace(/^\/api\/assets/, '')
    .replace(/^\/assets/, '') || '/';

  const targetUrl = `${STAPE_ORIGIN}${sgtmPath}${url.search}`;

  // Real client IP (Vercel populates x-forwarded-for automatically)
  const clientIp =
    (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() ||
    '0.0.0.0';

  // Clone request headers and override what sGTM needs
  const outHeaders = new Headers(request.headers);
  outHeaders.set('X-Forwarded-For',  clientIp);
  outHeaders.set('X-From-Cdn',       'cf-stape');
  outHeaders.set('Host',             STAPE_HOST);
  outHeaders.set('CF-Connecting-IP', clientIp);
  // Required: tells Stape which site the hits originate from
  outHeaders.set('X-Stape-Host',     SITE_HOST);

  const upstream = await fetch(targetUrl, {
    method:  request.method,
    headers: outHeaders,
    // Stream the body for POST requests (GA4 collect, etc.)
    body: request.method !== 'GET' && request.method !== 'HEAD'
      ? request.body
      : undefined,
  });

  // Stream the upstream response back — preserves binary payloads
  // (GTM loader script, GA4 collect responses, etc.)
  return new Response(upstream.body, {
    status:  upstream.status,
    headers: upstream.headers,
  });
}
