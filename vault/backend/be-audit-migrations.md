---
title: "ไฟล์ migration และการสร้างตารางตอนรัน (Migrations / runtime DDL)"
tags: [backend, migration, postgres, schema, ddl]
aliases: ["0001_audit_schema.sql", "migrations", "golang-migrate", "ไม่มี migration runner", "CREATE TABLE IF NOT EXISTS", "ensure tables", "EnsurePosTables", "schema drift"]
sources: ["backend/migrations/0001_audit_schema.sql:1", "backend/internal/application/process/pos_config.go:17", "backend/internal/application/process/pos_config.go:373", "backend/internal/adapter/inbound/http/etax/handler.go:592", "backend/internal/adapter/inbound/http/monitormap/handler.go:132", "backend/internal/platform/db/pool.go:16", "backend/internal/adapter/inbound/http/admin/workspace_google.go:36", "backend/internal/adapter/inbound/http/process/permission.go:191", "backend/README.md:85", "backend/docs/PLAN.md:81"]
---

# Migration และการสร้างตารางตอนรัน

โฟลเดอร์ `backend/migrations/` มีไฟล์เดียวคือ `0001_audit_schema.sql` และ **ไม่มีโค้ด/สคริปต์ที่รันไฟล์นี้** — ตารางของโมดูลถูกสร้างตอนรันโดยโค้ด Go เอง (`CREATE TABLE IF NOT EXISTS` / `ALTER TABLE ... IF NOT EXISTS`) ทำให้ไฟล์ SQL กับโค้ดจริงไม่ตรงกัน. คำอธิบายใน README/PLAN เรื่อง `golang-migrate` เป็นแผนเก่าที่ไม่มีในโค้ด.

## ทำงานอย่างไร

1. **ไฟล์ `0001_audit_schema.sql`** (160 บรรทัด): คอมเมนต์หัวไฟล์บอกว่า "ดึง DDL ของโมดูลที่เคยรันผ่าน `/query/exec` ออกมา เพราะ `NewWriteStatement` ห้าม DDL (BE-01 Task 3) ต้องใช้สคริปต์ migration" (`migrations/0001_audit_schema.sql:1-6`) ตรงกับเหตุผลใน [[adr-0006-query-exec-dml-only-guardrails]]. ข้างในมี 7 ตาราง (ทุกอันเป็น `IF NOT EXISTS`): `monitormap_tile_cache` (+ index `idx_monitormap_tile_zxy`), `posconfig`, `pos_shift_log`, `etax_document_log`, `workmonitor_desk_nodes`, `workmonitor_activity_logs`, `workmonitor_summary_projection`. ค่าเงิน/ยอดใช้ `NUMERIC(18,2)` ถูกตามกฎ ([[be-db-pool-manager]] อธิบายการอ่านกลับเป็นสตริงทศนิยม).
2. **ชื่อไฟล์ไม่ตรงเนื้อหา**: ชื่อ "audit_schema" แต่ไม่มีตาราง audit; ตาราง `bc_audit_log` ไม่ถูกสร้างที่ใดในโค้ด Go หรือไฟล์ SQL ของ backend — โค้ดมีเพียง `sqlBatchRight` (`process/permission.go:191-201`) ที่อ่านข้อความ SQL ที่ client ส่งมาซึ่งอ้าง `bc_audit_log` แล้วจัดสิทธิ์ตามค่าแรกของ `VALUES (1|2|3, ...)` เป็น Add / Edit / Delete (ดู [[api-process-run]]) จึงถือว่าตารางนี้ต้องมีอยู่แล้วในฐานของบริษัท.
3. **ไม่มีตัวรัน**: ไม่พบการอ้างถึง `migrations/` ใน Go, `Makefile` (เป้าหมาย `build/build-all/swagger/run/test/test-integration/vet/lint/tidy`), Dockerfile หรือ `deployments`; `go.mod` ไม่มี `golang-migrate` ([[be-deployment]]).
4. **ตารางจริงถูกสร้างตอนรัน** โดยโค้ดแต่ละส่วน:

| ที่สร้าง | ตาราง | จังหวะ |
|---|---|---|
| `process/pos_config.go:17,373,381` `posConfigDDL`, `EnsurePosTables` → `ensurePosTablesPool` | `posconfig`, `pos_id`, `erp_thai_qr_config` ฯลฯ ของ POS | ครั้งแรกต่อ (Provider, ฐาน) ใน process (`posSeedDone` `:383`), seed ข้อมูลตัวอย่างเฉพาะฐาน `bcdemo` (`:393`); error ของแต่ละ statement ถูกข้าม ("Best effort" `:386-390`) |
| `etax/handler.go:592` `ensureEtaxSeeded` | `etax_document_log` | ครั้งแรกต่อฐาน (`seedDone`) |
| `monitormap/handler.go:132` `ensureTileTable` | `monitormap_tile_cache` | ครั้งแรกต่อฐาน (`schemaOnce` `:129`) |
| `platform/db/pool.go:16` `companySchemaSQL` | ตารางช่วยของบริษัท (`ic_opposite_unit`, `gl_journal_*_list`, `erp_initial` ฯลฯ) + `ALTER ... ADD COLUMN IF NOT EXISTS` | ทุกครั้งที่เปิด pool ใหม่ของฐานบริษัท ยกเว้นฐาน `postgres` และ `bcmain` (`pool.go:215-217`) ([[be-db-pool-manager]]) |
| `admin/workspace_google.go:36` `ensureWorkspaceTables` | คอลัมน์ `email`/`line_user_id` ของ `bc_user_list` + `bc_google_account`, `bc_google_workspace_db`, `bc_google_workspace_member` | ทุกครั้งที่ handler ของ workspace (และ `admin/handler.go:377`) ทำงาน ([[be-workspace-google]]) |
| `admin/handler.go:185,256,330`, `admin/menu_permissions.go:26-27,58,139`, `outbound/identity/postgres_repository.go:74-75` | คอลัมน์ `email`, `database_name` ฯลฯ, ตาราง `bc_tooltip` | ทุกคำขอที่เกี่ยวข้อง ([[be-admin-api]]) |

