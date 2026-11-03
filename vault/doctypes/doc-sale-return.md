---
title: "รับคืนสินค้า/ลดหนี้ขาย (Sales Return / Credit Note)"
tags: [doctypes, sale]
aliases: ["trans_flag 48", "รับคืนสินค้า", "ลดหนี้ขาย", "ใบลดหนี้ลูกหนี้", "ST"]
sources: ["frontend/account/tabs/transMenuMap.ts:859", "frontend/account/transaction/transLayouts.ts:91", "frontend/account/transaction/transLayouts.ts:40", "backend/internal/application/process/stock_rebuild.go:18", "backend/internal/application/process/trans_tax.go:37", "backend/internal/application/process/trans_tax.go:48", "backend/internal/application/process/service.go:2050", "backend/internal/application/process/pay_check.go:36", "backend/internal/application/process/docs.go:597", "backend/internal/application/process/doc_cancel.go:52"]
---

# รับคืนสินค้า/ลดหนี้ขาย (trans_flag 48)

## ใช้เมื่อไร
ใช้รับสินค้าคืนจากลูกค้าหรือลดหนี้ขาย อ้างใบขาย 44 อยู่ที่เมนู "รับคืนสินค้า/ลดหนี้ขาย" (ST, transMenuMap.ts:859)

## trans_flag/ตาราง
- trans_flag 48, calc_flag +1 เก็บใน [[tbl-ic-trans]] + [[tbl-ic-trans-detail]]

## ฟิลด์/แท็บบนหน้าจอ
- หัวเอกสาร: party, taxDoc, refDoc, sale, inquiry, vat, docReason แท็บ pay, wht, vat, gl (transLayouts.ts:91)
- ประเภทการรับคืน (`SALE_RETURN_TYPE` transLayouts.ts:40):
  - 0 รับคืนจากขายเงินเชื่อ
  - 1 รับคืนจากขายเงินสด
  - 2 ลดหนี้จากขายเงินเชื่อ (ไม่กระทบสต๊อก)
  - 3 ลดหนี้จากขายเงินสด (ไม่กระทบสต๊อก)
  - 4 รับคืนจากขายสินค้าเงินเชื่อ (สินค้าบริการ)
  - 5 รับคืนจากขายสินค้าเงินสด (สินค้าบริการ)
- แท็บชำระเปิดเมื่อ inquiry เป็น 1, 3 หรือ 5 (`payTabEnabled` pay_check.go:36)

## ผลต่อสต็อก
- รับเข้า (+1) เฉพาะ inquiry 0 และ 1 เพราะ `stockRowsSQL` ตัด 48 ที่ inquiry > 1 ออก (stock_rebuild.go:18)

## ผลต่อภาษี (VAT/WHT)
- ภาษีขาย vat_calc −1 (trans_tax.go:37)
- WHT ฝั่ง ar (trans_tax.go:48)

## การลงบัญชี
ใช้ standard GL (service.go:2050)
| Dr | Cr |
|---|---|
| ขาย (ฐาน) | เงินที่จ่ายคืน (payTenders) เมื่อแท็บชำระเปิด มิฉะนั้นใช้ลูกหนี้ ยอดรวม |
| ภาษีขาย | |

## เอกสารต้นทาง-ปลายทาง
- ต้นทาง: ขาย 44 (transMenuMap.ts:859)
- นับเป็นเครดิตลูกหนี้เมื่อ inquiry เป็น 0, 2 หรือ 4 (`arCreditWhere` docs.go:597)

## ยกเลิก/แก้ไข
- ยกเลิกด้วย flag 49 (doc_cancel.go:52)

## ข้อควรระวัง
- inquiry 4/5 (สินค้าบริการ) ไม่ขยับสต็อก เพราะเงื่อนไข inquiry > 1 ของ `stockRowsSQL`
- standard GL ไม่มีบรรทัดกลับต้นทุนขาย ดู [[acc-gl-posting-standard]]

## ที่มาในโค้ด
- `frontend/account/tabs/transMenuMap.ts:859` เมนู
- `frontend/account/transaction/transLayouts.ts:91` FLAG_SPEC 48 / `:40` SALE_RETURN_TYPE
- `backend/internal/application/process/stock_rebuild.go:18` stockRowsSQL
- `backend/internal/application/process/service.go:2050` GL รับคืน
- `backend/internal/application/process/pay_check.go:36` payTabEnabled
- `backend/internal/application/process/docs.go:597` arCreditWhere
- `backend/internal/application/process/doc_cancel.go:52` ยกเลิก 49

## ดูเพิ่ม
- [[doc-sale-invoice]] · [[doc-sale-debit-note]] · [[acc-vat-register-wht]] · [[doctypes-overview]]
