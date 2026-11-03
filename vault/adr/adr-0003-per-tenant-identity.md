---
title: "ADR-0003 ข้อมูลผู้ใช้และสิทธิ์อยู่ใน DB ของแต่ละผู้เช่า ไม่ใช่ control-plane"
tags: [backend, adr, identity, multi-tenant]
aliases: ["ADR 0003", "per-tenant identity", "bc_user_list login", "pre-auth token"]
sources: ["backend/docs/adr/0003-per-tenant-identity-not-control-plane.md:7", "backend/internal/adapter/outbound/identity/postgres_repository.go:42", "backend/internal/adapter/outbound/identity/postgres_repository.go:132", "backend/internal/domain/identity/identity.go:64"]
---

# ADR-0003 Identity อยู่ในแต่ละผู้เช่า (per-tenant)

สถานะ: **accepted** — โค้ดปัจจุบันรองรับ bcrypt. Login ตรวจกับ Main DB ของผู้เช่าเอง (`bc_user_list` ใน `bcerpmain<code>`) ไม่ใช้ตาราง `users`/`user_tenant_access` ของ control-plane (`backend/docs/adr/0003-per-tenant-identity-not-control-plane.md:7`).

## ทำงานอย่างไร

1. ผู้ใช้ส่ง `provider` (code ผู้เช่า) + `dataGroup` + `username` + `password` (`tenantId` เป็นชื่อ claim ใน JWT ไม่ใช่ชื่อ field ตอน login) → ระบบหา user ใน `bc_user_list` ด้วย `user_code` (`postgres_repository.go:42`, SQL บรรทัด 50-53).
2. หา "บริษัท" ที่ผู้ใช้เข้าได้จาก `bc_database_list_user_and_group` (ผูกกับ DataGroup) (`postgres_repository.go:132`, SQL บรรทัด 138-145).
3. ถ้ามีบริษัทเดียว ออก session ทันที; ถ้าหลายบริษัท ออก pre-auth token แล้วให้เรียก `/auth/select-company` (`router.go:75`; flow ที่ ADR คงไว้ แต่เปลี่ยนชื่อ Select Tenant เป็น Select Company) — ดู [[be-identity-login-flow]].

## ตัวเลือกที่ไม่เลือก

ใช้ตาราง control-plane `users` / `user_tenant_access` ตาม PLAN.md §4.5 เดิม — ต้อง migrate ข้อมูลผู้ใช้ของทุกผู้เช่าก่อน Login จะทำงานได้ (`...0003...md:11`).

## ผลที่ตามมา

- คนเดียวกันที่ login 2 ผู้เช่า อาจมี credential ต่างกัน ไม่มีบัญชีรวม (`...0003...md:14`).
- ประเด็นที่ ADR ปล่อยค้างไว้: ที่เก็บ refresh token และ audit login (`...0003...md:14`). โค้ดปัจจุบันตอบเรื่องแรกด้วยไฟล์ JSON revocation ([[adr-0004-session-revocation-store]]); ส่วน audit schema ดู [[be-audit-migrations]].
- Access token พก `level` ของผู้ใช้ ใช้ตัดสินสิทธิ์เขียน ([[be-query-write-policy]]).

## ที่มาในโค้ด

- `backend/internal/adapter/outbound/identity/postgres_repository.go:42` — `FindByCode` จาก `bc_user_list`.
- `backend/internal/adapter/outbound/identity/postgres_repository.go:132` — รายชื่อบริษัทจาก `bc_database_list_user_and_group`.
- `backend/internal/domain/identity/identity.go:64` — `Authenticate` รองรับ bcrypt.
- `backend/docs/adr/0003-per-tenant-identity-not-control-plane.md:7` — เหตุผลการกลับทิศทางจาก PLAN.md.

## ดูเพิ่ม

[[be-identity-login-flow]] · [[be-multi-tenant]] · [[be-jwt-session-tokens]] · [[adr-index]]
