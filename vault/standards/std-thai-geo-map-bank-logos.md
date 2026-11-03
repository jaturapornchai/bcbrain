---
title: "ข้อมูลภูมิศาสตร์ไทย 77 จังหวัด แผนที่ปักหมุด และโลโก้ธนาคาร 40 แห่ง (Thai Geo, Map Picker, Bank Logos)"
tags: [standards, master-data, map, bank, frontend, postgres]
aliases: ["erp_province", "erp_amper", "erp_tambon", "7436 ตำบล", "รหัสไปรษณีย์", "LocationMapPicker", "Leaflet OSM", "Nominatim", "ดึงธนาคารในประเทศไทย", "erp_bank", "โลโก้ธนาคาร", "1.6.1 กำหนดธนาคาร"]
sources: ["docs/kms/KMS_BCWORK_UX_REPORT_AUTH_MAP_STANDARDS.md", "frontend/shared/ui/BcMapPickerModal.tsx", "frontend/src/proxy.ts:35", "frontend/src/lib/thai-banks.ts", "frontend/public/banks", "backend/internal/application/process/province_load.go"]
---

# ข้อมูลภูมิศาสตร์ไทย แผนที่ปักหมุด และโลโก้ธนาคาร

Master data ที่อยู่ไทยครบ 77 จังหวัด พร้อมพิกัดและรหัสไปรษณีย์ ใช้กับแผนที่ปักหมุด และ Master ธนาคารมีโลโก้จริง 40 ธนาคาร

## ภูมิศาสตร์ไทยและแผนที่
- ตาราง `erp_province` (77 จังหวัด), `erp_amper` (928 อำเภอ), `erp_tambon` (7,436 ตำบล) เก็บ `zip_code`, `latitude`, `longitude` ครบ (ที่มาข้อมูล seed ตาม KMS คือ `backend/cmd/seed_thai_geo/thai_tambons.json`)
- ตัวเลือกปักหมุด: คอมโพเนนต์แผนที่ Leaflet/OSM (KMS เรียก `LocationMapPicker`, สูงเริ่มต้น 380 px; หน้ารวม `LocationOverviewScreen` สูง 460 px) ผู้ใช้ลากและปักหมุดได้
- ช่องค้นหาแผนที่: พิมพ์ชื่อตำบล/อำเภอ/จังหวัด/รหัสไปรษณีย์ หรือพิกัด `lat, lng` → ค้นจาก Local Geo Index (7,436 ตำบล) และ Nominatim แล้ว `flyTo` ไปปักหมุดทันที
- ตรวจโค้ดจริง: ตัวเลือกแผนที่ที่มีอยู่คือ `frontend/shared/ui/BcMapPickerModal.tsx`; ตรรกะโหลดจังหวัดอยู่ `backend/internal/application/process/province_load.go` (+ `master_detail_specs.go`); โฟลเดอร์ `leaflet` ถูกยกเว้นใน matcher ของ `proxy.ts:68`

## โลโก้ธนาคาร 40 แห่ง (เมนู 1.6.1 กำหนดธนาคาร / `erp_bank`)
- ไฟล์ภาพโลโก้เก็บที่ `frontend/public/banks/*.png` (ตรวจพบ 75 ไฟล์ในโฟลเดอร์) และ `frontend/src/proxy.ts` ให้ path `/banks` เข้าถึงได้โดยไม่ต้อง Auth Redirect (`proxy.ts:35`, และยกเว้นใน matcher `:68`)
- หน้า 1.6.1 (`MasterDetailScreen.tsx`) มีปุ่ม `"ดึงธนาคารในประเทศไทย"` เปิด modal รายการธนาคารเพื่อเลือกเพิ่มพร้อมโลโก้ทันที
- รายการธนาคารไทยเป็นข้อมูลคงที่ใน `frontend/src/lib/thai-banks.ts` (604 บรรทัด)

## ไฟล์ที่ KMS อ้างแต่ไม่พบแล้ว (ไฟล์อ้างอิงไม่พบแล้ว)
- `frontend/shared/ui/LocationMapPicker.tsx`, `frontend/account/master/LocationOverviewScreen.tsx`, `frontend/account/master/ThaiBankCatalogModal.tsx`
- `backend/cmd/seed_thai_geo/thai_tambons.json` (ไม่มีโฟลเดอร์ `seed_thai_geo`)
- `BankBadge` — ไม่พบ

## กฎใช้งาน
- ที่อยู่ในฟอร์ม Master/ลูกค้า/เจ้าหนี้ควรเลือกผ่านรายการจังหวัด-อำเภอ-ตำบลเพื่อให้ได้รหัสไปรษณีย์และพิกัดที่ตรงกัน
- ภาพ/ไอคอนใช้ไฟล์จริงใน repo เท่านั้น (ไม่สร้างภาพจากบริการภายนอก — ดู [[std-repo-scope-rules]])

## ที่มา
- `docs/kms/KMS_BCWORK_UX_REPORT_AUTH_MAP_STANDARDS.md` Objective ข้อ 1–2, Workflow §1–2

## ดูเพิ่ม
[[standards-overview]] · [[std-input-controls-and-labels]] · [[std-screen-header-toolbar-theme]] · [[frontend-overview]]
