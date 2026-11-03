---
title: "รับคืนสินค้า/วัตถุดิบ จากการเบิก (Issue Return)"
tags: [doctypes, inventory]
aliases: ["trans_flag 58", "รับคืนจากการเบิก", "IR"]
sources: ["frontend/account/tabs/transMenuMap.ts:1027", "frontend/account/transaction/transLayouts.ts:94", "backend/internal/application/process/stock_rebuild.go:19", "backend/internal/application/process/transcalc.go:16", "backend/internal/application/process/service.go:2157", "backend/internal/application/process/service.go:2167", "backend/internal/application/process/service.go:1470", "frontend/account/transaction/transLayouts.ts:475", "backend/internal/application/process/trans_ref_import.go:29", "backend/internal/application/process/doc_cancel.go:53"]
---

# รับคืนสินค้า/วัตถุดิบ จากการเบิก (trans_flag 58)

## ใช้เมื่อไร
ใช้รับของที่เบิกไปแล้วกลับเข้าคลัง อ้างใบเบิก 56 อยู่ที่เมนู "รับคืนสินค้า/วัตถุดิบ จากการเบิก" (IR, transMenuMap.ts:1027)

## trans_flag/ตาราง
- trans_flag 58, calc_flag +1 (transcalc.go:16) เก็บใน [[tbl-ic-trans]] + [[tbl-ic-trans-detail]]

## ฟิลด์/แท็บบนหน้าจอ
- หัวเอกสาร: refDoc, wh แท็บ gl (transLayouts.ts:94)
- ราคาชื่อ "ต้นทุน/หน่วย" (transLayouts.ts:475)

## ผลต่อสต็อก
รับเข้า (+1) เพราะ 58 อยู่ในรายการ flag ของ `stockRowsSQL` (stock_rebuild.go:19) และ calc_flag = +1

## ผลต่อภาษี (VAT/WHT)
ไม่มี

## การลงบัญชี
ใช้ standard GL (service.go:2157) บัญชีสินค้าเป็นผังบัญชีตัวแรกที่มีใน 1131/1130/1141 และต้นทุนใน 5110/5111 (service.go:2158-2159)
| Dr | Cr |
|---|---|
| สินค้า 1131/1130/1141 | ต้นทุน 5110/5111 |

## เอกสารต้นทาง-ปลายทาง
- ต้นทาง: เบิก 56 (คู่ {58,56} trans_ref_import.go:29)

## ยกเลิก/แก้ไข
- ยกเลิกด้วย flag 59 (doc_cancel.go:53)

## ข้อควรระวัง
- ยอด GL คือ total_amount ของหัวเอกสาร (service.go:2167) ไม่ได้ใช้ต้นทุนที่คำนวณจากสต็อก ถ้า total_amount เป็น 0 จึงใช้ผลรวมรายบรรทัด sum_of_cost/sum_amount/qty × average_cost (service.go:1470) ดู [[acc-gl-posting-standard]]

## ที่มาในโค้ด
- `frontend/account/tabs/transMenuMap.ts:1027` เมนู
- `frontend/account/transaction/transLayouts.ts:94` FLAG_SPEC 58
- `backend/internal/application/process/service.go:2157-2168` GL
- `backend/internal/application/process/doc_cancel.go:53` ยกเลิก 59

## ดูเพิ่ม
- [[doc-stock-issue]] · [[doctypes-overview]]
