import { z } from 'zod';
import { HONEYPOT_FIELD } from '@/lib/security/honeypot';
import { cleanString, looksMalicious } from '@/lib/security/sanitize';
import { ANALYTICS_EVENT_NAMES, type AnalyticsEventName } from './paths';

export {
  ANALYTICS_EVENT_NAMES,
  VISITOR_COOKIE_NAME,
  VISITOR_COOKIE_MAX_AGE_SEC,
  isValidVisitorId,
  shouldIgnoreAnalyticsPath,
  stripLocalePrefix,
  type AnalyticsEventName,
} from './paths';

const safeField = (max: number) =>
  z
    .string()
    .max(max)
    .transform(cleanString)
    .refine((v) => !looksMalicious(v), { message: 'invalid' });

export const analyticsPayloadSchema = z
  .object({
    productId: safeField(80).optional(),
    productTitle: safeField(200).optional(),
    step: safeField(40).optional(),
  })
  .strict();

export type AnalyticsEventPayload = z.infer<typeof analyticsPayloadSchema>;

export const analyticsIngestSchema = z.object({
  name: z.enum(ANALYTICS_EVENT_NAMES),
  path: safeField(500),
  locale: safeField(8).optional(),
  payload: analyticsPayloadSchema.optional(),
  [HONEYPOT_FIELD]: z.string().optional(),
});

export type AnalyticsIngestBody = z.infer<typeof analyticsIngestSchema>;

export function entityKeyFromPayload(
  name: AnalyticsEventName,
  payload: AnalyticsEventPayload | undefined
): string | null {
  if (!payload) return null;
  if (name === 'product_click' && payload.productId) return payload.productId;
  if ((name === 'sim_start' || name === 'sim_step' || name === 'sim_submit') && payload.step) {
    return payload.step;
  }
  return null;
}
