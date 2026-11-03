---
title: "ตารางวันนัดวางบิล-รับเงินตามเครดิต (ar_credit_pay_bill)"
tags: [tables, ap-ar]
aliases: ["ar_credit_pay_bill", "ตารางเครดิตวางบิล", "วันครบกำหนดตามรอบวางบิล", "credit pay bill"]
sources: ["backend/internal/application/process/trans_party.go:75", "backend/internal/application/process/trans_party.go:222", "backend/internal/application/process/trans_party.go:253", "backend/internal/application/process/trans_new_defaults.go:27", "backend/internal/application/process/trans_ref_import_header.go:59", "backend/internal/application/process/trans_ref_import_lines.go:251", "backend/internal/application/process/trans.go:282", "backend/internal/domain/query/write_policy_legacy.go:12", "frontend/src/config/schemas/icMasterSchemas.ts:945", "frontend/account/transaction/UniversalTransScreen.tsx:588", "scripts/sql/02_data_schema.sql:998"]
---

# ตารางเครดิตวางบิล `ar_credit_pay_bill`

ตารางตั้งค่า (master เล็ก) ที่แปลง **จำนวนวันเครดิต** ของลูกค้า (`credit_day`) เป็น **วันครบกำหนดตามรอบวางบิล/รับเงินของบริษัท** — แทนที่จะใช้ "วันที่เอกสาร + credit_day" ตรง ๆ. ใช้เมื่อบริษัทเปิดตัวเลือก `erp_option.use_credit_pay_bill_calc = 1` ([[tbl-erp-option]]) เท่านั้น. แก้ไขได้ที่หน้าจอ "กำหนดวันครบกำหนดชำระเงิน" (เมนู `menu_ar_credit_pay_bill` รหัส 1.5.9 — `icMasterSchemas.ts:945-964`); โครงสร้างตารางอยู่ที่ `scripts/sql/02_data_schema.sql:998-1013`.

## คอลัมน์ที่เห็นในโค้ด

| column | ความหมาย | ใช้ที่ไหน |
|---|---|---|
| `credit_day` | จำนวนวันเครดิตที่ตารางนี้ตอบ (ค้นด้วย `credit_day = <credit_day ของเอกสาร>`; แถวที่ `credit_day IS NULL` ถูกข้าม) | `trans_party.go:237-242`; `trans_new_defaults.go:50` |
| `day_to_due` | วันที่ของเดือนที่ถึงกำหนดชำระ (นับจากวันที่ 1) | `trans_party.go:238,254` |
| `month_to_due` | จำนวนเดือนที่เลื่อนไปข้างหน้าจากเดือนของเอกสาร | `trans_party.go:238,254` |
| `day_to_close`, `month_to_close` | วัน/เดือนที่ปิดรอบวางบิล (โหลดมาแสดงในตัวเลือก ไม่ถูกใช้คำนวณวันครบกำหนด) | `trans_new_defaults.go:48-50`; `trans_party.go:58-64`; `UniversalTransScreen.tsx:619-640` |
| `line_number`, `roworder` | ลำดับแถว (เรียงเมื่อ `credit_day` ซ้ำ ใช้แถวแรก) | `trans_party.go:242`; `trans_new_defaults.go:50` (ฟอร์ม master ไม่มีช่อง `line_number`) |
| `day_to_noties`, `month_to_noties`, `day_to_noties_2`, `month_to_noties_2` | วัน/เดือนที่ออกจดหมายเตือนครั้งที่ 1 และ 2 — มีเฉพาะในฟอร์ม master ไม่พบโค้ดที่อ่านไปคำนวณ | `icMasterSchemas.ts:960-963`; DDL `02_data_schema.sql:1008-1011` |

DDL ครบทุกคอลัมน์อยู่ที่ `scripts/sql/02_data_schema.sql:998-1013`; คอลัมน์ที่เหลือ (`ignore_sync`, `is_lock_record`, `create_date_time_now`) "(ไม่ชัดจากโค้ด)".

## สูตรวันครบกำหนด

`payBillDueDate` (`trans_party.go:253-255`): วันที่ 1 ของเดือนเอกสาร **+ `month_to_due` เดือน + (`day_to_due` − 1) วัน**. เกิดผลเฉพาะเมื่อ
1. `docDate` ไม่ว่าง (`trans_party.go:227-230`; รูปแบบวันที่ผิด = error ตรวจสอบข้อมูล `:231-234`), และ
2. `erp_option.use_credit_pay_bill_calc = 1` (อ่านใน SQL เดียวกัน `trans_party.go:237-242`), และ
3. มีแถวที่ `credit_day` ตรงกับของเอกสาร — ไม่เจอ = คืนค่าว่าง (`:246-248`) ใช้วันที่เอกสาร + `credit_day` ตามปกติ.

## กลไกที่ใช้ตารางนี้

