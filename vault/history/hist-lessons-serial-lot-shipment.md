---
title: "บทเรียน Serial / Lot / ข้อมูลขนส่ง (Serial, Lot & Shipment Persistence)"
tags: [history, lesson, serial, lot, shipment]
aliases: ["ic_serial rebuild", "ic_trans_serial_number", "ic_trans_shipment", "find_lot_auto", "rebuildSerialTx", "is_serial_number"]
sources: ["backend/internal/application/process/stock_tools.go:625", "backend/internal/application/process/stock_tools.go:562", "backend/internal/application/process/stock_tools.go:581", "backend/internal/application/process/trans.go:421", "backend/internal/application/process/trans.go:439", "backend/internal/application/process/trans.go:532", "backend/internal/application/process/trans.go:583", "backend/internal/application/process/trans.go:979", "backend/internal/application/process/trans.go:1187", "backend/internal/application/process/trans_lot_auto.go:32", "backend/internal/application/process/stock_serial_test.go:56", "backend/internal/application/process/trans_line_extra_test.go:72", "backend/internal/application/process/trans_line_extra_test.go:133", "AGENTS.md:50"]
---
# บทเรียน Serial / Lot / ข้อมูลขนส่ง

ข้อมูลที่ผูกกับแถวสินค้า (เลข serial, lot, ข้อมูลขนส่ง) กรอกบนจอได้ก่อนที่ backend จะเก็บจริง ถ้าตารางลูกไม่ถูกเขียน/ลบพร้อมเอกสาร และตารางสรุป `ic_serial` ไม่ถูก rebuild ค่าที่ผู้ใช้กรอกจะหาย หรือเลข serial ที่ลบเอกสารไปแล้วยังค้างเป็น "มีสต็อก"

## อะไรพังได้
- **serial ไม่ถูกบันทึก:** ถ้า `TransLine` ไม่มีช่อง `Serials` เลขที่คีย์ใน `SerialNumberModal` ไม่ถึงฐานข้อมูล
- **ลบแล้วเศษค้าง:** ลบหรือแก้เอกสารแล้ว `ic_trans_serial_number` และ `ic_serial` ไม่ตาม สถานะ/คลังของ serial เพี้ยน
- **rebuild ไม่ idempotent:** `ic_serial` มี unique index `(ic_code, serial_number)` ถ้า serial เดียวมีหลายบรรทัดที่ข้อมูลไม่ตรงกันและ insert แบบ DISTINCT ธรรมดา จะชน key หรือได้ผลต่างกันทุกครั้งที่รัน
- **ข้อมูลขนส่งหาย:** `ic_trans_shipment` ที่ไม่ถูกเขียนใน tx เดียวกับเอกสาร จะหายตอนบันทึกหรือค้างตอนลบ
- **lot ว่าง:** สินค้าที่คุมด้วย lot ในจอขาย (flag 44) ถ้าผู้ใช้ไม่เลือก lot เอกสารจะถูกบล็อกตอนบันทึก (`lotMessage` ที่ `trans_save_rules.go:180`) จึงต้องเติม lot ให้อัตโนมัติฝั่ง server

## โค้ดป้องกันไว้อย่างไร
| ด่าน | ที่อยู่ | ทำอะไร |
|---|---|---|
| รับ serial จากจอ | `trans.go:979` | วนอ่าน `l.Serials` ตัดช่องว่าง จำกัด 50 ตัวอักษร แล้วเก็บ `serialItems` ของเอกสาร |
| บันทึกข้อมูลขนส่ง | `trans.go:1187` | insert `ic_trans_shipment` ในชุดคำสั่งบันทึกเอกสาร จำกัดความยาวฟิลด์ก่อน |
| ลบพร้อมเอกสาร (ลบเอกสาร) | `trans.go:421-422` | ลบ `ic_trans_serial_number` และ `ic_trans_shipment` ใน tx เดียวกับ `ic_trans` |
| ลบก่อนเขียนใหม่ (แก้เอกสาร) | `trans.go:532-537` | ลบ serial/shipment เดิมของเอกสารก่อน insert ชุดใหม่ |
| rebuild หลังลบ/แก้ | `trans.go:439`, `:583` | `rebuildSerialTx` ทุกสินค้าที่เกี่ยวข้อง (ทั้งชุดเก่าและใหม่ เรียง `uniqueSorted`) ก่อนจบ tx |
| rebuild หลังบันทึกสินค้า | `stock_tools.go:562` ใน `ItemSaved` | ปรับ `ic_serial` ของสินค้านั้นเมื่อแก้การ์ดสินค้า |
| rebuild ตารางสรุป | `stock_tools.go:581` `serialRebuildSQL`, `:625` `rebuildSerialTx` | จำกัดทุกคำสั่งที่ `ic_code` เดียว ใช้ `DISTINCT ON (ic_code, serial_number)` เรียงตามวันที่-เวลา-`roworder` เพื่อให้รันซ้ำได้ผลเดิม |
| lot อัตโนมัติ | `trans_lot_auto.go:32` `autoLots` (เปิดด้วย `erp_option.find_lot_auto`) | เฉพาะ flag 44 ใบใหม่: เติม lot แรกที่ยอดคงเหลือพอ และแตกบรรทัดใหม่เมื่อ lot เดียวไม่พอ |
| เทสต์ | `stock_serial_test.go:56` `TestRebuildSerialIntegration` (ต้องตั้ง `SERIAL_IT_DB`); `trans_line_extra_test.go:72` `TestTransSerialSave`, `:133` `TestTransShipmentSave` | ตรวจ rebuild บนฐานจริงแบบ rollback และตรวจว่า serial/ขนส่งถูกสร้างเป็นคำสั่งบันทึก |

## กฎที่ต้องจำ
1. ตารางลูกของเอกสาร (serial, shipment) เขียนและลบใน tx เดียวกับ `ic_trans` แล้ว rebuild ตารางสรุปก่อนจบ tx
2. rebuild ของข้อมูล derived ต้อง idempotent: จำกัดขอบเขตต่อสินค้า มี tiebreak ชัดเจน รันซ้ำแล้วไม่เปลี่ยน (กฎข้อ 9 ใน `AGENTS.md:50`: ผลคำนวณซ้ำได้ตรงกัน)
3. ฟิลด์ที่ UI เก็บต้องมีช่องใน struct ฝั่ง backend ถ้าไม่มีช่อง ค่าจะหายเงียบๆ
4. เทสต์ที่แตะฐานจริงต้องรันใน tx ที่ rollback (ข้ามเองเมื่อไม่ตั้งตัวแปรฐานทดสอบ)

## ที่มาในโค้ด
- `backend/internal/application/process/stock_tools.go:562,581,625` rebuild `ic_serial`
- `backend/internal/application/process/trans.go:421-422,439,532-537,583,979,1187` serial/shipment ในบันทึกและลบ
- `backend/internal/application/process/trans_lot_auto.go:32` lot อัตโนมัติ
- ดูเพิ่ม: [[proc-stock-tools]] · [[acc-inventory-stock-rebuild]] · [[acc-transaction-save-flow]] · [[acc-stock-special-docs]] · [[hist-lessons-atomic-transactions-swallowed-errors]] · [[hist-lessons-doc-ref-docflow]]
