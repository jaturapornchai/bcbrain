---
title: "บทเรียนเอกสารอ้างอิงและ Doc Flow (Document Reference & Flow)"
tags: [history, docflow, ref, import]
aliases: ["ref import", "DocRefProcess", "doc flow graph", "billing dedupe", "last_status used_status"]
sources: ["git:2beb446c", "git:070e845d", "git:f0c1eee8", "git:d19d3695", "git:6e89ce3a", "git:35ec4d24", "git:324bd2a6", "backend/internal/application/process/doc_flow.go:146", "docs/HANDOFF_BCCM_PARITY_2026-10-22.md:66"]
---

## ภาพรวม
เอกสารอ้างอิง (ดึงรายการจากใบก่อนหน้า) และสถานะ flow ของเอกสาร (`last_status`, `used_status`, `doc_success`) เป็นก้อนที่ C# กระจายอยู่หลายที่ ช่วง 2026-10-21..24 พอร์ตมารวมฝั่ง Go แล้วเจอบั๊ก 3 กลุ่ม: ลำดับ/ปลายทางของฟิลด์ไม่ตรง C#, โครงข้อมูลคืน `null`, และแถวซ้ำจากการวางบิล

## อาการ
- **A (2beb446c):** commit ไม่มีเนื้อความระบุอาการ (ระบุแค่ LOGIC-DOCFLOW-01..11) แต่ diff เพิ่ม `doc_flow.go` (+520) พร้อมเทสต์ +310 และลดโค้ดใน `service.go`/`doc_cancel.go` จึงอนุมานว่าสถานะใช้แล้ว/ปิดเอกสารเคยคำนวณกระจัดกระจายและไม่ตรง `_docFlowThread`
- **B (070e845d, f0c1eee8):** ดึงเอกสารอ้างอิงเดิมทำใน browser (SELECT + ค้นยอดคงเหลือ + ส่วนของ trans_grid); พอรวมเป็น endpoint เดียวพบว่า 124 (ขอโอน) ไม่บันทึก/โหลด `wh_code_2`/`shelf_code_2` และลำดับการเซ็ตหัวเอกสาร 56/58 ไม่ตรง C# (ต้องมาจากใบสุดท้าย)
- **C (d19d3695):** ฟิลด์แถวที่ C# บันทึก (serial, mfd, หน่วยเทียบ, total_qty) หายตอนดึงจากเอกสารอ้างอิง และผู้ใช้แก้คอลัมน์อ้างอิงได้หลังดึง
- **D (6e89ce3a, 35ec4d24):** เปิดหน้า Document Flow ของเอกสารที่มี 0 edge แล้วหน้าจอ crash; เอกสารที่เป็นเลขเช็ค/บัตร (cb_chq_list) ไม่มีกราฟ
- **E (324bd2a6, cd881a34):** ตัวเลือก "อ้างอิงใบรับวางบิล" แสดงแถวซ้ำ เพราะเอกสารหนี้ใบเดียวถูกวางบิลซ้ำได้หลายใบ

## สาเหตุ (root cause)
- B: C# เซ็ตฟิลด์จากทุกแถวของ `ORDER BY doc_no` คนสุดท้ายชนะ (`BCProcess/DocRefProcess/_docRefProcess.cs:255-258` ตามคอมเมนต์ใน `trans_ref_import_header.go`) พอร์ตแรกยังไม่ทำตามกติกานี้; ปลายทาง 124 อยู่ที่ grid cs:2691-2700 / save cs:14088-14110 ตามข้อความ commit
- C: `TransLine` ไม่มีฟิลด์เหล่านี้ จึงไม่ถูกบันทึกหรือส่งต่อ (R1 contract change ใน handoff §7)
- D: Go slice ที่เป็น `nil` ถูก marshal เป็น JSON `null` แล้ว client ใช้ค่า `null` นั้นต่อจน crash (ตามข้อความ commit 35ec4d24)
- E: join รายการวางบิลได้หลายแถวต่อ `(bill_type, billing_no)`

