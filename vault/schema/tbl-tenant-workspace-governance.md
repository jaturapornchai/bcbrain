---
title: โครงสร้างตารางฐานข้อมูลบริษัท กลุ่มผู้ใช้ สิทธิ์เมนู และพจนานุกรมสองภาษา (bc_database_list, bc_group_list, bc_permission_links, bc_language)
tags: [schema, multi-tenant, permissions, i18n, governance, postgresql]
aliases: [bc_database_list, bc_database_group, bc_group_list, bc_user_and_group, bc_permissions_group, bc_permissions_user, bc_permission_links, bc_language, bc_custom_language, bc_screen_realtime, bc_agent]
sources:
  - scripts/sql/01_main_schema.sql:16-193
  - scripts/sql/02_data_schema.sql:8850-8864
---

# โครงสร้างตารางฐานข้อมูลบริษัท กลุ่มผู้ใช้ สิทธิ์เมนู และพจนานุกรมสองภาษา

สคีมาของตารางระดับระบบกลาง (`main` database) และเมทาดาทาการจัดการสิทธิ์หน้าจอ ภาษา และตัวแทนซิงก์สาขา *(เฉพาะตารางและคอลัมน์เมทาดาทาที่ไม่ใช่ข้อมูลความลับ)*

---

## 1. ทะเบียนฐานข้อมูลบริษัทและกลุ่มผู้ใช้งาน

| ตาราง | คอลัมน์หลัก | หน้าที่ในระบบ Multi-Tenant |
|---|---|---|
| `bc_database_group` | `group_code VARCHAR(50)`, `group_name VARCHAR(150)` | จัดกลุ่มฐานข้อมูลสำหรับองค์กรหลายนิติบุคคล |
| `bc_database_list` | `data_group VARCHAR(50)`, `data_code VARCHAR(50)`, `data_name VARCHAR(150)`, `data_database_name VARCHAR(100)`, `last_database_xml_update TIMESTAMP` | ทะเบียนจับคู่รหัสบริษัท (`data_code`) เข้ากับชื่อฐานข้อมูล PostgreSQL จริง (`data_database_name`) |
| `bc_group_list` | `group_code VARCHAR(50)`, `group_name VARCHAR(100)`, `active_status SMALLINT` | ทะเบียนกลุ่มผู้ใช้งาน (เช่น ผู้ดูแลระบบ ฝ่ายบัญชี ฝ่ายขาย คลังสินค้า) |
| `bc_user_and_group` | `user_code VARCHAR(50)`, `group_code VARCHAR(50)` | ตารางเชื่อมผู้ใช้งานเข้ากับกลุ่มสิทธิ์ (`bc_group_list`) |

---

## 2. โครงสร้างสิทธิ์เมนู (`bc_permission_links`, `bc_permissions_group`, `bc_permissions_user`)

- **`bc_permission_links`**: ทะเบียนรหัสเมนูสำหรับผูกสิทธิ์ (`menu_code VARCHAR(255)`, `menu_main VARCHAR(255)`, `menu_name VARCHAR(255)`)
- **`bc_permissions_group`** และ **`bc_permissions_user`**: เก็บสิทธิ์ระดับกลุ่มและสิทธิ์เฉพาะรายบุคคล (`usercode VARCHAR(100)`, `system_id VARCHAR(10)`, `image_file BYTEA` เก็บโครงสร้างสิทธิ์, `guid_code VARCHAR(100)`)

---

## 3. ตารางพจนานุกรมหลายภาษาและการติดตามสถานะเครื่อง

- **`bc_language`**: พจนานุกรมคำแปลกลาง 6 ภาษา (`thai_lang`, `english_lang`, `chinese_lang`, `malay_lang`, `india_lang`, `lao_lang` ชนิด `VARCHAR(200)`)
- **`bc_custom_language`**: คำแปลเฉพาะกิจการที่ปรับแต่งเอง (`language_code`, `code`, `name_1`, `name_2`, `status SMALLINT`)
- **`bc_screen_realtime`**: สถานะหน้าจอเครื่องลูกข่าย (`computer_name VARCHAR(100)`, `screen_thumbnail TEXT`, `request_time`, `update_time`)
- **`bc_agent`**: เมทาดาทาตัวแทนซิงก์ข้อมูลสาขา (`code VARCHAR(25)`, `name VARCHAR(100)`, `servername VARCHAR(50)`, `branchdatabasename VARCHAR(50)`, `transall SMALLINT`)

---

## ความสัมพันธ์ในระบบ
- [[part_of_arch::arch-multi-tenant-di]] — สถาปัตยกรรมแยกฐานข้อมูลรายบริษัทและการสลับ Tenant Pool
- [[part_of_arch::arch-i18n-field-help-schema-forms]] — ระบบแปลสองภาษาและการกรองเมนูตามสิทธิ์
