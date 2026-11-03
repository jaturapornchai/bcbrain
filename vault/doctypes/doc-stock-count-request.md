---
title: "ขอตรวจนับสินค้า (Stock Count Request)"
tags: [doctypes, inventory]
aliases: ["trans_flag 276", "trans_flag 128", "ขอตรวจนับสินค้า", "RCO", "menu_ic_request_stk_count", "menu_ic_stk_count_request"]
sources: ["frontend/account/tabs/transMenuMap.ts:1105", "frontend/account/tabs/transMenuMap.ts:1119", "frontend/account/tabs/transMenuMap.ts:1147", "frontend/account/transaction/transLayouts.ts:115", "frontend/account/transaction/transLayouts.ts:116", "frontend/account/transaction/transLayouts.ts:306", "frontend/account/transaction/transLayouts.ts:474", "backend/internal/application/process/transcalc.go:13", "backend/internal/application/process/stock_rebuild.go:19", "backend/internal/application/process/service.go:1742", "backend/internal/application/process/doc_cancel.go:49"]
---

# ขอตรวจนับสินค้า (trans_flag 276 / 128)

## ใช้เมื่อไร
ใช้เตรียมรายการที่จะตรวจนับก่อนบันทึกผลด้วยใบ 76 มี 2 เมนูที่ใช้ชื่อเดียวกัน "ขอตรวจนับสินค้า" คือ `menu_ic_request_stk_count` (transMenuMap.ts:1105) และ `menu_ic_stk_count_request` (transMenuMap.ts:1119) ทั้งสองใช้ screen code RCO, transFlag 276 และ transFlags 276/128

## trans_flag/ตาราง
- trans_flag 276 และ 128 เก็บใน [[tbl-ic-trans]] + [[tbl-ic-trans-detail]]
- calc_flag 0 เพราะไม่อยู่ในรายการของ `calcFlagByTransFlag` (flag ที่ไม่อยู่ในรายการเป็น 0, transcalc.go:13)

## ฟิลด์/แท็บบนหน้าจอ
- หัวเอกสาร: refDoc, sale, wh ไม่มีแท็บ (transLayouts.ts:115 สำหรับ 128, :116 สำหรับ 276)
- ช่อง sale แสดงชื่อ "ผู้ขออนุมัติ:" (transLayouts.ts:306) และไม่แสดงราคา (transLayouts.ts:474)

## ผลต่อสต็อก
ไม่มี (ไม่อยู่ในชุด flag ของ `stockRowsSQL` stock_rebuild.go:19)

## ผลต่อภาษี (VAT/WHT)
ไม่มี (ไม่อยู่ใน `transVatTabs` / `transWhtParty` trans_tax.go:37, :48)

## การลงบัญชี
ไม่ลง GL (ไม่อยู่ใน `glRebuildTransFlags` service.go:1742)

## เอกสารต้นทาง-ปลายทาง
- ปลายทาง: ตรวจนับ 76 อ้าง 276/128 (`refTransFlags` transMenuMap.ts:1147)

## ยกเลิก/แก้ไข
- ไม่มีคู่ยกเลิกของ 276/128 ใน `cancelOrigFlags` (doc_cancel.go:49)

## ข้อควรระวัง
- โค้ดใช้ 276 และ 128 ด้วยหัวเอกสารและป้ายชื่อเดียวกัน (transLayouts.ts:115-116, :306) เมนูทั้งสองเปิดด้วย transFlag 276

## ที่มาในโค้ด
- `frontend/account/tabs/transMenuMap.ts:1105` / `:1119` เมนู
- `frontend/account/transaction/transLayouts.ts:115` / `:116` FLAG_SPEC 128/276
- `backend/internal/application/process/doc_cancel.go:49` cancelOrigFlags

## ดูเพิ่ม
- [[doc-stock-count]] · [[doctypes-overview]]
