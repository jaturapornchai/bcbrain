---
title: "ตัวกระจายคำขอของ process (Process dispatcher)"
tags: [process, router, handler, dispatcher, multi-tenant]
aliases: ["process dispatcher", "/process route", "/api/v1/process", "กระจาย action", "ไม่มี process.go"]
sources: ["backend/internal/adapter/inbound/http/router.go:40", "backend/internal/adapter/inbound/http/router.go:127", "backend/internal/adapter/inbound/http/router.go:168", "backend/internal/adapter/inbound/http/process/handler.go:19", "backend/internal/adapter/inbound/http/process/stocktools_handler.go:23", "backend/internal/application/process/service.go:531", "backend/internal/application/process/service.go:950"]
---

# ตัวกระจายคำขอของ process (Process dispatcher)

ในโค้ดไม่มีไฟล์ `process.go` ที่เป็น dispatcher กลาง การกระจายคำขอเกิดจาก 2 ชั้น: route group ใน `router.go` (จับ URL) และ `*_handler.go` ใน `adapter/inbound/http/process/` (switch ตาม `{action}`) แล้วเรียกเมธอดของ `*appprocess.Service` ใน `application/process/`

## ทำงานอย่างไร

เส้นทางของคำขอ: `HTTP POST` -> `Auth` (ตรวจ JWT) -> `RequireRight` (ตรวจสิทธิ์เมนู ดู [[proc-permission-rights]]) -> handler -> `Service` -> ฐานข้อมูลของบริษัท

- ลงทะเบียน route 2 ชุดที่เหมือนกันทุกบรรทัด: `/process` และ `/api/v1/process` (ใช้ middleware เดียวกัน `Auth` + `RequireRight(ex.Rights, processhttp.RequiredRight)`)
- route แบบตรง (1 URL = 1 handler): เช่น `/report/run`, `/report/pdf`, `/doc/cancel`, `/doc/approve`, `/doc/flow`, `/lookup/party-filter`, `/lookup/ref-doc-filter`, `/lookup/wh-filter`, `/lookup/wh-pick-check`, `/lookup/wh-perm-filter`
- route แบบกลุ่ม `/{กลุ่ม}/{action}` ที่ handler ใช้ `switch chi.URLParam(r, "action")`:

| กลุ่ม | handler | รายการ action ที่มีใน switch |
|---|---|---|
| `barcode` | `Barcode` | `item`, `save`, `discount-load`, `discount-save`, `ean13-check`, `ean13-generate`, `ean13-apply`, `print-items`, `format` |
| `transgrid` | `TransGrid` | `line`, `formula`, `totals`, `shortcut`, `priceinfo`, `fx`, `refimport` |
| `master` | `Master` | `nextcode`, `codeleave`, `assetdepdefaults`, `datalistget`, `datalistsave` |
| `master-detail` | `MasterDetail` | `save`, `delete` เท่านั้น (อื่น ๆ ตอบ not found) |
| `docpicture` | `DocPicture` | `formats`, `docs`, `get`, `save` (+ `GET /docpicture/image`) |
| `itempicture` | `ItemPicture` | `list`, `get`, `save` (+ `GET /itempicture/image`) |
| `itemdetail` | `ItemDetail` | `get`, `save` |
| `itemmaster` | `ItemMaster` | `save`, `delete` |
| `modifyprice` | `ModifyPrice` | `preview`, `apply` (เมนู 2.1.25), action อื่นตอบ not found |
| `stocktools` | `StockTools` | `formats`, `barcodecheck`, `serialanalyze`, `serialscan`, `lotamountload/save`, `hiddencost*`, `lotauto*`, `notcounted*`, `itemnextcode`, `stockbeginning*`, `docnonext`, `checkpricesave`, `pointdoc*`, `itemsaved` |
| `workflow` | `Workflow` | `change-code`, `journal-list/pass`, `gl-check`, `gl-close`, `fa-depreciation`, `asset-sale`, `audit-list`, `check-ic-trans`, `point-recal`, `import-transport-label`, `province-list/load`, `ai-*` |

