---
title: "หัวสรุปการรับ/จ่ายเงิน (cb_trans)"
tags: [tables, cb]
aliases: ["cb_trans", "สรุปช่องทางรับจ่ายเงิน", "แท็บรับชำระ", "pay tab header"]
sources: ["backend/internal/application/process/trans.go:1380", "backend/internal/application/process/pos_bill.go:472", "backend/internal/application/process/fa_sale.go:558", "backend/internal/application/process/pay_check.go:78", "backend/internal/application/process/doc_flow.go:263", "backend/internal/domain/query/write_policy.go:24"]
---

# หัวสรุปรับ/จ่ายเงิน `cb_trans`

เก็บ **ยอดรวมตามช่องทาง** ของการรับ/จ่ายเงินที่ผูกกับเอกสารหนึ่งใบ — หนึ่งแถวต่อ (`doc_no`, `trans_flag`). มาจาก "แท็บรับ/จ่ายชำระ" (pay tab) ของ:

- เอกสารขาย/ซื้อใน [[tbl-ic-trans]] ที่มีแท็บชำระเงิน (เช่น ขายสินค้า 44, ใบกำกับภาษีเต็มรูป 144, 40/110 มัดจำ ฯลฯ — ชุด flag ที่มีแท็บดู `payReceiveFlags` ใน `trans.go` ~1262)
- ใบรับชำระหนี้ลูกหนี้ 239 / จ่ายชำระหนี้เจ้าหนี้ 19 ([[tbl-ap-ar-trans]])
- บิล POS (flag 44 จาก `pos_bill.go`) และขายสินทรัพย์ (`fa_sale.go`)

บรรทัดรายละเอียดของแต่ละช่องทางอยู่ใน [[tbl-cb-trans-detail]]; เช็ค/บัตรเครดิตที่รับ-จ่ายถูกสรุปเข้า [[tbl-cb-chq-list]]. ภาพรวมแท็บชำระเงินดู [[acc-payment-tab]].

## คอลัมน์สำคัญ

จาก INSERT `trans.go:1380-1386` (ทางหลัก) และ `pos_bill.go:472-490`:

| column | ความหมาย | ใช้ที่ไหน |
|---|---|---|
| `doc_no`, `trans_flag` | key ร่วมกับเอกสารเจ้าของ (ไม่มี FK ทางกายภาพที่เห็นในโค้ด) | join ทั่วไป `gl_template.go:760,842`, `service.go:1874,1883` |
| `trans_type` | 1 = ฝั่งซื้อ/เจ้าหนี้, 2 = ฝั่งขาย/ลูกหนี้ (POS ใส่ 2 คงที่) | `trans.go:1380`; `pos_bill.go:472` |
| `doc_date`, `doc_time` | วัน-เวลาเอกสาร | `trans.go:1380` |
| `ap_ar_code` | รหัสลูกหนี้/เจ้าหนี้ที่จ่าย-รับ ([[tbl-ar-customer]] / [[tbl-ap-supplier]]) | `trans.go:1380`; อ้างตอนเปลี่ยนรหัส `workflow.go:117` |
| `pay_type` | 1 = รับเงิน, 2 = จ่ายเงิน (ถ้า 2 เช็คจะเป็นเช็คจ่ายที่ใช้ passbook บริษัท) | `trans.go:1394-1399`; POS ใส่ 1 `pos_bill.go:472` |
| `doc_format_code`, `branch_code` | รูปแบบเลขที่ ([[tbl-erp-doc-format]]) / สาขา ([[tbl-erp-branch-list]]) | `trans.go:1380`; `doc_picture.go:164` |
| `total_amount` | ยอดเอกสารที่เกี่ยวกับการชำระ (`$10`) | `trans.go:1380-1386` |
| `total_net_amount` | `total_amount + total_expense_other` (SQL คำนวณ `$10 + $16`) | `trans.go:1383`; dashboard รวมคอลัมน์นี้เป็น "กระแสเงินสด" (`dashboard/handler.go:130`) |
| `total_amount_pay` | ผลรวมช่องทางที่ผู้ใช้จ่ายจริง (ก่อนหัก WHT) | `trans.go:1383`; `pay_check.go:78` อัปเดตเมื่อคำนวณใหม่; `service.go:1974,2034` เช็ค `> 0` เพื่อรู้ว่ามี pay tab |
| `cash_amount`, `tranfer_amount`, `chq_amount`, `card_amount`, `wallet_amount` | ยอดแยกตามช่องทาง: เงินสด / โอน / เช็ค / บัตรเครดิต / กระเป๋าเงิน-QR | `trans.go:1380`; **ชื่อ `tranfer_amount` สะกดแบบนี้จริงใน DB** (ไม่ใช่ transfer) |
| `total_expense_other`, `total_income_other` | ยอดค่าใช้จ่ายอื่น/รายได้อื่นในแท็บชำระ (`cb_trans_detail.doc_type` 11 / 12) | `trans.go:1380`; `pay_other.go:53` |
| `pay_cash_amount`, `money_change` | เงินที่ลูกค้าส่งมา / เงินทอน (เฉพาะ 44 และ 144) | `trans.go:1380`; `pay_other.go:54`, `payCashFlags` |
| `total_tax_at_pay` | ภาษีหัก ณ ที่จ่ายตอนชำระ | `pay_check.go:78`; ใช้ใน GL (`gl_template.go:760`), รายงาน (`report_menu_sopo.go:200`), `service.go:1874` |
| `petty_cash_amount` | ยอดเงินสดย่อยที่ใช้ในการจ่าย | `report_menu_ap_ar.go:799` |
| `coupon_amount`, `point_qty`, `point_amount`, `cashier_code` | คูปอง / แต้มที่ใช้ / แต้มที่ได้ (POS ใส่ 0) / แคชเชียร์ | `pos_bill.go:472-490`; แต้มสะสมลูกค้า `report_menu_ap_ar.go:1064`, `report_menu_ap_ar_opts.go:75` |
| `status` | 0 = ใช้งาน, 1 = ยกเลิก (ตามสถานะเอกสารเจ้าของ) | `doc_flow.go:263`, `service.go:721` |
| `remark`, `doc_ref` | หมายเหตุ / เลขเอกสารอ้างอิง | `doc_picture.go:164` |

