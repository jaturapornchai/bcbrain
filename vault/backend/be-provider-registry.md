---
title: "ทะเบียน Provider แบบไฟล์ JSON (Provider registry)"
tags: [backend, tenant, config, json, security]
aliases: ["providerlist.json", "BCConfig", "JSONFileRepository", "credential codec", "ลงทะเบียน provider", "CreateProvider"]
sources: ["backend/internal/adapter/outbound/tenant/jsonfile_repository.go:20", "backend/internal/adapter/outbound/tenant/jsonfile_repository.go:64", "backend/internal/adapter/outbound/tenant/jsonfile_repository.go:205", "backend/internal/application/tenant/service.go:28", "backend/internal/domain/tenant/provider.go:70"]
---

# ทะเบียน Provider แบบไฟล์ JSON

ข้อมูลการเชื่อมต่อฐานข้อมูลของแต่ละ Tenant ไม่ได้อยู่ใน DB แต่เก็บเป็นไฟล์ในโฟลเดอร์ `CONFIG_DIR` (default `configs`): ดัชนี `providerlist.json` หนึ่งไฟล์ + `BCConfig<CODE>.json` หนึ่งไฟล์ต่อ Provider. ตัดสินใจไว้ใน [[adr-0001-provider-config-json-files]]. **ห้ามคัดลอกเนื้อหาไฟล์เหล่านี้ลงเอกสาร/แชท/git**.

## ทำงานอย่างไร (สร้าง Provider)

1. `POST /admin/providers` (ต้อง `AdminAuth`) → `tenantHandler.Create` → `Service.CreateProvider` (`application/tenant/service.go:28`).
2. ทดสอบเชื่อมต่อจริงก่อน: `ConnectionTester.TestConnection` เปิด `pgx.Connect` แล้ว `Ping` (`adapter/outbound/tenant/connection_tester.go:26-34`); ล้มเหลว → `KindValidation` ("could not connect to the database with the given connection details").
3. `NewProvider` ตรวจ code `^[A-Z0-9]{2,20}$`, ชื่อไม่ว่าง, connection ครบ (host, port>0, database, user, password) แล้วตั้ง `Status = active` (`domain/tenant/provider.go:70-92`).
4. `repo.Save` (`jsonfile_repository.go:64`): ล็อก mutex → อ่านดัชนี → ถ้า code ซ้ำคืน `ErrProviderCodeExists` (แปลงเป็น 409) → **เขียนไฟล์ connection ก่อน** แล้วค่อยต่อท้ายดัชนี (ถ้าพังกลางคัน ได้ไฟล์กำพร้า ไม่ใช่ดัชนีชี้ไปที่ไม่มี).
5. ตอนใช้งาน `GetProviderConnection` (`service.go:66`) คืน connection ให้ resolver ของ identity/query/blob ([[be-multi-tenant]]).

## รูปแบบไฟล์

- `providerlist.json` (ดัชนี): แต่ละแถว `code`, `name`, `status`, `createdAt` (`jsonfile_repository.go:22-28`) — `List` คืนเฉพาะข้อมูลนี้ ไม่แตะไฟล์ connection (`:134`).
- `BCConfig<CODE>.json`: ข้อมูลการเชื่อมต่อฐานข้อมูลของ Provider (`:30-37`); ชื่อไฟล์มาจาก `Provider.ConfigFileName()` (`provider.go:96`).
- เขียนแบบ atomic: เขียน `*.tmp` แล้ว `os.Rename` ทับ (`writeJSONAtomic`, `:205-215`).
- `Get` เทียบ code แบบไม่สนตัวพิมพ์ (`strings.EqualFold`, `:94-108`); ไม่พบ → `ErrProviderNotFound` → 404.

## ข้อจำกัด / ข้อควรระวัง

- ความปลอดภัยของ concurrent มาจาก `sync.Mutex` ในโปรเซสเดียวเท่านั้น (`:44-48`) → ใช้ได้กับ instance เดียว; K8s `replicas: 2` ทำให้แต่ละ pod เห็นไฟล์ของตัวเอง ([[be-deployment]]).
- ไม่มี API แก้ไข/ลบ Provider ที่ทำงานจริงในชั้น application (มีแค่ `Save/Get/List`); `UpdateProvider`/`DeleteProvider` ใน admin API เป็น stub ([[be-admin-api]]).
- โฟลเดอร์ `CONFIG_DIR` ยังเก็บ `revoked_sessions.json` ของ session ที่ถูกเพิกถอน ([[be-jwt-session-tokens]]).

## ที่มาในโค้ด

- `backend/internal/adapter/outbound/tenant/jsonfile_repository.go:20-60` — ชื่อไฟล์ รูปแบบ และ constructor.
- `backend/internal/adapter/outbound/tenant/jsonfile_repository.go:64-92` — `Save`.
- `backend/internal/adapter/outbound/tenant/jsonfile_repository.go:205-215` — เขียนแบบ atomic.
- `backend/internal/application/tenant/service.go:28-80` — `CreateProvider`, `ListProviders`, `GetProviderConnection`.
- `backend/internal/adapter/outbound/tenant/connection_tester.go:26-34` — ทดสอบเชื่อมต่อ.
- `backend/internal/domain/tenant/provider.go:70-97` — `NewProvider`, `ConfigFileName`.

## ดูเพิ่ม

[[backend-overview]] · [[be-multi-tenant]] · [[be-config-env]] · [[adr-0001-provider-config-json-files]] · [[adr-0002-provider-credentials-base64]] · [[adr-index]]
