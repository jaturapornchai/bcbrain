---
title: "ที่อยู่จัดส่ง/ป้ายขนส่งของเจ้าหนี้-ลูกหนี้ (ap_ar_transport_label)"
tags: [tables, ap-ar]
aliases: ["ap_ar_transport_label", "ที่อยู่จัดส่งสินค้า", "ป้ายที่อยู่ขนส่ง", "transport label"]
sources: ["backend/internal/application/process/sysproc_tools.go:219", "backend/internal/application/process/report_menu_ap_ar.go:948", "backend/internal/application/process/report_menu_ap_ar.go:969", "backend/internal/application/process/report_menu_ap_ar.go:1164", "backend/internal/application/process/service.go:828", "backend/internal/platform/db/pool.go:37", "backend/internal/application/process/workflow.go:121", "backend/internal/adapter/inbound/http/process/workflow_handler.go:108", "backend/internal/domain/query/write_policy_legacy.go:11", "frontend/src/config/schemas/icMasterSchemas.ts:64", "frontend/account/master/TransportLabelPrintScreen.tsx:86", "frontend/account/process/SystemProcessWorkbenchScreen.tsx:713", "scripts/sql/02_data_schema.sql:613"]
---

# ที่อยู่จัดส่ง / ป้ายขนส่ง `ap_ar_transport_label`

ตาราง **ที่อยู่ผู้รับสำหรับพิมพ์ป้ายจัดส่งสินค้า** ของทั้งเจ้าหนี้และลูกหนี้ในตารางเดียว แยกฝั่งด้วย `ar_ap_type`. ชื่อตารางขึ้นต้น `ap_ar_` แต่ **เป็น master** ไม่ใช่เอกสารเงิน — นโยบายเขียนจึงอยู่ใน legacy write allow-list ของ `/query/exec` (`write_policy_legacy.go:11`, ADR-0011) และ regex ตารางเงิน `ap_ar_trans(_\w+)?` ถูกออกแบบให้ *ไม่* จับตารางนี้ (`write_policy.go:23` comment "ap_ar_transport_label is a master and must not match ap_ar_trans(_...)"). โครงสร้างตารางอยู่ที่ `scripts/sql/02_data_schema.sql:613-660`.

## ชนิดแถว (`ar_ap_type`)

| ar_ap_type | ความหมาย | ที่มา |
|---|---|---|
| 0 | เจ้าหนี้ ([[tbl-ap-supplier]]) | `report_menu_ap_ar.go:948-950` (`s.pick("0","1")`), `sysproc_tools.go:220-223` (import: เจ้าหนี้ = 0, ลูกหนี้ = 1), `icMasterSchemas.ts:106` (`fixedValues` ของหน้า master) |
| 1 | ลูกหนี้ ([[tbl-ar-customer]]) | เช่นเดียวกัน |

## คอลัมน์ที่เห็นในโค้ด

