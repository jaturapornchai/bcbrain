---
title: "ขายสินค้า/บริการ และใบกำกับภาษีเต็มรูป (Sales Invoice)"
tags: [doctypes, sale]
aliases: ["trans_flag 44", "trans_flag 144", "ขายสินค้า", "ขายเงินเชื่อ", "ขายเงินสด", "ใบกำกับภาษี", "ใบกำกับภาษีเต็มรูป (แทนใบเสร็จย่อ)", "SI"]
sources: ["frontend/account/tabs/transMenuMap.ts:827", "frontend/account/transaction/transLayouts.ts:89", "frontend/account/transaction/transLayouts.ts:17", "frontend/account/transaction/transLayouts.ts:54", "backend/internal/application/process/stock_rebuild.go:18", "backend/internal/application/process/trans_tax.go:37", "backend/internal/application/process/trans_tax.go:48", "backend/internal/application/process/service.go:1998", "backend/internal/application/process/service.go:2036", "backend/internal/application/process/trans_save_rules.go:488", "backend/internal/application/process/trans_save_rules.go:55", "backend/internal/application/process/docs.go:597", "backend/internal/application/process/doc_flow_graph.go:163", "backend/internal/application/process/doc_cancel.go:52"]
---

# ขายสินค้า/บริการ (trans_flag 44) และใบกำกับเต็มรูป (144)

## ใช้เมื่อไร
ใช้ขายสินค้าหรือบริการ ทั้งเงินเชื่อและเงินสด อยู่ที่เมนู "ขายสินค้า/บริการ" (SI, transMenuMap.ts:827 เมนูใส่ transFlags 44/144) อ้าง 30/34/36 ได้
- 144 = "ใบกำกับภาษีเต็มรูป (แทนใบเสร็จย่อ)" ใช้เมนู `pos_full_invoide_list_pos` (doc_flow_graph.go:163)

## trans_flag/ตาราง
- 44 และ 144 มี calc_flag −1 (transcalc.go:14) เก็บใน [[tbl-ic-trans]] + [[tbl-ic-trans-detail]] ส่วนแท็บชำระเก็บใน [[tbl-cb-trans]] / [[tbl-cb-trans-detail]]

## ฟิลด์/แท็บบนหน้าจอ
- หัวเอกสาร: party, contactor, taxDoc, refDoc, inquiry, vat, sale แท็บ pay, wht, vat, gl (transLayouts.ts:89)
- inquiry ใช้ตัวเลือกทั่วไป 0 ขายเชื่อ (เครดิต), 1 ขายสด (`getInquiryTypeOptions` transLayouts.ts:17)
- มีแท็บใช้เงินมัดจำ (transLayouts.ts:54) และช่องประเภทการส่ง (transLayouts.ts:175)

## ผลต่อสต็อก
- 44 ตัดออก (−1) (`stockRowsSQL` stock_rebuild.go:18) แต่ไม่นับใบ 44 ที่มี doc_ref และ is_pos = 1
- 144 ไม่อยู่ใน `stockRowsSQL` จึงไม่ตัดสต็อก
- อยู่ใน `stockCheckFlags` ซึ่งตรวจยอดคงเหลือตอนบันทึก (trans_save_rules.go:55)

## ผลต่อภาษี (VAT/WHT)
- ภาษีขายทั้ง 44 และ 144 (trans_tax.go:37)
- WHT ฝั่ง ar (trans_tax.go:48)

## การลงบัญชี
ใช้ standard GL (service.go:1998)
| Dr | Cr |
|---|---|
| ลูกหนี้ ยอดรวม หรือเงินที่รับ (ดูเงื่อนไขด้านล่าง) | ขาย 4111/4110/4100 (ฐาน + advEx) |
| มัดจำ 214220 (advEx) เมื่อตัดมัดจำ | ภาษีขาย 2134/2121/2135/2190 |

- ขายสด (44/144 ที่ inquiry เป็น 1 หรือ 3): แยกยอดใน cb_trans เป็นเงินสด/ธนาคาร/บัตร ถ้ายอดตรง (บัตรรับไปลง Dr ลูกหนี้)
- นอกเหนือจากนั้น ถ้า inquiry = 1 ใช้ payTenders มิฉะนั้น Dr ลูกหนี้ (service.go:2036)
- standard GL ไม่มีบรรทัดต้นทุนขาย (COGS) ต้นทุนขายลงได้เฉพาะเมื่อใช้ template ดู [[acc-gl-posting-standard]] และ [[acc-gl-template-engine]]

## เอกสารต้นทาง-ปลายทาง
- ต้นทาง: ใบเสนอราคา 30, ใบจอง 34, ใบสั่งขาย 36 (คู่ {44,30}, {44,34}, {44,36} trans_ref_import.go:23) และมัดจำ 110
- ปลายทาง: เพิ่มหนี้ 46 และรับคืน 48 อ้างบรรทัด, เช็ค 410/411 และบัตร 461 อ้างผ่าน doc_ref, 144, ใบวางบิล 235 และรับชำระ 239
- นับเป็นหนี้ลูกหนี้เมื่อ inquiry เป็น 0 หรือ 2 (`arDebtWhere` docs.go:597)

## ยกเลิก/แก้ไข
- ยกเลิก 44 ด้วย flag 45 (doc_cancel.go:52)
- 144 ไม่มีคู่ยกเลิกใน `cancelOrigFlags` (ไม่พบในโค้ด)

## ข้อควรระวัง
- ตรวจวงเงินเฉพาะ 44 ที่ inquiry = 0 (`creditChecked` trans_save_rules.go:488) ผ่าน `checkCreditLimit` แล้วบันทึกผู้อนุมัติไว้ที่ user_approve (trans_credit.go:33)
- 144 ไม่นับในยอดใช้มัดจำ (`depositBalanceSQL` trans_deposit.go:65)

## ที่มาในโค้ด
- `frontend/account/tabs/transMenuMap.ts:827` เมนู
- `frontend/account/transaction/transLayouts.ts:89` FLAG_SPEC 44
- `backend/internal/application/process/stock_rebuild.go:18` stockRowsSQL
- `backend/internal/application/process/service.go:1998` / `:2036` GL ขาย
- `backend/internal/application/process/trans_save_rules.go:488` creditChecked
- `backend/internal/application/process/docs.go:597` arDebtWhere
- `backend/internal/application/process/doc_flow_graph.go:163` label 144
- `backend/internal/application/process/doc_cancel.go:52` ยกเลิก 45

## ดูเพิ่ม
- [[doc-sale-return]] · [[doc-sale-debit-note]] · [[doc-ar-receipt]] · [[doc-credit-card]] · [[acc-payment-tab]] · [[doctypes-overview]]
