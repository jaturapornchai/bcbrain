---
title: "เส้นทาง API ฝั่ง Next.js ที่ส่งต่อไป Go backend (API proxy routes)"
tags: [frontend, api, proxy, nextjs, route-handler, go]
aliases: ["api/process", "api/query", "proxyToService", "route.ts", "ACTIONS whitelist", "SERVICE_BASE_URL", "ok fail envelope", "api/workspace", "api/help", "api/pos"]
sources: ["frontend/src/lib/api-server.ts:34", "frontend/src/lib/api-server.ts:49", "frontend/src/lib/api-server.ts:496", "frontend/src/app/api/process/trans/[action]/route.ts:12", "frontend/src/app/api/process/workflow/[action]/route.ts:12", "frontend/src/app/api/process/report/run/route.ts:47", "frontend/src/app/api/process/report/pdf/route.ts:50", "frontend/src/app/api/help/route.ts:291", "frontend/src/app/api/workspace/[...path]/route.ts:67", "frontend/src/app/api/pos/[...path]/route.ts:54"]
---

# เส้นทาง API ฝั่ง Next.js ที่ส่งต่อไป Go backend (API proxy routes)

เบราว์เซอร์ยิงมาที่ `/api/...` ของ Next.js เสมอ (same-origin, cookie ติดไปเอง) แล้ว route handler ใน `src/app/api/**/route.ts` ตรวจ session, แนบ JWT แล้วส่งต่อ ไป Go backend (`SERVICE_BASE_URL`)
ทุกคำตอบมีรูปเดียวกันคือ `{ ok:true, data }` หรือ `{ ok:false, error, code }`

## ทำงานอย่างไร

**รูปแบบคำตอบ** (`src/lib/api-server.ts`): `ok(data)` (บรรทัด 34-36) และ `fail(error, status=400, code?)` (49-51). `proxyToService` (496-553) แปลงผล backend ให้เป็นรูปนี้เสมอ และเปลี่ยน 401 เป็น `SESSION_EXPIRED`. ฝั่งเบราว์เซอร์ `api-client.ts` คืน `ApiResult<T>` (ดู [[fe-query-client-sql-builder]]).

**โครง route มาตรฐาน** (ตัวอย่าง `process/trans/[action]/route.ts:12-39`)
1. `ACTIONS = new Set([...])` - action ไม่อยู่ในรายการ -> `404 NOT_FOUND` (กัน path แปลกไปถึง backend).
2. `requireSession()` -> `getValidAccessToken()` ไม่มี token -> `401 NO_TOKEN`.
3. อ่าน body JSON แล้ว `proxyToService("/api/v1/process/<group>/<action>", POST, token)`.
ทุกกลุ่ม `process/*/[action]` ใช้โครงเดียวกัน ต่างกันแค่ whitelist.

**กลุ่ม `/api/query/*`** - ส่ง SQL ที่ frontend ประกอบเองไป backend: `list` (`/query/list`), `limit` (`/query/limit` default `limit=50`), `exec` (`/query/exec`), `batch` (`/query/batch`), `execBatch` (`/query/execBatch`). ใช้ `fetchServiceWithAuthRetry` + `requireSession`.

