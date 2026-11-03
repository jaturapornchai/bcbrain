---
title: "บทเรียน ประสิทธิภาพและภาระระบบ (Performance and load)"
tags: [history, performance, load]
aliases: ["perf lessons", "single-flight prewarm", "help O(1) lookup", "MCP compact output", "lock wait"]
sources: ["git:56c38867", "git:4de91436", "git:4341ae81", "git:ac839a65", "git:3e69b2b5", "git:7dc1b3a6", "adr-0008", "adr-0009"]
---

## ภาพรวม
ค้นประวัติ git 19-29 ต.ค. 2026 แล้ว: มี commit ติดป้าย `perf` จริงเพียง 1 ตัว (`56c38867`) ที่เหลือเป็นการกันภาระ/การแย่งล็อกที่มาจากบั๊กความถูกต้อง ไม่ใช่การจูนความเร็ว ค้นคำ N+1 / round-trip / bulk / one query ในข้อความ commit ไม่พบ commit ที่ประกาศแก้ N+1 จึงไม่แต่งเคส บันทึกนี้เก็บเฉพาะที่พิสูจน์ได้ และแยก near-miss ไว้ชัด

## อาการ
- A) แค็ตตาล็อก Balloon Help อยู่ใน RAM ฝั่ง client ทั้งก้อน (ตามชื่อ commit)
- B) prewarm แผนที่ (monitormap tile) รับ POST ได้โดยไม่ตรวจ session และงานเบื้องหลังซ้อนกันได้ (ตามข้อความ commit)
- C) บันทึกเอกสารสต็อก/ต้นทุนพร้อมกัน deadlock `40P01`; บันทึกบัญชีต้องรอ rebuild GL ที่ถือล็อกนานได้ถึง 60 วินาที
- D) หน้า BuySaleInformation "เฉพาะมียอด" กรองหลัง `LIMIT 100` รายการที่ควรโชว์หาย (M9)

## สาเหตุ (root cause)
- A) แค็ตตาล็อกเป็นไฟล์เดียวที่ bundle ไปกับ client (ตามชื่อ commit `56c38867` "zero client catalog RAM"; diff route ตรวจแล้ว)
- B) handler รับ POST โดยไม่ตรวจ session และรันบน context ไม่มีเพดานเวลา (ข้อความ + diff `4de91436` ตรวจแล้ว)
- C) การ update `ic_trans_detail` ของเอกสารอื่นบน item เดียวกันโดยลำดับล็อกไม่แน่นอน (comment ใน `service.go` ของ `4341ae81`); GL rebuild ถือ tx ยาวและบันทึกแบบแชร์ล็อกต้องรอ (comment ของ `ac839a65`)
- D) ตัวกรองอยู่ฝั่ง client หลังตัดแถว (ข้อความ `7dc1b3a6`)

## วิธีแก้
- A) `56c38867`: แยก JSON ตามโมดูล (`common/ic/ar_ap/trans/gl_tax`), ให้ server สร้าง `Map` แล้วตอบ `/api/help?keys=` ทีละ 1 entry พร้อม `Cache-Control: max-age=300` (จำกัด key <=120 ตัวอักษร, <=5 key)
- B) `4de91436`: POST ต้องมี session, ใช้ `atomic.Bool` กัน prewarm ซ้อน (single-flight), เพดาน 10 นาที (`prewarmJobTimeout`) และมีเทสต์ `prewarm_test.go` (anonymous = 401)
- C) `4341ae81`: ล็อก `pg_advisory_xact_lock` ต่อ item เรียงตามรหัสก่อนแก้ detail (`lockStockItems`); `ac839a65`: ล็อก `gl_journal:rebuild` แบบ exclusive (rebuild) กับ shared (บันทึก) พร้อมคอมเมนต์ระบุเพดานและทางอัปเกรดเป็นกุญแจรายงวด
- D) `7dc1b3a6`: ย้ายตัวกรองเข้า SQL. ฟีเจอร์ใหม่ (ไม่ใช่การแก้บั๊ก) `3e69b2b5`: MCP อ่านอย่างเดียวคืนรูป `compact` เป็นค่าเริ่มต้นและตั้งเพดานแถวต่อ tool (เริ่ม 50-100, สูงสุด 200-500)

