---
title: "ขอตรวจนับสินค้า (Stock Count Request)"
tags: [doctypes, inventory]
aliases: ["trans_flag 276", "trans_flag 128", "ขอตรวจนับสินค้า", "RCO", "menu_ic_request_stk_count", "menu_ic_stk_count_request"]
sources: ["frontend/account/tabs/transMenuMap.ts:1105", "frontend/account/tabs/transMenuMap.ts:1119", "frontend/account/transaction/transLayouts.ts:115", "frontend/account/transaction/transLayouts.ts:306", "frontend/account/transaction/transLayouts.ts:474", "backend/internal/application/process/doc_cancel.go:49"]
---

# ขอตรวจนับสินค้า (trans_flag 276 / 128)

## ใช้เมื่อไร
ใช้เตรียมรายการที่จะตรวจนับก่อนบันทึกผลด้วยใบ 76 มี 2 เมนูที่ใช้ชื่อเดียวกัน "ขอตรวจนับสินค้า" คือ `menu_ic_request_stk_count` (transMenuMap.ts:1105) และ `menu_ic_stk_count_request` (transMenuMap.ts:1119) ทั้งสองใช้ screen code RCO และ transFlags 276/128

## trans_flag/ตาราง
- trans_flag 276 และ 128 เก็บใน [[tbl-ic-trans]] + [[tbl-ic-trans-detail]]

## ฟิลด์/แท็บบนหน้าจอ
- หัวเอกสาร: refDoc, sale, wh ไม่มีแท็บ (transLayouts.ts:115 สำหรับ 128, :115 สำหรับ 276)
- ช่อง sale แสดงชื่อ "ผู้ขออนุมัติ:" และไม่แสดงราคา (transLayouts.ts:306, :474)

## ผลต่อสต็อก
ไม่มี

## ผลต่อภาษี (VAT/WHT)
ไม่มี

## การลงบัญชี
ไม่ลง GL

## เอกสารต้นทาง-ปลายทาง
- ปลายทาง: ตรวจนับ 76 อ้าง 276/128 (transMenuMap.ts:1133)

## ยกเลิก/แก้ไข
- ไม่มีคู่ยกเลิกของ 276/128 ใน `cancelOrigFlags` (doc_cancel.go:49) (ไม่พบในโค้ด)

## ข้อควรระวัง
- ความต่างระหว่าง 276 กับ 128: (ไม่พบคำอธิบายในโค้ดที่อ่าน)

## ที่มาในโค้ด
- `frontend/account/tabs/transMenuMap.ts:1105` / `:1119` เมนู
- `frontend/account/transaction/transLayouts.ts:115` FLAG_SPEC 128/276
- `backend/internal/application/process/doc_cancel.go:49` cancelOrigFlags

## ดูเพิ่ม
- [[doc-stock-count]] · [[doctypes-overview]]
