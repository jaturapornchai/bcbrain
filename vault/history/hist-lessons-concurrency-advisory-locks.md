---
title: "บทเรียนบั๊กการทำงานพร้อมกันและ advisory lock (Concurrency & Advisory Locks)"
tags: [history, concurrency, lock, deadlock]
aliases: ["deadlock 40P01", "pg_advisory_xact_lock", "RebuildGL lock", "docno collision"]
sources: ["git:4341ae81", "git:ac839a65", "git:4de91436", "git:5e3dbd36", "git:acba317c", "backend/internal/application/process/service.go:992", "backend/internal/application/process/service.go:1365"]
---

## ภาพรวม
เมื่อหลายคำขอแตะข้อมูลชุดเดียวกัน (สินค้าเดียวกัน, ช่วงวันที่ GL เดียวกัน, ตะกร้าของตัวแทนเดียวกัน) ระบบเคยได้ deadlock ดิบ, รายการบัญชีซ้ำ หรือเลขที่ชนกัน วิธีแก้หลักคือ `pg_advisory_xact_lock` ที่ล็อกตามลำดับคงที่

## อาการ
- **C1 สต็อกรายสินค้า (4341ae81):** รายงาน UAT r3f ใน handoff ข้อ B1: บันทึก ~10 ใบที่มีสินค้าเดียวกันพร้อมกัน ได้ HTTP 400 ข้อความ SQL ดิบ `deadlock detected` (SQLSTATE 40P01)
- **C2 RebuildGL กับ save (ac839a65):** save ที่ลงบัญชีระหว่าง DELETE กับ INSERT ของ rebuild ช่วงวันที่ ทำให้เหลือ journal 2 ชุด
- **C3 เลขที่เอกสารโมดูลแดชบอร์ด (4de91436):** เลขแบบเวลา `HHMMSS` ซ้ำเมื่อสองคำขอเข้าวินาทีเดียวกัน ได้ order_no/trip_no/move_doc_no ซ้ำ; checkout ของตัวแทนเดียวกันที่ retry ถูกหักเครดิตสองรอบ
- **C4 สต็อกช่องเก็บ WMS (5e3dbd36):** ตามข้อความ commit: ต้อง rebuild ยอดช่องให้ได้ผลเดิมทุกครั้ง และเตือนเมื่อยอดติดลบ

## สาเหตุ (root cause)
- **C1:** save ที่เปลี่ยนต้นทุนอัปเดตแถว `ic_trans_detail` ของเอกสารอื่นในสินค้าเดียวกัน สองธุรกรรมถือแถวสลับลำดับกัน (คอมเมนต์ `service.go:989`)
- **C2:** READ COMMITTED ให้ทุกคำสั่งเห็น snapshot ของตัวเอง; ล็อกต่อเอกสารไม่พอเพราะ rebuild ช่วงต้องล็อกทุกเอกสาร (ทะลุ `max_locks_per_transaction`) จึงใช้คีย์เดียว `glRebuildLock`
- **C3:** รูปแบบเลขอิงเวลาละเอียดแค่วินาที; ยอดเครดิตเดิมคิดจาก `credit_used + x` ซึ่ง retry นับซ้ำ
- **C4:** ไม่มีแถว OPENING และยอดถูกครอบด้วย `GREATEST(0, ...)` (อนุมานจากคอมเมนต์ใน diff)

## วิธีแก้
- **C1:** `lockStockItems` ล็อก shared ที่ `stockRebuildLock` แล้วล็อกรายสินค้า `ic_stock:<code>` ตามลำดับ sorted ก่อนแก้ `ic_trans_detail`; `RebuildStock` ทั้งฐานล็อกแบบ exclusive
- **C2:** `RebuildGL` ล็อก exclusive; save/อนุมัติ/ยกเลิก/ขายสินทรัพย์ล็อก shared (`lockGLShared`) หลังล็อกเอกสารและก่อนเขียน GL; ขายสินทรัพย์ล็อก `asset-sale` ก่อน แล้วค่อย shared GL เพราะ rebuild ไม่เคยถือ `asset-sale` จึงไม่ deadlock
- **C3:** `docno.Stamp(layout)` ต่อมิลลิวินาทีและแท็กสุ่ม 4 หลัก; checkout ล็อกแถวตัวแทนก่อนแล้วคำนวณ `credit_used` ใหม่จากยอดตั้งต้น + SUM ใบสั่ง และรวมทุก insert ใน ExecBatch เดียว
- **C4:** ไม่มีแถว OPENING และยอดถูกครอบด้วย `GREATEST(0, ...)` (อนุมานจากคอมเมนต์ใน diff)

