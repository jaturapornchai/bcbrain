---
title: "งานค้างที่ยังเปิดอยู่ (Open Items Verified Against Code)"
tags: [history, todo, open-items]
aliases: ["TODO ค้าง", "open items", "งานค้าง"]
sources: ["TODO.md:93-109", "docs/HANDOFF_BCCM_PARITY_2026-10-22.md:50-77", "backend/internal/application/process/service.go:2058", "git:4341ae81"]
---

## ภาพรวม
ตรวจ 2026-10-31 กับ working tree (HEAD `3ac50564`) และ `git log` ถึง 2026-10-29 รวม 56 ข้อ: **ยังเปิด 20 / ปิดแล้ว 21 / ยืนยันไม่ได้ 15** (แถวรวมนับตามจำนวนข้อ)
- ย่อ path: `P/` = `backend/internal/application/process/`, `F/` = `frontend/`
- มีไฟล์แก้ยังไม่ commit (`git status --short`) ผลที่พึ่งส่วนนี้มีข้อเดียวคือ H-20 ที่เหลือยืนยันกับ HEAD ด้วย `git grep`
- รหัส handoff ข้อ 8 เป็นป้ายสั้นไม่มีนิยามในโค้ด ข้อที่ตีความจากชื่อระบุ "(ตีความ)"; ตรวจฝั่งโค้ดอย่างเดียว ไม่ได้เปิดฐานหรือรัน UAT

## 1. TODO.md (คิวถัดไป + ค้างรอคำตอบ)
เอกสารแตะล่าสุด `8bd921d1` (2026-10-19) ยังอ้าง path เก่า `src/components/tabs/`

| รหัส | ความหมาย | สถานะ | หลักฐาน |
|---|---|---|---|
| T-1 | `docs/api-contract.md` | ยังเปิด | `ls docs` ไม่มีไฟล์นี้ |
| T-2 | `CLAUDE.md` โปรเจกต์ | ปิดแล้ว | อยู่ใน `git ls-files` |
| T-3 | จอผู้ดูแล 7 เมนู | ปิดแล้ว | `adminMenu.ts:24` ไม่มี `status: "todo"`; `ExtraAdminScreens.tsx:33-815` |
| T-4 | แท็บ MIS 3 ช่อง `resource_only` | ยังเปิด | `F/src/config/schemas/erpOption/tab6Mis.ts:7-42` |
| T-5 | ปุ่มลงทะเบียนร้านค้า/แก้รหัสผ่าน | ยังเปิด | `tab6Mis.ts:13` มีแค่คอมเมนต์ ไม่มีปุ่ม |
| T-6 | หน้าต่างค้นหา (แว่นขยาย) | ปิดแล้ว | `F/account/master/BcLookupModal.tsx`, `SchemaForm.tsx:43` |
| T-7 | ช่องรูป/ลายมือชื่ออัปโหลดไม่ได้ | ยังเปิด | `F/account/form/FieldControl.tsx:273-281` ยังเป็นกล่องเปล่า |

## 2. Handoff BCCM ข้อ 3 และ 6

| รหัส | ความหมาย | สถานะ | หลักฐาน |
|---|---|---|---|
| H-B1 | save พร้อมกันได้ `deadlock detected` | ปิดแล้ว (ระดับโค้ด) | `4341ae81`: `P/service.go:992-1003` ล็อกสินค้าเรียงลำดับ ใช้ที่ `P/trans.go:400` |
| H-B2 | ค่าเสื่อมลดลง age=3 ได้ 78.46 ไม่ใช่ 78.54 | ปิดแล้ว | `906c5b45`: `P/asset_depreciation.go:86-89`; เทสต์ `asset_depreciation_test.go:157` |
| H-RSZ | ตัวลากคอลัมน์รายงานไม่ขยาย | ยืนยันไม่ได้ | ทางหลบที่ `F/account/report/UniversalReportScreen.tsx:1668`; ไม่ได้รันเบราว์เซอร์ |
| H-S6a-c | merge main / blueprint report / ลบ worktree | ปิดแล้ว | `62c7098f`, `58fe0ccf` |
| H-S6d | ลบข้อมูล ZZ4-, drop DB scratch, deploy | ยืนยันไม่ได้ | ไม่ได้เปิดฐาน; เห็นแค่ `4ad63bd2` |

## 3. Handoff ข้อ 8 "Open items"

