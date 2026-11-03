---
title: "ทะเบียนลูกหนี้/ลูกค้า (ar_customer)"
tags: [tables, ap-ar]
aliases: ["ar_customer", "ลูกหนี้", "ลูกค้า", "ทะเบียนลูกหนี้", "customer master"]
sources: ["backend/internal/application/process/master_autorun.go:20", "backend/internal/application/process/lookup_party.go:34", "backend/internal/application/process/gl_template.go:194", "backend/internal/application/process/report_menu_ap_ar.go:922", "backend/internal/application/process/workflow.go:148"]
---

# ทะเบียนลูกหนี้ / ลูกค้า `ar_customer`

ตารางหลัก (master) ของลูกค้า — หนึ่งแถวต่อลูกหนี้. เก็บ **ข้อมูลตัวตนและที่อยู่**; ส่วนที่เป็นเงื่อนไขการขาย/เครดิต/บัญชี/ภาษีแยกไปที่ [[tbl-ar-customer-detail]] (`ar_code = code`), ที่อยู่จัดส่งอยู่ที่ [[tbl-ap-ar-transport-label]], ตัวแทนจำหน่ายที่ [[tbl-ar-dealer]]. ฝั่งเจ้าหนี้เป็นคู่ขนานคือ [[tbl-ap-supplier]]. ภาพรวมการบันทึก master: [[proc-master-data]].

## คอลัมน์ที่เห็นในโค้ด

| column | ความหมาย | ใช้ที่ไหน |
|---|---|---|
| `code` | รหัสลูกหนี้ varchar(25) — primary key ที่กันสองคนใช้เลขซ้ำ | `master_autorun.go:20-25` (`masterCodeMaxLen = 25`); อ้างจากเอกสารเป็น `ic_trans.cust_code`, `ap_ar_trans.cust_code`, `cb_trans.ap_ar_code` |
| `name_1` | ชื่อลูกหนี้ | ทุกรายงาน/lookup (`report_menu_ap_ar.go:926`) |
| `address`, `tambon`, `amper`, `province` | ที่อยู่ — ชื่อตำบล/อำเภอ/จังหวัดแปลงผ่านตาราง `erp_tambon` / `erp_amper` / `erp_province` | `report_menu_ap_ar.go:918-920` |
| `telephone`, `fax`, `email` | ช่องทางติดต่อ | `report_menu_ap_ar.go:928-930`; ใช้เป็นต้นแบบนำเข้าที่อยู่จัดส่ง `sysproc_tools.go:230` |
| `status` | 0 = ใช้งาน, 1 = ปิด (NULL ถือว่าไม่ active) — เงื่อนไข lookup ลูกค้า | `lookup_party.go:34-45` (`ar_customer.status=0`) |
| `ar_branch_code` | สาขาที่ดูแลลูกค้า — กรองเฉพาะเมื่อบริษัทตั้งให้ใช้ลูกค้าแยกสาขาและผู้ใช้สลับสาขาไม่ได้ | `lookup_party.go:34-45`; [[tbl-erp-branch-list]] |
| `ar_type` | ประเภทลูกหนี้ → ชื่อใน `ar_type.name_1` | `report_menu_ap_ar.go:936` |
| `ar_status` | ประเภท/สถานะผู้เสียภาษี — คัดลอกเป็น `cust_tax_type` ใน `gl_wht_list` และส่งเข้า GL template เป็นค่าสถานะของฝ่ายตรงข้าม (ความหมายของค่า 0/1/… ไม่ชัดจากโค้ดที่อ่าน; หน้าจอลูกหนี้ฝั่งฟรอนต์แสดงเป็นตัวเลือก 0/1) | `journaltax.go:242-250`; `gl_template.go:194`; `report_menu_gl_fa.go:1140`; `frontend/account/master/CustomerDetailScreen.tsx:300,742` |
| `roworder` | ลำดับแถว (เรียงรหัส/รายงาน) | `report_menu_ap_ar.go` order-by |

ฟิลด์เชิงเงื่อนไข (เครดิต ภาษี กลุ่ม บัญชี) **อยู่ที่ [[tbl-ar-customer-detail]]** ไม่ใช่ตารางนี้ — แม้คำอธิบายใน MCP gateway จะระบุ `tax_id, credit_money, debt_amount` ใต้ `ar_customer` (`mcp/gateway.go:1406`) แต่ SQL จริงของระบบอ่าน `tax_id`/`credit_money` จาก detail (`crm/handler.go:207`, `trans_credit.go:229-241`) — `debt_amount` ไม่พบในที่ใดของ backend (ไม่ชัดจากโค้ด). อย่าเชื่อคำอธิบาย gateway เป็น schema.

## ความสัมพันธ์

