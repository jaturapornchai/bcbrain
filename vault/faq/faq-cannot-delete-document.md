---
title: "ทำไมลบหรือแก้เอกสารไม่ได้ ขึ้น ห้ามแก้ไข หรือลบข้อมูล"
tags: [faq, delete, edit, guard, period, lock]
aliases: ["ลบเอกสารไม่ได้", "แก้เอกสารไม่ได้", "ห้ามแก้ไข หรือลบข้อมูล", "Lock เด็ดขาด", "ปิดงวดไปแล้ว", "มีการอ้างอิงไปแล้ว", "ปุ่มลบเป็นสีเทา", "used_status doc_success"]
sources: ["backend/internal/application/process/trans_validate.go:95", "backend/internal/application/process/trans_validate.go:132", "backend/internal/application/process/period.go:53", "backend/internal/application/process/trans.go:409", "backend/internal/application/process/trans_deposit.go:264", "backend/internal/application/process/docs.go:463", "backend/internal/adapter/inbound/http/process/permission.go:47"]
---
# ทำไมลบหรือแก้เอกสารไม่ได้ ขึ้น ห้ามแก้ไข หรือลบข้อมูล

**ตอบสั้น:** ระบบตรวจตามลำดับ สิทธิ์ผู้ใช้, ล็อกเด็ดขาด, สถานะเอกสาร (ถูกใช้ต่อ / ปิดแล้ว / ยกเลิกแล้ว / เป็นสำเนา), งวดบัญชีปิด, และการมีเอกสารอื่นอ้างอิง ข้อความที่ขึ้นบอกว่าติดด่านไหน

## รายละเอียด

| ข้อความ / อาการ | สาเหตุ | แก้อย่างไร |
|---|---|---|
| ปุ่มลบ/แก้ไขเป็นสีเทา | ผู้ใช้ไม่มีสิทธิ์ลบ/แก้ (`rights.canDelete`, `rights.canEdit`) และฝั่งหลังบ้าน `trans/delete` ต้องมีสิทธิ์ลบ | ให้ผู้ดูแลเพิ่มสิทธิ์เมนูนั้น |
| "Lock เด็ดขาด : ห้ามแก้ไข หรือลบข้อมูล" | แถวมี `is_lock_record = 1` | ลบ/แก้จากหน้าจอไม่ได้ (`trans_validate.go:112-124`) |
| "ห้ามแก้ไข หรือลบข้อมูล" | ใบถูกใช้ต่อแล้ว (`used_status` / `used_status_2` = 1), ปิดรายการแล้ว (`doc_success` = 1), ยกเลิกแล้ว (`last_status` = 1), เป็นสำเนา (`is_doc_copy` = 1) หรือเป็นใบสั่งจอง (flag 34) ที่อนุมัติแล้ว (`approve_status` >= 1) | ดูใบที่อ้างอิงอยู่ แล้วลบ/ยกเลิกใบนั้นก่อน (`trans_validate.go:132-156`) |
| "วันที่เอกสาร dd/mm/yyyy ได้ถูกปิดงวดไปแล้ว หรือยังไม่ได้กำหนดงวดบัญชี กรุณาตรวจสอบ" | วันที่เอกสารไม่อยู่ในงวดที่ `status = 0` หรือยังไม่มีงวด | เปิดงวด/สร้างงวดที่ `erp_account_period` (`period.go:53-61`) |
| "เอกสาร X มีการอ้างอิงไปแล้วโดยเอกสาร Y ไม่สามารถลบได้" | มีใบอื่น (ที่ยังไม่ยกเลิก) ดึงใบนี้ไปแล้ว | ลบ/ยกเลิกใบ Y ก่อน (`trans.go:409`) |
| "เอกสาร X ถูกนำไปใช้/รับคืนแล้วโดยเอกสาร Y ลบไม่ได้" | มัดจำ/เงินล่วงหน้าที่ถูกตัดใช้หรือมีใบคืนแล้ว | ยกเลิกใบที่ใช้/คืนก่อน (`trans_deposit.go:264`) |
| ใบวางบิล/รับ-จ่ายชำระ (`ap_ar_trans`) ลบไม่ได้ | ถูกใช้ ปิด หรือยกเลิกแล้ว (ไม่ดู `used_status_2`) | ทำนองเดียวกัน (`docs.go:463-490`) |

- ด่านฝั่งลบเรียงจาก `checkTransScreenDelete`: ล็อก -> สถานะ -> งวด (`trans_validate.go:95-107`) แล้วค่อยตรวจการอ้างอิงใน `deleteTransTx`
- ตอนแก้ไขเอกสารที่มีอยู่ ระบบใช้ด่านล็อกและสถานะชุดเดียวกัน (`trans_validate.go:54-60`) และแจ้ง "ไม่พบเอกสารที่จะแก้ไข" ถ้าเลขที่ไม่มีจริง
- ใบเสนอราคา (flag 30) แก้ได้แม้ถูกใช้ต่อ เมื่อเปิดออปชันแก้ใบเสนอราคา (`sale_order_edit`) (`trans_validate.go:133-135`)

## ข้อควรระวัง
- "ถูกอ้างอิง" นับเฉพาะใบถัดไปที่ยังไม่ยกเลิก (`last_status = 0`) ถ้าใบถัดไปถูกยกเลิกแล้ว ใบต้นทางลบได้
- ใบที่ยกเลิกแล้วลบไม่ได้เลย เพราะ `last_status = 1` (ใบเดิมต้องเก็บคู่กับใบยกเลิก)

## ดูเพิ่ม
- [[faq-cancel-vs-edit-vs-delete]]
- [[term-last-status-cancel-approve]]
- [[term-account-period]]
- [[flow-period-year-close]]
- [[hist-lessons-cancel-delete-partial]]
- [[hist-lessons-permission-rights]]

## ที่มาในโค้ด
- `backend/internal/application/process/trans_validate.go:95` `checkTransScreenDelete` และ `:112` `refuseLockedRecord`
- `backend/internal/application/process/trans_validate.go:132` `editLocked` และ `:142` `checkStoredEditable`
- `backend/internal/application/process/period.go:53` `periodError` และ `:68` `checkStoredDocPeriod`
- `backend/internal/application/process/trans.go:409` ข้อความมีการอ้างอิงแล้ว
- `backend/internal/application/process/trans_deposit.go:264` ข้อความมัดจำถูกใช้แล้ว
- `backend/internal/application/process/docs.go:463` `checkStoredApArEditable`
- `backend/internal/adapter/inbound/http/process/permission.go:47` `trans/delete` ใช้สิทธิ์ลบ
- `frontend/account/transaction/UniversalTransScreen.tsx:3086` ปุ่มลบปิดเมื่อไม่มีสิทธิ์
