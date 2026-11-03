---
title: "ตั้งหนี้/เพิ่มหนี้/ลดหนี้ยกมา เจ้าหนี้ (AP Beginning Balance)"
tags: [doctypes, ap]
aliases: ["trans_flag 81", "trans_flag 83", "trans_flag 85", "ตั้งหนี้ยกมา (เจ้าหนี้)", "เพิ่มหนี้ยกมา (เจ้าหนี้)", "ลดหนี้ยกมา (เจ้าหนี้)", "DA", "DB", "DC", "headerAmountFlags"]
sources: ["frontend/account/tabs/transMenuMap.ts:1209", "frontend/account/tabs/transMenuMap.ts:1223", "frontend/account/tabs/transMenuMap.ts:1237", "frontend/account/transaction/transLayouts.ts:101", "frontend/account/transaction/transLayouts.ts:159", "backend/internal/application/process/trans.go:216", "backend/internal/application/process/trans_validate.go:71", "backend/internal/application/process/service.go:1742", "backend/internal/application/process/docs.go:604", "backend/internal/application/process/docs.go:607", "backend/internal/application/process/doc_flow.go:125", "backend/internal/application/process/doc_cancel.go:49"]
---

# ตั้งหนี้ (81) / เพิ่มหนี้ (83) / ลดหนี้ (85) ยกมา ฝั่งเจ้าหนี้

## ใช้เมื่อไร
ใช้บันทึกยอดหนี้เจ้าหนี้ที่ค้างอยู่ตอนเริ่มใช้ระบบ
- 81 "ตั้งหนี้ยกมา (เจ้าหนี้)" (DA, transMenuMap.ts:1209)
- 83 "เพิ่มหนี้ยกมา (เจ้าหนี้)" (DB, transMenuMap.ts:1237)
- 85 "ลดหนี้ยกมา (เจ้าหนี้)" (DC, transMenuMap.ts:1223)

## trans_flag/ตาราง
- เก็บเฉพาะหัวเอกสารใน [[tbl-ic-trans]] มีแค่ total_amount และ due_date ไม่มีบรรทัด (`headerAmountFlags` trans.go:216)

## ฟิลด์/แท็บบนหน้าจอ
- 81/83: party, taxDoc, refDoc, amount ไม่มีแท็บ (transLayouts.ts:101, :102)
- 85: party, amount (transLayouts.ts:103)
- กรอกยอดที่หัวเอกสาร (`HEADER_AMOUNT_FLAGS` transLayouts.ts:159) มีช่องเครดิต/วันครบกำหนด (`CREDIT_FLAGS` transLayouts.ts:156)

## ผลต่อสต็อก
ไม่มี (ไม่มีบรรทัดสินค้า)

## ผลต่อภาษี (VAT/WHT)
ไม่มี: 81/83/85 ไม่อยู่ใน `transVatTabs` (trans_tax.go:37) และ `transWhtParty` (trans_tax.go:48)

## การลงบัญชี
ไม่ลง GL: 81/83/85 ไม่อยู่ใน `glRebuildTransFlags` (service.go:1742) ซึ่งเป็นตัวกรองเอกสารที่ `rebuildGLTx` จะสร้างรายการบัญชี (service.go:1421)

## เอกสารต้นทาง-ปลายทาง
- 81/83 นับเป็นหนี้ (`apDebtWhere` docs.go:604) ส่วน 85 นับเป็นเครดิต คือยอดติดลบ (`apCreditWhere` docs.go:607)
- ในตารางเลือกบิล ใช้ doc_ref เป็นเลขที่อ้างอิง และใช้ due_date เป็นวันครบกำหนด (docs.go:668, :670)
- ปลายทาง: รับวางบิล 213 และจ่ายชำระ 19 ; used_status_2 ของ 81/83/85 มาจากการมีแถวใน ap_ar_trans_detail ที่อ้างเอกสารนี้ (doc_flow.go:125, `billed` :69)

## ยกเลิก/แก้ไข
- ไม่มีคู่ยกเลิกใน `cancelOrigFlags` (doc_cancel.go:49)
- บันทึกต้องอยู่ในงวดบัญชีที่เปิด (`checkOpenPeriod` trans_validate.go:45) แต่ข้ามการตรวจช่องหน้าจอ/ผู้ติดต่อแบบใบซื้อ (trans_validate.go:71)

## ข้อควรระวัง
- ยอดหนี้ยกมานี้อยู่ในระบบเจ้าหนี้เท่านั้น ไม่มีรายการใน GL

## ที่มาในโค้ด
- `frontend/account/tabs/transMenuMap.ts:1209` / `:1223` / `:1237` เมนู
- `frontend/account/transaction/transLayouts.ts:101-103` FLAG_SPEC 81/83/85
- `backend/internal/application/process/trans.go:216` headerAmountFlags
- `backend/internal/application/process/service.go:1742` glRebuildTransFlags (ไม่มี 81–85)
- `backend/internal/application/process/docs.go:604` / `:607` เงื่อนไขหนี้/เครดิต
- `backend/internal/application/process/doc_flow.go:125` used_status_2

## ดูเพิ่ม
- [[doc-ap-payment]] · [[doc-ar-beginning-balance]] · [[doc-gl-journal]] · [[doctypes-overview]]
