import createIntlMiddleware from "next-intl/middleware";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionFromRequest } from "@/lib/auth-middleware";
import { getClientIp, loginLimiter, tooManyRequestsResponse } from "@/lib/ratelimit";
import { checkWriteOrigin } from "@/lib/security/origin-check";
import { CSP_POLICY, getCspHeaderName } from "@/lib/security/csp";
import { cacheControlForPath } from "@/lib/security/cache-headers";
import { isBlockedProbePath } from "@/lib/security/blocked-paths";
import { routing } from "./i18n/routing";

const intlMiddleware = createIntlMiddleware(routing);

/** Collapse `//dealer/login` → `/dealer/login` so portal route guards match. */
function normalizePathname(pathname: string): string {
  const collapsed = pathname.replace(/\/{2,}/g, "/");
  if (collapsed.length > 1 && collapsed.endsWith("/")) {
    return collapsed.slice(0, -1);
  }
  return collapsed || "/";
}

/** Dealer portal lives outside `[locale]`; undo mistaken `/id/dealer/*` prefixes. */
function stripLocaleFromDealerPath(pathname: string): string {
  const match = pathname.match(/^\/(id|en)\/dealer(\/.*)?$/);
  if (!match) return pathname;
  return `/dealer${match[2] ?? ""}`;
}

/**
 * Endpoints that intentionally accept third-party-initiated requests
 * (e.g. NextAuth has its own CSRF token + state handling, and ELB health
 * checks hit `/` without an Origin). Keep this list small.
 */
const ORIGIN_CHECK_BYPASS_PREFIXES = [
  "/api/auth/", // NextAuth: protected by built-in CSRF token + state nonces
];

function shouldEnforceOrigin(pathname: string): boolean {
  if (!pathname.startsWith("/api/")) return false;
  return !ORIGIN_CHECK_BYPASS_PREFIXES.some((p) => pathname.startsWith(p));
}

function getCorsHeaders(request: NextRequest): Record<string, string> | null {
  const allowed =
    process.env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) ?? [];
  if (allowed.length === 0) return null;

  const origin = request.headers.get("origin");
  if (!origin || !allowed.includes(origin)) return null;

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

function withCsp(response: NextResponse): NextResponse {
  // Runtime env wins: drop both CSP header names then set the active one so we
  // never emit Report-Only + Enforce together from next.config + middleware.
  response.headers.delete("Content-Security-Policy");
  response.headers.delete("Content-Security-Policy-Report-Only");
  response.headers.set(getCspHeaderName(), CSP_POLICY);
  return response;
}

function withCors(response: NextResponse, request: NextRequest): NextResponse {
  if (!request.nextUrl.pathname.startsWith("/api")) return response;
  const cors = getCorsHeaders(request);
  if (cors) {
    Object.entries(cors).forEach(([k, v]) => response.headers.set(k, v));
  }
  return response;
}

/** Cache-Control + nosniff on middleware-produced responses (redirects, 401 JSON, etc.). */
function withCacheAndContentGuards(
  response: NextResponse,
  request: NextRequest
): NextResponse {
  if (!response.headers.has("X-Content-Type-Options")) {
    response.headers.set("X-Content-Type-Options", "nosniff");
  }

  const cache = cacheControlForPath(request.nextUrl.pathname);
  if (cache && !response.headers.has("Cache-Control")) {
    response.headers.set("Cache-Control", cache);
  }

  // Only set Content-Type on middleware-owned redirects.
  // Do NOT set text/plain on NextResponse.next() — that response has no
  // Content-Type yet; forcing text/plain makes HTML pages render as source
  // (especially with nosniff). Page/JSON handlers set their own types later.
  const status = response.status;
  if (
    status >= 300 &&
    status < 400 &&
    !response.headers.has("Content-Type")
  ) {
    response.headers.set("Content-Type", "text/plain; charset=utf-8");
  }

  return response;
}

/** CSP always; CORS only for API when ALLOWED_ORIGINS is set; cache/type guards. */
function finalize(response: NextResponse, request: NextRequest): NextResponse {
  return withCacheAndContentGuards(withCsp(withCors(response, request)), request);
}