## วิธีแก้
- A: `docFlowTx` คำนวณสถานะต่อเอกสารตามกฎใน `init()` (`flowRule`) หลังบันทึกใน tx เดียวกัน
- B: `refImportSpecs` ระบุยอดคงเหลือต่อคู่ `{trans_flag, ref_flag}`; 124 ถูกบันทึก/โหลด/default; `refDocRefProcessHeader` เรียงตาม doc_no แล้วให้ใบสุดท้ายชนะ; เทสต์ DB rollback ครอบ 311/16/48, 56/58, 72 จาก 124
- C: เพิ่มฟิลด์ใน `TransLine`; ตั้งคอลัมน์อ้างอิงเป็น read-only หลังดึง (R3G-REF33/30)
- D: backend ใช้ `edges := make([]DocFlowEdge, 0)`; client ครอบ `Array.isArray`; เพิ่ม seed จาก cb_chq_list
- E: `DISTINCT ON (bill_type, billing_no)` เลือกใบวางบิลล่าสุด

## commit ที่เกี่ยวข้อง
- `2beb446c` — ย้ายตรรกะ doc flow ไป `doc_flow.go`
- `070e845d` — ref-import เป็น endpoint เดียว (`/process/transgrid/refimport`)
- `f0c1eee8` — 124 ปลายทางรายแถว, ลำดับหัว DocRefProcess, เทสต์ DB
- `d19d3695` — คอลัมน์/ล็อกอ้างอิง + ฟิลด์แถวเพิ่ม
- `6e89ce3a` — Document Flow modal + `/process/doc/flow`
- `35ec4d24` — แก้ null edges + flow จาก cb_chq_list
- `324bd2a6`, `cd881a34` — dedupe วางบิล / picker ใบวางบิล

## โค้ดปัจจุบันที่ป้องกัน
- `process/doc_flow.go:146` docFlowTx, `:180` deriveDocFlow, `:239` deriveLastStatus, `:402` flowDocSuccess
- `process/trans_ref_import.go:24` refImportSpecs; `trans_ref_import_header.go:273` refDocRefProcessHeader
- `process/trans_ref_import_it_test.go:14,186,220` (ครอบ 56/58, 72 จาก 124)
- `process/doc_flow_graph.go:604` ค่าเริ่ม edges; `frontend/account/transaction/DocumentFlowModal.tsx:174-175` guard `Array.isArray`
- `frontend/account/transaction/TransBillsGrid.tsx:148-152` DISTINCT ON

## บทเรียน / กฎที่ได้
1. ก่อนพอร์ต "ฟิลด์ที่ C# เซ็ตจากหลายแถว" ให้อ่านลำดับ ORDER BY และกติกา last-wins ก่อนเสมอ
2. ฟิลด์ใหม่ที่ C# บันทึก ต้องเพิ่มใน struct/contract ก่อน (R1) ไม่ใส่ในช่อง client เฉยๆ
3. slice ที่ส่งออก JSON ต้อง init ด้วย `make(...,0)` และ client ต้อง guard ซ้ำ
4. join ที่อาจได้หลายแถวต่อ key ธุรกิจต้อง `DISTINCT ON` พร้อม `ORDER BY` ที่กำหนดผล
5. ทดสอบ ref-import ด้วย DB จริงแบบ rollback (ชุดเทสต์มี env gate)

## ดูเพิ่ม
[[proc-doc-flow-numbering]] · [[std-parallel-unit-and-ref-import]] · [[proc-doc-cancel-approve]] · [[hist-lessons-trans-save-rules]] · [[hist-lessons-cancel-delete-partial]]

## ที่มาในโค้ด
- `backend/internal/application/process/doc_flow.go:146,180,239`
- `backend/internal/application/process/trans_ref_import_header.go:273`
- `backend/internal/application/process/doc_flow_graph.go:604`
- `frontend/account/transaction/DocumentFlowModal.tsx:174`
- `docs/HANDOFF_BCCM_PARITY_2026-10-22.md:66,73`
- git:2beb446c, git:f0c1eee8, git:35ec4d24, git:324bd2a6
