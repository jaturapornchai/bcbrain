---
title: "บทเรียน Serial / Lot / ข้อมูลขนส่ง (Serial, Lot & Shipment Persistence)"
tags: [history, serial, lot, shipment]
aliases: ["ic_serial rebuild", "ic_trans_serial_number", "ic_trans_shipment", "find_lot_auto", "is_serial_number"]
sources: ["git:ebe66efd", "git:72d402f3", "git:2ab00c67", "git:dc975db9", "git:b002e065", "git:d19d3695", "backend/internal/application/process/stock_tools.go:625", "backend/internal/application/process/trans.go:584", "docs/HANDOFF_BCCM_PARITY_2026-10-22.md:77"]
---

## ภาพรวม
ข้อมูลที่ผูกกับแถวสินค้า (เลข serial, lot, ข้อมูลขนส่ง) ถูกกรอกบนจอได้ก่อนที่ backend จะเก็บจริง ช่วง 2026-10-19..24 พบว่าค่าที่ผู้ใช้กรอกหายตอนบันทึก และตาราง derived `ic_serial` ไม่ถูกสร้างใหม่ตามหลังบันทึก/ลบ แก้โดยบันทึกทุกอย่างใน tx เดียวกับเอกสารแล้ว rebuild ราย item

## อาการ
- **A (ebe66efd):** บันทึกการ์ดสินค้าแล้ว `ic_serial` ไม่ถูกสร้างใหม่ (คอมเมนต์เดิมใน `ItemSaved` ระบุว่ายังไม่มี Go port ตาม diff)
- **B (2ab00c67):** serial ที่คีย์ใน `SerialNumberModal` ไม่ถูกบันทึก ลบเอกสารแล้ว `ic_trans_serial_number` / `ic_serial` ค้าง (commit ไม่มีเนื้อความ; อนุมานจาก diff: เพิ่ม `TransLine.Serials`, ส่วน insert/delete/rebuild ใน `trans.go` +124)
- **C (dc975db9):** ข้อมูลขนส่งของเอกสาร (`ic_trans_shipment`) ไม่ถูกบันทึกและไม่ถูกโหลดกลับ (จากชื่อ commit และ diff ที่เพิ่ม insert +23 บรรทัด)
- **D (b002e065, 72d402f3):** จอขาย 44 ไม่เลือก lot อัตโนมัติ; จอตรวจนับสต็อก recheck/ref/lot และจอตรวจนับ serial มีปัญหา autofocus/ราคา (ตามชื่อ commit; ยังไม่ได้ตรวจ diff ละเอียด)
- **E (d19d3695):** แถวสินค้าไม่มี `is_serial_number`, `mfd_date`, `mfn_name`, หน่วยเทียบ ทำให้ค่าหายตอนดึงจากเอกสารอ้างอิง

## สาเหตุ (root cause)
- A: C# `_icMain.cs:808` เรียก `_docFlow._processAll` หลังบันทึกสินค้า แต่ Go ยังไม่พอร์ตขั้น `_serialNumberQueryList`
- B/C: contract `TransLine` ไม่มีช่อง serial/ขนส่ง ส่วน save/delete ไม่มีคำสั่งเขียน-ลบตารางเหล่านี้ ตารางลูกจึงไม่ตามเอกสาร
- E: เป็น R1 contract change ใน handoff §7: C# บันทึกฟิลด์เหล่านี้ แต่ `TransLine` ไม่มี

