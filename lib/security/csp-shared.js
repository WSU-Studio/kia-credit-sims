/**
 * Shared CSP policy for next.config.js only (CommonJS).
 * Keep directive list in sync with lib/security/csp.ts (Edge middleware).
 *
 * Google GTM/GA CSP: https://developers.google.com/tag-platform/security/guides/csp
 *
 * 'unsafe-eval' omitted by default (SOC). Escape hatch: CSP_ALLOW_UNSAFE_EVAL=true
 * for local next-dev HMR only — never on TQA/prod.
 * `'wasm-unsafe-eval'` is required for EmbedPDF/PDFium (not the same as unsafe-eval).
 */

const allowUnsafeEval =
  (process.env.CSP_ALLOW_UNSAFE_EVAL || '').trim() === 'true';

const scriptSrc = [
  "'self'",
  "'unsafe-inline'",
  ...(allowUnsafeEval ? ["'unsafe-eval'"] : []),
  "'wasm-unsafe-eval'",
  'https://www.googletagmanager.com',
  'https://www.google-analytics.com',
  'https://analytics.google.com',
].join(' ');

const CSP_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
  "object-src 'none'",
  `script-src ${scriptSrc}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://www.google-analytics.com https://*.google-analytics.com https://www.googletagmanager.com https://*.g.doubleclick.net https://*.amazonaws.com https://*.pexels.com https://*.unsplash.com https://*.cloudinary.com",
  "font-src 'self' data:",
  "connect-src 'self' https://www.google-analytics.com https://*.google-analytics.com https://www.googletagmanager.com https://region1.google-analytics.com https://analytics.google.com https://*.analytics.google.com",
  "frame-src 'self' https://www.googletagmanager.com",
  "worker-src 'self' blob:",
].join('; ');

function isCspEnforceEnabled() {
  const raw = (process.env.CSP_ENFORCE ?? '').trim().toLowerCase();
  return raw === 'true' || raw === '1' || raw === 'yes';
}

/** Header name: enforce vs observe-only (runtime / build env). */
function getCspHeaderName() {
  return isCspEnforceEnabled()
    ? 'Content-Security-Policy'
    : 'Content-Security-Policy-Report-Only';
}

module.exports = {
  CSP_POLICY,
  isCspEnforceEnabled,
  getCspHeaderName,
};
