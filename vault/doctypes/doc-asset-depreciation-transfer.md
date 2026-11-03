---
title: "โอนค่าเสื่อมราคาสินทรัพย์ (Depreciation Transfer)"
tags: [doctypes, asset]
aliases: ["trans_flag 1801", "สินทรัพย์_โอนค่าเสื่อม", "โอนค่าเสื่อม", "menu_asset_transfers", "FADepreciation"]
sources: ["frontend/account/tabs/screenRegistry.tsx:1107", "frontend/account/process/SystemProcessWorkbenchScreen.tsx:565", "frontend/account/process/SystemProcessWorkbenchScreen.tsx:577", "frontend/account/process/SystemProcessWorkbenchScreen.tsx:1373", "frontend/account/process/SystemProcessWorkbenchScreen.tsx:111", "backend/internal/adapter/inbound/http/process/workflow_handler.go:73", "backend/internal/application/process/fa_depreciation.go:29", "backend/internal/application/process/fa_depreciation.go:32", "backend/internal/application/process/fa_depreciation.go:590", "backend/internal/application/process/fa_depreciation.go:654", "backend/internal/application/process/fa_depreciation.go:719", "backend/internal/application/process/fa_depreciation.go:783", "backend/internal/application/process/fa_depreciation.go:794", "backend/internal/application/process/fa_depreciation.go:837", "backend/internal/application/process/fa_depreciation.go:858", "backend/internal/application/process/fa_depreciation.go:935", "backend/internal/application/process/fa_depreciation.go:995"]
---

# โอนค่าเสื่อมราคาสินทรัพย์ (trans_flag 1801)

## ใช้เมื่อไร
ใช้คำนวณและบันทึกค่าเสื่อมราคาของสินทรัพย์ในช่วงวันที่ ผ่านเมนู `menu_asset_transfers` "โอนข้อมูลเข้าระบบบัญชี" ซึ่งเปิดหน้าจอ process โหมด "fa_depreciation" (screenRegistry.tsx:1107)
- ปุ่ม "ประมวลผล" แสดงผลอย่างเดียว ปุ่ม "บันทึก" บันทึกจริง ทั้งสองเรียก workflow `fa-depreciation` (SystemProcessWorkbenchScreen.tsx:577, workflow_handler.go:73)
- ปุ่ม "ลบ" ลบทั้งเอกสาร (SystemProcessWorkbenchScreen.tsx:567)

## trans_flag/ตาราง
- 1 เอกสาร = หัวเอกสาร [[tbl-as-trans]] 1801 + [[tbl-as-trans-detail]] 1 แถวต่อสินทรัพย์ + [[tbl-gl-journal]] / gl_journal_detail (`insertDepDoc` fa_depreciation.go:964)
- ข้อมูลตั้งต้นอ่านจาก as_asset_detail + as_asset และวันที่ขาย 1802 (`loadDepSources` fa_depreciation.go:654)
- บันทึกซ้ำเลขที่เดิมจะลบ as_trans / as_trans_detail / gl_journal / gl_journal_detail ของเลขนั้นแล้วสร้างใหม่ใน transaction เดียว (fa_depreciation.go:823)

## ฟิลด์/แท็บบนหน้าจอ
- ช่วงวันที่, แสดงค่าเสื่อมราคา (1 รายวัน / 2 รายเดือน / 3 รายปี) และวิธีคำนวณ (0 สรรพากร 365 วัน / 1 บัญชี 30/360 วัน / 2 ตามจำนวนวันจริง) (SystemProcessWorkbenchScreen.tsx:1373-1388, fa_depreciation.go:32-38)
- ช่วงรหัสสินทรัพย์ ประเภทสินทรัพย์ แผนก (`FA_RANGE_FIELDS` SystemProcessWorkbenchScreen.tsx:111)
- เลขที่เอกสาร, วันที่เอกสาร (ว่าง = ถึงวันที่), สมุดรายวัน, หมายเหตุ (SystemProcessWorkbenchScreen.tsx:1395-1406)
- backend: ไม่ส่ง processBy ใช้รายเดือน ไม่ส่ง processMode ใช้วิธีบัญชี แบบรายวันช่วงวันที่ต้องไม่เกิน 366 วัน (`normalizeFADepreciation` fa_depreciation.go:590, :614)