export async function middleware(request: NextRequest) {
  const rawPathname = request.nextUrl.pathname;
  const pathname = stripLocaleFromDealerPath(normalizePathname(rawPathname));

  // Deny scanner probe paths (e.g. /graphql) before CMS catch-all can 404 them.
  if (isBlockedProbePath(pathname)) {
    return finalize(
      new NextResponse(null, { status: 404 }),
      request
    );
  }

  if (pathname !== rawPathname) {
    const url = request.nextUrl.clone();
    url.pathname = pathname;
    return finalize(NextResponse.redirect(url), request);
  }

  // ELB/ALB health check often hits GET / and expects 200.
  // Root redirects to locale (307), which ELB treats as unhealthy.
  // Return 200 for health checker to avoid 504s.
  const ua = request.headers.get("user-agent") ?? "";
  if (
    pathname === "/" &&
    request.method === "GET" &&
    ua.includes("ELB-HealthChecker")
  ) {
    return finalize(NextResponse.json({ status: "ok" }, { status: 200 }), request);
  }

  // CORS for API routes (only when ALLOWED_ORIGINS is set)
  if (pathname.startsWith("/api")) {
    if (request.method === "OPTIONS") {
      const cors = getCorsHeaders(request);
      const res = new NextResponse(null, {
        status: 204,
        headers: cors ?? {},
      });
      // Same CSP / cache / nosniff path as every other response (SOC 3a).
      return finalize(res, request);
    }
  }

  // Cross-origin write guard (anti-CSRF). Runs *before* per-route limiters
  // so we don't burn limit budget on rejected cross-origin probes.
  if (shouldEnforceOrigin(pathname)) {
    const verdict = checkWriteOrigin({
      method: request.method,
      origin: request.headers.get("origin"),
      referer: request.headers.get("referer"),
      host: request.headers.get("host"),
    });
    if (!verdict.ok) {
      return finalize(
        NextResponse.json(
          { error: "Forbidden: cross-origin request rejected" },
          { status: 403 }
        ),
        request
      );
    }
  }

  // Rate limit login attempts (brute-force protection) — per-IP layer only.
  // A second layer (per-email + persistent DB lockout) lives in `lib/nextauth.ts`.
  if (
    pathname === "/api/auth/callback/credentials" &&
    request.method === "POST"
  ) {
    const ip = getClientIp(request);
    // Tanpa IP asli (proxy tidak meneruskan XFF), semua user berbagi satu
    // bucket — limiter per-IP jadi denial-of-service massal. Lewati; layer
    // per-email + DB lockout di nextauth tetap aktif.
    const rl = ip === "unknown"
      ? { success: true as const, retryAfterSec: 0 }
      : loginLimiter.limit(ip);
    if (!rl.success) {
      return finalize(
        tooManyRequestsResponse(
          "Too many login attempts. Please try again later.",
          rl.retryAfterSec
        ),
        request
      );
    }
  }

  if (pathname.startsWith("/api/otp/") && request.method === "POST") {
    const ip = getClientIp(request);
    const rl =
      ip === "unknown"
        ? { success: true as const, retryAfterSec: 0 }
        : loginLimiter.limit(`otp:${ip}`);
    if (!rl.success) {
      return finalize(
        tooManyRequestsResponse(
          "Too many login attempts. Please try again later.",
          rl.retryAfterSec
        ),
        request
      );
    }
  }

  if (pathname.startsWith("/dealer")) {
    const isLoginPage = pathname === "/dealer/login";
    if (!isLoginPage) {
      const session = await getSessionFromRequest(request);
      if (!session?.authenticated) {
        const loginUrl = new URL("/dealer/login", request.url);
        loginUrl.searchParams.set("callbackUrl", pathname);
        return finalize(NextResponse.redirect(loginUrl), request);
      }
    }
    return finalize(NextResponse.next(), request);
  }

  if (pathname.startsWith("/admin")) {
    const session = await getSessionFromRequest(request);
    if (!session?.authenticated) {
      const loginUrl = new URL("/auth/login", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return finalize(NextResponse.redirect(loginUrl), request);
    }
    return finalize(NextResponse.next(), request);
  }

  // API admin routes require authentication (defense-in-depth)
  if (pathname.startsWith("/api/admin") || pathname.startsWith("/api/dealer")) {
    const session = await getSessionFromRequest(request);
    if (!session?.authenticated) {
      return finalize(
        NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
        request
      );
    }
    return finalize(NextResponse.next(), request);
  }

  if (pathname.startsWith("/api") || pathname.startsWith("/auth")) {
    return finalize(NextResponse.next(), request);
  }

  return finalize(intlMiddleware(request), request);
}

export const config = {
  // Include robots/sitemap (have a file extension) — previously skipped by
  // the `.*\\..*` exclusion, so CSP was missing on those public metadata routes.
  matcher: [
    "/((?!_next/static|_next/image|_vercel|.*\\.(?:ico|png|jpg|jpeg|gif|webp|svg|woff2?|ttf|eot|css|js|map)$).*)",
    "/robots.txt",
    "/sitemap.xml",
  ],
};
