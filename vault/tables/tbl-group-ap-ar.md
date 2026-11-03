---
title: "กลุ่มตาราง ap_* / ar_* / ap_ar_* — เจ้าหนี้ ลูกหนี้ และใบวางบิล-รับ/จ่ายชำระ"
tags: [tables, ap-ar, group]
aliases: ["ap_*", "ar_*", "ap_ar_*", "กลุ่มตารางเจ้าหนี้ลูกหนี้", "AP-AR tables"]
sources: ["backend/internal/domain/query/write_policy.go:23", "backend/internal/domain/query/write_policy.go:24", "backend/internal/domain/query/write_policy_legacy.go:11", "backend/internal/application/process/docs.go:482", "backend/internal/application/process/docs.go:523", "backend/internal/application/process/workflow.go:105", "backend/internal/application/process/master_detail_specs.go:20", "backend/internal/application/process/service.go:828", "backend/internal/platform/db/pool.go:37", "backend/internal/adapter/inbound/http/crm/handler.go:177", "backend/internal/adapter/inbound/http/dashboard/handler.go:126", "scripts/sql/02_data_schema.sql:461"]
---

# กลุ่มตาราง `ap_*` / `ar_*` / `ap_ar_*`

ตารางฝั่ง **เจ้าหนี้ (AP) / ลูกหนี้ (AR)** ที่ปรากฏในโค้ด backend (`backend/internal/**/*.go` ไม่รวม `_test`) แบ่งสองแบบที่ **นโยบายเขียนต่างกัน**:

- **ตารางเงิน** (`ap_ar_trans*`, `ap_ar_debt_*`, `ap_ar_deposit_money`, `ap_ar_pay_bill(_detail)`) — เขียนได้เฉพาะผ่าน `/api/process` ไม่ผ่านเกตเวย์ query ตรง ๆ (`write_policy.go:24` `moneyTablePattern`); บันทึกเอกสารแบบลบรายการเดิมของ (`doc_no`, `trans_flag`) ใน `ap_ar_trans_detail`, `ap_ar_trans`, `cb_trans_detail`, `cb_trans`, `cb_chq_list` แล้วใส่ใหม่ในธุรกรรมเดียว ส่วนการตรวจเลขเอกสารซ้ำดูที่ `doc_no` อย่างเดียว เพราะ `ap_ar_trans` unique บน `doc_no` (`docs.go:482-496`). ดู [[acc-transaction-save-flow]], [[proc-dispatcher]]
- **ตาราง master** (`ar_*`, `ap_*` ที่เหลือ รวม `ap_ar_transport_label`) — หน้าจอ master เขียนผ่าน `/query/exec` ตาม legacy write allow-list (ADR-0011 — `ap_ar_transport_label` `write_policy_legacy.go:11`, `ar_credit_pay_bill` `:12`, `ap_supplier`/`ap_supplier_detail` `:31`, `ar_customer`/`ar_customer_detail`/`ar_dealer` `:32`); ชื่อ `ap_ar_transport_label` ถูกออกแบบให้ไม่โดน regex ตารางเงิน (`write_policy.go:23`). ดู [[proc-master-data]]

ตัวแยกฝั่งเจ้าหนี้/ลูกหนี้ในตารางเอกสาร: `trans_type` 1 = เจ้าหนี้/ซื้อ, 2 = ลูกหนี้/ขาย. รหัสเอกสาร: 213 วางบิลเจ้าหนี้, 235 วางบิลลูกหนี้, 19 จ่ายชำระเจ้าหนี้, 239 รับชำระลูกหนี้ (`billSides` `docs.go:523-528`; [[acc-trans-flag-map]]). ตัวเลขการอ้างอิง (`n`) ด้านล่างคือจำนวนครั้งที่ชื่อตารางปรากฏใน SQL (`FROM/JOIN/INTO/UPDATE/DELETE FROM`) ของ `backend/internal` ไม่รวมไฟล์ `_test.go`; โครงสร้างคอลัมน์ครบอยู่ใน `scripts/sql/02_data_schema.sql` (ช่วงบรรทัดของแต่ละตารางอยู่ในหัวข้อ "ข้อควรระวัง").

