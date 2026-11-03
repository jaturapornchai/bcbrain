---
title: "รับคืนสินค้า/ลดหนี้ขาย (Sales Return / Credit Note)"
tags: [doctypes, sale]
aliases: ["trans_flag 48", "รับคืนสินค้า", "ลดหนี้ขาย", "ใบลดหนี้ลูกหนี้", "ST"]
sources: ["frontend/account/tabs/transMenuMap.ts:859", "frontend/account/transaction/transLayouts.ts:91", "frontend/account/transaction/transLayouts.ts:40", "backend/internal/application/process/transcalc.go:16", "backend/internal/application/process/stock_rebuild.go:19", "backend/internal/application/process/stock_rebuild.go:21", "backend/internal/application/process/trans_tax.go:40", "backend/internal/application/process/trans_tax.go:49", "backend/internal/application/process/service.go:2061", "backend/internal/application/process/service.go:1871", "backend/internal/application/process/pay_check.go:45", "backend/internal/application/process/docs.go:602", "backend/internal/application/process/doc_cancel.go:52"]
---

# รับคืนสินค้า/ลดหนี้ขาย (trans_flag 48)

## ใช้เมื่อไร
ใช้รับสินค้าคืนจากลูกค้าหรือลดหนี้ขาย อ้างใบขาย 44 อยู่ที่เมนู "รับคืนสินค้า/ลดหนี้ขาย" (ST, `refTransFlags: [44]` transMenuMap.ts:859)

## trans_flag/ตาราง
- trans_flag 48, calc_flag +1 (transcalc.go:16) เก็บใน [[tbl-ic-trans]] + [[tbl-ic-trans-detail]]

## ฟิลด์/แท็บบนหน้าจอ
- หัวเอกสาร: party, taxDoc, refDoc, sale, inquiry, vat, docReason แท็บ pay, wht, vat, gl (transLayouts.ts:91)
- ประเภทการรับคืน (`SALE_RETURN_TYPE` transLayouts.ts:40):
  - 0 รับคืนจากขายเงินเชื่อ
  - 1 รับคืนจากขายเงินสด
  - 2 ลดหนี้จากขายเงินเชื่อ (ไม่กระทบสต๊อก)
  - 3 ลดหนี้จากขายเงินสด (ไม่กระทบสต๊อก)
  - 4 รับคืนจากขายสินค้าเงินเชื่อ (สินค้าบริการ)
  - 5 รับคืนจากขายสินค้าเงินสด (สินค้าบริการ)
- แท็บชำระเปิดเมื่อ inquiry เป็น 1, 3 หรือ 5 (`payTabEnabled` pay_check.go:45-46)

## ผลต่อสต็อก
- อยู่ในชุด flag ที่นับสต็อก (`stockRowsSQL` stock_rebuild.go:19) calc_flag +1 จึงเป็นสต็อกเข้า
- นับเฉพาะ inquiry 0 และ 1 เพราะตัด 48 ที่ inquiry > 1 ออก (stock_rebuild.go:21)

## ผลต่อภาษี (VAT/WHT)
- ภาษีขาย vat_calc −1 (`transVatTabs` trans_tax.go:40)
- WHT ฝั่ง ar "ภาษีถูกหัก ณ ที่จ่าย" (`transWhtParty` trans_tax.go:49)

## การลงบัญชี
standard GL `case 48, 252` (service.go:2061-2072) — `base` = ยอดรวม − VAT (service.go:1790)
| Dr | Cr | จำนวน |
|---|---|---|
| ขาย 4111 (สำรอง 4110, 4100) | | `base` |
| ภาษีขาย 2134 (สำรอง 2121, 2135, 2190) | | VAT |
| | inquiry 1/3/5: เงินที่จ่ายคืนตามแท็บชำระ (`payTenders(false)`) | ยอดรวม |
| | inquiry 0/2/4: ลูกหนี้ 1121 (สำรอง 1131, 1130, 1120) | ยอดรวม |
- `payTenders(false)` แยกตามยอดใน cb_trans (เงินสด 1111, โอน/wallet → ธนาคาร, เช็คจ่าย 2112, บัตร → ธนาคาร) + ภาษีหัก 2122 (สำรอง 2123, 2120) เมื่อรวมได้เท่ายอดเงิน มิฉะนั้นลงเงินสดทั้งยอด (service.go:1871-1929)
- บัญชีสำรองดู service.go:1796-1803

## เอกสารต้นทาง-ปลายทาง
- ต้นทาง: ขาย 44 (transMenuMap.ts:859)
- นับเป็นเครดิตลูกหนี้เมื่อ inquiry เป็น 0, 2 หรือ 4 (`arCreditWhere` docs.go:602)

## ยกเลิก/แก้ไข
- ยกเลิกด้วย flag 49 (doc_cancel.go:52)

## ข้อควรระวัง
- inquiry 4/5 (สินค้าบริการ) ไม่ขยับสต็อก เพราะเงื่อนไข inquiry > 1 ของ `stockRowsSQL`
- standard GL ไม่มีบรรทัดกลับต้นทุนขาย ดู [[acc-gl-posting-standard]]

## ที่มาในโค้ด
- `frontend/account/tabs/transMenuMap.ts:859` เมนู
- `frontend/account/transaction/transLayouts.ts:91` FLAG_SPEC 48 / `:40` SALE_RETURN_TYPE
- `backend/internal/application/process/stock_rebuild.go:19` / `:21` stockRowsSQL
- `backend/internal/application/process/service.go:2061` GL รับคืน
- `backend/internal/application/process/pay_check.go:45` payTabEnabled 48
- `backend/internal/application/process/docs.go:602` arCreditWhere
- `backend/internal/application/process/doc_cancel.go:52` ยกเลิก 49

## ดูเพิ่ม
- [[doc-sale-invoice]] · [[doc-sale-debit-note]] · [[acc-vat-register-wht]] · [[doctypes-overview]]