## commit ที่เกี่ยวข้อง
- `4341ae81` — ล็อกสต็อกรายสินค้า กัน 40P01
- `ac839a65` — ล็อก shared/exclusive ของ RebuildGL
- `4de91436` — checkout/TMS/procure เป็นธุรกรรมเดียว, เลขที่กันชน
- `5e3dbd36` — rebuild ช่อง WMS แบบกำหนดผลได้
- `acba317c` / `9e29f6df` — ล็อกบิลและล็อกต้นทุนซ่อน (พบด้วย `git log -S` ยังไม่ได้ตรวจ diff)

## โค้ดปัจจุบันที่ป้องกัน
- `backend/internal/application/process/service.go:990` `stockRebuildLock`, `:992` `lockStockItems`; เรียกที่ `trans.go:400`, `:515`, `doc_cancel.go:140`, `stock_beginning.go:324`, `:366`
- `backend/internal/application/process/service.go:1365` `glRebuildLock`, `:1370` `lockGLShared`; เรียกที่ `docs.go:183`, `trans.go:477`, `fa_sale.go:407`
- `backend/internal/application/process/pay_check.go:170` ล็อกบิลตามลำดับ sorted; `hidden_cost.go:286` ล็อกรหัสเอกสารเรียงลำดับ
- `backend/internal/platform/docno/docno.go:23` `Stamp`; เทส `docno_test.go:9`
- `backend/internal/adapter/inbound/http/market/handler.go:669` ล็อกแถวตัวแทน; `wms/handler.go:1997` `WmsBinOpeningSQL`, `:2039` `WmsBinRebuildSQL`
- เทส `service_test.go:58` `TestSavesTakeGLRebuildLockFirst` และ `:85` `TestLockStockItemsSortedAndRebuildStockLock` ใช้ tx จำลอง ตรวจลำดับคำสั่ง ไม่ใช้ฐานจริง

## บทเรียน / กฎที่ได้
- ล็อกหลายตัวต้องเรียงลำดับคงที่เสมอ (sorted) และล็อกก่อนเขียนแถวใด ๆ
- ใช้คีย์ระดับกว้างเมื่อ rebuild ครอบทั้งช่วง; ข้อแลก: save ทุกใบรอ rebuild จบ ถ้า POS หมดเวลาให้เปลี่ยนเป็นคีย์รายงวด (คอมเมนต์ `service.go:1356`)
- ห้ามคำนวณยอดสะสมจาก "ยอดเดิม + ค่าใหม่" ถ้าคำขอ retry ได้; คำนวณใหม่จาก Raw
- ข้อค้างตาม handoff: GL lock ยังไม่ทดสอบกับฐานจริงขณะ rebuild และ save วิ่งพร้อมกัน และ B1 ยังไม่ได้รัน repro ซ้ำหลัง 4341ae81 (ยังไม่ verify)

## ดูเพิ่ม
[[hist-lessons-gl-posting-balance]] · [[hist-lessons-stock-cost-moving-average]] · [[hist-lessons-atomic-transactions-swallowed-errors]] · [[acc-gl-rebuild]] · [[history-overview]]

## ที่มาในโค้ด
- git: `4341ae81`, `ac839a65`, `4de91436`, `5e3dbd36`, `acba317c`, `9e29f6df`
- `docs/HANDOFF_BCCM_PARITY_2026-10-22.md`
