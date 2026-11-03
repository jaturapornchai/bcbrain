---
title: "งานขายทำตามลำดับอย่างไร ตั้งแต่เสนอราคา สั่งขาย ขายสินค้า จนถึงรับเงินจากลูกหนี้"
tags: [faq, flow, sale, ar, menu]
aliases: ["ขั้นตอนการขาย", "order to cash", "O2C", "เสนอราคาแล้วทำอะไรต่อ", "ใบสั่งจอง ใบสั่งขาย ขายสินค้า", "ขายเชื่อรับเงินยังไง", "ใบวางบิลลูกหนี้ ใบเสร็จรับเงิน", "flag 30 34 36 44 239"]
sources: ["frontend/account/tabs/transMenuMap.ts:547", "backend/internal/application/process/trans_ref_import_lines.go:52", "backend/internal/application/process/stock_rebuild.go:18", "backend/internal/application/process/service.go:1998", "backend/internal/application/process/trans_credit.go:33", "backend/internal/application/process/trans_save_rules.go:55", "backend/internal/application/process/docs.go:600"]
---
# งานขายทำตามลำดับอย่างไร ตั้งแต่เสนอราคา สั่งขาย ขายสินค้า จนถึงรับเงินจากลูกหนี้

**ตอบสั้น:** สายหลักคือ ใบเสนอราคา (flag 30) → ใบสั่งจอง (34) → ใบสั่งขาย (36) → ขายสินค้า/บริการ (44) → ใบวางบิลลูกหนี้ (235) → รับชำระหนี้ (239) เอกสารก่อน 44 ไม่ตัดสต็อกและไม่ลง GL ใบ 44 ตัดสต็อกและลง GL ใบ 239 ลง GL ด้านรับเงิน ส่วนใบวางบิล 235 ไม่ลง GL

## รายละเอียด

| ขั้น | เอกสาร (flag) | เมนู (รหัส) | สต็อก | GL |
|---|---|---|---|---|
| 1 | ใบเสนอราคา (30) · อนุมัติ (32) | `menu_so_quotation_order` (4001) · 4002 | ไม่ | ไม่ |
| 2 | ใบสั่งจอง (34) ดึงจาก 30 · อนุมัติ (38) | `menu_so_inquiry_order` (4003) · 4004 | ไม่ | ไม่ |
| 3 | ใบสั่งขาย (36) ดึงจาก 30 หรือ 34 · อนุมัติ (52) | `menu_so_sale_order` (4005) · 4006 | ไม่ | ไม่ |
| 4 | รับเงินล่วงหน้า (40) / รับมัดจำ (110) ถ้ามี | `menu_so_deposit_receive_1` / `_2` (4008 / 4011) | ไม่ | มี |
| 5 | ขายสินค้า/บริการ (44) ดึงจาก 30, 34 หรือ 36 | `menu_so_invoice` (4013) | ตัดออก | มี |
| 6 | รับคืน/ลดหนี้ (48) ดึงจาก 44 · เพิ่มหนี้/ราคาผิด (46) | 4014 / 4015 | 48 เข้า (inquiry 0-1) · 46 ออก (inquiry 0) | มี |
| 7 | ใบวางบิล (235) | `menu_ar_pay_bill` (6018) | ไม่ | ไม่ |
| 8 | รับชำระหนี้/ออกใบเสร็จรับเงิน (239) เลือกบิลค้าง | `menu_ar_debt_billing` (6019) | ไม่ | มี |

