---
title: "ส่วนลดตามบาร์โค้ด (ic_inventory_barcode_price)"
tags: [tables, ic]
aliases: ["ic_inventory_barcode_price", "ส่วนลดบาร์โค้ด", "ลดพิเศษ", "ลดโปรโมชั่น"]
sources: ["backend/internal/application/process/barcode_discount.go:15", "backend/internal/application/process/barcode_discount.go:105", "backend/internal/application/process/barcode_discount.go:312", "backend/internal/application/process/barcode_discount.go:319"]
---
# ส่วนลดตามบาร์โค้ด (`ic_inventory_barcode_price`)

**หน้าที่:** เก็บเงื่อนไขส่วนลดของแต่ละบาร์โค้ดใน [[tbl-ic-inventory-barcode]] แบ่งเป็น 5 ชนิด (`discount_type` 1-5) ตามหน้าจอ 2.1.8 "ส่วนลดบาร์โค้ด" และ 2.1.9 "ส่วนลดหลายบาร์โค้ด" โค้ดบอกว่าฝั่ง POS อ่านผ่าน `_findPriceClass.cs` ของ C# จึงต้องคงรูปแบบเดิม (`barcode_discount.go:15-21`)

## คอลัมน์ (จาก INSERT ที่ `barcode_discount.go:319-321`)

| column | ความหมาย | หมายเหตุ |
|---|---|---|
| `barcode` | รหัสบาร์โค้ด (ใช้ spelling ตามที่เก็บใน [[tbl-ic-inventory-barcode]]) | เชื่อมด้วย `upper(barcode)` |
| `discount_type` | 1 ลดพิเศษทั่วไป, 2 ลดพิเศษสมาชิก, 3 ลดโปรโมชั่น, 4 ลดสมาชิก, 5 ลดพนักงาน | `barcode_discount.go:19-20`; 1 ชนิดต่อ 1 กริด ห้ามซ้ำ (`:146`) |
| `discount_word` | ข้อความส่วนลด เช่น "5%" หรือ "10" (varchar 25; ว่าง = ข้ามบรรทัด) | `:176`, `:144` |
| `priority` | ลำดับความสำคัญ | `:105-110` |
| `qty_begin`, `qty_end` | ช่วงจำนวนที่ลดได้ | `:105` |
| `date_begin`, `date_end` | ช่วงวันที่ลดได้ (ว่าง = NULL) | `:105` |
| `lock_day` | วันในสัปดาห์ที่ใช้ได้ เช่น "0,1,..6" (0 = อาทิตย์; ว่าง = ทุกวัน) | คอมเมนต์ `barcode_discount.go:35` |
| `lock_discount` | ล็อกส่วนลด (ความหมายละเอียดไม่ชัดจากโค้ดที่อ่าน) | `:105` |
| `lock_code_list` | รายการรหัสที่ล็อก (ไม่ชัดจากโค้ด) | `:105` |
| `status` | สถานะ | `:105` |
| `roworder` | เลขแถวอัตโนมัติ ใช้เรียงลำดับ | `:109` |

## กระบวนการ

- **หน้าจอ 2.1.8 (บาร์โค้ดเดียว):** DELETE ทุกแถวของบาร์โค้ดนั้น แล้ว INSERT ใหม่จาก 5 กริด
- **หน้าจอ 2.1.9 (หลายบาร์โค้ด):** INSERT อย่างเดียว ต้องมีทุกบาร์โค้ดอยู่ใน `ic_inventory_barcode` แล้ว (`barcode_discount.go:251`, `:334-337`)
- ขอบเขต: บาร์โค้ดไม่เกิน 500 รหัส, แถวต่อกริดไม่เกิน 100, INSERT รวมไม่เกิน 10,000 (`barcode_discount.go:23-28`)
- DELETE ใช้ `upper(barcode) = ANY(...)` (`barcode_discount.go:312`)

## ข้อควรระวัง

- บรรทัดที่ `discount_word` ว่างจะถูกข้ามเงียบ ไม่ถือเป็นข้อผิดพลาด

## ที่มาในโค้ด

- `backend/internal/application/process/barcode_discount.go:15-27`, `:82-110`, `:139-176`, `:251`, `:312-321`, `:334-337`
