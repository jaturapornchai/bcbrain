---
title: "หัวสรุปการรับ/จ่ายเงิน (cb_trans)"
tags: [tables, cb]
aliases: ["cb_trans", "สรุปช่องทางรับจ่ายเงิน", "แท็บรับชำระ", "pay tab header"]
sources: ["scripts/sql/02_data_schema.sql:2157", "scripts/sql/02_data_schema.sql:2211", "backend/internal/application/process/trans.go:1338", "backend/internal/application/process/trans.go:1380", "backend/internal/application/process/pos_bill.go:472", "backend/internal/application/process/fa_sale.go:558", "backend/internal/application/process/pay_check.go:36", "backend/internal/application/process/pay_check.go:78", "backend/internal/application/process/pay_other.go:89", "backend/internal/application/process/doc_flow.go:263", "backend/internal/application/process/service.go:732", "backend/internal/application/process/service.go:1885", "backend/internal/application/process/gl_template.go:760", "backend/internal/application/process/gl_template.go:842", "backend/internal/application/process/report_menu_cb.go:617", "backend/internal/domain/query/write_policy.go:24"]
---

# หัวสรุปรับ/จ่ายเงิน `cb_trans`

เก็บ **ยอดรวมตามช่องทาง** ของการรับ/จ่ายเงินที่ผูกกับเอกสารหนึ่งใบ — หนึ่งแถวต่อ (`doc_no`, `trans_flag`) DDL อยู่ที่ `scripts/sql/02_data_schema.sql:2157-2210` (มีเพียงดัชนี `(doc_no, trans_flag)` — `:2211` ไม่มี PK/FK) มาจาก "แท็บรับ/จ่ายชำระ" (pay tab) ของ:

- เอกสารขาย/ซื้อใน [[tbl-ic-trans]] ที่เปิดแท็บชำระเงิน — ใช้ `payTabEnabled(transFlag, inquiryType)` ตัดสิน: flag ที่ไม่มีช่องเงินสด/เงินเชื่อมีแท็บเสมอ ส่วนที่มีช่องนี้ (`payInquiryFlags`) เปิดแท็บเฉพาะชนิดเงินสด (เช่น 44 ต้อง inquiry_type 1 หรือ 3) — `pay_check.go:31-49`; ถ้าแท็บถูกปิด การบันทึกจะลบแถว `cb_trans` เดิมของเอกสารทิ้งอย่างเดียว (`trans.go:915-917`)
- ใบรับชำระหนี้ลูกหนี้ 239 / จ่ายชำระหนี้เจ้าหนี้ 19 ([[tbl-ap-ar-trans]]) — `docs.go:373`
- บิล POS (flag 44 — `pos_bill.go:26`, `:471-488`) และขายสินทรัพย์เป็นเงินสด (flag 1802 — `fa_sale.go:557-564`, `fa_depreciation.go:30`)

บรรทัดรายละเอียดของแต่ละช่องทางอยู่ใน [[tbl-cb-trans-detail]]; เช็ค/บัตรเครดิตที่รับ-จ่ายถูกสรุปเข้า [[tbl-cb-chq-list]]. ภาพรวมแท็บชำระเงินดู [[acc-payment-tab]].

## คอลัมน์สำคัญ

จาก INSERT `trans.go:1379-1386` (ทางหลัก) และ `pos_bill.go:471-488`:

