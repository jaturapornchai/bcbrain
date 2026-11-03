---
title: "รายละเอียดเงื่อนไขเจ้าหนี้ (ap_supplier_detail)"
tags: [tables, ap-ar]
aliases: ["ap_supplier_detail", "เงื่อนไขผู้ขาย", "เครดิตเจ้าหนี้", "พิกัดผู้ขาย"]
sources: ["backend/internal/application/process/trans_party.go:121", "backend/internal/application/process/gl_template.go:193", "backend/internal/application/process/journaltax.go:242", "frontend/account/master/SupplierDetailScreen.tsx:258", "backend/internal/application/process/report_menu_gl_fa.go:1048", "backend/internal/application/process/report_menu_gl_fa.go:1185", "backend/internal/application/process/service.go:860", "backend/internal/application/process/trans_grid.go:281", "backend/internal/application/process/ai_copilot.go:199", "backend/internal/application/process/workflow.go:170", "backend/internal/domain/query/write_policy_legacy.go:31", "backend/internal/adapter/inbound/http/mcp/gateway.go:1407", "backend/internal/platform/db/pool.go:67", "scripts/sql/02_data_schema.sql:808"]
---

# รายละเอียดเงื่อนไขเจ้าหนี้ `ap_supplier_detail`

ตารางลูกของ [[tbl-ap-supplier]] เชื่อมด้วย `ap_code = ap_supplier.code` (อ่านด้วย `LIMIT 1`). เก็บ **เงื่อนไขการซื้อและบัญชี** ของผู้ขาย — เป็นคู่ขนานฝั่งซื้อของ [[tbl-ar-customer-detail]] แต่คอลัมน์น้อยกว่า (ไม่มีวงเงินเครดิต/กลุ่มราคา/พนักงานขาย; มี "เครดิตการซื้อ" `credit_purchase` และ "พนักงานจ่ายเงิน" `staff_pay_code` แทน). หน้าจอเจ้าหนี้อ่านและบันทึกคอลัมน์ทั้งหมดในตารางด้านล่างด้วย SQL ชุดเดียว (`SupplierDetailScreen.tsx:258-267,809-830`).

## คอลัมน์ที่เห็นในโค้ด

| column | ความหมาย | ใช้ที่ไหน |
|---|---|---|
| `ap_code` | รหัสเจ้าหนี้ (→ `ap_supplier.code`) | ทุก join/subquery |
| `account_code` | บัญชีเจ้าหนี้ของผู้ขาย ([[tbl-gl-chart-of-account]]) | `gl_template.go:193`; ระบบแก้ค่านี้ตามเมื่อเปลี่ยนรหัสผังบัญชี `workflow.go:170` |
| `discount_bill`, `discount_item` | ข้อความส่วนลดท้ายบิล / รายการ | `trans_party.go:121-126`; `trans_grid.go:281` |
| `set_tax_type`, `tax_type`, `tax_rate` | ตั้งค่าภาษีอัตโนมัติ / ชนิด / อัตรา — `tax_type` เป็นข้อความ (อาจไม่เป็นตัวเลข) จึงต้อง cast แบบปลอดภัย | `trans_party.go:121-126` (regex `^[0-9]+$`) |
| `credit_day` | วันเครดิตที่ผู้ขายให้ | `trans_party.go:121-126` |
| `lead_time` | ระยะเวลาส่งของ (ฝั่งซื้อเท่านั้น) | `trans_party.go:121-126` |
| `tax_id` | เลขประจำตัวผู้เสียภาษี — **ข้อมูลส่วนบุคคล** | `journaltax.go:242-250`; `report_menu_gl_fa.go:1048,1060,1185-1189` |
| `card_id` | เลขบัตรประชาชน (กรณีบุคคลธรรมดา) | `journaltax.go:242-250` |
| `branch_type`, `branch_code` | ประเภทสำนักงาน (0 = สำนักงานใหญ่, 1 = สาขา) และรหัสสาขาตามใบกำกับ/ภ.ง.ด. ของผู้ขาย | `report_menu_gl_fa.go:1048,1061-1062,1185-1189` |
| `credit_purchase` | เครดิตการซื้อ — คอลัมน์ smallint (หน้าจอกันค่าเกิน 0–32767) | `SupplierDetailScreen.tsx:695-696,1993` |
| `staff_pay_code` | พนักงานจ่ายเงิน (รหัส `erp_user` — หน้าจอค้นชื่อมาแสดง) | `SupplierDetailScreen.tsx:364,1915` |
| `payment_way`, `pay_bill_way`, `pay_condition`, `shipping_type` | ข้อความอิสระ: วิธีการชำระเงิน / วิธีการวางบิล / เงื่อนไขการชำระ / การขนส่ง | `SupplierDetailScreen.tsx:260-262,1942-2110` |
| `dimension_1`..`dimension_10`, `group_main`, `group_sub_1`..`group_sub_4` | มิติและกลุ่มเจ้าหนี้ที่หน้าจอเก็บไว้กับเจ้าหนี้ | `SupplierDetailScreen.tsx:264-265,815-817` |
| `latitude`, `longitude` | พิกัดที่ตั้ง NUMERIC(18,6) — คอลัมน์ที่เพิ่มด้วย `ADD COLUMN IF NOT EXISTS` ตอนเริ่มระบบ | `service.go:860-861`, `platform/db/pool.go:67-68` |

