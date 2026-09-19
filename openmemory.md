# OpenMemory Guide

Living project index for `kia-credit-sims` (KIA financing site).

## Overview

Fork of `hfci-credit-sims` for Hyundai Capital KIA financing. Engine (LOS Confins, CMS, admin, dealer portal, simulation wizard) is reused. Public chrome uses an interim KIA theme (white / `#05141f`) adapted from kia.id until official design guidelines arrive.

## Architecture

- Next.js App Router + Prisma + NextAuth + next-intl
- Confins brand filter is centralized in `lib/brand.ts` (`hierarchyLv1Code: KIA`)
- Salesman fee override (Phase 2 Poin 2): same as HCFI — quotation `/dealer/quotation` stepper admin fee Rp 500.000. Bounds come from Confins `AdminFeeAmt` + `AdminFeeBhv` (Lock / Min / Max / Def). `ResultStep` uses `pickAdminFeeSource(tenorRow, productCard)` so LOCK on either GetListDefaultProductFromRule **or** CalculateProductFromRule wins over DEF on the other row. LOCK amount is not snapped to 500rb. Override payload sends locked AdminFeeAmt even if the salesman never touched the stepper; provision is omitted until touched.
- View Summary **Biaya Dibayar Customer** (`FeePaidAmt`) is a **total**: Admin Fee + Provisi + Fiducia. `CalculateProductFromRule` often omits/zeros `FiduciaFeeAmt` even though FinalCalculate already baked ~Rp 1.000.000 into `FeePaidAmt`. `resolveCustomerFeeBreakdown` uses explicit Fiducia if > 0, otherwise remainder `FeePaid − admin − provisi`. Modal order: Admin fee → Provisi → Fiducia → Biaya Dibayar Customer. Pass wizard `adminFeeAmt` into `withCustomerFeeBreakdown` so remainder is not the whole total.
- Promo banner live landing (Phase 2 Poin 3): same as HCFI — one PreSimulation record, two public URLs. Snapshot `/pre-sim/[slug]` stays QR/read-only. Live `/credit-simulation?promo=[slug]` hydrates the public wizard to ResultStep (Jakarta dealer, new AddLeadAsset, editable, submittable). Banner CMS picks live vs snapshot vs custom CTA. Do not reuse `simulationLeadNo` from the template.
- Salesman PriceStep discount is **two fields**: read-only **Diskon Promo Dealer** (Sales Promotion lookup / `accumulatePriceDiscounts`) plus editable **Diskon tambahan**. Get Quotation `AssetDiscAmt` is the **sum**. Do not prefill the extra input with the promo amount. `SimulationWizard` stores `discount` (total) and `additionalDiscount` (extra) so back-navigation does not double-count. **Public** `/credit-simulation` uses the same two fields: lookup `GET /api/simulation/dealer-promotions/lookup?vendorCode=` from DealerStep `VendorCode` (must match `DealerPromotionForm` vendor). Quotation can still use session lookup if `vendorCode` is omitted. `ResultStep` does not re-lookup; it consumes the summed `discount` as `AssetDiscAmt`.
- First-party visitor analytics (Phase 2 Poin 5): same as HCFI — `lib/first-party-tracker/`, ingest `POST /api/t/e`, admin `/admin/analytics`. Cookie is `kia_fp_vid` (KIA isolation). GA/GTM stays optional.
- OTP: `USE_OTP=true` enables dealer/salesman email OTP. SMTP resolves IPv4 A-record then TLS `servername` = original host. Deploy writes `SMTP_*`, `USE_OTP`, `NODE_OPTIONS=--dns-result-order=ipv4first` without changing KIA env paths.
- Local isolation: port 3071, database `kia-credit-sims`
- CMS admin login is `/auth/login` with `admin@kia.com` (not `admin@hcfi.com`). Seed creates that user only when `SEED_ADMIN_PASSWORD` is set; if the user already exists, seed syncs `userType` to `KIA_ADMIN` and does **not** reset the password. Dealer portal is `/dealer/login` (`DEALER_ADMIN` / `SALESMAN`). A CMS session on `/dealer/dashboard` gets `GET /api/dealer/leads/stats` 403 — `DealerDashboardStats` must ignore non-stats JSON or Next overlay shows `Cannot read properties of undefined (reading 'isSalesman')`.
- Media/KTP stay on local disk (`MEDIA_STORAGE=local`, `KTP_STORAGE=local`) until KIA infra credentials exist. Upload prefix is `kia_leads_ktp/` (not `hcfi_leads_ktp/`). Local upload returns a relative `/api/dev/ktp/kia_leads_ktp/...` path (no origin). `leadCreateSchema.ktpUrl` must call `isKtpStorageUrl` / `parseKtpStorageUrl` — a duplicated refine that only accepted origin-root `/api/dev/ktp/` rejected locale-prefixed URLs (`/id/api/dev/ktp/...`) with `ktpUrl harus URL penyimpanan KTP yang valid`.
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
- `MovingCarLoader` — animated car loader on promo landing (same as HCFI)
- First-party tracker (`lib/first-party-tracker/`) — client `track()` via sendBeacon, Zod ingest schema, admin summary queries
- `AnalyticsEvent` (`analytics_events`) — `page_view` | `product_click` | `sim_start` | `sim_step` | `sim_submit`; anonymous `visitorId` cookie `kia_fp_vid`
- `Lead.hyundaiGoLiveAt` — first time monitoring shows Contract Activation completed
- Admin Visitor Analytics (`app/(back-office)/admin/analytics/page.tsx`) — traffic, product clicks, funnel, three conversion ratios. Default date range is last 30 inclusive days (`today` and `today - 29`); not persisted in the URL so a full refresh resets it. **Terapkan** always refetches even if Dari/Sampai did not change.
- Dealer sales promotions (`DealerPromotionForm` / `lib/dealer-promotion.ts`) — **one promo per vendor + model + manufacturing year + trim (`fscCode`)**. Form reuses Confins year/variant APIs via `YearTrimFields` + `useVehicleYearAndTrim` (same sequence as quotation SpecificationStep). Period is **inclusive calendar days in Asia/Jakarta**. Lookup `pickDealerPromotion`: exact year+trim first, else legacy model-wide (`manufYear` 0 + empty `fscCode`). PriceStep passes `specs.manufacturingYear` + `specs.fscCode`. Percent discount still uses quotation OTR (trim price). Demo seeder rows include year + `SEED-Txx` trim (KIA model names, not Hyundai). `DealerPromotionsTable` shows year · trim; search includes those. Do not show Confins `assetCode` in the table. After adding those Prisma columns, run `prisma generate` and **restart** `next dev` — the client is cached on `globalThis`, so a 500 `Unknown argument manufYear` otherwise renders as an empty promo list.
- Page-builder `download` widget — same as HCFI: public cards with red PDF icon, title, optional subtitle, **Lihat PDF** (new tab) and **Unduh**. Layout `payload.direction` row|column and `payload.align` left|center|right via `downloadSettings.ts`. Default align center, direction row. Editor list (max 10) via `DownloadWidgetFields`. Payload: `files: DownloadFileItem[]` including `subtitle`/`subtitleEn`. Upload stores PDF as-is under `kia_media/`. Do not add `'use client'` to `WidgetRenderer` or `DownloadWidget` — webpack Flight from async `page.tsx` then crashes. CSP still allows `'wasm-unsafe-eval'` for a future isolated viewer.

## Patterns

- Interim public theme from kia.id: white + `#05141f`, logo as `KiaLogo` component (`currentColor`)
- Official homepage guidelines still pending; current chrome is an adaptation of existing components
- Dealer/salesman login: password then email OTP when `USE_OTP=true`. Admin CMS skips OTP. Local without SMTP logs the code to the server console.
- Pre-sim dual links: snapshot `/pre-sim/[slug]` vs live `/credit-simulation?promo=[slug]` — never mix submit onto the QR page
- First-party analytics: public site only (ignore `/admin`, `/dealer`, `/auth`); DNT/bots dropped; no name/email/phone in events
- CMS files: widgets store URLs, not blobs. Images and PDFs go through `/api/admin/media/upload` + `Media` table under `kia_media/`. `MediaPicker` `kind="image"` (default, single) or `kind="document"` (`multiple` for the download widget). Public download cards are Server Components. Do not add `'use client'` to `WidgetRenderer` or `DownloadWidget`. Preview is a new tab, not EmbedPDF. Same trap as `FirstPartyPageview` imported from async `SiteLayout`. CSP still allows `'wasm-unsafe-eval'` for a future isolated viewer.
