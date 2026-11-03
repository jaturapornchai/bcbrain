---
title: "ส่วนลดตามบาร์โค้ด (ic_inventory_barcode_price)"
tags: [tables, ic]
aliases: ["ic_inventory_barcode_price", "ส่วนลดบาร์โค้ด", "ลดพิเศษ", "ลดโปรโมชั่น"]
sources: ["backend/internal/application/process/barcode_discount.go:23", "backend/internal/application/process/barcode_discount.go:83", "backend/internal/application/process/barcode_discount.go:147", "backend/internal/application/process/barcode_discount.go:175", "backend/internal/application/process/barcode_discount.go:225", "backend/internal/application/process/barcode_discount.go:306", "backend/internal/application/process/barcode_discount.go:336", "frontend/account/master/BarcodeDiscountScreens.tsx:27", "frontend/account/master/BarcodeDiscountScreens.tsx:251", "frontend/account/tabs/screenRegistry.tsx:663", "backend/internal/domain/query/write_policy_legacy.go:36", "scripts/sql/02_data_schema.sql:5380"]
---
# ส่วนลดตามบาร์โค้ด (`ic_inventory_barcode_price`)

**หน้าที่:** เก็บเงื่อนไขส่วนลดของแต่ละบาร์โค้ดใน [[tbl-ic-inventory-barcode]] แบ่งเป็น 5 ชนิด (`discount_type` 1-5) ตามหน้าจอ 2.1.8 "กำหนดส่วนลดตามบาร์โค๊ด" และ 2.1.9 "กำหนดส่วนลดตามบาร์โค๊ด (เร็ว)" (`screenRegistry.tsx:663-690`, `barcode_discount.go:72`)

## คอลัมน์ (DDL `scripts/sql/02_data_schema.sql:5380-5398`, INSERT `barcode_discount.go:319-321`)

| column | ความหมาย | หมายเหตุ |
|---|---|---|
| `barcode` | รหัสบาร์โค้ด (varchar 25) เก็บตามตัวพิมพ์ที่อยู่ใน [[tbl-ic-inventory-barcode]] | เชื่อมด้วย `upper(barcode)` (`barcode_discount.go:110,312,337`) |
| `discount_type` | 1 ลดพิเศษทั่วไป, 2 ลดพิเศษสมาชิก, 3 ลดโปรโมชั่น, 4 ลดสมาชิก, 5 ลดพนักงาน | ชื่อชนิดใน `BarcodeDiscountScreens.tsx:27`; รับเฉพาะ 1-5 (`barcode_discount.go:151-153`) และ 1 ชนิดต่อ 1 กริด ห้ามซ้ำ (`:154-157`) |
| `discount_word` | ข้อความส่วนลด เช่น "5%" หรือ "10" (varchar 25; ว่าง = ข้ามบรรทัด) | `:176-178` |
| `priority` | ความสำคัญ 0-32767 (smallint) โหลดเรียงตามค่านี้ | `:179-181`, เรียงที่ `:111` |
| `qty_begin`, `qty_end` | ช่วงจำนวนที่ลดได้ (จำนวนเต็ม 0 ขึ้นไป) | `:182-184` |
| `date_begin`, `date_end` | ช่วงวันที่ลดได้ รูปแบบ YYYY-MM-DD (ว่าง = NULL) | `:197-201,207-221` |
| `lock_day` | วันในสัปดาห์ที่ใช้ได้ เช่น "0,1,..6" (0 = อาทิตย์) ว่าง = ทุกวัน ติ๊กครบ 7 วันถือเป็นทุกวันและเก็บเป็นค่าว่าง | `normLockDay` `:225-248`; struct `:38` |
| `lock_discount` | แบบเฉพาะ: 0 = ทุกเครื่องในระบบ, 1 = เฉพาะรหัสเครื่อง POS ที่ระบุใน `lock_code_list` | `:185-187`; หน้าจอ `BarcodeDiscountScreens.tsx:366-376` |
| `lock_code_list` | รายการรหัสเครื่อง POS (varchar 1000) | `:191-194`; `BarcodeDiscountScreens.tsx:377-385` |
| `status` | สถานะ 0 หรือ 1 (ติ๊ก = 1) | `:188-190`; `BarcodeDiscountScreens.tsx:386-393` |
| `roworder` | เลขแถวอัตโนมัติ (serial) ใช้เรียงลำดับต่อจาก `priority` | DDL `:5383`; `barcode_discount.go:111` |

