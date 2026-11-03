---
title: "ที่อยู่จัดส่ง/ป้ายขนส่งของเจ้าหนี้-ลูกหนี้ (ap_ar_transport_label)"
tags: [tables, ap-ar]
aliases: ["ap_ar_transport_label", "ที่อยู่จัดส่งสินค้า", "ป้ายที่อยู่ขนส่ง", "transport label"]
sources: ["backend/internal/application/process/sysproc_tools.go:218", "backend/internal/application/process/report_menu_ap_ar.go:954", "backend/internal/application/process/report_menu_ap_ar.go:968", "backend/internal/application/process/service.go:817", "backend/internal/platform/db/pool.go:37", "backend/internal/application/process/workflow.go:121"]
---

# ที่อยู่จัดส่ง / ป้ายขนส่ง `ap_ar_transport_label`

ตาราง **ที่อยู่ผู้รับสำหรับพิมพ์ป้ายจัดส่งสินค้า** ของทั้งเจ้าหนี้และลูกหนี้ในตารางเดียว แยกฝั่งด้วย `ar_ap_type`. ชื่อตารางขึ้นต้น `ap_ar_` แต่ **เป็น master** ไม่ใช่เอกสารเงิน — นโยบายเขียนจึงอยู่ใน legacy write allow-list ของ `/query/exec` (ADR-0011) และ regex ตารางเงิน `ap_ar_trans(_\w+)?` ถูกออกแบบให้ *ไม่* จับตารางนี้ (`write_policy.go:23` comment "ap_ar_transport_label is a master and must not match ap_ar_trans(_...)").

## ชนิดแถว (`ar_ap_type`)

| ar_ap_type | ความหมาย | ที่มา |
|---|---|---|
| 0 | เจ้าหนี้ ([[tbl-ap-supplier]]) | `report_menu_ap_ar.go:954-968` (`s.pick("0","1")`), `sysproc_tools.go:218-232` |
| 1 | ลูกหนี้ ([[tbl-ar-customer]]) | เช่นเดียวกัน |

## คอลัมน์ที่เห็นในโค้ด

| column | ความหมาย | ใช้ที่ไหน |
|---|---|---|
| `cust_code` | รหัสลูกหนี้/เจ้าหนี้ (ตามชนิด) — รวมกับ `ar_ap_type` เป็น key ธุรกิจ | `sysproc_tools.go:230-232`; `workflow.go:121` |
| `ar_ap_type` | 0 = เจ้าหนี้, 1 = ลูกหนี้ | ข้างบน |
| `name_1` | ชื่อผู้รับ | `report_menu_ap_ar.go:970-975` |
| `address`, `telephone`, `fax`, `email` | ที่อยู่/ติดต่อผู้รับ | `report_menu_ap_ar.go:970-975`; คัดลอกจาก master ตอน import `sysproc_tools.go:230` |
| `remark_1`, `remark_2` | หมายเหตุป้าย 1/2 | `report_menu_ap_ar.go:976-977` |
| `send_name_1`, `send_address`, `send_country`, `send_province`, `send_amper`, `send_tambon`, `send_zip_code`, `send_telephone`, `send_fax`, `send_email`, `send_id_date` | ที่อยู่/ข้อมูลของ "ผู้ส่ง" (ชุด `send_*`) — คอลัมน์ที่เพิ่มด้วย `ADD COLUMN IF NOT EXISTS` ตอนเริ่มระบบ (`send_id_date` เป็น DATE ที่เหลือ TEXT) | `service.go:817-827`, `platform/db/pool.go:37-47` |
| `transport_code` | รหัสผู้ให้บริการขนส่ง | `service.go:828`, `pool.go:48` |
| `roworder` | ลำดับแถว (เรียงรหัส/รายงาน) | `report_menu_ap_ar.go:980-991` |

ความหมายของแต่ละ `send_*` เป็นชื่อสื่อความตามคอลัมน์ ไม่มีโค้ดอ่าน-เขียนจริงใน backend ที่ใช้คอลัมน์เหล่านี้ → การใช้งานในหน้าจอ "ไม่ชัดจากโค้ด".

## ความสัมพันธ์

- N → 1 [[tbl-ar-customer]] หรือ [[tbl-ap-supplier]] ผ่าน `cust_code` + `ar_ap_type`
- ถูกอ้างอิงโดยกลไกเปลี่ยนรหัส (`workflow.go:121` — กรองด้วย `ar_ap_type = transportType`; ลูกหนี้ใช้ 1 เจ้าหนี้ใช้ 0)
- ไม่ถูกอ้างจากตารางเอกสาร ([[tbl-ic-trans]]) ในโค้ดที่อ่าน

## ใครเขียน / ใครอ่าน

- **เขียน (import)**: `ImportTransportLabel` (`sysproc_tools.go:218-236`) คัดลอก `code,name_1,address,telephone,fax,email` จาก `ar_customer` หรือ `ap_supplier` ที่ **ยังไม่มีแถวในตารางนี้** (กัน duplicate ด้วย `NOT EXISTS ... ar_ap_type AND cust_code`) — ตรงกับ C# `_importTransportLabel`.
- **เขียน (แก้ไขเอง)**: หน้าจอ master (ผ่าน generic/legacy write).
- **อ่าน**: รายงาน "พิมพ์ที่อยู่จัดส่งสินค้า" (`report_menu_ap_ar.go:968-991`) และรายงานดูตัวอย่างรายการที่ **ยังไม่ถูก import** ซึ่งเทียบกับ master (`:954-964` — read-only preview).
- **ปรับโครงสร้าง**: ALTER เพิ่มคอลัมน์ที่ `service.go:817-828` และ `pool.go:37-48` (ทำซ้ำได้อย่างปลอดภัยด้วย `IF NOT EXISTS`).

## ข้อควรระวัง

- ที่อยู่ที่ import แล้วเป็น **สำเนา** — แก้ที่ master ภายหลังไม่ตามมา (และ import ซ้ำจะข้ามรหัสที่มีแล้ว) ต้องแก้ในตารางนี้เอง.
- รายงานป้ายใช้ค่า "จำนวนดวง" เป็น `'1'` คงที่ (`report_menu_ap_ar.go:978`) — ไม่ใช่คอลัมน์.
- ตารางมีทั้งสองฝั่งปนกัน ต้องกรอง `ar_ap_type` ทุกครั้ง มิฉะนั้นรหัสลูกหนี้กับเจ้าหนี้ที่ซ้ำกันจะปน.
- ชื่อตารางขึ้น `ap_ar_` อาจถูกเข้าใจผิดว่าเป็นตารางเงิน — ไม่ใช่ (นโยบายแยกชัด `write_policy.go:23`).

## ที่มาในโค้ด

- `backend/internal/application/process/sysproc_tools.go:208-236`
- `backend/internal/application/process/report_menu_ap_ar.go:954-991`
- `backend/internal/application/process/service.go:817-828`
- `backend/internal/platform/db/pool.go:37-48`
- `backend/internal/application/process/workflow.go:121`
- `backend/internal/domain/query/write_policy.go:23`