DDL ของตารางอยู่ที่ `scripts/sql/02_data_schema.sql:808-861`; `latitude`/`longitude` ไม่อยู่ใน DDL แต่เพิ่มด้วย `ALTER ... IF EXISTS` ตอนเริ่มระบบ (`pool.go:67-68`). คอลัมน์ที่มีใน DDL แต่ตารางด้านบนไม่ได้อธิบาย → "(ไม่ชัดจากโค้ด)": `credit_code`, `form_name`, `trade_license`, `close_reason`, `close_date`, `picture_1`…`picture_4`, `ref_doc_1`…`ref_doc_3`, `currency_code`, `passbook_code`.

## กลไกที่ใช้ตารางนี้

1. **ค่าเริ่มต้นเอกสารซื้อ** — เมื่อเลือกเจ้าหนี้ในเอกสารซื้อ (ชุด `partyBuyFlags`: 2, 6, 12, 260, 262, 264) อ่านส่วนลด ภาษี วันเครดิต lead time จากตารางนี้ (`trans_party.go:121-126`); ฝั่งซื้อไม่มีพนักงานขาย/วิธีส่ง (ใส่ค่าว่าง/0).
2. **บัญชีผูกเจ้าหนี้** — GL template ดึง `account_code` (`gl_template.go:193`) → [[acc-gl-template-engine]].
3. **หัก ณ ที่จ่าย / ภ.ง.ด.** — `journaltax.go:242-250` คัดลอก `tax_id`, `card_id` เข้า [[tbl-gl-wht-list]]; ส่งออกข้อมูลภาษีหัก ณ ที่จ่าย (`glfaWhtExport`) อ่าน `tax_id`, `branch_code` (`report_menu_gl_fa.go:1185-1189`) → [[acc-vat-register-wht]].
4. **รายงานภาษีซื้อ** — ใช้ `tax_id`, `branch_type`, `branch_code` ของเจ้าหนี้เป็นค่าสำรองเมื่อแถวภาษีซื้อ ([[tbl-gl-journal-vat-buy]]) ไม่มีเลขผู้เสียภาษี/สาขาของตัวเอง (`glfaVatRun` — `report_menu_gl_fa.go:1048,1059-1062,1103`).

## ความสัมพันธ์

- ← [[tbl-ap-supplier]] (`ap_code = code`)
- → [[tbl-gl-chart-of-account]] (`account_code`)
- ใช้ร่วมกับเอกสารซื้อ [[tbl-ic-trans]] (ค่า default) และ [[tbl-ap-ar-trans]] (ใบวางบิล/จ่ายชำระ)

## ใครเขียน / ใครอ่าน

- **เขียน**: master-data — หน้าจอ master เขียนตารางนี้ผ่าน `/query/exec` ตาม legacy write allow-list (ADR-0011, `write_policy_legacy.go:31`); เพิ่มคอลัมน์พิกัดตอน start (`service.go:860`, `pool.go:67`); เปลี่ยนรหัสตามแม่ `workflow.go:154-158`.
- **อ่าน**: ดูตาราง "กลไก" ด้านบน.

## ข้อควรระวัง

- `tax_type` ของฝั่งเจ้าหนี้: หน้าจอบันทึกเป็นตัวเลข 0 = ภาษีแยกนอก, 1 = ภาษีรวมใน, 2 = ภาษียกเว้น (`SupplierDetailScreen.tsx:822,2071-2083`) แต่โค้ดอ่านค่ากลับแบบปลอดภัย — ถ้าไม่ใช่ตัวเลขตีเป็น 0 (`trans_party.go:121-126`).
- ตารางนี้ไม่มีคอลัมน์ `credit_money` (ฝั่งเจ้าหนี้ใช้ `credit_purchase`) — อย่าสมมติตามคำอธิบาย MCP gateway (`mcp/gateway.go:1407`) หรือ SQL ตัวอย่างของ AI (`ai_copilot.go:199`).
- พิกัด `latitude/longitude` เป็น NUMERIC(18,6) → ใช้ decimal ไม่ใช่ float เมื่อคำนวณระยะทางที่ต้องการความแม่น (นโยบายตัวเลขบัญชีเป็นเงินเท่านั้น ไม่บังคับกับพิกัด).
- `tax_id`/`card_id` เป็นข้อมูลส่วนบุคคล — ห้ามส่งออกใน log/แชท/vault.

## ที่มาในโค้ด

- `backend/internal/application/process/trans_party.go:66-69,121-126`
- `backend/internal/application/process/trans_grid.go:281`
- `backend/internal/application/process/gl_template.go:193`
- `backend/internal/application/process/journaltax.go:242-250`
- `backend/internal/application/process/report_menu_gl_fa.go:1048,1059-1062,1103,1185-1189`
- `frontend/account/master/SupplierDetailScreen.tsx:258-267,695-696,809-830,1915-2110`
- `backend/internal/application/process/service.go:860-861`
- `backend/internal/application/process/ai_copilot.go:199`
- `backend/internal/adapter/inbound/http/mcp/gateway.go:1407`
- `backend/internal/domain/query/write_policy_legacy.go:31`
- `scripts/sql/02_data_schema.sql:808-861`
- `backend/internal/platform/db/pool.go:67-68`
- `backend/internal/application/process/workflow.go:154-158,170`