## ตารางที่มีโน้ตแยก

- `ar_customer` → [[tbl-ar-customer]] — ทะเบียนลูกหนี้/ลูกค้า (n=59 มากที่สุดของกลุ่ม; ถูก join ในรายงานขาย/ลูกหนี้หลายตัว)
- `ar_customer_detail` → [[tbl-ar-customer-detail]] — เครดิต ภาษี กลุ่มราคา บัญชีลูกหนี้ (n=19)
- `ap_supplier` → [[tbl-ap-supplier]] — ทะเบียนเจ้าหนี้/ผู้ขาย (n=34)
- `ap_supplier_detail` → [[tbl-ap-supplier-detail]] — เงื่อนไขซื้อ/ภาษี/บัญชีเจ้าหนี้ (n=4)
- `ap_ar_trans` → [[tbl-ap-ar-trans]] — หัวเอกสารวางบิล/จ่าย-รับชำระ (n=39; ตารางเงิน; เอกสารยกเลิก 214/23/236/240 เป็นแถวหัวที่คัดลอก `trans_type` จากเอกสารเดิม — `doc_cancel.go:60,298-333`)
- `ap_ar_trans_detail` → [[tbl-ap-ar-trans-detail]] — รายการบิลที่วาง/ชำระ + รายการมัดจำ + ตัวบ่งชี้ปรับสต็อก (n=40; ตารางเงิน)
- `ar_dealer` → [[tbl-ar-dealer]] — ตารางลูกของลูกหนี้ (ผูก `ar_customer` ด้วย `ar_code`) ชื่อ dealer แต่หน้าจอ master เรียกแต่ละแถวว่า "สมาชิก"; backend อ้างถึงน้อย (n=2) ส่วนหน้าจอ `DealerScreen` อ่าน-เขียนผ่าน `/query/exec` ตรง ๆ
- `ap_ar_transport_label` → [[tbl-ap-ar-transport-label]] — ที่อยู่จัดส่ง/ป้ายขนส่ง แยกฝั่งด้วย `ar_ap_type` (n=4; หน้าพิมพ์ป้ายฝั่งเจ้าหนี้กรอง `ar_ap_type` เป็น 0 หรือ 2 ส่วนฝั่งลูกหนี้เป็น 1 — `TransportLabelPrintScreen.tsx:86-90`)
- `ar_credit_pay_bill` → [[tbl-ar-credit-pay-bill]] — ตารางแปลงวันเครดิตเป็นวันครบกำหนดตามรอบวางบิล (n=3; เปิดด้วย `erp_option.use_credit_pay_bill_calc`, [[tbl-erp-option]]; ใช้คำนวณวันครบกำหนดตอนเลือกลูกค้า/เจ้าหนี้ และทับ `DueDate` ตอนบันทึกเอกสารขาย 4 หน้าจอ — `trans_party.go:138-142,202-208`)

## ตารางอื่นที่อ่านในโค้ด (ยังไม่มีโน้ตแยก)

- `ar_group`, `ar_group_sub` — ชื่อกลุ่มลูกค้าหลัก/ย่อย อ่านเพื่อแสดงชื่อ จับราคาตามกลุ่ม (`price_info.go:58-60`; `report_menu_ap_ar.go:937`) และตรวจว่ารหัสกลุ่มลูกหนี้ (`cust_group_1` / `cust_group_2`) ในหน้าจอ master-detail มีอยู่จริง (`master_detail_specs.go:20-21,54`) — ดู [[proc-price-engine]]
- `ar_type` — ชื่อประเภทลูกหนี้ (`report_menu_ap_ar.go:936`)
- `ar_sale_area` — ตรวจว่า `sale_area_code` ในรายการแผนการขาย (`menu_sale_plan`) มีอยู่จริง (`master_detail_specs.go:453-461`)
- `ar_dimension` — ชื่อมิติลูกหนี้ ผูกกับ `ar_customer_detail.dimension_*` (`report_menu_so_po.go:872`)

