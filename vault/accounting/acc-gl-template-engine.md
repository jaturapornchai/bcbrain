---
title: "เครื่องมือลงบัญชีตามรูปแบบ GL (GL Template Engine)"
tags: [accounting, gl, template, debit-credit, go]
aliases: ["รูปแบบ GL", "template GL", "erp_doc_format_gl", "condition_number", "action code", "&ACCAP&", "&ACCAR&", "รวมบัญชี", "ผลต่างปัดเศษ", "inventory_gl_post"]
sources: ["backend/internal/application/process/gl_template.go:18", "backend/internal/application/process/gl_template.go:268", "backend/internal/application/process/gl_template.go:305", "backend/internal/application/process/gl_template.go:353", "backend/internal/application/process/gl_template.go:378", "backend/internal/application/process/gl_template.go:735", "backend/internal/application/process/gl_template.go:966", "backend/internal/application/process/gl_template.go:1008", "backend/internal/application/process/gl_template.go:1096", "backend/internal/application/process/gl_template_rules.go:20", "backend/internal/application/process/gl_template_rules.go:5410", "backend/internal/application/process/gl_template_defaults.go:56", "backend/internal/application/process/gl_post.go:26", "backend/internal/application/process/service.go:1567"]
---

# เครื่องมือลงบัญชีตามรูปแบบ GL (template)

ถ้ารูปแบบเอกสาร (`erp_doc_format`) มีแถวใน `erp_doc_format_gl` ระบบจะลง GL ตามแถวเหล่านั้นแทนชุดบัญชีมาตรฐาน แต่ละแถวคือ 1 ขั้นการลงบัญชี โดย `condition_number` (action) เลือกว่าจะใช้ยอดไหนของเอกสาร โค้ดเป็น port ของ C# `_transProcessUserControl.cs processWithData` (gl_template.go:18)

## ทำงานอย่างไร

### หา template (`format` gl_template.go:966)
- อ่าน `erp_doc_format` ตาม `code` (ตัวพิมพ์ใหญ่) ได้ `screen_code`, `gl_book`, `gl_description`
- `screen_code` ต้องมีใน `glRuleByScreen` (gl_template_rules.go:20) เช่น SI/SIP = 44, PU = 12, IA = 66, IM = 72, CND = 418, ASS = 1802 ไม่อยู่ในตาราง = ไม่มี template
- ไม่มีแถว template = คืน nil แล้วไปใช้ [[acc-gl-posting-standard]]

### คำนวณ (`runGLTemplate` gl_template.go:268)
1. ยอดหัวเอกสารทุกช่องปัด HALF_EVEN ที่ `fmt` (= `erp_option.gl_no_decimal` ค่าเริ่มต้น 2, `glSQLOptions` :730)
2. เอกสารที่ไม่ใช่ cb: VAT ที่ใช้ = `total_vat_value` - VAT ยกไป - ภาษีซื้อไม่ขอคืน
3. ต่อแถว template: ฝั่ง Dr ถ้ามีรหัสเดบิต มิฉะนั้น Cr; เรียกฟังก์ชัน rule ของหน้าจอ (`glRuleNN`) ตาม action และเงื่อนไข `condition_case` (เทียบกับ `trans_type`+1)
4. `postLine` (:305): ปัด HALF_EVEN; รหัส `&ACCAP&` / `&ACCAR&` แทนด้วยบัญชีใน `ap_supplier_detail` / `ar_customer_detail` ถ้าไม่มีใช้รหัสหลังเครื่องหมาย "," (เช่น `&ACCAR&,1121`); ยอด 0 หรือรหัสว่างไม่ลง
5. action ที่กระจายตามบรรทัด (`byDetail` :405) ใช้บัญชีจาก master ของบรรทัด เช่น "สินค้า_ราคา", "สินค้า_ต้นทุน", "ธนาคาร", "รายได้อื่น"
6. `compound` (:353): ถ้า `gl_trans_type` = 1 (รวมบัญชี) บรรทัดบัญชีเดียวกันสาขาเดียวกันรวมเป็นบรรทัดแรก
7. `addDiff` (:378): ผลต่าง Dr-Cr ที่ไม่เกิน 0.1 x จำนวนบรรทัดรายการ ลงบัญชีผลต่าง (เดบิตถ้าผลต่าง <= 0) ถ้าเกินช่วงไม่ลง ยกเว้นตั้ง fixdiff ไว้

