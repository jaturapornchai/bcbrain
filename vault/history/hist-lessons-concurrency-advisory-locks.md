---
title: "บทเรียนการทำงานพร้อมกันและ advisory lock (Concurrency & Advisory Locks)"
tags: [history, lesson, concurrency, lock, deadlock]
aliases: ["deadlock 40P01", "pg_advisory_xact_lock", "RebuildGL lock", "lockStockItems", "lockGLShared", "docno collision"]
sources: ["backend/internal/application/process/service.go:998", "backend/internal/application/process/service.go:1003", "backend/internal/application/process/service.go:1331", "backend/internal/application/process/service.go:1367", "backend/internal/application/process/service.go:1381", "backend/internal/application/process/trans.go:400", "backend/internal/application/process/trans.go:474", "backend/internal/application/process/docs.go:180", "backend/internal/application/process/fa_sale.go:402", "backend/internal/application/process/pay_check.go:170", "backend/internal/application/process/hidden_cost.go:380", "backend/internal/application/process/service_test.go:58", "backend/internal/application/process/service_test.go:85", "backend/internal/platform/docno/docno.go:23", "backend/internal/adapter/inbound/http/market/handler.go:669"]
---

# การทำงานพร้อมกันและ advisory lock

เมื่อหลายคำขอแตะข้อมูลชุดเดียวกัน (สินค้าเดียวกัน, ช่วงวันที่ GL เดียวกัน, ตัวแทนเดียวกัน) ถ้าไม่ล็อกให้เป็นระเบียบจะได้ deadlock ดิบ, รายการบัญชีซ้ำ หรือเลขที่ชนกัน ระบบนี้แก้ด้วย `pg_advisory_xact_lock` ที่ล็อกตามลำดับคงที่เสมอ

## อะไรพังได้
- **deadlock รายสินค้า:** save ที่เปลี่ยนต้นทุนต้องอัปเดตแถว `ic_trans_detail` ของเอกสารอื่นที่มีสินค้าเดียวกัน สองธุรกรรมถือแถวสลับลำดับกัน → ผู้ใช้เห็น SQL ดิบ `deadlock detected` (SQLSTATE `40P01`)
- **GL ซ้ำ:** rebuild GL ช่วงวันที่ลบ journal ทั้งช่วงแล้วลงใหม่ ถ้ามี save ลง journal ของตัวเองคั่นกลาง (READ COMMITTED ให้แต่ละคำสั่งเห็น snapshot ของตัวเอง) จะเหลือสองชุด
- **เลขเอกสารชน:** เลขอิงเวลาระดับวินาทีซ้ำเมื่อสองคำขอเข้าวินาทีเดียวกัน
- **นับเครดิตซ้ำ:** checkout ของตัวแทนเดียวกันที่ retry ถูกหักเครดิตสองรอบ ถ้าคิดจาก "ยอดเดิม + ค่าใหม่"
- **บิลเดียวกันถูกจ่ายเกิน:** สองเอกสารอ่านยอดคงเหลือของบิลพร้อมกัน ต่างเห็นยอดเต็ม

## โค้ดป้องกันไว้อย่างไร
| ด่าน | ที่อยู่ | ทำอะไร |
|---|---|---|
| ล็อกสต็อกรายสินค้า | `backend/internal/application/process/service.go:998-1014` `lockStockItems` | ล็อก shared ที่ `stockRebuildLock` แล้วล็อกรายสินค้า `ic_stock:<code>` ตามลำดับ sorted (`uniqueSorted`) ก่อนแก้ `ic_trans_detail`; rebuild ทั้งฐาน (`:1025`) ล็อก exclusive |
| ผู้เรียก `lockStockItems` | `trans.go:400,515`, `doc_cancel.go:140`, `stock_beginning.go:324,366` | บันทึก/ลบ/ยกเลิก/ยอดยกมา ล็อกสินค้าก่อนเขียน |
| ล็อกเอกสาร | `trans.go:474` `lockTransDoc`, `docs.go:180` `runDocPlan` | `ic_trans:<doc_no>:<flag>` กัน save/delete เอกสารเดียวกันชนกัน |
| GL rebuild กับ save | `backend/internal/application/process/service.go:1367-1388` `glRebuildLock`/`lockGLShared`; `:1331` `RebuildGL` | RebuildGL ล็อก exclusive; save/อนุมัติ/ยกเลิก/ขายสินทรัพย์ล็อก shared หลังล็อกเอกสารและก่อนเขียนแถว GL (`trans.go:477`, `docs.go:183`, `fa_sale.go:407`) |
| ขายสินทรัพย์ | `fa_sale.go:402-407` | ล็อก `asset-sale` ก่อน แล้วค่อย shared GL — rebuild ไม่เคยถือ `asset-sale` จึงไม่ deadlock |
| ล็อกบิลตามลำดับ | `pay_check.go:170-176` | ล็อก `bill:<เลขบิล>` ตามลำดับ sorted ก่อนตรวจยอดจ่าย |
| ล็อกต้นทุนซ่อน | `hidden_cost.go:380-390` `lockHiddenCost` | ล็อกรหัสเอกสารเรียงลำดับคงที่ (แก้เอกสารที่เปลี่ยนเลขก็ไม่ deadlock) |
| เลขเอกสารกันชน | `backend/internal/platform/docno/docno.go:23` `Stamp` | เวลา + มิลลิวินาที + แท็กสุ่ม 4 hex (เทสต์ `docno_test.go:9,20`) |
| เครดิตตัวแทน | `backend/internal/adapter/inbound/http/market/handler.go:669-673` | ล็อกแถวตัวแทนก่อน แล้วคำนวณเครดิตใหม่จากยอดตั้งต้น + SUM(ออเดอร์) |
| เทสต์ลำดับล็อก | `service_test.go:58` `TestSavesTakeGLRebuildLockFirst`, `:85` `TestLockStockItemsSortedAndRebuildStockLock` | ใช้ tx จำลอง (`lockTx`) ตรวจลำดับคำสั่งล็อก ไม่ได้ใช้ฐานจริง |

## กฎที่ต้องจำ
1. ล็อกหลายตัวต้องเรียงลำดับคงที่ (sorted) และล็อกก่อนเขียนแถวใดๆ
2. rebuild ที่ครอบทั้งช่วงใช้คีย์เดียวกว้างๆ — ข้อแลกเปลี่ยนที่โค้ดเขียนไว้ใน comment `backend/internal/application/process/service.go:1371-1375`: ทุก save รอ rebuild ที่กำลังรัน (tx สูงสุด 60 วินาที) ถ้า POS หมดเวลาให้เปลี่ยนเป็นคีย์รายงวด
3. ห้ามคำนวณยอดสะสมจาก "ยอดเดิม + ค่าใหม่" เมื่อคำขอ retry ได้ ให้คำนวณใหม่จากข้อมูลดิบ
4. เลขเอกสารอิงเวลาต้องใช้ `docno.Stamp`
5. ข้อจำกัดที่ยังมี: เทสต์ล็อกใช้ tx จำลองเท่านั้น ยังไม่มีเทสต์ที่รัน rebuild กับ save พร้อมกันบนฐานจริง

## ที่มาในโค้ด
- `backend/internal/application/process/service.go:998-1014,1331,1367-1388` ล็อกสต็อกและล็อก GL
- `backend/internal/application/process/service_test.go:58-100` เทสต์ลำดับล็อก
- `backend/internal/platform/docno/docno.go:23`
- ดูเพิ่ม: [[acc-gl-rebuild]] · [[acc-inventory-stock-rebuild]] · [[hist-lessons-atomic-transactions-swallowed-errors]]
