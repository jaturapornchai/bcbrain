---
title: "ขายสินค้า/บริการ และใบกำกับภาษีเต็มรูป (Sales Invoice)"
tags: [doctypes, sale]
aliases: ["trans_flag 44", "trans_flag 144", "ขายสินค้า", "ขายเงินเชื่อ", "ขายเงินสด", "ใบกำกับภาษี", "ใบกำกับภาษีเต็มรูป (แทนใบเสร็จย่อ)", "SI"]
sources: ["frontend/account/tabs/transMenuMap.ts:827", "frontend/account/transaction/transLayouts.ts:89", "frontend/account/transaction/transLayouts.ts:17", "frontend/account/transaction/transLayouts.ts:54", "frontend/account/transaction/transLayouts.ts:175", "backend/internal/application/process/transcalc.go:21", "backend/internal/application/process/stock_rebuild.go:19", "backend/internal/application/process/stock_rebuild.go:22", "backend/internal/application/process/trans_tax.go:40", "backend/internal/application/process/trans_tax.go:49", "backend/internal/application/process/service.go:2009", "backend/internal/application/process/service.go:2047", "backend/internal/application/process/trans_deposit.go:54", "backend/internal/application/process/trans_deposit.go:69", "backend/internal/application/process/trans_ref_import.go:36", "backend/internal/application/process/doc_flow.go:113", "backend/internal/application/process/trans_save_rules.go:488", "backend/internal/application/process/trans_save_rules.go:55", "backend/internal/application/process/trans_credit.go:44", "backend/internal/application/process/docs.go:600", "backend/internal/application/process/doc_flow_graph.go:163", "backend/internal/application/process/doc_cancel.go:52"]
---

# ขายสินค้า/บริการ (trans_flag 44) และใบกำกับเต็มรูป (144)

## ใช้เมื่อไร
ใช้ขายสินค้าหรือบริการ ทั้งเงินเชื่อและเงินสด อยู่ที่เมนู "ขายสินค้า/บริการ" (SI, transMenuMap.ts:827 เมนูใส่ transFlags 44/144) อ้าง 30/34/36 ได้
- 144 = "ใบกำกับภาษีเต็มรูป (แทนใบเสร็จย่อ)" ใช้เมนู `pos_full_invoide_list_pos` (doc_flow_graph.go:163)

## trans_flag/ตาราง
- 44 และ 144 มี calc_flag −1 (transcalc.go:21-22) เก็บใน [[tbl-ic-trans]] + [[tbl-ic-trans-detail]] ส่วนแท็บชำระเก็บใน [[tbl-cb-trans]] / [[tbl-cb-trans-detail]]

## ฟิลด์/แท็บบนหน้าจอ
- หัวเอกสาร: party, contactor, taxDoc, refDoc, inquiry, vat, sale แท็บ pay, wht, vat, gl (transLayouts.ts:89)
- inquiry ใช้ตัวเลือกทั่วไป 0 ขายเชื่อ (เครดิต), 1 ขายสด (`getInquiryTypeOptions` transLayouts.ts:17)
- 44 มีแท็บใช้เงินมัดจำ (`DEPOSIT_TAB_FLAGS` transLayouts.ts:54) และช่องประเภทการส่ง (`SEND_TYPE_FLAGS` transLayouts.ts:175)

## ผลต่อสต็อก
- 44 อยู่ในชุด flag ที่นับสต็อก (`stockRowsSQL` stock_rebuild.go:19) จึงเป็นสต็อกออก แต่ไม่นับใบ 44 ที่มี doc_ref และ is_pos = 1 (stock_rebuild.go:22)
- 144 ไม่อยู่ใน `stockRowsSQL` จึงไม่ตัดสต็อก
- 44 อยู่ใน `stockCheckFlags` ซึ่งตรวจยอดคงเหลือตอนบันทึก (trans_save_rules.go:55)

## ผลต่อภาษี (VAT/WHT)
- ภาษีขาย vat_calc 1 ทั้ง 44 และ 144 (`transVatTabs` trans_tax.go:40)
- WHT ฝั่ง ar "ภาษีถูกหัก ณ ที่จ่าย" ทั้ง 44 และ 144 (`transWhtParty` trans_tax.go:49)

