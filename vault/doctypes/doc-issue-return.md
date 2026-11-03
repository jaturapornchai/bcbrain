---
title: "รับคืนสินค้า/วัตถุดิบ จากการเบิก (Issue Return)"
tags: [doctypes, inventory]
aliases: ["trans_flag 58", "รับคืนจากการเบิก", "IR"]
sources: ["frontend/account/tabs/transMenuMap.ts:1027", "frontend/account/transaction/transLayouts.ts:94", "backend/internal/application/process/stock_rebuild.go:18", "backend/internal/application/process/service.go:2146", "backend/internal/application/process/trans_ref_import.go:23", "backend/internal/application/process/doc_cancel.go:53"]
---

# รับคืนสินค้า/วัตถุดิบ จากการเบิก (trans_flag 58)

## ใช้เมื่อไร
ใช้รับของที่เบิกไปแล้วกลับเข้าคลัง อ้างใบเบิก 56 อยู่ที่เมนู "รับคืนสินค้า/วัตถุดิบ จากการเบิก" (IR, transMenuMap.ts:1027)

## trans_flag/ตาราง
- trans_flag 58, calc_flag +1 เก็บใน [[tbl-ic-trans]] + [[tbl-ic-trans-detail]]

## ฟิลด์/แท็บบนหน้าจอ
- หัวเอกสาร: refDoc, wh แท็บ gl (transLayouts.ts:94)
- ราคาชื่อ "ต้นทุน/หน่วย" (transLayouts.ts:475)

## ผลต่อสต็อก
รับเข้า (+1) (stock_rebuild.go:18)

## ผลต่อภาษี (VAT/WHT)
ไม่มี

## การลงบัญชี
ใช้ standard GL (service.go:2146)
| Dr | Cr |
|---|---|
| สินค้า 1131/1130/1141 | ต้นทุน 5110/5111 |

## เอกสารต้นทาง-ปลายทาง
- ต้นทาง: เบิก 56 (คู่ {58,56} trans_ref_import.go:23)

## ยกเลิก/แก้ไข
- ยกเลิกด้วย flag 59 (doc_cancel.go:53)

## ข้อควรระวัง
- ยอด GL ใช้ยอดหัวเอกสาร ซึ่งอาจไม่ตรงกับต้นทุนที่ rebuild ใหม่ ดู [[acc-gl-posting-standard]]

## ที่มาในโค้ด
- `frontend/account/tabs/transMenuMap.ts:1027` เมนู
- `frontend/account/transaction/transLayouts.ts:94` FLAG_SPEC 58
- `backend/internal/application/process/service.go:2146` GL
- `backend/internal/application/process/doc_cancel.go:53` ยกเลิก 59

## ดูเพิ่ม
- [[doc-stock-issue]] · [[doctypes-overview]]
