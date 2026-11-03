---
title: "บทเรียนการล็อกการเขียนผ่าน query gateway (Query Gateway Write Lockdown)"
tags: [history, lesson, query-gateway, security, lockdown]
aliases: ["query/exec lockdown", "moneyTablePattern", "ErrMoneyTableViaExec", "ValidateClientInsert", "legacyClientWritable", "blob insert policy"]
sources: ["backend/internal/domain/query/write_policy.go:10", "backend/internal/domain/query/write_policy.go:24", "backend/internal/domain/query/write_policy.go:64", "backend/internal/domain/query/write_policy.go:77", "backend/internal/domain/query/write_policy_legacy.go:5", "backend/internal/domain/query/query.go:63", "backend/internal/application/query/service.go:105", "backend/internal/application/query/service.go:146", "backend/internal/adapter/inbound/http/query/handler.go:245", "backend/internal/adapter/inbound/http/query/handler.go:299", "backend/internal/adapter/inbound/http/blob/handler.go:91", "backend/internal/domain/query/write_policy_test.go:8", "backend/test/blob_integration_test.go:151", "frontend/src/app/api/process/barcode/[action]/route.ts:10", "AGENTS.md:51"]
---

# การล็อกการเขียนผ่าน query gateway

`/query/exec` และ `/query/execBatch` รับ `INSERT/UPDATE/DELETE` จาก browser ได้ ถ้าไม่มีนโยบายระดับตาราง ผู้ใช้ทุกระดับจะเขียนตารางเอกสาร/สต็อก/GL ตรงๆ ข้ามกฎบัญชี ข้ามการคำนวณ และข้าม transaction ของ Go (ขัดกฎข้อ 10 ใน `AGENTS.md:51` "Backend คุมกฎทั้งหมด")

## อะไรพังได้
- **เขียนตารางเงินตรง:** หน้าจอหรือคำขอทำมือแก้ `ic_trans`, `gl_journal`, คอลัมน์ยอดคงเหลือของ `ic_inventory` โดยไม่ผ่านการคำนวณ/ลงบัญชี
- **ผู้ใช้ระดับต่ำเขียนตารางระบบ:** เช่นตารางผู้ใช้ ตารางฐานข้อมูล `erp_option`
- **ประตูเขียนบานที่สองหลุดนโยบาย:** `/blob/insert` รับชื่อตาราง+คอลัมน์จาก client ถ้าไม่ผ่านกฎเดียวกับ `/query/exec` ก็ insert เข้าตาราง GL ได้
- **SQL ที่ตัวตรวจอ่านเป้าหมายไม่ออก:** ถ้า "ปล่อย" แทน "ปฏิเสธ" ก็เป็นช่องลัด (เช่น identifier แบบ `U&"..."`, statement ที่หาตารางเป้าหมายไม่เจอ)
- **ทางลัดฝั่ง proxy:** route ของ Next ที่ยิง DML เองเมื่อ backend ตอบ 404 เป็นประตูหลังที่ Go มองไม่เห็น

## โค้ดป้องกันไว้อย่างไร
| ด่าน | ที่อยู่ | ทำอะไร |
|---|---|---|
| ตั้งธงว่าคำขอมาจาก browser | `backend/internal/adapter/inbound/http/query/handler.go:245,299` | `ClientRequest: true` ทั้ง `Exec` และ `ExecBatch` |
| ตรวจนโยบายเมื่อเป็นคำขอ client | `backend/internal/application/query/service.go:105,146` | เรียก `ValidateClientPolicy(level)` กับทุก statement ก่อนรัน (caller ภายในของ Go ไม่ผ่านด่านนี้) |
| ตารางเงิน/สต็อก/GL | `backend/internal/domain/query/write_policy.go:24` `moneyTablePattern` | ปฏิเสธทุกระดับด้วย `ErrMoneyTableViaExec`; `ic_inventory` ห้ามแตะคอลัมน์ยอดคงเหลือ/ต้นทุน (`inventoryBalanceColumns`) |
| ตารางอื่น | `write_policy.go:77-102` `ValidateClientPolicy` | ระดับ < 9 เขียนได้เฉพาะตารางใน allow-list `legacyClientWritable` (`write_policy_legacy.go:9`) มิฉะนั้น `ErrAdminOnlyWrite` |
| อ่านเป้าหมายไม่ได้ = ปฏิเสธ | `write_policy.go:86-93` | `U&"..."` และ statement ที่ `writeTargets` หาตารางไม่ได้ → ปฏิเสธ |
| ตารางระบบ | `backend/internal/domain/query/query.go:63` `protectedSystemTablePattern` | `bc_user_list`, `bc_database_list*`, `erp_option` ต้องระดับ ≥ 9 |
| `/blob/insert` กฎเดียวกัน | `backend/internal/adapter/inbound/http/blob/handler.go:91-100` ← `write_policy.go:64` `ValidateClientInsert` | ใช้ตารางและรูปแบบคอลัมน์ชุดเดียวกับ `/query/exec` |
| ไม่มีทางลัดฝั่ง Next | `frontend/src/app/api/process/barcode/[action]/route.ts:10-49` | เหลือเป็น proxy ไป Go อย่างเดียว ไม่มีการยิง DML เอง |
| เทสต์ | `write_policy_test.go:8` `TestValidateClientPolicy` (รวมเคส `erp_user_datalist_config` ที่ระดับ 1 ถูกปฏิเสธ `:32`), `:65` `TestMoneyTablePattern`; `backend/test/blob_integration_test.go:151` (ระดับ 1 insert `gl_journal_detail`/`bc_user_list` ได้ 403) | |

## กฎที่ต้องจำ
1. ทุกประตูเขียนจาก browser (`/query/exec`, `/query/execBatch`, `/blob/insert`, proxy ของ Next) ต้องผ่านฟังก์ชันตรวจชุดเดียวกัน
2. อ่านเป้าหมายไม่ออก = ปฏิเสธ แล้วเพิ่มเคสในเทสต์
3. ย้ายหน้าจอไปเขียนผ่าน `/api/process` เมื่อไหร่ ให้ถอดตารางนั้นออกจาก `legacyClientWritable` (comment ที่ `write_policy_legacy.go:5-8` บอกชัด: "Remove a name the day its screen moves to Go") และเพิ่มเคสใน `TestValidateClientPolicy`
4. ข้อมูลที่ผู้ใช้เก็บแล้วไปรันที่อื่น (เช่น SQL ใน config ของรายการ) ห้ามอยู่ใน allow-list — เคส `erp_user_datalist_config` ถูกล็อกแล้ว
5. fallback ฝั่ง proxy ที่เขียนข้อมูลเองคือช่องโหว่ ให้ตอบ error ตรงๆ

## ที่มาในโค้ด
- `backend/internal/domain/query/write_policy.go:10-102` นโยบายทั้งชุด
- `backend/internal/domain/query/write_policy_legacy.go:5-43` allow-list ที่เหลือ
- `backend/internal/application/query/service.go:105,146`, `backend/internal/adapter/inbound/http/query/handler.go:245,299`, `backend/internal/adapter/inbound/http/blob/handler.go:91-100`
- เอกสารเหตุผล: `backend/docs/adr/0011-query-exec-write-lockdown.md`
- ดูเพิ่ม: [[adr-0011-query-exec-write-lockdown]] · [[adr-0006-query-exec-dml-only-guardrails]] · [[adr-0010-blob-insert-storage]] · [[be-query-write-policy]] · [[std-security-authz-and-web-vulns]] · [[hist-lessons-permission-rights]] · [[hist-lessons-atomic-transactions-swallowed-errors]]