| column | ความหมาย | ใช้ที่ไหน |
|---|---|---|
| `cust_code` | รหัสลูกหนี้/เจ้าหนี้ (ตามชนิด) — รวมกับ `ar_ap_type` เป็น key ธุรกิจ | `sysproc_tools.go:230-232`; `workflow.go:121`; `icMasterSchemas.ts:108-109` (หน้า master ค้นรหัสจาก `ap_supplier`/`ar_customer`) |
| `ar_ap_type` | 0 = เจ้าหนี้, 1 = ลูกหนี้ | ข้างบน |
| `name_1` | ชื่อผู้รับ | `report_menu_ap_ar.go:971` |
| `address`, `telephone`, `fax`, `email` | ที่อยู่/ติดต่อผู้รับ | `report_menu_ap_ar.go:972-975`; คัดลอกจาก master ตอน import `sysproc_tools.go:230-232`; แก้เองที่หน้า master `icMasterSchemas.ts:65-68` |
| `remark_1`, `remark_2` | หมายเหตุป้าย 1/2 | `report_menu_ap_ar.go:976-977`; `icMasterSchemas.ts:95-96` |
| `send_name_1`, `send_address`, `send_country`, `send_province`, `send_amper`, `send_tambon`, `send_zip_code`, `send_telephone`, `send_fax`, `send_email`, `send_id_date` | ที่อยู่/ข้อมูลของ "ผู้ส่ง" (ชุด `send_*`) — คอลัมน์ที่เพิ่มด้วย `ADD COLUMN IF NOT EXISTS` ตอนเริ่มระบบ (`send_id_date` เป็น DATE ที่เหลือ TEXT) | `service.go:828-838`, `platform/db/pool.go:37-47` |
| `transport_code` | รหัสผู้ให้บริการขนส่ง — หน้าพิมพ์ป้ายอ่านมาแสดงในช่อง "ขนส่งโดย" | ALTER `service.go:839`, `pool.go:48`; อ่าน `TransportLabelPrintScreen.tsx:100-105,117` |
| `roworder` | ลำดับแถว — คีย์แถวของหน้า master (`icMasterSchemas.ts:107`) เป็น `serial` ใน DDL (`02_data_schema.sql:616`) และใช้เรียงต่อจากรหัสในรายงาน | `report_menu_ap_ar.go:983` |
| `ship_code`, `logistic_area`, `latitude`, `longitude`, `home_address`, `room_no`, `building`, `floor`, `home_name`, `moo`, `soi`, `road`, `province`, `amper`, `tambon`, `zip_code`, `country`, `home_phone`, `mobile1`, `mobile2`, `transport_type`, `receive_day`, `time_period`, `branch_type`, `branch_code`, `tax_id` | ที่อยู่แยกส่วน พิกัด เบอร์ติดต่อ ช่วงเวลารับสินค้า และข้อมูลสาขา/ภาษี — ฟอร์ม master ให้กรอกได้ แต่รายงานป้ายไม่ดึงคอลัมน์เหล่านี้ | `icMasterSchemas.ts:69-94`; DDL `02_data_schema.sql:613-657` |

`send_*` และ `transport_code` ไม่อยู่ใน DDL (`02_data_schema.sql:613-660`) — เกิดจาก ALTER ตอนเริ่มระบบเท่านั้น; ไม่มีโค้ด backend/frontend อ่านหรือเขียน `send_*` เลย และไม่มีโค้ดเขียน `transport_code` → การใช้งานของ `send_*` "ไม่ชัดจากโค้ด". คอลัมน์ใน DDL ที่ไม่ปรากฏในโค้ดที่อ่าน: `guid_code`, `name_2`, `ship_code_ref`, `status`, `ignore_sync`, `is_lock_record`, `create_date_time_now` (หน้า master ซ่อน `name_2`/`status` ด้วย `noName2`/`hideStatus` — `icMasterSchemas.ts:112-113`).

## ความสัมพันธ์

- N → 1 [[tbl-ar-customer]] หรือ [[tbl-ap-supplier]] ผ่าน `cust_code` + `ar_ap_type` — ไม่มี unique บน `cust_code` (มีแค่ index ธรรมดา `02_data_schema.sql:660`) และหน้า master ใช้ `roworder` เป็นคีย์แถว จึงมีหลายแถวต่อรหัสได้
- ถูกอ้างอิงโดยกลไกเปลี่ยนรหัส (`workflow.go:121` — กรองด้วย `ar_ap_type = transportType`; ลูกหนี้ใช้ 1 เจ้าหนี้ใช้ 0)
- ไม่ถูกอ้างจากตารางเอกสาร ([[tbl-ic-trans]]) ในโค้ดที่อ่าน

## ใครเขียน / ใครอ่าน