### ตัวอย่าง action ของการขาย 44 (`glRule55` gl_template_rules.go:5410)
- 1 = ยอดขาย (ยกเว้นภาษี 2/3 ใช้ total_amount + มัดจำ + ส่วนลด; มีภาษีใช้ total_before_vat + มัดจำ ...)
- 101 / 103 = `total_cost` (ผลรวม `ic_trans_detail.sum_of_cost` ของบรรทัด item_type ไม่ใช่ 1/3 :791) กระจายตาม "สินค้า_ต้นทุน" ใช้ลงต้นทุนขาย/สินค้า
- action อื่นมีอีกหลายสิบตัว (2-19, 23, 30, 31, 81, 88-95, 1001-1004, 1901, 1902) ยังไม่ได้ไล่ทีละตัว

### บันทึก (`post` gl_template.go:1008)
- หางวดจาก `erp_account_period` ตามวันที่: **ไม่พบหรืองวดปิด** = handled แต่ไม่เขียน (n = 0) พร้อมคำเตือน (C# ข้ามเอกสารเช่นกัน)
- ไม่มีบรรทัด (ยอดศูนย์) = ไม่ handled ให้ standard ตัดสิน
- **Dr ไม่เท่า Cr** (เทียบหลัง FormatRat ที่ `fmt`) = ไม่ handled + คำเตือน "...ไม่สมดุล..." แล้ว caller ไปใช้ standard แทน (service.go:1567-1580) ไม่ทำให้การบันทึกทั้งชุดล้ม
- INSERT `gl_journal` (`trans_direct` = 0, `doc_format_code`) และ `gl_journal_detail` เรียงฝั่ง Dr ก่อนแล้วตามรหัสบัญชี
- คำอธิบายหัว (`glDescription` gl_post.go:26): placeholder `&REMARK&`, `&CUST_CODE&`, `&CUST_NAME&`, `&AP_*&`, `&AR_*&`, `&DOC_NO&`, `&DOC_DATE&`, `&TAX_NO&`, `&DOC_REF&`, `&TAX_DATE&`; วันที่เป็น d/M/yyyy บวก 543 เมื่อ `erp_option.year_type` = 1; ไม่มี gl_description ใช้ remark

### เอกสารที่มีแต่ template (`glTemplateOnlyFlags` :1096)
- 72 (โอนออก), 418 (เช็ครับตั้งหนี้ใหม่) และขายสินทรัพย์ 1802 โพสต์ผ่าน `postTemplateOnly` (:1100) เท่านั้น ไม่มีชุดมาตรฐาน

### รูปแบบเริ่มต้น (`GLTemplateDefaults` gl_template_defaults.go:56)
- ข้อมูลฝังใน `gl_template_defaults.json` (go:embed) ใช้เติมแถว template ให้ผู้ใช้
- comment ที่ :56-57 ระบุว่าเมื่อ `inventory_gl_post` = 0 (perpetual) จะตัด action 101/103 ทิ้ง (:89) ตาม C#

## จุดเสี่ยง
- template ใช้ HALF_EVEN ที่ `gl_no_decimal` ส่วน standard ใช้ HALF_UP ที่ 2 ตำแหน่ง ดู [[acc-rounding-decimal]]
- template ไม่สมดุลไม่ error แต่ตกไปใช้ standard: GL ที่ได้จึงไม่ตรงกับรูปแบบที่ผู้ใช้ตั้งโดยมีแค่คำเตือน
- ยังไม่ได้ port การแยกแผนก/โครงการ (comment ponytail ใน `post` อ้าง C# processDist)

## ที่มาในโค้ด
- `backend/internal/application/process/gl_template.go:268` runGLTemplate
- `backend/internal/application/process/gl_template.go:305` postLine
- `backend/internal/application/process/gl_template.go:353` compound
- `backend/internal/application/process/gl_template.go:378` addDiff
- `backend/internal/application/process/gl_template.go:966` format
- `backend/internal/application/process/gl_template.go:1008` post
- `backend/internal/application/process/gl_template.go:1096` glTemplateOnlyFlags
- `backend/internal/application/process/gl_template_rules.go:20` glRuleByScreen
- `backend/internal/application/process/gl_template_rules.go:5410` glRule55
- `backend/internal/application/process/gl_template_defaults.go:56` ค่าเริ่มต้นและ perpetual
- `backend/internal/application/process/gl_post.go:26` glDescription

## ดูเพิ่ม
- [[acc-gl-rebuild]]
- [[acc-gl-posting-standard]]
- [[acc-period-close]]
- [[acc-fixed-asset-sale]]
