---
title: "เบิกสินค้า/วัตถุดิบ (Stock Issue)"
tags: [doctypes, inventory]
aliases: ["trans_flag 56", "เบิกสินค้า", "ใบเบิก", "IO"]
sources: ["frontend/account/tabs/transMenuMap.ts:996", "frontend/account/transaction/transLayouts.ts:93", "frontend/account/transaction/transLayouts.ts:474", "backend/internal/application/process/transcalc.go:21", "backend/internal/application/process/stock_rebuild.go:19", "backend/internal/application/process/trans_save_rules.go:55", "backend/internal/application/process/service.go:1748", "backend/internal/application/process/service.go:2157", "backend/internal/application/process/service.go:1470", "backend/internal/application/process/trans_ref_import.go:28", "backend/internal/application/process/trans_ref_import.go:29", "backend/internal/application/process/doc_cancel.go:53"]
---

# เบิกสินค้า/วัตถุดิบ (trans_flag 56)

## ใช้เมื่อไร
ใช้เบิกสินค้าหรือวัตถุดิบออกจากคลังไปใช้ อ้างใบขอเบิก 122 ได้ อยู่ที่เมนู `menu_ic_issue` "เบิกสินค้า/วัตถุดิบ" (IO, `refTransFlags: [122]` transMenuMap.ts:996)

## trans_flag/ตาราง
- trans_flag 56, calc_flag −1 (transcalc.go:21) เก็บใน [[tbl-ic-trans]] + [[tbl-ic-trans-detail]]

## ฟิลด์/แท็บบนหน้าจอ
- หัวเอกสาร: refDoc, wh แท็บ gl (transLayouts.ts:93)
- ไม่แสดงราคา (transLayouts.ts:474)

## ผลต่อสต็อก
- อยู่ในชุด flag ที่นับสต็อก (`stockRowsSQL` stock_rebuild.go:19) calc_flag −1 จึงเป็นสต็อกออก
- อยู่ใน `stockCheckFlags` ซึ่งตรวจยอดคงเหลือตอนบันทึก (trans_save_rules.go:55)

## ผลต่อภาษี (VAT/WHT)
ไม่มี (ไม่อยู่ใน `transVatTabs` / `transWhtParty` trans_tax.go:37, :48)

## การลงบัญชี
standard GL `case 56, 58, 60, 66, 68` (service.go:2157-2168, อยู่ใน `glRebuildTransFlags` service.go:1748)
| Dr | Cr | จำนวน |
|---|---|---|
| ต้นทุน 5110 (สำรอง 5111) | สินค้า 1131 (สำรอง 1130, 1141) | ยอดรวม |

ถ้า total_amount ของหัวเอกสารเป็น 0 ยอดรวมมาจากผลรวมบรรทัด (sum_of_cost → sum_amount → transfer_amount → qty × average_cost) (service.go:1470-1484)

## เอกสารต้นทาง-ปลายทาง
- ต้นทาง: ขอเบิก 122 (คู่ {56,122} trans_ref_import.go:28)
- ปลายทาง: รับคืนจากการเบิก 58 (คู่ {58,56} trans_ref_import.go:29)

## ยกเลิก/แก้ไข
- ยกเลิกด้วย flag 57 (doc_cancel.go:53)

## ข้อควรระวัง
- บัญชี Dr ใช้ต้นทุนชุดเดียวกับการขาย (5110/5111) ไม่ได้แยกตามวัตถุประสงค์การเบิก ยกเว้นเมื่อใช้ template ดู [[acc-gl-template-engine]]

## ที่มาในโค้ด
- `frontend/account/tabs/transMenuMap.ts:996` เมนู
- `frontend/account/transaction/transLayouts.ts:93` FLAG_SPEC 56
- `backend/internal/application/process/trans_save_rules.go:55` stockCheckFlags
- `backend/internal/application/process/service.go:2157` GL
- `backend/internal/application/process/doc_cancel.go:53` ยกเลิก 57

## ดูเพิ่ม
- [[doc-issue-request]] · [[doc-issue-return]] · [[acc-inventory-cost-moving-average]] · [[doctypes-overview]]