| รหัส | ความหมาย | สถานะ | หลักฐาน |
|---|---|---|---|
| H-1 | GL-CLOSED-PERIOD (ตีความ: rebuild GL งวดปิด) | ยังเปิด | save ตรวจแล้ว `P/trans_validate.go:44-45`; rebuild อ่านงวดไม่ดู `status` `P/service.go:1587-1597` |
| H-2 | GL-MISSING-CHART-ACCOUNT (ตีความ: บัญชีไม่อยู่ในผัง) | ยังเปิด | แก้เฉพาะ flag 54 `P/service.go:1666-1676` |
| H-3 | THIN-SQL-22-LATLNG (ตีความ: พิกัดจังหวัดบาง) | ปิดแล้ว | `bd57ff05`; `P/province_load.go:152-169` |
| H-4 | flag-66 recost | ยืนยันไม่ได้ | flag 66 อยู่ใน `P/stock_rebuild.go:19,35` แต่ไม่รู้ว่าขาดตรงไหน |
| H-5 | province copy/status/zip | ปิดแล้ว (status/zip) | `P/province_load.go:146-169`; "copy" ไม่ทราบความหมาย |
| H-6 | R-GRID-UI ตำแหน่ง shortcut | ยืนยันไม่ได้ | `GridShortcutPopover.tsx:27`; เทียบ C# ไม่ได้ |
| H-7 | price center ไม่เคยทดสอบกับ server จริง | ยังเปิด | `P/price_center_test.go:6,96,108` ใช้ `httptest` |
| H-8 | price center / VAT รายบรรทัดฝั่ง POS | ยังเปิด | `P/price_center.go:21-22` "NOT ported" |
| H-9 | มีประเด็นด้านความปลอดภัยที่ทีมพัฒนาต้องตรวจ (ไม่เผยแพร่รายละเอียดบนเว็บสาธารณะ) | ยังเปิด | - |
| H-10 | set ไม่ตั้ง `is_serial_number` | ยังเปิด | `P/trans_set_item.go` ไม่มีคำว่า serial; ตั้งแค่แถวหลัก `trans_grid.go:364` |
| H-11 | จอยกเลิก 3/7/31/37/39 เทียบ C# | ยืนยันไม่ได้ | มี `P/doc_cancel.go:38,70` แต่ไม่มีผลเทียบ |
| H-12, H-13 | REF-36, R3f ที่ไม่ได้ apply | ยืนยันไม่ได้ | ไม่พบนิยามนอกเอกสาร |
| H-14 | GL lock ไม่เคยทดสอบบนฐานจริง | ยังเปิด | ล็อก `P/service.go:1319-1321,1356-1371`; เทสต์ `P/service_test.go:38,56-77` ใช้ `lockTx` จำลอง |
| H-15 | flag 144 ไม่มีทางเข้า UI | ยังเปิด | `P/trans_grid.go:87` ไม่มี 144; `P/trans_set_item.go:17` |
| H-16, H-17 | gl_recurring เขียนกลับ JSON / ปุ่ม recurring ของ C# | ยังเปิด (ตั้งใจ) | `P/gl_recurring.go:51` มีแต่ SELECT; `GlRecurringBar.tsx` ไม่มี button |
| H-18 | ยอดเอกสารยกเลิกรุ่นเก่า | ยืนยันไม่ได้ | ไม่พบสคริปต์ backfill ใน `scripts/sql` |
| H-19 | `_packingWord` | ยังเปิด (ตั้งใจ) | grep `packingWord` ได้ 0 บรรทัด |
| H-20 | GL สำรอง 250/252/254 ลงเงินสดเสมอ | ยังเปิด (บางส่วน) | HEAD ลงเงินสดเสมอ; working tree (ไม่ commit) `P/service.go:2031-2037` ให้ 250/254 ตาม `cb_trans`; 252 ยังเสมอ `:2058` |
| H-21 | ตารางรายงานว่างเมื่อ template action ล้มเหลว | ยังเปิด | `UniversalReportScreen.tsx:535` `setRows([])` ใน catch |
| H-22 | เพดาน 4% หดคอลัมน์ 3.6% ไม่ได้ | ปิดแล้ว | `77780f6e`; `UniversalReportScreen.tsx:1003-1004` ใช้ min 1.5% |
| H-23 | `useExpireColumn` พังถ้าไม่มีคอลัมน์ | ยังเปิด (frontend) | `useExpireColumn.ts:22` query เดียว 3 คอลัมน์; backend แยกแล้ว `P/trans_line_extra.go:23` |
| H-24 | POS Flutter (งานแยก) | ยังเปิด | ไม่มี commit ใน `F/pos` หลัง 2026-10-22 |

