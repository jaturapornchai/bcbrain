---
title: "erp_doc_format_gl — เทมเพลตลงบัญชี GL ต่อรูปแบบเอกสาร"
tags: [tables, erp, gl, template, company-db]
aliases: ["erp_doc_format_gl", "เทมเพลต GL", "รูปแบบลงบัญชี", "condition_number", "ดึงรูปแบบ"]
sources: ["backend/internal/application/process/gl_template.go:206", "backend/internal/application/process/gl_template.go:284", "backend/internal/application/process/gl_template.go:961", "backend/internal/application/process/gl_template.go:966", "backend/internal/application/process/gl_template.go:1008", "backend/internal/application/process/gl_template_defaults.go:58", "backend/internal/application/process/gl_template_rules.go:20", "backend/internal/application/process/gl_template_rules.go:166", "backend/internal/application/process/gl_template_it_test.go:120", "backend/internal/application/process/service.go:1585", "backend/internal/application/process/fa_sale.go:612", "backend/internal/adapter/inbound/http/router.go:132", "frontend/src/app/api/process/gl/template-defaults/route.ts:23", "backend/internal/domain/query/write_policy_legacy.go:33", "scripts/sql/02_data_schema.sql:2853", "scripts/sql/06_populate_all_screens_bcdemo.sql:229", "scripts/sql/24_remove_bcdemo_placeholder_doc_format_gl.sql:7"]
---

# erp_doc_format_gl — เทมเพลตลงบัญชี GL

หนึ่งแถว = หนึ่งบรรทัดของกฎ "เมื่อเอกสารรูปแบบนี้บันทึก ให้ลงบัญชีเดบิต/เครดิตอย่างไร ภายใต้เงื่อนไขใด" ฝั่ง Company DB — ตัวลง GL (`glTemplatePoster`) อ่านตารางนี้ตอนบันทึกเอกสาร นิยามตาราง (DDL) อยู่ใน `scripts/sql/02_data_schema.sql:2853-2868` โค้ด Go ไม่ได้สร้างตารางนี้

