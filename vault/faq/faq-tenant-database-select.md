---
title: "ระบบแยกบริษัท/ฐานข้อมูล (tenant, provider, company) อย่างไร และเลือกบริษัทตอน login อย่างไร"
tags: [faq, multi-tenant, login, database, backend]
aliases: ["tenant","provider code","multi-tenant","เลือกบริษัทตอน login","select-company","preAuthToken","databaseName claim","bcerpmain","bc_database_list","select-database"]
sources: ["backend/internal/domain/tenant/provider.go:21", "backend/internal/application/identity/service.go:20", "backend/internal/application/identity/service.go:51", "backend/internal/adapter/outbound/identity/postgres_repository.go:132", "backend/internal/adapter/outbound/identity/jwt_token_service.go:31", "backend/internal/platform/db/pool.go:190", "backend/internal/adapter/inbound/http/admin/workspace_google.go:674", "backend/internal/adapter/inbound/http/mcp/token.go:241", "frontend/src/app/login/page.tsx:171", "frontend/src/app/select-database/page.tsx:224"]
---
# ระบบแยกบริษัท/ฐานข้อมูล (tenant, provider, company) อย่างไร

**ตอบสั้น:** 1 ลูกค้า = 1 Provider (รหัสพิมพ์ใหญ่/เลข 2-20 ตัว) มี PostgreSQL ของตัวเอง ภายในมี Main Database `bcerpmain<รหัส provider พิมพ์เล็ก>` เก็บผู้ใช้/สิทธิ์/รายชื่อบริษัท และแต่ละบริษัทมี Company Database แยกเป็นของตัวเอง ชื่อฐานของบริษัทที่เลือกถูกฝังใน JWT claim `databaseName` แล้วทุกคำขอ (`/query`, `/process`, `/blob`) เปิด pool ไปฐานนั้นจาก claim เท่านั้น ไม่รับจาก body

## รายละเอียด
**ศัพท์:** Provider (`tenantId` ใน JWT) → Main DB → Company (`data_code`, `data_group` ใน `bc_database_list`) → Company DB (`data_database_name`) ดูภาพรวมที่ [[be-multi-tenant]]

**ข้อมูลการเชื่อมต่อ:** เก็บเป็นไฟล์ JSON ต่อ provider ใน `CONFIG_DIR` ([[be-provider-registry]])

**ลำดับ login แบบรหัสผ่าน** (`POST /auth/login`, `Service.Login` `service.go:51`):
1. ส่ง `provider` + `dataGroup` + `username` + `password` → หา connection ของ provider → คำนวณ Main DB = `"bcerpmain" + lower(provider)` (`service.go:20`, สูตรตายตัว)
2. อ่านผู้ใช้จาก `bc_user_list` (ไม่สนตัวพิมพ์) แล้วตรวจรหัสผ่าน ([[be-identity-login-flow]])
3. `AccessibleCompanies` (`postgres_repository.go:132`) หาบริษัทที่ผู้ใช้เข้าได้จาก `bc_database_list_user_and_group` JOIN `bc_database_list` เงื่อนไข `user_or_group_status = 0` เรียงตาม `roworder` เฉพาะสิทธิ์ที่ให้ตรงกับรหัสผู้ใช้ ไม่ขยายตามสมาชิกกลุ่ม (`:128-130`, SQL `:138-145`)
4. 0 บริษัท → 403 · **1 บริษัท** → ออก access+refresh token ทันที · **หลายบริษัท** → ออก `preAuthToken` พร้อมรายชื่อ ให้ผู้ใช้เลือกที่ `POST /auth/select-company` (ระบบคิวรีรายการใหม่อีกรอบ ไม่เชื่อรายการที่ client ถือ)

**ทางเข้าของหน้าเว็บ:** หน้า `/login` มีปุ่มทดลองใช้ (Demo) กับ Google ปุ่ม Demo เรียก `/api/auth/demo` แล้วเข้าระบบเลย (`login/page.tsx:171-185`) ส่วน Google ไปหน้า `/select-database` เพื่อเลือก/สร้างบริษัท (`login/page.tsx:205-207`) หน้านั้นเรียก `/api/workspace/select-db` (`select-database/page.tsx:224`) ซึ่งตรวจสิทธิ์ของผู้ใช้ต่อฐานที่เลือก ไม่มีสิทธิ์ตอบ 403 แล้วออก token ชุดเดียวกันด้วยบริษัทที่เลือก (`WorkspaceSelectDatabase` `workspace_google.go:674`) ดู [[fe-login-select-database]]

**ตอนใช้งาน:** `PoolManager.Get(databaseName, dsn)` (`pool.go:190`) แคช pool ต่อ `host|port|user|db` จึงฐานเดียวกันใช้ pool เดียว

## ข้อควรระวัง
- `level` ใน token คือค่า ณ ตอนออก token อัปเดตเมื่อ select-company/refresh เท่านั้น ([[faq-session-logout-expired]])
- ชื่อฐานที่ขึ้นต้น `bcerpmain` สงวนไว้ Main DB ห้ามใช้เป็นฐานบริษัท การสร้างฐานใน workspace (`workspace_google.go:348`), การเพิ่มฐานในหน้า admin (`admin/handler.go:480`) และการสร้าง token MCP (`ValidateCreateInput` `mcp/token.go:241`) ปฏิเสธชื่อแบบนี้

## ดูเพิ่ม
- [[be-multi-tenant]]
- [[be-identity-login-flow]]
- [[be-jwt-session-tokens]]
- [[be-db-pool-manager]]
- [[fe-login-select-database]]
- [[faq-new-company-setup]]

## ที่มาในโค้ด
- `backend/internal/domain/tenant/provider.go:21` รูปแบบรหัส provider `^[A-Z0-9]{2,20}$`
- `backend/internal/application/identity/service.go:20` ค่าคงที่ prefix `bcerpmain` (ใช้ที่บรรทัด 57)
- `backend/internal/application/identity/service.go:51` `Login` (0/1/หลายบริษัท) และ `SelectCompany` ที่บรรทัด 113
- `backend/internal/adapter/outbound/identity/postgres_repository.go:132` `AccessibleCompanies` (SQL บรรทัด 138-145)
- `backend/internal/adapter/outbound/identity/jwt_token_service.go:31` claims `tenantId`, `companyCode`, `databaseName`
- `backend/internal/platform/db/pool.go:190` `PoolManager.Get`
- `backend/internal/adapter/inbound/http/admin/workspace_google.go:674` `WorkspaceSelectDatabase` ออก session ด้วยบริษัทที่เลือก, `:348` ชื่อสงวน
- `backend/internal/adapter/inbound/http/admin/handler.go:480` ตรวจชื่อฐานที่ห้ามขึ้นต้น `bcerpmain`
- `backend/internal/adapter/inbound/http/mcp/token.go:241` MCP token ห้ามอ้างฐาน `bcerpmain`
- `frontend/src/app/login/page.tsx:171`, `:205-207`; `frontend/src/app/select-database/page.tsx:224`
