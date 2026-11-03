---
title: "บทเรียนกฎตอนบันทึกเอกสาร (Trans Save Rules & Validation)"
tags: [history, trans, save, validation]
aliases: ["กฎตอนบันทึกเอกสาร", "warning_branch_input", "doc_group binding", "book_code gl_journal"]
sources: ["git:8698303f", "git:5f188fc3", "git:00815c01", "git:054c6063", "git:678fc5fc", "backend/internal/application/process/trans_validate.go:43", "docs/kms/KMS_SECURITY_DATA_INTEGRITY_LESSONS.md"]
---

## ภาพรวม
ด่านตรวจตอนบันทึก `ic_trans` ถูกย้ายจาก browser มาฝั่ง Go ตาม C# `_icTransControl._saveData` ทีละชุด 2026-10-21..24 บั๊กซ้ำมี 3 แบบ: ไม่มีด่านฝั่ง server, ด่านตรวจค่า/ลำดับไม่ตรง C#, และช่อง UI ผูกคอลัมน์ผิดจนเขียนทับข้อมูลเงียบๆ

## อาการ
- **A (8698303f, bf0222f4):** commit เพิ่ม `trans_validate.go` (+389), `trans_party.go`, `grid_calc.go`, `price_engine.go` เป็นไฟล์ใหม่ แปลว่าปิดงวด/ตรวจช่อง-คู่ค้า/คำนวณราคาเคยอยู่ฝั่ง browser เท่านั้น (อนุมานจาก diff; commit ไม่ระบุอาการ)
- **B (5f188fc3, b002e065, 619fbaf7):** กฎ C# ตอนบันทึกยังไม่มีใน Go: ยอดคงเหลือ, วงเงินเครดิต, ต้นทุนต่ำ, lot, ภาษีซื้อ, สถานะคู่ค้า, จำนวนอ้างอิง (ตามข้อความ commit; ยังไม่ได้ตรวจ diff)
- **C (00815c01):** เปิด `warning_branch_input` แล้วเตือนผิด เพราะตรวจสาขาหลังระบบเติม default แล้ว ทั้งที่ C# ตรวจค่าที่ผู้ใช้พิมพ์
- **D (678fc5fc):** ช่อง "กลุ่มเอกสาร" เขียนทับ `approve_code` (กลุ่มผู้อนุมัติ); ช่องสมุดรายวัน gl_journal ค้างค่าเอกสารก่อนหน้าแล้วถูกบันทึกเปลี่ยนเงียบๆ
- **E (054c6063):** สินค้าจัดชุด/สูตรสี (item_type 3/5) ไม่ถูกกระจายเป็นแถวลูก และยอดหัวบิลต้องข้ามแถวชุด

## สาเหตุ (root cause)
- A: logic ธุรกิจอยู่ฝั่ง client ขัดกฎ thin-client (AGENTS.md ข้อ 10) เรียก API ตรงข้ามด่านได้
- C: C# เช็กกับ "ช่องสาขาก่อน default fill" (`_icTransControl.cs:13222` ตามคอมเมนต์ใน `trans.go`) แต่ Go ส่งสาขาที่ resolve แล้ว ช่องที่ผู้ใช้ล้างจึงมองไม่เห็น
- D: ผูก field ตามป้ายบนจอไม่ใช่ชื่อคอลัมน์ (`docGroup` ถูกต่อกับ `approveCode`) และโหลดเอกสารไม่ reset `book_code`
- E: C# ให้แถวลูกถือสต็อก แถวชุดเป็นตัวรวมยอด Go ยังไม่แยกชนิด