| column | ความหมาย | ใช้ที่ไหน |
|---|---|---|
| `doc_no`, `trans_flag` | key ร่วมกับเอกสารเจ้าของ (ไม่มี FK ใน DDL) | join ที่ `gl_template.go:760`, `:842`; `service.go:1885`, `:1894` |
| `trans_type` | ค่า `transType` ของเอกสารเจ้าของ; 2 = ขาย/ลูกหนี้ (POS ใส่ 2 คงที่); GL ของ 19/239 ถือ 1,4 = เจ้าหนี้ และ 2,5 = ลูกหนี้ | `trans.go:1375`; `pos_bill.go:478`; `gl_template.go:822-823` |
| `doc_date`, `doc_time` | วัน-เวลาเอกสาร | `trans.go:1380` |
| `ap_ar_code` | รหัสลูกหนี้/เจ้าหนี้ที่จ่าย-รับ ([[tbl-ar-customer]] / [[tbl-ap-supplier]]) | `trans.go:1380`; ถูกแก้ตามเมื่อเปลี่ยนรหัสลูกหนี้/เจ้าหนี้ `workflow.go:117` |
| `pay_type` | 1 = รับเงิน (flag อยู่ใน `payReceiveFlags`), 2 = จ่ายเงิน; ถ้า 2 เช็คในแท็บเป็นเช็คจ่ายที่ใช้ passbook ของบริษัท; POS ใส่ 1 | `trans.go:1331`, `:1371-1374`, `:1387-1390`; `pos_bill.go:478` |
| `doc_format_code`, `branch_code` | รูปแบบเลขที่ ([[tbl-erp-doc-format]]) / สาขา ([[tbl-erp-branch-list]]) | `trans.go:1380`; ค้นเอกสารตอนแนบรูป `doc_picture.go:169`, `:224` |
| `total_amount` | ยอดเอกสารที่ส่งเข้ามาพร้อมแท็บชำระ (`docAmount`) | `trans.go:1385` (`$10`) |
| `total_net_amount` | `total_amount + total_expense_other` (SQL `$10 + $16`); POS = `total_amount` | `trans.go:1383`; `pos_bill.go:479`; dashboard รวมคอลัมน์นี้เป็น "กระแสเงินสด" (`dashboard/handler.go:130`) |
| `total_amount_pay` | INSERT ครั้งแรกเป็นผลรวมช่องทางทั้ง 5 (`trans.go:1386`) แล้วถูกเขียนทับด้วยยอดชำระที่ตรวจแล้ว = ช่องทางทั้ง 5 + `total_income_other` + ภาษีหัก ณ ที่จ่าย ซึ่งต้องเท่ากับยอดสุทธิ (เอกสาร + `total_expense_other`) | `pay_check.go:74-79`, `checkPayTotal` `:142-153`; GL ของ 250/254/260/264 เช็ค `> 0` เพื่อรู้ว่ามีแท็บชำระ (`service.go:1985`, `:2045`) |
| `cash_amount`, `tranfer_amount`, `chq_amount`, `card_amount`, `wallet_amount` | ยอดแยกตามช่องทาง: เงินสด / โอน / เช็ค / บัตรเครดิต / PromptPay-QR-กระเป๋าเงิน | `trans.go:1380-1386`; **ชื่อ `tranfer_amount` สะกดแบบนี้จริงใน DDL** (`02_data_schema.sql:2181`) |
| `total_expense_other`, `total_income_other` | ผลรวมตาราง "ค่าใช้จ่ายอื่น" (`cb_trans_detail.doc_type` 11) และ "รายได้อื่น" (12) ของแท็บ — **สลับข้างตามทิศทางเอกสาร**: flag ฝั่งจ่ายเอา 11 เป็น expense, flag ฝั่งรับเอา 12 เป็น expense | `pay_other.go:26-27`, `:89-97` |
| `pay_cash_amount`, `money_change` | เงินที่รับมา / เงินทอน (เฉพาะ 44 และ 144; ทอนคำนวณเฉพาะ 44 เมื่อรับมา > 0); POS คำนวณเอง | `pay_other.go:43`, `:99-108`; `pos_bill.go:458-461` |
| `total_tax_at_pay` | ภาษีหัก ณ ที่จ่ายตอนชำระ = ผลรวม `gl_wht_list.tax_value` ของเอกสาร (เขียนทับตอนตรวจแท็บ) | `pay_check.go:69-79`; ใช้ใน GL (`service.go:1885`, `gl_template.go:783`, `:830`) และรายงาน (`report_menu_sopo.go:200`, `report_menu_cb.go:601`) |
| `petty_cash_amount`, `total_income_amount`, `discount_amount`, `advance_amount`, `deposit_amount`, `total_credit_charge`, `total_other_currency`, `total_other_currency_charge` | อ่านโดย GL ของ 19/239 และรายงาน (`total_income_amount` ถูกแสดงเป็น "ปัดเศษ" ในรายงานสรุปรับ/จ่าย CB) — ไม่พบโค้ดเว็บที่เขียนคอลัมน์เหล่านี้ (INSERT ทั้งสามที่ไม่มี) | `gl_template.go:830-841`; `report_menu_ap_ar.go:799`; `report_menu_cb.go:599-600` |
| `coupon_amount`, `point_qty`, `point_amount`, `cashier_code` | POS ใส่ คูปอง / แต้มที่ใช้แลก (`point_qty`) / `point_amount` = 0 / แคชเชียร์; ยอดแต้มของลูกค้าหักด้วย `point_qty` | `pos_bill.go:472-486`; `report_menu_ap_ar.go:1064`, `report_menu_ap_ar_opts.go:74-75`; `point_amount` อ่านใน GL `gl_template.go:783` |
| `status` | 0 = ใช้งาน, 1 = ยกเลิก — คัดลอกจาก `last_status` ของเอกสารเจ้าของ | `doc_flow.go:246-263`, `service.go:732` |
| `remark`, `doc_ref` | หมายเหตุ / เลขเอกสารอ้างอิง — เขียน `remark` เฉพาะตอนขายสินทรัพย์เงินสด | `fa_sale.go:558-562`; อ่านที่ `doc_picture.go:169` |