**กลุ่ม `/api/process/<group>/<action>`** (whitelist จริงจากโค้ด; ทุกอันส่งต่อไป `/api/v1/process/<group>/<action>`)
| group | action ที่อนุญาต | ใช้โดย |
|---|---|---|
| `trans` | save, delete, deposits, party-defaults | จอเอกสาร ([[fe-transaction-screens]]) |
| `transgrid` | line, formula, totals, shortcut, priceinfo, fx, refimport | ตารางรายการสินค้าในเอกสาร |
| `doc` | save, delete, bills, cancel, approve, flow | เอกสารวางบิล/รับชำระ, ยกเลิก/อนุมัติ |
| `lookup` | party-filter, ref-doc-filter, wh-filter, wh-pick-check, wh-perm-filter | เงื่อนไขกรองค้นหา ([[fe-grid-component]]) |
| `master` | nextcode, codeleave, datalistget, datalistsave, assetdepdefaults | จอข้อมูลหลัก ([[fe-standard-master-screen]]) |
| `master-detail` | save, delete | จอ master + detail |
| `itemmaster` | save, delete | ทะเบียนสินค้า |
| `itemdetail` | get, save | รายละเอียดสินค้า |
| `itempicture`, `docpicture` | list/get/save (+ `image` สำหรับรูป) | รูปสินค้า/รูปเอกสาร |
| `modifyprice` | preview, apply | ปรับราคา |
| `cheque` | rebuild, candidates | เช็ค |
| `barcode` | item, save, discount-load, discount-save, ean13-check/generate/apply, print-items, format ฯลฯ | บาร์โค้ด |
| `stocktools` | formats, barcodecheck, serialanalyze/scan, lot*, hiddencost*, notcounted*, itemnextcode, stockbeginning* ฯลฯ | เครื่องมือสต็อก |
| `workflow` | change-code, journal-list, journal-pass, gl-check, gl-close, audit-list, fa-depreciation, asset-sale, province-list/load, check-ic-trans, point-recal, import-transport-label, ai-* | จอประมวลผล ([[fe-process-pos-screens]]) |
| `report` | `run`, `pdf` (route แยก) | รายงาน ([[fe-report-screens]]) |
| `gl`, `stock`, `tax` | `gl/rebuild`, `gl/recurring`, `gl/template-defaults`, `stock/rebuild`, `tax/rebuild` | ประมวลผลใหม่ |
- `report/pdf` ใช้ `fetch` ตรงแล้วส่งไฟล์ `application/pdf` กลับพร้อม `content-disposition` (`pdf/route.ts:50,77-82`); `itempicture|docpicture/image` ส่งรูปผ่าน `safeMediaContentType` (อนุญาตเฉพาะ image/pdf, `api-server.ts:42-47`).

**กลุ่มอื่นที่ account ใช้**
- `/api/auth/*` - [[fe-auth-session]].
- `/api/workspace/[...path]` (`route.ts:67`) - รวม check-db-name, databases, members, select-db, screen-rights, my-screen-rights; แนบ `X-Admin-Api-Key` และตรวจ `isWorkspaceAdmin` ก่อนแก้สมาชิก/สิทธิ์ (บรรทัด 118,136; ผู้ไม่ใช่ admin -> `403 FORBIDDEN_NOT_ADMIN`).
- `/api/help?key=|lang=` (`help/route.ts:291-330`) - ค้นคำอธิบายช่องกรอกจากไฟล์ JSON ใน `src/config/help/data/` (โหลดด้วย `fs` ครั้งเดียว) รับ `keys` สูงสุด 8 ตัวคั่นด้วย `|`; ไม่ผ่าน backend; cache 300 วินาที. คืน `{ entry: ... | null }` (ไม่ใช่ envelope `ok`).
- `/api/admin/*` - [[fe-admin-console]].
- `/api/pos/[...path]` (`route.ts:54`) - proxy บางๆ ไป `/api/v1/pos/*` ใช้กับ `PosSetupAndControlScreen`.
- route ของระบบอื่น (ai, crm, dashboard, etax, wms, tms, procure, market ฯลฯ) อยู่นอกขอบเขตโน้ตชุดนี้ จึงไม่ได้อ่าน.

**ข้อควรระวัง**
- เพิ่ม action ใหม่ที่ backend ต้องเพิ่มชื่อใน `ACTIONS` ของ route ด้วย ไม่งั้นได้ 404 ฝั่ง Next.js.
- production ต้องตั้ง `ADMIN_API_KEY` ใน env ไม่งั้น route กลุ่ม `/admin` ตอบ 503.
- `help` ไม่ผ่าน `requireSession` ตามที่อ่าน (คืนข้อมูลคำอธิบายสาธารณะจากไฟล์ในโปรเจกต์).

## ที่มาในโค้ด
- `frontend/src/lib/api-server.ts:34-51,388-458,496-553` - ok/fail, retry, proxyToService
- `frontend/src/app/api/process/*/[action]/route.ts` - whitelist ต่อกลุ่ม (บรรทัด 11-12 ของแต่ละไฟล์)
- `frontend/src/app/api/process/workflow/[action]/route.ts:12-32` - รายการ action ของ workflow
- `frontend/src/app/api/query/*/route.ts` - list/limit/exec/batch/execBatch
- `frontend/src/app/api/workspace/[...path]/route.ts:36-136` - สิทธิ์ผู้ดูแลฐาน
- `frontend/src/app/api/help/route.ts:291-330` - ค้นความช่วยเหลือ

## ดูเพิ่ม
[[frontend-overview]] · [[fe-auth-session]] · [[fe-query-client-sql-builder]] · [[process-overview]] · [[backend-overview]]
