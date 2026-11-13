---
title: ข้อมูลกิจการและผู้เสียภาษี — erp_company_profile / erp_business_ext / erp_tax_id_directory
tags: [dev, schema, erp, company, tax-id]
aliases: [erp_company_profile, erp_business_ext, erp_tax_id_directory, erp_data_center, ข้อมูลบริษัท]
sources:
  - scripts/sql/02_data_schema.sql:2626-2666
  - scripts/sql/02_data_schema.sql:2778-2788
  - backend/internal/application/process/service.go:952-957
  - backend/internal/application/process/trans_validate.go:28-31
  - backend/internal/application/process/pos_config.go:306-312
  - backend/internal/application/process/sme_thai_pack.go:68-92
---

# ข้อมูลกิจการและผู้เสียภาษี (`erp_company_profile` กลุ่มข้อมูลบริษัท)

กลุ่มตารางสำหรับเก็บโปรไฟล์นิติบุคคล/กิจการของฐานข้อมูลนั้นๆ ข้อมูลขยายแบบ JSONB และการแคชเลขประจำตัวผู้เสียภาษี 13 หลัก ดูภาพรวมโครงสร้างทั้งหมดได้ที่ [[schema-overview]]

---

## 1. `erp_company_profile` — ข้อมูลบริษัทหลัก

| รายการ | รายละเอียด |
|---|---|
| **บทบาท** | เก็บชื่อบริษัท ที่อยู่จดทะเบียน เลขประจำตัวผู้เสียภาษี สถานะการใช้ระบบสาขา และพิกัดแผนที่ (ปกติมี 1 แถวต่อฐานข้อมูลบริษัท) |
| **Primary Key / Unique Key** | ไม่มี SQL `PRIMARY KEY` (ใช้ `roworder serial NOT NULL`) อ่านแบบ Singleton `LIMIT 1` |
| **Runtime ALTER ที่สำคัญ** | `service.go` เพิ่ม `latitude NUMERIC(12,7) DEFAULT 0`, `longitude NUMERIC(12,7) DEFAULT 0` เพื่อรองรับ MonitorMap/สาขา |

### คอลัมน์สำคัญ (`erp_company_profile`)

| คอลัมน์ | ชนิดข้อมูล | ความหมาย / ค่า Flag |
|---|---|---|
| `company_name_1`, `company_name_2` | `varchar(100)` | ชื่อบริษัท (ไทย / อังกฤษ) |
| `business_name_1`, `business_name_2` | `varchar(100)` | ชื่อผู้ประกอบการ / ชื่อทางการค้า |
| `address_1`, `address_2` | `varchar(255)` | ที่อยู่รวม (ไทย / อังกฤษ) |
| `house`, `room_no`, `floor_no`, `village`, `house_no`, `crowd_no`, `lane`, `road` | `varchar(255)` | ส่วนประกอบที่อยู่แบบแยกฟิลด์สำหรับแบบฟอร์มราชการ/e-Tax (อาคาร, ห้อง, ชั้น, หมู่บ้าน, เลขที่, หมู่, ซอย, ถนน) |
| `locality`, `amphur`, `province`, `postcode` | `varchar(255)` | ตำบล/แขวง, อำเภอ/เขต, จังหวัด, รหัสไปรษณีย์ |
| `telephone_number`, `fax_number` | `varchar(100)` | เบอร์โทรศัพท์และแฟกซ์ |
| `tax_number` | `varchar(100)` | เลขประจำตัวผู้เสียภาษี 13 หลักของกิจการ |
| `branch_status` | `smallint DEFAULT 0` | สถานะใช้ระบบหลายสาขา: `0 = ไม่ใช้ระบบสาขา`, `1 = ใช้ระบบสาขา` (มีผลต่อการบังคับกรอกสาขาใน `trans_validate.go:29-30` คู่กับ `erp_option.warning_branch_input`) |
| `branch_type` | `smallint DEFAULT 0` | ประเภทสถานประกอบการ: `0 = สำนักงานใหญ่`, `1 = สาขา` |
| `branch_code` | `varchar(25)` | รหัสสาขาลำดับที่ (เช่น `00000`) |
| `workplace_1`, `workplace_2` | `varchar(200)` | ชื่อสถานที่ประกอบการ (ไทย / อังกฤษ) |
| `last_backup` | `timestamp` | วันเวลาที่สำรองข้อมูลล่าสุด |
| `sap_code`, `agent_code`, `arm_code`, `region`, `club`, `profit_ctr`, `cost_ctr`, `entity` | `varchar` | รหัสเชื่อมโยงภายนอก / โครงสร้าง SAP / ศูนย์กำไร-ต้นทุน |
| `latitude`, `longitude` | `numeric(12,7)` | พิกัดละติจูด-ลองจิจูดสำนักงาน (Runtime ALTER ใน `service.go:952`) |

