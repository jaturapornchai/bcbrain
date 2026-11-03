---
title: "ทะเบียนเจ้าหนี้/ผู้ขาย (ap_supplier)"
tags: [tables, ap-ar]
aliases: ["ap_supplier", "เจ้าหนี้", "ผู้ขาย", "ทะเบียนเจ้าหนี้", "supplier master"]
sources: ["backend/internal/application/process/master_autorun.go:20", "backend/internal/application/process/lookup_party.go:34", "backend/internal/application/process/gl_template.go:193", "backend/internal/application/process/report_menu_gl_fa.go:1182", "backend/internal/application/process/workflow.go:154", "backend/internal/adapter/inbound/http/dashboard/handler.go:128"]
---

# ทะเบียนเจ้าหนี้ / ผู้ขาย `ap_supplier`

ตารางหลัก (master) ของเจ้าหนี้ — หนึ่งแถวต่อผู้ขาย. เป็นคู่ขนานของ [[tbl-ar-customer]] ฝั่งซื้อ: ตัวตน/ที่อยู่อยู่ที่นี่ เงื่อนไขการซื้อ/เครดิต/ภาษี/บัญชี/พิกัดอยู่ที่ [[tbl-ap-supplier-detail]] (`ap_code = code`), ที่อยู่ส่งของที่ [[tbl-ap-ar-transport-label]] (`ar_ap_type = 0`). ภาพรวมการบันทึก master: [[proc-master-data]].

## คอลัมน์ที่เห็นในโค้ด

| column | ความหมาย | ใช้ที่ไหน |
|---|---|---|
| `code` | รหัสเจ้าหนี้ varchar(25) — primary key กันเลขซ้ำ | `master_autorun.go:20-25`; ถูกอ้างเป็น `ic_trans.cust_code`, `ap_ar_trans.cust_code`, `cb_trans.ap_ar_code` |
| `name_1` | ชื่อเจ้าหนี้ | ทุก lookup/รายงาน (`report_menu_ap_ar.go:926`) |
| `prefixname`, `firstname`, `lastname` | คำนำหน้า/ชื่อ/นามสกุล (กรณีบุคคลธรรมดา) — ใช้ในรายงานหัก ณ ที่จ่าย | `report_menu_gl_fa.go:1182-1189` |
| `address`, `tambon`, `amper`, `province` | ที่อยู่ (ชื่อตำบล/อำเภอ/จังหวัดแปลงผ่านตาราง `erp_*`) | `report_menu_ap_ar.go:918-920` |
| `telephone`, `fax`, `email` | ช่องทางติดต่อ | `report_menu_ap_ar.go:928-930`; `procure/handler.go:1912` (เรียงตาม `roworder`) |
| `status` | 0 = ใช้งาน (เงื่อนไข lookup เจ้าหนี้) | `lookup_party.go:34-38` (`ap_supplier.status=0`) |
| `ap_status` | ประเภท/สถานะผู้เสียภาษี → `cust_tax_type` ใน `gl_wht_list`; ส่งเข้า GL template เป็นสถานะคู่ค้า; รายงาน ภ.ง.ด. กรองด้วย `ap_status = 1/0` ตามประเภทรายงาน (ค่าตัวเลขอื่นไม่ชัดจากโค้ด) | `journaltax.go:242-250`; `gl_template.go:193`; `report_menu_gl_fa.go:1138,1182-1189` |
| `debt_balance` | ยอดหนี้เจ้าหนี้คงเหลือที่เก็บเป็นคอลัมน์ — dashboard รวมค่านี้เป็น "เจ้าหนี้ค้างชำระ" (ที่มาของการอัปเดตค่าไม่พบใน backend ที่อ่าน) | `dashboard/handler.go:128` |
| `roworder` | ลำดับแถว | `procure/handler.go:1912` |

ไม่มี `ar_branch_code`/`ar_type` แบบฝั่งลูกหนี้ใน SQL ที่อ่าน. คำอธิบายใน MCP gateway ระบุ `tax_id, credit_money` ใต้ `ap_supplier` (`mcp/gateway.go:1407`) แต่โค้ดจริงอ่านจาก detail (`trans_party.go:121-126`) → ถือเป็นคำอธิบายประมาณเท่านั้น.