- **เขียน (import)**: `ImportTransportLabel` (`sysproc_tools.go:219-240`) คัดลอก `code,name_1,address,telephone,fax,email` จาก `ar_customer` หรือ `ap_supplier` ที่ **ยังไม่มีแถวในตารางนี้** (กัน duplicate ด้วย `NOT EXISTS ... ar_ap_type AND cust_code` `:230-232`; `kind` ที่ไม่ใช่ `ap`/`ar` ถูกปฏิเสธ `:225-226`) แล้วบันทึก process log (`:237`); เรียกผ่าน workflow `import-transport-label` (`workflow_handler.go:108-114`) จากหน้านำเข้าที่อยู่ (`SystemProcessWorkbenchScreen.tsx:713-716`).
- **เขียน (แก้ไขเอง)**: หน้าจอ "ที่อยู่จัดส่งสินค้า" (`transportLabelConfig` `icMasterSchemas.ts:99-115`; เมนู `menu_ap_transport_label` `:1220` / `menu_ar_transport_label` `:1312`) เขียนผ่าน `/query/exec` ตาม legacy write allow-list (`write_policy_legacy.go:11`) และตั้ง `ar_ap_type` ให้เอง (`icMasterSchemas.ts:106`).
- **อ่าน**: รายงาน "พิมพ์ที่อยู่จัดส่งสินค้า" (`report_menu_ap_ar.go:969-984`) และรายงานดูตัวอย่างรายการที่ **ยังไม่ถูก import** ซึ่งเทียบกับ master (`:953-967` — read-only preview); ทั้งสองลงทะเบียนที่ `:1164-1165`. หน้า "พิมพ์ป้ายชื่อขนส่ง" (`TransportLabelPrintScreen.tsx:99-107`) และหน้านำเข้าที่อยู่ (`SystemProcessWorkbenchScreen.tsx:1960-1982`) ยิง SQL อ่านตารางนี้ตรง ๆ.
- **ปรับโครงสร้าง**: ALTER เพิ่มคอลัมน์ `send_*` และ `transport_code` ที่ `service.go:828-839` และ `pool.go:37-48` (ทำซ้ำได้อย่างปลอดภัยด้วย `IF NOT EXISTS`).

## ข้อควรระวัง

- ที่อยู่ที่ import แล้วเป็น **สำเนา** — แก้ที่ master ภายหลังไม่ตามมา (และ import ซ้ำจะข้ามรหัสที่มีแล้ว) ต้องแก้ในตารางนี้เอง.
- รายงานป้ายใช้ค่า "จำนวนดวง" เป็น `'1'` คงที่ (`report_menu_ap_ar.go:978`) — ไม่ใช่คอลัมน์.
- ตารางมีทั้งสองฝั่งปนกัน ต้องกรอง `ar_ap_type` ทุกครั้ง มิฉะนั้นรหัสลูกหนี้กับเจ้าหนี้ที่ซ้ำกันจะปน. หน้าพิมพ์ป้ายฝั่งเจ้าหนี้กรอง `ar_ap_type` เป็น 0 **หรือ 2** ส่วนฝั่งลูกหนี้กรองเป็น 1 (`TransportLabelPrintScreen.tsx:86-90`) — ค่า 2 ไม่พบโค้ดที่เขียน.
- ชื่อตารางขึ้น `ap_ar_` อาจถูกเข้าใจผิดว่าเป็นตารางเงิน — ไม่ใช่ (นโยบายแยกชัด `write_policy.go:23`).

## ที่มาในโค้ด

- `backend/internal/application/process/sysproc_tools.go:210-240`
- `backend/internal/application/process/report_menu_ap_ar.go:948-984,1164-1165`
- `backend/internal/application/process/service.go:828-839`
- `backend/internal/platform/db/pool.go:37-48`
- `backend/internal/application/process/workflow.go:121`
- `backend/internal/adapter/inbound/http/process/workflow_handler.go:108-114`
- `backend/internal/domain/query/write_policy.go:23`, `write_policy_legacy.go:11`
- `frontend/src/config/schemas/icMasterSchemas.ts:64-115`
- `frontend/account/master/TransportLabelPrintScreen.tsx:86-107`
- `frontend/account/process/SystemProcessWorkbenchScreen.tsx:713-716,1960-1982`
- `scripts/sql/02_data_schema.sql:613-660`
