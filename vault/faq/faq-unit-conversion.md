---
title: "ขายเป็นกล่อง/โหล แต่สต็อกนับเป็นชิ้น ระบบแปลงหน่วยยังไง"
tags: [faq, ic, unit, stock]
aliases: ["แปลงหน่วยนับ", "หลายหน่วยนับ", "หน่วยนับขนาน", "stand_value", "divide_value", "ic_unit_use", "unit_type", "ไม่พบหน่วยนับ", "ตัวตั้ง ตัวหาร"]
sources: ["backend/internal/application/process/trans_lines_check.go:129", "backend/internal/application/process/trans_lines_check.go:181", "backend/internal/application/process/trans_lines_check.go:191", "backend/internal/application/process/service.go:214", "backend/internal/application/process/service.go:619", "backend/internal/application/process/service.go:1066", "backend/internal/application/process/report_menu_ic.go:886", "frontend/account/process/SystemProcessWorkbenchScreen.tsx:1495"]
---
# ขายเป็นกล่อง/โหล แต่สต็อกนับเป็นชิ้น ระบบแปลงหน่วยยังไง

**ตอบสั้น:** แต่ละหน่วยนับของสินค้ามีตัวตั้ง (`stand_value`) และตัวหาร (`divide_value`) เก็บไว้ใน `ic_unit_use` เมื่อบันทึกเอกสาร ระบบจะคัดลอกสองค่านี้ไปไว้ในบรรทัด แล้วคิดสต็อกและต้นทุนจาก จำนวนหน่วยมาตรฐาน = จำนวน × ตัวตั้ง ÷ ตัวหาร เช่น กล่องละ 12 ชิ้น ให้ตั้งตัวตั้ง 12 ตัวหาร 1 ถ้าขาย 2 กล่อง สต็อกจะลด 24 ชิ้น

## รายละเอียด
**ประเภทหน่วยนับของสินค้า** (`ic_inventory.unit_type`)
- 0 = หน่วยนับเดี่ยว
- 1 = หลายหน่วยนับ
- 2 = หน่วยนับขนาน
- 3 = หลายหน่วยนับ + หน่วยนับขนาน

**ตอนบันทึก** ทุกบรรทัดจะถูกตรวจกับ `ic_unit_use`
- ถ้าพบหน่วยนับนั้น จะใช้ `stand_value` / `divide_value` / `ratio` ของหน่วยนั้น
- ถ้าเป็นหน่วยมาตรฐาน (`unit_standard`) แต่ไม่มีแถวใน `ic_unit_use` จะใช้ 1/1
- ถ้าไม่พบเลย จะบันทึกไม่ได้ และขึ้นข้อความ "ไม่พบหน่วยนับ ... ของสินค้า ..."

**หน่วยนับขนาน (unit_type 2/3)** เป็นจำนวนอีกชุดที่ไม่ได้แปลงจากหน่วยหลัก เช่น นับเป็นชิ้นและกิโลกรัมไปพร้อมกัน
- ต้องระบุหน่วยขนาน (`unit_code_2`) ถ้าไม่ระบุ ระบบใช้หน่วยแรกจาก `ic_opposite_unit`
- ถ้าบรรทัดมีจำนวนหลัก ต้องมีจำนวนหน่วยขนาน (`qty_2`) ด้วย
- ยอดคงเหลือหน่วยขนานเก็บที่ `ic_inventory.balance_qty_2` (ผลรวม `qty_2` × ทิศทางสต็อก) ไม่นำไปใช้คิดต้นทุน

**ต้นทุน:** ถัวเฉลี่ยคิดจากจำนวนหน่วยมาตรฐาน `ic_inventory.average_cost` จึงเป็นต้นทุนต่อหน่วยมาตรฐาน (ดู [[faq-moving-average-cost]]) ส่วนราคาขายหาตามรหัสหน่วยที่ใช้ในบรรทัดโดยตรง ถ้าไม่ได้ตั้งราคาของหน่วยนั้น ระบบจะไม่แปลงจากราคาของหน่วยอื่น (ดู [[faq-price-discount-source]])

## ข้อควรระวัง
- ถ้าแก้ตัวตั้ง/ตัวหารของหน่วยนับหลังจากใช้งานแล้ว เอกสารเก่าจะยังใช้ค่าเดิมที่คัดลอกไว้ จนกว่าจะรันเมนูคำนวณสต็อกใหม่ ซึ่งช่อง "ตรวจสอบและปรับปรุง อัตราส่วนหน่วยนับ" (`UpdateUnitRatio`) ถูกติ๊กไว้ตั้งแต่ต้น ระบบจะเขียนค่าใหม่ทับทุกบรรทัดของทุกเอกสารโดยไม่จำกัดวันที่ ทำให้จำนวนและต้นทุนย้อนหลังเปลี่ยน (ดู [[faq-stock-rebuild]])
- เมื่อคำนวณสต็อกใหม่ สินค้าประเภท 0/2 จะถูกตั้งตัวตั้ง/ตัวหารเป็น 1 ทุกบรรทัด ไม่ว่าบรรทัดนั้นใช้หน่วยไหน ส่วนประเภท 1/3 จะคัดลอกค่าจาก `ic_unit_use`
- ตัวตั้งหรือตัวหารที่เป็น 0 หรือว่าง จะถูกแก้เป็น 1 ตอนคำนวณสต็อกใหม่

## ดูเพิ่ม
- [[term-unit-ratio]]
- [[std-parallel-unit-and-ref-import]]
- [[scr-unit]]
- [[tbl-ic-unit-use]]
- [[tbl-ic-opposite-unit]]

## ที่มาในโค้ด
- `backend/internal/application/process/trans_lines_check.go:129` โหลด `stand_value` / `divide_value` / `ratio` จาก `ic_unit_use`
- `backend/internal/application/process/trans_lines_check.go:181` ใช้หน่วยนับของบรรทัด ถ้าไม่พบ "ไม่พบหน่วยนับ"
- `backend/internal/application/process/trans_lines_check.go:191` บังคับหน่วยขนานและ `qty_2` เมื่อเป็น unit_type 2/3
- `backend/internal/application/process/service.go:214` จำนวนหน่วยมาตรฐาน = จำนวน × ตัวตั้ง ÷ ตัวหาร
- `backend/internal/application/process/service.go:619` `updateUnitRatioDetailTx` เขียนตัวตั้ง/ตัวหารทับเอกสารเก่า
- `backend/internal/application/process/service.go:1066` คำนวณ `balance_qty` และ `balance_qty_2`
- `backend/internal/application/process/report_menu_ic.go:886` ชื่อประเภทหน่วยนับ 0–3
- `frontend/account/process/SystemProcessWorkbenchScreen.tsx:1495` ช่อง "ตรวจสอบและปรับปรุง อัตราส่วนหน่วยนับ" ติ๊กไว้ตั้งแต่ต้น
