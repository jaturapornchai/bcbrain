---
title: "เส้นทาง API ฝั่ง Next.js ที่ส่งต่อไป Go backend (API proxy routes)"
tags: [frontend, api, proxy, nextjs, route-handler, go]
aliases: ["api/process", "api/query", "proxyToService", "route.ts", "ACTIONS whitelist", "SERVICE_BASE_URL", "ok fail envelope", "api/workspace", "api/help", "api/pos"]
sources: ["frontend/src/lib/api-server.ts:34", "frontend/src/lib/api-server.ts:63", "frontend/src/lib/api-server.ts:402", "frontend/src/lib/api-server.ts:510", "frontend/src/app/api/process/trans/[action]/route.ts:11", "frontend/src/app/api/process/workflow/[action]/route.ts:12", "frontend/src/app/api/process/report/run/route.ts:32", "frontend/src/app/api/process/report/pdf/route.ts:58", "frontend/src/app/api/query/limit/route.ts:58", "frontend/src/app/api/help/route.ts:291", "frontend/src/app/api/workspace/[...path]/route.ts:64", "frontend/src/app/api/pos/[...path]/route.ts:54"]
---

# เส้นทาง API ฝั่ง Next.js ที่ส่งต่อไป Go backend (API proxy routes)

เบราว์เซอร์ยิงมาที่ `/api/...` ของ Next.js เสมอ (same-origin, cookie ติดไปเอง) แล้ว route handler ใน `frontend/src/app/api/**/route.ts` ตรวจ session, แนบ JWT แล้วส่งต่อไป Go backend ที่ `SERVICE_BASE_URL` (ค่าอยู่ใน env `SERVICE_BASE_URL`; ถ้าไม่ตั้งจะชี้เครื่องตัวเองพอร์ต 8080, `api-server.ts:22-23`).
route กลุ่ม `process` และ `query` ตอบรูปเดียวกันคือ `{ ok:true, data }` หรือ `{ ok:false, error, code }`; ข้อยกเว้น (`report/pdf`, `image`, `help`, `pos`) อยู่ในหัวข้อกลุ่มอื่น.

## ทำงานอย่างไร

**ตัวช่วยกลาง** (`src/lib/api-server.ts`)
- `ok(data)` (34-36) และ `fail(error, status=400, code?)` (63-65) สร้างคำตอบรูปมาตรฐาน.
- `requireSession()` (262-274) ไม่มี session -> `401 NO_SESSION`, มี -> ต่ออายุ `lastActivity`; `isErrorResponse` (393-397) ใช้แยกผลลัพธ์ที่เป็น error ออกจาก session. `getValidAccessToken` (569) คืน JWT ที่ยังใช้ได้ (ต่ออายุให้เมื่อเหลือไม่ถึง 1 นาที) ถ้าไม่ได้ route จะตอบ `401 NO_TOKEN`.
- `fetchServiceWithAuthRetry` (402-504) ยิง backend ได้สูงสุด 3 ครั้ง (หน่วง 150 มิลลิวินาที x ครั้งที่) เมื่อได้ 502/503/504 หรือต่อไม่ได้ (430-459); ถ้าได้ 401 จะหมุน refresh token (469-481) หรือออก token ใหม่ด้วย `reissueSessionTokens` (483-488) แล้วยิงซ้ำ (490-499). endpoint ที่มี `/admin` จะแนบ header `X-Admin-Api-Key` จาก `getAdminApiKey()` (408-426); production ที่ไม่ได้ตั้ง env `ADMIN_API_KEY` ได้ `503 NO_ADMIN_API_KEY` (74-79, 410-415).
- `proxyToService(endpoint, init, token)` (510-563) เรียกข้างบนแล้วแปลงผล: ถ้า backend ตอบ JSON ที่มีฟิลด์ `ok` เป็น boolean ก็ส่งผ่านตามเดิม (531-533); ถ้าไม่ใช่และ status ปกติ -> ห่อด้วย `ok(...)` (534-536); ได้ 401 -> `401 SESSION_EXPIRED` (537-543); อย่างอื่น -> `fail` ด้วยข้อความ error ของ backend (544-549). ต่อ backend ไม่ได้ -> `503 BACKEND_UNAVAILABLE` (522-526). ฝั่งเบราว์เซอร์ `api-client.ts` คืน `ApiResult<T>` (ดู [[fe-query-client-sql-builder]]).

