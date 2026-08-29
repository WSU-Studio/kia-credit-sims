# OpenMemory Guide

Living project index for `kia-credit-sims` (KIA financing site).

## Overview

Fork of `hfci-credit-sims` for Hyundai Capital KIA financing. Engine (LOS Confins, CMS, admin, dealer portal, simulation wizard) is reused. Public chrome uses an interim KIA theme (white / `#05141f`) adapted from kia.id until official design guidelines arrive.

## Architecture

- Next.js App Router + Prisma + NextAuth + next-intl
- Confins brand filter is centralized in `lib/brand.ts` (`hierarchyLv1Code: KIA`)
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

## Patterns

- Interim public theme from kia.id: white + `#05141f`, logo as `KiaLogo` component (`currentColor`)
- Official homepage guidelines still pending; current chrome is an adaptation of existing components