## commit ที่เกี่ยวข้อง
`56c38867` (perf: help), `4de91436` (prewarm), `4341ae81`, `ac839a65` (ล็อก), `7dc1b3a6` (M9, ตั้งค่ารายการต่อแท็บ), `3e69b2b5` (MCP). Near-miss: `bbf81811` ข้อความระบุ "5-min watcher interval" แต่ stat ไม่มีไฟล์ watcher จึงไม่นับเป็นงาน perf ของระบบ; ADR-0008/0009 (`/query/batch` อ่านสูงสุด 20 statement, `/query/execBatch` เขียน atomic) เน้นความถูกต้อง ไม่ใช่การจูนความเร็ว (ตามเนื้อ ADR); ตัวเลข "ประหยัด 55-75% token" เป็นคอมเมนต์ในโค้ด ไม่ได้วัดซ้ำ

## โค้ดปัจจุบันที่ป้องกัน
- `frontend/src/app/api/help/route.ts:26,291` (`SERVER_HELP_INDEX`, `GET`; ไฟล์โตขึ้นหลังเพิ่มสลับภาษา `47fce10e`), ข้อมูล `frontend/src/config/help/data/*.json`
- `backend/internal/adapter/inbound/http/monitormap/handler.go:64-70,573` (`prewarmRunning`, `prewarmJobTimeout`, `CompareAndSwap`)
- `backend/internal/application/process/service.go:990,992,1356,1365` (`stockRebuildLock`, `lockStockItems`, `glRebuildLock`)
- `backend/internal/adapter/inbound/http/mcp/compact.go:10` (`FormatCompact`), `gateway.go:1190-1298` (เพดาน `limit`)
- `backend/internal/domain/query/query.go:35-40` (เพดานจำนวน statement ของ batch)

## บทเรียน / กฎที่ได้
1. งานเบื้องหลังที่ผู้ใช้สั่งได้ต้องมี 3 อย่างเสมอ: ตรวจสิทธิ์, single-flight, เพดานเวลา
2. ล็อกหลายตัวต้องเรียงลำดับเดียวกันทุกที่ (sorted item codes) ถ้าถือล็อกยาว ต้องเขียนเพดานและทางอัปเกรดไว้ใน comment
3. ข้อมูลอ้างอิงขนาดใหญ่ให้ server ค้นแล้วส่งทีละ entry พร้อม cache header แทนแพ็กไปทั้งก้อน
4. กรองก่อน `LIMIT` เสมอ มิฉะนั้นผลที่เห็นไม่ครบโดยไม่มีข้อผิดพลาด
5. ช่องทางให้ AI/MCP ต้องแคบ (compact + เพดานแถว) ตัวเลขประหยัดเป็นค่าประมาณ
6. ไม่มี commit ใดวัดก่อน-หลัง จึงไม่มีตัวเลขประสิทธิภาพให้อ้าง

## ดูเพิ่ม
[[hist-lessons-concurrency-advisory-locks]] · [[hist-lessons-query-gateway-write-lockdown]] · [[hist-lessons-report-engine-parity]] · [[hist-lessons-hidden-tab-hotkeys-dirty-guard]] · [[hist-lessons-atomic-transactions-swallowed-errors]] · [[history-overview]]

## ที่มาในโค้ด
repo `bcaiaccount` (อ่านอย่างเดียว): `frontend/src/app/api/help/route.ts`, `backend/internal/adapter/inbound/http/{monitormap,mcp}/`, `backend/internal/application/process/service.go`, diff ของ `56c38867`, `4de91436`, `4341ae81`, `ac839a65`
