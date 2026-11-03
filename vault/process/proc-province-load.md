---
title: "โหลดข้อมูลจังหวัด/อำเภอ/ตำบลมาตรฐาน (Province Load)"
tags: [process, workflow, master-data, province, erp_province, erp_amper, erp_tambon, embedded]
aliases: ["province-list", "province-load", "ProvinceList", "ProvinceLoad", "menu_setup_province_auto", "thailand_geo.json", "erp_province", "erp_amper", "erp_tambon", "โหลดจังหวัดอัตโนมัติ", "รหัสไปรษณีย์"]
sources: ["backend/internal/application/process/province_load.go:3", "backend/internal/application/process/province_load.go:23", "backend/internal/application/process/province_load.go:48", "backend/internal/application/process/province_load.go:108", "backend/internal/application/process/province_load.go:132", "backend/internal/application/process/province_load.go:176", "backend/internal/adapter/inbound/http/process/workflow_handler.go:115", "backend/internal/adapter/inbound/http/process/permission.go:36"]
---

# โหลดข้อมูลจังหวัด/อำเภอ/ตำบลมาตรฐาน (Province Load)

เมนู `menu_setup_province_auto` (C# `BCERPConfig/_provinceLoadFromWebControl`) ให้ผู้ใช้ติ๊กเลือกจังหวัดจากรายการมาตรฐาน แล้วระบบเขียนจังหวัด อำเภอ ตำบลของจังหวัดนั้นลง `erp_province`, `erp_amper`, `erp_tambon` ฝั่ง C# เคยอ่านจากเว็บเซอร์วิส ฝั่งนี้แทนด้วยไฟล์ JSON ที่ฝังในไบนารี (`//go:embed`) จึงไม่เรียกเครือข่ายภายนอก

## ทำงานอย่างไร

### ข้อมูลมาตรฐานที่ฝังไว้
- ไฟล์ `province_data/thailand_geo.json` โหลดครั้งเดียวด้วย `sync.OnceValues` เรียงตามรหัสจังหวัด (`province_load.go:23,48`)
- ตรวจจากไฟล์จริง: 77 จังหวัด, 928 อำเภอ, 7,436 ตำบล (ตรงกับคอมเมนต์ :7); แต่ละระดับมี `code`, `th`, `en`; ตำบลมี `zip_code` ได้; ทุกระดับมี `lat`/`lng` ได้ (ฟิลด์ใน `geoPlace` :26-33)
- โครงสร้าง: จังหวัด -> `districts[]` -> `subdistricts[]`; คีย์ระดับบนของไฟล์ `source`, `license`, `provinces`
- ใบอนุญาตข้อมูลอยู่ที่ `province_data/thailand_geo.LICENSE.txt` (MIT; ตรวจเฉพาะบรรทัดแรก ๆ ของไฟล์)

### 2 action ใต้ `workflow/*`
| action | สิทธิ์ | หน้าที่ |
|---|---|---|
| `province-list` | read (`permission.go:36`) | คืนทุกจังหวัดสำหรับตารางติ๊ก: `{code, name (ภาษาไทย), lat, lng}` ไม่ต้องมี body (`ProvinceList` :68) |
| `province-load` | write (`permission.go:51`) | โหลดจังหวัดที่ติ๊กลงฐานข้อมูลบริษัท (`ProvinceLoad` :176) |

### `province-load` ทำอย่างไร
1. Input `codes[]` (รหัสจังหวัดที่ติ๊ก) -> `pickProvinces` (:108): trim ค่าว่างทิ้ง, ไม่ติ๊กเลย = error "กรุณาเลือกจังหวัดอย่างน้อย 1 จังหวัด", รหัสที่ไม่มีในข้อมูลมาตรฐาน = error "ไม่พบรหัสจังหวัดที่เลือกในข้อมูลมาตรฐาน", รหัสซ้ำถูกตัด และคงลำดับตามข้อมูลมาตรฐาน
2. `flattenGeo` (:132) แตกเป็น 3 ระดับแบบ parallel array: จังหวัด, อำเภอ (เก็บ `province`), ตำบล (เก็บ `province`, `amper`)
3. ใน `withTx` เดียว: ล็อก `pg_advisory_xact_lock(hashtext('province_load'))` กันสองคนโหลดพร้อมกันแล้ว insert ซ้ำ (คอมเมนต์ :188) จากนั้นรัน 3 statement ตามลำดับ จังหวัด -> อำเภอ -> ตำบล
4. แต่ละ statement เป็น CTE เดียว: `DELETE` แถวเดิมตามคีย์ (`code` / `province,code` / `province,amper,code`) แล้ว `INSERT` ใหม่จากอาร์เรย์ (`unnest`)
5. เมื่อโหลดซ้ำ ค่าเดิมถูกรักษาไว้: `lat`/`lng` เดิมที่ไม่เป็น 0, `zip_code` เดิมที่ไม่ว่าง (เฉพาะตำบล), `status`, `guid_code` มิฉะนั้นใช้ค่าจากไฟล์ฝัง (คอมเมนต์ :145-147 และ SQL :148-173)
6. เขียน log ผ่าน `writeProcessLog` เมนู `menu_setup_province_auto` ดู [[proc-workflow]]

**ผลลัพธ์** `ProvinceLoadResult`: `provinces`, `amphurs`, `tambons` (จำนวนแถวที่ส่งเข้า insert) -- รันซ้ำได้ผลเท่าเดิม (คอมเมนต์ :174-175 "Re-running it gives the same rows")

### ข้อควรระวัง
- ไม่ลบจังหวัดที่ไม่ได้ติ๊ก และไม่ลบอำเภอ/ตำบลที่ไม่อยู่ในไฟล์ (ลบเฉพาะแถวที่คีย์ตรงกับที่จะ insert)
- ข้อมูลมาตรฐานมาจากไฟล์ที่ฝังในรุ่นที่ build ถ้าต้องการรหัสไปรษณีย์ใหม่ต้องเปลี่ยนไฟล์แล้ว build ใหม่

## ที่มาในโค้ด
- `backend/internal/application/process/province_load.go:3-8` - คอมเมนต์หลักของเมนูและข้อมูลฝัง
- `backend/internal/application/process/province_load.go:23-58` - `go:embed`, ชนิด `geoPlace/geoDistrict/geoProvince`, `provinceGeo`
- `backend/internal/application/process/province_load.go:60-78` - `ProvinceRow`, `ProvinceList`
- `backend/internal/application/process/province_load.go:108-143` - `pickProvinces`, `flattenGeo`
- `backend/internal/application/process/province_load.go:148-173` - SQL สามระดับ `provinceInsertSQL`, `amperInsertSQL`, `tambonInsertSQL`
- `backend/internal/application/process/province_load.go:174-209` - `ProvinceLoad`
- `backend/internal/application/process/province_data/thailand_geo.json` - ข้อมูลมาตรฐาน
- `backend/internal/adapter/inbound/http/process/workflow_handler.go:115-123` - case `province-list`, `province-load`

## ดูเพิ่ม
- [[proc-workflow]]
- [[proc-master-data]]
- [[proc-permission-rights]]
- [[process-overview]]
