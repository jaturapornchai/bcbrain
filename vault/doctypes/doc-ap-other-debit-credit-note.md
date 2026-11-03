---
title: "เพิ่มหนี้/ลดหนี้อื่นๆ เจ้าหนี้ (AP Other Debit/Credit Note)"
tags: [doctypes, ap]
aliases: ["trans_flag 89", "trans_flag 91", "เพิ่มหนี้อื่นๆ (เจ้าหนี้)", "ลดหนี้อื่นๆ (เจ้าหนี้)", "CDO", "CCO"]
sources: ["frontend/account/tabs/transMenuMap.ts:1268", "frontend/account/tabs/transMenuMap.ts:1285", "frontend/account/transaction/transLayouts.ts:105", "frontend/account/transaction/transLayouts.ts:106", "backend/internal/application/process/trans_tax.go:38", "backend/internal/application/process/service.go:1822", "backend/internal/application/process/service.go:1976", "backend/internal/application/process/service.go:1995", "backend/internal/application/process/docs.go:605", "backend/internal/application/process/docs.go:607", "backend/internal/application/process/doc_flow.go:116", "backend/internal/application/process/doc_cancel.go:54"]
---

# เพิ่มหนี้อื่นๆ (89) / ลดหนี้อื่นๆ (91) ฝั่งเจ้าหนี้

## ใช้เมื่อไร
ใช้เพิ่มหรือลดหนี้ของใบตั้งหนี้อื่น 87
- 89 เพิ่มหนี้อื่นๆ (CDO, transMenuMap.ts:1285)
- 91 ลดหนี้อื่นๆ (CCO, transMenuMap.ts:1268)
- รายการค้นจากรหัสค่าใช้จ่าย `erp_expenses_list` (transMenuMap.ts:1273, :1290)

## trans_flag/ตาราง
- เก็บใน [[tbl-ic-trans]] + [[tbl-ic-trans-detail]]

## ฟิลด์/แท็บบนหน้าจอ
- หัวเอกสาร: party, taxDoc, vat, docReason แท็บ vat, gl (transLayouts.ts:105 สำหรับ 89, :106 สำหรับ 91)

## ผลต่อสต็อก
ไม่มี

## ผลต่อภาษี (VAT/WHT)
- ภาษีซื้อ: 89 มี vat_calc 1 ส่วน 91 มี vat_calc −1 (`transVatTabs` trans_tax.go:38)
- ไม่มี WHT (ไม่อยู่ใน `transWhtParty` trans_tax.go:48)

## การลงบัญชี
ใช้ standard GL เมื่อรูปแบบเอกสารไม่มี template GL (`tpl.post` service.go:1585)

| flag | Dr | Cr | ที่มา |
|---|---|---|---|
| 89 | ค่าใช้จ่าย (ฐานภาษี) + ภาษีซื้อ (1154) | เจ้าหนี้ (2111) ยอดรวม หรือเงินที่จ่ายตามแท็บชำระ ถ้า inquiry เป็น 1/3 | service.go:1976 |
| 91 | เจ้าหนี้ (2111) ยอดรวม | ค่าใช้จ่าย (ฐานภาษี) + ภาษีซื้อ (1154) | service.go:1995 |

- บัญชีค่าใช้จ่าย = gl_account_code ของ `erp_expenses_list` ตาม item_code บรรทัดแรก (service.go:1822) ถ้าไม่มีใช้บัญชีซื้อ 5111/5110/1151 (service.go:1800)
- เลขบัญชีในวงเล็บคือตัวแรกของรายการสำรอง `resolveChartAccount` (service.go:1799, :1802)

## เอกสารต้นทาง-ปลายทาง
- ต้นทาง: ตั้งหนี้อื่น 87 (`refTransFlags` transMenuMap.ts:1283, :1300) แต่ FLAG_SPEC 89/91 ไม่มี refDoc จึงไม่แสดงช่องเอกสารอ้างอิงบนหัวเอกสาร (transLayouts.ts:445)
- used_status ของ 87 มาจากบรรทัด 89/91 ที่อ้าง ref_doc_no ใบนั้น (doc_flow.go:116, `refLines` :40)
- 89 นับเป็นหนี้เจ้าหนี้ (`apDebtWhere` docs.go:605) ส่วน 91 นับเป็นเครดิต (`apCreditWhere` docs.go:607)
- ปลายทาง: รับวางบิล 213 / จ่ายชำระ 19 ; used_status_2 ของ 89/91 มาจากแถว ap_ar_trans_detail ที่อ้างใบนี้ (doc_flow.go:125)

## ยกเลิก/แก้ไข
- ยกเลิก 89 ด้วย 90 และยกเลิก 91 ด้วย 92 (doc_cancel.go:54) เอกสารยกเลิกได้ GL กลับด้านของต้นฉบับ ณ วันที่เอกสารยกเลิก ส่วนต้นฉบับยังเก็บ GL เดิม (`reverseCancelledGL` doc_cancel.go:585)
- บันทึกต้องอยู่ในงวดบัญชีที่เปิด (`checkOpenPeriod` trans_validate.go:45)

## ข้อควรระวัง
- 89/91 ไม่มีช่อง inquiry บนจอ (FLAG_SPEC transLayouts.ts:105-106) แต่ standard GL ของ 89 ยังตรวจ inquiry 1/3 (service.go:1988)

## ที่มาในโค้ด
- `frontend/account/tabs/transMenuMap.ts:1268` / `:1285` เมนู
- `frontend/account/transaction/transLayouts.ts:105-106` FLAG_SPEC 89/91
- `backend/internal/application/process/service.go:1976` / `:1995` GL
- `backend/internal/application/process/docs.go:605` / `:607` เงื่อนไขหนี้/เครดิต
- `backend/internal/application/process/doc_cancel.go:54` ยกเลิก 90/92

## ดูเพิ่ม
- [[doc-ap-other-debt]] · [[doctypes-overview]]
