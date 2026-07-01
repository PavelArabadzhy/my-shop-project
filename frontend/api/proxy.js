/**
 * Same Origin Proxy — Vercel Node.js Serverless Function
 * Based on Stape official documentation for Vercel.
 *
 * Proxies /assets/* → https://edge.stapesite.com/*
 *
 * Critical fix: Node.js fetch() auto-decompresses gzip responses.
 * We must NOT forward content-encoding or content-length headers,
 * otherwise the browser tries to decompress again → corrupted JS → GTM breaks.
 * Fix: remove accept-encoding from outgoing request (upstream sends plain text),
 * and strip content-encoding/content-length from response headers.
 */

const STAPE_ORIGIN = 'https://edge.stapesite.com';
const STAPE_HOST   = 'edge.stapesite.com';
const SITE_HOST    = 'stapesite.com';

// Headers that must NOT be forwarded upstream
const SKIP_HEADERS = new Set([
  // HTTP/2 pseudo-headers
  ':authority', ':method', ':path', ':scheme',
  // Hop-by-hop
  'connection', 'keep-alive', 'transfer-encoding', 'upgrade', 'proxy-connection',
  // Browser-only / CORS preflight
  'sec-ch-ua', 'sec-ch-ua-mobile', 'sec-ch-ua-platform',
  'sec-fetch-dest', 'sec-fetch-mode', 'sec-fetch-site', 'sec-fetch-user',
  'origin',
  // Recalculated below
  'accept-encoding', 'content-length', 'host',
  // Vercel-internal
  'x-vercel-id', 'x-vercel-deployment-url', 'x-vercel-trace',
  'x-real-ip', 'x-forwarded-host', 'x-forwarded-proto',
]);

module.exports = async (req, res) => {
  try {
    // Extract path and preserve raw query string (no re-encoding)
    const qsIndex  = (req.url || '').indexOf('?');
    const rawQs    = qsIndex >= 0 ? req.url.slice(qsIndex + 1) : '';
    const params   = new URLSearchParams(rawQs);
    const sgtmPath = params.get('path') || '';

    // Strip 'path=' but keep all other query params exactly as-is
    const filteredQs = rawQs
      .split('&')
      .filter(p => p && !/^path=/.test(p))
      .join('&');

    const targetUrl = `${STAPE_ORIGIN}/${sgtmPath}${filteredQs ? '?' + filteredQs : ''}`;

    // Real client IP
    const forwardedFor = req.headers['x-forwarded-for'] || '';
    const clientIp = forwardedFor.split(',')[0].trim() || 'unknown';

    // Build clean headers — skip all problematic browser/hop-by-hop headers
    const newHeaders = {};
    for (const [key, value] of Object.entries(req.headers)) {
      if (!SKIP_HEADERS.has(key.toLowerCase())) {
        newHeaders[key] = value;
      }
    }

    // Stape-required headers
    Object.assign(newHeaders, {
      'Host':             STAPE_HOST,
      'X-Forwarded-For':  clientIp,
      'X-From-Cdn':       'cf-stape',
      'CF-Connecting-IP': clientIp,
    });

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
      headers: newHeaders,
      body,
    });

    // Forward response headers — skip headers that would cause issues
    for (const [key, value] of upstream.headers.entries()) {
      const k = key.toLowerCase();
      if (
        k === 'transfer-encoding' || // hop-by-hop
        k === 'connection'         || // hop-by-hop
        k === 'keep-alive'         || // hop-by-hop
        k === 'content-encoding'   || // we requested no compression; decompressed already
        k === 'content-length'        // recalculated from actual buffer below
      ) continue;
      res.setHeader(key, value);
    }

    const buffer = await upstream.arrayBuffer();
    res.status(upstream.status).send(Buffer.from(buffer));

  } catch (err) {
    console.error('[sgtm-proxy] error:', err.message);
    res.status(502).json({ error: 'Bad Gateway', message: err.message });
  }
};