## วิธีแก้
- A: พอร์ต `rebuildSerialTx` ทำงานใน tx ของ `ItemSaved` และจำกัดทุกขั้นที่ item code เดียว (C# รัน 1-5 ทั้งระบบ) ใช้ `DISTINCT ON (ic_code, serial_number)` เอาบรรทัดเก่าสุดก่อน กัน PK ชน และใช้ `roworder` ตัดสินเมื่อวันที่-เวลาเท่ากันเพื่อให้รันซ้ำได้ผลเดิม
- B: `saveTransTx` insert serial (72 สร้างแถวออก + แถวรับเข้า 70 อัตโนมัติ), `deleteTransTx` ลบแล้ว rebuild ทุก item ทั้งเก่า/ใหม่
- C: insert `ic_trans_shipment` ใน `saveTransTx` และโหลดกลับขึ้นจอ; โค้ดปัจจุบันลบแถวนี้พร้อมเอกสาร (ไม่ยืนยันว่า commit นี้เป็นผู้เพิ่มส่วนลบ)
- D: `autoLots` เติม lot ให้บรรทัดจอขาย 44 เอกสารใหม่ฝั่ง server
- E: เพิ่มฟิลด์ใน `TransLine` และเปิดคอลัมน์ตาม erp_option gate

## commit ที่เกี่ยวข้อง
- `ebe66efd` — rebuild `ic_serial` ตอนบันทึกสินค้า + เทสต์ `SERIAL_IT_DB`
- `72d402f3` — ตรวจนับสต็อก recheck/ref/lot (#92), นับ serial (#93)
- `2ab00c67` — บันทึก/โหลด/rebuild serial ใน save/delete
- `dc975db9` — บันทึก/โหลด shipment
- `b002e065` — `find_lot_auto`
- `d19d3695` — ฟิลด์แถวเพิ่ม (serial, mfd, หน่วยเทียบ)

## โค้ดปัจจุบันที่ป้องกัน
- `process/stock_tools.go:625` rebuildSerialTx (วน `serialRebuildSQL` `:581`; เงื่อนไข flag ที่นับเป็นสต็อก `serialMoveFlags` `:576`); เรียกที่ `:562`, `stock_beginning.go:477`
- `process/trans.go:421-422, 532-535` ลบ `ic_trans_serial_number` และ `ic_trans_shipment` พร้อมเอกสาร; `:439`, `:584` rebuild ทุก item ที่เกี่ยว
- `trans.go:979` วน `l.Serials`; `:725` insertTransSerialSQL; `:1187` insert `ic_trans_shipment`
- `trans_lot_auto.go:32` autoLots; `trans_grid.go:364` เติม `IsSerialNumber` จาก `ic_serial_no`
- เทสต์: `TestRebuildSerialIntegration` (ต้องตั้ง `SERIAL_IT_DB`, rollback), `trans_line_extra_test.go`

## บทเรียน / กฎที่ได้
1. ตารางลูกของเอกสาร (serial, shipment) ต้องเขียนและลบใน tx เดียวกับ `ic_trans` และ rebuild ตารางสรุปท้าย tx
2. rebuild แบบ derived ต้อง idempotent: จำกัดขอบเขตต่อ item, `DISTINCT ON` + tiebreak, รันซ้ำแล้วไม่เปลี่ยน (AGENTS.md ข้อ 9)
3. ฟิลด์ที่ UI เก็บต้องเทียบ struct ฝั่ง backend ทุกครั้ง ถ้าไม่มีช่อง = ค่าหาย
4. ใช้เทสต์ DB ที่ rollback ได้เทียบกับ SQL ต้นฉบับ C# แบบคำต่อคำ
5. รายการเปิด: handoff บรรทัด 77 ยังมีข้อความ "set is_serial_number" (ไม่อธิบายต่อ; ยังไม่ได้ตรวจว่าเป็นงานอะไร)

## ดูเพิ่ม
[[proc-stock-tools]] · [[acc-inventory-stock-rebuild]] · [[acc-transaction-save-flow]] · [[acc-stock-special-docs]] · [[hist-lessons-atomic-transactions-swallowed-errors]] · [[hist-lessons-doc-ref-docflow]]

## ที่มาในโค้ด
- `backend/internal/application/process/stock_tools.go:576,581,625`
- `backend/internal/application/process/trans.go:421,439,584,979,1187`
- `backend/internal/application/process/trans_lot_auto.go:32`
- `backend/internal/application/process/trans_grid.go:364`
- `docs/HANDOFF_BCCM_PARITY_2026-10-22.md:73,77`
- git:ebe66efd, git:2ab00c67, git:dc975db9, git:d19d3695
