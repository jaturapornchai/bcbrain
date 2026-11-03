---
title: "สินค้ามี Serial / LOT / วันหมดอายุ ระบบตรวจอะไรให้บ้างตอนบันทึก"
tags: [faq, ic, serial, lot, expire, stock]
aliases: ["Serial Number", "หมายเลข LOT", "วันหมดอายุ", "ic_trans_serial_number", "ic_serial", "lot_number_1", "ic_trans_detail_lot", "use_expire", "ตรวจสอบ Serial มีปัญหา", "ยอดคงเหลือตาม LOT"]
sources: ["backend/internal/application/process/trans.go:979", "backend/internal/application/process/trans.go:583", "backend/internal/application/process/stock_tools.go:599", "backend/internal/application/process/stock_tools.go:187", "backend/internal/application/process/trans_save_rules.go:148", "backend/internal/application/process/trans_save_rules.go:180", "backend/internal/application/process/trans_lot_auto.go:32", "backend/internal/application/process/report_menu_ic.go:1203", "backend/internal/application/process/sysproc_ic_checks_data.go:58", "frontend/account/transaction/transLayouts.ts:171", "frontend/account/transaction/TransItemGrid.tsx:421", "frontend/account/transaction/SerialNumberModal.tsx:180"]
---
# สินค้ามี Serial / LOT / วันหมดอายุ ระบบตรวจอะไรให้บ้างตอนบันทึก

**ตอบสั้น:** ตรวจน้อยกว่าที่คิด Serial ตรวจแค่ว่าไม่ซ้ำกันในเอกสารเดียวกันและยาวไม่เกิน 50 ตัวอักษร ไม่ได้ตรวจว่า Serial นั้นยังอยู่ในสต็อกหรือไม่ LOT บังคับเฉพาะสินค้าที่ตั้งประเภทต้นทุนเป็น "LOT กำหนดเอง" ส่วนวันหมดอายุบันทึกได้แต่ยังไม่มีการตรวจตอนบันทึก ถ้าต้องการหาความผิดปกติของ Serial ให้ใช้เมนู "ตรวจสอบ Serial มีปัญหา" ภายหลัง

## รายละเอียด
**Serial Number**
- บันทึกใน `ic_trans_serial_number` ทีละ Serial ต่อบรรทัด
- ข้อที่ตรวจตอนบันทึก (`trans.go:979-995`):
  - ยาวเกิน 50 ตัวอักษรไม่ได้ ระบบขึ้นว่า "Serial Number ... ยาวเกิน 50 ตัวอักษร" (`:983-984`)
  - Serial เดียวกันของสินค้าเดียวกันซ้ำในเอกสารเดียวกันไม่ได้ ระบบขึ้นว่า "Serial Number ... ของสินค้า ... ซ้ำในเอกสาร" (`:986-988`)
  - ทั้งเอกสารมีได้ไม่เกิน 20,000 Serial (`sbMaxSerials` `stock_beginning.go:26`, `trans.go:994-995`)
- ไม่ได้ตรวจว่าจำนวน Serial เท่ากับจำนวนสินค้า หน้าต่าง Serial แสดงตัวเลขที่ระบุแล้วเทียบกับจำนวนในแถวบิลเป็นสีให้ดูเท่านั้น (`SerialNumberModal.tsx:170-186`) ปุ่มบันทึกไม่ถูกบล็อก (`:119`)
- หลังบันทึกทุกครั้ง ระบบสร้าง `ic_serial` (ทะเบียน Serial) ใหม่ เฉพาะสินค้าที่เอกสารใหม่หรือเอกสารเดิมก่อนแก้มี Serial (`trans.go:583-587`, `rebuildSerialTx` `stock_tools.go:625`)
  - สถานะดูจากรายการเคลื่อนไหวล่าสุด ถ้าเป็นรับเข้า (`calc_flag` 1) แปลว่ายังอยู่ (`status` 0) ถ้าไม่ใช่แปลว่าออกไปแล้ว (1) (`stock_tools.go:599-604`)
  - คลัง/ที่เก็บดูจากรายการรับเข้าล่าสุด (`:605-611`)
  - รายการที่นับเป็นการเคลื่อนไหวคือเอกสารตาม `serialMoveFlags` (`:576-579`) เอกสารตรวจนับ 76 ไม่นำมาคิด
  - Serial ที่ไม่มีรายการใช้งานเหลือ (เอกสารถูกยกเลิก) จะถูกลบออกจาก `ic_serial`
