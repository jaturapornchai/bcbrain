---
title: "เพิ่มหนี้/ลดหนี้อื่นๆ ลูกหนี้ (AR Other Debit/Credit Note)"
tags: [doctypes, ar]
aliases: ["trans_flag 101", "trans_flag 103", "เพิ่มหนี้อื่นๆ (ลูกหนี้)", "ลดหนี้อื่นๆ (ลูกหนี้)", "ADO", "ACO"]
sources: ["frontend/account/tabs/transMenuMap.ts:1466", "frontend/account/tabs/transMenuMap.ts:1483", "frontend/account/transaction/transLayouts.ts:111", "frontend/account/transaction/transLayouts.ts:112", "backend/internal/application/process/trans_tax.go:40", "backend/internal/application/process/service.go:2135", "backend/internal/application/process/docs.go:600", "backend/internal/application/process/docs.go:602", "backend/internal/application/process/doc_flow.go:117", "backend/internal/application/process/doc_flow.go:125", "backend/internal/application/process/doc_cancel.go:54", "backend/internal/application/process/doc_cancel.go:585"]
---

# เพิ่มหนี้อื่นๆ (101) / ลดหนี้อื่นๆ (103) ฝั่งลูกหนี้

## ใช้เมื่อไร
ใช้เพิ่มหรือลดหนี้ของใบตั้งหนี้อื่น 99
- 101 "เพิ่มหนี้อื่นๆ (ลูกหนี้)" (ADO, transMenuMap.ts:1466)
- 103 "ลดหนี้อื่นๆ (ลูกหนี้)" (ACO, transMenuMap.ts:1483)
- รายการค้นจากรหัสรายได้ `erp_income_list` (transMenuMap.ts:1471, :1488)

## trans_flag/ตาราง
- เก็บใน [[tbl-ic-trans]] + [[tbl-ic-trans-detail]]

## ฟิลด์/แท็บบนหน้าจอ
- 101: party, taxDoc, vat, docReason แท็บ vat, gl (transLayouts.ts:111)
- 103: party, vat, taxDoc, docReason แท็บ vat, gl (transLayouts.ts:112)

## ผลต่อสต็อก
ไม่มี

## ผลต่อภาษี (VAT/WHT)
- ภาษีขาย: 101 มี vat_calc 1 ส่วน 103 มี vat_calc −1 (`transVatTabs` trans_tax.go:40)
- ไม่มี WHT (ไม่อยู่ใน `transWhtParty` trans_tax.go:48)

## การลงบัญชี
ใช้ standard GL เมื่อรูปแบบเอกสารไม่มี template GL (`tpl.post` service.go:1585) ใช้ case เดียวกับ 99 (service.go:2135)

| flag | Dr | Cr |
|---|---|---|
| 101 | ลูกหนี้ (1121) ยอดรวม ถ้า inquiry = 1 ใช้เงินสด (1111) | รายได้อื่น (4210) ฐานภาษี + ภาษีขาย (2134) |
| 103 | รายได้อื่น (4210) ฐานภาษี + ภาษีขาย (2134) | ลูกหนี้ (1121) ยอดรวม ถ้า inquiry = 1 ใช้เงินสด (1111) |

- บัญชีรายได้หาจาก 4210/4200/4111/4110 ตามลำดับ (service.go:2136) ไม่ได้อ่านจาก `erp_income_list`
- 101/103 ไม่มีแท็บใช้เงินมัดจำ (ไม่อยู่ใน `depositKinds` trans_deposit.go:48) จึงไม่มีบรรทัดมัดจำ
- เลขบัญชีในวงเล็บคือตัวแรกของรายการสำรอง `resolveChartAccount` (service.go:1796, :1798, :1803)

## เอกสารต้นทาง-ปลายทาง
- ต้นทาง: ตั้งหนี้อื่น 99 (`refTransFlags` transMenuMap.ts:1481, :1498) แต่ FLAG_SPEC 101/103 ไม่มี refDoc จึงไม่แสดงช่องเอกสารอ้างอิงบนหัวเอกสาร (transLayouts.ts:445)
- used_status ของ 99 มาจากบรรทัด 101/103 ที่อ้าง ref_doc_no ใบนั้น (doc_flow.go:117)
- 101 นับเป็นหนี้ลูกหนี้ (`arDebtWhere` docs.go:600) ส่วน 103 นับเป็นเครดิต (`arCreditWhere` docs.go:602)
- ปลายทาง: ใบวางบิล 235 / รับชำระ 239 ; used_status_2 ของ 101/103 มาจากแถว ap_ar_trans_detail ที่อ้างใบนี้ (doc_flow.go:125)

## ยกเลิก/แก้ไข
- ยกเลิก 101 ด้วย 102 และยกเลิก 103 ด้วย 104 (doc_cancel.go:54) เอกสารยกเลิกได้ GL กลับด้านของต้นฉบับ ณ วันที่เอกสารยกเลิก ส่วนต้นฉบับยังเก็บ GL เดิม (`reverseCancelledGL` doc_cancel.go:585)
- บันทึกต้องอยู่ในงวดบัญชีที่เปิด (`checkOpenPeriod` trans_validate.go:45)

## ข้อควรระวัง
- หน้าจอ 101/103 ไม่มีช่อง inquiry (transLayouts.ts:111-112) แต่ standard GL ยังตรวจ inquiry = 1 (service.go:2138)

## ที่มาในโค้ด
- `frontend/account/tabs/transMenuMap.ts:1466` / `:1483` เมนู
- `frontend/account/transaction/transLayouts.ts:111-112` FLAG_SPEC 101/103
- `backend/internal/application/process/service.go:2135` GL
- `backend/internal/application/process/docs.go:600` / `:602` เงื่อนไขหนี้/เครดิต
- `backend/internal/application/process/doc_cancel.go:54` ยกเลิก 102/104

## ดูเพิ่ม
- [[doc-ar-other-debt]] · [[doctypes-overview]]
