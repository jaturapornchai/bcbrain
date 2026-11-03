---
title: "รายละเอียดเงื่อนไขลูกหนี้ (ar_customer_detail)"
tags: [tables, ap-ar]
aliases: ["ar_customer_detail", "เงื่อนไขลูกค้า", "วงเงินเครดิตลูกค้า", "กลุ่มลูกค้า"]
sources: ["backend/internal/application/process/trans_party.go:112", "backend/internal/application/process/trans_credit.go:229", "backend/internal/application/process/trans_save_rules.go:526", "backend/internal/application/process/price_engine.go:52", "backend/internal/application/process/gl_template.go:194", "backend/internal/application/process/journaltax.go:242"]
---

# รายละเอียดเงื่อนไขลูกหนี้ `ar_customer_detail`

ตารางลูกของ [[tbl-ar-customer]] — เก็บ **เงื่อนไขทางการค้าและบัญชี** ของลูกค้า: เครดิต ภาษี ส่วนลด กลุ่ม พนักงานขาย บัญชีผูกลูกหนี้ เลขผู้เสียภาษี. เชื่อมด้วย `ar_code = ar_customer.code` (โค้ดอ่านด้วย `LIMIT 1` เสมอ). หากลูกค้าไม่มีแถว detail ระบบ **ใช้ค่าเริ่มต้นว่าง** ไม่ error (`trans_party.go:131` — "party without a detail row: name only, no defaults").

ฝั่งเจ้าหนี้คู่ขนานคือ [[tbl-ap-supplier-detail]] (คอลัมน์ชุดหนึ่งเหมือนกัน).

## คอลัมน์ที่เห็นในโค้ด

| column | ความหมาย | ใช้ที่ไหน |
|---|---|---|
| `ar_code` | รหัสลูกหนี้ (→ `ar_customer.code`) | ทุก join/subquery |
| `account_code` | บัญชีลูกหนี้ของลูกค้านี้ ([[tbl-gl-chart-of-account]]) | `gl_template.go:194`, `fa_sale.go:339`; ตรวจ "ถูกใช้ในข้อมูลลูกหนี้" ก่อนลบผังบัญชี `master_detail_specs.go:135` |
| `sale_code` | พนักงานขายประจำลูกค้า (→ `erp_user.code`) | `trans_party.go:112-118`; รายงานขาย `report_menu_singha.go:972` |
| `discount_bill`, `discount_item` | ข้อความส่วนลดท้ายบิล / ส่วนลดรายการ (เช่น "5%") | `trans_party.go:112-118`; `trans_grid.go:280` |
| `set_tax_type`, `tax_type`, `tax_rate` | ตั้งค่าภาษีอัตโนมัติ / ชนิดภาษี / อัตรา | `trans_party.go:112-118` |
| `sale_type` | 1 = เงินสด, 2 = เงินเชื่อ — เติมชนิดการขายตอนเลือกลูกค้า | `trans_party.go:174` |
| `credit_day` | วันเครดิตมาตรฐาน | `trans_party.go:112-118`; รายงาน `report_menu_singha.go:959,972` |
| `credit_money` | วงเงินเครดิต | `trans_credit.go:229-241`; `report_menu_ap_ar.go:1096` |
| `credit_money_max` | วงเงินเครดิตสูงสุด | `trans_credit.go:229-241`; `report_menu_ap_ar.go:1096` |
| `credit_status` | สถานะเครดิต — ค่า 2 หมายถึงต้องขออนุมัติเครดิตก่อนบันทึก (ใช้ใน rule ใบสั่งขาย; ค่าอื่นไม่ชัดจากโค้ด) | `trans_save_rules.go:526-540` |
| `close_over_credit_warning` | 1 = ปิดการเตือนเมื่อเกินวงเงินเครดิต | `trans_credit.go:229-241` |
| `shipping_type` | วิธีส่งสินค้า → `ic_trans.send_type` (2 = รับเอง แปลงเป็น 0) | `trans_party.go:112-118,146` |
| `group_main`, `group_sub_1` … `group_sub_4` | กลุ่มลูกค้าหลัก/ย่อย (→ `ar_group`, `ar_group_sub`) ใช้จับราคาตามกลุ่ม | `price_engine.go:52-57`, `price_info.go:45-76`, `report_menu_ap_ar.go:939` |
| `area_code` | เขตขาย | `report_menu_singha.go:959,972` |
| `dimension_5` | มิติลูกหนี้ (→ `ar_dimension`) | `report_menu_so_po.go:872` |
| `tax_id`, `card_id` | เลขประจำตัวผู้เสียภาษี / เลขบัตรประชาชน — **ข้อมูลส่วนบุคคล ห้ามส่งออก** | `journaltax.go:242-250`, `crm/handler.go:207`, `report_menu_gl_fa.go:1041,1095` |
| `logistic_area`, `ap_code_ref`, `latitude`, `longitude` | พื้นที่ขนส่ง / รหัสเจ้าหนี้อ้างอิง (ลูกค้าที่เป็นเจ้าหนี้ด้วย — ไม่ชัดจากโค้ด) / พิกัด | `frontend/account/master/CustomerDetailScreen.tsx:304,845` |
| `lead_time` | ไม่มีในฝั่งลูกหนี้ (โค้ดใส่ 0 เสมอ ฝั่งเจ้าหนี้เท่านั้น) | `trans_party.go:112-118` |