- เมนู "ตรวจสอบ Serial มีปัญหา" (`menu_ic_serial_analyze`, `screenRegistry.tsx:458`) ไล่ประวัติของแต่ละ Serial ตามวันที่ แล้วแจ้ง 2 กรณี (อ่านอย่างเดียว ไม่แก้ข้อมูล; ข้ามเอกสาร 144 และ 76 และเอกสารที่ยกเลิก; แสดงสูงสุด 5,000 แถว) (`serialAnalyzeMaxRows` `stock_tools.go:182`, `analyzeSerialMoves` `:187-216`, `SerialAnalyze` `:219-251`):
  - "ออกก่อนรับเข้า (ไม่มีรายการรับเข้ามาก่อน)"
  - ออกจากคลัง/ที่เก็บที่ไม่ตรงกับการรับเข้าล่าสุด

**LOT** (`ic_trans_detail.lot_number_1`)
- เอกสารชุดที่ตรวจ LOT ได้แก่ 12, 14, 16, 36, 44, 46, 48, 54, 56, 58, 60, 66, 68, 72, 310, 311, 316 (`lotFlags` `trans_save_rules.go:54`) ยกเว้นเอกสาร 46 ที่ประเภทสอบถามเป็น 1 หรือ 2 (`:148`) ถ้าสินค้าตั้ง `cost_type` = 2 แล้วบรรทัดไม่มี LOT จะบันทึกไม่ได้ ระบบขึ้นว่า "ยังไม่บันทึกหมายเลข LOT แบบกำหนดเอง" (`lotMessage` `:180-188`)
- ใบขาย 44 ที่สร้างใหม่: ถ้าเปิด `erp_option.find_lot_auto` และไม่ได้ระบุ LOT ระบบเลือกให้จากยอดคงเหลือของแต่ละ LOT ถ้าไม่พอก็แตกบรรทัด (`autoLots` `trans_lot_auto.go:32-50`, ดู [[faq-cost-type-fifo-lot]])
- LOT ไม่มีผลกับต้นทุน ต้นทุนยังเป็นถัวเฉลี่ยของสินค้าทั้งตัว

**วันหมดอายุ** (`ic_trans_detail.date_expire`)
- บันทึกต่อบรรทัดได้ (รับค่า `dateExpire` เป็นวันที่ว่างได้ `trans.go:1063`)
- คอลัมน์วันหมดอายุในตารางรายการแสดงเมื่อเปิด `erp_option.use_expire` และเป็นเอกสารกลุ่ม 12, 14, 310, 315, 316, 48, 54, 76, 66, 68, 60, 56, 58, 72, 501, 502, 503, 509 (`transLayouts.ts:171`, `useExpireColumn.ts:22`)
- การ์ดสินค้ามีสวิตช์ `use_expire` ของตัวเอง (`ItemScreen.tsx:2768`) ถ้าเปิดไว้ ตัวอักษรของบรรทัดจะเป็นสีม่วงจนกว่าจะกรอกวันหมดอายุ (`TransItemGrid.tsx:421`; ใบขาย 44 และ 144 ซ่อนคอลัมน์แต่ยังระบายสี `transLayouts.ts:173`) แต่ยังบันทึกได้แม้ไม่ได้กรอก
- ในเมนูตรวจสอบข้อมูลสินค้า มีรายการ "ข้อมูลสินค้า ที่มีการบันทึกวันหมดอายุ แต่ยังไม่ได้กำหนด ให้ใช้ระบบหมดอายุ" ที่สั่งซ่อมให้ `use_expire = 1` กับสินค้าที่มีใบซื้อ 12 ระบุวันหมดอายุไว้ ไม่ได้อยู่ในกลุ่มที่ทำอัตโนมัติ (`auto: false`) ผู้ใช้ต้องเลือกซ่อมเอง (`sysproc_ic_checks_data.go:58-60`)

