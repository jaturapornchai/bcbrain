---
title: "บทเรียนเอกสารอ้างอิงและ Doc Flow (Document Reference & Flow)"
tags: [history, lesson, docflow, ref, import]
aliases: ["ref import", "refimport", "doc flow graph", "billing dedupe", "last_status used_status", "docFlowTx"]
sources: ["backend/internal/application/process/doc_flow.go:146", "backend/internal/application/process/doc_flow.go:91", "backend/internal/application/process/trans.go:435", "backend/internal/application/process/trans.go:580", "backend/internal/application/process/trans_ref_import.go:24", "backend/internal/application/process/trans_ref_import_header.go:273", "backend/internal/application/process/trans_ref_import_lines.go:100", "backend/internal/application/process/trans_ref_import_it_test.go:186", "backend/internal/application/process/doc_flow_graph.go:604", "backend/internal/adapter/inbound/http/process/transgrid_handler.go:66", "frontend/account/transaction/DocumentFlowModal.tsx:174", "frontend/account/transaction/TransBillsGrid.tsx:152"]
---
# บทเรียนเอกสารอ้างอิงและ Doc Flow

เอกสารอ้างอิง (ดึงรายการจากใบก่อนหน้า) และสถานะ flow (`last_status`, `used_status`, `doc_success`) เป็นข้อมูลที่เอกสารหลายใบแตะร่วมกัน ถ้าคำนวณกระจัดกระจายหรือดึงไม่ครบ ยอดค้างและสถานะ "ใช้แล้ว/ปิดแล้ว" จะเพี้ยนแบบหาที่มายาก

## อะไรพังได้
- **สถานะ flow คำนวณคนละที่:** ถ้าแต่ละจอคำนวณ `used_status`/`doc_success` เอง เอกสารต้นทางจะไม่ตามเมื่อใบปลายทางถูกบันทึก/ยกเลิก
- **ดึงอ้างอิงที่ฝั่ง browser:** ยอดคงเหลือต่อบรรทัดและฟิลด์หัวเอกสารที่ได้จากหลายใบ ถ้าไม่ผ่าน backend ที่เดียว ผลจะต่างกันตามจอ
- **ฟิลด์หัวเอกสารจากหลายใบ:** เมื่อดึงจากหลายเอกสารพร้อมกัน ต้องมีกติกาแน่นอนว่าใบไหนชนะ ไม่งั้นค่าที่เติมให้เปลี่ยนไปตามลำดับที่ฐานข้อมูลคืนแถว
- **ปลายทางคลัง/ที่เก็บของใบขอโอน:** ปลายทางของใบขอโอนอยู่ใน `wh_code_2`/`shelf_code_2` ของแต่ละบรรทัด ถ้าไม่บันทึกและโหลดคอลัมน์นี้ ปลายทางจะหายตอนดึงไปทำเอกสารต่อ
- **slice ว่างกลายเป็น `null`:** Go slice ที่เป็น `nil` ถูก marshal เป็น JSON `null` ถ้า client ใช้ต่อโดยไม่ตรวจ หน้า Document Flow ของเอกสารที่ไม่มีเส้นเชื่อมจะ crash
- **แถวซ้ำจากการวางบิล:** เอกสารหนี้ใบเดียวถูกวางบิลซ้ำได้หลายใบ ถ้า join ตรงๆ ตัวเลือกใบวางบิลจะซ้ำ

## โค้ดป้องกันไว้อย่างไร
| ด่าน | ที่อยู่ | ทำอะไร |
|---|---|---|
| คำนวณสถานะ flow ที่เดียว | `doc_flow.go:146` `docFlowTx`, `:91` `flowRules` | เดินจากเอกสารที่บันทึก ขึ้นไปยังเอกสารต้นทางทั้งสาย แล้วคำนวณใหม่ตามกฎของแต่ละ `trans_flag` |
| อยู่ใน tx เดียวกับการบันทึก/ยกเลิก | เรียกที่ `trans.go:435,580`, `backend/internal/application/process/docs.go:215`, `doc_cancel.go:187,253` | สถานะเปลี่ยนพร้อมเอกสาร หรือย้อนพร้อมกัน |
| ดึงอ้างอิงเป็น endpoint เดียว | `transgrid_handler.go:66` (`refimport`) | ฝั่ง browser เรียก backend ที่เดียว |
| ยอดคงเหลือต่อคู่ flag | `trans_ref_import.go:24` `refImportSpecs` | ระบุยอดคงเหลือต่อคู่ `{trans_flag, ref trans_flag}` คู่ที่ไม่อยู่ในรายการใช้จำนวนเต็มของบรรทัดอ้างอิง (ด่านตอนบันทึกยังกันดึงเกิน) |
| ใบสุดท้ายชนะ | `trans_ref_import_header.go:273-285` `refDocRefProcessHeader` | อ่านหัวเอกสารเรียงตาม `doc_no` แล้วใช้แถวสุดท้ายตั้งค่าฟิลด์ทั้งชุด |
| ปลายทางของใบขอโอน | `trans_ref_import_lines.go:100,357` | อ่าน `wh_code_2`/`shelf_code_2` ติดมากับบรรทัดอ้างอิง |
| เทสต์ ref-import | `trans_ref_import_it_test.go:186` `TestRefImportDocRefProcess`, `:220` `TestRefImportTransfer72` | รันใน tx เดียวแล้ว rollback ทุกเทสต์ ข้ามเมื่อไม่ตั้ง `GLIT_DB` |
| edges ไม่เป็น `null` | `doc_flow_graph.go:604` `make([]DocFlowEdge, 0)`; `DocumentFlowModal.tsx:174-175` | backend ส่ง `[]` เสมอ และ client ตรวจ `Array.isArray` ซ้ำ |
| ตัวเลือกใบวางบิลไม่ซ้ำ | `TransBillsGrid.tsx:148-152` | `DISTINCT ON (bill_type, billing_no)` เลือกใบวางบิลล่าสุด |

## กฎที่ต้องจำ
1. สถานะ flow คำนวณใน `docFlowTx` ที่เดียวและใน tx เดียวกับการบันทึก ห้ามแก้ `used_status`/`doc_success` เองจากจอ
2. ฟิลด์ที่เติมจากหลายเอกสารต้องมี `ORDER BY` ชัดเจนและกติกาผู้ชนะที่ระบุไว้ (ตอนนี้ใบสุดท้ายตาม `doc_no`)
3. slice ที่ส่งออก JSON ต้อง init ด้วย `make(..., 0)` และ client ต้อง guard ซ้ำ
4. join ที่อาจได้หลายแถวต่อ key ธุรกิจต้องใช้ `DISTINCT ON` พร้อม `ORDER BY` ที่กำหนดผล
5. ทดสอบ ref-import ด้วยฐานจริงแบบ rollback (เทสต์ต้องตั้ง `GLIT_DB` และตัวแปร `PG*` ของฐานบริษัท)

## ที่มาในโค้ด
- `backend/internal/application/process/doc_flow.go:91,146` กฎและตัวเดินสถานะ
- `backend/internal/application/process/trans_ref_import_header.go:273-285` กติกาใบสุดท้ายชนะ
- `backend/internal/application/process/doc_flow_graph.go:604` edges เริ่มต้นเป็น slice ว่าง
- `frontend/account/transaction/DocumentFlowModal.tsx:174-175` guard ฝั่ง client
- ดูเพิ่ม: [[proc-doc-flow-numbering]] · [[std-parallel-unit-and-ref-import]] · [[proc-doc-cancel-approve]] · [[hist-lessons-trans-save-rules]] · [[hist-lessons-cancel-delete-partial]]