## คอลัมน์ที่โค้ดใช้
| คอลัมน์ | ความหมายตามโค้ด | ที่มา |
|---|---|---|
| `doc_code` | → [[tbl-erp-doc-format]] `code` — ใน DDL ยาว varchar(10) (ส่วน `erp_doc_format.code` ยาว 25); ตัวลง GL เทียบแบบ `upper()` ทั้งสองข้าง ส่วนคิวรีบัญชีเงินรับล่วงหน้าเทียบตรง ๆ | gl_template.go:963, 206; 02_data_schema.sql:2862 |
| `line_number` | integer — ลำดับของแถวกฎ ใช้เรียงอย่างเดียว (เลขบรรทัดใน GL ใช้ตัวนับของตัวลง GL `lineNo`) | gl_template.go:964, 329-330; 02_data_schema.sql:2863 |
| `condition_number` | integer — รหัส action ของกฎ (`actionCode`) ที่ฟังก์ชันกฎของหน้าจอใช้ `switch` เลือกสูตรคิดยอด — **อ่านเฉพาะแถวที่ > 0** | gl_template.go:963, 292; gl_template_rules.go:172; 02_data_schema.sql:2857 |
| `condition_case` | varchar(50) — ตัวกรองกรณี: ว่าง = ใช้ทุกกรณี ไม่ว่างต้องมีเลข `trans_type` + 1 ของเอกสารปรากฏอยู่ในข้อความ (ตัวอย่างในกฎ `glRule01`) | gl_template.go:293; gl_template_rules.go:166-172; 02_data_schema.sql:2866 |
| `account_code_debit`, `account_code_credit` | varchar(25) — บัญชีของแถว: ถ้าเดบิตไม่ว่างแถวนี้ลงฝั่งเดบิต ไม่เช่นนั้นใช้บัญชีเครดิต (หนึ่งแถวลงฝั่งเดียว); เป็นรหัสผังบัญชี หรือตัวแทน `&ACCAP&` / `&ACCAR&` (แทนด้วยบัญชีเจ้าหนี้/ลูกหนี้ของคู่ค้า) และ `&ACCBANK1&` / `&ACCBANK2&` / `&ACCBANK&` (แทนด้วยบัญชีของสมุดเงินฝากหรือธนาคาร — [[tbl-erp-pass-book]], [[tbl-erp-bank]]) | gl_template.go:284-288, 316-321, 479-526; 02_data_schema.sql:2859, 2861 |
| `account_name` | varchar(255) — ข้อความอธิบายของบรรทัดนั้นใน GL แทนตัวแทน `&REMARK&`, `&CUST_CODE&`, `&CUST_NAME&`, `&AP_CODE&`, `&AP_NAME&`, `&AR_CODE&`, `&AR_NAME&` — คิวรีลงบัญชีอ่านคอลัมน์นี้ | gl_template.go:256-266, 290, 327-328, 962; 02_data_schema.sql:2860 |
| `account_name2` | varchar(255) — แม่แบบตั้งต้นและ test ใส่ค่านี้ แต่ไม่พบโค้ดที่อ่านค่านี้ตอนลงบัญชี (ตัวลง GL อ่านเฉพาะ `account_name`) | gl_template_defaults.go:37-45, 92-94; gl_template_it_test.go:120; 02_data_schema.sql:2864 |
| `condition_name` | varchar(255) — ชื่อเงื่อนไข ใช้ในแถวแม่แบบตั้งต้น ตัวลง GL ไม่อ่าน | gl_template_defaults.go:92; 02_data_schema.sql:2858 |
| `code_compare` | varchar(100) — แม่แบบตั้งต้นใส่ค่าจากข้อมูลตั้งต้น (`guid_compare`) ตัวลง GL ไม่อ่าน | gl_template_defaults.go:93-94; 02_data_schema.sql:2865 |
| `roworder` | serial — ลำดับแถว (เรียงรองจาก `line_number`) | gl_template.go:964; 02_data_schema.sql:2856 |

## การทำงานของตัวลง GL
- หาแถวต้นทางจากรูปแบบเอกสาร: อ่าน `screen_code`, `gl_book`, `gl_description` ของ `erp_doc_format` ([[tbl-erp-doc-format]]) แล้วหากฎของหน้าจอจาก `glRuleByScreen` — ไม่พบแถวรูปแบบหรือไม่มีกฎของ `screen_code` นั้น → ไม่ใช้เทมเพลต (gl_template.go:966-984; gl_template_rules.go:20)
- อ่านแถว `erp_doc_format_gl` ที่ `condition_number > 0` เรียง `line_number, roworder`; ไม่มีแถวเลย → ไม่ใช้เทมเพลต (gl_template.go:961-964, 985-991) เอกสารจึงลงบัญชีแบบมาตรฐานแทน ([[acc-gl-posting-standard]]) ถ้ามีแถวตัวลง GL สร้างใบสมุดรายวันเองตามเทมเพลต (gl_template.go:1008-1050)
- ไม่พบงวดบัญชีที่เปิดอยู่ของวันที่เอกสาร ([[tbl-erp-account-period]]) → ไม่ลงบัญชีและคืนคำเตือน (gl_template.go:1027-1032); เดบิตไม่เท่าเครดิต → ไม่ลงตามเทมเพลตและคืนคำเตือน (gl_template.go:1045-1047) RebuildGL ถอยไปลงแบบมาตรฐาน ส่วน `postTemplateOnly` ข้ามเอกสาร (gl_template.go:1140)
- ผู้เรียก: RebuildGL (service.go:1585), ขายสินทรัพย์ (fa_sale.go:612), การลงบัญชีตามเทมเพลตอย่างเดียว `postTemplateOnly` (gl_template.go:1100-1140)
- บัญชีเงินรับล่วงหน้า: ใช้ `account_code_credit` ของแถว action 1 ในรูปแบบของเอกสารมัดจำ (gl_template.go:206, 613)

