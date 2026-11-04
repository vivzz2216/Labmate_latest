"""Document previews are inert, opaque-origin documents, not application pages."""

PREVIEW_HEADERS = {
    'Content-Security-Policy': "sandbox; default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'",
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Cache-Control': 'private, no-store',
}