- 1 : 1 → [[tbl-ar-customer-detail]] (`ar_code = code`; โค้ดอ่านด้วย `LIMIT 1` เพราะไม่มี constraint ที่เห็น)
- 1 : 0..1 → [[tbl-ar-dealer]] (`ar_code`), 1 : N → [[tbl-ap-ar-transport-label]] (`cust_code`, `ar_ap_type = 1`)
- ← เอกสาร: [[tbl-ic-trans]] (`cust_code`), [[tbl-ap-ar-trans]] (`cust_code`), [[tbl-cb-trans]] (`ap_ar_code`), [[tbl-cb-chq-list]] (`ap_ar_code`)
- ตารางอ้างอิงมิติ: `ar_type`, `ar_group`, `ar_group_sub`, `ar_dimension` (อ่านเพื่อแสดงชื่อ — `report_menu_ap_ar.go:936-937`, `price_info.go:58-60`, `report_menu_so_po.go:872`)
- GL: บัญชีลูกหนี้ของลูกค้าอยู่ที่ `ar_customer_detail.account_code` → [[tbl-gl-chart-of-account]] (`gl_template.go:194`)

## ใครเขียน / ใครอ่าน

- **เขียน**: จัดการเป็น master ผ่านเส้นทาง generic/legacy write — หน้าจอ master เขียน `ar_customer` ผ่าน `/query/exec` ตาม legacy write allow-list (ADR-0011) (ต่างจากตารางเงิน `ap_ar_trans*`). การรันรหัสอัตโนมัติ `master_autorun.go:20-25` ใช้ primary key กันเลขซ้ำ. รายละเอียดการ validate master: `master_detail_specs.go:20-21` (`refCust`: "ไม่พบลูกค้า")
- **เปลี่ยนรหัส (renumber)**: `workflow.go:148-152` — `codeRef` ครอบ `ar_customer`, `ar_customer_detail`, `ar_dealer`, `ar_contactor`, `ar_item_by_customer`, `ic_inventory_price`, และชุดตารางเอกสารด้วย trans_flag ตาม `arChangeCodeFlags` (`workflow.go:105`) — ครอบ `ic_trans`, `ic_trans_detail`, `ap_ar_trans`, `ap_ar_trans_detail`, `cb_trans`, `cb_trans_detail`, … ของเอกสารฝั่งลูกหนี้
- **อ่าน**: lookup ลูกหนี้ (`lookup_party.go`), ค่าเริ่มต้นเอกสาร (`trans_party.go`), วงเงินเครดิต (`trans_credit.go:229-241`, `trans_save_rules.go:526-540`), รายงาน master ลูกหนี้ (`report_menu_ap_ar.go:922-947`), รายงานภาษี (`report_menu_gl_fa.go:1041,1095,1140`), `price_engine.go`/`price_info.go` (ผ่าน detail), `journaltax.go:242` (สร้าง `gl_wht_list`), GL template (`gl_template.go:194`)
- **ระบบอื่น**: CRM (`crm/handler.go:167-223` ใช้เป็น Customer 360), dashboard (`dashboard/handler.go:127`), AI (`ai/handler.go:118-125`, `ai/context_sales_ar.go`), MCP gateway (`mcp/gateway.go:1406,1643,2102`) และ autocare (`autocare/handler.go`,`seed.go`) — อ่านเท่านั้น (บาง seed อาจเพิ่มข้อมูลทดสอบ; รายละเอียดไม่ชัดจากโค้ดที่อ่าน)

## ข้อควรระวัง

- **ลูกหนี้ทั่วไป/POS** อาจใช้รหัสว่างหรือรหัสพิเศษ (`cust_code = ''` ใน `ic_trans`) — query ที่ join ต้องใช้ LEFT JOIN เสมอ (ตัวอย่าง `crm/handler.go:207`, `ai/context_sales_ar.go`).
- ต้องใช้ `status = 0` เมื่อทำ lookup/ตัวเลือกให้ผู้ใช้ — `status IS NULL` ไม่ถือว่า active (`lookup_party.go:34`).
- ถ้าเปลี่ยนรหัส ต้องใช้ tool เปลี่ยนรหัสของระบบ (ครอบทุกเอกสาร) ไม่ใช่ UPDATE ตรง — มิฉะนั้นเอกสารเก่าจะอ้างรหัสที่ไม่มีอยู่.
- ข้อมูลละเอียดอ่อน (เลขผู้เสียภาษี/เลขบัตร ประชาชน) อยู่ใน detail ไม่ใช่ตารางนี้ — ห้ามส่งออกใน log/แชท.
- ยอดคงค้างของลูกหนี้ **ไม่ได้เก็บเป็นคอลัมน์ในตารางนี้** แต่คำนวณจากเอกสาร (`arBalanceSQL` — `trans_save_rules.go:597-607`; หนี้ + เพิ่มหนี้ − ลดหนี้ − รับชำระ 239) ([[tbl-ap-ar-trans-detail]]).

## ที่มาในโค้ด

- `backend/internal/application/process/master_autorun.go:20-25`
- `backend/internal/application/process/lookup_party.go:24-45`
- `backend/internal/application/process/gl_template.go:193-194`
- `backend/internal/application/process/journaltax.go:242-250`
- `backend/internal/application/process/report_menu_ap_ar.go:918-947`
- `backend/internal/application/process/report_menu_gl_fa.go:1041,1095,1140`
- `backend/internal/application/process/trans_credit.go:229-241`, `trans_save_rules.go:526-540`
- `backend/internal/application/process/workflow.go:105-122,148-152`
- `backend/internal/application/process/master_detail_specs.go:20-21`
- `backend/internal/adapter/inbound/http/crm/handler.go:167-223`
- `backend/internal/adapter/inbound/http/mcp/gateway.go:1406`