## ค่าเริ่มต้นและการแก้
- ค่าตั้งต้นต่อรหัสหน้าจอ (`screen_code`) มาจากไฟล์ฝัง `gl_template_defaults.json` ผ่าน `GLTemplateDefaults` (gl_template_defaults.go:58-100) เรียกด้วย `POST /process/gl/template-defaults` (สิทธิ์อ่าน — router.go:132; ฝั่งเว็บพบเฉพาะ route ส่งต่อ frontend/src/app/api/process/gl/template-defaults/route.ts:23) ได้แถวที่ตรงรหัสหน้าจอ เรียงตามลำดับบรรทัด โดยค่า `inventory_gl_post = 0` (สต็อกแบบ perpetual) จะตัดแถว action 101 และ 103 ออก (gl_template_defaults.go:68-71, 89)
- ตัวลง GL ใช้ `erp_option` เฉพาะ `gl_no_decimal`, `item_amount_decimal`, `gl_trans_type` (1 = รวมบรรทัดบัญชีเดียวกัน), `multi_currency`, `discout_type`, `discount_vat_type`, `discount_step_round_off` (gl_template.go:730-733, 352-356) ส่วน `inventory_gl_post` ใช้กับแม่แบบตั้งต้นเท่านั้น ([[tbl-erp-option]])
- สคริปต์เติมข้อมูลฐานตัวอย่าง `bcdemo` ไม่ใส่แถวในตารางนี้ (scripts/sql/06_populate_all_screens_bcdemo.sql:229-230) และสคริปต์ scripts/sql/24_remove_bcdemo_placeholder_doc_format_gl.sql:7 ลบแถวตัวอย่างเดิมที่ลงบัญชีไม่สมดุล
- หน้าจอ master เขียนตารางนี้ผ่าน `/query/exec` เพราะอยู่ใน legacy write allow-list (domain/query/write_policy_legacy.go:33; ADR-0011)

## ลิงก์
[[acc-gl-template-engine]] · [[acc-gl-posting-standard]] · [[tbl-erp-pass-book]] · [[tbl-group-erp]]

## ที่มาในโค้ด

- `backend/internal/application/process/gl_template.go:206` บัญชีเงินรับล่วงหน้า
- `backend/internal/application/process/gl_template.go:284` แถวเทมเพลตต่อบรรทัดบัญชี
- `backend/internal/application/process/gl_template.go:961` คิวรีอ่านแถวเทมเพลต
- `backend/internal/application/process/gl_template.go:966` หารูปแบบและกฎของหน้าจอ
- `backend/internal/application/process/gl_template.go:1008` `post` สร้างใบสมุดรายวัน
- `backend/internal/application/process/gl_template_defaults.go:58` แม่แบบตั้งต้นต่อรหัสหน้าจอ
- `backend/internal/application/process/gl_template_rules.go:20` กฎของแต่ละ `screen_code`
- `backend/internal/application/process/gl_template_rules.go:166` ตัวอย่างกฎที่ใช้ `condition_case` และ `condition_number`
- `backend/internal/application/process/gl_template_it_test.go:120` test ใส่แถวเทมเพลต
- `backend/internal/application/process/service.go:1585` RebuildGL เรียกตัวลง GL
- `backend/internal/application/process/fa_sale.go:612` ขายสินทรัพย์เรียกตัวลง GL
- `backend/internal/adapter/inbound/http/router.go:132` เส้นทาง `/gl/template-defaults`
- `frontend/src/app/api/process/gl/template-defaults/route.ts:23` route ส่งต่อฝั่งเว็บ
- `backend/internal/domain/query/write_policy_legacy.go:33` allow-list การเขียน
- `scripts/sql/02_data_schema.sql:2853` นิยามตาราง `erp_doc_format_gl`
- `scripts/sql/06_populate_all_screens_bcdemo.sql:229` ข้อมูลฐานตัวอย่างไม่ใส่แถวเทมเพลต
- `scripts/sql/24_remove_bcdemo_placeholder_doc_format_gl.sql:7` ลบแถวตัวอย่างที่ไม่สมดุล
