---
title: "สินค้ามี Serial / LOT / วันหมดอายุ ระบบตรวจอะไรให้บ้างตอนบันทึก"
tags: [faq, ic, serial, lot, expire, stock]
aliases: ["Serial Number", "หมายเลข LOT", "วันหมดอายุ", "ic_trans_serial_number", "ic_serial", "lot_number_1", "ic_trans_detail_lot", "use_expire", "ตรวจสอบ Serial มีปัญหา", "ยอดคงเหลือตาม LOT"]
sources: ["backend/internal/application/process/trans.go:979", "backend/internal/application/process/trans.go:583", "backend/internal/application/process/stock_tools.go:581", "backend/internal/application/process/stock_tools.go:187", "backend/internal/application/process/trans_save_rules.go:148", "backend/internal/application/process/trans_save_rules.go:180", "backend/internal/application/process/trans_lot_auto.go:21", "backend/internal/application/process/report_menu_ic.go:1175"]
---
# สินค้ามี Serial / LOT / วันหมดอายุ ระบบตรวจอะไรให้บ้างตอนบันทึก

**ตอบสั้น:** ตรวจน้อยกว่าที่คิด Serial ตรวจแค่ว่าไม่ซ้ำกันในเอกสารเดียวกันและยาวไม่เกิน 50 ตัวอักษร ไม่ได้ตรวจว่า Serial นั้นยังอยู่ในสต็อกหรือไม่ LOT บังคับเฉพาะสินค้าที่ตั้งประเภทต้นทุนเป็น "LOT กำหนดเอง" ส่วนวันหมดอายุบันทึกได้แต่ยังไม่มีการตรวจตอนบันทึก ถ้าต้องการหาความผิดปกติของ Serial ให้ใช้เมนู "ตรวจสอบ Serial มีปัญหา" ภายหลัง

## รายละเอียด
**Serial Number**
- บันทึกใน `ic_trans_serial_number` ทีละ Serial ต่อบรรทัด
- ข้อที่ตรวจตอนบันทึก:
  - Serial เดียวกันซ้ำในเอกสารเดียวกันไม่ได้ ระบบจะขึ้นว่า "Serial Number ... ซ้ำในเอกสาร"
  - ยาวไม่เกิน 50 ตัวอักษร
  - ทั้งเอกสารมีได้ไม่เกิน 20,000 Serial
- ไม่ได้ตรวจว่าจำนวน Serial เท่ากับจำนวนสินค้า
- หลังบันทึกทุกครั้ง ระบบสร้าง `ic_serial` (ทะเบียน Serial) ของสินค้านั้นใหม่จากรายการเคลื่อนไหว
  - สถานะดูจากรายการล่าสุด ถ้าเป็นรับเข้าแปลว่ายังอยู่ (`status` 0) ถ้าไม่ใช่แปลว่าออกไปแล้ว (1)
  - คลัง/ที่เก็บดูจากรายการรับเข้าล่าสุด
  - เอกสารตรวจนับ 76 ไม่นำมาคิด
- เมนู "ตรวจสอบ Serial มีปัญหา" (`menu_ic_serial_analyze`) ไล่ประวัติของแต่ละ Serial แล้วแจ้ง 2 กรณี (อ่านอย่างเดียว ไม่แก้ข้อมูล):
  - "ออกก่อนรับเข้า"
  - ออกจากคลัง/ที่เก็บที่ไม่ตรงกับการรับเข้าล่าสุด

**LOT** (`ic_trans_detail.lot_number_1`)
- เอกสารชุดที่ตรวจ LOT ได้แก่ 12, 14, 16, 36, 44, 46, 48, 54, 56, 58, 60, 66, 68, 72, 310, 311, 316 ถ้าสินค้าตั้ง `cost_type` = 2 แล้วบรรทัดไม่มี LOT จะบันทึกไม่ได้ ระบบขึ้นว่า "ยังไม่บันทึกหมายเลข LOT แบบกำหนดเอง"
- ใบขาย 44 ที่สร้างใหม่: ถ้าไม่ได้ระบุ LOT ระบบเลือกให้จากยอดคงเหลือของแต่ละ LOT ถ้าไม่พอก็แตกบรรทัด (ดู [[faq-cost-type-fifo-lot]])
- LOT ไม่มีผลกับต้นทุน ต้นทุนยังเป็นถัวเฉลี่ยของสินค้าทั้งตัว

