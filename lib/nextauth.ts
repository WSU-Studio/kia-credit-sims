import { CredentialsSignin } from '@auth/core/errors';
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import {
  getUserByEmail,
  getUserById,
  toNextAuthUser,
  verifyPassword,
} from '@/lib/auth';
import { dealerRequiresEmailOtp } from '@/lib/auth-otp';
import { LOGIN_ERROR_CODES } from '@/lib/auth-login-errors';
import { consumeLoginOtpChallenge } from '@/lib/login-otp';
import { loginEmailLimiter } from '@/lib/ratelimit';
import {
  readLockState,
  recordFailedLogin,
  recordSuccessfulLogin,
} from '@/lib/security/auth-lockout';

/** Upper bound for the session cookie (remember-me). */
const SESSION_COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days
/** Default session when remember-me is off. */
const SESSION_MAX_AGE_DEFAULT = 6 * 60 * 60; // 6 hours

function rejectLogin(code: string): never {
  const error = new CredentialsSignin();
  error.code = code;
  throw error;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [
    Credentials({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        rememberMe: { label: 'Remember me', type: 'text' },
        challengeId: { label: 'OTP challenge', type: 'text' },
        otp: { label: 'OTP', type: 'text' },
      },
      async authorize(credentials) {
        const challengeId =
          typeof credentials?.challengeId === 'string'
            ? credentials.challengeId.trim()
            : '';
        const otp =
          typeof credentials?.otp === 'string' ? credentials.otp.trim() : '';

        if (challengeId && otp) {
          const consumed = await consumeLoginOtpChallenge({ challengeId, otp });
          if (consumed.ok === false) {
            rejectLogin(consumed.code);
          } else {
            const user = await getUserById(consumed.userId);
            if (!user || !user.isActive || !dealerRequiresEmailOtp(user.userType)) {
              return null;
            }

            const otpLockState = readLockState(user);
            if (otpLockState.locked) {
              rejectLogin(LOGIN_ERROR_CODES.CREDENTIALS);
            }

            await recordSuccessfulLogin(user.id);
            return toNextAuthUser(user, consumed.rememberMe);
          }
        }

        if (!credentials?.email || !credentials?.password) {
          rejectLogin(LOGIN_ERROR_CODES.MISSING_FIELDS);
        }

        const email = String(credentials.email).toLowerCase().trim();

        // Layer 1: per-email in-memory limiter. Stops botnet brute-force
        // even when each request comes from a different IP.
        const rl = loginEmailLimiter.limit(`email:${email}`);
        if (!rl.success) {
          rejectLogin(LOGIN_ERROR_CODES.RATE_LIMITED);
        }

        const user = await getUserByEmail(email);

        // Don't leak whether the email exists.
        if (!user || !user.isActive) {
          return null;
        }

        // Layer 2: persistent DB lockout — survives restarts.
        // Use generic credentials error (not ACCOUNT_LOCKED) to avoid email enumeration.
        const lockState = readLockState(user);
        if (lockState.locked) {
          rejectLogin(LOGIN_ERROR_CODES.CREDENTIALS);
        }

        const isValid = await verifyPassword(
          credentials.password as string,
          user.password
        );

        if (!isValid) {
          await recordFailedLogin(user.id);
          // Same generic error whether or not this attempt triggered lockout.
          return null;
        }

        if (dealerRequiresEmailOtp(user.userType)) {
          rejectLogin(LOGIN_ERROR_CODES.OTP_REQUIRED);
        }

        await recordSuccessfulLogin(user.id);

        const rememberMe =
          credentials.rememberMe === true || credentials.rememberMe === 'true';

        return toNextAuthUser(user, rememberMe);
      },
    }),
  ],
  pages: {
    signIn: '/auth/login',
    error: '/auth/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.userType = user.userType ?? null;
        token.roleNames = user.roleNames ?? [];
        token.vendorCode = user.vendorCode ?? null;
        token.vendorName = user.vendorName ?? null;
        token.vendorCity = user.vendorCity ?? null;
        token.oriOfficeCode = user.oriOfficeCode ?? null;
        token.oriOfficeName = user.oriOfficeName ?? null;
        token.cmoEmpNo = user.cmoEmpNo ?? null;
        const rememberMe = (user as { rememberMe?: boolean }).rememberMe ?? false;
        const maxAgeSec = rememberMe ? SESSION_COOKIE_MAX_AGE : SESSION_MAX_AGE_DEFAULT;
        // Auth.js encoder overwrites JWT `exp` with session.maxAge — use a
        // custom claim and invalidate here so remember-me actually works.
        token.sessionExpiresAt = Math.floor(Date.now() / 1000) + maxAgeSec;
        token.rememberMe = rememberMe;
      }

      if (
        typeof token.sessionExpiresAt === 'number' &&
        Math.floor(Date.now() / 1000) > token.sessionExpiresAt
      ) {
        return null;
      }

      return token;
    },
    async session({ session, token }) {
      if (!token?.id) {
        // Expired via sessionExpiresAt — surface as unauthenticated.
        return {
          ...session,
          user: undefined as unknown as typeof session.user,
          expires: new Date(0).toISOString(),
        };
      }
      if (session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
        session.user.name = token.name as string;
        session.user.userType = (token.userType as string | null) ?? null;
        session.user.roleNames = (token.roleNames as string[]) ?? [];
        session.user.vendorCode = (token.vendorCode as string | null) ?? null;
        session.user.vendorName = (token.vendorName as string | null) ?? null;
        session.user.vendorCity = (token.vendorCity as string | null) ?? null;
        session.user.oriOfficeCode = (token.oriOfficeCode as string | null) ?? null;
        session.user.oriOfficeName = (token.oriOfficeName as string | null) ?? null;
        session.user.cmoEmpNo = (token.cmoEmpNo as string | null) ?? null;
      }
      return session;
    },
  },
  session: {
    strategy: 'jwt',
    // Cookie upper bound; actual lifetime enforced via token.sessionExpiresAt.
    maxAge: SESSION_COOKIE_MAX_AGE,
  },
  secret: process.env.NEXTAUTH_SECRET,
});
