---
title: "นโยบายล็อกการเขียนผ่าน Query Gateway (Query write policy / lockdown)"
tags: [backend, query, security, policy, accounting]
aliases: ["write lockdown", "ValidateClientPolicy", "moneyTablePattern", "legacyClientWritable", "ValidateClientInsert", "ErrMoneyTableViaExec", "ตารางเงิน", "ClientRequest"]
sources: ["backend/internal/domain/query/write_policy.go:12", "backend/internal/domain/query/write_policy.go:64", "backend/internal/domain/query/write_policy.go:77", "backend/internal/domain/query/write_policy_legacy.go:9", "backend/internal/application/query/service.go:95", "backend/docs/adr/0011-query-exec-write-lockdown.md:1"]
---

# นโยบายล็อกการเขียนผ่าน Query Gateway

ตารางที่เกี่ยวกับเงิน/สต็อก/GL ต้องถูกแก้ผ่าน endpoint `/process` ของ Go เท่านั้น (ทำกฎธุรกิจใน transaction เดียว) — ห้ามให้เบราว์เซอร์ `INSERT/UPDATE/DELETE` ตรงผ่าน `/query/exec`, `/query/execBatch` หรือ `/blob/insert`. ตารางอื่นระดับ level < 9 แก้ได้เฉพาะรายการใน allow-list เดิม ตามที่ตัดสินใจใน [[adr-0011-query-exec-write-lockdown]].

## ทำงานอย่างไร

1. handler ของ `/query/exec` และ `/query/execBatch` ตั้ง `ClientRequest: true` (`query/handler.go:245,299`) ([[be-query-gateway]]).
2. `Service.Exec` (`application/query/service.go:95`) และ `ExecBatch` (`:137`): ถ้า `ClientRequest` → `stmt.ValidateClientPolicy(userLevel)`; ล้ม → 403 (ใน batch ระบุ `statement i`).
3. `ValidateClientPolicy` (`write_policy.go:77`):
   - ดึงตารางเป้าหมายด้วย `writeTargets` (รวมใน CTE); หาเป้าหมายไม่ได้ = ปฏิเสธ.
   - ตารางเงิน (`isMoneyTable`) หรือ `ic_inventory` ที่แตะคอลัมน์ยอดคงเหลือที่ระบบคำนวณเอง (`balance_qty`, `accrued_in_qty`, `accrued_out_qty`, `book_out_qty`, `average_cost(_1)`, `item_in_stock`, `last_movement_date`) → `ErrMoneyTableViaExec` **แม้ผู้ใช้เป็น Admin**.
   - `userLevel < 9` และตารางไม่อยู่ใน `legacyClientWritable` → `ErrAdminOnlyWrite`.
4. `ValidateUserLevel` (`query.go:363`) เป็นด่านเก่าที่แยกต่างหาก: level < 9 แก้ `bc_user_list`, `bc_database_list*`, `erp_option` ไม่ได้ (`protectedSystemTablePattern`, `query.go:63`) และใช้กับผู้เรียกทุกทางที่ไม่ใช่ `AllowDDL`.
5. `/blob/insert` ใช้ `ValidateClientInsert(table, columns, level)` (`write_policy.go:64`) — กติกาเดียวกันแต่รับชื่อตาราง/คอลัมน์แทน SQL ([[be-blob-insert]]).

## ตารางเงิน (`moneyTablePattern`, `write_policy.go:24`)

`ic_trans*`, `ap_ar_trans*`, `as_trans*`, `ap_ar_debt_*`, `ap_ar_deposit_money`, `ap_ar_pay_bill(_detail)`, `cb_trans*`, `cb_chq_list`, `gl_journal*`, `gl_trans(_detail)`, `gl_account_close*`, `gl_summary_*`, `gl_wht_list(_detail)`, `etax_document_log`, `e_tax_transaction`, `ic_lot_manage`. ข้อยกเว้น: `gl_journal_book` เป็น master (`moneyTableMasters`, `:27`) และ `ap_ar_transport_label` ไม่ตรง pattern เพราะเป็น master; `ic_serial` อยู่ใน allow-list.

## Legacy allow-list

`write_policy_legacy.go:9` `legacyClientWritable` = ชุดชื่อตาราง master ที่หน้าจอเก่ายังเขียนผ่าน `/query/exec` เพราะยังไม่มี endpoint ใน Go (เช่น กลุ่ม `ap_*`, `ar_*`, `as_asset*` ฯลฯ ตามไฟล์) — ตารางเงิน/สต็อก/GL จะไม่อยู่ในรายการนี้เด็ดขาด; ลบชื่อออกเมื่อหน้าจอย้ายไป Go. เพิ่มคำนำหน้า `monitormap_` (cache ที่สร้างใหม่ได้) ใน `legacyClientWritablePrefixes` (`:41-42`).

## ตัวอย่างผล

| ผู้เรียก | SQL | ผล |
|---|---|---|
| browser, level 5 | `update ar_group set ...` | ผ่าน (อยู่ allow-list) ถ้ามีสิทธิ์ Edit ([[be-menu-rights-permission]]) |
| browser, level 5 | `update ic_customer_x ...` (ไม่ใน list) | 403 `ErrAdminOnlyWrite` |
| browser, level 9 | `update ap_ar_trans set ...` | 403 `ErrMoneyTableViaExec` |
| browser, level 9 | `update some_other_table ...` | ผ่าน |
| โมดูล Go (`AllowDDL`) | `create table ...` | ผ่าน (ไม่ตรวจนโยบาย) |

## ข้อควรระวัง

- ADR-0011 เป็นแหล่งเหตุผลหลัก; ADR-0006 (DML-only) ยังเป็นด่านแรกของ `NewWriteStatement`.

## ที่มาในโค้ด

- `backend/internal/domain/query/write_policy.go:12-110` — error, pattern, `ValidateClientInsert`, `ValidateClientPolicy`.
- `backend/internal/domain/query/write_policy_legacy.go:5-48` — allow-list และ prefix.
- `backend/internal/domain/query/query.go:325-395` — `NewWriteStatement`, `ValidateUserLevel`, `CheckWritePermission`.
- `backend/internal/application/query/service.go:95-130,137-170` — จุดเรียกนโยบาย.
- `backend/internal/adapter/inbound/http/query/handler.go:245,299` — `ClientRequest: true`.

## ดูเพิ่ม

[[backend-overview]] · [[be-query-gateway]] · [[be-blob-insert]] · [[be-menu-rights-permission]] · [[adr-0006-query-exec-dml-only-guardrails]] · [[adr-0011-query-exec-write-lockdown]] · [[adr-index]]
