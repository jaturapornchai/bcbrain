---
title: "ทะเบียนเช็ครับ/เช็คจ่าย/บัตรเครดิตรับ (Cheque & Card Register)"
tags: [doctypes, cash-bank]
aliases: ["cb_chq_list", "ทะเบียนเช็ครับ", "ทะเบียนเช็คจ่าย", "รายละเอียดบัตรเครดิตรับ", "CQR", "CQP", "CCR", "menu_cb_chq_in_receive_master", "menu_cb_chq_out_payment_master", "menu_cb_credit_card_receive"]
sources: ["frontend/account/tabs/transMenuMap.ts:1991", "frontend/account/tabs/transMenuMap.ts:2180", "frontend/account/tabs/transMenuMap.ts:2325", "frontend/account/tabs/transMenuMap.ts:2395", "frontend/account/tabs/transMenuMap.ts:2408", "frontend/account/transaction/transLayouts.ts:380", "backend/internal/application/process/docs.go:435", "backend/internal/application/process/trans.go:1543", "backend/internal/application/process/cheque.go:19", "backend/internal/application/process/cheque.go:32", "backend/internal/application/process/cheque.go:61", "backend/internal/application/process/cheque.go:68", "backend/internal/application/process/trans.go:622", "backend/internal/application/process/trans.go:631", "backend/internal/application/process/trans.go:427", "backend/internal/application/process/docs.go:493", "backend/internal/application/process/cheque_forward.go:10"]
---

# ทะเบียนเช็คและบัตรเครดิต ([[tbl-cb-chq-list]])

## ใช้เมื่อไร
ใช้ดูทะเบียนเช็คและบัตรพร้อมสถานะ มี 5 เมนู
- "ทะเบียนเช็ครับ" CQR ที่ `menu_cb_chq_in_receive_master` (transMenuMap.ts:1991) และ `menu_cb_chq_list_receive` (:2395)
- "ทะเบียนเช็คจ่าย" CQP ที่ `menu_cb_chq_out_payment_master` (:2180) และ `menu_cb_chq_list_pay` (:2408)
- "รายละเอียดบัตรเครดิตรับ" CCR ที่ `menu_cb_credit_card_receive` (:2325)

## trans_flag/ตาราง
- เป็นตาราง [[tbl-cb-chq-list]] ไม่ใช่เอกสาร ใช้ chq_type 1 = เช็ครับ, 2 = เช็คจ่าย, 3 = บัตรเครดิต, 21 = wallet (comment cheque.go:19-27, SQL `WHERE l.chq_type IN (1, 2, 3, 21)` cheque.go:61)
- แถวถูกสร้างจากแท็บชำระ (`chqListFromPaySQL` trans.go:1543): doc_type 3 เป็น chq_type 3 ส่วน doc_type 2 เป็น chq_type 1 ถ้า trans_number_type = 1 มิฉะนั้นเป็น 2 โดยข้ามเช็คที่ chq_on_hand ≠ 0

## ฟิลด์/แท็บบนหน้าจอ
- party, refDoc, credit/due, passBook, header amount และไม่มี grid หรือแท็บ (transLayouts.ts:380)
- เป็นหน้าจอดูอย่างเดียว บันทึกไม่ได้ (`errChequeRegisterReadOnly` docs.go:435)

## ผลต่อสต็อก
ไม่มี

## ผลต่อภาษี (VAT/WHT)
ไม่มี

## การลงบัญชี
ไม่ลง GL เพราะ GL อยู่ที่เอกสารวงจรเช็คแต่ละใบ

## เอกสารต้นทาง-ปลายทาง
- ต้นทาง: แท็บชำระของทุกเอกสาร และเช็คยกมา 405/406 (cheque_forward.go:10)
- สถานะถูกคำนวณใหม่จากเอกสารเช็ครับ 405/410–414/416/418 (chq_type 1), เช็คจ่าย 406/451–453/456 (chq_type 2), บัตร 461/462 (chq_type 3) และ wallet 463 (chq_type 21) (`chequeStatusSQL` cheque.go:46-56) ด้วย `RebuildChequeStatus` (cheque.go:68) ซึ่งถูกเรียกใน `rebuildTransDerived` (trans.go:622) เมื่อเป็น flag ตาม `isChequeFlag` (trans.go:631-632)

## ยกเลิก/แก้ไข
- ไม่มีการยกเลิกที่ทะเบียน แถวจะถูกลบหรือสร้างใหม่ตามเอกสารต้นทาง (ลบตอนบันทึกแท็บชำระ trans.go:1345, ลบเอกสาร ic_trans trans.go:427, ลบเอกสาร ap_ar docs.go:493)

## ข้อควรระวัง
- เลขสถานะเหมือนกันแต่ความหมายต่างกันตาม chq_type เช่น 2 = เช็คผ่าน (เช็คจ่าย 451) แต่ = ยกเลิก (บัตร 462) (cheque.go:22, :25)

## ที่มาในโค้ด
- `frontend/account/tabs/transMenuMap.ts:1991` / `:2180` / `:2325` / `:2395` / `:2408` เมนู
- `frontend/account/transaction/transLayouts.ts:380` layout cb_chq_list
- `backend/internal/application/process/docs.go:435` read-only
- `backend/internal/application/process/trans.go:1543` chqListFromPaySQL
- `backend/internal/application/process/cheque.go:32` chequeStatusSQL / `:68` RebuildChequeStatus
- `backend/internal/application/process/trans.go:622` / `:631` เรียกคำนวณสถานะ

## ดูเพิ่ม
- [[doc-cheque-received-lifecycle]] · [[doc-cheque-paid-lifecycle]] · [[doc-credit-card]] · [[doc-wallet-pass]] · [[acc-cheque-transfer]] · [[doctypes-overview]]
