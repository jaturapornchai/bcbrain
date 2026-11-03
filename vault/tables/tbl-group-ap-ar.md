---
title: "กลุ่มตาราง ap_* / ar_* / ap_ar_* — เจ้าหนี้ ลูกหนี้ และใบวางบิล-รับ/จ่ายชำระ"
tags: [tables, ap-ar, group]
aliases: ["ap_*", "ar_*", "ap_ar_*", "กลุ่มตารางเจ้าหนี้ลูกหนี้", "AP-AR tables"]
sources: ["backend/internal/domain/query/write_policy.go:23", "backend/internal/domain/query/write_policy.go:24", "backend/internal/application/process/docs.go:483", "backend/internal/application/process/docs.go:528", "backend/internal/adapter/inbound/http/crm/handler.go:177", "backend/internal/adapter/inbound/http/dashboard/handler.go:126"]
---

# กลุ่มตาราง `ap_*` / `ar_*` / `ap_ar_*`

ตารางฝั่ง **เจ้าหนี้ (AP) / ลูกหนี้ (AR)** ที่ปรากฏในโค้ด backend (`backend/internal/**/*.go` ไม่รวม `_test`) แบ่งสองแบบที่ **นโยบายเขียนต่างกัน**:

- **ตารางเงิน** (`ap_ar_trans*`, `ap_ar_debt_*`, `ap_ar_deposit_money`, `ap_ar_pay_bill(_detail)`) — เขียนได้เฉพาะผ่าน `/api/process` ไม่ผ่านเกตเวย์ query ตรง ๆ (`write_policy.go:24` `moneyTablePattern`); บันทึกเอกสารแบบลบแล้วใส่ใหม่ตาม (`doc_no`, `trans_flag`) ในธุรกรรมเดียว (`docs.go:483-495`). ดู [[acc-transaction-save-flow]], [[proc-dispatcher]]
- **ตาราง master** (`ar_*`, `ap_*` ที่เหลือ รวม `ap_ar_transport_label`) — หน้าจอ master เขียนผ่าน `/query/exec` ตาม legacy write allow-list (ADR-0011); ชื่อ `ap_ar_transport_label` ถูกออกแบบให้ไม่โดน regex ตารางเงิน (`write_policy.go:23`). ดู [[proc-master-data]]

ตัวแยกฝั่งเจ้าหนี้/ลูกหนี้ในตารางเอกสาร: `trans_type` 1 = เจ้าหนี้/ซื้อ, 2 = ลูกหนี้/ขาย. รหัสเอกสาร: 213 วางบิลเจ้าหนี้, 235 วางบิลลูกหนี้, 19 จ่ายชำระเจ้าหนี้, 239 รับชำระลูกหนี้ ([[acc-trans-flag-map]]). ตัวเลขการอ้างอิง (`n`) ด้านล่างคือจำนวนครั้งที่ชื่อตารางปรากฏใน SQL (`FROM/JOIN/INTO/UPDATE/DELETE FROM`) ของ `backend/internal`.

## ตารางที่มีโน้ตแยก

- `ar_customer` → [[tbl-ar-customer]] — ทะเบียนลูกหนี้/ลูกค้า (n≈95 มากที่สุดของกลุ่ม; ถูก join ในแทบทุกรายงานขาย/ลูกหนี้)
- `ar_customer_detail` → [[tbl-ar-customer-detail]] — เครดิต ภาษี กลุ่มราคา บัญชีลูกหนี้ (n≈22)
- `ap_supplier` → [[tbl-ap-supplier]] — ทะเบียนเจ้าหนี้/ผู้ขาย (n≈35)
- `ap_supplier_detail` → [[tbl-ap-supplier-detail]] — เงื่อนไขซื้อ/ภาษี/บัญชีเจ้าหนี้ (n≈4)
- `ap_ar_trans` → [[tbl-ap-ar-trans]] — หัวเอกสารวางบิล/จ่าย-รับชำระ (n≈41; ตารางเงิน)
- `ap_ar_trans_detail` → [[tbl-ap-ar-trans-detail]] — รายการบิลที่วาง/ชำระ + รายการมัดจำ + ตัวบ่งชี้ปรับสต็อก (n≈44; ตารางเงิน)
- `ar_dealer` → [[tbl-ar-dealer]] — ข้อมูลตัวแทนจำหน่ายผูกลูกหนี้ (n≈6; ความหมายเชิงธุรกิจไม่ชัดจากโค้ด)
- `ap_ar_transport_label` → [[tbl-ap-ar-transport-label]] — ที่อยู่จัดส่ง/ป้ายขนส่ง แยกฝั่งด้วย `ar_ap_type` (n≈5)
- `ar_credit_pay_bill` → [[tbl-ar-credit-pay-bill]] — ตารางแปลงวันเครดิตเป็นวันครบกำหนดตามรอบวางบิล (n≈3; เปิดด้วย `erp_option.use_credit_pay_bill_calc`, [[tbl-erp-option]])

## ตารางอื่นที่อ่านในโค้ด (ยังไม่มีโน้ตแยก)

- `ar_group`, `ar_group_sub` — ชื่อกลุ่มลูกค้าหลัก/ย่อย อ่านเฉพาะเพื่อแสดงชื่อและจับราคาตามกลุ่ม (`price_info.go:58-60`; `report_menu_ap_ar.go:936-937`) — ดู [[proc-price-engine]]
- `ar_type` — ชื่อประเภทลูกหนี้ (`report_menu_ap_ar.go:936-937`)
- `ar_dimension` — ชื่อมิติลูกหนี้ ผูกกับ `ar_customer_detail.dimension_*` (`report_menu_so_po.go:872`)

