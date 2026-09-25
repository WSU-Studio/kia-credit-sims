/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS for plain Node (EB, next.config.js) */
/** @type {import('next').NextConfig} */
const createNextIntlPlugin = require("next-intl/plugin");
const { CSP_POLICY, getCspHeaderName } = require("./lib/security/csp-shared.js");

// Relative path (Turbopack rejects absolute). Plugin aliases "next-intl/config" -> this file.
const withNextIntl = createNextIntlPlugin("i18n/request.ts");

const securityHeaders = [
  {
    key: 'X-Frame-Options',
    value: 'SAMEORIGIN',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  },
  // Baseline CSP on every Next header-eligible response (SOC 3a consistency).
  // Middleware also sets the same policy at request time (CSP_ENFORCE flip).
  {
    key: getCspHeaderName(),
    value: CSP_POLICY,
  },
  ...(process.env.NODE_ENV === 'production'
    ? [
        {
          key: 'Strict-Transport-Security',
          value: 'max-age=31536000; includeSubDomains; preload',
        },
      ]
    : []),
];

const nextConfig = {
  // Hide framework fingerprint from response headers (SOC finding #5).
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
      // Sensitive / personalized surfaces — never cache at shared proxies.
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'private, no-store, no-cache, must-revalidate',
          },
        ],
      },
      {
        source: '/admin/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'private, no-store, no-cache, must-revalidate',
          },
        ],
      },
      {
        source: '/dealer/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'private, no-store, no-cache, must-revalidate',
          },
        ],
      },
      {
        source: '/auth/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'private, no-store, no-cache, must-revalidate',
          },
        ],
      },
      // Public metadata — explicit TTL (SOC called out robots.txt cache review).
      {
        source: '/robots.txt',
        headers: [
          { key: 'Content-Type', value: 'text/plain; charset=utf-8' },
          {
            key: 'Cache-Control',
            value: 'public, max-age=3600, must-revalidate',
          },
        ],
      },
      {
        source: '/sitemap.xml',
        headers: [
          { key: 'Content-Type', value: 'application/xml; charset=utf-8' },
          {
            key: 'Cache-Control',
            value: 'public, max-age=3600, must-revalidate',
          },
        ],
      },
      // Fingerprinted build assets — long-lived in production (URLs change on deploy).
      // Do not set immutable on /_next/static during `next dev`: webpack reuses chunk
      // names, so the browser would keep serving yesterday's JS (missing Task history, etc.).
      ...(process.env.NODE_ENV === 'production'
        ? [
            {
              source: '/_next/static/:path*',
              headers: [
                {
                  key: 'Cache-Control',
                  value: 'public, max-age=31536000, immutable',
                },
              ],
            },
          ]
        : []),
    ];
  },
  // Using Webpack for better Prisma compatibility
  // Turbopack has issues with Prisma module resolution in Next.js 16
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.pexels.com',
      },
      {
        protocol: 'https',
        hostname: '**.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: '**.cloudinary.com',
      },
      // Pin to this project's S3 bucket host (not **.amazonaws.com wildcard).
      // Override via AWS_S3_BUCKET + AWS_REGION at build time when set.
      ...(process.env.AWS_S3_BUCKET && process.env.AWS_REGION
        ? [
            {
              protocol: 'https',
              hostname: `${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com`,
            },
            {
              protocol: 'https',
              hostname: `${process.env.AWS_S3_BUCKET}.s3.amazonaws.com`,
            },
          ]
        : [
            {
              protocol: 'https',
              hostname: 'kia-credit-sims-media.s3.ap-southeast-3.amazonaws.com',
            },
            {
              protocol: 'https',
              hostname: 'kia-credit-sims-media.s3.amazonaws.com',
            },
          ]),
      ...(process.env.NODE_ENV !== 'production'
        ? [{ protocol: 'http', hostname: 'localhost' }]
        : []),
    ],
    // SVG via next/image is disabled — serve SVG through the media proxy with CSP sandbox if needed.
    dangerouslyAllowSVG: false,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    unoptimized: false,
  },
  webpack: (config) => {
    // Serve PDFium as a URL for EmbedPDF `wasmUrl`. Do not enable
    // asyncWebAssembly — it marks client modules as Promises and breaks RSC
    // (`Lazy element type must resolve to a class or function`).
    config.module.rules.push({
      test: /\.wasm$/,
      type: 'asset/resource',
    });
    return config;
  },
};

module.exports = withNextIntl(nextConfig);