## ความสัมพันธ์

- ← เอกสารเจ้าของ: [[tbl-ic-trans]] / [[tbl-ap-ar-trans]] / [[tbl-as-trans]] ผ่าน `doc_no + trans_flag`
- → [[tbl-cb-trans-detail]] (แยกรายช่องทาง/รายการ), → [[tbl-cb-chq-list]] (เช็ค/บัตรที่ลงทะเบียน; `cb_chq_list.doc_ref = doc_no` — ลบพร้อมกันที่ `trans.go:1343-1345`)
- → [[tbl-erp-pass-book]] ผ่านบรรทัดรายละเอียด (สมุดบัญชีธนาคารของบริษัท)
- รายการ GL ที่เกิดจากการรับ/จ่ายสร้างผ่าน template: [[acc-gl-template-engine]], [[acc-gl-posting-standard]]

## ใครเขียน / ใครอ่าน

- **เขียน** (ลบแล้วสร้างใหม่ตาม (`doc_no`, `trans_flag`) ในธุรกรรมเดียว — `payStmts` `trans.go:1338-1386`): เอกสาร IC เรียกที่ `trans.go:921`, เอกสาร AP/AR (19/239) ที่ `docs.go:373`; `pos_bill.go:465-488` (POS flag 44); `fa_sale.go:557-564` (ขายสินทรัพย์เงินสด)
- **อัปเดต**: `pay_check.go:78` (`total_tax_at_pay`, `total_amount_pay`); `status` ที่ `doc_flow.go:263` และ `service.go:732`
- **ลบ**: `trans.go:426` (ลบเอกสาร IC), `docs.go:492` (ลบเอกสาร AP/AR ผ่าน `apArPlan`), `fa_sale.go:488` (ลบเอกสารขายสินทรัพย์), `pos_bill.go:468`
- **อ่าน**: GL (`gl_template.go:759-760`, `:821-842`; `service.go:1871-1896`, `:2017-2023`), รายงาน CB สรุปรับ/จ่ายและเคลื่อนไหวเงินสด (`report_menu_cb.go:593-617`, `:628-634`), รายงานลูกหนี้ (`report_menu_ap_ar.go:799`, `:1064`), รายงาน SO/PO (`report_menu_so_po.go:358-359`, `report_menu_sopo.go:200`), flow graph เฉพาะ `status = 0` (`doc_flow_graph.go:1246-1260`), dashboard (`dashboard/handler.go:130`)
- **อ่านเพื่อคำนวณแต้ม**: เครื่องมือคำนวณแต้ม POS ใหม่ใช้ยอดที่ชำระจริงของ flag 44 (`sysproc_tools.go:122-131`)
- **เลขเอกสารถัดไป**: `doc_no_next.go:12` นับ `cb_trans` เป็นหนึ่งในตารางที่ตรวจเลขซ้ำ