## การลงบัญชี
standard GL `case 44, 46, 50, 144, 250, 254` (service.go:2009-2059) — `base` = ยอดรวม − VAT (service.go:1790), `advEx` = ยอดตัดมัดจำไม่รวม VAT (service.go:1839-1852) ใช้กับ 44 ไม่ใช้กับ 144 เพราะ `depositUseFlag` ดูจาก `depositKinds` ที่มี 44 (trans_deposit.go:54) บัญชีมัดจำ 214220 มาจาก `depositSale` (trans_deposit.go:42)
| Dr | Cr | จำนวน |
|---|---|---|
| ลูกหนี้ 1121 (สำรอง 1131, 1130, 1120) หรือเงินที่รับ (ดูเงื่อนไขด้านล่าง) | | ยอดรวม |
| มัดจำ 214220 (เมื่อตัดมัดจำ) | | `advEx` |
| | ขาย 4111 (สำรอง 4110, 4100) | `base` + `advEx` |
| | ภาษีขาย 2134 (สำรอง 2121, 2135, 2190) | VAT |

- ขายสด (44/144 ที่ inquiry เป็น 1 หรือ 3): ถ้ายอดใน cb_trans (เงินสด + โอน/wallet + บัตร) รวมเท่ายอดเงิน แยกเป็น Dr เงินสด 1111 / ธนาคารตามสมุดเงินฝาก / บัตร→บัญชีลูกหนี้ (service.go:2012-2040)
- ถ้าแยกไม่ได้ และเป็นขายสดหรือ inquiry = 1 ใช้ `payTenders(true)` (เงินสด, ธนาคาร, เช็ครับ 1122, บัตร, ภาษีถูกหัก 1153) มิฉะนั้น Dr ลูกหนี้ (service.go:2047-2051)
- บรรทัดยอดศูนย์ถูกตัดทิ้ง ใบที่มัดจำครอบคลุมทั้งใบจึงไม่มีบรรทัดลูกหนี้ (service.go:2366-2372)
- standard GL ไม่มีบรรทัดต้นทุนขาย (COGS) ต้นทุนขายลงได้เฉพาะเมื่อใช้ template ดู [[acc-gl-posting-standard]] และ [[acc-gl-template-engine]]

## เอกสารต้นทาง-ปลายทาง
- ต้นทาง: ใบเสนอราคา 30, ใบจอง 34, ใบสั่งขาย 36 (คู่ {44,30}, {44,34}, {44,36} trans_ref_import.go:36-38) และมัดจำ 110 (`depositKinds` trans_deposit.go:54)
- ปลายทาง: เพิ่มหนี้ 46 และรับคืน 48 อ้างบรรทัด, เช็ค 410/411 และบัตร 461 อ้างผ่าน doc_ref, 144 (`flowRules` 44 doc_flow.go:113-115), ใบวางบิล 235 และรับชำระ 239
- นับเป็นหนี้ลูกหนี้เมื่อ inquiry เป็น 0 หรือ 2 (`arDebtWhere` docs.go:600)

## ยกเลิก/แก้ไข
- ยกเลิก 44 ด้วย flag 45 (doc_cancel.go:52)
- 144 ไม่มีคู่ยกเลิกใน `cancelOrigFlags`

## ข้อควรระวัง
- ตรวจวงเงินเฉพาะ 44 ที่ inquiry = 0 (`creditChecked` trans_save_rules.go:488) ผ่าน `checkCreditLimit` (trans_save_rules.go:522) แล้วบันทึกผู้อนุมัติไว้ที่ user_approve (trans_credit.go:44)
- 144 ไม่นับในยอดใช้มัดจำ (`depositBalanceSQL` trans_deposit.go:69)

## ที่มาในโค้ด
- `frontend/account/tabs/transMenuMap.ts:827` เมนู
- `frontend/account/transaction/transLayouts.ts:89` FLAG_SPEC 44
- `backend/internal/application/process/stock_rebuild.go:19` stockRowsSQL
- `backend/internal/application/process/service.go:2009` / `:2047` GL ขาย
- `backend/internal/application/process/trans_save_rules.go:488` creditChecked
- `backend/internal/application/process/docs.go:600` arDebtWhere
- `backend/internal/application/process/doc_flow_graph.go:163` label 144
- `backend/internal/application/process/doc_cancel.go:52` ยกเลิก 45

## ดูเพิ่ม
- [[doc-sale-return]] · [[doc-sale-debit-note]] · [[doc-ar-receipt]] · [[doc-credit-card]] · [[acc-payment-tab]] · [[doctypes-overview]]
