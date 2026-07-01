export const config = { runtime: 'edge' };

const TARGET = 'https://edge.stapesite.com';

export default async function handler(request) {
  const url = new URL(request.url);

  // Strip /metrics prefix to get the actual sGTM path
  const path = url.pathname.replace(/^\/metrics/, '') || '/';
  const targetUrl = `${TARGET}${path}${url.search}`;

  const clientIp = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim();

  const headers = new Headers(request.headers);
  headers.set('Host', 'edge.stapesite.com');
  headers.set('X-Forwarded-For', clientIp);
  headers.set('X-From-Cdn', 'cf-stape');

  const body = ['GET', 'HEAD'].includes(request.method) ? null : request.body;

  return fetch(targetUrl, { method: request.method, headers, body });
}
