---
title: "erp_company_profile — ข้อมูลบริษัท (แถวเดียว)"
tags: [tables, erp, company, branch, company-db]
aliases: ["erp_company_profile", "ข้อมูลบริษัท", "company profile", "branch_status", "เลขประจำตัวผู้เสียภาษี"]
sources: ["backend/internal/application/process/report_pdf.go:50", "backend/internal/application/process/trans.go:356", "backend/internal/application/process/trans_validate.go:30", "backend/internal/application/process/lookup_trans.go:74", "backend/internal/application/process/report_menu_ap_ar_opts.go:59", "backend/internal/application/process/pos_config.go:399", "backend/internal/adapter/inbound/http/mcp/gateway.go:1632", "backend/internal/adapter/inbound/http/admin/workspace_google.go:510", "backend/internal/platform/db/pool.go:71", "backend/internal/application/process/service.go:853"]
---

# erp_company_profile — ข้อมูลบริษัท

ข้อมูลหัวบริษัทของ **ฐานบริษัท (Company DB)** แถวเดียว ใช้พิมพ์หัวรายงาน/PDF, บอกว่าบริษัทเปิดโหมดหลายสาขาหรือไม่ และสาขาของบริษัทเอง ตารางเดิม (legacy)

## คอลัมน์ที่โค้ดใช้
| คอลัมน์ | ความหมาย | ที่มา |
|---|---|---|
| `company_name_1`, `company_name_2` | ชื่อบริษัท (ไทย/อังกฤษ ตามชื่อคอลัมน์) | report_pdf.go:50-70 |
| `address_1`, `address_2` | ที่อยู่ | report_pdf.go |
| `tax_number` | เลขประจำตัวผู้เสียภาษี | report_pdf.go, report_menu_ap_ar_opts.go:59 |
| `tel`, `fax`, `email_address` | ข้อมูลติดต่อ (MCP gateway เลือกคอลัมน์เหล่านี้) | gateway.go:1632 |
| `branch_status` | **1 = โหมดหลายสาขา** (เปิดผลกับ `erp_option.warning_branch_input` — [[tbl-erp-option]]) | trans_validate.go:30, trans.go:356 |
| `branch_type`, `branch_code`, `branch_name` | สาขาของบริษัท (สำนักงานใหญ่/สาขา) | report_pdf.go, lookup_trans.go:74 |
| `latitude`, `longitude` | พิกัด (เพิ่มด้วย `ALTER … ADD COLUMN IF NOT EXISTS`) | platform/db/pool.go:71-72, service.go:853 |

## การเขียน
- สร้างฐานบริษัทใหม่ผ่าน workspace Google จะ INSERT แถวเริ่มต้นหนึ่งแถว (workspace_google.go:510)
- หน้าจอ master เขียนตารางนี้ผ่าน `/query/exec` ตาม legacy write allow-list (ADR-0011)

## ใครอ่าน
รายงาน PDF (หัวกระดาษ), ตรวจหน้าจอเอกสาร (trans_validate.go), การ resolve สาขา (trans.go:356), lookup เอกสาร (lookup_trans.go:74), ตั้งค่า POS (pos_config.go:399), MCP gateway (gateway.go:1632)

## ลิงก์
[[tbl-erp-branch-list]] · [[proc-report-engine]] · [[tbl-group-erp]]

## ที่มาในโค้ด

- `backend/internal/application/process/report_pdf.go:50`
- `backend/internal/application/process/trans.go:356`
- `backend/internal/application/process/trans_validate.go:30`
- `backend/internal/application/process/lookup_trans.go:74`
- `backend/internal/application/process/report_menu_ap_ar_opts.go:59`
- `backend/internal/application/process/pos_config.go:399`
- `backend/internal/adapter/inbound/http/mcp/gateway.go:1632`
- `backend/internal/adapter/inbound/http/admin/workspace_google.go:510`
- `backend/internal/platform/db/pool.go:71`
- `backend/internal/application/process/service.go:853`
