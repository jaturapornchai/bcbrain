---
title: "บทเรียนประสิทธิภาพและภาระระบบ (Performance and load)"
tags: [history, lesson, performance, load]
aliases: ["perf lessons", "single-flight prewarm", "help O(1) lookup", "MCP compact output", "filter before LIMIT", "lock wait"]
sources: ["frontend/src/app/api/help/route.ts:26", "frontend/src/app/api/help/route.ts:291", "backend/internal/adapter/inbound/http/monitormap/handler.go:64", "backend/internal/adapter/inbound/http/monitormap/handler.go:509", "backend/internal/adapter/inbound/http/monitormap/handler.go:573", "backend/internal/adapter/inbound/http/monitormap/prewarm_test.go:32", "frontend/account/report/BuySaleInformationScreen.tsx:74", "backend/internal/adapter/inbound/http/mcp/compact.go:10", "backend/internal/adapter/inbound/http/mcp/gateway.go:1816", "backend/internal/domain/query/query.go:69", "backend/internal/application/process/service.go:1367"]
---

# ประสิทธิภาพและภาระระบบ

ปัญหา "ช้า/หนัก" ในระบบนี้ส่วนใหญ่ไม่ได้มาจากการจูนความเร็ว แต่มาจากงานที่ไม่มีเพดาน: ข้อมูลอ้างอิงก้อนใหญ่ฝั่ง client, งานเบื้องหลังที่ใครสั่งซ้ำก็ได้, การรอล็อก, และผลค้นหาที่ถูกตัดก่อนกรอง บันทึกนี้เก็บเฉพาะด่านที่ยังเห็นในโค้ดวันนี้ ไม่มีตัวเลขวัดก่อน-หลังให้อ้าง

## อะไรพังได้
- **ข้อมูลอ้างอิงทั้งก้อนอยู่ใน RAM ของ client:** แค็ตตาล็อก Balloon Help หลายพันรายการถ้าแพ็กไปกับหน้าเว็บจะกินหน่วยความจำทุกเครื่อง
- **งานเบื้องหลังที่สั่งได้ไม่จำกัด:** prewarm แผนที่ทำให้ backend ดึง tile จากต้นทางหลายร้อยรายการต่อครั้ง ถ้าไม่ตรวจ session หรือรันซ้อนกันได้ จะถูกยิงจนหนัก
- **รอล็อกนาน:** save ทุกใบต้องรอ GL rebuild ที่ถือ transaction ยาว (ดู [[hist-lessons-concurrency-advisory-locks]])
- **ผลหายเงียบๆ:** กรอง "เฉพาะมียอด" ฝั่ง client หลัง `LIMIT 100` ทำให้รายการที่เรียงเกิน 100 ไม่แสดงโดยไม่มี error
- **ช่องทาง AI/MCP พ่นข้อมูลเกินจำเป็น:** ผลตารางแบบ object ซ้ำชื่อคอลัมน์ทุกแถวเปลืองโทเค็น และไม่มีเพดานแถว

## โค้ดป้องกันไว้อย่างไร
| ด่าน | ที่อยู่ | ทำอะไร |
|---|---|---|
| Help ค้นฝั่ง server | `frontend/src/app/api/help/route.ts:26` `SERVER_HELP_INDEX` (Map), `:291` `GET` | client ขอทีละคีย์ (`keys=a\|b`, คีย์ละ ≤120 ตัวอักษร, สูงสุด 8 คีย์) ได้ entry เดียว พร้อม `Cache-Control: public, max-age=300, stale-while-revalidate=600`; `POST` (`:340`) รับ micro-batch ไม่ต้องโหลด JSON ทั้งก้อนลง client |
| prewarm ต้องมี session | `backend/internal/adapter/inbound/http/monitormap/handler.go:509-514` | ไม่มี claims/ฐานข้อมูล → 401 ไม่ตกไปฐานเริ่มต้น |
| prewarm single-flight | `monitormap/handler.go:64-66` `prewarmRunning atomic.Bool`, `:573` `CompareAndSwap` | งานรอบเดียวต่อครั้ง |
| prewarm มีเพดานเวลา | `monitormap/handler.go:69-70` `prewarmJobTimeout` (10 นาที), `:577` | งานเบื้องหลังไม่รันบน context ไม่จำกัดเวลา |
| เทสต์ prewarm | `monitormap/prewarm_test.go:32` `RequiresSession`, `:44` `SingleFlight` | |
| กรองก่อน LIMIT | `frontend/account/report/BuySaleInformationScreen.tsx:74-82` | เงื่อนไข `onlyWithDebt` อยู่ใน SQL (`:80`) ก่อน `LIMIT 100` |
| เพดาน batch/แถว | `backend/internal/domain/query/query.go:69-81` | `MaxListRows` 50000, `MaxBatchStatements` 20, `MaxExecBatchStatements` 1000, `MaxExecBatchBytes` 2 MiB |
| MCP ผลแบบ compact | `backend/internal/adapter/inbound/http/mcp/compact.go:10` `FormatCompact` | ค่าเริ่มต้นเป็น columns + rows tuple ตัดคอลัมน์ว่าง/ศูนย์ |
| MCP เพดานแถวต่อ tool | `mcp/gateway.go:1680` (≤300), `:1816` (≤500), `:1982` (≤200), `:2027` (≤500) | เกินเพดานถูกรีเซ็ตเป็นค่าเริ่มต้นของ tool นั้น (50 หรือ 100) |
| ล็อก GL ที่รอได้ | `backend/internal/application/process/service.go:1367-1376` | comment ระบุเพดาน (rebuild ≤60 วินาที) และทางอัปเกรดเป็นคีย์รายงวด |

## กฎที่ต้องจำ
1. งานเบื้องหลังที่ผู้ใช้สั่งได้ต้องมี 3 อย่างเสมอ: ตรวจสิทธิ์/session, single-flight, เพดานเวลา
2. ข้อมูลอ้างอิงก้อนใหญ่ให้ server ค้นแล้วส่งทีละ entry พร้อม cache header
3. กรองใน SQL ก่อน `LIMIT` เสมอ — กรองหลังตัดแถวทำให้ผลไม่ครบโดยไม่มี error
4. ช่องทางที่ AI เรียกต้องแคบ: รูปแบบ compact เป็นค่าเริ่มต้น และมีเพดานจำนวนแถว
5. ล็อกที่ถือนานต้องเขียนเพดานและทางอัปเกรดไว้ใน comment (ดู `backend/internal/application/process/service.go:1367`)

## ที่มาในโค้ด
- `frontend/src/app/api/help/route.ts:26,291,300-301,318,340` ค้น Help ฝั่ง server
- `backend/internal/adapter/inbound/http/monitormap/handler.go:64-70,509-514,573-577` prewarm
- `frontend/account/report/BuySaleInformationScreen.tsx:74-82` กรองก่อน LIMIT
- `backend/internal/adapter/inbound/http/mcp/compact.go:10`, `mcp/gateway.go:1680,1816,1982,2027`
- ดูเพิ่ม: [[adr-0008-query-batch-endpoint]] · [[adr-0009-query-exec-batch-transactional]] · [[hist-lessons-atomic-transactions-swallowed-errors]] · [[hist-lessons-query-gateway-write-lockdown]]