คอลัมน์อื่นในตารางตาม DDL (`ignore_sync`, `is_lock_record`, `guid_code`, `create_date_time_now`) ไม่ได้ถูกเขียนหรืออ่านโดยหน้าจอ 2.1.8/2.1.9

## กระบวนการ

- **หน้าจอ 2.1.8 (บาร์โค้ดเดียว):** โหลดจากบาร์โค้ดที่ระบุ แล้วบันทึกแบบ DELETE ทุกแถวของบาร์โค้ดนั้น ตามด้วย INSERT ใหม่จาก 5 กริด (`replace = true`, `BarcodeDiscountScreens.tsx:631`, `barcode_discount.go:310-314`)
- **หน้าจอ 2.1.9 (หลายบาร์โค้ด):** INSERT อย่างเดียว (`replace = false`, `BarcodeDiscountScreens.tsx:785`) ต้องมีทุกบาร์โค้ดอยู่ใน `ic_inventory_barcode` แล้ว ถ้าไม่พบจะแจ้ง "ไม่พบบาร์โค้ด" (`canonicalBarcodes` `barcode_discount.go:336-356`)
- ขอบเขต: บาร์โค้ดไม่เกิน 500 รหัสต่อครั้ง, แถวต่อกริดไม่เกิน 100, จำนวนบาร์โค้ด x แถวรวมไม่เกิน 10,000 (`barcode_discount.go:23-28,158-160,270-279`)
- การบันทึกอยู่ในทรานแซกชันเดียว (timeout 30 วินาที) และล็อกแถวบาร์โค้ดใน `ic_inventory_barcode` ก่อน (`FOR UPDATE`) เพื่อให้การบันทึกบาร์โค้ดเดียวกันซ้อนกันต่อคิว (`barcode_discount.go:285-293,337`)
- DELETE ใช้ `upper(barcode) = ANY(...)` (`barcode_discount.go:312`)
- ตารางนี้อยู่ในรายการเขียนผ่าน `/query/exec` ตาม legacy write allow-list (ADR-0011) (`write_policy_legacy.go:36`) แต่หน้าจอทั้งสองบันทึกผ่านบริการ `BarcodeDiscountSave` โดยตรง

## ข้อควรระวัง

- บรรทัดที่ `discount_word` ว่างจะถูกข้ามเงียบ ไม่ถือเป็นข้อผิดพลาด (`barcode_discount.go:162-165`)
- หน้าจอ 2.1.8 ลบแถวเดิมทั้งหมดของบาร์โค้ดนั้นก่อน จึงบันทึกกริดว่างครบ 5 ชนิดเท่ากับล้างส่วนลดของบาร์โค้ด
- ไม่พบโค้ดที่ลบแถวในตารางนี้เมื่อลบบาร์โค้ดใน [[tbl-ic-inventory-barcode]] หรือลบสินค้า (ค้นใน `item_master.go`, `barcode.go`, `service.go` ไม่พบการอ้างถึงตารางนี้)

## ที่มาในโค้ด

- `backend/internal/application/process/barcode_discount.go:23-28`, `:72`, `:83-128`, `:147-248`, `:253-304`, `:306-356`
- `frontend/account/master/BarcodeDiscountScreens.tsx:27`, `:251-283`, `:366-393`, `:631`, `:785`
- `frontend/account/tabs/screenRegistry.tsx:663-690`
- `backend/internal/domain/query/write_policy_legacy.go:36`
- `scripts/sql/02_data_schema.sql:5380-5399`
