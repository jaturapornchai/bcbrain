---
title: "ADR-0011 ล็อก SQL เขียนจาก browser: ตารางเงิน/สต๊อก/GL ผ่าน /api/process เท่านั้น"
tags: [backend, adr, query-gateway, security, write-policy]
aliases: ["ADR 0011", "query exec lockdown", "ErrMoneyTableViaExec", "legacyClientWritable", "ClientRequest"]
sources: ["backend/docs/adr/0011-query-exec-write-lockdown.md:15", "backend/internal/domain/query/write_policy.go:16-18", "backend/internal/domain/query/write_policy.go:24", "backend/internal/domain/query/write_policy.go:33-35", "backend/internal/domain/query/write_policy.go:77", "backend/internal/adapter/inbound/http/query/handler.go:245", "backend/internal/application/query/service.go:105-106", "backend/docs/adr/0011-query-exec-write-lockdown.md:35-37"]
---

# ADR-0011 ล็อกการเขียนผ่าน `/query/exec` จาก browser

สถานะ: **accepted** และเป็น ADR **ล่าสุด/ปัจจุบัน** ที่แทน [[adr-0006-query-exec-dml-only-guardrails]] (`backend/docs/adr/0011-query-exec-write-lockdown.md:3`). แนวคิด: กฎธุรกิจ/GL/สต๊อกอยู่ใน Go backend, browser เป็น thin client — จึงห้าม browser ใช้ SQL เขียนตารางเงินตรง ๆ.

## ทำงานอย่างไร

1. `/query/list|limit|batch` รับ `SELECT`/`WITH` ทุก session; `/query/exec|execBatch` รับเฉพาะ `INSERT`/`UPDATE`/`DELETE` (หรือ `WITH` ที่ห่อ DML) อย่างเดียว — อย่างอื่นรวมถึง `SELECT` ได้ 400 `ErrNotWriteOnly` (`...0011...md:15-17`).
2. handler ตั้ง `ExecInput.ClientRequest = true` (`query/handler.go:245,299`); service เรียก `WriteStatement.ValidateClientPolicy(userLevel)` เมื่อ `ClientRequest` (`application/query/service.go:105-106,146-147`; `write_policy.go:77`).
3. กฎเรียงตามลำดับ:
   - ตารางเงิน/สต๊อก/GL ถูกปฏิเสธ **ทุกคนแม้ level 9** → `ErrMoneyTableViaExec` (HTTP 403): `ic_trans*`, `as_trans*`, `ap_ar_trans*`, `ap_ar_debt_*`, `ap_ar_deposit_money`, `ap_ar_pay_bill*`, `cb_trans*`, `cb_chq_list`, `gl_journal*` (ยกเว้นมาสเตอร์ `gl_journal_book`), `gl_trans*`, `gl_account_close*`, `gl_summary_*`, `gl_wht_list*`, `etax_document_log`, `e_tax_transaction`, `ic_lot_manage`, และ `ic_inventory` ที่แตะคอลัมน์ derived (`balance_qty`, `accrued_*_qty`, `book_out_qty`, `average_cost*`, `item_in_stock`, `last_movement_date`) — `write_policy.go:24-31`.
   - level >= 9 (SQL Studio) เขียนตารางอื่นได้.
   - level < 9 เขียนได้เฉพาะ allow-list `legacyClientWritable`.
   - ตารางระบบ `erp_option`, `bc_user_list`, `bc_database_list*` เป็น admin-only ผ่าน `ValidateUserLevel`; statement ที่หาเป้าหมายเขียนไม่เจอ → admin-only.
4. caller ภายใน Go (crm, etax, market, monitormap, procure, tms, wms) ใช้ `ClientRequest = false` จึงไม่ถูกกระทบ (`...0011...md:39`).

## ที่ย้ายออกจาก SQL ในเบราว์เซอร์แล้ว

stock beginning, point docs (flag 801/802), check price, ฟังก์ชัน system process (`check-ic-trans`, `point-recal`, `import-transport-label`), และ `docnonext` → ทั้งหมดเป็น `/api/process/...` (ตารางใน `...0011...md:44-50`) — โค้ดอยู่ใน `application/process` ซึ่งอยู่นอกโน้ตชุดนี้ ดู [[process-overview]].

## วิธีหดรายการ allow-list (ratchet)

ย้ายหน้าจอไป endpoint Go (parameterized, 1 transaction, เงินเป็น string) → เปลี่ยนหน้าจอเป็น `apiPost` → ลบตารางออกจาก `legacyClientWritable` → เพิ่มเคสใน `write_policy_test.go` (`...0011...md:54-56`). ตารางใหม่เป็น admin-only จนกว่าจะมีคนเพิ่มโดยตั้งใจ.

## ข้อควรระวัง

- `erp_user_datalist_config`, `erp_option_etax_inet`, `erp_option_mobillyst`, `erp_thai_qr_config` ตั้งใจ **ไม่** อยู่ใน allow-list.
- DDL ถูกปฏิเสธโดย `NewWriteStatement`; `MERGE` ถูกปฏิเสธเพราะเขียนตารางใดก็ได้โดยตรวจชื่อเป้าหมายไม่เจอ (`query.go:53-55`); ตัวระบุแบบ `U&"..."` เป็น admin-only เพราะสะกดชื่อตารางเงินที่ pattern อ่านไม่ออก (`write_policy.go:33-35`; `...0011...md:35-37`)
- ตารางใหม่ที่ขึ้นต้นเหมือนตารางเงินจะถูกบล็อกอัตโนมัติ (`moneyTablePattern`, `write_policy.go:24`) — ถ้าต้องการเขียนจริงต้องทำ endpoint ใน `/api/process`.
- แยกจาก `/blob/insert` ซึ่งใช้ `ValidateClientInsert` เช็กกฎเดียวกันที่ระดับตาราง/คอลัมน์ ([[be-blob-insert]]).

## ที่มาในโค้ด

- `backend/docs/adr/0011-query-exec-write-lockdown.md:15` — ส่วน Decision.
- `backend/internal/domain/query/write_policy.go:16-18,24,77` — error (`ErrMoneyTableViaExec`, `ErrAdminOnlyWrite`), `moneyTablePattern`, `ValidateClientPolicy`.
- `backend/internal/adapter/inbound/http/query/handler.go:245` — ตั้ง `ClientRequest: true`.

## ดูเพิ่ม

[[be-query-write-policy]] · [[be-query-gateway]] · [[be-menu-rights-permission]] · [[adr-index]]