- action ที่ไม่รู้จัก: `Master` / `MasterDetail` ตอบ `apperr.KindNotFound` (ข้อความ "unknown master action" / "unknown master-detail action")
- ตัวช่วยกลาง `serve[I, P]` (generic) ถอด JSON เข้า struct `I`, **ประทับ session** (`SetScope(provider, database, user)`) แล้วเรียก `fn`, ตอบ `{"ok": true, "data": ...}`; ผิดพลาดบันทึก `h.log.Warn()` แล้วส่ง `response.Error`
- handler รุ่นเก่าใช้ `serveTrans` (ตอบ `TransResult` พร้อม log provider/company/user/docNo)
- ขนาด body: `maxJSONBody = 16 << 20` (16 MB); รูปสินค้าใช้ `itemPictureBodyLimit = 48 << 20`

### Multi-tenant
- ค่า `ProviderCode`, `DatabaseName`, `Username` มาจาก JWT claims เสมอ ไม่อ่านจาก body (struct ใช้ tag `json:"-"` เช่น `RunReportInput`)
- `Service.companyPool(ctx, providerCode, databaseName)` แปลง provider -> connection, สร้าง/ใช้ pool ของ database บริษัทซ้ำ (`db.PoolManager`) และรัน `erpSchemaSQL` ครั้งเดียวต่อ database (เก็บใน `sync.Map erpSchema`) เพื่อสร้างตาราง/ดัชนีที่ขาด
- `Service` เก็บ `connections`, `pools` และ cache ใน `sync.Map` (`erpSchema`, `posSchema`, `posSeedDone`, `posDrains`)

## จุดที่ต้องระวัง
- route ใหม่ที่ไม่ได้เพิ่มใน `routeRights` จะต้องใช้สิทธิ์ Admin โดยปริยาย (ดู [[proc-permission-rights]])
- คำขอที่ไม่มี token ที่ถูกต้องถูก `Auth` ตอบ `KindUnauthorized` (`middleware/auth.go:44-50`, test ยืนยัน 401 ที่ `auth_test.go:42`); handler ตรวจ claims ซ้ำอีกชั้น
- กลุ่ม trans/gl/stock/cost/ap/pay ฯลฯ อยู่ใน route group เดียวกัน แต่เป็นขอบเขตของโน้ตบัญชี ดู [[accounting-overview]]

## ที่มาในโค้ด
- `backend/internal/adapter/inbound/http/router.go:40-57` - struct `ExtraHandlers` (มี `Process *processhttp.Handler`)
- `backend/internal/adapter/inbound/http/router.go:127-167` - `r.Route("/process", ...)` พร้อม `Auth` + `RequireRight`
- `backend/internal/adapter/inbound/http/router.go:168-209` - `r.Route("/api/v1/process", ...)` ชุดเดียวกัน
- `backend/internal/adapter/inbound/http/process/handler.go:19` - `maxJSONBody`
- `backend/internal/adapter/inbound/http/process/handler.go:189` - `serveTrans`
- `backend/internal/adapter/inbound/http/process/stocktools_handler.go:23` - ฟังก์ชัน generic `serve`
- `backend/internal/adapter/inbound/http/process/master_handler.go:17-38` - switch action ของ `Master`
- `backend/internal/adapter/inbound/http/process/master_detail_handler.go:15` - `MasterDetail`
- `backend/internal/adapter/inbound/http/process/docpicture_handler.go:111-135` - `ModifyPrice` (preview|apply)
- `backend/internal/adapter/inbound/http/middleware/auth.go:44` - `Auth` ตอบ Unauthorized
- `backend/internal/adapter/inbound/http/process/workflow_handler.go:18` - `Workflow`
- `backend/internal/application/process/service.go:531-546` - struct `Service` และ `NewService`
- `backend/internal/application/process/service.go:950` - `companyPool`

## ดูเพิ่ม
- [[process-overview]]
- [[proc-permission-rights]]
- [[proc-report-engine]]
- [[proc-workflow]]
- [[backend-overview]]
