---
title: "สถาปัตยกรรม Feature Switchboard (32 ระบบ) & Business Presets"
audience: dev
tags: [architecture, feature-flags, presets, switchboard, configuration]
aliases: ["Feature Switchboard", "erp_feature_option", "Business Presets BC", "เปิดปิดโมดูล BC", "28 ระบบ BC"]
sources: ["backend/internal/application/process/feature_options.go:15-636", "backend/internal/adapter/inbound/http/process/workflow_handler.go:315-321", "backend/internal/application/process/morning_briefing.go:1-100"]
---

**Feature Switchboard** คือระบบเปิด-ปิดโมดูลและเมนูตามประเภทธุรกิจใน Backend เดียวกัน (`backend/internal/application/process/feature_options.go`) ทำให้ทั้ง Web, Tablet, Mobile, POS และ API เห็นโครงสร้างเมนูและฟีเจอร์ตรงกัน 100% โดยไม่ลบข้อมูลใน PostgreSQL เมื่อปิดโมดูล

---

## 1. โครงสร้างตาราง & Workflow Endpoint

- **ตารางจัดเก็บต่อบริษัท (`feature_options.go:420-430`)**: `erp_feature_option` (บังคับแถวเดียวด้วย `id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1)`) เก็บ `preset_code`, `flags_json` (`JSONB`), `updated_by`, `updated_at`
- **API Endpoint**: `POST /process/workflow/feature-options` (`workflow_handler.go:315`)
  - `op: "get"` — โหลดสถานะ Flags, 6 Presets, รายการ Catalog และ `disabledMenuKeys`
  - `op: "save"` — บันทึก `flags` (`map[string]bool`) ที่เลือกเปิด/ปิด
  - `op: "apply-preset"` — ใช้ค่า Preset สำเร็จรูปทั้งชุดตาม `presetCode`
  - `op: "pdf"` — ส่งออก PDF สรุปการตั้งค่าโมดูลของกิจการ

> [!NOTE]
> ตัว Switchboard ในโค้ดปัจจุบันขยายจากแนวคิดเดิม 28 โมดูล เป็น **`masterFeatureCatalog` ทั้งหมด 32 รายการ** (`feature_options.go:58-347, 403`) แบ่งระดับสิทธิ์เป็น `edition: "all"` และ `edition: "pro"`

---

## 2. Business Presets ทั้ง 6 รูปแบบ

| `presetCode` | ชื่อแพ็กเกจธุรกิจ | จุดเด่นของระบบที่เปิดให้ |
| :--- | :--- | :--- |
| `minimal` | ร้านค้าทั่วไป · หน้าจอคลีน ไม่ซับซ้อน | เปิดเฉพาะงานจำเป็น 8 ระบบ (`morning_briefing`, `tax_health`, `rd_prep_wht`, `slip_verify`, `fifo_knockoff`, `bank_statement_reconcile`, `tax_id_lookup`, `mobile_quick_bill`) |
| `ecommerce` | ร้านค้าออนไลน์ Shopee / TikTok / Lazada | 16 ระบบ เน้น `marketplace_reconcile`, `foreign_service_tax`, `etax_ewht_export`, `stock_expiry_fefo`, `line_expense_inbox`, `accountant_chaser` |
| `wholesale` | ค้าส่ง ยี่ปั๊ว ตัวแทนฝากขาย & ทีมเซลส์ | 21 ระบบ เน้น `auto_billing_portal`, `sales_commission`, `consignment`, `credit_group_penalty`, `ocr_three_way`, `stock_expiry_fefo`, `serial_warranty_rma` |
| `contractor` | รับเหมาก่อสร้าง ตกแต่งภายใน & โครงการ | 21 ระบบ เน้น `project_retention`, `contracts_and_fx`, `prepaid_deferred_amort`, `hire_purchase_leasing`, `budget_approval_matrix` |
| `manufacturing` | โรงงานประกอบสินค้า จัดชุด & แปรรูป (BOM) | 19 ระบบ เน้น `bom_assembly`, `ocr_three_way`, `contracts_and_fx`, `stock_expiry_fefo`, `serial_warranty_rma`, `budget_approval_matrix` |
| `accounting_firm` | สำนักงานบัญชี & กิจการครบเครื่อง *(Default)* | เปิดครบทั้งหมด 32 ระบบ |

---

## 3. รายการฟีเจอร์ทั้งหมด 32 รายการใน `masterFeatureCatalog`

