---
title: "รูปแบบ error และ response ของ API (apperr + response helper)"
tags: [backend, go, error, http, api]
aliases: ["apperr", "response.Error", "error shape", "ErrorBody", "KindValidation", "รูปแบบ error", "RFC 7807"]
sources: ["backend/internal/platform/apperr/apperr.go:11", "backend/internal/adapter/inbound/http/response/response.go:40", "backend/internal/adapter/inbound/http/response/response.go:49", "backend/internal/adapter/inbound/http/admin/handler.go:69", "backend/internal/adapter/inbound/http/pos/sync.go:111"]
---

# รูปแบบ error และ response ของ API

application/domain คืน error แบบมีชนิด (`apperr.Error`) โดยไม่รู้จัก `net/http`; ชั้น adapter แปลงเป็นสถานะ HTTP และ body JSON ผ่าน `response.Error`. รูปแบบ body จริงคือ `{"error":{"message":"..."}}` — **ไม่ใช่ RFC 7807 problem-details** แม้คอมเมนต์หัวไฟล์ `apperr.go:1-2` จะอ้างอย่างนั้น (คอมเมนต์ล้าสมัย ให้ยึดโค้ด).

## ทำงานอย่างไร

1. use case สร้าง error ด้วย `apperr.New(kind, msg)` หรือ `apperr.Wrap(kind, msg, err)` (`apperr.go:39,44`).
2. handler เรียก `response.Error(w, err)` (`response.go:49`):
   - ถ้า error ไม่ใช่ `*apperr.Error` → log ข้อผิดพลาดจริงที่ระดับ error แล้วตอบ 500 ด้วยข้อความกลาง `internal server error` (ไม่รั่วรายละเอียด).
   - ถ้าเป็น `*apperr.Error` → แมป `Kind` เป็นสถานะ แล้วตอบ `{"error":{"message": appErr.Message}}`.
   - ถ้าผลเป็น 500 จะ log สาย error ที่ห่ออยู่ (`appErr.Unwrap()`) ด้วย เพื่อไม่ให้ความล้มเหลวภายในเงียบหาย.
3. `response.JSON(w, status, v)` (`response.go:32`) เขียน `Content-Type: application/json` แล้ว encode.
4. logger ของ helper ตั้งครั้งเดียวจาก composition root: `response.SetLogger(log)` (`di/container.go:63`); ถ้าไม่เรียก ค่าเริ่มต้นเป็น no-op (`response.go:23`).

## ตาราง Kind → HTTP

| `apperr.Kind` | HTTP | ที่มา |
|---|---|---|
| `KindValidation` | 400 | `apperr.go:12`, `response.go:61-62` |
| `KindUnauthorized` | 401 | `apperr.go:13` |
| `KindForbidden` | 403 | `apperr.go:14` |
| `KindNotFound` | 404 | `apperr.go:15` |
| `KindConflict` | 409 | `apperr.go:16` |
| `KindInternal` (และอื่น ๆ) | 500 | `apperr.go:17` |

## ข้อยกเว้นที่ต้องรู้

- **admin API ใช้รูปแบบอื่น**: `/api/v1/admin/*` ตอบ `{"ok":true,"data":...}` หรือ `{"ok":false,"error":"...","code":"..."}` ผ่าน `writeOK`/`writeFail` (`admin/handler.go:69-85`) ไม่ใช่ `response.Error` ([[be-admin-api]]).
- **POS** ตอบสำเร็จเป็น `{"ok":true,"data":...}` (`pos/sync.go:111-125`) แต่ error ยังใช้ `response.Error`.
- **query gateway** แปลง error จาก DB เป็น `KindValidation` (400) ทั้งหมด (`application/query/service.go:48,75,125,168,201`) — แยก "SQL ผิด" ออกจาก "ระบบล่ม" ไม่ได้จากสถานะ ([[be-query-gateway]]).
- นโยบายเขียน SQL ปฏิเสธเป็น `KindForbidden` (403) (`service.go:103,107`) ([[be-query-write-policy]]).
- login ล้มเหลวทุกสาเหตุตอบข้อความเดียวกัน `invalid provider, data group, username or password` เพื่อไม่ให้เดาว่า user มีจริงไหม (`application/identity/service.go:20-23`) ([[be-identity-login-flow]]).
- middleware สิทธิ์ตอบ 403 เป็นข้อความไทยตามประเภทสิทธิ์ (`middleware/permission.go:28-35`) ([[be-menu-rights-permission]]).

## ที่มาในโค้ด

- `backend/internal/platform/apperr/apperr.go:11-46` — `Kind`, `Error`, `New`, `Wrap`.
- `backend/internal/adapter/inbound/http/response/response.go:32-79` — `JSON`, `ErrorBody`, `Error`.
- `backend/internal/di/container.go:63` — `SetLogger`.
- `backend/internal/adapter/inbound/http/admin/handler.go:69-85` — รูปแบบ `ok/data` ของ admin.

## ดูเพิ่ม

[[backend-overview]] · [[be-http-router-routes]] · [[be-admin-api]] · [[be-query-gateway]] · [[adr-index]]