## วิธีแก้
- A: `checkTransScreenSave` ทำใน tx เดียวกับการบันทึก เริ่ม `checkOpenPeriod` (ยกเว้น `periodExemptFlags`) ต่อด้วย lock/สิทธิ์/ฟิลด์/คู่ค้า/เอกสารอ้างอิง
- B: รวมเป็น `checkTransSaveRules`; ข้อความถามผู้ใช้ใช้ prefix `CONFIRM:` / `CREDIT_PASSWORD:` (409) แล้ว client ส่งซ้ำ; lot อัตโนมัติ (`find_lot_auto`) ทำฝั่ง server
- C: เก็บ `branchBox` = ค่าที่พิมพ์ (หรือ default เมื่อช่องถูกล็อก) แยกจาก `BranchCode`; เพิ่ม `check_qty_over_doc_ref` ใน commit เดียวกัน
- D: ผูกช่องกับ `ic_trans.doc_group` ตรงๆ และโหลด `book_code` ของเอกสารที่เปิด
- E: `expandSet` แทรกแถวลูกจาก `ic_inventory_set_detail` ใต้แถวชุด (แถวชุดมี `ref_guid` แถวลูกมี `set_ref_line`) ยอดหัวบิลข้ามแถวชุด

## commit ที่เกี่ยวข้อง
- `8698303f` — header defaults + save validation + period check
- `bf0222f4` — grid calc + C# price engine ใน backend
- `5f188fc3` — กฎบันทึก C# ชุดใหญ่ (R-SAVE)
- `b002e065` — find_lot_auto, อนุมัติเครดิต, credit hold 34/36
- `619fbaf7` — ตัวเลือกจอบน, ตัวกรองเอกสารอ้างอิง/คลัง, ref item check
- `00815c01` — check_qty_over_doc_ref + ลำดับ warning_branch_input
- `054c6063` — ขยายสินค้าชุด 3/5 เป็นแถวลูก
- `678fc5fc` — แก้ doc_group / book_code binding

## โค้ดปัจจุบันที่ป้องกัน
- `process/trans_validate.go:43` checkTransScreenSave; `:26` readScreenOptions อ่าน erp_option ด้วย `COALESCE(...,0)` (ไม่มีแถว = ปิดทุกสวิตช์)
- `process/period.go:17` checkOpenPeriod; `trans_save_rules.go:134` checkTransSaveRules, `:389` checkStockBalance, `:522` checkCreditLimit
- `trans_lot_auto.go:32` autoLots (เรียกที่ `trans.go:285`); `trans.go:337` transBranch คืน `(code, box)`
- `trans_qty_over_ref.go:41` checkQtyOverDocRef; `trans_set_item.go:71` expandSet
- `frontend/account/transaction/TransTopForm.tsx:626-627`, `TransExtraTabs.tsx:308-310` ผูก `docGroup`; `UniversalTransScreen.tsx:1262-1267` โหลด book_code ต่อเอกสาร

## บทเรียน / กฎที่ได้
1. ทุกด่านที่ C# มีต้องอยู่ใน `checkTransScreenSave` ภายใน tx บันทึก; ฝั่ง browser ตรวจเพื่อ UX เท่านั้น
2. พอร์ต option ที่ตรวจ "ช่องบนจอ" ต้องถามก่อนว่า C# ตรวจก่อนหรือหลัง default fill แล้วส่งค่าช่วงนั้นเข้า server
3. ผูก field ด้วยชื่อคอลัมน์ ไม่ผูกตามป้าย; ค่าต่อเอกสารต้อง reset ทุกครั้งที่เปิดเอกสารใหม่
4. ด่านที่ต้องถามผู้ใช้ใช้โปรโตคอล prefix 409 แล้วส่งซ้ำ ห้ามตัดสินใจที่ client

## ดูเพิ่ม
[[acc-transaction-save-flow]] · [[acc-credit-limit-save-rules]] · [[acc-period-close]] · [[proc-grid-calc]] · [[hist-lessons-doc-ref-docflow]] · [[hist-lessons-cancel-delete-partial]]

## ที่มาในโค้ด
- `backend/internal/application/process/trans_validate.go:26,43`
- `backend/internal/application/process/trans_save_rules.go:134`
- `backend/internal/application/process/trans.go:285,337`
- `frontend/account/transaction/UniversalTransScreen.tsx:1262`
- git:8698303f, git:00815c01, git:678fc5fc
