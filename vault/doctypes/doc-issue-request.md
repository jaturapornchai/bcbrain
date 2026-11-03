---
title: "ขอเบิกสินค้า/วัตถุดิบ (Issue Request)"
tags: [doctypes, inventory]
aliases: ["trans_flag 122", "ขอเบิกสินค้า", "ใบขอเบิก", "RIO"]
sources: ["frontend/account/tabs/transMenuMap.ts:967", "frontend/account/transaction/transLayouts.ts:113", "frontend/account/transaction/transLayouts.ts:306", "frontend/account/transaction/transLayouts.ts:474", "backend/internal/application/process/trans_ref_import.go:28", "backend/internal/application/process/doc_flow.go:89", "backend/internal/application/process/doc_flow.go:91", "backend/internal/application/process/stock_rebuild.go:19", "backend/internal/application/process/doc_cancel.go:53"]
---

# ขอเบิกสินค้า/วัตถุดิบ (trans_flag 122)

## ใช้เมื่อไร
ใช้ขออนุมัติเบิกก่อนเบิกจริงด้วยใบ 56 อยู่ที่เมนู "ขอเบิกสินค้า/วัตถุดิบ" (RIO, transMenuMap.ts:967)

## trans_flag/ตาราง
- trans_flag 122 เก็บใน [[tbl-ic-trans]] + [[tbl-ic-trans-detail]]

## ฟิลด์/แท็บบนหน้าจอ
- หัวเอกสาร: refDoc, sale, wh ไม่มีแท็บ (transLayouts.ts:113)
- ช่อง sale แสดงชื่อ "ผู้ขออนุมัติ:" (transLayouts.ts:306) และไม่แสดงราคา (transLayouts.ts:474)

## ผลต่อสต็อก
ไม่มี เพราะไม่อยู่ในรายการ flag ของ `stockRowsSQL` (stock_rebuild.go:19)

## ผลต่อภาษี (VAT/WHT)
ไม่มี

## การลงบัญชี
ไม่ลง GL

## เอกสารต้นทาง-ปลายทาง
- ปลายทาง: เบิก 56 (คู่ {56,122} trans_ref_import.go:28)
- `flowRules` (doc_flow.go:91) ไม่มีกฎของ 122/56 ในโค้ดจึงไม่คำนวณสถานะต่อเนื่องของใบขอเบิก (comment doc_flow.go:89)

## ยกเลิก/แก้ไข
- ยกเลิกด้วย flag 123 (doc_cancel.go:53)

## ข้อควรระวัง
- เพราะไม่มีกฎใน `flowRules` used_status ของใบขอเบิกจึงไม่ถูกคำนวณจากใบเบิก

## ที่มาในโค้ด
- `frontend/account/tabs/transMenuMap.ts:967` เมนู
- `frontend/account/transaction/transLayouts.ts:113` FLAG_SPEC 122
- `backend/internal/application/process/trans_ref_import.go:28` refImportSpecs {56,122}
- `backend/internal/application/process/doc_flow.go:89` / `:91` ไม่มีกฎ flow ของ 122/56
- `backend/internal/application/process/doc_cancel.go:53` ยกเลิก 123

## ดูเพิ่ม
- [[doc-stock-issue]] · [[proc-doc-flow-numbering]] · [[doctypes-overview]]