| # | Key | Edition | หมวดหมู่ | Menu Keys ที่ควบคุม |
| :---: | :--- | :---: | :--- | :--- |
| 1 | `morning_briefing` | `all` | ระบบบริหารประจำวัน & แจ้งเตือนอัจฉริยะ | `menu_morning_briefing` |
| 2 | `tax_health` | `all` | ภาษีสรรพากร & สำนักงานบัญชี | `menu_gl_tax_health` |
| 3 | `rd_prep_wht` | `all` | ภาษีสรรพากร & สำนักงานบัญชี | `menu_gl_rd_prep_wht` |
| 4 | `slip_verify` | `all` | การเงิน ธนาคาร & ค่าใช้จ่ายพนักงาน | `menu_cb_slip_verify` |
| 5 | `expense_claim_guard` | `all` | การเงิน ธนาคาร & ค่าใช้จ่ายพนักงาน | `menu_cb_expense_claim` |
| 6 | `fifo_knockoff` | `all` | การเงิน ธนาคาร & ค่าใช้จ่ายพนักงาน | *(ปุ่มในฟอร์มรับ/จ่ายชำระ)* |
| 7 | `cashflow_forecast` | `pro` | การเงิน ธนาคาร & ค่าใช้จ่ายพนักงาน | `menu_cb_cashflow_forecast` |
| 8 | `auto_billing_portal` | `pro` | ลูกหนี้ การค้าส่ง & ขายออนไลน์ | `menu_ar_auto_bill`, `menu_ap_auto_bill` |
| 9 | `marketplace_reconcile` | `pro` | ลูกหนี้ การค้าส่ง & ขายออนไลน์ | `menu_ar_marketplace_reconcile` |
| 10 | `sales_commission` | `pro` | ลูกหนี้ การค้าส่ง & ขายออนไลน์ | `menu_ar_commission` |
| 11 | `consignment` | `pro` | ลูกหนี้ การค้าส่ง & ขายออนไลน์ | `menu_ic_consignment` |
| 12 | `credit_group_penalty` | `pro` | ลูกหนี้ การค้าส่ง & ขายออนไลน์ | `menu_ar_credit_group` |
| 13 | `ocr_three_way` | `pro` | จัดซื้อ การผลิต BOM & โครงการ | `menu_ap_ocr_three_way` |
| 14 | `bom_assembly` | `pro` | จัดซื้อ การผลิต BOM & โครงการ | `menu_ic_bom_assembly` |
| 15 | `project_retention` | `pro` | จัดซื้อ การผลิต BOM & โครงการ | `menu_ar_project_retention` |
| 16 | `contracts_and_fx` | `pro` | จัดซื้อ การผลิต BOM & โครงการ | `menu_ap_contract`, `menu_ar_contract`, `menu_gl_fx_revaluation` |
| 17 | `bank_statement_reconcile` | `all` | การเงิน ธนาคาร & ตรวจสลิป | `menu_cb_bank_reconcile` |
| 18 | `payroll_sso_pnd1` | `all` | การเงิน ธนาคาร & ตรวจสลิป | `menu_cb_payroll_lite` |
| 19 | `foreign_service_tax` | `all` | ภาษีสรรพากร & ดักความเสี่ยง | `menu_gl_foreign_tax` |
| 20 | `director_loan_guard` | `all` | ภาษีสรรพากร & ดักความเสี่ยง | `menu_gl_director_loan` |
| 21 | `corporate_tax_pnd50_51` | `all` | ภาษีสรรพากร & ดักความเสี่ยง | `menu_gl_pnd50_51` |
| 22 | `dbd_efiling_taxonomy` | `all` | ภาษีสรรพากร & ดักความเสี่ยง | `menu_gl_dbd_efiling` |
| 23 | `etax_ewht_export` | `all` | ภาษีสรรพากร & ดักความเสี่ยง | `menu_so_send_etax` |
| 24 | `prepaid_deferred_amort` | `pro` | จัดซื้อ การผลิต BOM & โครงการ | `menu_gl_prepaid_amort` |
| 25 | `hire_purchase_leasing` | `pro` | จัดซื้อ การผลิต BOM & โครงการ | `menu_fa_hire_purchase` |
| 26 | `stock_expiry_fefo` | `pro` | ลูกหนี้ การค้าส่ง & ขายออนไลน์ | `menu_ic_expiry_fefo` |
| 27 | `serial_warranty_rma` | `pro` | ลูกหนี้ การค้าส่ง & ขายออนไลน์ | `menu_ic_warranty_rma` |
| 28 | `budget_approval_matrix` | `pro` | ผู้บริหาร & ระบบอัจฉริยะ | `menu_erp_budget_approval` |
| 29 | `tax_id_lookup` | `all` | ภาษีสรรพากร & ดักความเสี่ยง | *(ตัวช่วยค้นหา Mod-11)* |
| 30 | `line_expense_inbox` | `all` | การเงิน ธนาคาร & ประกันสังคม | `menu_cb_line_inbox` |
| 31 | `accountant_chaser` | `all` | ภาษีสรรพากร & ดักความเสี่ยง | `menu_gl_accountant_chaser` |
| 32 | `mobile_quick_bill` | `all` | ลูกหนี้ การค้าส่ง & ขายออนไลน์ | `menu_ar_mobile_quick_bill` |
