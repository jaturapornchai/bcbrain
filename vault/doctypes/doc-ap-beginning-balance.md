---
title: "ตั้งหนี้/เพิ่มหนี้/ลดหนี้ยกมา เจ้าหนี้ (AP Beginning Balance)"
tags: [doctypes, ap]
aliases: ["trans_flag 81", "trans_flag 83", "trans_flag 85", "ตั้งหนี้ยกมา (เจ้าหนี้)", "เพิ่มหนี้ยกมา (เจ้าหนี้)", "ลดหนี้ยกมา (เจ้าหนี้)", "DA", "DB", "DC", "headerAmountFlags"]
sources: ["frontend/account/tabs/transMenuMap.ts:1209", "frontend/account/tabs/transMenuMap.ts:1223", "frontend/account/tabs/transMenuMap.ts:1237", "frontend/account/transaction/transLayouts.ts:101", "frontend/account/transaction/transLayouts.ts:159", "backend/internal/application/process/trans.go:215", "backend/internal/application/process/service.go:1731", "backend/internal/application/process/docs.go:597", "backend/internal/application/process/doc_cancel.go:49"]
---

# ตั้งหนี้ (81) / เพิ่มหนี้ (83) / ลดหนี้ (85) ยกมา ฝั่งเจ้าหนี้

## ใช้เมื่อไร
ใช้บันทึกยอดหนี้เจ้าหนี้ที่ค้างอยู่ตอนเริ่มใช้ระบบ
- 81 "ตั้งหนี้ยกมา (เจ้าหนี้)" (DA, transMenuMap.ts:1209)
- 83 "เพิ่มหนี้ยกมา (เจ้าหนี้)" (DB, transMenuMap.ts:1237)
- 85 "ลดหนี้ยกมา (เจ้าหนี้)" (DC, transMenuMap.ts:1223)

## trans_flag/ตาราง
- เก็บเฉพาะหัวเอกสารใน [[tbl-ic-trans]] มีแค่ total_amount และ due_date ไม่มีบรรทัด (`headerAmountFlags` trans.go:215)

## ฟิลด์/แท็บบนหน้าจอ
- 81/83: party, taxDoc, refDoc, amount ไม่มีแท็บ (transLayouts.ts:101, :102)
- 85: party, amount (transLayouts.ts:103)
- กรอกยอดที่หัวเอกสาร (`HEADER_AMOUNT_FLAGS` transLayouts.ts:159) มีช่องเครดิต/วันครบกำหนด

## ผลต่อสต็อก
ไม่มี

## ผลต่อภาษี (VAT/WHT)
ไม่มี

## การลงบัญชี
ไม่ลง GL (comment ของ `glRebuildTransFlags` ระบุว่า 81–85 ไม่ลง GL service.go:1731) ยอดยกมาฝั่งบัญชีต้องบันทึกแยกด้วย JV

## เอกสารต้นทาง-ปลายทาง
- 81/83 นับเป็นหนี้ และ 85 นับเป็นเครดิตเจ้าหนี้ (`apDebtWhere`/`apCreditWhere` docs.go:597)
- ปลายทาง: รับวางบิล 213 และจ่ายชำระ 19

## ยกเลิก/แก้ไข
- ไม่มีคู่ยกเลิกใน `cancelOrigFlags` (doc_cancel.go:49) (ไม่พบในโค้ด)

## ข้อควรระวัง
- ยอดหนี้ในระบบเจ้าหนี้กับยอดใน GL จะตรงกันก็ต่อเมื่อลง JV ยอดยกมาให้ตรงกันเอง

## ที่มาในโค้ด
- `frontend/account/tabs/transMenuMap.ts:1209` / `:1223` / `:1237` เมนู
- `frontend/account/transaction/transLayouts.ts:101` FLAG_SPEC 81/83/85
- `backend/internal/application/process/trans.go:215` headerAmountFlags
- `backend/internal/application/process/service.go:1731` ไม่ลง GL
- `backend/internal/application/process/docs.go:597` เงื่อนไขหนี้

## ดูเพิ่ม
- [[doc-ap-payment]] · [[doc-ar-beginning-balance]] · [[doc-gl-journal]] · [[doctypes-overview]]
