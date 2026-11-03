---
title: "ซื้อสินค้า/ตั้งหนี้ซื้อ (Purchase Invoice)"
tags: [doctypes, purchase]
aliases: ["trans_flag 12", "ซื้อสินค้า", "ตั้งหนี้ซื้อ", "ซื้อเงินเชื่อ", "ซื้อเงินสด", "PU"]
sources: ["frontend/account/tabs/transMenuMap.ts:295", "frontend/account/transaction/transLayouts.ts:82", "frontend/account/transaction/transLayouts.ts:36", "frontend/account/transaction/transLayouts.ts:54", "frontend/account/transaction/transLayouts.ts:191", "backend/internal/application/process/stock_rebuild.go:18", "backend/internal/application/process/stock_rebuild.go:19", "backend/internal/application/process/transcalc.go:16", "backend/internal/application/process/trans_tax.go:38", "backend/internal/application/process/trans_tax.go:48", "backend/internal/application/process/service.go:1976", "backend/internal/application/process/service.go:1988", "backend/internal/application/process/service.go:1800", "backend/internal/application/process/service.go:1802", "backend/internal/application/process/trans_deposit.go:40", "backend/internal/application/process/pay_check.go:36", "backend/internal/application/process/docs.go:604", "backend/internal/application/process/trans_ref_import.go:34", "backend/internal/application/process/trans.go:593", "backend/internal/application/process/doc_cancel.go:50"]
---

# ซื้อสินค้า/ตั้งหนี้ซื้อ (trans_flag 12)

## ใช้เมื่อไร
ใช้บันทึกซื้อสินค้าที่รับเข้าพร้อมตั้งหนี้หรือจ่ายเงินสด อยู่ที่เมนู "ซื้อสินค้า/ตั้งหนี้ซื้อ" (PU, transMenuMap.ts:295) อ้างใบสั่งซื้อ 6 ได้

## trans_flag/ตาราง
- trans_flag 12, calc_flag +1 (transcalc.go:16) (เมนูใส่ transFlags 12/310/315) เก็บใน [[tbl-ic-trans]] + [[tbl-ic-trans-detail]]
- แท็บชำระเขียนลง [[tbl-cb-trans]] + [[tbl-cb-trans-detail]] ดู [[acc-trans-flag-map]]

## ฟิลด์/แท็บบนหน้าจอ
- หัวเอกสาร: party, refDoc, inquiry, vat, taxDoc, wh แท็บ pay, wht, vat, gl (transLayouts.ts:82)
- ประเภทรายการ (`PURCHASE_INQUIRY` transLayouts.ts:36): 0 ซื้อสินค้าเงินเชื่อ, 1 ซื้อสินค้าเงินสด, 2 ซื้อสินค้าเงินเชื่อ (สินค้าบริการ), 3 ซื้อสินค้าเงินสด (สินค้าบริการ)
- มีแท็บใช้เงินมัดจำ (`DEPOSIT_TAB_FLAGS` transLayouts.ts:54) และช่องจำนวน QC (`QC_TOTAL_QTY_FLAGS` transLayouts.ts:191)
- แท็บชำระเปิดเมื่อ inquiry เป็น 1 หรือ 3 (`payTabEnabled` pay_check.go:36)

## ผลต่อสต็อก
- รับเข้า (+1) ทุกบรรทัดที่ item_type เป็น 0, 4 หรือ 6 และ last_status = 0 (`stockRowsSQL` stock_rebuild.go:18)
- ต้นทุนใช้ค่าเฉลี่ยเคลื่อนที่ ดู [[acc-inventory-cost-moving-average]]

## ผลต่อภาษี (VAT/WHT)
- ภาษีซื้อ vat_calc +1 (`transVatTabs` trans_tax.go:38)
- WHT ฝั่ง ap (`transWhtParty` trans_tax.go:48) ดู [[acc-vat-register-wht]]

## การลงบัญชี
ใช้ standard GL (service.go:1976) เมื่อรูปแบบเอกสารไม่มี template บัญชีซื้อเป็นผังบัญชีตัวแรกที่มีใน 5111/5110/1151 (service.go:1800) ภาษีซื้อใน 1154/1151/1155/1190 (service.go:1802) ฝั่ง Cr เลือกที่ service.go:1988
| Dr | Cr |
|---|---|
| ซื้อ 5111/5110/1151 (ฐาน + advEx) | เจ้าหนี้ ยอดรวม หรือถ้า inquiry เป็น 1/3 ใช้เงินที่จ่ายตามแท็บชำระ (payTenders) |
| ภาษีซื้อ 1154/1151/1155/1190 | มัดจำ 153010 (advEx) เมื่อตัดมัดจำ |

advEx คือยอดมัดจำที่ตัดแบบไม่รวม VAT ดู [[acc-gl-posting-standard]] และ [[acc-deposit-advance]]

## เอกสารต้นทาง-ปลายทาง
- ต้นทาง: ใบสั่งซื้อ 6 (`refImportSpecs` คู่ {12,6} trans_ref_import.go:34) และมัดจำ 11 ผ่านแท็บมัดจำ
- ปลายทาง: เพิ่มหนี้ 14 และส่งคืน 16 อ้างใบนี้ (transMenuMap.ts:479, :388) ส่วนรับวางบิล 213 และจ่ายชำระ 19 ตัดหนี้ใบนี้
- นับเป็นหนี้เจ้าหนี้เมื่อ inquiry เป็น 0 หรือ 2 (`apDebtWhere` docs.go:604)

## ยกเลิก/แก้ไข
- ยกเลิกด้วย flag 13 (doc_cancel.go:50) หลังยกเลิกระบบคำนวณสต็อกและ GL ใหม่ (`rebuildTransDerived` trans.go:593) ดู [[proc-doc-cancel-approve]]
- การแก้/ลบดู [[acc-transaction-delete-edit]]

## ข้อควรระวัง
- inquiry 2/3 (สินค้าบริการ) ไม่ได้ถูกตัดออกจาก `stockRowsSQL` เพราะสต็อกดูจาก item_type ของบรรทัดเท่านั้น
- standard GL ใช้ยอดหัวเอกสาร ไม่ได้ใช้ต้นทุนรายบรรทัด ดู [[acc-gl-rebuild]]

## ที่มาในโค้ด
- `frontend/account/tabs/transMenuMap.ts:295` เมนู
- `frontend/account/transaction/transLayouts.ts:82` FLAG_SPEC 12 / `:36` PURCHASE_INQUIRY
- `backend/internal/application/process/stock_rebuild.go:18` stockRowsSQL
- `backend/internal/application/process/service.go:1976-1993` GL ซื้อ
- `backend/internal/application/process/pay_check.go:36` payTabEnabled
- `backend/internal/application/process/docs.go:604` apDebtWhere
- `backend/internal/application/process/doc_cancel.go:50` ยกเลิก 13

## ดูเพิ่ม
- [[doc-purchase-order]] · [[doc-purchase-return]] · [[doc-purchase-debit-note]] · [[doc-ap-payment]] · [[doctypes-overview]]