## ความสัมพันธ์

- 1 : 1 → [[tbl-ap-supplier-detail]] (`ap_code = code`)
- 1 : N → [[tbl-ap-ar-transport-label]] (`cust_code`, `ar_ap_type = 0`)
- ← เอกสาร: [[tbl-ic-trans]] (`cust_code` — ซื้อ/ใบเสนอซื้อ), [[tbl-ap-ar-trans]] (`cust_code`), [[tbl-cb-trans]] (`ap_ar_code`), [[tbl-cb-chq-list]] (`ap_ar_code`, เช็คจ่าย)
- GL: บัญชีเจ้าหนี้ที่ `ap_supplier_detail.account_code` → [[tbl-gl-chart-of-account]] (`gl_template.go:193`)

## ใครเขียน / ใครอ่าน

- **เขียน**: หน้าจอ master เขียนตารางนี้ผ่าน `/query/exec` ตาม legacy write allow-list (ADR-0011) — ไม่ใช่ตารางเงิน; `master_autorun.go:20-25` ออกรหัส; `master_detail_specs.go` validate การอ้างอิง.
- **เปลี่ยนรหัส**: `workflow.go:154-158` — `codeRef` ครอบ `ap_supplier`, `ap_supplier_detail`, `ap_contactor`, `ap_item_by_supplier` และตารางเอกสารด้วย trans_flag ตาม `apChangeCodeFlags` (`workflow.go:106`).
- **อ่าน**: lookup เจ้าหนี้ (`lookup_party.go`), ค่าเริ่มต้นเอกสารซื้อ (`trans_party.go:121-126`, `partyBuyFlags` 2,6,12,260,262,264), รายงานเจ้าหนี้ (`report_menu_ap_ar.go`), ภ.ง.ด.3/53 หัก ณ ที่จ่ายซื้อ (`report_menu_gl_fa.go:1138-1189`), `journaltax.go:242`, GL template (`gl_template.go:193`).
- **ระบบอื่น**: dashboard (`dashboard/handler.go:128-129`), procure (`procure/handler.go:1912` ดึง 4 รายแรกแสดงผล), AI/MCP (`ai/handler.go:119`, `mcp/gateway.go:1407,1644,2115`) — อ่านเท่านั้น.

## ข้อควรระวัง

- ใช้ `status = 0` เมื่อทำตัวเลือกเจ้าหนี้ (`lookup_party.go:34`).
- เปลี่ยนรหัสต้องใช้ tool เปลี่ยนรหัส (ครอบทุกเอกสาร) ไม่ใช่ UPDATE ตรง.
- `debt_balance` ไม่ใช่ตัวเลขที่ระบบเอกสารอัปเดตให้ (ไม่พบจุดเขียน) — ยอดหนี้ที่น่าเชื่อถือคำนวณจาก `ic_trans` + [[tbl-ap-ar-trans-detail]] (`billDebtSource` — `docs.go:600-626`).
- ตัวเลข `tax_id`/`card_id` ของเจ้าหนี้อยู่ใน detail ไม่ใช่ที่นี่ — ข้อมูลส่วนบุคคล ห้ามส่งออก.

## ที่มาในโค้ด

- `backend/internal/application/process/master_autorun.go:20-25`
- `backend/internal/application/process/lookup_party.go:24-45`
- `backend/internal/application/process/gl_template.go:193`
- `backend/internal/application/process/journaltax.go:242-250`
- `backend/internal/application/process/report_menu_gl_fa.go:1138,1182-1189`
- `backend/internal/application/process/report_menu_ap_ar.go:918-947`
- `backend/internal/application/process/trans_party.go:66-69,121-126`
- `backend/internal/application/process/workflow.go:106,154-158`
- `backend/internal/adapter/inbound/http/dashboard/handler.go:128-129`
- `backend/internal/adapter/inbound/http/procure/handler.go:1912`
- `backend/internal/adapter/inbound/http/mcp/gateway.go:1407`
