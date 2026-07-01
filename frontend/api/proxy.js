/**
 * Same Origin Proxy — Vercel Node.js Serverless Function
 *
 * WHY this structure (not [...]path].js catch-all):
 *   Catch-all dynamic routes in api/ are unreliable for non-Next.js Vercel
 *   projects. A single fixed function + path via query param is guaranteed to work.
 *
 * Flow:
 *   Browser → /assets/gtm/debug?id=...
 *     ↓ vercel.json rewrite
 *   Vercel → /api/proxy?path=gtm/debug&id=...
 *     ↓ this function
 *   Upstream → https://edge.stapesite.com/gtm/debug?id=...
 */

const STAPE_ORIGIN = 'https://edge.stapesite.com';
const STAPE_HOST   = 'edge.stapesite.com';
const SITE_HOST    = 'stapesite.com';

// Headers that must NOT be forwarded server-to-server
const SKIP_HEADERS = new Set([
  // HTTP/2 pseudo-headers
  ':authority', ':method', ':path', ':scheme',
  // Hop-by-hop
  'connection', 'keep-alive', 'transfer-encoding', 'upgrade', 'proxy-connection',
  // Recalculated by fetch
  'host', 'content-length',
  // Browser-only security headers
  'sec-ch-ua', 'sec-ch-ua-mobile', 'sec-ch-ua-platform',
  'sec-fetch-dest', 'sec-fetch-mode', 'sec-fetch-site',
  // Vercel-internal
  'x-vercel-id', 'x-real-ip', 'x-vercel-deployment-url',
  'x-vercel-forwarded-for', 'x-vercel-ip-country', 'x-vercel-ip-city',
  // We set these ourselves
  'x-forwarded-for', 'x-from-cdn', 'cf-connecting-ip', 'x-stape-host',
]);

module.exports = async function handler(req, res) {
  try {
    // req.url = '/api/proxy?path=gtm%2Fdebug&id=GTM-NMH5MFWN&...'
    const qsIndex = (req.url || '').indexOf('?');
    const rawQs   = qsIndex >= 0 ? req.url.slice(qsIndex + 1) : '';

    // Extract path (URLSearchParams decodes %2F → /)
    const params   = new URLSearchParams(rawQs);
    const sgtmPath = params.get('path') || '';

    // Remove ONLY the 'path=' segment — keep everything else raw (no re-encoding)
    const filteredQs = rawQs
      .split('&')
      .filter(p => !/^path=/.test(p))
      .join('&');

    const targetUrl = `${STAPE_ORIGIN}/${sgtmPath}${filteredQs ? '?' + filteredQs : ''}`;

    // Real client IP
    const forwardedFor = req.headers['x-forwarded-for'] || '';
    const clientIp = forwardedFor.split(',')[0].trim() || '0.0.0.0';

    // Build clean header set
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

    // Stream body for POST requests
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
