---
title: "Process engine (/process) เรียก action อย่างไร และเพิ่ม action ใหม่ต้องแก้ที่ไหนบ้าง"
tags: [faq, process, dispatcher, backend, dev]
aliases: ["เพิ่ม action ใหม่ใน process", "/process/{action}", "/api/v1/process", "routeRights", "RequiredRight", "serve generic", "SetScope", "StockScope", "unknown master action", "process dispatcher"]
sources: ["backend/internal/adapter/inbound/http/router.go:127", "backend/internal/adapter/inbound/http/process/master_handler.go:15", "backend/internal/adapter/inbound/http/process/stocktools_handler.go:23", "backend/internal/adapter/inbound/http/process/permission.go:23", "backend/internal/adapter/inbound/http/process/permission.go:57", "backend/internal/application/process/stock_tools.go:21", "frontend/src/app/api/process/master/[action]/route.ts:11"]
---
# Process engine (/process) เรียก action อย่างไร และเพิ่ม action ใหม่ต้องแก้ที่ไหนบ้าง

**ตอบสั้น:** ไม่มีตัวกระจายกลางไฟล์เดียว — `router.go` จับ URL (`/process/{กลุ่ม}/{action}`) แล้ว handler ของกลุ่มทำ `switch` ตาม `{action}` เรียกเมธอดของ `appprocess.Service` ส่วนสิทธิ์เมนูถูกตัดสินจากตาราง `routeRights` — ถ้าเพิ่ม action แล้วไม่ใส่ตารางนี้ จะต้องเป็น Admin เท่านั้น

## รายละเอียด
เส้นทางคำขอ: `Auth` (JWT) → `RequireRight(..., processhttp.RequiredRight)` → handler → `Service` → ฐานข้อมูลบริษัทใน token ลงทะเบียนซ้ำ 2 prefix เหมือนกัน คือ `/process` และ `/api/v1/process` (`router.go:127` และ `:168`) Next เรียกตัวหลัง ภาพรวม action ทั้งหมดอยู่ที่ [[proc-dispatcher]] และ [[api-process-run]]

**เพิ่ม action ใหม่ในกลุ่มที่มีอยู่แล้ว (กลุ่ม `{action}` เช่น `master`, `stocktools`):**
1. เขียนเมธอดใน `backend/internal/application/process/` พร้อม struct input ที่ฝัง `StockScope` (ฟิลด์ `ProviderCode/DatabaseName/UserCode` เป็น `json:"-"` และมี `SetScope` — `stock_tools.go:21`) เพื่อให้ session มาจาก token ไม่ใช่ body
2. เพิ่ม `case "ชื่อ-action":` ใน handler ของกลุ่ม เรียก `serve(h, w, r, "กลุ่ม/ชื่อ-action", limit, func ... )` (`master_handler.go:19`) `serve` ถอด JSON, ประทับ session แล้วตอบ `{"ok": true, "data": ...}`
3. ใส่ `"กลุ่ม/ชื่อ-action": read|write|del|admin` ใน `routeRights` (`permission.go:23`) หรือ case พิเศษใน `RequiredRight` (`permission.go:57`) ถ้าสิทธิ์ขึ้นกับ body (เช่น `trans/save` ที่แยก `isNew` เป็น Add/Edit)
4. ฝั่ง Next: เพิ่มชื่อใน `ACTIONS` ของ `frontend/src/app/api/process/<กลุ่ม>/[action]/route.ts` มิฉะนั้นได้ "ไม่พบคำสั่ง" 404 ก่อนถึง backend

**เพิ่มกลุ่ม/route ตรงใหม่:** ต้องลงทะเบียนใน `router.go` ทั้ง `/process` และ `/api/v1/process` (โค้ดเป็นสำเนาสองชุด ไม่ได้ใช้ฟังก์ชันร่วม)

**action ที่ไม่รู้จัก** ในกลุ่ม `{action}` ตอบ `KindNotFound` เช่น "unknown master action"

## ข้อควรระวัง
- route ที่ไม่อยู่ใน `routeRights` ตกเป็น `admin` (`permission.go:132`) — ผู้ใช้ทั่วไปจะได้ 403 ทั้งที่โค้ดถูก ให้ตรวจตารางนี้ก่อนเสมอ ([[faq-menu-permission-denied]])
- ตารางเงิน/สต็อก/GL ต้องเขียนผ่านกลุ่มนี้เท่านั้น ไม่ใช่ `/query/exec` ([[faq-query-exec-write-blocked]])
- ห้ามอ่านชื่อฐานข้อมูล/บริษัทจาก body — struct ทุกตัวใช้ `SetScope` จาก claims

## ดูเพิ่ม
- [[proc-dispatcher]]
- [[process-overview]]
- [[api-process-run]]
- [[proc-permission-rights]]
- [[be-http-router-routes]]
- [[faq-add-master-screen]]

## ที่มาในโค้ด
- `backend/internal/adapter/inbound/http/router.go:127` กลุ่ม `/process` (ซ้ำที่ `:168` สำหรับ `/api/v1/process`)
- `backend/internal/adapter/inbound/http/process/master_handler.go:15` `Master` switch ตาม `{action}` + `default` unknown action (บรรทัด 41)
- `backend/internal/adapter/inbound/http/process/stocktools_handler.go:23` ฟังก์ชัน generic `serve`
- `backend/internal/application/process/stock_tools.go:21` `StockScope` และ `SetScope` (บรรทัด 27)
- `backend/internal/adapter/inbound/http/process/permission.go:23` `routeRights` (comment: route ที่ไม่อยู่ในตารางต้องเป็น Admin)
- `backend/internal/adapter/inbound/http/process/permission.go:57` `RequiredRight` และ default `return admin` (บรรทัด 132)
- `frontend/src/app/api/process/master/[action]/route.ts:11` `ACTIONS` ที่อนุญาตและ proxy ไป `/api/v1/process/master/${action}`