## ตารางที่อยู่ในรายการสิทธิ์เขียน/รายการชื่อ (ไม่พบ SQL อ่าน-เขียนตรงใน backend ยกเว้นที่ระบุ)

ชื่อเหล่านี้อยู่ใน legacy write allow-list (`write_policy_legacy.go`) หรือ `write_policy.go:24` — เป็นตาราง master/ตารางเงินที่หน้าจอ legacy หรือ frontend จัดการผ่านเส้นทาง generic; ความหมายคอลัมน์ "ไม่ชัดจากโค้ด":

- ฝั่งเจ้าหนี้: `ap_dimension`, `ap_group`, `ap_group_sub`, `ap_type` (พบแค่ใน allow-list); `ap_contactor`, `ap_item_by_supplier` (พบเพิ่มในเครื่องมือเปลี่ยนรหัสเจ้าหนี้ `workflow.go:156-157`); `ap_supplier_connected` (พบเพิ่มแค่ ALTER ตอนเริ่มระบบ `service.go:843-847`, `platform/db/pool.go:50-54`)
- ฝั่งลูกหนี้: `ar_customer_cashier_list`, `ar_contact_group`, `ar_credit_approve`, `ar_credit_group`, `ar_keep_chq_condition`, `ar_keep_money_condition`, `ar_logistic_area`, `ar_pay_bill_condition`, `ar_paybill_area` (พบแค่ใน allow-list); `ar_contactor`, `ar_item_by_customer` (พบเพิ่มในเครื่องมือเปลี่ยนรหัสลูกหนี้ `workflow.go:152`); `ar_customer_connected` (พบเพิ่มแค่ ALTER ตอนเริ่มระบบ `service.go:849-851`, `platform/db/pool.go:56-58`)
- ตารางเงินตาม pattern: `ap_ar_debt_*`, `ap_ar_deposit_money`, `ap_ar_pay_bill`, `ap_ar_pay_bill_detail` (`write_policy.go:24`) — ไม่พบ SQL ที่ใช้ตรง ๆ ใน backend

## ระบบอื่นที่ใช้ตารางกลุ่มนี้

- **CRM** — อ่าน `ar_customer` + `ar_customer_detail` เป็นรายชื่อลูกค้า (เครดิตตั้งต้น 30 วัน / วงเงิน 300000 เมื่อ `credit_day` / `credit_money_max` ว่าง — `crm/handler.go:199-200`; query ช่วง `:192-211`) และรวม `ap_ar_trans` ด้วย `trans_flag` 41/43 (`crm/handler.go:177-178`) ซึ่งไม่ตรงชุดรหัส 235/239 ที่ฝั่ง process ใช้ (`billSides` `docs.go:523-528`) → ระวังตัวเลขไม่ตรงกัน
- **Dashboard** — ลูกหนี้ค้างชำระ (`ar_outstanding`) = ผลรวม `ap_ar_trans.total_net_value` ทุกแถวที่ `trans_type = 2` ไม่หักรับชำระและไม่กรอง `last_status`; เจ้าหนี้ค้างชำระ (`ap_outstanding`) = ผลรวม `ap_supplier.debt_balance`; นับแถว `ar_customer` / `ap_supplier` เป็น `ar_count` / `ap_count` (`dashboard/handler.go:126-129`)
- **AI / MCP gateway** — อ่านอย่างเดียว: นับลูกค้า/ผู้ขาย (`ai/handler.go:118-125`), บริบทขาย-ลูกหนี้ (`ai/context_sales_ar.go:35-62`; `application/process/ai_copilot.go:177-206`), คำอธิบายตารางให้เครื่องมือ (`mcp/gateway.go:1406-1440`) — คำอธิบายคอลัมน์ในนั้นไม่ใช่ schema จริง
- **autocare** — seed ใส่ตัวอย่างเจ้าหนี้ลงในตาราง `ap_supplier` และลูกหนี้ลงใน `ar_customer` (`autocare/seed.go:291-315`) แล้วใช้ master เดียวกับระบบบัญชี; **procure** — อ่าน `ap_supplier` (code, name_1, telephone) มาแสดง (`procure/handler.go:1912`)
- **POS / WMS / TMS** — ไม่พบ SQL ที่แตะตารางกลุ่มนี้ใน adapter ของสามระบบนี้ (adapter ที่แตะได้คือ ai, autocare, crm, dashboard, mcp, procure)

