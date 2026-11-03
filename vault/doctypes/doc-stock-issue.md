---
title: "เบิกสินค้า/วัตถุดิบ (Stock Issue)"
tags: [doctypes, inventory]
aliases: ["trans_flag 56", "เบิกสินค้า", "ใบเบิก", "IO"]
sources: ["frontend/account/tabs/transMenuMap.ts:996", "frontend/account/transaction/transLayouts.ts:93", "backend/internal/application/process/stock_rebuild.go:18", "backend/internal/application/process/trans_save_rules.go:55", "backend/internal/application/process/service.go:2146", "backend/internal/application/process/service.go:1459", "backend/internal/application/process/trans_ref_import.go:23", "backend/internal/application/process/doc_cancel.go:53"]
---

# เบิกสินค้า/วัตถุดิบ (trans_flag 56)

## ใช้เมื่อไร
ใช้เบิกสินค้าหรือวัตถุดิบออกจากคลังไปใช้ อ้างใบขอเบิก 122 ได้ อยู่ที่เมนู "เบิกสินค้า/วัตถุดิบ" (IO, transMenuMap.ts:996)

## trans_flag/ตาราง
- trans_flag 56, calc_flag −1 เก็บใน [[tbl-ic-trans]] + [[tbl-ic-trans-detail]]

## ฟิลด์/แท็บบนหน้าจอ
- หัวเอกสาร: refDoc, wh แท็บ gl (transLayouts.ts:93)
- ไม่แสดงราคา (transLayouts.ts:474)

## ผลต่อสต็อก
- ตัดออก (−1) (stock_rebuild.go:18)
- อยู่ใน `stockCheckFlags` ซึ่งตรวจยอดคงเหลือตอนบันทึก (trans_save_rules.go:55)

## ผลต่อภาษี (VAT/WHT)
ไม่มี

## การลงบัญชี
ใช้ standard GL (service.go:2146)
| Dr | Cr |
|---|---|
| ต้นทุน 5110/5111 (ยอดรวม) | สินค้า 1131/1130/1141 |

ถ้ายอดหัวเอกสารเป็น 0 จะใช้ผลรวมต้นทุนรายบรรทัด (service.go:1459)

## เอกสารต้นทาง-ปลายทาง
- ต้นทาง: ขอเบิก 122 (คู่ {56,122} trans_ref_import.go:23)
- ปลายทาง: รับคืนจากการเบิก 58 (คู่ {58,56})

## ยกเลิก/แก้ไข
- ยกเลิกด้วย flag 57 (doc_cancel.go:53)

## ข้อควรระวัง
- บัญชี Dr ใช้ต้นทุนชุดเดียวกับการขาย (5110/5111) ไม่ได้แยกตามวัตถุประสงค์การเบิก ยกเว้นเมื่อใช้ template ดู [[acc-gl-template-engine]]

## ที่มาในโค้ด
- `frontend/account/tabs/transMenuMap.ts:996` เมนู
- `frontend/account/transaction/transLayouts.ts:93` FLAG_SPEC 56
- `backend/internal/application/process/trans_save_rules.go:55` stockCheckFlags
- `backend/internal/application/process/service.go:2146` GL
- `backend/internal/application/process/doc_cancel.go:53` ยกเลิก 57

## ดูเพิ่ม
- [[doc-issue-request]] · [[doc-issue-return]] · [[acc-inventory-cost-moving-average]] · [[doctypes-overview]]
