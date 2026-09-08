# OpenMemory Guide

Living project index for `kia-credit-sims` (KIA financing site).

## Overview

Fork of `hfci-credit-sims` for Hyundai Capital KIA financing. Engine (LOS Confins, CMS, admin, dealer portal, simulation wizard) is reused. Public chrome uses an interim KIA theme (white / `#05141f`) adapted from kia.id until official design guidelines arrive.

## Architecture

- Next.js App Router + Prisma + NextAuth + next-intl
- Confins brand filter is centralized in `lib/brand.ts` (`hierarchyLv1Code: KIA`)
- Salesman fee override (Phase 2 Poin 2): same as HCFI — quotation `/dealer/quotation` stepper admin fee Rp 500.000 + provision 0.5%. Values sent as Confins `AdminFeeAmt` / `ProvisionFee` (`PRCNT`) on CalculateProductFromRule, SimulateFinancialCalculate, and SaveFinancialData. Caps from CMS `maxAdminFeeAmt` / `maxProvisionPrcnt`.
- Promo banner live landing (Phase 2 Poin 3): same as HCFI — one PreSimulation record, two public URLs. Snapshot `/pre-sim/[slug]` stays QR/read-only. Live `/credit-simulation?promo=[slug]` hydrates the public wizard to ResultStep (Jakarta dealer, new AddLeadAsset, editable, submittable). Banner CMS picks live vs snapshot vs custom CTA. Do not reuse `simulationLeadNo` from the template.
- Local isolation: port 3071, database `kia-credit-sims`
- Media/KTP stay on local disk (`MEDIA_STORAGE=local`, `KTP_STORAGE=local`) until KIA infra credentials exist
- No AWS S3 bucket, RDS, or deploy runners yet — user has not received infrastructure credentials
- `AWS_S3_BUCKET=kia-credit-sims-media` is a placeholder name only; do not provision cloud resources until creds arrive

## User Defined Namespaces

- [Leave blank - user populates]

## Components

- `app/components/brand/KiaLogo.tsx` — official KIA wordmark SVG, fill via `currentColor`
- `lib/brand.ts` — KIA Confins brand code, slug, theme tokens, master dealer env
- Simulation APIs (`app/api/simulation/assets`, `lead-asset`) send `AssetHierarchyLv1Code` / `AssetLv1Code` from `BRAND`
- Vendor list body uses `SupplierBrandCode` from `BRAND.hierarchyLv1Code`
- `OtpChallengeForm` + `usePortalLogin` — dealer/salesman email OTP (same as HCFI, KIA ink `#05141f`)
- SMTP mailer `lib/email.ts` — Office 365 env `SMTP_*`
- `LoginOtpChallenge` Prisma model
- `FeeStepper` + `CustomerPaidFees` — stepper fee quotation salesman (same as HCFI)
- `lib/salesman-fee.ts` — clamp, provision % vs amount, Confins fee request fields
- `PromoLandingWizard` + `usePromoLanding` — bootstrap live step-5 sim from published pre-sim slug
- `BannerCtaFields` — banner CTA: live promo / snapshot QR / custom URL
- `CopyIconButton` — copy live or snapshot link with inline success feedback
- `lib/promo-simulation.ts` — Jakarta dealer picker, seed from PreSimulation row, live vs snapshot hrefs

## Patterns

- Interim public theme from kia.id: white + `#05141f`, logo as `KiaLogo` component (`currentColor`)
- Official homepage guidelines still pending; current chrome is an adaptation of existing components
- Dealer/salesman login: password then email OTP. Admin CMS skips OTP. Local without SMTP logs the code to the server console.
- Pre-sim dual links: snapshot `/pre-sim/[slug]` vs live `/credit-simulation?promo=[slug]` — never mix submit onto the QR page