## ข้อควรระวัง

- DDL ของตารางหลักอยู่ที่ `scripts/sql/02_data_schema.sql`: `ap_ar_trans` 461-543, `ap_ar_trans_detail` 548-601, `ap_ar_transport_label` 613-660, `ap_supplier` 742-786, `ap_supplier_detail` 808-861, `ar_credit_pay_bill` 998-1013, `ar_customer` 1015-1080, `ar_customer_detail` 1109-1214, `ar_dealer` 1218-1248. บางคอลัมน์เกิดจาก `ALTER ... IF NOT EXISTS` ตอนเริ่มระบบเท่านั้นและไม่อยู่ใน DDL: `send_*` / `transport_code` ของ `ap_ar_transport_label` (`service.go:828-839`, `platform/db/pool.go:37-48`) และ `latitude` / `longitude` ของ `ap_supplier_detail` / `ar_dealer` (`service.go:860-861,866-867`, `pool.go:67-68,73-74`)
- รหัสลูกหนี้/เจ้าหนี้เป็น varchar(25) (`ar_customer.code` DDL บรรทัด 1019, `ap_supplier.code` บรรทัด 746); เปลี่ยนรหัสต้องผ่านเครื่องมือเปลี่ยนรหัส (`workflow.go:105-123,150-158` — ฝั่งลูกหนี้ครอบ `ar_customer`, `ar_customer_detail`, `ar_dealer`, `ar_contactor`, `ar_item_by_customer`, `ic_inventory_price` ฝั่งเจ้าหนี้ครอบ `ap_supplier`, `ap_supplier_detail`, `ap_contactor`, `ap_item_by_supplier`) เพราะรหัสถูกอ้างในตารางเอกสารจำนวนมาก
- ตารางเอกสารฝั่งขาย-ซื้อ ([[tbl-ic-trans]], [[tbl-ic-trans-detail]]) และฝั่งเงินสด/เช็ค ([[tbl-group-cb]]) ผูกกับ `cust_code`/`ap_ar_code` ของกลุ่มนี้ด้วยรหัส ไม่มี FK
- ภาพรวมการลงบัญชีและภาษี: [[acc-gl-posting-standard]], [[acc-vat-register-wht]]

## ที่มาในโค้ด

- `backend/internal/domain/query/write_policy.go:23-24`
- `backend/internal/domain/query/write_policy_legacy.go:11-12,31-32`
- `backend/internal/application/process/docs.go:482-496,523-528`
- `backend/internal/application/process/workflow.go:105-123,150-158`
- `backend/internal/application/process/master_detail_specs.go:20-21,453-461`
- `backend/internal/application/process/trans_party.go:138-142,202-208`
- `backend/internal/application/process/doc_cancel.go:60,298-333`
- `backend/internal/application/process/price_info.go:58-60`
- `backend/internal/application/process/report_menu_ap_ar.go:936-937`
- `backend/internal/application/process/report_menu_so_po.go:872`
- `backend/internal/adapter/inbound/http/crm/handler.go:177-178,192-211`
- `backend/internal/adapter/inbound/http/dashboard/handler.go:126-129`
- `backend/internal/adapter/inbound/http/ai/handler.go:118-125`
- `backend/internal/adapter/inbound/http/ai/context_sales_ar.go:35-62`
- `backend/internal/application/process/ai_copilot.go:177-206`
- `backend/internal/adapter/inbound/http/mcp/gateway.go:1406-1440`
- `backend/internal/adapter/inbound/http/procure/handler.go:1912`
- `backend/internal/adapter/inbound/http/autocare/seed.go:291-315`
- `backend/internal/application/process/service.go:828-851,860-867`, `backend/internal/platform/db/pool.go:37-74`
- `frontend/account/master/TransportLabelPrintScreen.tsx:86-90`
- `scripts/sql/02_data_schema.sql:461-1248`
