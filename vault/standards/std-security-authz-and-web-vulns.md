---
title: "เช็กลิสต์ความปลอดภัย API: ตัวตน สิทธิ์ และช่องโหว่เว็บ (Secure API Checklist)"
tags: [standards, security, api, frontend, backend, checklist]
aliases: ["safeReturnPath", "open redirect", "escapePopupHtml", "stored XSS", "safeMediaContentType", "ValidateClientInsert", "write policy", "idToken aud email_verified", "isWorkspaceAdmin", "requireAdmin", "ตัวตนมาจาก token"]
sources: [".agents/skills/secure-api-data-integrity-checklist/SKILL.md", "docs/kms/KMS_SECURITY_DATA_INTEGRITY_LESSONS.md", "AGENTS.md", "frontend/src/lib/safe-return.ts", "frontend/src/lib/api-server.ts", "frontend/shared/ui/BcMapPickerModal.tsx", "backend/internal/domain/query/write_policy.go", "backend/internal/adapter/inbound/http/blob/handler.go"]
---

# เช็กลิสต์ความปลอดภัย API (ตัวตน/สิทธิ์/ช่องโหว่เว็บ)

ไล่ให้ครบก่อน commit ทุกครั้งที่สร้างหรือแก้ route ใน `frontend/src/app/api/**` และ Go handler ใน `backend/internal/adapter/inbound/http/**` (กฎข้อ 9, 10, 20 ใน `AGENTS.md`) ส่วนเงิน/transaction ดู [[std-data-integrity-money-transactions]]

## A. ตัวตนและสิทธิ์ (AuthN/AuthZ)
1. **ตัวตนต้องมาจากสิ่งที่ตรวจแล้วเท่านั้น** — ห้ามรับ `email`/`userCode`/`database` จาก body มาสร้าง session; Google ID Token ต้องตรวจ `aud` = Client ID ของเว็บ และ `email_verified === true`
2. **Route ที่เรียก backend ด้วยกุญแจ Admin (header `X-Admin-Api-Key`)** ต้องตรวจสิทธิ์ Admin ของผู้เรียกฝั่ง server ก่อน (`requireAdmin()` หรือ `isWorkspaceAdmin()` ใน `src/app/api/workspace/[...path]/route.ts`) — แค่มี session ไม่พอ
3. **ค่า actor (`actor_email`, `actor_user_code`) เขียนทับหลัง spread body** เช่น `{ ...body, actor_email: session.email }` ห้ามให้ผู้ใช้ปลอม
4. **Route ที่ไม่ต้อง login ห้ามให้ผู้เรียกเลือก tenant/ฐานข้อมูลเอง** ให้ตรึงที่ฐานสาธิต `bcdemo`
5. **`/blob/insert` และ `/query/exec` ใช้ write policy เดียวกัน** (`domainquery.ValidateClientInsert` / `ValidateClientPolicy` ใน `write_policy.go`): ตารางเงิน/สต็อก/GL ห้ามเขียนตรงจากเบราว์เซอร์

## B. ช่องโหว่ฝั่งเว็บ
6. **returnTo / redirect** ใช้ `safeReturnPath()` (`frontend/src/lib/safe-return.ts`, มี unit test) เสมอ (ใช้ใน `login/page.tsx` และ `select-database/page.tsx`)
7. **HTML string** ที่เข้า `innerHTML`, Leaflet `bindPopup`, `dangerouslySetInnerHTML` ต้อง escape ข้อมูลจาก DB ทุกช่อง (`escapePopupHtml` ใน `BcMapPickerModal.tsx`)
8. **ไฟล์อัปโหลดที่ส่งต่อให้เบราว์เซอร์** ใช้ `safeMediaContentType()` (`frontend/src/lib/api-server.ts`) อนุญาตเฉพาะรูป raster + PDF พร้อม `X-Content-Type-Options: nosniff` (ใช้กับ `api/crm/image`, `process/docpicture/image`, `process/itempicture/image`)
9. อ่านไฟล์จาก MinIO ไม่สำเร็จ ห้ามเขียนรูป placeholder ทับ key เดิม (แสดง placeholder แต่ไม่บันทึกทับ)

## ตัวอย่าง
```ts
import { safeReturnPath } from "@/lib/safe-return";
router.replace(safeReturnPath(new URLSearchParams(location.search).get("returnTo")));
```
กฎความลับทั่วไป (ห้ามใส่รหัส/Token ใน repo, ใช้ env) อยู่ที่ [[std-repo-scope-rules]]

## ข้อควรระวังการตรวจ backend
- เครื่องที่มีแค่ Go 1.24 (go.mod ต้องการเวอร์ชันใหม่กว่า) ให้ type-check ในสำเนา scratch ที่ใส่ `replace` ให้ dependency ห้ามแก้ `go.mod` จริง แล้วรัน `go vet ./... && go test ./internal/...`
- Unit test frontend ใช้ `node --experimental-strip-types --test` กับไฟล์ `*.test.ts`
- ปัญหาที่ยังเปิดอยู่ที่ต้องตัดสินใจเชิงออกแบบ ห้ามแก้เองโดยไม่ถามลุงจืด (KMS ระบุสถานะปัจจุบันว่าไม่มีรายการค้าง)

## ที่มา
- `.agents/skills/secure-api-data-integrity-checklist/SKILL.md` Workflow A–B
- `docs/kms/KMS_SECURITY_DATA_INTEGRITY_LESSONS.md` ตาราง S1–S5, B1, B2, B7

## ดูเพิ่ม
[[standards-overview]] · [[std-security-lessons-idor]] · [[std-data-integrity-money-transactions]] · [[std-platform-google-login-pdpa-hub]] · [[backend-overview]]
