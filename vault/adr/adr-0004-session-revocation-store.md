---
title: "ADR-0004 การเพิกถอน session ตอน logout (RevocationStore)"
tags: [backend, adr, identity, security]
aliases: ["ADR 0004", "RevocationStore", "revoked_sessions.json", "logout revoke", "jti"]
sources: ["backend/docs/adr/0004-in-memory-session-revocation.md:7", "backend/internal/adapter/outbound/identity/memory_revocation_store.go:12-14", "backend/internal/adapter/outbound/identity/memory_revocation_store.go:33", "backend/internal/di/container.go:79"]
---

# ADR-0004 Logout เพิกถอน session ด้วย RevocationStore

สถานะ: **accepted แต่ส่วน "ไม่ทนต่อ restart" ล้าสมัย** — ADR เขียนว่าเป็น map ในหน่วยความจำล้วน (`...0004...md:7`) แต่โค้ดปัจจุบันมี `NewFileBackedRevocationStore` เก็บ map เป็นไฟล์ JSON บนดิสก์ และโหลดกลับตอน start (`memory_revocation_store.go:12-14,33,43`). ตาม **โค้ด**: revoke ข้าม restart ได้.

## ทำงานอย่างไร

1. access token และ refresh token ของ login ครั้งเดียวกันใช้ `jti` (session id) ร่วมกัน เพิกถอน jti เดียวทำให้ทั้งคู่ใช้ไม่ได้ (`...0004...md:7`).
2. `Revoke(ctx, sessionID, expiresAt)` ใส่ลง map แล้วเขียนไฟล์แบบ atomic (เขียน `.tmp` แล้ว `os.Rename`) (`memory_revocation_store.go:63-90`).
3. `IsRevoked` ตรวจ map; รายการที่หมดอายุแล้วไม่ถูกโหลดกลับตอน start (`memory_revocation_store.go:43-60,99`).
4. ที่ตั้งไฟล์: env `REVOCATION_STORE_FILE`, ถ้าไม่ตั้งใช้ `<CONFIG_DIR>/revoked_sessions.json` (`di/container.go:79-83`).

## ตัวเลือกที่ไม่เลือก

ตาราง `refresh_tokens` ใน Main DB ของผู้เช่า (ยังไม่มีกลไก migrate ตารางใหม่เข้า DB เดิม) และ Redis (ยังไม่มีโค้ดใช้ Redis) — `...0004...md:11-12`.

## ข้อควรระวัง

- `RevocationStore` เป็น port: สลับเป็นที่เก็บร่วม (DB/Redis) ได้โดยไม่แก้ `LogoutUseCase` / `JWTTokenService` (`...0004...md:16`).
- ชื่อ struct ยังเป็น `InMemoryRevocationStore` แม้มีโหมดไฟล์ — อย่าสับสนเมื่อค้นโค้ด.

## ที่มาในโค้ด

- `backend/internal/adapter/outbound/identity/memory_revocation_store.go:12-14` — doc comment: map ในโปรเซส + ไฟล์ JSON เสริม.
- `backend/internal/adapter/outbound/identity/memory_revocation_store.go:33` — `NewFileBackedRevocationStore`.
- `backend/internal/di/container.go:79` — เลือกไฟล์จาก `REVOCATION_STORE_FILE`.
- `backend/docs/adr/0004-in-memory-session-revocation.md:16` — ผลที่ตามมาตามข้อความใน ADR (ระบุว่า logout ไม่ข้าม restart/หลาย replica).

## ดูเพิ่ม

[[be-jwt-session-tokens]] · [[be-identity-login-flow]] · [[adr-0003-per-tenant-identity]] · [[adr-index]]
