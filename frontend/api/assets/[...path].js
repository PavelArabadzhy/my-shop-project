/**
 * Same Origin Proxy — Vercel Node.js Serverless Function
 *
 * Works with any Vercel project (plain HTML, no Next.js required).
 * Edge runtime (export const config) only works inside Next.js — that's
 * why we use module.exports here instead.
 *
 * Proxies /assets/* → https://edge.stapesite.com/*
 * e.g. /assets/fps/gtd?id=... → https://edge.stapesite.com/fps/gtd?id=...
 */

const STAPE_ORIGIN = 'https://edge.stapesite.com';
const STAPE_HOST   = 'edge.stapesite.com';
// Must match the domain registered in Stape Dashboard
const SITE_HOST    = 'stapesite.com';

module.exports = async function handler(req, res) {
  try {
    // req.query.path is the catch-all array: ['fps', 'gtd']
    const { path: pathArr, ...queryParams } = req.query;

    const sgtmPath = Array.isArray(pathArr)
      ? pathArr.join('/')
      : (pathArr || '');

    // Rebuild query string from original params (excluding internal 'path' key)
    const qs = Object.keys(queryParams).length
      ? '?' + new URLSearchParams(queryParams).toString()
      : '';

    const targetUrl = `${STAPE_ORIGIN}/${sgtmPath}${qs}`;

    // Real client IP — Vercel sets x-forwarded-for automatically
    const forwardedFor = req.headers['x-forwarded-for'] || '';
    const clientIp = forwardedFor.split(',')[0].trim() || '0.0.0.0';

    const outHeaders = {
      ...req.headers,
      'x-forwarded-for':  clientIp,
      'x-from-cdn':       'cf-stape',
      'host':             STAPE_HOST,
      'cf-connecting-ip': clientIp,
      // Required when proxying to standard Stape subdomain (not custom)
      'x-stape-host':     SITE_HOST,
    };
    // Let fetch recalculate content-length after any header changes
    delete outHeaders['content-length'];

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

    // Forward all upstream response headers (skip hop-by-hop headers)
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
