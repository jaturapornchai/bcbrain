---
title: "บทเรียนธุรกรรมอะตอมมิกและ error ที่ถูกกลืน (Atomic Transactions & Swallowed Errors)"
tags: [history, transaction, atomic, error-handling]
aliases: ["ExecBatch atomic", "swallowed error", "docno.Stamp", "credit_used double charge", "WmsBinRebuildSQL", "fmt.Sprintf missing verb"]
sources: ["git:a47413ec", "git:4de91436", "git:239b0997", "git:5e3dbd36", "git:2ab00c67", "git:dc975db9", "backend/internal/adapter/inbound/http/wms/handler.go:505", "backend/internal/platform/docno/docno.go:23", "AGENTS.md rules 9, 20"]
---

## ภาพรวม
งานหลายขั้นที่เคยเขียนทีละ `Exec` และทิ้งค่า `error` ทำให้ได้ข้อมูลครึ่งๆ กลางๆ แต่ตอบสำเร็จ ช่วง 2026-10-21..24 แก้ให้เขียนใน tx เดียว (`ExecBatch` / `pgx.Tx`) คืน error ทุกจุด และให้ค่าที่ derive ได้ (ยอด bin, เครดิต) คำนวณซ้ำได้ผลเดิม

## อาการ
- **A (a47413ec, 5e3dbd36):** WMS ส่งของ (SHIPPED) และบันทึก movement เขียน log ดิบกับยอด bin/order/stop แยกคำสั่ง ถ้าขั้นกลางพังก็ตอบสำเร็จ ยอด bin ลดแบบเพิ่มทีละก้อนและหยุดที่ 0 (`GREATEST(0, ...)`) ตามที่เห็นใน diff
- **B (4de91436):** สั่งซื้อ B2B ซ้ำ (retry) ตัดเครดิตผู้แทนจำหน่ายสองครั้ง เพราะบวก `credit_used + x`; ตามข้อความ commit
- **C (4de91436):** เลขเอกสาร WMS/TMS/RFQ รูปแบบ HHMMSS ชนกันภายในวินาที/นาที
- **D (a47413ec):** บันทึกเอกสาร e-Tax ล้มเหลวแต่ตอบ 200; ปัดภาษีผิด (WHT 1% ของ 14.50 ได้ 0.14 แทน 0.15); สั่งซื้อ/ทริปที่ insert หลักพังแล้วยังตัดเครดิตต่อ; ข้อความ `fmt.Sprintf` ขาด verb เก็บ `...ERP%!(EXTRA string=PCS)` ใน `pack_size_desc` (B9)
- **E (239b0997, 2ab00c67, dc975db9):** frontend เขียน SQL ตรงเข้าตารางนอก transaction ของ backend (THIN-SQL-xx ตามข้อความ commit 239b0997; ยังไม่ได้ตรวจ diff ละเอียด); serial/shipment เคยไม่ถูกเขียนพร้อมเอกสาร

## สาเหตุ (root cause)
- A/D: `_, _ = Exec(...)` แล้วตอบ OK ก่อนรู้ผล ผิด AGENTS.md ข้อ 20
- B: ค่า `credit_used` เป็น state สะสมที่อัปเดตแบบ `+x` จึงไม่ idempotent เมื่อ request ซ้ำ
- C: เลขเอกสารใช้เวลาแค่ HHMMSS ไม่มีส่วนสุ่ม
- E: ขัดกฎ thin-client (AGENTS.md ข้อ 10): เขียนข้อมูลผ่าน `query/exec` จาก browser ทำให้ไม่อยู่ใน tx ของเอกสาร

