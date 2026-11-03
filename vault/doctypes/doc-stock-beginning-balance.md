---
title: "สินค้า/วัตถุดิบ คงเหลือยกมา (Stock Beginning Balance)"
tags: [doctypes, inventory]
aliases: ["trans_flag 54", "สินค้าคงเหลือยกมา", "ยอดยกมาสินค้า", "IB", "StockBeginningSave"]
sources: ["frontend/account/tabs/transMenuMap.ts:924", "frontend/account/transaction/transLayouts.ts:92", "frontend/account/transaction/transLayouts.ts:475", "frontend/account/tabs/screenRegistry.tsx:806", "backend/internal/application/process/transcalc.go:16", "backend/internal/application/process/stock_beginning.go:218", "backend/internal/application/process/stock_beginning.go:291", "backend/internal/application/process/stock_beginning.go:307", "backend/internal/application/process/stock_beginning.go:558", "backend/internal/application/process/stock_beginning.go:634", "backend/internal/application/process/stock_rebuild.go:19", "backend/internal/application/process/service.go:1748", "backend/internal/application/process/service.go:1677", "backend/internal/application/process/doc_flow_graph.go:193", "backend/internal/application/process/doc_cancel.go:53"]
---

# สินค้า/วัตถุดิบ คงเหลือยกมา (trans_flag 54)

## ใช้เมื่อไร
ใช้บันทึกยอดสินค้าคงเหลือตอนเริ่มใช้ระบบ อยู่ที่เมนู `menu_ic_stk_balance` "สินค้า/วัตถุดิบ คงเหลือยกมา" (IB, transMenuMap.ts:924) และใช้จอ `StockBeginningBalanceScreen` (screenRegistry.tsx:806)

## trans_flag/ตาราง
- trans_flag 54, calc_flag +1 (transcalc.go:16) เก็บใน [[tbl-ic-trans]] + [[tbl-ic-trans-detail]] รวมแถว serial/lot
- บันทึกผ่าน `StockBeginningSave` ซึ่งแยกจาก save ปกติ (stock_beginning.go:307)

## ฟิลด์/แท็บบนหน้าจอ
- หัวเอกสาร: refDoc, wh แท็บ gl (transLayouts.ts:92)
- คอลัมน์ราคาชื่อ "ต้นทุน/หน่วย" (transLayouts.ts:475)
- มูลค่าบรรทัด = จำนวน × ราคา ปัด HALF_UP 2 ตำแหน่ง (stock_beginning.go:218)

## ผลต่อสต็อก
อยู่ในชุด flag ที่นับสต็อก (`stockRowsSQL` stock_rebuild.go:19) calc_flag +1 จึงเป็นสต็อกเข้า

## ผลต่อภาษี (VAT/WHT)
ไม่มี (ไม่อยู่ใน `transVatTabs` / `transWhtParty` trans_tax.go:37, :48)

## การลงบัญชี
- ไม่มี standard GL เพราะ 54 ไม่อยู่ใน `glRebuildTransFlags` (comment ที่ service.go:1748)
- แท็บ GL ให้ผู้ใช้คีย์บรรทัด Dr/Cr เอง ถ้ามีบรรทัดแล้วยอดเดบิตไม่เท่าเครดิตจะ error (stock_beginning.go:291) แล้วเขียนลง [[tbl-gl-journal]] (stock_beginning.go:558)
- รหัสบัญชีที่ไม่มีในผัง: ฝั่ง Dr ใช้ 1131 (สำรอง 1130, 1140) ฝั่ง Cr ใช้ 3110 (สำรอง 3100, 3210) (stock_beginning.go:634-638)

| Dr | Cr | จำนวน |
|---|---|---|
| ตามที่คีย์ (ไม่มีในผังใช้ 1131/1130/1140) | ตามที่คีย์ (ไม่มีในผังใช้ 3110/3100/3210) | ตามที่คีย์ |

## เอกสารต้นทาง-ปลายทาง
- ไม่มีต้นทาง ยอดนี้เป็นจุดเริ่มต้นของต้นทุนเฉลี่ย ดู [[acc-inventory-cost-moving-average]]

## ยกเลิก/แก้ไข
- ยกเลิกด้วย flag 55 (doc_cancel.go:53)

## ข้อควรระวัง
- doc_flow_graph.go:193 ให้ label flag 54 ว่า "รับสินค้าสำเร็จรูป" ซึ่งไม่ตรงกับชื่อเมนู
- rebuild GL ไม่ลบและไม่สร้าง GL ของ 54 ใหม่ (ลบเฉพาะ flag ใน `glRebuildTransFlags`) แต่จะเปลี่ยนรหัสบัญชีของบรรทัด 54 ที่ไม่มีในผังเป็น 1131/1130/1140 (Dr) หรือ 3110/3100/3210 (Cr) (service.go:1677-1686)

## ที่มาในโค้ด
- `frontend/account/tabs/transMenuMap.ts:924` เมนู
- `frontend/account/transaction/transLayouts.ts:92` FLAG_SPEC 54
- `backend/internal/application/process/stock_beginning.go:307` StockBeginningSave
- `backend/internal/application/process/stock_beginning.go:291` ตรวจสมดุล GL / `:558` insert gl_journal
- `backend/internal/application/process/service.go:1748` glRebuildTransFlags / `:1677` ปรับรหัสบัญชี 54
- `backend/internal/application/process/doc_cancel.go:53` ยกเลิก 55

## ดูเพิ่ม
- [[acc-stock-special-docs]] · [[acc-inventory-stock-rebuild]] · [[doctypes-overview]]
