---
title: "ทำไมเขียนข้อมูลผ่าน /query/exec ไม่ได้ (error 403 ตารางเงิน/สต็อก/GL)"
tags: [faq, query-gateway, security, write-policy, troubleshooting]
aliases: ["money, stock and GL tables can only be changed through /api/process", "ErrMoneyTableViaExec", "ErrAdminOnlyWrite", "write lockdown", "legacyClientWritable", "query/exec 403", "ValidateClientPolicy"]
sources: ["backend/internal/domain/query/write_policy.go:16", "backend/internal/domain/query/write_policy.go:77", "backend/internal/application/query/service.go:105", "backend/internal/adapter/inbound/http/query/handler.go:245", "backend/internal/adapter/inbound/http/process/permission.go:138"]
---
# ทำไมเขียนข้อมูลผ่าน /query/exec ไม่ได้

**ตอบสั้น:** เพราะ ADR-0011 ล็อกไว้โดยตั้งใจ — ตารางเงิน/สต็อก/GL ห้ามเขียนด้วย SQL จากเบราว์เซอร์ (ถูกปฏิเสธแม้เป็น Admin level 9) ต้องเรียก `/api/process` ที่ทำกฎบัญชีใน transaction เดียว ส่วนตารางอื่น ผู้ใช้ level ต่ำกว่า 9 เขียนได้เฉพาะตารางใน allow-list `legacyClientWritable`

## รายละเอียด
ลำดับการตรวจตอน `POST /query/exec` หรือ `/query/execBatch` (ดูภาพรวมที่ [[faq-query-gateway]]):
1. `RequireRight` ตรวจสิทธิ์เมนู Add/Edit/Delete ตามคำกริยา SQL ตัวแรก (`insert`=เพิ่ม, `update`=แก้, `delete`=ลบ) — `permission.go:138` ไม่มีสิทธิ์ = 403
2. `NewWriteStatement` ต้องเป็น `INSERT/UPDATE/DELETE` (หรือ `WITH` ที่มี DML) และห้าม DDL/`MERGE` (`ErrNotWriteOnly`, 400)
3. `ValidateUserLevel`: level < 9 แก้ `bc_user_list`, `bc_database_list*`, `erp_option` ไม่ได้
4. `ValidateClientPolicy` (`write_policy.go:77`) เฉพาะคำขอจากเบราว์เซอร์:

| เงื่อนไข | ผล |
|---|---|
| ตารางเงิน/สต็อก/GL (`ic_trans*`, `ap_ar_trans*`, `as_trans*`, `cb_trans*`, `cb_chq_list`, `gl_journal*`, `gl_trans*`, `gl_summary_*` ฯลฯ ยกเว้น `gl_journal_book`) | `ErrMoneyTableViaExec` 403 ทุกระดับ |
| `ic_inventory` แต่ SQL แตะ `balance_qty`, `average_cost`, `accrued_in_qty` ฯลฯ | `ErrMoneyTableViaExec` |
| หาตารางเป้าหมายไม่เจอ | `ErrAdminOnlyWrite` |
| level < 9 และตารางไม่อยู่ใน `legacyClientWritable` | `ErrAdminOnlyWrite` |
| level >= 9 และเป็นตารางอื่น | ผ่าน |

โค้ดภายใน Go (module อย่าง crm, procure, wms) เรียก use case เดียวกันด้วย `ClientRequest=false` จึงไม่ถูกนโยบายนี้ ตารางเงินยังถูกแก้ผ่าน handler ของ `/process` ได้ตามปกติ

**วิธีแก้เมื่อเจอ error:** อย่าพยายามเลี่ยง ให้ใช้ action ใน `/api/process` ที่ตรงงาน (บันทึกเอกสาร, ยอดยกมา, ตรวจราคา ฯลฯ — [[faq-process-engine-dispatcher]]) ถ้าเป็นตารางมาสเตอร์ใหม่ที่ผู้ใช้ level ต่ำต้องแก้ ต้องเพิ่มชื่อใน `legacyClientWritable` หรือทำ endpoint ใน Go ([[faq-add-master-screen]])

## ข้อควรระวัง
- `/blob/insert` ใช้กติกาเดียวกันผ่าน `ValidateClientInsert` (`write_policy.go:64`)
- ตัวอย่างในหน้าจอ: `StandardMasterScreen.tsx` มี comment ว่าเอกสารแต้ม 801/802 (`ic_trans`) ถูก `/query/exec` ปฏิเสธ ต้องผ่าน `/api/process`

## ดูเพิ่ม
- [[be-query-write-policy]]
- [[adr-0011-query-exec-write-lockdown]]
- [[adr-0006-query-exec-dml-only-guardrails]]
- [[hist-lessons-query-gateway-write-lockdown]]
- [[faq-menu-permission-denied]]
- [[be-blob-insert]]

## ที่มาในโค้ด
- `backend/internal/domain/query/write_policy.go:16` ข้อความ `ErrMoneyTableViaExec` / `ErrAdminOnlyWrite`
- `backend/internal/domain/query/write_policy.go:77` `ValidateClientPolicy`
- `backend/internal/application/query/service.go:105` เรียก `ValidateClientPolicy` เมื่อ `ClientRequest` (execBatch บรรทัด 146)
- `backend/internal/adapter/inbound/http/query/handler.go:245` `ClientRequest: true` (execBatch บรรทัด 299)
- `backend/internal/adapter/inbound/http/process/permission.go:138` `QueryRequiredRight` map คำกริยา SQL → สิทธิ์เมนู
