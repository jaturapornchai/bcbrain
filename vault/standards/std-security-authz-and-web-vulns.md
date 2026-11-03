---
title: "เช็กลิสต์ความปลอดภัย API: ตัวตน สิทธิ์ และช่องโหว่เว็บ (Secure API Checklist)"
tags: [standards, security, api, frontend, backend, checklist]
aliases: ["safeReturnPath", "open redirect", "escapePopupHtml", "stored XSS", "safeMediaContentType", "ValidateClientInsert", "write policy", "idToken aud email_verified", "isWorkspaceAdmin", "requireAdmin", "ตัวตนมาจาก token", "routeRights", "RequireRight", "default deny", "write lockdown", "money table"]
sources: [".agents/skills/secure-api-data-integrity-checklist/SKILL.md:12-33", ".agents/skills/secure-api-data-integrity-checklist/SKILL.md:35-40", ".agents/skills/secure-api-data-integrity-checklist/SKILL.md:57-58", "docs/kms/KMS_SECURITY_DATA_INTEGRITY_LESSONS.md:11-31", "docs/kms/KMS_SECURITY_DATA_INTEGRITY_LESSONS.md:100-101", "AGENTS.md:61", "frontend/src/lib/safe-return.ts:6-14", "frontend/src/app/login/page.tsx:168", "frontend/src/app/select-database/page.tsx:250", "frontend/src/lib/api-server.ts:42", "frontend/src/lib/api-server.ts:74-85", "frontend/src/lib/api-server.ts:277", "frontend/src/app/api/auth/google/route.ts:229-260", "frontend/src/app/api/workspace/[...path]/route.ts:28", "frontend/src/app/api/workspace/[...path]/route.ts:342-347", "frontend/shared/ui/BcMapPickerModal.tsx:185", "frontend/src/app/api/crm/image/route.ts:62-68", "backend/internal/domain/query/write_policy.go:8-12", "backend/internal/domain/query/write_policy.go:57-73", "backend/internal/domain/query/write_policy_legacy.go:5-60", "backend/internal/adapter/inbound/http/blob/handler.go:98", "backend/internal/adapter/inbound/http/monitormap/handler.go:116-124", "backend/internal/adapter/inbound/http/process/permission.go:20-23", "backend/internal/adapter/inbound/http/process/permission.go:129-132", "backend/internal/adapter/inbound/http/middleware/permission.go:13-40", "backend/internal/adapter/inbound/http/middleware/permission.go:62-80"]
---

# เช็กลิสต์ความปลอดภัย API (ตัวตน/สิทธิ์/ช่องโหว่เว็บ)

ไล่ให้ครบก่อน commit ทุกครั้งที่สร้างหรือแก้ route ใน `frontend/src/app/api/**` และ Go handler ใน `backend/internal/adapter/inbound/http/**` (กฎข้อ 9, 10, 20; ข้อ 20 อยู่ที่ `AGENTS.md:61`) ส่วนเงิน/transaction ดู [[std-data-integrity-money-transactions]] (หมวด C ของ skill, ข้อ 9–16, `SKILL.md:25-33`) บั๊กจริงที่มาของแต่ละข้อดู [[std-security-lessons-idor]]

## A. ตัวตนและสิทธิ์ (AuthN/AuthZ) — `SKILL.md:13-18`
1. **ตัวตนต้องมาจากสิ่งที่ตรวจแล้วเท่านั้น** ห้ามรับ `email`/`userCode`/`database` จาก body มาสร้าง session — Google ID Token ต้องมี `idToken` (`auth/google/route.ts:229`), `aud` ต้องอยู่ในรายการ Client ID ของเว็บ (`:252`) และ `email_verified` เป็น `true` (`:255`)
2. **Route ที่เรียก backend ด้วยกุญแจ Admin (header `X-Admin-Api-Key`)** ต้องตรวจสิทธิ์ Admin ของผู้เรียกฝั่ง server ก่อน — `requireAdmin()` (`api-server.ts:277`) หรือ `isWorkspaceAdmin()` (`src/app/api/workspace/[...path]/route.ts:28`, ผู้ใช้สาธิตถูกปฏิเสธ) แค่มี session ไม่พอ
3. **ค่า actor (`actor_email`, `actor_user_code`) เขียนทับหลัง spread body** เช่น `...body` แล้วตามด้วย `actor_email: session.email` (`workspace/[...path]/route.ts:342-347`)
4. **Route ที่ไม่ต้อง login ห้ามให้ผู้เรียกเลือก tenant/ฐานข้อมูลเอง** — `resolveClaims` ของ `monitormap/handler.go:116-124` ตรึงที่ `bcdemo` เมื่อไม่มี claims
5. **`/blob/insert` และ `/query/exec` ใช้ write policy เดียวกัน** (`blob/handler.go:98` เรียก `domainquery.ValidateClientInsert`; `/query/exec` เรียก `ValidateClientPolicy` ใน `application/query/service.go:106`, `:147`)
6. **ปิดตามเดิมเมื่อไม่มีกุญแจ**: `getAdminApiKey()` (`api-server.ts:74`) ไม่ส่งกุญแจ dev ใน production และตอบ 503 `NO_ADMIN_API_KEY` (`:85`)