**โครง route มาตรฐานของ `process/*/[action]`** (ตัวอย่าง `process/trans/[action]/route.ts:11-38`)
1. `ACTIONS = new Set([...])` (บรรทัด 11 หรือ 12 ของแต่ละไฟล์) - action ไม่อยู่ในรายการ -> `404 NOT_FOUND` ("ไม่พบคำสั่งนี้") กัน path แปลกไปถึง backend.
2. `requireSession()` แล้ว `getValidAccessToken()`; ไม่มี token -> `401 NO_TOKEN`.
3. อ่าน body JSON (พังให้ถือเป็น `{}`) แล้ว `proxyToService` แบบ POST ไป `/api/v1/process/<กลุ่ม>/<action>` เช่น `/api/v1/process/trans/save`.
ทุกกลุ่ม `process/*/[action]` ใช้โครงเดียวกัน ต่างกันแค่รายการ whitelist.

**กลุ่ม `/api/query/*`** - ส่ง SQL ที่ frontend ประกอบเองไป backend ผ่าน `fetchServiceWithAuthRetry`: `list` (`/query/list`), `limit` (`/query/limit`), `exec` (`/query/exec`), `batch` (`/query/batch`), `execBatch` (`/query/execBatch`) - แต่ละ action เป็นไฟล์ `query/<ชื่อ>/route.ts` ที่ export เฉพาะ POST. เฉพาะ `limit`: ค่าเริ่ม `limit=50`, `offset=0`, `includeTotal=true` (`limit/route.ts:56-61`); `source: "sql_utility"` ต้อง `userLevel >= 9` ไม่งั้น `403 FORBIDDEN` (28-34); ตัดข้อความในเครื่องหมาย `'...'` ออกก่อนแล้วปฏิเสธ SQL ที่มี `into`, `copy`, `pg_sleep`, `dblink`, `set_config` และฟังก์ชันอ่านไฟล์/large object (36-43, `400 INVALID_SQL`).

**กลุ่ม `/api/process/<กลุ่ม>/<action>`** (whitelist จริงจากโค้ด; ทุกอันส่งต่อไป `/api/v1/process/<กลุ่ม>/<action>`)
| กลุ่ม | action ที่อนุญาต | ใช้โดย |
|---|---|---|
| `trans` | save, delete, deposits, party-defaults | จอเอกสาร ([[fe-transaction-screens]]) |
| `transgrid` | line, formula, totals, shortcut, priceinfo, fx, refimport | ตารางรายการสินค้าในเอกสาร |
| `doc` | save, delete, bills, cancel, approve, flow | เอกสารวางบิล/รับชำระ, ยกเลิก/อนุมัติ |
| `lookup` | party-filter, ref-doc-filter, wh-filter, wh-pick-check, wh-perm-filter | เงื่อนไขกรองค้นหา ([[fe-grid-component]]) |
| `master` | nextcode, codeleave, datalistget, datalistsave, assetdepdefaults | จอข้อมูลหลัก ([[fe-standard-master-screen]]) |
| `master-detail` | save, delete | จอ master + detail |
| `itemmaster` | save, delete | ทะเบียนสินค้า |
| `itemdetail` | get, save | รายละเอียดสินค้า |
| `itempicture` | list, get, save | รูปสินค้า |
| `docpicture` | formats, docs, get, save | รูปแนบเอกสาร |
| `modifyprice` | preview, apply | ปรับราคา |
| `cheque` | rebuild, candidates | เช็ค |
| `barcode` | item, save, discount-load, discount-save, ean13-check, ean13-generate, ean13-apply, print-items, format | บาร์โค้ด |
| `stocktools` | formats, barcodecheck, serialanalyze, serialscan, serialcountsave, lotamountload, lotamountsave, hiddencostcalc, hiddencostsave, hiddencostdelete, lotautolist, lotautocheck, lotautorun, notcountedlist, notcountedrun, itemsaved, itemnextcode, stockbeginningsave, stockbeginningdelete, pointdocsave, pointdocdelete, checkpricesave, docnonext | เครื่องมือสต็อก |
| `workflow` | change-code, journal-list, journal-pass, gl-check, gl-close, audit-list, fa-depreciation, asset-sale, province-list, province-load, check-ic-trans, point-recal, import-transport-label, ai-report-sql, ai-report-analyze, ai-bank-reconcile, ai-audit-copilot, ai-smart-reorder, ai-auto-gl | จอประมวลผล ([[fe-process-pos-screens]]) |
| `gl`, `stock`, `tax` | `gl/rebuild`, `gl/recurring`, `gl/template-defaults`, `stock/rebuild`, `tax/rebuild` (route แยกไฟล์ ไม่มี whitelist) | ประมวลผลใหม่ |
| `report` | `run`, `pdf` (route แยกไฟล์) | รายงาน ([[fe-report-screens]]) |