## ความสัมพันธ์

- ← เอกสารเจ้าของ: [[tbl-ic-trans]] / [[tbl-ap-ar-trans]] / [[tbl-as-trans]] ผ่าน `doc_no + trans_flag`
- → [[tbl-cb-trans-detail]] (แยกรายช่องทาง/รายการ), → [[tbl-cb-chq-list]] (เช็ค/บัตรที่ลงทะเบียน; `cb_chq_list.doc_ref = doc_no`)
- → [[tbl-erp-pass-book]] ผ่านบรรทัดรายละเอียด (สมุดบัญชีธนาคารของบริษัท)
- รายการ GL ที่เกิดจากการรับ/จ่ายสร้างผ่าน template: [[acc-gl-template-engine]], [[acc-gl-posting-standard]]

## ใครเขียน / ใครอ่าน

- **เขียน** (ลบ-สร้างใหม่ตาม (doc_no, trans_flag) ในธุรกรรมเดียว — ดู `payStmts`): `trans.go:1380` (ทุกเอกสารที่มี pay tab รวม 19/239), `pos_bill.go:468-490` (POS flag 44), `fa_sale.go:558-563` (ขายสินทรัพย์เป็นเงินสด), `pay_check.go:78` (คำนวณ WHT ใหม่)
- **อัปเดตสถานะ**: `doc_flow.go:263`, `service.go:721`
- **ลบ**: `docs.go:492` (ผ่าน `apArPlan`), `pos_bill.go:468`
- **อ่าน**: GL template (`gl_template.go:758-760,820-842`), ตรวจ/สร้างแท็บชำระเดิม (`service.go:1858-1883,2004-2010,2159`), รายงาน CB (`report_menu_cb.go`), รายงานลูกหนี้ (`report_menu_ap_ar.go:799,866`), รายงาน SO/PO (`report_menu_so_po.go:359`, `report_menu_sopo.go:200`), flow graph (`doc_flow_graph.go:1259`), tool ตรวจระบบ (`sysproc_tools.go:130`), dashboard (`dashboard/handler.go:130`)
- **เลขเอกสารถัดไป**: `doc_no_next.go:12` นับ `cb_trans` เป็นหนึ่งในตารางที่ตรวจเลขซ้ำ

## ข้อควรระวัง

- ตารางเงิน: เขียนได้เฉพาะผ่าน `/api/process` (`moneyTablePattern` `write_policy.go:24` รวม `cb_trans(_\w+)?`) — ห้ามแก้ตรง.
- `tranfer_amount` สะกดผิดจากต้นฉบับ C# และต้องใช้ชื่อนี้เท่านั้นใน SQL.
- ไม่ใช่ทุกเอกสารมีแถว `cb_trans` — มีเฉพาะเมื่อมีการชำระผ่านแท็บ; ถ้าไม่มี GL/รายงานจะ fallback เป็นเงินสดเดี่ยว (`service.go:1858-1883` payTenders).
- Dashboard รวม `total_net_amount` ของทุกแถวโดยไม่กรอง `status` (`dashboard/handler.go:130`) — ใช้เป็นตัวบ่งชี้ ไม่ใช่ยอดบัญชี.
- แถวถูกลบ-สร้างทุกครั้งที่บันทึก — อย่าใช้ `roworder` เป็น key ถาวร.
- เมื่อเอกสารเจ้าของถูกยกเลิก ต้องตาม `status` ของตารางนี้และ `last_status` ของ [[tbl-cb-trans-detail]] ด้วย (`doc_flow.go:262-264`); หลักการยกเลิกดู [[proc-doc-cancel-approve]].

## ที่มาในโค้ด

- `backend/internal/application/process/trans.go:1380-1386,1392-1400`
- `backend/internal/application/process/pos_bill.go:468-490`
- `backend/internal/application/process/fa_sale.go:558-563`
- `backend/internal/application/process/pay_check.go:54-78`
- `backend/internal/application/process/pay_other.go:50-54`
- `backend/internal/application/process/doc_flow.go:262-263`
- `backend/internal/application/process/service.go:721,1858-1883,1974,2004-2010,2034,2159`
- `backend/internal/application/process/gl_template.go:758-760,820-842`
- `backend/internal/application/process/report_menu_ap_ar.go:799,866,1064`
- `backend/internal/application/process/doc_no_next.go:12`
- `backend/internal/application/process/workflow.go:117`
- `backend/internal/domain/query/write_policy.go:24`
- `backend/internal/adapter/inbound/http/dashboard/handler.go:130`
