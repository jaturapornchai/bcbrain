---
title: "บทเรียนธุรกรรมอะตอมมิกและ error ที่ถูกกลืน (Atomic Transactions & Swallowed Errors)"
tags: [history, lesson, transaction, atomic, error-handling]
aliases: ["ExecBatch atomic", "swallowed error", "docno.Stamp", "credit_used double charge", "WmsBinRebuildSQL", "fmt.Sprintf missing verb", "ทิ้ง error"]
sources: ["AGENTS.md:50", "AGENTS.md:51", "AGENTS.md:61", "backend/internal/application/query/service.go:130", "backend/internal/adapter/inbound/http/wms/handler.go:505", "backend/internal/adapter/inbound/http/wms/handler.go:1997", "backend/internal/adapter/inbound/http/wms/handler.go:2039", "backend/internal/adapter/inbound/http/market/handler.go:669", "backend/internal/adapter/inbound/http/market/handler.go:1874", "backend/internal/adapter/inbound/http/market/handler.go:365", "backend/internal/adapter/inbound/http/etax/handler.go:461", "backend/internal/adapter/inbound/http/etax/handler.go:1016", "backend/internal/adapter/inbound/http/crm/handler.go:653", "backend/internal/platform/docno/docno.go:23", ".agents/skills/secure-api-data-integrity-checklist/SKILL.md:27"]
---

# ธุรกรรมอะตอมมิกและ error ที่ถูกกลืน

งานที่ต้องเขียนหลายตารางต่อหนึ่งคำสั่งผู้ใช้ ถ้าเขียนทีละ `Exec` แล้วทิ้งค่า `error` จะได้ข้อมูลครึ่งๆ กลางๆ แต่ตอบผู้ใช้ว่า "สำเร็จ" ส่วนค่าที่คำนวณได้ (ยอดช่องเก็บ, เครดิตตัวแทน) ถ้าสะสมแบบ "ยอดเดิม + ค่าใหม่" จะนับซ้ำเมื่อ retry

## อะไรพังได้
- **ตอบสำเร็จทั้งที่เขียนไม่ครบ:** สถานะส่งของเปลี่ยนแล้วแต่ยอดสต็อก/ออเดอร์ไม่ตาม, เอกสารภาษีบันทึกไม่ได้แต่ตอบ 200, insert ออเดอร์/ทริปล้มแต่ยังตัดเครดิตและสร้างเอกสารต่อ
- **ยอดสะสมนับซ้ำ:** `credit_used + x` ไม่ idempotent ผู้แทนจำหน่ายที่ retry ถูกตัดเครดิตสองครั้ง
- **ยอดช่องเก็บถูกบีบที่ 0:** `GREATEST(0, ...)` ซ่อนยอดติดลบที่ควรเตือน
- **เลขเอกสารชนกัน:** เลขที่ใช้เวลาระดับวินาทีซ้ำเมื่อสองคำขอเข้าวินาทีเดียวกัน
- **ปัดภาษีด้วย float:** 1% ของ 14.50 ได้ 0.14 แทน 0.15
- **เขียนทับหลักฐานจริง:** ดึงรูปจาก MinIO ไม่ได้ (timeout/5xx) แล้วบันทึก placeholder ทับรูปเดิม
- **ข้อความเสียใน DB:** `fmt.Sprintf` ที่มี `%s` ไม่ครบจะบันทึก `%!(EXTRA ...)` ลงข้อมูล