## 4. Handoff audit รอบ 2 และ 100% clone (เฉพาะข้อที่ตรวจได้)

| รหัส | ความหมาย | สถานะ | หลักฐาน |
|---|---|---|---|
| A-1 | ฟิลด์จอ master ตรง C# | ปิดแล้ว (ระดับฟิลด์) | `bccm_parity_report.json` `masterScreenFieldDiscrepanciesCount`=0 (`58fe0ccf`) |
| A-2 | AUDIT 3.1.2-3.1.4 trans/รายงาน/process ตรง C# (3 ข้อ) | ยืนยันไม่ได้ | report มีแค่จำนวนเมนู ไม่มีผลเทียบรายแท็บ/รายงาน |
| C-1 | CLONE มิติ 1-2 ลำดับราคา/docFlow (2 ข้อ) | ยืนยันไม่ได้ | พอร์ตบางส่วน `P/trans_validate.go:43-45`; ไม่ port `P/trans_credit.go:19`, `P/doc_flow.go:89` |
| C-3 | มีประเด็นด้านความปลอดภัยที่ทีมพัฒนาต้องตรวจ (ไม่เผยแพร่รายละเอียดบนเว็บสาธารณะ) | ยังเปิด | - |
| C-4 | CLONE มิติ 4-5 lookup/`_conditionScreen` (2 ข้อ) | ยืนยันไม่ได้ | `scripts/` ไม่มีสคริปต์เทียบ |

## 5. KMS Security & Data-Integrity
`docs/kms/KMS_SECURITY_DATA_INTEGRITY_LESSONS.md:100` ระบุ "ไม่มีรายการค้าง" รุ่น `0d97b51f` 9 ข้อปิดครบตามข้อความ commit: login ผู้ดูแล `a94b0748` · WMS `5e3dbd36` · ปัดยอด/big.Rat `cd881a34` · Admin/OAuth state `7ab65d38` · สิทธิ์ provider `a264a99a` · market/TMS atomic `4de91436`

## รายการที่ปิดแล้วหลังเขียนเอกสาร
H-B1, H-B2, H-3, H-5, H-22, H-S6a-c · T-2, T-3, T-6 · KMS ทั้ง 9 ข้อ; H-20 ปิดครึ่งเดียวและยังไม่ commit

## TODO/FIXME ในโค้ด
- `TODO`/`FIXME` ใน `backend`, `F/account`, `F/shared`, `F/src`: 0 จุด; ใช้ `ponytail:` แทน 85 จุดใน `backend/internal`, 18 จุดใน `F/account`+`F/shared`
- ประกาศ "ยังไม่ port": `P/doc_flow.go:89`, `P/gl_template.go:1006`, `P/trans_credit.go:19`, `P/trans_save_rules.go:502,520`
- วันที่ UTC: `GlobalDocFormPrintModal.tsx:1625-1626` ใช้ `toISOString().slice(0, 10)` (ไฟล์แก้ยังไม่ commit)

## ดูเพิ่ม
[[history-overview]] · [[hist-parity-bccm]] · [[hist-lessons-concurrency-advisory-locks]] · [[hist-lessons-query-gateway-write-lockdown]] · [[std-repo-scope-rules]] · [[standards-overview]]

## ที่มาในโค้ด
- `TODO.md:93-109`, `docs/HANDOFF_BCCM_PARITY_2026-10-22.md:50-77`, `docs/kms/KMS_SECURITY_DATA_INTEGRITY_LESSONS.md:100`, `docs/bccm_parity_report.json`
- `P/service.go:992-1003,1319-1371,1587-1676,2031-2058`, `P/trans_grid.go:87,364`, `P/price_center.go:21-22`, `P/province_load.go:146-169`, `P/asset_depreciation.go:86-89`
- `F/account/form/FieldControl.tsx:273-281`, `UniversalReportScreen.tsx:535,1003`, `useExpireColumn.ts:22`
- git:`4341ae81` `906c5b45` `77780f6e` `62c7098f` `58fe0ccf` `bd57ff05` `a94b0748` `5e3dbd36` `cd881a34` `7ab65d38` `a264a99a` `4de91436` `3ac50564`
