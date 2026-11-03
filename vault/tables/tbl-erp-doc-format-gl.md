---
title: "erp_doc_format_gl — เทมเพลตลงบัญชี GL ต่อรูปแบบเอกสาร"
tags: [tables, erp, gl, template, company-db]
aliases: ["erp_doc_format_gl", "เทมเพลต GL", "รูปแบบลงบัญชี", "condition_number", "ดึงรูปแบบ"]
sources: ["backend/internal/application/process/gl_template.go:962", "backend/internal/application/process/gl_template.go:206", "backend/internal/application/process/gl_template_defaults.go:36", "backend/internal/application/process/gl_template_rules.go", "backend/internal/application/process/gl_template_it_test.go:120"]
---

# erp_doc_format_gl — เทมเพลตลงบัญชี GL

หนึ่งแถว = หนึ่งบรรทัดของกฎ "เมื่อเอกสารรูปแบบนี้บันทึก ให้ลงบัญชีเดบิต/เครดิตอย่างไร ภายใต้เงื่อนไขใด" ตารางเดิม (legacy) ฝั่ง Company DB — ตัวลง GL (`glTemplatePoster`) อ่านตารางนี้ตอนบันทึกเอกสาร

## คอลัมน์ที่โค้ดใช้
| คอลัมน์ | ความหมายตามโค้ด | ที่มา |
|---|---|---|
| `doc_code` | → [[tbl-erp-doc-format]] `code` (จับแบบ upper) | gl_template.go:962-965 |
| `line_number` | ลำดับบรรทัด (ใช้เรียง) | gl_template.go:962 |
| `condition_number` | เลขเงื่อนไขจำนวนเงิน — **ใช้เฉพาะ > 0**; เป็นตัวเลือกกฎคิดยอด | gl_template.go:962, gl_template_rules.go |
| `condition_name` | ชื่อเงื่อนไข | gl_template_defaults.go:36-80 |
| `condition_case` | เงื่อนไขกรณี (case) | gl_template.go:962 |
| `account_code_debit`, `account_code_credit` | บัญชีเดบิต/เครดิต — อาจเป็นตัวแทน `&ACCAP&`, `&ACCAR&`, `&ACCBANK…&` ที่แทนด้วยบัญชีจริงจากข้อมูลหลัก (เจ้าหนี้/ลูกหนี้/สมุดเงินฝาก) | gl_template.go:195-206 |
| `account_name` / `account_name2` | ชื่อบัญชี/คำอธิบาย — **พบสองชื่อในโค้ด**: SQL อ่านรูปแบบ (`glSQLTemplates`) เลือก `account_name`, แต่ struct ของกริดและ test INSERT ใช้ `account_name2` (ไม่ชัดจากโค้ดว่าฐานจริงมีทั้งคู่หรือเปลี่ยนชื่อ) | gl_template.go:962, gl_template_defaults.go:43, gl_template_it_test.go:120 |
| `code_compare` | รหัสสำหรับเทียบ (ไม่ชัดจากโค้ดว่าเทียบกับอะไร) | gl_template_defaults.go:43 |
| `roworder` | ลำดับแถว (เรียงรอง) | gl_template.go:965 |

## ค่าเริ่มต้นและการแก้
- ค่าตั้งต้นต่อรหัสหน้าจอ (`screen_code`) มาจากไฟล์ฝัง `gl_template_defaults.json` ผ่าน `GLTemplateDefaults` (gl_template_defaults.go:36-80) — ตรงกับปุ่ม "ดึงรูปแบบ" ของโปรแกรมเดิม (C#)
- `erp_option.inventory_gl_post` (0 = perpetual) และ `gl_trans_type` มีผลกับการสร้างบรรทัด ([[tbl-erp-option]])
- หน้าจอ master เขียนตารางนี้ผ่าน `/query/exec` ตาม legacy write allow-list (ADR-0011)

## ลิงก์
[[acc-gl-template-engine]] · [[acc-gl-posting-standard]] · [[tbl-erp-pass-book]] · [[tbl-group-erp]]

## ที่มาในโค้ด

- `backend/internal/application/process/gl_template.go:962`
- `backend/internal/application/process/gl_template.go:206`
- `backend/internal/application/process/gl_template_defaults.go:36`
- `backend/internal/application/process/gl_template_rules.go`
- `backend/internal/application/process/gl_template_it_test.go:120`
