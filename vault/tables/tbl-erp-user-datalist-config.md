---
title: "erp_user_datalist_config — เลย์เอาต์รายการข้อมูลหลักต่อผู้ใช้"
tags: [tables, erp, ui-config, created-by-code, company-db]
aliases: ["erp_user_datalist_config", "datalist config", "ตั้งค่าคอลัมน์รายการ", "list_key", "config_json"]
sources: ["backend/internal/application/process/master_datalist.go:14", "backend/internal/application/process/master_datalist.go:24", "backend/internal/application/process/master_datalist.go:50", "backend/internal/application/process/master_datalist.go:58", "backend/internal/application/process/master_datalist.go:120", "backend/internal/application/process/master_datalist.go:148"]
---

# erp_user_datalist_config — เลย์เอาต์รายการข้อมูลหลักต่อผู้ใช้

รายการฝั่งซ้ายของหน้าจอข้อมูลหลัก ให้ผู้ใช้เลือกคอลัมน์/เขียน SELECT เองได้ — ตารางนี้เก็บเลย์เอาต์นั้นแยกรายผู้ใช้ (ของโปรแกรมเดิม C# เก็บต่อหน้าจอใน `erp_view_column_custom` ซึ่งไม่มีคอลัมน์ผู้ใช้ จึงมีตารางของเว็บเอง — master_datalist.go:14-20)

ตารางนี้ **โค้ดสร้างเอง** (`CREATE TABLE IF NOT EXISTS`) ครั้งแรกต่อฐานบริษัทใน `datalistPool` (master_datalist.go:58-67); DDL เดียวกันอยู่ใน `scripts/sql/23` ตามคอมเมนต์

## โครงสร้าง (master_datalist.go:50)
| คอลัมน์ | ชนิด | ความหมาย |
|---|---|---|
| `user_code` | VARCHAR(100) | รหัสผู้ใช้ ([[tbl-erp-user]] `code`) — จำกัดยาว 100 (:24) |
| `list_key` | VARCHAR(150) | รหัสรายการ/หน้าจอ — จำกัดยาว 150 (:25) |
| `config_json` | JSONB NOT NULL | เลย์เอาต์ (ขนาดไม่เกิน 256 KB, คอลัมน์ไม่เกิน 500) |
| `updated_at` | TIMESTAMPTZ default now() | เวลาแก้ล่าสุด |

PK = (`user_code`, `list_key`)

## วิธีเขียน/อ่าน
- อ่าน: `SELECT config_json … WHERE user_code AND list_key` (:120)
- บันทึก: `INSERT … ON CONFLICT (user_code, list_key) DO UPDATE` (:154-156)
- "รีเซ็ต" = บันทึก columns ว่าง (ไม่ลบแถว) เพื่อให้เครื่องอื่นที่ยังมี localStorage เก่าแยก "รีเซ็ต" ออกจาก "ไม่เคยบันทึก" (คอมเมนต์ :14-20); มีเส้นทางลบจริงที่ :148
- ดูของผู้ใช้อื่นต้องเป็นแอดมิน (บังคับที่ `RequiredRight`)

## ใช้โดย
ชั้น master datalist ของ [[proc-master-data]]

## ลิงก์
[[tbl-group-erp]]

## ที่มาในโค้ด

- `backend/internal/application/process/master_datalist.go:14`
- `backend/internal/application/process/master_datalist.go:24`
- `backend/internal/application/process/master_datalist.go:50`
- `backend/internal/application/process/master_datalist.go:58`
- `backend/internal/application/process/master_datalist.go:120`
- `backend/internal/application/process/master_datalist.go:148`
