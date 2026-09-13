'use client';

import { useEffect } from 'react';
import { useLocale } from 'next-intl';
import { usePathname } from '@/i18n/navigation';
import { track } from '@/lib/first-party-tracker/client';

/** Public-site pageviews. Ignored on /admin, /dealer, /auth by the tracker. */
export default function FirstPartyPageview() {
  const pathname = usePathname();
  const locale = useLocale();

  useEffect(() => {
    track('page_view', { path: pathname, locale });
  }, [pathname, locale]);

  return null;
}