## โค้ดป้องกันไว้อย่างไร
| ด่าน | ที่อยู่ | ทำอะไร |
|---|---|---|
| ExecBatch = 1 transaction | `backend/internal/application/query/service.go:130-169` | ตรวจทุก statement แล้วรันใน transaction เดียว statement ไหนพังก็ rollback ทั้งชุด |
| ส่งของ WMS | `backend/internal/adapter/inbound/http/wms/handler.go:505-523` | ยอดตั้งต้น + log + rebuild ยอดช่อง + อัปเดตออเดอร์/จุดส่ง อยู่ใน `ExecBatch` เดียว และ `return` error |
| ยอดช่องเก็บ derive ได้ | `wms/handler.go:1997` `WmsBinOpeningSQL`, `:2039` `WmsBinRebuildSQL` | แถว `OPENING` ครั้งเดียวต่อช่อง (`WHERE NOT EXISTS`) แล้ว `physical_qty = OPENING + SUM(movement มีเครื่องหมาย)` ไม่ครอบ `GREATEST(0,...)` ให้ยอดติดลบเห็นได้ |
| ใช้ซ้ำใน TMS/Procure | `tms/handler.go:554,569`, `procure/handler.go:1382,1398` | เรียกชุดเดียวกันใน batch ของตัวเอง |
| เครดิตตัวแทนคำนวณใหม่ | `market/handler.go:669-673` ล็อกแถวตัวแทนก่อน, `:1874` `marketDealerOpeningSQL`, `:1885` `marketDealerBalanceSQL` | `credit_used = credit_used_opening + SUM(ออเดอร์)` จากข้อมูลดิบทุกครั้ง ไม่สะสม |
| เลขเอกสารกันชน | `backend/internal/platform/docno/docno.go:23` `Stamp` | เวลา + มิลลิวินาที + แท็ก hex สุ่ม 4 ตัว เช่น `153045123-9F2C` |
| ภาษีไม่ปัดผิด | `etax/handler.go:1016` `etaxAmounts` | `math/big.Rat` ปัดครึ่งออกจากศูนย์ที่สตางค์ |
| บันทึกพังต้องตอบ error | `etax/handler.go:461` | `response.Error(w, err)` ไม่ตอบ overview ราวกับสำเร็จ |
| ไม่เขียนทับรูปจริง | `crm/handler.go:653-654` | อ่านรูปไม่ได้ → ส่ง placeholder แต่ไม่บันทึกกลับ |
| `Sprintf` ครบ verb | `market/handler.go:365,387` | ข้อความ `(หน่วย %s)` ครบตาม argument; `go vet` อยู่ในกฎ AGENTS.md ข้อ 20 |

## กฎที่ต้องจำ
1. ห้ามทิ้ง error ของคำสั่งเขียน (`_, _ = Exec(...)`) ในเส้นทางที่ตอบผู้ใช้ — insert หลักล้มต้อง `response.Error` แล้ว `return` (`.agents/skills/secure-api-data-integrity-checklist/SKILL.md:27`)
2. เขียนหลายตารางต่อหนึ่งคำสั่งผู้ใช้ต้องอยู่ใน `ExecBatch` เดียว บันทึก raw log ก่อนตาราง derived (กฎข้อ 9-10, 20 ใน `AGENTS.md:50,51,61`)
3. ค่า derive ได้ให้คำนวณจากข้อมูลดิบทุกครั้ง ไม่สะสม `+x` เพื่อให้ retry ปลอดภัย
4. เลขเอกสารอิงเวลาต้องผ่าน `docno.Stamp` ไม่ใช้ `time.Now().Format("150405")` ตรงๆ
5. เงิน/ภาษีฝั่ง Go ใช้ `big.Rat` ปัดสตางค์
6. ข้อสังเกตที่ยังเหลือ: `buildOverview` ใน `wms/handler.go:840,1737` ยังเรียก `_, _ = ...ExecBatch` สำหรับการ rebuild ยอดช่องก่อนอ่านภาพรวม (ไม่ได้ตอบผู้ใช้ว่าสำเร็จ) ไม่ได้ตรวจเกินกว่านี้

## ที่มาในโค้ด
- `backend/internal/application/query/service.go:130-169` ExecBatch เป็น transaction เดียว
- `backend/internal/adapter/inbound/http/wms/handler.go:505-523,1997,2039` batch ส่งของ + SQL ยอดช่อง
- `backend/internal/adapter/inbound/http/market/handler.go:669-673,1874-1890` ล็อกตัวแทน + คำนวณเครดิตใหม่
- `backend/internal/platform/docno/docno.go:23` + `docno_test.go` เทสต์เลขกันชน
- ดูเพิ่ม: [[adr-0009-query-exec-batch-transactional]] · [[adr-0011-query-exec-write-lockdown]] · [[be-query-write-policy]] · [[std-data-integrity-money-transactions]] · [[hist-lessons-concurrency-advisory-locks]] · [[hist-lessons-query-gateway-write-lockdown]]