## ข้อควรระวัง
- ขาย Serial ที่ขายไปแล้ว หรือไม่เคยรับเข้า ก็ยังบันทึกได้ จะเห็นปัญหาก็ต่อเมื่อรันเมนู "ตรวจสอบ Serial มีปัญหา"
- รายงาน "ยอดคงเหลือตาม LOT" (`icLotBalanceSpec` `report_menu_ic.go:1203`) และเครื่องมือปรับปรุง LOT อ่านจาก `ic_trans_detail_lot` แต่ตารางนี้มีข้อมูลเฉพาะจากเอกสารยอดยกมาสินค้า 54 (`stock_beginning.go:551`) และเอกสารที่เครื่องมือปรับปรุง LOT สร้าง (`stock_lot.go:229`) เท่านั้น การบันทึกเอกสารปกติไม่ได้เขียนตารางนี้ ยอดในรายงานนี้จึงอาจไม่ตรงกับยอดที่ระบบใช้เลือก LOT ในใบขาย ซึ่งอ่านจาก `ic_trans_detail.lot_number_1` (`trans_lot_auto.go:21-23`)
- ระบบเลือก LOT อัตโนมัติตามเลข LOT ไม่ได้เรียงตามวันหมดอายุ
- ระบบยังไม่ได้ตรวจวันหมดอายุตอนบันทึก (คอมเมนต์ `ponytail` ที่ `lotMessage` `trans_save_rules.go:179` ระบุว่าการตรวจรอจนกว่าตารางรายการจะส่ง `dateExpire`)

## ดูเพิ่ม
- [[term-lot-serial-expire]]
- [[scr-modal-serial-lot-stock]]
- [[tbl-ic-serial]]
- [[tbl-ic-trans-detail-lot]]
- [[hist-lessons-serial-lot-shipment]]

## ที่มาในโค้ด
- `backend/internal/application/process/trans.go:979-995` ตรวจ Serial ซ้ำในเอกสาร ความยาวไม่เกิน 50 ตัวอักษร และจำนวนไม่เกินเพดาน; `:583-587` สร้าง `ic_serial` ใหม่หลังบันทึก; `:1063` อ่าน `dateExpire`
- `backend/internal/application/process/stock_tools.go:576-611` `serialMoveFlags` และ SQL สถานะ/คลังของ Serial (ไม่นับ 76); `:625` `rebuildSerialTx`
- `backend/internal/application/process/stock_tools.go:182-251` `analyzeSerialMoves` สองกรณีที่ถือว่าผิดปกติ และ `SerialAnalyze`
- `backend/internal/application/process/trans_save_rules.go:54` `lotFlags`, `:148` `lotCheck`, `:178-188` `lotMessage` บังคับ LOT ของ `cost_type` 2 และคอมเมนต์เรื่องวันหมดอายุที่ยังไม่ตรวจ
- `backend/internal/application/process/trans_lot_auto.go:21-23`, `:32-50` เลือก LOT อัตโนมัติ (`find_lot_auto`) และคอมเมนต์: บันทึกผ่านเว็บไม่ได้เขียน `ic_trans_detail_lot`
- `backend/internal/application/process/stock_beginning.go:26`, `:551`; `backend/internal/application/process/stock_lot.go:229` ผู้เขียน `ic_trans_detail_lot`
- `backend/internal/application/process/report_menu_ic.go:1203` รายงานยอดคงเหลือตาม LOT อ่านจาก `ic_trans_detail_lot`
- `backend/internal/application/process/sysproc_ic_checks_data.go:58-60` รายการตรวจสินค้าเรื่อง `use_expire`
- `frontend/account/transaction/transLayouts.ts:171-173`, `TransItemGrid.tsx:421`, `useExpireColumn.ts:22`, `SerialNumberModal.tsx:119`, `:170-186`, `frontend/account/master/ItemScreen.tsx:2768`, `frontend/account/tabs/screenRegistry.tsx:458`
