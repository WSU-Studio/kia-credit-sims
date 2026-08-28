# Credit Simulation API Breakdown

Dokumentasi breakdown API untuk Credit Simulation berdasarkan Postman Collection `HCSR3 - Integration LOS Mobile X Website v1.1`.

## Base URL
```
{{base_url}} = https://qaapigwconfins.hyundaicapital.co.id/api/mobileloan
```

---

## Authentication

Semua request ke API data (vendor, asset, simulate, dll) memerlukan token dari Login.

1. **Login:** `POST {{base_url}}/v3/Auth/Login`
   - Body: `{ "username": "...", "password": "...", "IsRememberMe": true }`
   - Response: `{ "Token": "..." }`
2. **Header untuk request data:** Setiap panggilan ke endpoint data harus menyertakan header **`AdInsKey`** dengan nilai token dari Login (bukan `Authorization: Bearer`).

Env: `CREDIT_SIMULATION_USERNAME`, `CREDIT_SIMULATION_PASSWORD`. Implementasi: `lib/hyundai-api-client.ts` (`getHyundaiRequestHeaders()`).

---

## FASE 1: LEAD ASSET (Pemilihan Kendaraan)

### 1. Get List Vendor by Asset Code
**Endpoint:** `POST /Foundation/v1/VendorObX/GetListVendorForMLoanByAssetCode`

**Request:**
```json
{
  "Code": "4U" // Asset code (required)
}
```

**Response:**
```json
{
  "ReturnObject": [
    {
      "Key": "A11AD12406",
      "Value": "HYUNDAI TANGERANG CITY"
    }
  ],
  "HeaderObj": {
    "ResponseTime": "7 ms",
    "StatusCode": "200",
    "Message": "Success",
    "ErrorMessages": null
  }
}
```

**Kegunaan:** Mendapatkan daftar vendor/dealer berdasarkan asset code (misalnya "4U" untuk mobil).

---

### 2. Get List Vendor & City
**Endpoint:** `POST /Foundation/v1/VendorObX/GetListVendorAndVendorCity`

**Request:**
```json
{
  "hasAvailableAssetOnly": true,
  "hasCmoAssignedOnly": true
}
```

**Response:**
```json
{
  "ReturnObject": [
    {
      "VendorCode": "A11AD12406",
      "VendorName": "HYUNDAI TANGERANG CITY",
      "ZipCode": "15118",
      "City": "TANGERANG",
      "OriOfficeCode": "11",
      "OriOfficeName": "DKI JAKARTA"
    }
  ]
}
```

**Kegunaan:** Mendapatkan daftar vendor dengan informasi kota untuk filtering.

---

### 3. Get List Sales Person
**Endpoint:** `POST /v1/VendorEmp/GetListKeyValueActiveSalesPersonByVendorCode`

**Request:**
```json
{
  "Code": "A11AD60505" // Vendor code
}
```

**Response:**
```json
{
  "ReturnObject": [
    {
      "Key": "HYUNDAI.ACEH.EMP.UDIN",
      "Value": "HYUNDAI ACEH EMP UDIN"
    }
  ]
}
```

**Kegunaan:** Mendapatkan daftar sales person aktif di vendor tertentu (optional untuk form lead).

---

### 4. Get All Asset Master Lv2 (Model) with Starting Price
**Endpoint:** `POST /Foundation/v1/AssetMasterX/GetAllAssetMasterLvl2AndStartingPrice`

**Request:**
```json
{
  "AssetHierarchyLv1Code": "KIA",
  "CmoEmpNo": "",
  "DealerCode": "A11AD12404",
  "GetLatestAsset": true
}
```

**Response:**
```json
{
  "ListAssetMasterObj": [
    {
      "AssetCategoryName": "SUV",
      "AssetCode": "4U",
      "AssetName": "THE ALL NEW SANTA FE",
      "Price": 724000000.0,
      "FullAssetCode": "HYUNDAI4U",
      "ManufacturingYear": 2025
    }
  ]
}
```

**Kegunaan:** Mendapatkan daftar model mobil dengan harga starting (untuk dropdown pilihan model).

---

### 5. Get List Manufacturing Year by Model
**Endpoint:** `POST /Foundation/v2/AssetMasterForMobileX/GetListManufYearByModel`

**Request:**
```json
{
  "ModelCode": "4V",
  "DealerCode": "A11AD12404"
}
```

