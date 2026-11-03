---
title: "ตั้งหนี้/เพิ่มหนี้/ลดหนี้ยกมา ลูกหนี้ (AR Beginning Balance)"
tags: [doctypes, ar]
aliases: ["trans_flag 93", "trans_flag 95", "trans_flag 97", "ตั้งหนี้ยกมา (ลูกหนี้)", "เพิ่มหนี้ยกมา (ลูกหนี้)", "ลดหนี้ยกมา (ลูกหนี้)", "EA", "EB", "EC"]
sources: ["frontend/account/tabs/transMenuMap.ts:1406", "frontend/account/tabs/transMenuMap.ts:1420", "frontend/account/tabs/transMenuMap.ts:1434", "frontend/account/transaction/transLayouts.ts:107", "frontend/account/transaction/transLayouts.ts:159", "backend/internal/application/process/trans.go:216", "backend/internal/application/process/trans_validate.go:71", "backend/internal/application/process/service.go:1742", "backend/internal/application/process/docs.go:600", "backend/internal/application/process/docs.go:602", "backend/internal/application/process/doc_flow.go:125", "backend/internal/application/process/doc_cancel.go:49"]
---

# ตั้งหนี้ (93) / เพิ่มหนี้ (95) / ลดหนี้ (97) ยกมา ฝั่งลูกหนี้

## ใช้เมื่อไร
ใช้บันทึกยอดหนี้ลูกหนี้ที่ค้างอยู่ตอนเริ่มใช้ระบบ
- 93 "ตั้งหนี้ยกมา (ลูกหนี้)" (EA, transMenuMap.ts:1406)
- 95 "เพิ่มหนี้ยกมา (ลูกหนี้)" (EB, transMenuMap.ts:1420)
- 97 "ลดหนี้ยกมา (ลูกหนี้)" (EC, transMenuMap.ts:1434)

## trans_flag/ตาราง
- เก็บเฉพาะหัวเอกสารใน [[tbl-ic-trans]] มีแค่ total_amount และ due_date ไม่มีบรรทัด (`headerAmountFlags` trans.go:216)

## ฟิลด์/แท็บบนหน้าจอ
- 93/95: party, taxDoc, refDoc, amount, sale (transLayouts.ts:107, :108)
- 97: party, amount, sale (transLayouts.ts:109)
- ไม่มีแท็บ กรอกยอดที่หัวเอกสาร (`HEADER_AMOUNT_FLAGS` transLayouts.ts:159)

## ผลต่อสต็อก
ไม่มี (ไม่มีบรรทัดสินค้า)

## ผลต่อภาษี (VAT/WHT)
ไม่มี: 93/95/97 ไม่อยู่ใน `transVatTabs` (trans_tax.go:37) และ `transWhtParty` (trans_tax.go:48)

## การลงบัญชี
ไม่ลง GL: 93/95/97 ไม่อยู่ใน `glRebuildTransFlags` (service.go:1742)

## เอกสารต้นทาง-ปลายทาง
- 93/95 นับเป็นหนี้ (`arDebtWhere` docs.go:600) ส่วน 97 นับเป็นเครดิตลูกหนี้ คือยอดติดลบ (`arCreditWhere` docs.go:602)
- ในตารางเลือกบิล ใช้ doc_ref เป็นเลขที่อ้างอิง และใช้ due_date เป็นวันครบกำหนด (docs.go:668, :670)
- ปลายทาง: ใบวางบิล 235 และรับชำระ 239 ; used_status_2 มาจากการมีแถวใน ap_ar_trans_detail ที่อ้างเอกสารนี้ (doc_flow.go:125)

## ยกเลิก/แก้ไข
- ไม่มีคู่ยกเลิกใน `cancelOrigFlags` (doc_cancel.go:49)
- บันทึกต้องอยู่ในงวดบัญชีที่เปิด (`checkOpenPeriod` trans_validate.go:45) แต่ข้ามการตรวจช่องหน้าจอ/ผู้ติดต่อแบบใบขาย (trans_validate.go:71)

## ข้อควรระวัง
- ยอดหนี้ยกมานี้อยู่ในระบบลูกหนี้เท่านั้น ไม่มีรายการใน GL

## ที่มาในโค้ด
- `frontend/account/tabs/transMenuMap.ts:1406` / `:1420` / `:1434` เมนู
- `frontend/account/transaction/transLayouts.ts:107-109` FLAG_SPEC 93/95/97
- `backend/internal/application/process/trans.go:216` headerAmountFlags
- `backend/internal/application/process/service.go:1742` glRebuildTransFlags (ไม่มี 93–97)
- `backend/internal/application/process/docs.go:600` / `:602` เงื่อนไขหนี้/เครดิต

## ดูเพิ่ม
- [[doc-ar-receipt]] · [[doc-ap-beginning-balance]] · [[doc-gl-journal]] · [[doctypes-overview]]
