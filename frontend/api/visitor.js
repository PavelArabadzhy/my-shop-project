export const config = { runtime: 'edge' };

// Same-origin proxy for the visitor_id endpoints. This MUST stay same-origin:
// if the browser called the Render backend directly, any Set-Cookie header
// it returns would be scoped to the Render domain, not to this site, and
// would be invisible to Stape Cookie Keeper.
const TARGET = 'https://my-shop-project-bsg1.onrender.com';

export default async function handler(request) {
  const url = new URL(request.url);
  const targetUrl = `${TARGET}${url.pathname}${url.search}`;

  const headers = new Headers(request.headers);
  headers.delete('host');

  const body = ['GET', 'HEAD'].includes(request.method) ? null : request.body;

  const response = await fetch(targetUrl, {
    method: request.method,
    headers,
    body,
    redirect: 'manual',
  });

  // Forward the response as-is, including Set-Cookie. Because the browser
  // sees this response as coming from the current origin (not from Render),
  // the cookie ends up correctly scoped to this site's domain.
  return new Response(response.body, {
    status: response.status,
    headers: response.headers,
  });
}