คอลัมน์อื่นของตาราง (เช่น สาขา/ที่อยู่เพิ่มเติม) ไม่ปรากฏใน SQL ที่อ่าน → "(ไม่ชัดจากโค้ด)". หน้าจอลูกหนี้ฝั่งฟรอนต์ (`frontend/account/master/CustomerDetailScreen.tsx:296-310,838-852`) อ่าน-เขียนคอลัมน์ `logistic_area`, `ap_code_ref`, `latitude`, `longitude`, `dimension_1`…`dimension_10`, `ref_doc_1`…`ref_doc_3`, `branch_type`, `trade_license`, `vat_license`, `credit_date`, `close_credit_date`, `disable_auto_close_credit`, `past_due_day`, `close_reason`, `pay_bill_date`, `keep_chq_date` ผ่าน SQL ตรง ๆ (ความหมายธุรกิจของคอลัมน์เหล่านี้ที่ backend ไม่ได้อ่านจึง "ไม่ชัดจากโค้ด"; `latitude`/`longitude` ส่งเป็นตัวเลข `sqlNum`).

## กลไกที่ใช้ตารางนี้

1. **ค่าเริ่มต้นเอกสารขาย** — เมื่อเลือกลูกค้าในเอกสารขาย (ชุด `partySaleFlags`: 30, 34, 36, 44, 46, 48, 250, 252, 254) ระบบอ่านพนักงานขาย ส่วนลด ภาษี ชนิดการขาย วันเครดิต วิธีส่ง จากตารางนี้ (`trans_party.go:66-118`). กรณีเปิดใช้ `erp_option.use_credit_pay_bill_calc` วันครบกำหนดจะคำนวณจาก [[tbl-ar-credit-pay-bill]] แทน (`trans_party.go:222-252`, [[tbl-erp-option]]).
2. **ตรวจวงเงินเครดิต** — ใบสั่งขาย/ใบกำกับ: เทียบ `credit_money` กับยอดลูกหนี้คงค้าง + เช็คในมือ ([[tbl-cb-chq-list]]) + ใบสั่งขายค้าง − มัดจำ/ล่วงหน้า (`trans_credit.go:229-250`, `trans_save_rules.go:526-540`).
3. **ราคาตามกลุ่มลูกค้า** — `custGroupCond` เทียบ `cust_group_1 = group_main` และ `cust_group_2` กับ `group_sub_1..4` (`price_engine.go:52-57`, [[proc-price-engine]]).
4. **บัญชีผูกลูกหนี้** — GL template ดึง `account_code` ของลูกค้ามาลง Dr/Cr ลูกหนี้ (`gl_template.go:194`, [[acc-gl-template-engine]]).
5. **หัก ณ ที่จ่าย** — `journaltax.go:242-250` คัดลอก `tax_id`/`card_id` เข้า [[tbl-gl-wht-list]] ([[acc-vat-register-wht]]).

## ความสัมพันธ์

- ← [[tbl-ar-customer]] (`ar_code = code`)
- → [[tbl-gl-chart-of-account]] (`account_code`), → `erp_user` (`sale_code`), → `ar_group`/`ar_group_sub`/`ar_dimension`
- ใช้ร่วมกับ [[tbl-ar-credit-pay-bill]] (วันเครดิต → วันครบกำหนด)

## ใครเขียน / ใครอ่าน

- **เขียน**: master-data — หน้าจอ master เขียนตารางนี้ผ่าน `/query/exec` ตาม legacy write allow-list (ADR-0011). รหัสถูกเปลี่ยนพร้อมแม่ผ่าน `workflow.go:148-152`; เปลี่ยนผังบัญชีต้องอัปเดต `account_code` (`workflow.go:170`).
- **อ่าน**: ดูตาราง "กลไกที่ใช้" และ `crm/handler.go:207`, `report_menu_*`.

## ข้อควรระวัง

- `credit_money` ของ detail คือ **วงเงินตั้งไว้** ไม่ใช่ยอดคงค้าง; ยอดคงค้างคำนวณจากเอกสาร ([[tbl-ap-ar-trans-detail]], [[tbl-ic-trans]]).
- `credit_status = 2` ต้องผ่านอนุมัติเครดิต แต่เงื่อนไขนี้ใช้เฉพาะเมื่อเปิดตัวเลือก (`o.orderCredit`, `o.requestCredit`) — ไม่ใช่ทุกฐานข้อมูล.
- CRM ใช้ค่า default `credit_day = 30` และ `credit_money_max = 300000` เมื่อ detail ว่าง (`crm/handler.go:199-200`) — เป็นค่าแสดงผลของ CRM ไม่ใช่ค่าในฐานข้อมูล.
- `tax_id`/`card_id` เป็นข้อมูลส่วนบุคคล — ห้ามพิมพ์ลงแชท/log/vault.

## ที่มาในโค้ด

- `frontend/account/master/CustomerDetailScreen.tsx:296-310,838-852`
- `backend/internal/application/process/trans_party.go:66-131,146,174,222-252`
- `backend/internal/application/process/trans_credit.go:225-250`
- `backend/internal/application/process/trans_save_rules.go:526-540`
- `backend/internal/application/process/price_engine.go:52-57`, `price_info.go:45-76`
- `backend/internal/application/process/gl_template.go:193-194`, `fa_sale.go:339`
- `backend/internal/application/process/journaltax.go:242-250`
- `backend/internal/application/process/master_detail_specs.go:135`
- `backend/internal/application/process/report_menu_ap_ar.go:939,1096`, `report_menu_singha.go:626,959,972`, `report_menu_so_po.go:872`
- `backend/internal/adapter/inbound/http/crm/handler.go:199-207`