## ตารางที่ปรากฏเฉพาะในรายการสิทธิ์เขียน/รายการชื่อ (ไม่พบ SQL อ่าน-เขียนใน backend)

ชื่อเหล่านี้อยู่ใน legacy write allow-list หรือ `write_policy.go:24` เท่านั้น — เป็นตาราง master/ตารางเงินที่หน้าจอ legacy หรือ frontend จัดการผ่านเส้นทาง generic; ความหมายคอลัมน์ "ไม่ชัดจากโค้ด":

- ฝั่งเจ้าหนี้: `ap_contactor`, `ap_item_by_supplier`, `ap_dimension`, `ap_group`, `ap_group_sub`, `ap_supplier_connected`, `ap_type`
- ฝั่งลูกหนี้: `ar_contactor`, `ar_item_by_customer`, `ar_customer_cashier_list`, `ar_customer_connected`, `ar_contact_group`, `ar_credit_approve`, `ar_credit_group`, `ar_keep_chq_condition`, `ar_keep_money_condition`, `ar_logistic_area`, `ar_pay_bill_condition`, `ar_paybill_area`, `ar_sale_area`
- ตารางเงินตาม pattern: `ap_ar_debt_*`, `ap_ar_deposit_money`, `ap_ar_pay_bill`, `ap_ar_pay_bill_detail` (`write_policy.go:24`) — ไม่พบ SQL ที่ใช้ตรง ๆ ใน backend

## ระบบอื่นที่ใช้ตารางกลุ่มนี้

- **CRM** — อ่าน `ar_customer`, `ar_customer_detail` (credit default `crm/handler.go:199-207`) และ `ap_ar_trans` ด้วย `trans_flag` 41/43 (`crm/handler.go:177-178`) ซึ่งไม่ตรงชุดรหัส 235/239 ที่ฝั่ง process ใช้ (`docs.go:528`) → ระวังตัวเลขไม่ตรงกัน
- **Dashboard** — นับ `ar_customer`, รวม `ap_supplier.debt_balance` เป็นเจ้าหนี้ค้างชำระ (`dashboard/handler.go:126-131`)
- **AI / MCP gateway** — อ่านอย่างเดียว: นับลูกค้า/ผู้ขาย (`ai/handler.go:118-125`), บริบทขาย-ลูกหนี้ (`ai/context_sales_ar.go`; `application/process/ai_copilot.go`), คำอธิบายตารางให้เครื่องมือ (`mcp/gateway.go:1406-1440`) — คำอธิบายคอลัมน์ในนั้นไม่ใช่ schema จริง
- **autocare** — seed ใส่ตัวอย่างเจ้าหนี้ลงในตาราง `ap_supplier` และลูกหนี้ลงใน `ar_customer` (`autocare/seed.go:291-302`) แล้วใช้ master เดียวกับระบบบัญชี; **procure** — อ่าน `ap_supplier` (code, name_1, telephone) มาแสดง (`procure/handler.go:1912`)
- **POS / WMS / TMS** — ไม่พบ SQL ที่แตะตารางกลุ่มนี้โดยตรงใน backend ที่อ่าน → ใช้ผ่าน process engine เท่านั้น

## ข้อควรระวัง

- ไม่มี DDL สร้างตารางหลักใน repo (มีแต่ `ALTER ... IF NOT EXISTS`: `service.go:817-856`, `platform/db/pool.go:37-74`) — คอลัมน์ในโน้ตทุกตัวมาจาก INSERT/SELECT/struct ที่อ่าน ไม่ใช่จาก schema
- รหัสลูกหนี้/เจ้าหนี้เป็น varchar(25); เปลี่ยนรหัสต้องผ่านเครื่องมือเปลี่ยนรหัส (`workflow.go:105-158`) เพราะรหัสถูกอ้างในตารางเอกสารจำนวนมาก
- ตารางเอกสารฝั่งขาย-ซื้อ ([[tbl-ic-trans]], [[tbl-ic-trans-detail]]) และฝั่งเงินสด/เช็ค ([[tbl-group-cb]]) ผูกกับ `cust_code`/`ap_ar_code` ของกลุ่มนี้ด้วยรหัส ไม่มี FK
- ภาพรวมการลงบัญชีและภาษี: [[acc-gl-posting-standard]], [[acc-vat-register-wht]]

## ที่มาในโค้ด

- `backend/internal/domain/query/write_policy.go:23-24`
- `backend/internal/application/process/docs.go:483-495,528`
- `backend/internal/application/process/price_info.go:58-60`
- `backend/internal/application/process/report_menu_ap_ar.go:936-937`
- `backend/internal/application/process/report_menu_so_po.go:872`
- `backend/internal/adapter/inbound/http/crm/handler.go:177-178,199-207`
- `backend/internal/adapter/inbound/http/dashboard/handler.go:126-131`
- `backend/internal/adapter/inbound/http/ai/handler.go:118-125`
- `backend/internal/adapter/inbound/http/mcp/gateway.go:1406-1440`
- `backend/internal/adapter/inbound/http/procure/handler.go:1912`
- `backend/internal/adapter/inbound/http/autocare/seed.go:291-302`
- `backend/internal/application/process/service.go:817-856`, `backend/internal/platform/db/pool.go:37-74`