**Response:**
```json
{
  "ReturnObject": [
    {
      "Key": 2024,
      "Value": 2024
    },
    {
      "Key": 2025,
      "Value": 2025
    }
  ]
}
```

**Kegunaan:** Mendapatkan daftar tahun produksi berdasarkan model yang dipilih.

---

### 6. Get List Trim / Asset Variant
**Endpoint:** `POST /Foundation/v2/AssetMasterForMobileX/GetListAssetVariantByModelManufYear`

**Request:**
```json
{
  "ModelCode": "4V",
  "DealerCode": "A11AD12404",
  "ManufYear": 2024
}
```

**Response:**
```json
{
  "ReturnObject": [
    {
      "Key": "4VW7D5G1FEV1GG004",
      "Value": "SANTA FE HEV PRIME"
    }
  ]
}
```

**Kegunaan:** Mendapatkan daftar varian/trim berdasarkan model dan tahun produksi.

---

### 7. Get List Exterior Color
**Endpoint:** `POST /Foundation/v1/AssetMasterForMobileX/GetListExteriorColorByFscManufYear`

**Request:**
```json
{
  "FscCode": "4VW6D5G1FEV1HH004", // Trim code
  "ManufYear": 2024
}
```

**Response:**
```json
{
  "ReturnObject": [
    {
      "Key": "NB9",
      "Value": "MIDNIGHT BLACK PEARL"
    }
  ]
}
```

**Kegunaan:** Mendapatkan daftar warna eksterior berdasarkan trim dan tahun.

---

### 8. Get List Interior Color
**Endpoint:** `POST /Foundation/v1/AssetMasterForMobileX/GetListInteriorColorByFscManufYearExtColor`

**Request:**
```json
{
  "FscCode": "4VW6D5G1FEV1HH004",
  "ManufYear": 2024,
  "ExtColorCode": "NB9"
}
```

**Response:**
```json
{
  "ReturnObject": [
    {
      "Key": "4NB",
      "Value": "BLACK"
    }
  ]
}
```

**Kegunaan:** Mendapatkan daftar warna interior berdasarkan eksterior color yang dipilih.

---

## FASE 2: SIMULASI KREDIT (Perhitungan)

### 9. Get List Default Product from Rule
**Endpoint:** `POST /v1/IntegrationWebsite/GetListDefaultProductNameFromRuleByLeadNo`

**Request:**
```json
{
  "LeadNo": "{{LeadNo}}" // Lead number (dari create lead)
}
```

**Response:**
```json
{
  "ReturnObject": [
    {
      "ProductName": "Lo Cicilan Paling Murah Creta",
      "MrInstSchemeCode": "RF",
      "InstSchemeName": "Regular Fixed"
    }
  ]
}
```

**Kegunaan:** Mendapatkan daftar produk default berdasarkan rule (untuk dropdown produk). API ini lebih cepat karena tanpa calculation.

---

### 10. Get List Product (Dengan Kalkulasi)
**Endpoint:** `POST /v1/IntegrationWebsite/GetListProductFromRuleByLeadNo`

**Request:**
```json
{
  "LeadNo": "{{LeadNo}}"
}
```

**Response:**
```json
{
  "ListProductObj": [
    {
      "ProductCode": "RF",
      "ProductName": "Loan Low DP",
      "TdpAmt": 125610249, // Down Payment Amount
      "InstallmentAmt": 25388800, // Angsuran per bulan
      "InstallmentSchemeCode": "RF",
      "Default": true,
      "DPPrcnt": 10, // DP Percentage
      "DPPrcntBhv": "Min", // Min/Max behavior
      "Tenor": 36, // Tenor dalam bulan
      "FirstInstallment": "ADDB", // First installment behavior
      "EffRatePrcnt": 15, // Effective rate percentage
      "EffRateBhv": "LOCK",
      "BalloonAmt": 0,
      "DefermentPeriod": 0,
      "AdminFeeAmt": 2000000,
      "AdminFeeCptlz": false,
      "ProvisionType": "PRCNT",
      "ProvisionFee": 2,
      "FiduciaFeeAmt": 1000000,
      // ... fields lainnya
    }
  ]
}
```

**Kegunaan:** Mendapatkan daftar produk dengan kalkulasi lengkap (DP, angsuran, tenor, bunga, dll). **Ini adalah API utama untuk simulasi kredit.**

---

## USER EXPERIENCE FLOW

### Flow Simulasi Kredit untuk Beli Mobil:

