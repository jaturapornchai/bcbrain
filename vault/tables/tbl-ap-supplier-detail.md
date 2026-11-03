---
title: "รายละเอียดเงื่อนไขเจ้าหนี้ (ap_supplier_detail)"
tags: [tables, ap-ar]
aliases: ["ap_supplier_detail", "เงื่อนไขผู้ขาย", "เครดิตเจ้าหนี้", "พิกัดผู้ขาย"]
sources: ["backend/internal/application/process/trans_party.go:121", "backend/internal/application/process/gl_template.go:193", "backend/internal/application/process/journaltax.go:242", "backend/internal/application/process/report_menu_gl_fa.go:1045", "backend/internal/application/process/service.go:849", "backend/internal/platform/db/pool.go:67"]
---

# รายละเอียดเงื่อนไขเจ้าหนี้ `ap_supplier_detail`

ตารางลูกของ [[tbl-ap-supplier]] เชื่อมด้วย `ap_code = ap_supplier.code` (อ่านด้วย `LIMIT 1`). เก็บ **เงื่อนไขการซื้อและบัญชี** ของผู้ขาย — เป็นคู่ขนานฝั่งซื้อของ [[tbl-ar-customer-detail]] แต่คอลัมน์น้อยกว่า (ไม่มีวงเงินเครดิต/กลุ่มราคา/พนักงานขายในโค้ดที่อ่าน).

## คอลัมน์ที่เห็นในโค้ด

| column | ความหมาย | ใช้ที่ไหน |
|---|---|---|
| `ap_code` | รหัสเจ้าหนี้ (→ `ap_supplier.code`) | ทุก join/subquery |
| `account_code` | บัญชีเจ้าหนี้ของผู้ขาย ([[tbl-gl-chart-of-account]]) | `gl_template.go:193`; ตรวจก่อนลบผังบัญชี `workflow.go:170` |
| `discount_bill`, `discount_item` | ข้อความส่วนลดท้ายบิล / รายการ | `trans_party.go:121-126`; `trans_grid.go:281` |
| `set_tax_type`, `tax_type`, `tax_rate` | ตั้งค่าภาษีอัตโนมัติ / ชนิด / อัตรา — `tax_type` เป็นข้อความ (อาจไม่เป็นตัวเลข) จึงต้อง cast แบบปลอดภัย | `trans_party.go:121-126` (regex `^[0-9]+$`) |
| `credit_day` | วันเครดิตที่ผู้ขายให้ | `trans_party.go:121-126` |
| `lead_time` | ระยะเวลาส่งของ (ฝั่งซื้อเท่านั้น) | `trans_party.go:121-126` |
| `tax_id` | เลขประจำตัวผู้เสียภาษี — **ข้อมูลส่วนบุคคล** | `journaltax.go:242-250`; `report_menu_gl_fa.go:1045,1182-1189` |
| `card_id` | เลขบัตรประชาชน (กรณีบุคคลธรรมดา) | `journaltax.go:242-250` |
| `branch_code` | รหัสสาขาตามใบกำกับ/ภ.ง.ด. ของผู้ขาย | `report_menu_gl_fa.go:1182-1189` |
| `latitude`, `longitude` | พิกัดที่ตั้ง NUMERIC(18,6) — คอลัมน์ที่เพิ่มด้วย `ADD COLUMN IF NOT EXISTS` ตอนเริ่มระบบ | `service.go:849-850`, `platform/db/pool.go:67-68` |

คอลัมน์อื่นไม่ปรากฏใน SQL ที่อ่าน → "(ไม่ชัดจากโค้ด)". `ap_supplier_detail` เป็นตารางที่ไม่มี DDL สร้างใน repo — มีเพียงการ `ALTER ... IF EXISTS` เพิ่มพิกัด (`pool.go:67`).

## กลไกที่ใช้ตารางนี้

1. **ค่าเริ่มต้นเอกสารซื้อ** — เมื่อเลือกเจ้าหนี้ในเอกสารซื้อ (ชุด `partyBuyFlags`: 2, 6, 12, 260, 262, 264) อ่านส่วนลด ภาษี วันเครดิต lead time จากตารางนี้ (`trans_party.go:121-126`); ฝั่งซื้อไม่มีพนักงานขาย/วิธีส่ง (ใส่ค่าว่าง/0).
2. **บัญชีผูกเจ้าหนี้** — GL template ดึง `account_code` (`gl_template.go:193`) → [[acc-gl-template-engine]].
3. **หัก ณ ที่จ่าย / ภ.ง.ด.** — `journaltax.go:242-250` คัดลอก `tax_id`, `card_id` เข้า [[tbl-gl-wht-list]]; รายงาน ภ.ง.ด.3/53 อ่าน `tax_id`, `branch_code` (`report_menu_gl_fa.go:1045,1100,1182-1189`) → [[acc-vat-register-wht]].
4. **รายงานภาษีซื้อ** — อ่าน `tax_id` ของเจ้าหนี้ประกอบรายการ ([[tbl-gl-journal-vat-buy]]) ที่ `report_menu_gl_fa.go:1045`.

## ความสัมพันธ์

- ← [[tbl-ap-supplier]] (`ap_code = code`)
- → [[tbl-gl-chart-of-account]] (`account_code`)
- ใช้ร่วมกับเอกสารซื้อ [[tbl-ic-trans]] (ค่า default) และ [[tbl-ap-ar-trans]] (ใบวางบิล/จ่ายชำระ)

## ใครเขียน / ใครอ่าน

- **เขียน**: master-data — หน้าจอ master เขียนตารางนี้ผ่าน `/query/exec` ตาม legacy write allow-list (ADR-0011); เพิ่มคอลัมน์พิกัดตอน start (`service.go:849`, `pool.go:67`); เปลี่ยนรหัสตามแม่ `workflow.go:154-158`.
- **อ่าน**: ดูตาราง "กลไก" ด้านบน.

## ข้อควรระวัง

- `tax_type` ของฝั่งเจ้าหนี้เก็บเป็นข้อความ — ถ้าค่าไม่ใช่ตัวเลข โค้ดตีเป็น 0 (`trans_party.go:121-126`); ไม่ควร cast ตรงใน SQL อื่น.
- ไม่มีวงเงินเครดิตของเจ้าหนี้ในโค้ดที่อ่าน — อย่าสมมติ `credit_money` ตามคำอธิบาย MCP gateway (`mcp/gateway.go:1407`).
- พิกัด `latitude/longitude` เป็น NUMERIC(18,6) → ใช้ decimal ไม่ใช่ float เมื่อคำนวณระยะทางที่ต้องการความแม่น (นโยบายตัวเลขบัญชีเป็นเงินเท่านั้น ไม่บังคับกับพิกัด).
- `tax_id`/`card_id` เป็นข้อมูลส่วนบุคคล — ห้ามส่งออกใน log/แชท/vault.

## ที่มาในโค้ด

- `backend/internal/application/process/trans_party.go:66-69,119-126`
- `backend/internal/application/process/trans_grid.go:281`
- `backend/internal/application/process/gl_template.go:193`
- `backend/internal/application/process/journaltax.go:242-250`
- `backend/internal/application/process/report_menu_gl_fa.go:1045,1100,1182-1189`
- `backend/internal/application/process/service.go:849-850`
- `backend/internal/platform/db/pool.go:67-68`
- `backend/internal/application/process/workflow.go:154-158,170`