## ข้อควรระวัง

- ตารางเงิน: INSERT/UPDATE/DELETE ผ่านเกตเวย์ `/query/exec` ถูกปฏิเสธ (`ErrMoneyTableViaExec` — `write_policy.go:14-16`, รูปแบบชื่อ `cb_trans(_\w+)?` ที่ `:24`) ต้องเขียนผ่าน `/api/process` เท่านั้น ห้ามแก้ตรง (ADR-0011 — `write_policy.go:9-13`)
- `tranfer_amount` สะกดตามนี้เท่านั้นใน SQL
- ไม่ใช่ทุกเอกสารมีแถว `cb_trans` — ไม่มีเมื่อแท็บถูกปิดหรือยอดทุกช่องทางเป็น 0 และไม่มีรายการอื่น (`trans.go:1368-1370`); ถ้าไม่มีแถว GL ตั้งรายการเงินสดเดี่ยวแทน (`service.go:1881-1897`)
- Dashboard รวม `total_net_amount` ของทุกแถวโดยไม่กรอง `status` (`dashboard/handler.go:130`) — ใช้เป็นตัวบ่งชี้ ไม่ใช่ยอดบัญชี
- แถวถูกลบแล้วสร้างใหม่ทุกครั้งที่บันทึก — อย่าใช้ `roworder` เป็น key ถาวร
- เมื่อเอกสารเจ้าของถูกยกเลิก `status` ของตารางนี้และ `last_status` ของ [[tbl-cb-trans-detail]] ตามด้วย (`doc_flow.go:246-264`); หลักการยกเลิกดู [[proc-doc-cancel-approve]]

## ที่มาในโค้ด

- `scripts/sql/02_data_schema.sql:2157-2211` DDL และดัชนี
- `backend/internal/application/process/trans.go:915-921,1331,1338-1390` แท็บชำระและ `payStmts`
- `backend/internal/application/process/docs.go:373,491-493` เอกสาร AP/AR
- `backend/internal/application/process/pos_bill.go:465-488` POS
- `backend/internal/application/process/fa_sale.go:557-564` ขายสินทรัพย์
- `backend/internal/application/process/pay_check.go:31-49,69-79,142-153` เปิดแท็บ ตรวจยอด WHT
- `backend/internal/application/process/pay_other.go:26-27,43,89-108` รายการอื่น เงินทอน
- `backend/internal/application/process/doc_flow.go:246-264` สถานะตามเอกสารเจ้าของ
- `backend/internal/application/process/service.go:732,1871-1897,1985,2017-2023,2045` GL และ recheck
- `backend/internal/application/process/gl_template.go:759-760,821-842` GL อ่านค่า
- `backend/internal/application/process/report_menu_cb.go:593-634` รายงาน CB
- `backend/internal/application/process/report_menu_ap_ar.go:799,1064` รายงานลูกหนี้
- `backend/internal/application/process/workflow.go:117` เปลี่ยนรหัสลูกหนี้/เจ้าหนี้
- `backend/internal/application/process/doc_no_next.go:12`
- `backend/internal/domain/query/write_policy.go:9-24`
- `backend/internal/adapter/inbound/http/dashboard/handler.go:130`
