---
title: "สินค้า/วัตถุดิบ คงเหลือยกมา (Stock Beginning Balance)"
tags: [doctypes, inventory]
aliases: ["trans_flag 54", "สินค้าคงเหลือยกมา", "ยอดยกมาสินค้า", "IB", "StockBeginningSave"]
sources: ["frontend/account/tabs/transMenuMap.ts:924", "frontend/account/transaction/transLayouts.ts:92", "frontend/account/transaction/transLayouts.ts:475", "frontend/account/tabs/screenRegistry.tsx:806", "backend/internal/application/process/stock_beginning.go:290", "backend/internal/application/process/stock_beginning.go:307", "backend/internal/application/process/stock_beginning.go:558", "backend/internal/application/process/stock_rebuild.go:18", "backend/internal/application/process/service.go:1731", "backend/internal/application/process/doc_cancel.go:53"]
---

# สินค้า/วัตถุดิบ คงเหลือยกมา (trans_flag 54)

## ใช้เมื่อไร
ใช้บันทึกยอดสินค้าคงเหลือตอนเริ่มใช้ระบบ อยู่ที่เมนู "สินค้า/วัตถุดิบ คงเหลือยกมา" (IB, transMenuMap.ts:924) และใช้จอ `StockBeginningBalanceScreen` (screenRegistry.tsx:806)

## trans_flag/ตาราง
- trans_flag 54, calc_flag +1 เก็บใน [[tbl-ic-trans]] + [[tbl-ic-trans-detail]] รวมแถว serial/lot
- บันทึกผ่าน `StockBeginningSave` ซึ่งแยกจาก save ปกติ (stock_beginning.go:307)

## ฟิลด์/แท็บบนหน้าจอ
- หัวเอกสาร: refDoc, wh แท็บ gl (transLayouts.ts:92)
- คอลัมน์ราคาชื่อ "ต้นทุน/หน่วย" (transLayouts.ts:475)
- มูลค่าบรรทัด = จำนวน × ราคา ปัด HALF_UP 2 ตำแหน่ง (stock_beginning.go)

## ผลต่อสต็อก
รับเข้า (+1) (`stockRowsSQL` stock_rebuild.go:18)

## ผลต่อภาษี (VAT/WHT)
ไม่มี

## การลงบัญชี
- ไม่มี GL อัตโนมัติ เพราะ comment ของ `glRebuildTransFlags` ระบุว่า 54 ไม่ลง GL (service.go:1731)
- แท็บ GL ให้ผู้ใช้คีย์บรรทัด Dr/Cr เอง ต้องสมดุล มิฉะนั้นจะ error (stock_beginning.go:290) แล้วเขียนลง [[tbl-gl-journal]] (stock_beginning.go:558)

## เอกสารต้นทาง-ปลายทาง
- ไม่มีต้นทาง ยอดนี้เป็นจุดเริ่มต้นของต้นทุนเฉลี่ย ดู [[acc-inventory-cost-moving-average]]

## ยกเลิก/แก้ไข
- ยกเลิกด้วย flag 55 (doc_cancel.go:53)

## ข้อควรระวัง
- doc_flow_graph.go:193 ให้ label flag 54 ว่า "รับสินค้าสำเร็จรูป" ซึ่งไม่ตรงกับชื่อเมนู
- GL ที่คีย์มือจะไม่ถูกสร้างใหม่ตอน rebuild GL เพราะ 54 ไม่อยู่ในรายการ rebuild

## ที่มาในโค้ด
- `frontend/account/tabs/transMenuMap.ts:924` เมนู
- `frontend/account/transaction/transLayouts.ts:92` FLAG_SPEC 54
- `backend/internal/application/process/stock_beginning.go:307` StockBeginningSave
- `backend/internal/application/process/stock_beginning.go:290` ตรวจสมดุล GL / `:558` insert gl_journal
- `backend/internal/application/process/service.go:1731` glRebuildTransFlags
- `backend/internal/application/process/doc_cancel.go:53` ยกเลิก 55

## ดูเพิ่ม
- [[acc-stock-special-docs]] · [[acc-inventory-stock-rebuild]] · [[doctypes-overview]]
