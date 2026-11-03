---
title: "ปี พ.ศ. / ค.ศ. และประเภทปี (Buddhist year / erp_option.year_type)"
tags: [glossary, date, option]
aliases: ["พ.ศ.", "ค.ศ.", "พุทธศักราช", "คริสต์ศักราช", "ประเภทปี", "ปีไทย", "ปีพุทธ", "ปี 2569", "Buddhist year", "year_type", "erp_option.year_type", "bc_year_type", "formatBcDate", "setBcYearType", "getBcYearType", "glYearBuddhist", "th-TH", "+543"]
sources: ["frontend/src/config/schemas/erpOption/tab1System.ts:22", "frontend/src/lib/numeric.ts:399", "frontend/src/lib/numeric.ts:417", "frontend/src/lib/numeric.ts:422", "frontend/account/config/OptionsForm.tsx:297", "frontend/account/transaction/JournalTaxTabs.tsx:518", "frontend/account/transaction/JournalTaxTabs.tsx:890", "frontend/account/master/MasterDetailScreen.tsx:68", "backend/internal/application/process/gl_post.go:57", "backend/internal/application/process/doc_picture.go:22", "backend/internal/application/process/doc_picture.go:242", "backend/internal/application/process/journaltax.go:208"]
---

# ปี พ.ศ. / ค.ศ.

## ในระบบนี้คืออะไร
- **ฐานข้อมูลเก็บวันที่เป็นปี ค.ศ. เสมอ** (รูปแบบ `YYYY-MM-DD`) ส่วนหน้าจอแปลงเป็น พ.ศ. ตามตัวเลือกในระบบ (คอมเมนต์ลุงจืด 2026-10-24, `journaltax.go:208`; `MasterDetailScreen.tsx:68`)
- ตัวเลือก "ประเภทปี" อยู่ที่ `erp_option.year_type` (`tab1System.ts:22-28`)

| `year_type` | ป้ายบนจอ | ตัวอย่างการแสดงผล (`numeric.ts:417-420`) |
|---|---|---|
| 0 | คริสต์ศักราช | 23/10/2026 |
| 1 | พุทธศักราช | 23/10/2569 |

## ฝั่งหน้าจอ
- `formatBcDate` แปลง ISO เป็น `DD/MM/YYYY` และบวก 543 เมื่อ `year_type = 1` ถ้าปีที่เข้ามามากกว่า 2400 จะลบ 543 ออกก่อน เพื่อรับค่าที่เป็น พ.ศ. อยู่แล้ว (`numeric.ts:422-436`)
- เมื่อบันทึกตัวเลือก ระบบเรียก `setBcYearType` (`OptionsForm.tsx:297`) และจำค่าไว้ใน localStorage key `bc_year_type` (`numeric.ts:399-414`)
- แท็บภาษีแสดงและรับปีตาม `year_type` แต่บันทึกเป็น ค.ศ. (`JournalTaxTabs.tsx:518`, `:890`)

## ฝั่ง backend (ค่าที่ต้องเป็น พ.ศ. จริง)
- คำอธิบายรายการบัญชีที่ระบบสร้างอัตโนมัติจัดรูปวันที่ตาม th-TH เมื่อ `year_type = 1` (`glYearBuddhist`, `gl_post.go:57-60`) ดู [[term-gl-journal]]
- key ของรูปเอกสาร GL ใน `bc_doc_images` ใช้วันที่แบบ `d/MM/yyyy` ตามปีนี้ (`doc_picture.go:20-23`)
- **ถ้า `erp_option` ไม่มีแถว ระบบถือว่าเป็น พ.ศ.** (ตามค่าเริ่มต้นของโปรแกรม desktop) แต่ถ้ามีแถว จะเป็น พ.ศ. เฉพาะเมื่อ `year_type = 1` (`doc_picture.go:242-249`)

## ข้อควรระวัง
- ห้ามเก็บปี พ.ศ. ลงคอลัมน์วันที่ ให้แปลงเฉพาะตอนแสดงผล
- `erp_account_period.period_year` ที่ปุ่มคำนวณอัตโนมัติสร้างให้เป็น พ.ศ. (+543) ดู [[term-account-period]]
- บาง schema เก็บ `year_type` เป็น varchar backend จึงอ่านด้วย `::text` (`gl_post.go:58`)

## ลิงก์
[[std-ux-buddhist-year-bilingual]] · [[term-account-period]] · [[term-doc-no-doc-date]] · [[glossary-overview]]

## ที่มาในโค้ด
- `frontend/src/config/schemas/erpOption/tab1System.ts:22-28`
- `frontend/src/lib/numeric.ts:399-436`
- `frontend/account/config/OptionsForm.tsx:297`
- `frontend/account/transaction/JournalTaxTabs.tsx:518`, `:890`; `frontend/account/master/MasterDetailScreen.tsx:68`
- `backend/internal/application/process/gl_post.go:57-60`
- `backend/internal/application/process/doc_picture.go:20-23`, `:242-249`
- `backend/internal/application/process/journaltax.go:208`