5. **ผลคือ DDL ยังรันผ่าน connection ของแอป** (ผู้ใช้ DB ต้องมีสิทธิ์ CREATE/ALTER) — เส้นทางที่ client ส่ง DDL ผ่าน `/query/exec` ถูกปิดแล้ว แต่ handler ของโมดูลใช้ `AllowDDL`/pool ตรงได้ ([[be-query-gateway]]).

## ข้อควรระวัง

- **schema ในไฟล์ไม่เหมือนโค้ดจริง**: ตัวอย่างที่เทียบแล้ว — `monitormap_tile_cache` ในไฟล์ใช้คีย์หลัก `cache_key VARCHAR(255)` ส่วนโค้ด `monitormap/handler.go:132-133` ใช้ `tile_key VARCHAR(80)`; `etax_document_log.etax_doc_no` ในไฟล์เป็น `VARCHAR(60) UNIQUE` แต่โค้ด `etax/handler.go:592-594` ใช้ `varchar(50)` ไม่มี UNIQUE และยังสั่ง `DROP CONSTRAINT IF EXISTS etax_document_log_etax_doc_no_key` (`etax/handler.go:636`) เอา UNIQUE ออกโดยตั้งใจ. ถ้านำไฟล์ไปรันกับฐานใหม่ก่อน ตารางจะถูกสร้างด้วยโครงต่างจากที่โค้ดคาด และ `IF NOT EXISTS` จะทำให้โค้ดไม่แก้ให้ — ให้ถือโค้ด Go เป็นความจริง (ยังไม่ได้เทียบทุกคอลัมน์ของ `posconfig`/`pos_shift_log`).
- `workmonitor_*` และ `pos_shift_log` ไม่พบ `CREATE TABLE` ในโค้ด Go ของ backend — มีเฉพาะในไฟล์ SQL นี้ (อาจถูกสร้างโดยโมดูลอื่น/เลิกใช้แล้ว; ยังไม่ยืนยัน).
- ค่า default ในไฟล์ (เลขผู้เสียภาษี/รหัสเครื่องตัวอย่างของ `posconfig`) เป็นข้อมูลตัวอย่างฝังใน DDL — ไม่ควรใช้กับฐานจริง (ไม่คัดลอกค่าไว้ที่นี่).
- ไม่มีระบบเวอร์ชัน/ตาราง `schema_migrations` — เปลี่ยน schema ของฐานลูกค้าที่มีอยู่ทำได้เฉพาะ `ADD COLUMN IF NOT EXISTS` ในโค้ด; การเปลี่ยนชนิด/ลบคอลัมน์ไม่มีกลไกรองรับ.
- เอกสารที่ล้าสมัย: README/PLAN เขียนว่าใช้ `golang-migrate` สำหรับ control-plane และมีแพ็กเกจ `schema` (`README.md:85,104,131`, `docs/PLAN.md:81,100,234`) — ในโค้ดไม่มี; control-plane จริงคือไฟล์ JSON ([[be-provider-registry]], [[adr-0001-provider-config-json-files]]).
- ตาราง `etax_document_log` ถูกจัดเป็น "ตารางเงิน" ในนโยบายล็อกการเขียน ([[be-query-write-policy]]).

## ที่มาในโค้ด

- `backend/migrations/0001_audit_schema.sql:1-160` — DDL 7 ตาราง.
- `backend/internal/application/process/pos_config.go:16-18,371-394` — `posConfigDDL`, `EnsurePosTables`, `ensurePosTablesPool`.
- `backend/internal/adapter/inbound/http/process/permission.go:184-206` — `sqlBatchRight` จัดสิทธิ์จากข้อความ SQL ที่อ้าง `bc_audit_log`.
- `backend/internal/adapter/inbound/http/etax/handler.go:582-600,636` — `ensureEtaxSeeded`, DDL และการถอด UNIQUE ของ `etax_document_log`.
- `backend/internal/adapter/inbound/http/monitormap/handler.go:127-140` — `ensureTileTable`, DDL `monitormap_tile_cache`.
- `backend/internal/platform/db/pool.go:16-148,215-217` — DDL ตอนเปิด pool.
- `backend/internal/adapter/inbound/http/admin/workspace_google.go:36-90` — `ensureWorkspaceTables`.
- `backend/README.md:85,104,131`, `backend/docs/PLAN.md:81,100,234` — ข้อความที่อ้าง `golang-migrate` / แพ็กเกจ `schema`.
- `backend/Makefile` — ไม่มีเป้าหมาย migrate.

## ดูเพิ่ม

[[backend-overview]] · [[be-db-pool-manager]] · [[be-deployment]] · [[be-hexagonal-architecture]] · [[adr-0006-query-exec-dml-only-guardrails]] · [[adr-index]]
