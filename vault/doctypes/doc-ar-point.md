---
title: "แต้มคงเหลือยกมา / บันทึกตัดแต้ม (Customer Points)"
tags: [doctypes, ar]
aliases: ["trans_flag 801", "trans_flag 802", "แต้มคงเหลือยกมา", "บันทึกตัดแต้ม", "menu_ar_point_balance", "menu_ar_cut_point", "PointDocSave"]
sources: ["backend/internal/application/process/point_doc.go:14", "backend/internal/application/process/point_doc.go:19", "backend/internal/application/process/point_doc.go:23", "backend/internal/application/process/point_doc.go:92", "backend/internal/application/process/point_doc.go:120", "backend/internal/application/process/point_doc.go:160"]
---

# แต้มคงเหลือยกมา (801) / บันทึกตัดแต้ม (802)

## ใช้เมื่อไร
ใช้บันทึกแต้มสะสมของลูกค้า
- 801 แต้มคงเหลือยกมา ที่เมนู `menu_ar_point_balance`
- 802 บันทึกตัดแต้ม ที่เมนู `menu_ar_cut_point` (comment point_doc.go:14)

## trans_flag/ตาราง
- 1 เอกสาร = หัวเอกสาร 1 แถวใน [[tbl-ic-trans]] ไม่มีบรรทัด (point_doc.go:14, insert ที่ :120)
- บันทึกผ่าน `PointDocSave` (point_doc.go:92) และลบหลายใบพร้อมกันได้สูงสุด 500 ใบผ่าน `PointDocDelete` (:160)

## ฟิลด์/แท็บบนหน้าจอ
- input: docNo, docDate, docFormatCode, custCode, sumPoint, remark (`PointDocInput` point_doc.go:23)

## ผลต่อสต็อก
ไม่มี (comment point_doc.go:14)

## ผลต่อภาษี (VAT/WHT)
ไม่มี

## การลงบัญชี
ไม่ลง GL (comment point_doc.go:14)

## เอกสารต้นทาง-ปลายทาง
(ไม่พบในโค้ดที่อ่าน)

## ยกเลิก/แก้ไข
- แก้ไขด้วยการบันทึกทับ หรือลบผ่าน `PointDocDelete` โดยลบทั้งชุดหรือไม่ลบเลย (point_doc.go:160)

## ข้อควรระวัง
- เดิมเบราว์เซอร์สร้างคำสั่ง INSERT/UPDATE เองผ่าน /query/exec ตอนนี้ย้ายมาทำที่ backend แล้ว (comment point_doc.go:14)

## ที่มาในโค้ด
- `backend/internal/application/process/point_doc.go:14` คำอธิบายและ flag
- `backend/internal/application/process/point_doc.go:23` PointDocInput
- `backend/internal/application/process/point_doc.go:92` PointDocSave
- `backend/internal/application/process/point_doc.go:160` PointDocDelete

## ดูเพิ่ม
- [[doctypes-overview]]
