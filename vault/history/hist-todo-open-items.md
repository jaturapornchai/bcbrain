---
title: "ข้อจำกัดและงานค้างที่ยังเห็นในโค้ดวันนี้ (Known Limitations)"
tags: [history, todo, open-items, limitations]
aliases: ["TODO ค้าง", "open items", "งานค้าง", "ข้อจำกัดของระบบ", "ponytail marker"]
sources: ["TODO.md:96", "TODO.md:106", "TODO.md:108", "TODO.md:109", "frontend/src/config/schemas/erpOption/tab6Mis.ts:28", "frontend/account/form/FieldControl.tsx:273", "backend/internal/application/process/doc_flow.go:89", "backend/internal/application/process/gl_template.go:1006", "backend/internal/application/process/trans_credit.go:19", "backend/internal/application/process/price_center.go:21", "backend/internal/application/process/trans_set_item.go:170"]
---
# ข้อจำกัดและงานค้างที่ยังเห็นในโค้ดวันนี้

หน้านี้รวมเฉพาะ "สิ่งที่ระบบยังไม่ทำ" ที่ยืนยันได้จากโค้ดหรือเอกสารใน repo ปัจจุบัน — ใช้ก่อนตอบผู้ใช้ว่า "ทำได้ไหม" เพื่อไม่ให้สัญญาเกินจริง ทุกข้อตรวจกับโค้ดแล้ว ข้อที่ยืนยันสถานะไม่ได้จะไม่ถูกนำมาลงที่นี่

## ข้อที่ `TODO.md` ยังระบุไว้ และโค้ดยังตรงกัน
| ข้อ | สภาพในโค้ดวันนี้ | หลักฐาน |
|---|---|---|
| เอกสารสัญญา API (`docs/api-contract.md`) | ยังไม่มีไฟล์นี้ใน `docs/` | `TODO.md:96`; ไม่พบไฟล์ใน `docs/` |
| แท็บ 6.MIS ของจอ `erp_option` 3 ช่อง (รหัสร้านค้า/รหัสผ่าน/ยืนยันรหัสผ่าน) | ประกาศเป็น `resourceOnly: true` คือไม่ใช่คอลัมน์จริงใน `erp_option` | `frontend/src/config/schemas/erpOption/tab6Mis.ts:28,35,42`; `TODO.md:106` |
| ปุ่ม "ลงทะเบียนร้านค้า" / "แก้ไขรหัสผ่าน" บนแท็บ MIS | ยังไม่ได้ทำ มีแต่คอมเมนต์ในหัวไฟล์ schema | `tab6Mis.ts:13`; `TODO.md:109` |
| ช่องชนิดรูปภาพ/ลายมือชื่อในฟอร์ม schema | แสดงกล่องเปล่า "ยังไม่ได้เลือกรูป" ยังอัปโหลดผ่านช่องนี้ไม่ได้ | `frontend/account/form/FieldControl.tsx:273-281`; `TODO.md:108` |

## ข้อจำกัดที่ผู้พัฒนาประกาศไว้ในโค้ดเอง (คอมเมนต์ `ponytail:`)
ในโค้ดไม่มี `TODO`/`FIXME` เลย (ค้น `backend`, `frontend/account`, `frontend/shared`, `frontend/src` ได้ 0 จุด) แต่ใช้คอมเมนต์ `ponytail:` ระบุ "ตั้งใจทำแค่นี้ ส่วนที่เหลือเติมเมื่อมีหน้าจอมาใช้" — ค้นได้ 85 จุดใน `backend/internal` และ 17 จุดใน `frontend/account` + `frontend/shared` ที่ยกมาเป็นข้อจำกัดที่กระทบผู้ใช้:

| เรื่อง | ข้อจำกัด | ที่อยู่ |
|---|---|---|
| สถานะ Document Flow | กติกา `flowRules` ยังไม่ครอบคลุมใบขอเบิก/ขอโอนของคลัง (flag 122/56/124) และแถว `ap_ar_trans` 213/235 | `backend/internal/application/process/doc_flow.go:89-90` |
| GL template | ยังไม่แตกยอดลงแผนก/โครงการ/การปันส่วน (ยังไม่มีแถวแตกยอดเขียนลงสมุดรายวัน) | `backend/internal/application/process/gl_template.go:1006-1007` |
| อนุมัติวงเงินเครดิต | ขั้นตอนขออนุมัติด้วย OTP (SMS/e-mail) ยังไม่มี: เมื่อขายเกินวงเงินและตั้ง `request_ar_credit` ระบบ "บล็อก" แทนที่จะส่งคำขออนุมัติ | `backend/internal/application/process/trans_credit.go:19-22` |
| ศูนย์ราคา (price center) | สาขา POS (ราคาตามบาร์โค้ด/สมาชิก) ยังไม่มีผู้เรียก | `backend/internal/application/process/price_center.go:21-22` |
| สินค้าชุด สกุลเงินท้องถิ่น | แถวไม่มี `price_2`/`sum_amount_2` จากหน้าจอ ยอดท้องถิ่นให้ขั้นตอนบันทึกอัตราแลกเปลี่ยนคำนวณ | `backend/internal/application/process/trans_set_item.go:170-171` |

## ที่มาในโค้ด
- `TODO.md:96,106,108,109` — รายการที่ยังไม่ติ๊กในเอกสารแผนงาน (เอกสารนี้ยังอธิบายยุคข้อมูลจำลอง ใช้เป็นหลักฐานได้เฉพาะ 4 ข้อข้างบน)
- `frontend/src/config/schemas/erpOption/tab6Mis.ts:13,28,35,42`, `frontend/account/form/FieldControl.tsx:273-281`
- `backend/internal/application/process/{doc_flow.go:89,gl_template.go:1006,trans_credit.go:19,price_center.go:21,trans_set_item.go:170}`
- ดูเพิ่ม: [[history-overview]] · [[hist-lessons-concurrency-advisory-locks]] · [[hist-lessons-query-gateway-write-lockdown]] · [[std-repo-scope-rules]] · [[standards-overview]]
