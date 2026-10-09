/**
 * Lightweight User-Agent parser for Access Log display.
 * No third-party dependency — enough for browser / OS / device class.
 */

export type ParsedUserAgent = {
  browser: string | null;
  os: string | null;
  device: 'desktop' | 'mobile' | 'tablet' | 'bot' | 'unknown';
  raw: string | null;
};

function firstMatch(ua: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const m = ua.match(pattern);
    if (m?.[1]) return m[1].trim();
  }
  return null;
}

function detectBrowser(ua: string): string | null {
  if (/Edg\//i.test(ua)) {
    return firstMatch(ua, [/Edg\/([\d.]+)/i])
      ? `Edge ${firstMatch(ua, [/Edg\/([\d.]+)/i])}`
      : 'Edge';
  }
  if (/OPR\//i.test(ua) || /Opera/i.test(ua)) {
    const v = firstMatch(ua, [/OPR\/([\d.]+)/i, /Opera\/([\d.]+)/i]);
    return v ? `Opera ${v}` : 'Opera';
  }
  if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) {
    const v = firstMatch(ua, [/Chrome\/([\d.]+)/i]);
    return v ? `Chrome ${v}` : 'Chrome';
  }
  if (/Firefox\//i.test(ua)) {
    const v = firstMatch(ua, [/Firefox\/([\d.]+)/i]);
    return v ? `Firefox ${v}` : 'Firefox';
  }
  if (/Safari\//i.test(ua) && /Version\//i.test(ua)) {
    const v = firstMatch(ua, [/Version\/([\d.]+)/i]);
    return v ? `Safari ${v}` : 'Safari';
  }
  if (/MSIE |Trident\//i.test(ua)) return 'Internet Explorer';
  return null;
}

function detectOs(ua: string): string | null {
  if (/Windows NT 10/i.test(ua)) return 'Windows 10/11';
  if (/Windows NT 6\.3/i.test(ua)) return 'Windows 8.1';
  if (/Windows NT 6\.1/i.test(ua)) return 'Windows 7';
  if (/Windows/i.test(ua)) return 'Windows';
  if (/Android ([\d.]+)/i.test(ua)) {
    const v = firstMatch(ua, [/Android ([\d.]+)/i]);
    return v ? `Android ${v}` : 'Android';
  }
  if (/iPhone|iPad|iPod/i.test(ua)) {
    const v = firstMatch(ua, [/OS ([\d_]+)/i])?.replace(/_/g, '.');
    return v ? `iOS ${v}` : 'iOS';
  }
  if (/Mac OS X ([\d_]+)/i.test(ua)) {
    const v = firstMatch(ua, [/Mac OS X ([\d_]+)/i])?.replace(/_/g, '.');
    return v ? `macOS ${v}` : 'macOS';
  }
  if (/Linux/i.test(ua)) return 'Linux';
  if (/CrOS/i.test(ua)) return 'Chrome OS';
  return null;
}

function detectDevice(ua: string): ParsedUserAgent['device'] {
  if (/bot|crawl|spider|slurp|bingpreview/i.test(ua)) return 'bot';
  if (/iPad|Tablet|PlayBook/i.test(ua)) return 'tablet';
  if (/Android/i.test(ua) && !/Mobile/i.test(ua)) return 'tablet';
  if (/Mobi|iPhone|iPod|Android.*Mobile|webOS|BlackBerry/i.test(ua)) {
    return 'mobile';
  }
  if (ua.trim()) return 'desktop';
  return 'unknown';
}

export function parseUserAgent(userAgent: string | null | undefined): ParsedUserAgent {
  const raw = userAgent?.trim() || null;
  if (!raw) {
    return { browser: null, os: null, device: 'unknown', raw: null };
  }
  return {
    browser: detectBrowser(raw),
    os: detectOs(raw),
    device: detectDevice(raw),
    raw,
  };
}

/** Short label for tables, e.g. "Chrome 120 · macOS · desktop". */
export function formatUserAgentSummary(parsed: ParsedUserAgent): string {
  const parts = [parsed.browser, parsed.os, parsed.device !== 'unknown' ? parsed.device : null].filter(
    Boolean
  );
  return parts.length > 0 ? parts.join(' · ') : 'Unknown device';
}
