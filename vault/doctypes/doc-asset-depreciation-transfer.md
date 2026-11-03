---
title: "โอนค่าเสื่อมราคาสินทรัพย์ (Depreciation Transfer)"
tags: [doctypes, asset]
aliases: ["trans_flag 1801", "สินทรัพย์_โอนค่าเสื่อม", "โอนค่าเสื่อม", "menu_asset_transfers", "FADepreciation"]
sources: ["frontend/account/tabs/screenRegistry.tsx:1107", "frontend/account/process/SystemProcessWorkbenchScreen.tsx:566", "backend/internal/application/process/fa_depreciation.go:3", "backend/internal/application/process/fa_depreciation.go:29", "backend/internal/application/process/fa_depreciation.go:32", "backend/internal/application/process/fa_depreciation.go:794", "backend/internal/application/process/fa_depreciation.go:837", "backend/internal/application/process/fa_depreciation.go:858", "backend/internal/application/process/fa_depreciation.go:995"]
---

# โอนค่าเสื่อมราคาสินทรัพย์ (trans_flag 1801)

## ใช้เมื่อไร
ใช้คำนวณและบันทึกค่าเสื่อมราคาของสินทรัพย์ในช่วงวันที่ ผ่านเมนู `menu_asset_transfers` ซึ่งเป็นหน้าจอ process "fa_depreciation" (screenRegistry.tsx:1107)

## trans_flag/ตาราง
- 1 เอกสาร = หัวเอกสาร [[tbl-as-trans]] 1801 + [[tbl-as-trans-detail]] 1 แถวต่อสินทรัพย์ + [[tbl-gl-journal]] (comment fa_depreciation.go:3)
- ข้อมูลดิบคือ as_asset_detail และการขาย 1802 ส่วนเอกสาร 1801 เป็นผลลัพธ์ที่ลบแล้วสร้างใหม่ตาม doc_no ใน transaction เดียว จึงรันซ้ำได้ผลเท่าเดิม (comment fa_depreciation.go:10)

## ฟิลด์/แท็บบนหน้าจอ
- ช่วงวันที่และวิธีนับวัน: 0 = จำนวนวันสรรพากร, 1 = จำนวนวันบัญชี (30/360), 2 = จำนวนวันจริง (fa_depreciation.go:32-34)
- คิดแบบเส้นตรงอย่างเดียว (comment fa_depreciation.go:4)

## ผลต่อสต็อก
ไม่มี

## ผลต่อภาษี (VAT/WHT)
ไม่มี

## การลงบัญชี
บันทึกผ่าน `FADepreciation` (fa_depreciation.go:794) และ insert gl_journal ที่ fa_depreciation.go:995
| Dr | Cr |
|---|---|
| depreciation_account_code (ค่าเสื่อมราคา) ของสินทรัพย์ | depreciation_sum_account_code (ค่าเสื่อมราคาสะสม) |

- ถ้าเดบิตไม่เท่ากับเครดิตเพราะสินทรัพย์ไม่มีผังบัญชีครบ ระบบจะไม่บันทึก (fa_depreciation.go:837)

## เอกสารต้นทาง-ปลายทาง
- ปลายทาง: ขายสินทรัพย์ 1802 ใช้ยอด Σ 1801 เป็นค่าเสื่อมสะสม (comment fa_sale.go:28)

## ยกเลิก/แก้ไข
- ลบทั้งเอกสาร (as_trans + detail + journal) ผ่าน `deleteFADepreciation` (fa_depreciation.go:858)
- ระบบไม่ยอมลบถ้าสินทรัพย์ในเอกสารถูกขายไปแล้ว (fa_depreciation.go:875 และ comment SystemProcessWorkbenchScreen.tsx:566)

## ข้อควรระวัง
- มีการตรวจช่วงวันที่ซ้อนกับเอกสาร 1801 เดิม (`checkDepOverlap` fa_depreciation.go:935)

## ที่มาในโค้ด
- `frontend/account/tabs/screenRegistry.tsx:1107` เมนู
- `backend/internal/application/process/fa_depreciation.go:3` คำอธิบาย
- `backend/internal/application/process/fa_depreciation.go:794` FADepreciation
- `backend/internal/application/process/fa_depreciation.go:858` deleteFADepreciation

## ดูเพิ่ม
- [[doc-asset-sale]] · [[acc-fixed-asset-depreciation]] · [[doctypes-overview]]
