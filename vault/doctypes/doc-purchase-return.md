---
title: "ส่งคืนสินค้า/ลดหนี้ซื้อ (Purchase Return / Credit Note)"
tags: [doctypes, purchase]
aliases: ["trans_flag 16", "ส่งคืนสินค้า", "ลดหนี้ซื้อ", "ใบลดหนี้เจ้าหนี้", "PT"]
sources: ["frontend/account/tabs/transMenuMap.ts:388", "frontend/account/transaction/transLayouts.ts:84", "frontend/account/transaction/transLayouts.ts:37", "backend/internal/application/process/transcalc.go:21", "backend/internal/application/process/stock_rebuild.go:19", "backend/internal/application/process/stock_rebuild.go:26", "backend/internal/application/process/trans_tax.go:38", "backend/internal/application/process/trans_tax.go:48", "backend/internal/application/process/service.go:1995", "backend/internal/application/process/pay_check.go:43", "backend/internal/application/process/docs.go:607", "backend/internal/application/process/doc_flow.go:110", "backend/internal/application/process/trans.go:229", "backend/internal/application/process/doc_cancel.go:50"]
---

# ส่งคืนสินค้า/ลดหนี้ซื้อ (trans_flag 16)

## ใช้เมื่อไร
ใช้ส่งสินค้าคืนผู้ขาย หรือลดหนี้เพราะราคาผิด โดยอ้างใบซื้อ 12 (`refTransFlags: [12]`) อยู่ที่เมนู "ส่งคืนสินค้า/ลดหนี้ซื้อ" (PT, transMenuMap.ts:388)

## trans_flag/ตาราง
- trans_flag 16, calc_flag −1 (transcalc.go:21) เก็บใน [[tbl-ic-trans]] + [[tbl-ic-trans-detail]]

## ฟิลด์/แท็บบนหน้าจอ
- หัวเอกสาร: party, taxDoc, refDoc, inquiry, vat, docReason, refAmounts แท็บ pay, wht, vat, gl (transLayouts.ts:84)
- ประเภทการส่งคืน (`RETURN_TYPE` transLayouts.ts:37):
  - 0 ลดหนี้เจ้าหนี้, ลดสินค้า
  - 1 ลดหนี้เจ้าหนี้, ราคาผิด (ไม่มีผลกับสต๊อกสินค้า)
  - 2 ส่งคืนเงินสด
  - 3 ราคาผิดเงินสด (ไม่มีผลกับสต๊อกสินค้า)
- ช่องมูลค่าเอกสารเดิม/มูลค่าที่ถูกต้อง/ผลต่าง (`refAmountFlags` 16 = true คือลดยอดบิลที่อ้าง trans.go:229)
- แท็บชำระใช้ได้เมื่อ inquiry เป็น 2 หรือ 3 (`payTabEnabled` pay_check.go:43-44)

## ผลต่อสต็อก
- อยู่ในชุด flag ที่นับสต็อก (`stockRowsSQL` stock_rebuild.go:19) ยอดคงเหลือ = Σ qty × calc_flag จึงเป็นสต็อกออก
- inquiry 1/3 ไม่ลดจำนวน เปลี่ยนแต่มูลค่า (`stockValueOnlySQL` stock_rebuild.go:26)

## ผลต่อภาษี (VAT/WHT)
- ภาษีซื้อ เก็บยอดเป็นบวกและ vat_calc −1 (`transVatTabs` trans_tax.go:38)
- แท็บภาษีหัก ณ ที่จ่าย ฝั่ง ap (`transWhtParty` trans_tax.go:48)

## การลงบัญชี
standard GL `case 16` (service.go:1995) — `base` = ยอดรวม − VAT (service.go:1790)
| Dr | Cr | จำนวน |
|---|---|---|
| inquiry 2/3: เงินที่รับคืนตามแท็บชำระ (`payTenders(true)`: เงินสด 1111, ธนาคารตามสมุดเงินฝาก, เช็ครับ 1122, บัตร→บัญชีลูกหนี้, ภาษีถูกหัก 1153 — ไม่มีแถว cb_trans หรือยอดแยกไม่ตรง ลงเงินสดทั้งยอด) | | ยอดรวม |
| inquiry 0/1: เจ้าหนี้ 2111 (สำรอง 2110, 2100) | | ยอดรวม |
| | ซื้อ 5111 (สำรอง 5110, 1151) | `base` |
| | ภาษีซื้อ 1154 (สำรอง 1151, 1155, 1190) | VAT |
- บัญชีสำรองดู service.go:1796-1803, การแยกช่องทางเงิน service.go:1871-1929
- แถวค่าใช้จ่าย/รายได้อื่นในแท็บชำระลงด้วยเฉพาะเมื่อมีบรรทัดเงิน (service.go:2362)

## เอกสารต้นทาง-ปลายทาง
- ต้นทาง: ใบซื้อ 12 ใบ 12 ถือว่าถูกใช้ (used_status) เมื่อมีรายการ 14/16 อ้างถึง (`billedRule("14, 16")` doc_flow.go:110)
- นับเป็นเครดิตเจ้าหนี้ (ลดยอดหนี้) เมื่อ inquiry เป็น 0 หรือ 1 (`apCreditWhere` docs.go:607)

## ยกเลิก/แก้ไข
- ยกเลิกด้วย flag 17 (doc_cancel.go:50)

## ข้อควรระวัง
- inquiry 2 "ส่งคืนเงินสด" ยังลดจำนวนสต็อก ส่วน 1/3 ลดแต่มูลค่า (stock_rebuild.go:26)

## ที่มาในโค้ด
- `frontend/account/tabs/transMenuMap.ts:388` เมนู
- `frontend/account/transaction/transLayouts.ts:84` FLAG_SPEC 16 / `:37` RETURN_TYPE
- `backend/internal/application/process/stock_rebuild.go:19` / `:26` สต็อก
- `backend/internal/application/process/service.go:1995` GL ลดหนี้ซื้อ
- `backend/internal/application/process/pay_check.go:43` payTabEnabled 16
- `backend/internal/application/process/docs.go:607` apCreditWhere
- `backend/internal/application/process/doc_cancel.go:50` ยกเลิก 17

## ดูเพิ่ม
- [[doc-purchase-invoice]] · [[doc-purchase-debit-note]] · [[acc-inventory-cost-moving-average]] · [[acc-vat-register-wht]] · [[doctypes-overview]]
