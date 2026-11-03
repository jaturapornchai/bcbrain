---
title: "ส่งคืนสินค้า/ลดหนี้ซื้อ (Purchase Return / Credit Note)"
tags: [doctypes, purchase]
aliases: ["trans_flag 16", "ส่งคืนสินค้า", "ลดหนี้ซื้อ", "ใบลดหนี้เจ้าหนี้", "PT"]
sources: ["frontend/account/tabs/transMenuMap.ts:388", "frontend/account/transaction/transLayouts.ts:84", "frontend/account/transaction/transLayouts.ts:37", "backend/internal/application/process/stock_rebuild.go:18", "backend/internal/application/process/stock_rebuild.go:26", "backend/internal/application/process/trans_tax.go:37", "backend/internal/application/process/trans_tax.go:48", "backend/internal/application/process/service.go:1984", "backend/internal/application/process/pay_check.go:36", "backend/internal/application/process/docs.go:597", "backend/internal/application/process/trans.go:228", "backend/internal/application/process/doc_cancel.go:50"]
---

# ส่งคืนสินค้า/ลดหนี้ซื้อ (trans_flag 16)

## ใช้เมื่อไร
ใช้ส่งสินค้าคืนผู้ขาย หรือลดหนี้เพราะราคาผิด โดยอ้างใบซื้อ 12 อยู่ที่เมนู "ส่งคืนสินค้า/ลดหนี้ซื้อ" (PT, transMenuMap.ts:388)

## trans_flag/ตาราง
- trans_flag 16, calc_flag −1 เก็บใน [[tbl-ic-trans]] + [[tbl-ic-trans-detail]]

## ฟิลด์/แท็บบนหน้าจอ
- หัวเอกสาร: party, taxDoc, refDoc, inquiry, vat, docReason, refAmounts แท็บ pay, wht, vat, gl (transLayouts.ts:84)
- ประเภทการส่งคืน (`RETURN_TYPE` transLayouts.ts:37):
  - 0 ลดหนี้เจ้าหนี้, ลดสินค้า
  - 1 ลดหนี้เจ้าหนี้, ราคาผิด (ไม่มีผลกับสต๊อกสินค้า)
  - 2 ส่งคืนเงินสด
  - 3 ราคาผิดเงินสด (ไม่มีผลกับสต๊อกสินค้า)
- ช่องมูลค่าเอกสารเดิม/มูลค่าที่ถูกต้อง/ผลต่าง (`refAmountFlags` 16 = true คือลดยอดบิลที่อ้าง trans.go:228)
- แท็บชำระเปิดเมื่อ inquiry เป็น 2 หรือ 3 (pay_check.go:36)

## ผลต่อสต็อก
- ส่งออก (−1) (`stockRowsSQL` stock_rebuild.go:18)
- inquiry 1/3 ไม่ลดจำนวน เปลี่ยนแต่มูลค่า (`stockValueOnlySQL` stock_rebuild.go:26)

## ผลต่อภาษี (VAT/WHT)
- ภาษีซื้อ vat_calc −1 (trans_tax.go:37)
- WHT ฝั่ง ap (trans_tax.go:48)

## การลงบัญชี
ใช้ standard GL (service.go:1984)
| Dr | Cr |
|---|---|
| ถ้า inquiry ≥ 2 ใช้เงินที่รับคืน (payTenders), นอกนั้นใช้เจ้าหนี้ ยอดรวม | ซื้อ (ฐาน) |
| | ภาษีซื้อ |

## เอกสารต้นทาง-ปลายทาง
- ต้นทาง: ใบซื้อ 12 (transMenuMap.ts:388) ใบ 12 ถูกนับเป็น "billed" จาก 14/16 ใน `flowRules` (doc_flow.go:91)
- นับเป็นเครดิตเจ้าหนี้เมื่อ inquiry เป็น 0 หรือ 1 (`apCreditWhere` docs.go:597)

## ยกเลิก/แก้ไข
- ยกเลิกด้วย flag 17 (doc_cancel.go:50)

## ข้อควรระวัง
- inquiry 2 "ส่งคืนเงินสด" ยังลดจำนวนสต็อก ส่วน 1/3 ลดแต่มูลค่า (stock_rebuild.go:26)

## ที่มาในโค้ด
- `frontend/account/tabs/transMenuMap.ts:388` เมนู
- `frontend/account/transaction/transLayouts.ts:84` FLAG_SPEC 16 / `:37` RETURN_TYPE
- `backend/internal/application/process/stock_rebuild.go:18` / `:25` สต็อก
- `backend/internal/application/process/service.go:1984` GL ลดหนี้ซื้อ
- `backend/internal/application/process/pay_check.go:36` payTabEnabled
- `backend/internal/application/process/docs.go:597` apCreditWhere
- `backend/internal/application/process/doc_cancel.go:50` ยกเลิก 17

## ดูเพิ่ม
- [[doc-purchase-invoice]] · [[doc-purchase-debit-note]] · [[acc-inventory-cost-moving-average]] · [[acc-vat-register-wht]] · [[doctypes-overview]]