- **เอกสารขาย 4 หน้าจอ (flag 30, 34, 36, 44 — `cashSaleFlags` `trans_party.go:72`)**: เมื่อเลือกลูกค้า `PartyDefaults` คืน `dueDate` จากตารางนี้ (`trans_party.go:138-142`) และเมื่อบันทึก `payBillTerms` ทับ `DueDate` ของเอกสาร (`trans_party.go:202-208`, เรียกที่ `trans.go:282`); เมื่อเปิดตัวเลือก ช่องเครดิต/วันครบกำหนดถูกล็อกผ่าน `CreditLocked` (`trans_new_defaults.go:27-44`, `trans_party.go:51-52`).
- **เอกสารซื้อ** (flag 2, 6, 12, 260, 262, 264 — `partyBuyFlags` `trans_party.go:69`): ใช้วันครบกำหนดที่พิมพ์เอง ตอนบันทึกไม่ทับ (`payBillScreenDue` คืนค่าว่างนอก `cashSaleFlags` `:212`) แต่ค่าเริ่มต้นตอนเลือกเจ้าหนี้มาจากตารางนี้ (`credit_day` ของเจ้าหนี้ถูกตั้งเสมอ `:167-168` แล้วเรียก `payBillDue` `:138-142`).
- **ใบเสนอราคา (flag 30)**: ตัวเลือก "เปลี่ยนจำนวนวันเครดิต" โหลดทุกแถวของตารางนี้ (แสดงแม้ตัวเลือกปิด) — `trans_new_defaults.go:47-57`; หน้าจอแสดงเป็นรายการให้เลือก (`UniversalTransScreen.tsx:619-640`) และเมื่อช่องถูกล็อก หน้าจอเรียก party-defaults พร้อม `creditDay` เพื่อรีเฟรชวันครบกำหนด (`:604-611`; ฝั่ง backend `trans_party.go:76-79`).
- **นำเข้าอ้างอิง (ref import)**: เมื่อหัวเอกสารมี `creditDay` ระบบเรียก `payBillDue` แล้วทับ `creditDate` ของหัวเอกสารถ้ามีผลลัพธ์ (`trans_ref_import_lines.go:251-260`); ก่อนหน้านั้น `creditDay()` ตั้ง `creditDate` = วันที่เอกสาร + จำนวนวัน (`trans_ref_import_header.go:59-67`).
- ค่า `credit_day` ตั้งต้นของลูกค้ามาจาก [[tbl-ar-customer-detail]] (`credit_day`) หรือ [[tbl-ap-supplier-detail]] ฝั่งซื้อ (`trans_party.go:113-125`).

## ความสัมพันธ์

- อ้างอิงเชิงตรรกะกับ `ar_customer_detail.credit_day` / `ap_supplier_detail.credit_day` (ไม่มี FK)
- ควบคุมด้วย [[tbl-erp-option]] (`use_credit_pay_bill_calc`)
- ผลลัพธ์ไปอยู่ที่ [[tbl-ic-trans]] (`due_date` / `credit_date` ของเอกสารขาย-ซื้อ — `trans.go:662,673,689`; `credit_date` ได้ค่าเท่า `due_date` ยกเว้นเอกสารแบบหัวอย่างเดียว)

## ใครเขียน / ใครอ่าน

- **เขียน**: เป็น master ตั้งค่า — หน้าจอ "กำหนดวันครบกำหนดชำระเงิน" (`icMasterSchemas.ts:945-964`) เขียนตารางนี้ผ่าน `/query/exec` ตาม legacy write allow-list (`write_policy_legacy.go:12`, ADR-0011). ไม่พบโค้ด backend ที่ INSERT/UPDATE ตารางนี้.
- **อ่าน**: `trans_party.go:222-255` (วันครบกำหนดตอนบันทึก/เลือกคู่ค้า), `trans_new_defaults.go:27-58` (รายการตั้งต้นเอกสารใหม่), `trans_ref_import_lines.go:251-260`.

## ข้อควรระวัง

- ตัวเลือก `use_credit_pay_bill_calc` ปิดอยู่ → ตารางนี้ **ถูกข้ามทั้งหมด** แม้มีข้อมูล (ยกเว้นตัวเลือกบนใบเสนอราคา).
- ตารางไม่ unique บน `credit_day` (DDL ไม่มี unique/PK — `02_data_schema.sql:998-1013`) — ถ้าซ้ำจะใช้แถวแรกตาม `line_number, roworder` (`trans_party.go:242`).
- วันครบกำหนดถูกคำนวณเป็นวันที่ UTC โดยตั้งวันที่ 1 ของเดือนก่อนบวก (`trans_party.go:253-255`) — ถ้า `day_to_due` เป็น 0 จะได้วันสุดท้ายของเดือนก่อนหน้า (`AddDate(0, 0, dayToDue-1)` = ลบ 1 วัน).

## ที่มาในโค้ด

- `backend/internal/application/process/trans_party.go:51-79,113-142,202-255`
- `backend/internal/application/process/trans_new_defaults.go:27-58`
- `backend/internal/application/process/trans_ref_import_header.go:59-67`
- `backend/internal/application/process/trans_ref_import_lines.go:251-260`
- `backend/internal/application/process/trans.go:282,662-689`
- `backend/internal/domain/query/write_policy_legacy.go:12`
- `frontend/src/config/schemas/icMasterSchemas.ts:945-964`
- `frontend/account/transaction/UniversalTransScreen.tsx:588-640`
- `scripts/sql/02_data_schema.sql:998-1013`
