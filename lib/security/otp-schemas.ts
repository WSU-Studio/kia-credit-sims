import { z } from 'zod';

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, { message: 'Email wajib diisi' })
  .max(254, { message: 'Email tidak valid' })
  .refine((v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), {
    message: 'Email tidak valid',
  });

function asBoolean(value: unknown): boolean {
  return value === true || value === 'true';
}

export const otpRequestSchema = z.object({
  email: emailSchema,
  password: z
    .string()
    .min(1, { message: 'Password wajib diisi' })
    .max(200, { message: 'Password terlalu panjang' }),
  rememberMe: z.unknown().optional().transform(asBoolean),
});

export const otpResendSchema = z.object({
  challengeId: z.string().uuid({ message: 'Challenge tidak valid' }),
});

export type OtpRequestInput = z.infer<typeof otpRequestSchema>;
export type OtpResendInput = z.infer<typeof otpResendSchema>;
