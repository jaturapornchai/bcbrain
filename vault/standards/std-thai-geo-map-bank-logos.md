---
title: "ข้อมูลภูมิศาสตร์ไทย 77 จังหวัด แผนที่ปักหมุด และโลโก้ธนาคาร 40 แห่ง (Thai Geo, Map Picker, Bank Logos)"
tags: [standards, master-data, map, bank, frontend, postgres]
aliases: ["erp_province", "erp_amper", "erp_tambon", "7436 ตำบล", "รหัสไปรษณีย์", "BcMapPickerModal", "Leaflet OSM", "Nominatim", "ดึงธนาคาร", "erp_bank", "โลโก้ธนาคาร", "1.6.1 กำหนดธนาคาร", "menu_setup_bank", "thailand_geo.json"]
sources: ["docs/kms/KMS_BCWORK_UX_REPORT_AUTH_MAP_STANDARDS.md:18-25", "backend/internal/application/process/province_load.go:1", "backend/internal/application/process/province_load.go:22", "backend/internal/application/process/province_load.go:165", "frontend/shared/ui/BcMapPickerModal.tsx:211", "frontend/shared/ui/BcMapPickerModal.tsx:272", "frontend/shared/ui/BcMapPickerModal.tsx:332", "frontend/shared/ui/BcMapPickerModal.tsx:420", "frontend/account/master/StandardMasterScreen.tsx:848", "frontend/account/master/StandardMasterScreen.tsx:1125", "frontend/account/master/StandardMasterScreen.tsx:1795", "frontend/account/master/ThaiBankDirectoryModal.tsx:56", "frontend/account/master/ThaiBankDirectoryModal.tsx:133", "frontend/src/lib/thai-banks.ts:38", "frontend/src/config/schemas/icMasterSchemas.ts:708", "frontend/src/proxy.ts:35", "frontend/src/proxy.ts:68"]
---

# ข้อมูลภูมิศาสตร์ไทย แผนที่ปักหมุด และโลโก้ธนาคาร

Master data ที่อยู่ไทยครบ 77 จังหวัด พร้อมพิกัดและรหัสไปรษณีย์ ใช้กับแผนที่ปักหมุด และ Master ธนาคารมีโลโก้จริง 40 ธนาคาร

## ภูมิศาสตร์ไทย (จังหวัด / อำเภอ / ตำบล)
- ตาราง `erp_province`, `erp_amper`, `erp_tambon` (ตำบลเก็บ `zip_code`, `lat`, `lng` — `province_load.go:165-169`) โหลดจากไฟล์ฝังในโปรแกรม `province_data/thailand_geo.json` (`province_load.go:22`) ซึ่งหัวไฟล์ระบุ 77 จังหวัด / 928 อำเภอ / 7,436 ตำบล พร้อมชื่อไทย-อังกฤษ รหัสไปรษณีย์ 5 หลัก และพิกัด GPS ทุกระดับ (`province_load.go:7-8`)
- การโหลดทำจากเมนูตั้งค่าจังหวัด: ผู้ใช้ติ๊กจังหวัด แล้ว process เขียน `erp_province`/`erp_amper`/`erp_tambon` ทีละจังหวัด (ลบตามคีย์แล้ว insert; `province_load.go:1-6`, `ProvinceLoad` `:176`) โดยคงรหัสไปรษณีย์/สถานะเดิมของแถวที่มีอยู่ (`:169`)
- KMS เขียนว่า seed มาจาก `backend/cmd/seed_thai_geo/thai_tambons.json` (`KMS_BCWORK_UX_REPORT_AUTH_MAP_STANDARDS.md:19`) แต่ไม่มีโฟลเดอร์นี้ใน `backend/cmd` — ใช้ไฟล์ฝังข้างต้นแทน

## แผนที่ปักหมุด
- ตัวเลือกพิกัดคือ `frontend/shared/ui/BcMapPickerModal.tsx` (Leaflet + OpenStreetMap) มี 2 โหมด `picker` (ปักหมุด) และ `overview` (ภาพรวมหลายจุด) (`:420`) ใช้ในหน้าจอลูกค้า/เจ้าหนี้/คลัง/ตัวแทนจำหน่าย/ต้นไม้จังหวัด/ข้อมูลกิจการ/แท็บเสริมเอกสาร (`CustomerScreen`, `SupplierScreen`, `WarehouseScreen`, `DealerScreen`, `ProvinceTreeScreen`, `CompanyProfileForm`, `TransExtraTabs`)
- ช่องค้นหา (`searchThailandAddressAndCoords`, `:211`) รับ 3 แบบตามลำดับ: (1) วางพิกัด `lat, lng` หรือลิงก์ Google Maps; (2) ชื่อตำบล/อำเภอ/จังหวัด/รหัสไปรษณีย์ 5 หลัก ค้นจากตาราง `erp_tambon` JOIN `erp_amper` JOIN `erp_province` ให้คะแนนตามรหัสไปรษณีย์และชื่อ จำกัด 8 รายการ เฉพาะแถวที่มี `lat` (`:272-300`); (3) ที่อยู่ละเอียด/ถนน/อาคาร จาก Nominatim ของ OpenStreetMap จำกัดประเทศไทย 5 รายการ (`:332`) แล้วเลื่อนแผนที่ไปจุดนั้น (`map.setView`/`panTo`, `:511-513`)
- พิกัดเริ่มต้นเมื่อยังไม่มีค่า คือกรุงเทพ `13.756331` (`:102`, `:422`)
- โฟลเดอร์ `leaflet` ถูกยกเว้นใน `proxy.ts:36` และใน matcher `:68` เพื่อโหลดไอคอนแผนที่ได้โดยไม่ต้อง Auth Redirect

