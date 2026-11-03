---
title: "erp_user_datalist_config — เลย์เอาต์รายการข้อมูลหลักต่อผู้ใช้"
tags: [tables, erp, ui-config, created-by-code, company-db]
aliases: ["erp_user_datalist_config", "datalist config", "ตั้งค่าคอลัมน์รายการ", "list_key", "config_json"]
sources: ["backend/internal/application/process/master_datalist.go:14", "backend/internal/application/process/master_datalist.go:24", "backend/internal/application/process/master_datalist.go:50", "backend/internal/application/process/master_datalist.go:59", "backend/internal/application/process/master_datalist.go:74", "backend/internal/application/process/master_datalist.go:90", "backend/internal/application/process/master_datalist.go:120", "backend/internal/application/process/master_datalist.go:132", "backend/internal/adapter/inbound/http/process/permission.go:87", "scripts/sql/23_user_datalist_config.sql:9"]
---

# erp_user_datalist_config — เลย์เอาต์รายการข้อมูลหลักต่อผู้ใช้

รายการฝั่งซ้ายของหน้าจอข้อมูลหลัก ให้ผู้ใช้เลือกคอลัมน์/เขียน SELECT เองได้ — ตารางนี้เก็บเลย์เอาต์นั้นแยกรายผู้ใช้ (หนึ่งแถวต่อผู้ใช้ต่อรายการ) แทนการเก็บแค่ใน localStorage ของเบราว์เซอร์ (master_datalist.go:14-19)

ตารางนี้ **โค้ดสร้างเอง** (`CREATE TABLE IF NOT EXISTS`) ครั้งแรกที่ใช้ต่อฐานบริษัทใน `datalistPool` (master_datalist.go:59-72; จำว่าสร้างแล้วต่อฐาน); ชุดคำสั่งเดียวกันมีใน `scripts/sql/23_user_datalist_config.sql` สำหรับให้ DBA รันเอง (ไฟล์นั้นระบุว่าใช้ซ้ำได้)

## โครงสร้าง (master_datalist.go:50)
| คอลัมน์ | ชนิด | ความหมาย |
|---|---|---|
| `user_code` | VARCHAR(100) | รหัสผู้ใช้ ([[tbl-erp-user]] `code`) — แปลงเป็นตัวพิมพ์ใหญ่ ถ้าไม่ส่งมาใช้ผู้ใช้ที่ล็อกอินอยู่; ว่างหรือยาวเกิน 100 → "รหัสผู้ใช้ไม่ถูกต้อง" (:24, :74-86) |
| `list_key` | VARCHAR(150) | รหัสรายการ/หน้าจอ — ว่างหรือยาวเกิน 150 → "รหัสรายการ (listKey) ไม่ถูกต้อง" (:25, :74-86) |
| `config_json` | JSONB NOT NULL | เลย์เอาต์ — ต้องเป็น JSON ที่มี `columns` เป็นอาร์เรย์ (ว่างได้) ขนาดไม่เกิน 256 KB และคอลัมน์ไม่เกิน 500 (:22-23, :90-101) |
| `updated_at` | TIMESTAMPTZ default now() | เวลาแก้ล่าสุด |

PK = (`user_code`, `list_key`)

## วิธีเขียน/อ่าน
- อ่าน (`DatalistGet`): `SELECT config_json … WHERE user_code AND list_key` (:120); ไม่พบแถวคืน `config = null` (:109-127)
- บันทึก (`DatalistSave`, :132): `INSERT … ON CONFLICT (user_code, list_key) DO UPDATE SET config_json, updated_at = now()` (:154-157)
- ส่ง `config` เป็น `null` = ลบแถวทิ้ง (`DELETE … WHERE user_code AND list_key`, :137, :148) ส่วนการส่ง `columns` เป็นอาร์เรย์ว่าง `[]` ยังบันทึกเป็นแถวตามปกติ (ผ่านการตรวจที่ :97 เพราะ `columns` ไม่ใช่ null) — เป็นการ "รีเซ็ตแบบเก็บแถว" ที่ใช้แยก "เคยรีเซ็ต" ออกจาก "ไม่เคยบันทึก" (คอมเมนต์ :18-19)
- ผู้ใช้ดู/แก้เลย์เอาต์ของตัวเองได้ด้วยสิทธิ์อ่าน; ของผู้ใช้อื่นต้องเป็นแอดมิน (บังคับที่ `RequiredRight`, adapter/inbound/http/process/permission.go:87-96)

## ใช้โดย
ชั้น master datalist ของ [[proc-master-data]]

## ลิงก์
[[tbl-group-erp]]

## ที่มาในโค้ด

- `backend/internal/application/process/master_datalist.go:14` ที่มา/เหตุผลของตารางเลย์เอาต์รายผู้ใช้
- `backend/internal/application/process/master_datalist.go:24` ขีดจำกัดความยาวรหัสผู้ใช้/รหัสรายการ
- `backend/internal/application/process/master_datalist.go:50` ชุดคำสั่งสร้างตาราง
- `backend/internal/application/process/master_datalist.go:59` `datalistPool` สร้างตารางครั้งแรกต่อฐาน
- `backend/internal/application/process/master_datalist.go:74` `datalistKey` ตรวจรหัสผู้ใช้/รหัสรายการ
- `backend/internal/application/process/master_datalist.go:90` `checkDatalistConfig` ตรวจรูปแบบ `config`
- `backend/internal/application/process/master_datalist.go:120` อ่านเลย์เอาต์
- `backend/internal/application/process/master_datalist.go:132` `DatalistSave` บันทึก/ลบ
- `backend/internal/adapter/inbound/http/process/permission.go:87` สิทธิ์อ่านของตัวเอง / แอดมินสำหรับของผู้อื่น
- `scripts/sql/23_user_datalist_config.sql:9` ชุดคำสั่งสร้างตารางสำหรับ DBA