---

## 2. `erp_business_ext` — ข้อมูลขยายแบบยืดหยุ่น (JSONB Extension)

| รายการ | รายละเอียด |
|---|---|
| **บทบาท** | เก็บ Attributes เสริมของเอนทิตีต่างๆ ที่ไม่อยู่ในคอลัมน์หลักของ BC 5.5 โดยไม่ต้อง `ALTER TABLE` ตารางเก่า |
| **Primary Key** | `PRIMARY KEY (entity_type, entity_code)` |

| คอลัมน์ | ชนิดข้อมูล | ความหมาย |
|---|---|---|
| `entity_type` | `varchar(32) NOT NULL` | ประเภทเอนทิตี เช่น ระดับบริษัท สาขา หรือรายการตั้งค่า POS |
| `entity_code` | `varchar(64) NOT NULL` | รหัสอ้างอิงของเอนทิตีนั้นๆ |
| `ext_data` | `jsonb NOT NULL DEFAULT '{}'` | โครงสร้างข้อมูลส่วนขยาย |
| `updated_at` | `timestamptz NOT NULL DEFAULT now()` | เวลาแก้ไขล่าสุด |

---

## 3. `erp_tax_id_directory` — แคชทำเนียบผู้เสียภาษี 13 หลัก

| รายการ | รายละเอียด |
|---|---|
| **บทบาท** | แคชข้อมูลชื่อนิติบุคคล รหัสสาขา 5 หลัก (`00000` = สำนักงานใหญ่) ที่อยู่ และสถานะจด VAT สำหรับ Auto-fill เมื่อกรอกเลขผู้เสียภาษี |
| **Primary Key** | `tax_id VARCHAR(13) PRIMARY KEY` |

| คอลัมน์ | ชนิดข้อมูล | ความหมาย |
|---|---|---|
| `tax_id` | `varchar(13) PRIMARY KEY` | เลขประจำตัวผู้เสียภาษี 13 หลัก (เฉพาะตัวเลข) |
| `company_name_th`, `company_name_en` | `varchar(300)` | ชื่อนิติบุคคลภาษาไทย / อังกฤษ |
| `branch_code`, `branch_name` | `varchar(10)` / `varchar(150)` | รหัสสาขา 5 หลัก (ค่าเริ่มต้น `00000`) และชื่อสาขา (ค่าเริ่มต้น `สำนักงานใหญ่`) |
| `address`, `telephone` | `text` / `varchar(100)` | ที่อยู่และเบอร์ติดต่อ |
| `vat_registered` | `boolean DEFAULT true` | สถานะเป็นผู้ประกอบการจดทะเบียนภาษีมูลค่าเพิ่ม |
| `entity_status` | `varchar(80)` | สถานะกิจการ เช่น `ยังดำเนินกิจการอยู่` |
| `source_system` | `varchar(50)` | แหล่งข้อมูล เช่น `LOCAL_CACHE` |

---

## 4. `erp_data_center` — ค่าคอนฟิกเชื่อมต่อศูนย์ข้อมูลกลาง

| รายการ | รายละเอียด |
|---|---|
| **บทบาท** | เก็บชื่อ Data Center, Provider และชื่อฐานข้อมูลกลางสำหรับโหมด Multi-branch Data Center (ไม่มี SQL PK ใช้ `roworder`) |
| **คอลัมน์หลัก** | `datacenter_server` (`varchar(150)`), `datacenter_provider_name` (`varchar(100)`), `datacenter_database_name` (`varchar(150)`), `datacenter_database_type` (`smallint`), `shop_code` (`varchar(255)`) |

---

## รูปแบบการ JOIN และตัวอย่าง SQL ใช้งานจริง

```sql
-- 1) ดึงโปรไฟล์บริษัทพร้อมตรวจสอบว่าเปิดใช้งานระบบสาขาหรือไม่
SELECT company_name_1,
       tax_number,
       branch_code,
       COALESCE(branch_status, 0) AS branch_status,
       CASE WHEN COALESCE(branch_type, 0) = 0 THEN 'สำนักงานใหญ่' ELSE 'สาขา' END AS branch_type_label,
       CONCAT_WS(' ', NULLIF(address_1, ''), NULLIF(postcode, '')) AS full_address
FROM erp_company_profile
LIMIT 1;

-- 2) ค้นหาชื่อบริษัทจากแคชเลขผู้เสียภาษี โดยจับคู่คู่ค้าในระบบ
SELECT c.code AS cust_code,
       c.name_1,
       c.tax_id,
       t.company_name_th,
       t.branch_code,
       t.vat_registered
FROM ar_customer c
LEFT JOIN erp_tax_id_directory t ON t.tax_id = REGEXP_REPLACE(COALESCE(c.tax_id, ''), '\D', '', 'g')
WHERE COALESCE(c.status, 0) = 0;
```
