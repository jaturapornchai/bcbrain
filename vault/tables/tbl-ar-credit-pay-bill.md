---
title: "ตารางวันนัดวางบิล-รับเงินตามเครดิต (ar_credit_pay_bill)"
tags: [tables, ap-ar]
aliases: ["ar_credit_pay_bill", "ตารางเครดิตวางบิล", "วันครบกำหนดตามรอบวางบิล", "credit pay bill"]
sources: ["backend/internal/application/process/trans_party.go:222", "backend/internal/application/process/trans_party.go:252", "backend/internal/application/process/trans_new_defaults.go:30", "backend/internal/application/process/trans_ref_import_header.go:58"]
---

# ตารางเครดิตวางบิล `ar_credit_pay_bill`

ตารางตั้งค่า (master เล็ก) ที่แปลง **จำนวนวันเครดิต** ของลูกค้า (`credit_day`) เป็น **วันครบกำหนดตามรอบวางบิล/รับเงินของบริษัท** — แทนที่จะใช้ "วันที่เอกสาร + credit_day" ตรง ๆ. ใช้เมื่อบริษัทเปิดตัวเลือก `erp_option.use_credit_pay_bill_calc = 1` ([[tbl-erp-option]]) เท่านั้น. มาจากหน้าจอ C# `ARCreditPayBillForm`.

## คอลัมน์ที่เห็นในโค้ด

| column | ความหมาย | ใช้ที่ไหน |
|---|---|---|
| `credit_day` | จำนวนวันเครดิตที่ตารางนี้ตอบ (ค้นด้วย `credit_day = <credit_day ของเอกสาร>`; แถวที่ `credit_day IS NULL` ถูกข้าม) | `trans_party.go:240-245`; `trans_new_defaults.go:50` |
| `day_to_due` | วันที่ของเดือนที่ถึงกำหนดชำระ (นับจากวันที่ 1) | `trans_party.go:240-252` |
| `month_to_due` | จำนวนเดือนที่เลื่อนไปข้างหน้าจากเดือนของเอกสาร | `trans_party.go:240-252` |
| `day_to_close`, `month_to_close` | วัน/เดือนที่ปิดรอบวางบิล (โหลดมาแสดงในตัวเลือก ไม่ถูกใช้คำนวณวันครบกำหนด) | `trans_new_defaults.go:50` |
| `line_number`, `roworder` | ลำดับแถว (เรียงเมื่อ `credit_day` ซ้ำ ใช้แถวแรก) | `trans_party.go:244`; `trans_new_defaults.go:50` |

คอลัมน์อื่นไม่ปรากฏใน SQL ที่อ่าน → "(ไม่ชัดจากโค้ด)".

## สูตรวันครบกำหนด

`payBillDueDate` (`trans_party.go:252-255`): วันที่ 1 ของเดือนเอกสาร **+ `month_to_due` เดือน + (`day_to_due` − 1) วัน**. เกิดผลเฉพาะเมื่อ
1. `docDate` ไม่ว่าง, และ
2. `erp_option.use_credit_pay_bill_calc = 1` (อ่านใน SQL เดียวกัน `trans_party.go:240-245`), และ
3. มีแถวที่ `credit_day` ตรงกับของเอกสาร — ไม่เจอ = คืนค่าว่าง ใช้วันที่เอกสาร + `credit_day` ตามปกติ.

## กลไกที่ใช้ตารางนี้

- **เอกสารขายที่ `credit_day`/วันครบกำหนดแก้ไม่ได้** (ชุด `defaultSaleTypeFlags` 4 หน้าจอ): `payBillTerms` คำนวณตอนบันทึก (`trans_party.go:198-204`); ตั้งเป็นแบบ "locked" ผ่าน `CreditLocked` เมื่อเปิดตัวเลือก (`trans_new_defaults.go:30-52`).
- **เอกสารซื้อ**: ใช้วันครบกำหนดที่พิมพ์เอง แต่ค่าเริ่มต้นตอนเลือกเจ้าหนี้มาจากตารางนี้ (`trans_party.go:198-204` comment "Buy screens keep the typed due date").
- **ใบเสนอราคา (flag 30)**: ตัวเลือก "เปลี่ยนจำนวนวันเครดิต" โหลดทุกแถวของตารางนี้ (แสดงแม้ตัวเลือกปิด) — `trans_new_defaults.go:44-60`.
- **นำเข้าอ้างอิง (ref import)**: หลังตั้ง `credit_day` สุดท้าย ระบบเรียกคำนวณวันครบกำหนดตามตารางนี้ (`trans_ref_import_header.go:56-60`).
- ค่า `credit_day` ตั้งต้นของลูกค้ามาจาก [[tbl-ar-customer-detail]] (`credit_day`) หรือ [[tbl-ap-supplier-detail]] ฝั่งซื้อ.

## ความสัมพันธ์

- อ้างอิงเชิงตรรกะกับ `ar_customer_detail.credit_day` / `ap_supplier_detail.credit_day` (ไม่มี FK)
- ควบคุมด้วย [[tbl-erp-option]] (`use_credit_pay_bill_calc`)
- ผลลัพธ์ไปอยู่ที่ [[tbl-ic-trans]] (`due_date` / `credit_date` ของเอกสารขาย-ซื้อ)

## ใครเขียน / ใครอ่าน

- **เขียน**: เป็น master ตั้งค่า— หน้าจอ master เขียนตารางนี้ผ่าน `/query/exec` ตาม legacy write allow-list (ADR-0011). ไม่พบโค้ด backend ที่เขียนเฉพาะตารางนี้.
- **อ่าน**: `trans_party.go:222-255` (วันครบกำหนดตอนบันทึก/เลือกคู่ค้า), `trans_new_defaults.go:30-60` (รายการตั้งต้นเอกสารใหม่), `trans_ref_import_header.go:56-60`.

## ข้อควรระวัง

- ตัวเลือก `use_credit_pay_bill_calc` ปิดอยู่ → ตารางนี้ **ถูกข้ามทั้งหมด** แม้มีข้อมูล (ยกเว้นตัวเลือกบนใบเสนอราคา).
- ตารางไม่ unique บน `credit_day` — ถ้าซ้ำจะใช้แถวแรกตาม `line_number, roworder` (`trans_party.go:244`).
- วันครบกำหนดถูกคำนวณเป็นวันที่ UTC โดยตั้งวันที่ 1 ของเดือนก่อนบวก (`trans_party.go:252-255`) — ถ้า `day_to_due` เป็น 0 จะได้วันสุดท้ายของเดือนก่อนหน้า (`AddDate(0,0,-1)`) ซึ่งเป็นพฤติกรรมตามสูตร C# เดิม.

## ที่มาในโค้ด

- `backend/internal/application/process/trans_party.go:198-204,222-255`
- `backend/internal/application/process/trans_new_defaults.go:30-60`
- `backend/internal/application/process/trans_ref_import_header.go:54-60`
