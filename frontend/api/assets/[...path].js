/**
 * Same Origin Proxy — Vercel Node.js Serverless Function
 *
 * Proxies /assets/* → https://edge.stapesite.com/*
 *
 * Fixes vs previous version:
 *  1. Uses req.url directly — avoids URLSearchParams re-encoding the Stape token
 *  2. Filters out browser-only / hop-by-hop / HTTP2 pseudo-headers that
 *     cause 400 Bad Request on the upstream server
 */

const STAPE_ORIGIN = 'https://edge.stapesite.com';
const STAPE_HOST   = 'edge.stapesite.com';
const SITE_HOST    = 'stapesite.com';

// Headers that must NOT be forwarded to the upstream server
const SKIP_HEADERS = new Set([
  // HTTP/2 pseudo-headers (not real HTTP headers)
  ':authority', ':method', ':path', ':scheme',
  // Hop-by-hop headers (per RFC 2616)
  'connection', 'keep-alive', 'transfer-encoding', 'upgrade', 'proxy-connection',
  // fetch() recalculates these
  'host', 'content-length',
  // Browser security headers — meaningless / harmful in server-to-server requests
  'sec-ch-ua', 'sec-ch-ua-mobile', 'sec-ch-ua-platform',
  'sec-fetch-dest', 'sec-fetch-mode', 'sec-fetch-site',
  // Vercel-internal headers
  'x-vercel-id', 'x-real-ip', 'x-vercel-deployment-url',
  'x-vercel-forwarded-for', 'x-vercel-ip-country', 'x-vercel-ip-city',
  // We override these manually below
  'x-forwarded-for', 'x-from-cdn', 'cf-connecting-ip', 'x-stape-host',
]);

module.exports = async function handler(req, res) {
  try {
    // Use req.url directly to preserve the exact original query string.
    // URLSearchParams would re-encode the Stape auth token and break requests.
    // req.url = '/assets/8vq26ydeexgxa.js?47g0m=CBxaP...' (Vercel sets this to the original path)
    const sgtmRelative = (req.url || '/')
      .replace(/^\/api\/assets/, '')
      .replace(/^\/assets/, '') || '/';

    const targetUrl = `${STAPE_ORIGIN}${sgtmRelative}`;

    // Real client IP (Vercel populates x-forwarded-for automatically)
    const forwardedFor = req.headers['x-forwarded-for'] || '';
    const clientIp = forwardedFor.split(',')[0].trim() || '0.0.0.0';

    // Build clean header set — skip problematic headers, add Stape-required ones
    const outHeaders = {};
    for (const [key, value] of Object.entries(req.headers)) {
      if (!SKIP_HEADERS.has(key.toLowerCase())) {
        outHeaders[key.toLowerCase()] = value;
      }
    }
    outHeaders['x-forwarded-for']  = clientIp;
    outHeaders['x-from-cdn']       = 'cf-stape';
    outHeaders['host']             = STAPE_HOST;
    outHeaders['cf-connecting-ip'] = clientIp;
    // Required when proxying to standard Stape subdomain (not custom)
    outHeaders['x-stape-host']     = SITE_HOST;

    // Read body for POST / non-GET requests
    let body;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      body = await new Promise((resolve) => {
        const chunks = [];
        req.on('data', (chunk) => chunks.push(chunk));
        req.on('end', () => resolve(Buffer.concat(chunks)));
      });
    }

    const upstream = await fetch(targetUrl, {
      method:  req.method,
      headers: outHeaders,
      body,
    });

    // Forward response headers (skip hop-by-hop)
    for (const [key, value] of upstream.headers.entries()) {
      if (!['transfer-encoding', 'connection', 'keep-alive'].includes(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    }

    const buffer = await upstream.arrayBuffer();
    res.status(upstream.status).send(Buffer.from(buffer));

  } catch (err) {
    console.error('[sgtm-proxy] error:', err.message);
    res.status(502).json({ error: 'Bad Gateway', message: err.message });
  }
};