## วิธีแก้
- A: `AdvanceFulfillment` และ `CreateMovement` รวม movement log + `WmsBinOpeningSQL` + `WmsBinRebuildSQL` + อัปเดต order/stop ไว้ใน `ExecBatch` เดียว คืน error; ยอด bin = OPENING + SUM(movement ที่มีเครื่องหมาย) ไม่ clamp ที่ 0 และเตือนเมื่อติดลบ
- B: ล็อกแถว profile ของผู้แทนแล้วคำนวณ `credit_used`/`credit_available`/`rebate` ใหม่จาก opening + SUM ของ `market_b2b_order` (ไม่รวมสถานะ CANCEL) ทุกครั้ง; คอลัมน์ `credit_used_opening` / `rebate_opening` เก็บยอดตั้งต้นที่ไม่มีแถวออเดอร์อธิบาย
- C: `docno.Stamp(layout)` = เวลา + มิลลิวินาที + แท็ก hex สุ่ม 4 ตัว
- D: etax คำนวณด้วย `big.Rat` ปัดครึ่งออกจากศูนย์ (`etaxAmounts`) และตอบ error ถ้าบันทึกพัง; market/tms หยุดเมื่อ insert หลักพัง; แก้ `%s` ที่หาย
- E: งาน serial/shipment อยู่ใน `saveTransTx`/`deleteTransTx` แล้ว rebuild ใน tx เดียวกัน (ดู [[hist-lessons-serial-lot-shipment]]); งานเขียนจาก frontend ย้ายเข้า backend (เช่น `StockBeginningBalanceScreen.tsx` ลด 361 บรรทัด)

## commit ที่เกี่ยวข้อง
- `a47413ec` — WMS atomic, e-tax big.Rat + คืน error, หยุดเมื่อ insert หลักพัง, แก้ Sprintf
- `4de91436` — เช็กเอาต์ตลาดแบบ atomic + เครดิตแบบ derive, TMS/procure atomic, `docno.Stamp`
- `239b0997` — ย้าย SQL เขียนจาก frontend ไป backend + lockdown `query/exec`
- `5e3dbd36` — rebuild ยอด bin จาก OPENING + movement
- `2ab00c67`, `dc975db9` — serial/shipment บันทึกใน tx เดียวกับเอกสาร

## โค้ดปัจจุบันที่ป้องกัน
- `adapter/inbound/http/wms/handler.go:505-514` ExecBatch ใน AdvanceFulfillment, `:534` CreateMovement, `:1995` WmsBinOpeningSQL, `:2037` WmsBinRebuildSQL
- `tms/handler.go:554,569` และ `procure/handler.go:1382,1398` ใช้ opening + movement log ใน batch
- `market/handler.go:1874` marketDealerOpeningSQL, `:1885` marketDealerBalanceSQL; `:365,387` ข้อความ `(หน่วย %s)`
- `etax/handler.go:461` ตอบ error เมื่อบันทึกพัง, `:1016` etaxAmounts; `platform/docno/docno.go:23` Stamp
- ยังเหลือ `_, _ = ExecBatch` ที่ `wms/handler.go:840,1737` (buildOverview; ดูเป็นข้อมูลสาธิต ยังไม่ได้ตรวจเต็ม)

## บทเรียน / กฎที่ได้
1. ห้ามทิ้ง error ของคำสั่งเขียน; งานหลายขั้นที่ต้องไปด้วยกันรวมเป็น batch เดียวแล้วคืน error
2. ค่าที่ derive ได้ (ยอดคงเหลือ, เครดิต) ให้คำนวณจากแหล่งเดิม ไม่สะสม `+x` เพื่อให้ retry ปลอดภัย (ข้อ 9)
3. เลขเอกสารต้องมีส่วนสุ่ม/มิลลิวินาที ไม่ใช่เวลาระดับวินาที
4. การเขียนที่กระทบเอกสารต้องอยู่ฝั่ง backend ใน tx เดียว
5. รัน `go vet` ทุกครั้ง จับ `Sprintf` ที่ขาด verb ได้

## ดูเพิ่ม
[[adr-0009-query-exec-batch-transactional]] · [[adr-0011-query-exec-write-lockdown]] · [[be-query-write-policy]] · [[std-data-integrity-money-transactions]] · [[hist-lessons-rounding-decimal]] · [[hist-lessons-serial-lot-shipment]]

## ที่มาในโค้ด
- `backend/internal/adapter/inbound/http/wms/handler.go:505,534,1995,2037`
- `backend/internal/adapter/inbound/http/market/handler.go:1874,1885`
- `backend/internal/platform/docno/docno.go:23`
- git:a47413ec, git:4de91436, git:5e3dbd36, git:239b0997