## B. ช่องโหว่ฝั่งเว็บ — `SKILL.md:20-23`
7. **returnTo / redirect** ใช้ `safeReturnPath()` (`frontend/src/lib/safe-return.ts:6`) เสมอ — ปฏิเสธค่าที่ขึ้นต้น `//` หรือ `/\`, ที่มี `\` และตัวอักษรควบคุม (มี unit test `safe-return.test.ts`); ใช้อยู่ใน `login/page.tsx:168` และ `select-database/page.tsx:250`
8. **HTML string** ที่เข้า `innerHTML`, Leaflet `bindPopup`, `dangerouslySetInnerHTML` ต้อง escape ข้อมูลจาก DB ทุกช่อง (`escapePopupHtml`, `BcMapPickerModal.tsx:185`)
9. **ไฟล์อัปโหลดที่ส่งต่อให้เบราว์เซอร์** ใช้ `safeMediaContentType()` (`api-server.ts:42`) คู่กับ `X-Content-Type-Options: nosniff` — ใช้จริงใน `api/crm/image` (`:62`, `:68`), `api/process/docpicture/image`, `api/process/itempicture/image` (`:35-36`) ห้ามปล่อย `text/html`/`image/svg+xml`
10. อ่านไฟล์จาก MinIO ไม่สำเร็จ ห้ามเขียนรูป placeholder ทับ key เดิม (`SKILL.md:28`)

## C. ชั้นป้องกันฝั่ง Go backend (ตรวจกับโค้ด 2026-11-03)
**1) สิทธิ์ต่อ route แบบ default-deny** — `routeRights` แมป `"<group>/<action>"` ใต้ `/process` เป็นสิทธิ์ของเมนู และ **route ที่ไม่อยู่ในแมปต้องเป็น Admin** จึงล็อกไว้จนกว่าจะมีคนจัดประเภท (`process/permission.go:20-23`, `:129-132`) สิทธิ์ที่มี: `Read`, `Write` (Add หรือ Edit), `Delete`, `Admin`, `Add`, `Edit` (`middleware/permission.go:13-22`); Admin ผ่านทุกด่าน (`:41-43`); ไม่ผ่านตอบ 403 ข้อความไทย (`:62-80`)
- body-dependent: บันทึกเอกสาร/`itemmaster/save` ที่เป็นรายการใหม่ใช้ `Add` ไม่ใช่ใช้ `Edit` (`permission.go:81-86`); `report/run` และ `report/pdf` ที่มี `customSql` ต้อง Admin ([[std-report-engine-standard]]); `/query/exec`, `/query/execBatch`, `/blob/insert` ตรวจสิทธิ์ผ่าน `QueryRequiredRight` (`:135-`)

**2) นโยบายเขียนจากเบราว์เซอร์ (write lockdown)** — ตารางเงิน/สต็อก/GL เขียนได้เฉพาะ endpoint ฝั่ง Go ที่ทำกฎธุรกิจในธุรกรรมเดียว (`write_policy.go:8-12`; ADR `0011-query-exec-write-lockdown`)
- `isMoneyTable` ตรง regex ของตารางเอกสาร/เช็ค/GL/ล็อต (`ic_trans*`, `ap_ar_trans*`, `as_trans*`, `cb_trans*`, `gl_journal*` ฯลฯ, `:24`) ยกเว้น master บางตัว (`gl_journal_book`, `:27`) → คืน `ErrMoneyTableViaExec`
- `ic_inventory` ห้ามเขียนคอลัมน์ยอดคงเหลือ/ต้นทุนที่ระบบ rebuild เป็นเจ้าของ (`balance_qty`, `average_cost`, `item_in_stock` ฯลฯ, `:30-31`)
- ผู้ใช้ระดับต่ำกว่า 9 เขียนได้เฉพาะตารางใน allow-list เดิม (`write_policy_legacy.go:5-60`) และห้ามแตะตารางระบบ (`bc_user_list`, `bc_database_list*`, `erp_option`, `query.go:63`) → `ErrAdminOnlyWrite`
- SQL ที่ระบุตารางเป้าหมายไม่ได้ และตัวระบุแบบ `U&"…"` ถูกปฏิเสธทั้งหมด (`write_policy.go:77-103`)

## ตัวอย่าง
```ts
import { safeReturnPath } from "@/lib/safe-return";
router.replace(safeReturnPath(new URLSearchParams(location.search).get("returnTo")));
```
กฎความลับทั่วไป (ห้ามใส่รหัส/Token ใน repo, ใช้ env) อยู่ที่ [[std-repo-scope-rules]]

## ข้อควรระวังการตรวจ backend (`SKILL.md:35-36`, `KMS_SECURITY_DATA_INTEGRITY_LESSONS.md:105-107`)
- เครื่องที่มีแค่ Go 1.24 (`go.mod` ต้องการเวอร์ชันใหม่กว่า) ให้ type-check ในสำเนา scratch ที่ใส่ `replace` ให้ dependency ห้ามแก้ `go.mod` จริง แล้วรัน `go vet ./... && go test ./internal/...`
- Unit test frontend: `node --experimental-strip-types --test` กับไฟล์ `*.test.ts`
- รายการที่ต้องตัดสินใจเชิงออกแบบ ห้ามแก้เองโดยไม่ถามลุงจืด (กฎข้อ 14); KMS ระบุว่าไม่มีรายการค้างเมื่อสิ้นรอบ (`KMS…LESSONS.md:100-101`)

## ที่มา
- `.agents/skills/secure-api-data-integrity-checklist/SKILL.md` Workflow A–C, Config, Limitation
- `docs/kms/KMS_SECURITY_DATA_INTEGRITY_LESSONS.md` ตาราง S1–S5, B1–B2, B7
- อ่านโค้ดจริง: `write_policy*.go`, `process/permission.go`, `middleware/permission.go`

## ดูเพิ่ม
[[standards-overview]] · [[std-security-lessons-idor]] · [[std-data-integrity-money-transactions]] · [[std-platform-google-login-pdpa-hub]] · [[std-report-engine-standard]] · [[backend-overview]]
