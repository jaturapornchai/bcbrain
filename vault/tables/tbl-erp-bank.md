---
title: "erp_bank / erp_bank_branch — ธนาคารและสาขาธนาคาร"
tags: [tables, erp, bank, company-db]
aliases: ["erp_bank", "erp_bank_branch", "ธนาคาร", "สาขาธนาคาร", "chq_income_account_code", "logo_url"]
sources: ["backend/internal/application/process/gl_template.go:198", "backend/internal/application/process/service.go:848", "backend/internal/platform/db/pool.go:66", "backend/internal/application/process/report_menu_cb.go:493"]
---

# erp_bank / erp_bank_branch

ตารางหลักธนาคารและสาขา (Company DB) ตารางเดิม (legacy) — ใช้ในสมุดเงินฝาก เช็ค และรายงานเงินฝาก

## erp_bank
| คอลัมน์ | ความหมาย | ที่มา |
|---|---|---|
| `code` | รหัสธนาคาร | — |
| `name_1` | ชื่อธนาคาร | — |
| `chq_income_account_code` | บัญชี GL รายได้/พักเช็คของธนาคารนี้ (ใช้ในเทมเพลต GL ฝั่งเช็ค) | gl_template.go:198 |
| `logo_url` | URL โลโก้ธนาคาร (เพิ่มด้วย `ALTER … ADD COLUMN IF NOT EXISTS`) | service.go:848, platform/db/pool.go:66 |

## erp_bank_branch
| คอลัมน์ | ความหมาย | ที่มา |
|---|---|---|
| `code` | รหัสสาขาธนาคาร | report_menu_cb.go:493-499 |
| `name_1` | ชื่อสาขา | — |
| `bank_code` | → `erp_bank.code` | report_menu_cb.go:493-499 |

## การใช้
- [[tbl-erp-pass-book]] ชี้ `bank_code` มาที่ตารางนี้
- เช็ครับ/ฝาก: ดึง `chq_income_account_code` สร้างรายการ GL ([[acc-cheque-transfer]])
- โลโก้ธนาคาร: ดู [[std-thai-geo-map-bank-logos]]
- หน้าจอ master เขียนทั้งสองตารางผ่าน `/query/exec` ตาม legacy write allow-list (ADR-0011)

## ลิงก์
[[tbl-group-erp]]

## ที่มาในโค้ด

- `backend/internal/application/process/gl_template.go:198`
- `backend/internal/application/process/service.go:848`
- `backend/internal/platform/db/pool.go:66`
- `backend/internal/application/process/report_menu_cb.go:493`