## ผลต่อสต็อก
ไม่มี

## ผลต่อภาษี (VAT/WHT)
ไม่มี

## การลงบัญชี
บันทึกผ่าน `FADepreciation` (fa_depreciation.go:794) และ insert gl_journal ที่ fa_depreciation.go:995 โดยตั้ง trans_direct = 1

| Dr | Cr |
|---|---|
| depreciation_account_code (ค่าเสื่อมราคา) ของสินทรัพย์ | depreciation_sum_account_code (ค่าเสื่อมราคาสะสม) ของสินทรัพย์ |

- รวมยอดเป็น 1 บรรทัดต่อรหัสบัญชี สินทรัพย์ที่ไม่มีรหัสบัญชีจะไม่มีบรรทัด (`depGLLines` fa_depreciation.go:719)
- ปัดเศษแบบ half-up ตามจำนวนทศนิยม erp_option.item_amount_decimal ถ้าไม่มีค่าใช้ 2 (`faAmountScale` fa_depreciation.go:783)
- ถ้าเดบิตไม่เท่ากับเครดิตเพราะสินทรัพย์มีรหัสบัญชีไม่ครบ ระบบจะไม่บันทึก (fa_depreciation.go:837)
- สมุดรายวันมาจากช่องสมุดรายวัน หรือ gl_book ของรูปแบบเอกสาร และต้องมีใน gl_journal_book (`resolveDepDoc` fa_depreciation.go:895)

## เอกสารต้นทาง-ปลายทาง
- สินทรัพย์ที่ขาย (1802) ก่อนหรือในวันเริ่มต้นช่วงจะไม่ถูกคิดค่าเสื่อม (fa_depreciation.go:499)
- ปลายทาง: ขายสินทรัพย์ 1802 ใช้ as_sum_value_balance + Σ ยอด 1801 ของสินทรัพย์เป็นค่าเสื่อมสะสม (`loadSaleAssets` fa_sale.go:286) ดู [[doc-asset-sale]]

## ยกเลิก/แก้ไข
- ไม่มีเอกสารยกเลิก ลบทั้งเอกสาร (as_trans + detail + journal) ผ่าน `deleteFADepreciation` (fa_depreciation.go:858)
- ระบบไม่ยอมลบถ้าสินทรัพย์ในเอกสารถูกขาย (1802) ในหรือหลังวันที่เอกสาร (fa_depreciation.go:874)
- การลบตรวจว่างวดบัญชีของวันที่เอกสารยังไม่ปิด (`checkPeriodNotClosed` fa_depreciation.go:877) ส่วนการบันทึกไม่ตรวจงวดบัญชี (fa_depreciation.go:793)

## ข้อควรระวัง
- สินทรัพย์ที่อยู่ในเอกสาร 1801 อื่นที่ช่วงวันที่ซ้อนกันจะบันทึกไม่ได้ ต้องแก้เอกสารเดิมแทน (`checkDepOverlap` fa_depreciation.go:935)
- ไม่ระบุเลขที่เอกสาร ระบบใช้เอกสาร 1801 ที่มีช่วงวันที่ตรงกันพอดีถ้ามีใบเดียว (`resolveDepDoc` fa_depreciation.go:895)

## ที่มาในโค้ด
- `frontend/account/tabs/screenRegistry.tsx:1107` เมนู
- `frontend/account/process/SystemProcessWorkbenchScreen.tsx:565` ประมวลผล/บันทึก/ลบ
- `backend/internal/application/process/fa_depreciation.go:794` FADepreciation
- `backend/internal/application/process/fa_depreciation.go:858` deleteFADepreciation
- `backend/internal/application/process/fa_depreciation.go:964` insertDepDoc

## ดูเพิ่ม
- [[doc-asset-sale]] · [[acc-fixed-asset-depreciation]] · [[doctypes-overview]]
