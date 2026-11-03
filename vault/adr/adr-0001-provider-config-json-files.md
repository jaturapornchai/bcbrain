---
title: "ADR-0001 เก็บ config ของผู้เช่า (Provider) เป็นไฟล์ JSON ไม่ใช่ตาราง DB"
tags: [backend, adr, tenant, config]
aliases: ["ADR 0001", "providerlist.json", "BCConfig json", "provider config file"]
sources: ["backend/docs/adr/0001-provider-config-json-files-not-database.md:7", "backend/internal/adapter/outbound/tenant/jsonfile_repository.go:20", "backend/internal/adapter/outbound/tenant/jsonfile_repository.go:47", "backend/internal/adapter/inbound/http/router.go:114", "backend/internal/domain/tenant/provider.go:21", "backend/deployments/k8s/deployment.yaml:11"]
---

# ADR-0001 เก็บ config ผู้เช่าเป็นไฟล์ JSON ไม่ใช่ตาราง DB

สถานะ: **accepted** (ยังตรงกับโค้ด). ข้อมูลการเชื่อมต่อ DB ของแต่ละผู้เช่า (Provider/Tenant) ถูกเก็บเป็นไฟล์ JSON ในโฟลเดอร์ `CONFIG_DIR` แทนที่จะย้ายเข้า control-plane Postgres เพื่อลดความเสี่ยงช่วงสร้าง backend ใหม่ (`backend/docs/adr/0001-provider-config-json-files-not-database.md:7`).

## ทำงานอย่างไร

1. ไฟล์ดัชนีเดียว `providerlist.json` + ไฟล์ต่อผู้เช่า `BCConfig<CODE>.json` (ดัชนี 1 ไฟล์ + 1 ไฟล์ต่อผู้เช่า เป็น JSON ทั้งคู่) — `jsonfile_repository.go:20,47`.
2. ไม่แก้ไฟล์ตรง ๆ แต่ผ่าน API ที่ต้องเป็น admin: `/admin/providers` (`router.go:114-121`).
3. repository คือ `jsonfile_repository.go` ใช้ mutex ในโปรเซส จึงสมมติว่ามี instance เดียว.

## ตัวเลือกที่ไม่เลือก

- ย้ายเข้า control-plane Postgres ตั้งแต่ต้น: ผูก bootstrap ของ Tenant กับ schema/migration ของ control-plane (`...0001...md:11`).
- ใช้ YAML ตามที่ PLAN.md เคยสมมติ: ไม่มีส่วนอื่นของระบบอ่านเขียน YAML (`...0001...md:12`).

## ผลที่ตามมา / ข้อควรระวัง

- ถ้าจะย้ายไป DB ภายหลัง ต้องทำ one-time migration อ่านจากไฟล์เหล่านี้ (`...0001...md:16`).
- **ห้ามรันหลาย replica** ที่เขียน `CONFIG_DIR` พร้อมกัน — ADR ระบุว่าอยู่นอกขอบเขต (ต้องมี file locking หรือ shared storage ก่อน). `deployments/k8s/deployment.yaml:11` ตั้ง `replicas: 2` ซึ่งขัดกับข้อสมมติ single-instance นี้ (ยังไม่ยืนยันว่า production ใช้ k8s จริงหรือไม่) — ดู [[be-deployment]].
- โครงสร้างไฟล์และ validation ของ code (`^[A-Z0-9]{2,20}$`, `domain/tenant/provider.go:21`) ดู [[be-provider-registry]].

## ที่มาในโค้ด

- `backend/docs/adr/0001-provider-config-json-files-not-database.md:7` — เนื้อหาการตัดสินใจ.
- `backend/internal/adapter/outbound/tenant/jsonfile_repository.go:20` — ค่าคงที่ชื่อไฟล์ดัชนี `providerlist.json`.
- `backend/internal/adapter/outbound/tenant/jsonfile_repository.go:47` — `JSONFileRepository` แบบไฟล์ (ดัชนี + 1 ไฟล์ต่อ Provider).
- `backend/internal/adapter/inbound/http/router.go:114` — เส้นทาง `/admin/providers`.

## ดูเพิ่ม

[[be-provider-registry]] · [[be-multi-tenant]] · [[adr-0002-provider-credentials-base64]] · [[adr-index]]