**วันหมดอายุ** (`ic_trans_detail.date_expire`)
- บันทึกต่อบรรทัดได้
- คอลัมน์วันหมดอายุจะแสดงเมื่อเปิด `erp_option.use_expire`
- การ์ดสินค้าก็มีสวิตช์ `use_expire` ของตัวเอง ถ้าเปิดไว้ ตัวอักษรของบรรทัดจะเป็นสีม่วงจนกว่าจะกรอกวันหมดอายุ แต่ยังบันทึกได้แม้ไม่ได้กรอก
- ในเมนูตรวจสอบข้อมูล มีข้อหนึ่งที่เปิด `use_expire` ให้อัตโนมัติ กับสินค้าที่มีใบซื้อ 12 ระบุวันหมดอายุไว้

## ข้อควรระวัง
- ขาย Serial ที่ขายไปแล้ว หรือไม่เคยรับเข้า ก็ยังบันทึกได้ จะเห็นปัญหาก็ต่อเมื่อรันเมนู "ตรวจสอบ Serial มีปัญหา"
- รายงาน "ยอดคงเหลือตาม LOT" และเครื่องมือปรับปรุง LOT อ่านจาก `ic_trans_detail_lot` แต่ตารางนี้มีข้อมูลเฉพาะจากเอกสารยอดยกมาสินค้า 54 และเอกสารที่เครื่องมือ LOT สร้างเท่านั้น การบันทึกเอกสารปกติไม่ได้เขียนตารางนี้ (เดิมเป็นหน้าที่ของ cost engine ภาษา Java ที่ไม่ได้รันในระบบนี้) ยอดในรายงานนี้จึงอาจไม่ตรงกับยอดที่ระบบใช้เลือก LOT ในใบขาย ซึ่งอ่านจาก `ic_trans_detail.lot_number_1`
- ระบบเลือก LOT อัตโนมัติตามเลข LOT ไม่ได้เรียงตามวันหมดอายุ
- ระบบยังไม่ได้ตรวจวันหมดอายุตอนบันทึก (มีคอมเมนต์ `ponytail` ใน `lotMessage`)

## ดูเพิ่ม
- [[term-lot-serial-expire]]
- [[scr-modal-serial-lot-stock]]
- [[tbl-ic-serial]]
- [[tbl-ic-trans-detail-lot]]
- [[hist-lessons-serial-lot-shipment]]

## ที่มาในโค้ด
- `backend/internal/application/process/trans.go:979` ตรวจ Serial ซ้ำในเอกสารและความยาวไม่เกิน 50 ตัวอักษร
- `backend/internal/application/process/trans.go:583` สร้าง `ic_serial` ใหม่หลังบันทึก
- `backend/internal/application/process/stock_tools.go:581` `serialRebuildSQL` สถานะและคลังของ Serial (ไม่นับ 76)
- `backend/internal/application/process/stock_tools.go:187` `analyzeSerialMoves` สองกรณีที่ถือว่าผิดปกติ
- `backend/internal/application/process/trans_save_rules.go:148` `lotCheck` ตามชุดเอกสาร `lotFlags`
- `backend/internal/application/process/trans_save_rules.go:180` `lotMessage` บังคับ LOT ของ `cost_type` 2 และคอมเมนต์เรื่องวันหมดอายุที่รอพอร์ต
- `backend/internal/application/process/trans_lot_auto.go:21` คอมเมนต์: บันทึกผ่านเว็บไม่ได้เขียน `ic_trans_detail_lot`
- `backend/internal/application/process/report_menu_ic.go:1175` รายงานยอดคงเหลือตาม LOT อ่านจาก `ic_trans_detail_lot`
