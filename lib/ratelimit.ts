/**
 * In-memory rate limiter (no external service).
 * Note: In serverless / multi-instance EB, each instance has its own store;
 * limits are per-instance. For correctness across instances move to Redis
 * (Upstash / ElastiCache) — but in-memory is fine while we run a single
 * EB instance + AWS WAF rate-based rule on the ALB.
 */
import { NextResponse } from 'next/server';

type Entry = { count: number; resetAt: number };

export type Limiter = {
  limit(identifier: string): { success: boolean; remaining: number; retryAfterSec: number };
  /** Reset counter for a specific identifier (e.g. after successful login). */
  reset(identifier: string): void;
};

function createLimiter(max: number, windowMs: number): Limiter {
  const store = new Map<string, Entry>();

  // Cleanup expired entries periodically to avoid memory leak.
  const cleanup = () => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      if (entry.resetAt <= now) store.delete(key);
    }
  };
  setInterval(cleanup, 60_000); // every minute

  return {
    limit(identifier) {
      const now = Date.now();
      const entry = store.get(identifier);

      if (!entry || entry.resetAt <= now) {
        store.set(identifier, { count: 1, resetAt: now + windowMs });
        return { success: true, remaining: max - 1, retryAfterSec: 0 };
      }

      entry.count++;
      const remaining = Math.max(0, max - entry.count);
      if (entry.count > max) {
        return {
          success: false,
          remaining: 0,
          retryAfterSec: Math.ceil((entry.resetAt - now) / 1000),
        };
      }
      return { success: true, remaining, retryAfterSec: 0 };
    },
    reset(identifier) {
      store.delete(identifier);
    },
  };
}

// ---------- Public-facing limiters (key = client IP) ----------

/**
 * Login attempts per IP — 20 per 15 minutes.
 * Sengaja longgar: satu kantor/NAT (atau proxy yang tidak meneruskan
 * X-Forwarded-For) berbagi satu bucket, dan brute-force per akun sudah
 * ditangani limiter per-email + DB lockout di `lib/nextauth.ts`.
 */
export const loginLimiter = createLimiter(20, 15 * 60 * 1000);

/** Login attempts per email — 10 per 15 minutes (botnet-spread defence). */
export const loginEmailLimiter = createLimiter(10, 15 * 60 * 1000);

/** OTP request/resend per IP — 10 per 15 minutes. */
export const otpIpLimiter = createLimiter(10, 15 * 60 * 1000);

/** OTP request/resend per email — 5 per 15 minutes. */
export const otpEmailLimiter = createLimiter(5, 15 * 60 * 1000);

/** Public lead submissions — 10 per minute per IP. */
export const leadsLimiter = createLimiter(10, 60 * 1000);

/** Public Hyundai AddLeadAsset draft — 5 per minute per IP (creates a Hyundai LOS lead per call). */
export const leadAssetDraftLimiter = createLimiter(5, 60 * 1000);

/**
 * Public simulation catalog / calculate endpoints — 60 per minute per IP.
 * Wizard flow fires ~8–12 requests; 60 leaves headroom for NAT/office while
 * still blocking scrapers that hammer Hyundai-backed routes.
 */
export const simulationLimiter = createLimiter(60, 60 * 1000);

/** Public lead status inquiry — POST /api/public/lead-tracking. */
export const leadTrackingLimiter = createLimiter(20, 60 * 1000);

/** First-party analytics ingest — POST /api/t/e (pageviews + funnel). */
export const analyticsIngestLimiter = createLimiter(120, 60 * 1000);

// ---------- Authenticated-user limiters (key = user id) ----------

/** Admin media upload — 30 per minute. Admins legitimately upload many files. */
export const adminMediaUploadLimiter = createLimiter(30, 60 * 1000);

/**
 * Admin actions that invoke Hyundai LOS/SLIK downstream APIs — 20 per minute.
 * Each call costs a paid downstream request.
 */
export const adminHyundaiCallLimiter = createLimiter(20, 60 * 1000);

/**
 * Heavy admin sync jobs (e.g. vehicle model master sync) — 10 per hour.
 * Balance between safety and operator UX: 5/hour was too tight during
 * routine debug/re-runs in the same session, 15 felt loose. 10 leaves
 * ~6 minute average spacing, still cheap for downstream Confins calls.
 */
export const adminSyncLimiter = createLimiter(10, 60 * 60 * 1000);

/** Password change — 5 attempts per 15 minutes per user (protects the *current* password). */
export const passwordChangeLimiter = createLimiter(5, 15 * 60 * 1000);

// ---------- Helpers ----------

/**
 * Resolve client IP behind a trusted reverse proxy (e.g. AWS ALB).
 *
 * ALB *appends* the connecting client IP to X-Forwarded-For; it does not
 * strip client-supplied values. Taking the first hop lets attackers rotate
 * spoofed IPs and bypass rate limits. We therefore take the last
 * `TRUSTED_PROXY_HOPS` entry (default 1 = the IP ALB appended).
 *
 * Prefer platform-set headers when present (Cloudflare / nginx Real-IP).
 */
export function getClientIp(request: Request): string {
  const cfConnectingIp = request.headers.get('cf-connecting-ip')?.trim();
  if (cfConnectingIp) return cfConnectingIp;

  const realIp = request.headers.get('x-real-ip')?.trim();
  if (realIp) return realIp;

  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const hops = forwarded
      .split(',')
      .map((h) => h.trim())
      .filter(Boolean);
    if (hops.length > 0) {
      const trustedHops = Math.max(
        1,
        Number.parseInt(process.env.TRUSTED_PROXY_HOPS ?? '1', 10) || 1
      );
      const index = Math.max(0, hops.length - trustedHops);
      return hops[index] ?? hops[hops.length - 1]!;
    }
  }

  const nextIp = (request as { ip?: string }).ip;
  return nextIp || 'unknown';
}

/**
 * Build a uniform 429 JSON response with `Retry-After` header so clients
 * (and load balancers/WAF) can throttle correctly.
 */
export function tooManyRequestsResponse(
  message: string,
  retryAfterSec: number
): NextResponse {
  const res = NextResponse.json({ error: message }, { status: 429 });
  res.headers.set('Retry-After', String(Math.max(1, retryAfterSec)));
  return res;
}
