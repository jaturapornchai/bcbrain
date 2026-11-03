---
title: "ADR-0006 /query/exec รับเฉพาะ DML + ตารางระบบต้อง level>=9 (ถูกแทนด้วย ADR-0011)"
tags: [backend, adr, query-gateway, security, superseded]
aliases: ["ADR 0006", "query exec DML only", "ValidateUserLevel", "ErrForbiddenTable"]
sources: ["backend/docs/adr/0006-query-exec-no-new-permission-model.md:1", "backend/docs/adr/0006-query-exec-no-new-permission-model.md:7", "backend/internal/domain/query/query.go:335", "backend/internal/domain/query/query.go:363"]
---

# ADR-0006 `/query/exec` DML-only + ตารางระบบต้อง level >= 9

สถานะ: **superseded โดย [[adr-0011-query-exec-write-lockdown]]** (front-matter ของ ADR: `status: superseded by 0011...`, `...0006...md:2`). ยังอ่านเพื่อเข้าใจกฎชั้นล่างที่ยังอยู่ในโค้ด: `NewWriteStatement` (DML-only) และ `ValidateUserLevel` (ตารางระบบ).

## ทำงานอย่างไร

1. **DML-only** — `domain/query.NewWriteStatement` รับเฉพาะ `INSERT` / `UPDATE` / `DELETE` หรือ `WITH` ที่ห่อ DML; DDL และคำสั่งผู้ดูแลถูกปฏิเสธ — `query.go:335`. สร้าง schema ต้องไปอยู่ใน `backend/migrations/*.sql` หรือ `scripts/sql/*.sql` (`...0006...md:11`).
2. **User level guardrail** — claims/JWT พก `Level` (`bc_user_list.user_level`); การเขียนตาราง `bc_user_list`, `bc_database_list*`, `erp_option` โดย session ที่ `Level < 9` ถูกปฏิเสธ 403 `ErrForbiddenTable` (`query.go:363`; `...0006...md:15`).
3. ตารางธุรกิจ (`ic_trans`, `gl_journal`, ...) ใน ADR นี้ยัง **เขียนได้** — จุดอ่อนนี้คือเหตุผลที่เกิด ADR-0011.

## ข้อควรระวัง

- ห้ามอ้าง ADR-0006 เป็นกฎปัจจุบันสำหรับตารางเงิน/สต๊อก/GL: ปัจจุบันถูกบล็อกสำหรับทุกคนแล้ว ([[be-query-write-policy]]).
- ชื่อไฟล์ ADR มีคำว่า "no-new-permission-model" แต่เนื้อหาจริงคือ guardrail DML-only + level.

## ที่มาในโค้ด

- `backend/docs/adr/0006-query-exec-no-new-permission-model.md:2` — สถานะ superseded.
- `backend/internal/domain/query/query.go:335` — `NewWriteStatement`; `:363` — `ValidateUserLevel`.

## ดูเพิ่ม

[[adr-0011-query-exec-write-lockdown]] · [[be-query-write-policy]] · [[be-query-gateway]] · [[adr-index]]