รายละเอียดที่ต่างจากโครงมาตรฐาน
- `tax/rebuild` เติม `providerCode` และ `databaseName` จาก session ให้ก่อน แล้วค่าที่ส่งมาใน body ทับได้ (`tax/rebuild/route.ts:24-28`).
- `report/run` (`report/run/route.ts`) แปลงชื่อรายงานเก่าเป็นชื่อเมนูปัจจุบันด้วย `REPORT_KEY_ALIASES` 17 รายการ (12-30) ทั้งใน GET และ POST. GET (81-149) รับ query string ได้หลายชื่อ (`menuKey`/`menu_key`/`reportKey`..., `dateFrom`/`date_from`/`doc_date_from`, `fromCode`/`toCode`) ส่วนที่เหลือรวมเป็น `options`; POST (151-162) ส่ง body ต่อทั้งก้อน. `forwardReportRun` (32-79) เติม `total_vat_amount` และ `total_base_amount` ให้ผลลัพธ์จากแถว `totals` ถ้า backend ไม่ส่งมา.
- `report/pdf` (`report/pdf/route.ts`) ใช้ `REPORT_CODE_ALIASES` (12-26) แปลงชื่อเดียวกัน, เติม `title` จากข้อความเมนู (`getMenuTextByName`, 52-57), ใช้ `fetch` ตรง (58-66) แล้วคืนไฟล์ `application/pdf` พร้อม `Content-Disposition` ของ backend (ถ้าไม่มีใช้ `inline; filename="bc_report.pdf"`) และ `Cache-Control: no-store` (83-94); error ใช้ `fail` (68-81).
- `itempicture/image` และ `docpicture/image` เป็น GET `?id=<เลขตัวเลข 1-12 หลัก>` (ไม่ตรงรูปแบบ -> 400): ตรวจ session แล้วดึงรูปจาก backend และกำหนด `Content-Type` ด้วย `safeMediaContentType` (`api-server.ts:42-61`: รูป png/jpeg/gif/webp/bmp/avif/icon, PDF, Excel, Word, PowerPoint, csv, txt, zip, json นอกนั้นคืน `application/octet-stream`) พร้อม `X-Content-Type-Options: nosniff` และ `Cache-Control: private, max-age=300` (`itempicture/image/route.ts:13-39`).

**กลุ่มอื่นที่ account ใช้**
- `/api/auth/*` - [[fe-auth-session]].
- `/api/workspace/[...path]` (`workspace/[...path]/route.ts`) - GET: `databases`, `check-db-name`, `members`, `screen-rights`, `my-screen-rights`; POST: `databases`, `select-db`, `members`; PUT: `screen-rights`; DELETE: `members`; GET ที่ไม่ตรงชื่อใด -> 404 (บรรทัด 190). ส่งไป `/api/v1/admin/workspace/*` (ยกเว้น `screen-rights` ที่ไป `/api/v1/admin/menu-permissions`) พร้อม header `X-Admin-Api-Key` (`getAdminHeaders` 16-22). `isWorkspaceAdmin` (28-62) ตรวจว่าผู้เรียกเป็น admin ของฐานนั้นก่อน GET `members` (118), GET `screen-rights` (136) และ PUT `screen-rights` (386) ไม่ใช่ -> `403 FORBIDDEN_NOT_ADMIN` (64-65); POST/DELETE `members` ส่ง `actor_email` กับ `actor_user_code` ของผู้เรียกไปให้ backend ตัดสินสิทธิ์ (336-352, 424-434). `my-screen-rights` ของ Demo หรือผู้ใช้ `ADMIN`/`userLevel >= 9` ตอบ `is_admin: true` ทันทีโดยไม่เรียก backend (156-165), คนอื่นเรียก `/admin/workspace/my-screen-rights` แล้วกรองเมนูเฉพาะผู้ดูแลออกด้วย `isAdminOnlyMenu` (182-186; ตอน PUT ก็กรอง 388). ไม่ได้ตั้ง `ADMIN_API_KEY` -> `adminApiKeyMissing` (83, 166, 205, 381, 422). ดู [[fe-login-select-database]] สำหรับหน้าจอที่เรียก.
- `/api/help` (`help/route.ts`) - ไม่ผ่าน backend และไม่เรียก `requireSession`; ใช้ดัชนีในหน่วยความจำที่สร้างครั้งเดียว (`ensureIndexesInitialized` 101-103) จากไฟล์ JSON 5 ไฟล์ที่ import ไว้ (`common`, `ic`, `ar_ap`, `trans`, `gl_tax`, บรรทัด 5-9) กับ `bc_phrases.json` และ `bc_fields.json` ที่อ่านด้วย `fs` จาก `src/config/help/data/` (109-141). GET `?keys=a|b&lang=th|en` (หรือ `key=`) รับสูงสุด 8 คีย์ยาวไม่เกิน 120 ตัวอักษร คืน `{ entry }` หรือ `{ entry: null }` (ไม่ใช่ envelope `ok`) พร้อม `Cache-Control: public, max-age=300, stale-while-revalidate=600` (291-333). POST `{ texts, codes }` แปลข้อความไทยเป็นอังกฤษได้สูงสุด 400 ข้อความและเปิดชื่อฟิลด์จากรหัสได้สูงสุด 200 รหัส คืน `{ translations, codes }` (340-382; error คืนค่าว่าง) - ผู้เรียก POST คือ `GlobalLanguageTranslator` ([[fe-app-shell-routing]]).
- `/api/admin/*` - [[fe-admin-console]].
- `/api/pos/[...path]` (`pos/[...path]/route.ts`) - proxy ไป `/api/v1/pos/*` (GET และ POST, บรรทัด 54, 95) ใช้กับ `account/pos/PosSetupAndControlScreen.tsx`: ปฏิเสธ path ที่มีส่วนว่าง `.` หรือ `..` (32-34), ใช้ token ของ session เป็นหลักและยอมรับ `Authorization: Bearer bcpos1.<โทเคนอุปกรณ์>` เมื่อไม่มี session (41-51), ถ้าโทเคนอุปกรณ์ได้ 401 จะลองสลับไปใช้ token ของ session อีกครั้งถ้ามี (66-77), ส่งต่อ header `content-type`, `x-pos-pending-bills`, `x-pos-app-version` (18), และบีบ gzip คำตอบ JSON ที่เกิน 1 KB เมื่อผู้เรียกรับ gzip (85-88).
- route ของระบบอื่น (ai, autocare, crm, dashboard, etax, fraudwarning, lineoa, market, mcp, monitormap, procure, tms, wms, workmonitor) อยู่นอกขอบเขตโน้ตชุดนี้ จึงไม่ได้อ่าน.

