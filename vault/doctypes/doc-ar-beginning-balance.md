---
title: "ตั้งหนี้/เพิ่มหนี้/ลดหนี้ยกมา ลูกหนี้ (AR Beginning Balance)"
tags: [doctypes, ar]
aliases: ["trans_flag 93", "trans_flag 95", "trans_flag 97", "ตั้งหนี้ยกมา (ลูกหนี้)", "เพิ่มหนี้ยกมา (ลูกหนี้)", "ลดหนี้ยกมา (ลูกหนี้)", "EA", "EB", "EC"]
sources: ["frontend/account/tabs/transMenuMap.ts:1406", "frontend/account/tabs/transMenuMap.ts:1420", "frontend/account/tabs/transMenuMap.ts:1434", "frontend/account/transaction/transLayouts.ts:107", "backend/internal/application/process/trans.go:216", "backend/internal/application/process/service.go:1731", "backend/internal/application/process/docs.go:597", "backend/internal/application/process/doc_cancel.go:49"]
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
- ไม่มีแท็บ

## ผลต่อสต็อก
ไม่มี

## ผลต่อภาษี (VAT/WHT)
ไม่มี

## การลงบัญชี
ไม่ลง GL (comment ของ `glRebuildTransFlags` ระบุว่า 93–97 ไม่ลง GL service.go:1731)

## เอกสารต้นทาง-ปลายทาง
- 93/95 นับเป็นหนี้ และ 97 นับเป็นเครดิตลูกหนี้ (`arDebtWhere`/`arCreditWhere` docs.go:597)
- ปลายทาง: ใบวางบิล 235 และรับชำระ 239

## ยกเลิก/แก้ไข
- ไม่มีคู่ยกเลิกใน `cancelOrigFlags` (doc_cancel.go:49) (ไม่พบในโค้ด)

## ข้อควรระวัง
- ต้องลง JV ยอดยกมาฝั่งบัญชีเองให้ตรงกับยอดหนี้ลูกหนี้

## ที่มาในโค้ด
- `frontend/account/tabs/transMenuMap.ts:1406` / `:1420` / `:1434` เมนู
- `frontend/account/transaction/transLayouts.ts:107` FLAG_SPEC 93/95/97
- `backend/internal/application/process/trans.go:216` headerAmountFlags
- `backend/internal/application/process/docs.go:597` เงื่อนไขหนี้

## ดูเพิ่ม
- [[doc-ar-receipt]] · [[doc-ap-beginning-balance]] · [[doc-gl-journal]] · [[doctypes-overview]]