#### **Step 1: Pilih Lokasi/Dealer**
- User memilih kota (filter by city)
- User memilih dealer/vendor
- **API:** `GetListVendorAndVendorCity`

#### **Step 2: Pilih Model Mobil**
- System menampilkan daftar model mobil berdasarkan dealer
- Setiap model menampilkan:
  - Nama model (e.g., "THE ALL NEW SANTA FE")
  - Kategori (SUV, EV, MPV)
  - Harga starting (e.g., "Mulai dari Rp 724.000.000")
- **API:** `GetAllAssetMasterLvl2AndStartingPrice`

#### **Step 3: Pilih Spesifikasi**
Setelah memilih model, user pilih:
1. **Tahun Produksi**
   - **API:** `GetListManufYearByModel`
2. **Varian/Trim** (e.g., "PRIME", "CALLIGRAPHY")
   - **API:** `GetListAssetVariantByModelManufYear`
3. **Warna Eksterior**
   - **API:** `GetListExteriorColorByFscManufYear`
4. **Warna Interior**
   - **API:** `GetListInteriorColorByFscManufYearExtColor`

#### **Step 4: Input Harga OTR & Simulasi**
- User input **Harga OTR** (On The Road)
- System create **Lead** terlebih dahulu (jika belum ada)
- System hitung simulasi menggunakan **API: `GetListProductFromRuleByLeadNo`**

#### **Step 5: Tampilkan Hasil Simulasi**
Hasil simulasi menampilkan:
- **Down Payment (DP)**
  - Nominal (Rp)
  - Persentase (%)
- **Tenor** (12, 24, 36, 48, 60 bulan)
- **Angsuran per Bulan**
- **Bunga Efektif** (%)
- **Biaya Admin**
- **Biaya Provisi**
- **Biaya Fiducia**
- **Total yang harus dibayar**

#### **Step 6: Pilih Produk/Compare**
- System menampilkan beberapa opsi produk (jika ada)
- User bisa compare produk berbeda
- **API:** `GetListDefaultProductNameFromRuleByLeadNo` (untuk dropdown quick select)

#### **Step 7: Submit Lead / Apply Now**
- User bisa submit lead ke system
- Redirect ke WhatsApp dengan message prefilled
- Atau submit form untuk follow-up oleh sales

---

## IMPORTANT NOTES

1. **Create Lead First:** Sebelum simulasi, harus create Lead terlebih dahulu. LeadNo diperlukan untuk API simulasi.

2. **Dependency Chain:**
   ```
   DealerCode → ModelCode → ManufYear → FscCode (Trim) → ExtColorCode → InteriorColor
   ```

3. **Harga OTR:** User harus input harga OTR manual (bisa dari konfigurasi trim atau input manual).

4. **Asset Code:** Diambil dari catalog Confins per `AssetHierarchyLv1Code` KIA (lihat `lib/brand.ts`).

5. **Response Structure:** Semua API menggunakan struktur response standar dengan `ReturnObject`, `HeaderObj`, `StatusCode`, dll.

---

## REKOMENDASI IMPLEMENTASI

### Component Structure:
```
simulasi-kredit/
  ├── page.tsx (main page)
  ├── components/
  │   ├── DealerSelector.tsx
  │   ├── ModelSelector.tsx
  │   ├── SpecificationSelector.tsx (Tahun, Trim, Warna)
  │   ├── SimulationForm.tsx (Harga OTR input)
  │   ├── SimulationResult.tsx (Display hasil)
  │   ├── ProductComparison.tsx (Compare produk)
  │   └── LeadSubmission.tsx (Apply Now / WhatsApp)
  └── hooks/
      ├── useCreditSimulation.ts
      ├── useDealerList.ts
      ├── useAssetMaster.ts
      └── useProductCalculation.ts
```

### State Management:
- Gunakan React Hook Form untuk form handling
- Zod untuk validation
- Context atau Zustand untuk shared state (LeadNo, selected specs)

### UX Considerations:
- Progressive disclosure: hanya tampilkan field yang relevan
- Loading states untuk setiap API call
- Error handling dengan fallback messages
- Validation real-time
- Auto-save progress (localStorage)

---

## NEXT STEPS

1. ✅ Breakdown API selesai
2. ⏳ Design component structure
3. ⏳ Create TypeScript types
4. ⏳ Implement form components
5. ⏳ Integrate API endpoints
6. ⏳ Testing & validation