## โลโก้ธนาคาร 40 แห่ง (เมนู 1.6.1 กำหนดธนาคาร / `erp_bank`)
- เมนู 1.6.1 คือ `menu_setup_bank` (`icMasterSchemas.ts:708`) หน้าจอ `StandardMasterScreen.tsx` แสดงปุ่ม `ดึงธนาคาร` (`data-testid="btn-pull-thai-banks"`, `:1125-1134`) เฉพาะ `menuKey === "menu_setup_bank"` เปิด `ThaiBankDirectoryModal` (`:1795`) ให้เลือกธนาคารที่จะเพิ่ม
- ธนาคารที่เลือกถูกเขียนเข้า `erp_bank`: รหัสใหม่ = `INSERT` (`code`, `name_1`, `name_2`, `logo_url`, `status`), รหัสเดิม = `UPDATE` ชื่อ/โลโก้ (`:848-852`) และต้องมีสิทธิ์เพิ่ม/แก้ไขของจอนั้นก่อน (`:833-837`)
- รายการธนาคารเป็นข้อมูลคงที่ใน `frontend/src/lib/thai-banks.ts` (`THAI_BANKS`, `:38`, 40 รายการ ฟิลด์ `code`, `botCode` 3 หลักของ ธปท., `name1`/`name2`, `swiftCode`, `logoUrl`, `category`) และ `BankLogoBadge` (`ThaiBankDirectoryModal.tsx:56`) แสดงโลโก้
- ไฟล์ภาพโลโก้อยู่ `frontend/public/banks/` (ปัจจุบัน 40 ไฟล์ `.png` และ 35 ไฟล์ `.svg`; ค่า `logoUrl` ใน `thai-banks.ts` ทั้ง 40 รายการชี้ไฟล์ `.png` เช่น `:48`) และ `frontend/src/proxy.ts:35` ให้ path `/banks` เข้าถึงได้โดยไม่ต้อง Auth Redirect (ยกเว้นใน matcher `:68` ด้วย)

## ไฟล์ที่ KMS อ้างแต่ไม่พบในโค้ดปัจจุบัน
- `frontend/shared/ui/LocationMapPicker.tsx`, `frontend/account/master/LocationOverviewScreen.tsx` (หน้าที่เดียวกันอยู่ใน `BcMapPickerModal.tsx` โหมด `overview`), `frontend/account/master/ThaiBankCatalogModal.tsx` (ตัวจริงคือ `ThaiBankDirectoryModal.tsx`), `BankBadge` (ตัวจริงคือ `BankLogoBadge`)
- KMS บอกปุ่มชื่อ "ดึงธนาคารในประเทศไทย" อยู่ใน `MasterDetailScreen.tsx` (`KMS_BCWORK_UX_REPORT_AUTH_MAP_STANDARDS.md:25`) แต่ปุ่มจริงชื่อ `ดึงธนาคาร` และอยู่ใน `StandardMasterScreen.tsx`

## กฎใช้งาน
- ที่อยู่ในฟอร์ม Master/ลูกค้า/เจ้าหนี้ควรเลือกผ่านรายการจังหวัด-อำเภอ-ตำบลเพื่อให้ได้รหัสไปรษณีย์และพิกัดที่ตรงกัน
- ภาพ/ไอคอนใช้ไฟล์จริงใน repo เท่านั้น ไม่สร้างภาพจากบริการภายนอก ([[std-repo-scope-rules]])

## ที่มา
- `docs/kms/KMS_BCWORK_UX_REPORT_AUTH_MAP_STANDARDS.md:5-6` (Objective ข้อ 1–2), `:18-25` (Workflow §1–2)

## ดูเพิ่ม
[[standards-overview]] · [[std-input-controls-and-labels]] · [[std-screen-header-toolbar-theme]] · [[frontend-overview]]