**ข้อควรระวัง**
- เพิ่ม action ใหม่ที่ backend ต้องเพิ่มชื่อใน `ACTIONS` ของ route ด้วย ไม่งั้นได้ 404 ฝั่ง Next.js.
- production ต้องตั้ง env `ADMIN_API_KEY` ไม่งั้น route ที่ endpoint มี `/admin` และ `/api/workspace` ตอบ 503 `NO_ADMIN_API_KEY`; นอก production `getAdminApiKey` (74-79) ใช้กุญแจสำรองสำหรับเครื่องพัฒนา.
- ฝั่ง Next.js ตรวจแค่ session, whitelist และ SQL ใน `query/limit`; สิทธิ์รายเมนูและข้อมูลต่อฐานตัดสินที่ backend ตาม token ([[backend-overview]]).

## ที่มาในโค้ด
- `frontend/src/lib/api-server.ts:22-23,34-36,42-61,63-65` - `SERVICE_BASE_URL`, ok/fail, `safeMediaContentType`
- `frontend/src/lib/api-server.ts:74-86,262-274,393-397,402-504,510-563,569` - admin key, `requireSession`, retry, `proxyToService`, `getValidAccessToken`
- `frontend/src/app/api/process/trans/[action]/route.ts:11-38` - โครง route มาตรฐาน (ACTIONS อยู่บรรทัด 11/12 ของทุก `process/*/[action]/route.ts`)
- `frontend/src/app/api/process/workflow/[action]/route.ts:12-32` - รายการ action ของ workflow
- `frontend/src/app/api/process/stocktools/[action]/route.ts:12` - รายการ action ของเครื่องมือสต็อก
- `frontend/src/app/api/process/tax/rebuild/route.ts:20-37` - เติมฐานข้อมูลจาก session
- `frontend/src/app/api/process/report/run/route.ts:12-79,81-162` - alias, `forwardReportRun`, GET/POST
- `frontend/src/app/api/process/report/pdf/route.ts:12-95` - alias, ดึงและส่งไฟล์ PDF
- `frontend/src/app/api/process/itempicture/image/route.ts:13-43` - ดึงรูปสินค้า (`docpicture/image/route.ts` โครงเดียวกัน)
- `frontend/src/app/api/query/limit/route.ts:12-88` - ตรวจ SQL และ pagination
- `frontend/src/app/api/workspace/[...path]/route.ts:16-65,83-190,193-205,369-390,409-436` - สิทธิ์ผู้ดูแลฐานและ sub-path
- `frontend/src/app/api/help/route.ts:101-141,291-382` - ดัชนีช่วยเหลือ, GET/POST
- `frontend/src/app/api/pos/[...path]/route.ts:17-95` - proxy POS

## ดูเพิ่ม
[[frontend-overview]] · [[fe-auth-session]] · [[fe-query-client-sql-builder]] · [[process-overview]] · [[backend-overview]]
