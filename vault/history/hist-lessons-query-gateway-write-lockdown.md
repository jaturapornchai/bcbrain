---
title: "บทเรียนการล็อกการเขียนผ่าน query gateway (Query Gateway Write Lockdown)"
tags: [history, query-gateway, security, lockdown]
aliases: ["query/exec lockdown", "moneyTablePattern", "ErrMoneyTableViaExec", "ValidateClientInsert"]
sources: ["git:239b0997", "git:923fae86", "git:3ef39d32", "git:04903202", "git:a47413ec", "backend/internal/domain/query/write_policy.go:77", "backend/internal/adapter/inbound/http/blob/handler.go:98"]
---

## ภาพรวม
ในยุค ADR-0006 session ของผู้เช่าทุกคนส่ง `INSERT/UPDATE/DELETE` ถึงตารางธุรกิจใดก็ได้ผ่าน `/query/exec` จึงข้ามกฎ Go (rule 10) การล็อกทำเป็นขั้น 2026-10-21 .. 2026-10-24 และแต่ละขั้นมีทางลัดที่พบทีหลัง

## อาการ
- **Q1 (239b0997):** หน้าจอหรือคำขอทำมือเขียน `ic_trans`, `gl_journal`, `ic_inventory.balance_qty` ได้ตรง ไม่ผ่านการคำนวณ/ลงบัญชี/transaction ของ Go
- **Q2 (239b0997, 3ef39d32):** level ต่ำเขียนตารางธุรกิจได้ทุกตาราง และ `erp_user_datalist_config` เก็บ SQL ที่ไปรันในเบราว์เซอร์ผู้ใช้คนอื่น
- **Q3 (04903202):** route Next `process/barcode/[action]` มีทางสำรองยิง `DELETE/INSERT/UPDATE ic_inventory_barcode` ผ่าน `/query/execBatch` เองเมื่อ backend ตอบ 404
- **Q4 (a47413ec):** `/blob/insert` รับชื่อตาราง+คอลัมน์จากผู้ใช้โดยไม่ผ่านกฎเดียวกับ `/query/exec` (ข้อความ commit)
- **Q5 (239b0997):** SQL ที่ตัวตรวจอ่านเป้าหมายไม่ออก

## สาเหตุ (root cause)
- Q1/Q2: นโยบายเดิมคุมแค่ "เป็น DML หรือไม่" ไม่คุม "ตารางไหน ใครเขียน" มีเพียง `ValidateUserLevel` กับตารางระบบ 3 กลุ่ม
- Q3: ทางสำรองฝั่ง Next เขียนตรงผ่าน gateway เป็นประตูหลังที่ Go ไม่เห็น (ผิด rule 9/10)
- Q4: ประตูเขียนมีสองบาน กฎล็อกอยู่บานเดียว
- Q5: ไวยากรณ์ที่ตัวตรวจอ่านไม่ได้ต้อง "ปฏิเสธ" ไม่ใช่ "ปล่อย"

## วิธีแก้
- **Q1:** handler เบราว์เซอร์ตั้ง `ClientRequest=true` แล้ว service เรียก `ValidateClientPolicy(level)`; ตารางเงิน/สต็อก/GL ปฏิเสธทุกคน (403 `ErrMoneyTableViaExec`) และย้ายหน้าจอที่เขียนตารางเหล่านี้ไป `/api/process` ในคอมมิตเดียวกัน (stock_beginning, tax_amend, point_doc, doc_no_next)
- **Q2:** หลัก "ratchet": ย้ายหน้าจอไป Go แล้วถอดตารางพร้อมเพิ่มเคสเทสต์ (3ef39d32 ถอด datalist config ไปเซฟผ่าน `/process/master/datalistsave`)
- **Q3:** ลบ fallback ทิ้ง route เหลือ proxy 49 บรรทัด
- **Q4:** เพิ่ม `ValidateClientInsert(table, columns, level)` ใช้ตารางและ regex คอลัมน์ชุดเดียวกัน พร้อมเทสต์ level 1 ได้ 403
- **Q5:** รูปแบบที่ตัวตรวจอ่านเป้าหมายไม่ออกถูกปฏิเสธหรือจำกัดเฉพาะ admin

## commit ที่เกี่ยวข้อง
- `239b0997` — write_policy + allow-list + ย้ายการเขียนหน้าจอไป Go (2026-10-21)
- `923fae86` — เปลี่ยนเลข ADR เป็น 0011 (0006 ซ้ำ); checkout POS ใช้ลูกค้าเริ่มต้นของ posconfig เพราะ `CASH` ไม่ใช่ลูกค้า
- `3ef39d32` — ถอด `erp_user_datalist_config` ออกจาก allow-list
- `04903202` — ถอด barcode SQL fallback ของ Next (2026-10-22)
- `a47413ec` — กฎเดียวกันที่ `/blob/insert` (2026-10-24)

## โค้ดปัจจุบันที่ป้องกัน
- `backend/internal/domain/query/write_policy.go:24` `moneyTablePattern`, `:64` `ValidateClientInsert`, `:77` `ValidateClientPolicy`
- `backend/internal/domain/query/query.go:63` `protectedSystemTablePattern`
- `application/query/service.go:105,146` เรียก policy เมื่อ `ClientRequest`; `adapter/inbound/http/query/handler.go:245,299` ตั้งค่า true; `blob/handler.go:98`
- เทสต์: `write_policy_test.go:8,51,65`; `backend/test/blob_integration_test.go:151`

## บทเรียน / กฎที่ได้
1. ทุกประตูเขียน (exec, execBatch, blob insert, fallback ของ Next) ต้องผ่านฟังก์ชันตรวจเดียว
2. อ่านเป้าหมายไม่ได้ = ปฏิเสธ แล้วเพิ่มเทสต์ทุกรูปแบบที่หลุด
3. ข้อมูลที่ผู้ใช้เก็บแล้วไปรันที่อื่น (SQL ใน datalist config) ห้ามอยู่ใน allow-list
4. ย้ายหน้าจอไป Go ทุกครั้ง ถอดตารางจาก allow-list และเพิ่มเคสใน `TestValidateClientPolicy`
5. fallback ฝั่ง proxy ที่เขียนข้อมูลเองคือช่องโหว่ ให้ error ตรง ๆ

## ดูเพิ่ม
[[adr-0011-query-exec-write-lockdown]] · [[adr-0006-query-exec-dml-only-guardrails]] · [[adr-0010-blob-insert-storage]] · [[hist-lessons-permission-rights]] · [[hist-lessons-atomic-transactions-swallowed-errors]] · [[std-security-authz-and-web-vulns]] · [[history-overview]]

## ที่มาในโค้ด
- git:239b0997, git:923fae86, git:3ef39d32, git:04903202, git:a47413ec
- backend/docs/adr/0011-query-exec-write-lockdown.md
- backend/internal/domain/query/write_policy.go:24, :64, :77
