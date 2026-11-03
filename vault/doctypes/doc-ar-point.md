---
title: "แต้มคงเหลือยกมา / บันทึกตัดแต้ม (Customer Points)"
tags: [doctypes, ar]
aliases: ["trans_flag 801", "trans_flag 802", "แต้มคงเหลือยกมา", "บันทึกตัดแต้ม", "menu_ar_point_balance", "menu_ar_cut_point", "PointDocSave"]
sources: ["backend/internal/application/process/point_doc.go:19", "backend/internal/application/process/point_doc.go:23", "backend/internal/application/process/point_doc.go:83", "backend/internal/application/process/point_doc.go:92", "backend/internal/application/process/point_doc.go:120", "backend/internal/application/process/point_doc.go:160", "backend/internal/adapter/inbound/http/process/stocktools_handler.go:172", "frontend/src/config/schemas/icMasterSchemas.ts:1250", "frontend/src/config/schemas/icMasterSchemas.ts:1268", "frontend/account/master/StandardMasterScreen.tsx:550", "frontend/src/config/schemas/masterDetailSchemas.ts:1109"]
---

# แต้มคงเหลือยกมา (801) / บันทึกตัดแต้ม (802)

## ใช้เมื่อไร
ใช้บันทึกแต้มสะสมของลูกค้า
- 801 "กำหนดแต้มคงเหลือยกมา" เมนู `menu_ar_point_balance` รหัสเมนู 6.1.4 (icMasterSchemas.ts:1250) <!-- pragma: allowlist secret -->
- 802 "บันทึกตัดแต้ม" เมนู `menu_ar_cut_point` รหัสเมนู 6.1.5 (icMasterSchemas.ts:1268) <!-- pragma: allowlist secret -->

## trans_flag/ตาราง
- 1 เอกสาร = หัวเอกสาร 1 แถวใน [[tbl-ic-trans]] ไม่มีบรรทัด (insert ที่ point_doc.go:120) เก็บจำนวนแต้มใน sum_point
- บันทึกผ่าน `PointDocSave` (point_doc.go:92, route `pointdocsave` stocktools_handler.go:172) จอเรียกที่ StandardMasterScreen.tsx:550
- ลบหลายใบพร้อมกันได้สูงสุด 500 ใบผ่าน `PointDocDelete` (point_doc.go:160)

## ฟิลด์/แท็บบนหน้าจอ
- เลขที่เอกสาร, รหัสลูกหนี้, วันที่เอกสาร, รหัสรูปแบบเอกสาร, จำนวนแต้ม, หมายเหตุ (icMasterSchemas.ts:1250, :1268)
- input ของ backend: docNo, docDate, docFormatCode, custCode, sumPoint, remark (`PointDocInput` point_doc.go:23)
- ต้องมีเลขที่เอกสารและรหัสลูกหนี้ที่มีอยู่ใน ar_customer วันที่รูปแบบ YYYY-MM-DD จำนวนแต้มรับทศนิยมได้ 4 ตำแหน่ง (point_doc.go:83)

## ผลต่อสต็อก
ไม่มี (ไม่มีบรรทัดสินค้า)

## ผลต่อภาษี (VAT/WHT)
ไม่มี

## การลงบัญชี
ไม่ลง GL: 801/802 ไม่อยู่ใน `glRebuildTransFlags` (service.go:1742)

## เอกสารต้นทาง-ปลายทาง
- หน้าแต้มสะสมของลูกค้านับ 801 เป็นแต้มเพิ่ม (masterDetailSchemas.ts:1109) และ 802 เป็นแต้มที่ใช้ (masterDetailSchemas.ts:1113)

## ยกเลิก/แก้ไข
- ไม่มีเอกสารยกเลิก แก้ไขด้วยการบันทึกทับ (UPDATE ตาม doc_no + trans_flag) หรือลบผ่าน `PointDocDelete` โดยลบทั้งชุดหรือไม่ลบเลย (point_doc.go:160)
- ไม่มีการตรวจงวดบัญชีใน `PointDocSave` / `PointDocDelete`

## ข้อควรระวัง
- บันทึกเอกสารใหม่ที่เลขที่ซ้ำกับ flag เดียวกันไม่ได้ (`rejectDuplicate` ใน PointDocSave point_doc.go:92)

## ที่มาในโค้ด
- `backend/internal/application/process/point_doc.go:19` ค่า flag 801/802
- `backend/internal/application/process/point_doc.go:23` PointDocInput
- `backend/internal/application/process/point_doc.go:92` PointDocSave
- `backend/internal/application/process/point_doc.go:160` PointDocDelete
- `frontend/src/config/schemas/icMasterSchemas.ts:1250` / `:1268` เมนู

## ดูเพิ่ม
- [[doctypes-overview]]