- **ดึงเอกสารอ้างอิงได้เฉพาะคู่ที่ระบบกำหนด** (`refImportSources`): 34←{30}, 36←{30,34}, 44←{30,34,36}, 48←{44}, 46←{44} วิธีดึงอยู่ใน [[faq-doc-ref-import]] 
- **จำนวนเกินใบต้นทาง:** ใบ 44 ที่ดึงจาก 30/34/36 ถูกปฏิเสธด้วย "จำนวนเกินเอกสารอ้างอิง" ถ้าเกินจำนวนที่เหลือ เว้นแต่เปิดตัวเลือก `allow_sale_over_reserve` ส่วนใบ 34/36 ที่ดึงจาก 30/34 ตรวจเมื่อเปิดตัวเลือก `check_qty_over_doc_ref`
- **ขายสดหรือขายเชื่อ** แยกด้วย `inquiry_type` ของใบ 44 (0 = เชื่อ, 1 = สด, 2/3 = ชุดบริการ ดู [[term-inquiry-type]]) ขายเชื่อลง GL เดบิตลูกหนี้ ขายสดเดบิตช่องทางรับเงินจากแท็บชำระเงิน (`cb_trans`) แล้วเครดิตรายได้ขายและภาษีขาย เงินมัดจำที่นำมาใช้เดบิตบัญชีเงินรับล่วงหน้า (รายละเอียดใน [[faq-sale-invoice-gl-posting]] และ [[faq-deposit-vs-advance]])
- **ต้นทุนขาย:** สูตร GL ของ 44 ไม่มีบรรทัดต้นทุนขาย/สินค้าคงเหลือ (บรรทัด 1998-2047) การเคลื่อนไหวสต็อกของ 44 อยู่ในระบบสต็อกและต้นทุน ดู [[faq-moving-average-cost]] ส่วนบัญชีต้นทุนขายในโค้ดผูกกับเอกสารปรับสต็อก 56-68 (`service.go:2146-2148`)
- **สต็อก:** ตัวนับสต็อกรับ flag 44, 46, 48 (ตัด 46 ที่ `inquiry_type` ไม่ใช่ 0 และ 48 ที่มากกว่า 1) 30/34/36/235/239 ไม่เคลื่อนสต็อก แต่ตอนบันทึกใบ 36 และ 44 (กับ 46, 56, 72) ระบบตรวจยอดคงเหลือก่อน เมื่อเปิดตัวเลือกคุมการจ่ายสต็อก (`issueStockControl`) ดู [[faq-negative-stock]]
- **วงเงินเครดิต:** ใบ 44 ที่ `inquiry_type` 0 ตรวจวงเงินลูกค้า (`creditChecked`) ใบ 34/36 ตรวจเมื่อเปิดตัวเลือกวงเงินที่ใบสั่ง และอาจถามว่าบันทึกเพื่อขออนุมัติหรือไม่ ดู [[faq-credit-limit-approval]]
- **ยอดค้างรับ** คำนวณสดจากเอกสาร: 44 (`inquiry_type` 0/2) และ 46 เป็นหนี้ หัก 48 (0/2/4) ขายสด (`inquiry_type` 1) จึงไม่โผล่ในลูกหนี้ค้าง ใบ 235 ไม่ได้ลดยอด เพราะเป็นแค่เอกสารรวบรวมบิล ใบ 239 ถึงเป็นตัวตัดหนี้ ดู [[faq-billing-ar-ap]]
- **ยกเลิกใบขาย** ใช้เมนูยกเลิกแยก (`menu_so_invoice_cancel` 4025 / 4.18.8) ซึ่งสร้างเอกสาร flag 45 อ้างใบ 44 เดิม ไม่ใช่การลบ ดู [[faq-cancel-vs-edit-vs-delete]] เมนูส่ง e-Tax ของฝั่งขายมีรหัส 4016 (`menu_so_send_etax`) ตัวบิลที่ขายผ่านหน้าร้าน POS ดู [[faq-pos-bill-to-account]]

## ข้อควรระวัง

- หน้าอนุมัติ (32, 38, 52) เป็นเมนูแยกจากหน้าสร้างเอกสาร จึงมีรหัสเมนูของตัวเอง (4002, 4004, 4006) เวลาค้นหาเมนูให้ดู [[faq-menu-code-to-screen]]

## ดูเพิ่ม

- [[flow-order-to-cash]] · [[doc-sale-invoice]] · [[doc-sale-order]] · [[doc-ar-receipt]] · [[faq-sale-return-credit-note-gl]]

## ที่มาในโค้ด

- `frontend/account/tabs/transMenuMap.ts:547` (30), `:590` (34), `:635` (36), `:695` (40), `:725` (110), `:831` (44), `:863` (48), `:894` (46), `:1548` (235), `:1577` (239)
- `backend/internal/application/process/trans_ref_import_lines.go:52-54` (`refImportSources`)
- `backend/internal/application/process/stock_rebuild.go:18-22` (flag ที่นับสต็อก)
- `backend/internal/application/process/service.go:1998-2047` (GL ของ 44/46), `:2146-2148` (ต้นทุนขายของเอกสาร 56-68)
- `backend/internal/application/process/trans_save_rules.go:55` (`stockCheckFlags`), `:488` (`creditChecked`)
- `backend/internal/application/process/trans_credit.go:33-38` (ใบ 34/36 ตรวจวงเงินที่ใบสั่ง), `:147` (`planOrderCredit`)
- `backend/internal/application/process/trans_validate.go:79-87` (ข้าม/ใช้ตรวจจำนวนเกิน), `:300-302` (ต้นทางของ 44) · `trans_qty_over_ref.go:16-24` (ต้นทางของ 34/36)
- `backend/internal/application/process/stock_rebuild.go:32-40` (ฝั่งเข้า/ออกของ 44, 46, 48)
- `backend/internal/application/process/docs.go:600-603` (นิยามยอดค้างฝั่งลูกหนี้)
