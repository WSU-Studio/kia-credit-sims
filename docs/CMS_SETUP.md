# CMS Back-Office Setup Guide

## Overview

Sistem CMS telah diimplementasikan dengan fitur-fitur berikut:

- ✅ Authentication (Login/Logout) dengan NextAuth
- ✅ Role-Based Access Control (RBAC) dengan granular permission per menu
- ✅ User Management
- ✅ Role & Permission Management
- ✅ Media Library dengan S3 integration
- ✅ CMS Modules: Banner, Product, Promo, Article, Static Pages, Footer Settings

## Setup Instructions

### 1. Environment Variables

Buat file `.env` di root project dengan konfigurasi berikut:

```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/kia-credit-sims?schema=public"

# NextAuth
NEXTAUTH_URL="http://localhost:3071"
NEXTAUTH_SECRET="your-secret-key-here" # Generate dengan: openssl rand -base64 32

# S3 Media Storage
AWS_S3_BUCKET="your-bucket-name"
AWS_REGION="ap-southeast-1"
AWS_ACCESS_KEY_ID="your-access-key"
AWS_SECRET_ACCESS_KEY="your-secret-key"

# KTP upload simulasi — `local` = simpan di `.data/` (tanpa AWS, aman untuk dev)
# `s3` = production/staging (default jika tidak di-set)
KTP_STORAGE=local

# Danger Zone — bulk purge semua leads (Settings). Matikan setelah soft launch selesai.
# ALLOW_LEADS_PURGE harus "true"; phrase dicek server-side (jangan pakai NEXT_PUBLIC_*).
ALLOW_LEADS_PURGE=false
LEADS_PURGE_CONFIRM_PHRASE="HAPUS-SEMUA-LEADS"
```

### 2. Database Setup

1. Buat database `kia-credit-sims` dan pastikan `DATABASE_URL` di `.env` mengarah ke sana (bukan DB HCFI).
2. Jalankan migration:
```bash
npm run db:migrate
```

3. Generate Prisma Client:
```bash
npm run db:generate
```

4. Seed database dengan data awal (menus, permissions, super admin):
```bash
npm run db:seed
```

⚠️ **PENTING:** Ganti password default setelah login pertama kali!

### 3. S3 Setup (untuk Media Library)

1. Buat S3 bucket di AWS (lihat `docs/MIGRATION_CLOUDINARY_TO_S3.md`)
2. Buat IAM user dengan permission S3 (PutObject, GetObject)
3. Tambahkan di `.env`:
   - `AWS_S3_BUCKET`
   - `AWS_REGION`
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`

Upload media dilakukan di server ke S3.

## Struktur CMS Modules

### Menu yang Tersedia:

1. **Dashboard** - Overview statistik
2. **User Management** - Kelola user dan assign roles
3. **Role & Permission** - Kelola roles dan permissions
4. **Banner Management** - Hero slider banners
5. **Product Section** - Product cards
6. **Promo Management** - Promo list & highlight
7. **Artikel/Berita** - Artikel/berita dengan rich text
8. **Static Pages** - Privacy Policy, T&C, dll
9. **Footer Settings** - Address, contacts, app links
10. **Media Library** - Upload & manage media files

## Permission System

Setiap role memiliki 4 jenis permission per menu:
- **View** - Bisa melihat menu & data
- **Create** - Bisa menambah data baru
- **Edit** - Bisa edit data existing
- **Delete** - Bisa hapus data

Super Admin memiliki full access ke semua menu.

## API Endpoints

### Admin APIs (Protected)
- `/api/admin/users` - User management
- `/api/admin/roles` - Role management
- `/api/admin/banners` - Banner CRUD
- `/api/admin/products` - Product CRUD
- `/api/admin/promos` - Promo CRUD
- `/api/admin/articles` - Article CRUD
- `/api/admin/pages` - Static page CRUD
- `/api/admin/footer` - Footer settings
- `/api/admin/media` - Media library

### Public APIs (No Auth Required)
- `/api/public/banners` - Get active banners
- `/api/public/products` - Get products
- `/api/public/benefits` - Get benefits
- `/api/public/promos` - Get active promos

## Routes

### Public Site
- `/` - Homepage (mengambil data dari CMS)
- `/simulasi-kredit` - Credit simulation page

### Back Office
- `/auth/login` - Login page
- `/auth/logout` - Logout
- `/admin/dashboard` - Dashboard
- `/admin/users` - User management
- `/admin/roles` - Role & permission management
- `/admin/banners` - Banner management
- `/admin/products` - Product management
- `/admin/promos` - Promo management
- `/admin/articles` - Article management
- `/admin/pages` - Static pages
- `/admin/footer` - Footer settings
- `/admin/media` - Media library

## Development

```bash
# Run development server
npm run dev

# Database studio (GUI untuk melihat data)
npm run db:studio
```

## Next Steps

1. ✅ Setup environment variables
2. ✅ Run database migration & seed
3. ✅ Login dengan super admin credentials
4. ✅ Buat roles sesuai kebutuhan (Editor, Viewer, dll)
5. ✅ Assign permissions ke masing-masing role
6. ✅ Buat user baru dan assign roles
7. ✅ Upload media ke S3 (jika digunakan)
8. ✅ Mulai manage content melalui CMS

## Notes

- Semua route `/admin/*` protected dengan middleware
- Permission check dilakukan di server-side untuk security
- Site components sudah terintegrasi dengan CMS (fallback ke default jika DB kosong)
- Media upload ke S3 (jika dikonfigurasi)

## Troubleshooting

**Error: "Unauthorized" atau redirect ke login**
- Pastikan sudah login
- Check session di browser

**Error: "Forbidden: Insufficient permissions"**
- User tidak memiliki permission untuk menu tersebut
- Super Admin bisa assign permission di Role Management

**Database connection error**
- Pastikan PostgreSQL running
- Check DATABASE_URL di `.env`
- Pastikan database `kia-credit-sims` sudah dibuat

**Media upload tidak bekerja**
- Pastikan AWS_S3_BUCKET, AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY di-set
- Pastikan IAM user memiliki permission S3 PutObject, GetObject


