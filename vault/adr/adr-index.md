---
title: "สารบัญ ADR ของ backend (Architecture Decision Records)"
tags: [backend, adr, index]
aliases: ["ADR index", "adr-index", "decision records backend", "สารบัญ ADR"]
sources: ["backend/docs/adr/0001-provider-config-json-files-not-database.md:1", "backend/docs/adr/0011-query-exec-write-lockdown.md:1"]
---

# สารบัญ ADR ของ backend

ADR ทั้ง 11 ฉบับอยู่ที่ `backend/docs/adr/` (ไฟล์ต้นฉบับภาษาอังกฤษ). ตารางนี้เทียบ **สถานะตามเอกสาร** กับ **สถานะตามโค้ดจริง** — ถ้าขัดกันให้ยึดโค้ด. กลับไปที่ภาพรวม: [[backend-overview]].

## ทำงานอย่างไร (วิธีใช้)

1. อ่านแถวของเรื่องที่สนใจ แล้วเปิดโน้ต ADR นั้นดูเหตุผล/ตัวเลือกที่ไม่เลือก.
2. ตามลิงก์ไปโน้ต `be-*` เพื่อดูพฤติกรรมปัจจุบันของโค้ด.
3. สังเกตคอลัมน์ "ตรงโค้ด?" ก่อนอ้าง ADR เป็นกฎ.

## ตารางสรุป

| ADR | หัวข้อ | สถานะเอกสาร | ตรงโค้ด? |
|---|---|---|---|
| [[adr-0001-provider-config-json-files]] | config ผู้เช่าเป็นไฟล์ JSON | accepted | ตรง (k8s ตั้ง 2 replica ขัดข้อสมมติ single instance) |
| [[adr-0002-provider-credentials-base64]] | การเก็บข้อมูลเชื่อมต่อฐานข้อมูลของผู้เช่า | accepted | ตรง |
| [[adr-0003-per-tenant-identity]] | identity ต่อผู้เช่า (`bc_user_list`) | accepted | ตรง |
| [[adr-0004-session-revocation-store]] | เพิกถอน session ตอน logout | accepted | **ล้าสมัยบางส่วน**: ตอนนี้เก็บไฟล์ JSON ข้าม restart ได้ |
| [[adr-0005-query-gateway-read-only-first]] | query gateway อ่านก่อน | accepted | ตรง แต่ "exec ยังไม่เปิด" ล้าสมัย; alias count เป็น `_query_count` |
| [[adr-0006-query-exec-dml-only-guardrails]] | exec DML-only + level | superseded | ถูกแทนด้วย 0011 |
| [[adr-0007-multi-os-service-deployment]] | binary เดียว Windows/macOS/container | accepted | ตรง |
| [[adr-0008-query-batch-endpoint]] | `/query/batch` สูงสุด 20 | accepted | ตรง (โค้ดห่อ read-only tx) |
| [[adr-0009-query-exec-batch-transactional]] | `/query/execBatch` atomic | accepted | ตรง แต่เพดานจริง 1000 stmt / 2MB |
| [[adr-0010-blob-insert-storage]] | blob insert เก็บ bytea | accepted | **ล้าสมัย**: โค้ดใช้ MinIO |
| [[adr-0011-query-exec-write-lockdown]] | ล็อกเขียนตารางเงินจาก browser | accepted | ตรง (ล่าสุด) |

## ข้อสังเกตข้ามเรื่อง

- กลุ่ม Query Gateway: 0005 → 0006 → 0008 → 0009 → 0011 (ลำดับพัฒนาการ) สรุปรวมที่ [[be-query-gateway]] และ [[be-query-write-policy]].
- กลุ่ม Tenant/Identity: 0001, 0002, 0003, 0004 สรุปรวมที่ [[be-multi-tenant]], [[be-provider-registry]], [[be-identity-login-flow]], [[be-jwt-session-tokens]].
- กลุ่ม Deployment: 0007 → [[be-service-lifecycle]], [[be-deployment]].
- ADR ใหม่ทุกฉบับควรเพิ่มแถวในตารางนี้และระบุสถานะเทียบโค้ด.

## ที่มาในโค้ด

- `backend/docs/adr/0001-provider-config-json-files-not-database.md:1` — ADR ฉบับแรก (front-matter `status`).
- `backend/docs/adr/0011-query-exec-write-lockdown.md:1` — ฉบับล่าสุด (`supersedes: 0006`).
- ไฟล์ ADR อื่นอยู่โฟลเดอร์เดียวกัน (`0002`–`0010`), บรรทัด 1-3 คือสถานะ.

## ดูเพิ่ม

[[backend-overview]] · [[index]] · [[standards-overview]]
