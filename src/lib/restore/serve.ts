/**
 * Shared response headers for fixture HTML.
 * The before page keeps its historical markup; CSP stops scripts either way.
 */

export function htmlResponse(html: string, formAction: "'none'" | "'self'"): Response {
  return new Response(html, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'content-security-policy': `default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action ${formAction}; frame-ancestors 'self'`,
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer',
      'cache-control': 'public, max-age=3600',
    },
  });
}
