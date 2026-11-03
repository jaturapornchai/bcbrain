---
title: "erp_doc_format — รูปแบบ/ชนิดเอกสารและเลขที่รัน"
tags: [tables, erp, doc-format, running-number, company-db]
aliases: ["erp_doc_format", "รูปแบบเลขที่เอกสาร", "doc_format_code", "autorun เลขที่เอกสาร", "@YYMM-####"]
sources: ["backend/internal/application/process/stock_tools.go:699", "backend/internal/application/process/doc_cancel.go:389", "backend/internal/application/process/doc_no_next.go:12", "backend/internal/application/process/master_autorun.go:106", "backend/internal/application/process/doc_picture.go:41", "backend/internal/application/process/gl_post.go:15", "backend/internal/application/process/service.go:1601", "backend/internal/application/process/workflow.go:579"]
---

# erp_doc_format — รูปแบบเอกสาร

หนึ่งแถว = หนึ่ง "ชนิดเอกสาร/รูปแบบเลขที่" ของบริษัท (Company DB) กำหนดรูปแบบเลขที่ที่ระบบรันให้ ผูกกับหน้าจอ และสมุดบัญชี GL ตารางเดิม (legacy)

## คอลัมน์ที่โค้ดใช้
| คอลัมน์ | ความหมายตามโค้ด | ที่มา |
|---|---|---|
| `code` | รหัสรูปแบบเอกสาร (`ic_trans.doc_format_code` ชี้มาที่นี่) | — |
| `name_1` (`name_2`?) | ชื่อ | (name_2 ไม่ชัดจากโค้ด) |
| `format` | แพตเทิร์นเลขที่ ค่าเริ่มต้น `@YYMM-####` | stock_tools.go:699-721 `autoRunPattern` |
| `screen_code` | รหัสหน้าจอ/ชนิดเอกสาร (เช่น IB, IF, IO …) แยกตามโมดูล ic/po/so/ap/ar/cb | doc_picture.go:41-48 |
| `gl_book` | รหัสสมุดรายวัน GL ที่ใช้ตอนลงบัญชี | gl_post.go / gl_template.go |
| `gl_description` | ข้อความคำอธิบายรายการ GL (มี placeholder) | gl_post.go:15 |

### โทเค็นใน `format` (stock_tools.go:699-721)
`DD`/`MM`/`YYYY`/`YY` (และไทย `วว`/`ดด`/`ปปปป`/`ปป`), `@` = รหัสรูปแบบ (`code`), `#` = หลักเลขรัน — ปีตาม `erp_option.year_type` (พ.ศ./ค.ศ. — [[tbl-erp-option]])

## วิธีรันเลขถัดไป
- `nextDocNo` (doc_cancel.go:389-408) หาเลขสูงสุดตาม prefix แล้ว +1 ภายใต้ advisory lock `docno:<table>:<prefix>`
- `doc_no_next.go:12` ครอบตาราง `ic_trans`, `ap_ar_trans`, `cb_trans`, `gl_journal`, `as_trans`, `ic_hidden_cost_process`
- `autoRunNext` (stock_tools.go:723); รหัสเจ้าหนี้/ลูกหนี้ autorun อ่านจาก master_autorun.go:106 (ปิดได้ด้วย `erp_option.disable_ar_autorun`)
- ผู้เรียกอื่น: stock_tools.go:60/670, service.go:1601, fa_depreciation.go:915, fa_sale.go:435, workflow.go:579, gl_template.go:973

## ความสัมพันธ์
- [[tbl-erp-doc-format-gl]] (`doc_code` → `erp_doc_format.code`) เก็บกฎลงบัญชี GL ของแต่ละรูปแบบ
- `erp_doc_format_etax` ปรากฏเฉพาะใน legacy write allow-list ไม่พบการใช้ในโค้ดอื่น
- หน้าจอ master เขียนตารางนี้ผ่าน `/query/exec` ตาม legacy write allow-list (ADR-0011)

## ลิงก์
[[proc-doc-flow-numbering]] · [[acc-gl-template-engine]] · [[acc-transaction-save-flow]] · [[tbl-group-erp]]

## ที่มาในโค้ด

- `backend/internal/application/process/stock_tools.go:699`
- `backend/internal/application/process/doc_cancel.go:389`
- `backend/internal/application/process/doc_no_next.go:12`
- `backend/internal/application/process/master_autorun.go:106`
- `backend/internal/application/process/doc_picture.go:41`
- `backend/internal/application/process/gl_post.go:15`
- `backend/internal/application/process/service.go:1601`
- `backend/internal/application/process/workflow.go:579`
