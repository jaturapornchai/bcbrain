---
title: "ใบวางบิลลงบัญชีไหม วางบิลแล้วยอดหนี้ลดหรือเปล่า"
tags: [faq, ar, ap, billing]
aliases: ["ใบวางบิล", "ใบรับวางบิล", "วางบิลซ้ำ", "billing note", "trans_flag 235", "trans_flag 213", "อ้างอิงใบวางบิล", "ar_bill_inform", "filter_pay_bill", "ar_pay_from_bill_note"]
sources: ["frontend/account/tabs/transMenuMap.ts:1544", "frontend/account/tabs/transMenuMap.ts:1345", "backend/internal/application/process/docs.go:526", "backend/internal/application/process/docs.go:645", "backend/internal/application/process/pay_check.go:168", "backend/internal/application/process/pay_check.go:221", "backend/internal/application/process/service.go:1731", "frontend/account/transaction/TransBillsGrid.tsx:382"]
---
# ใบวางบิลลงบัญชีไหม วางบิลแล้วยอดหนี้ลดหรือเปล่า

**ตอบสั้น:** ไม่ลงบัญชีและไม่ลดยอดหนี้ ใบวางบิลลูกหนี้ (235) และใบรับวางบิลเจ้าหนี้ (213) เป็นเพียงรายการรวมบิลค้างชำระ เพื่อส่งให้ลูกค้าหรือรับจากผู้จำหน่าย ยอดหนี้จะลดลงก็ต่อเมื่อบันทึกใบรับชำระหนี้ 239 หรือใบจ่ายชำระหนี้ 19

## รายละเอียด
**ข้อมูลที่บันทึก**
- หัวเอกสารเก็บใน `ap_ar_trans` ส่วนรายการบิลเก็บใน `ap_ar_trans_detail` โดย `billing_no` คือเลขที่บิลหนี้ และ `bill_type` คือ flag ของบิลนั้น
- 213/235 ไม่อยู่ใน `glRebuildTransFlags` ระบบจึงไม่สร้าง GL ให้
- ยกเลิกใบวางบิลลูกหนี้ด้วย 236 และใบรับวางบิลเจ้าหนี้ด้วย 214

**การเลือกบิลมาวาง** (`OutstandingBills`)
- ระบบแสดงบิลหนี้ของรายนั้นที่ยังมีคงเหลือ ณ วันที่เอกสาร ใช้ชุดเงื่อนไขหนี้เดียวกับใบรับ/จ่ายชำระ (ดู [[faq-ap-ar-balance-where]])
- ยอดคงเหลือ = ยอดบิล − ยอดที่ชำระแล้วในใบ 239/19 ยอดในใบวางบิลอื่นจะไม่ถูกหัก
- คอลัมน์ `doc_ref` แสดงเลขที่ใบวางบิลล่าสุดของบิลนั้น

**สวิตช์ใน `erp_option`**
- `filter_pay_bill` = 1: บิลที่อยู่ในใบวางบิลอื่นที่ยังไม่ยกเลิกจะไม่ขึ้นให้เลือก
- `ar_bill_inform` / `ap_bill_inform`: บันทึกไม่ได้ถ้าบิลเคยถูกวางแล้ว ระบบขึ้นว่า "ห้ามวางบิลซ้ำ" หรือ "ห้ามรับวางบิลซ้ำ"
- `pay_bill_over` ปิดอยู่: ยอดวางบิลหรือยอดชำระเกินยอดคงเหลือไม่ได้ ระบบขึ้นว่า "ป้อนยอดชำระเกิน" ระบบคำนวณยอดคงเหลือใหม่จากฐานข้อมูลตอนบันทึก ไม่ได้ใช้ตัวเลขจากหน้าจอ
- `ar_pay_from_bill_note` / `ap_pay_from_bill_note`: ทุกบรรทัดของใบรับชำระ 239 หรือใบจ่ายชำระ 19 ต้องมาจากใบวางบิล ถ้าไม่ใช่จะขึ้นว่า "ต้องอ้างอิงใบวางบิล"

**ดึงใบวางบิลมาใช้ในใบรับ/จ่ายชำระ:** ในหน้าจอ 239 และ 19 มีปุ่ม "อ้างอิงใบวางบิล" หรือ "อ้างอิงใบรับวางบิล" เลือกได้หลายใบ ถ้าบิลเดียวกันอยู่ในใบวางบิลหลายใบ ระบบใช้ใบล่าสุด

## ข้อควรระวัง
- เมื่อดึงจากใบวางบิล ช่องยอดชำระจะเป็นยอดที่วางบิลไว้ ไม่ใช่ยอดคงเหลือปัจจุบัน ถ้ามีการรับชำระบางส่วนหลังจากวางบิลแล้ว ต้องแก้ยอดเอง ถ้าไม่แก้และปิด `pay_bill_over` ไว้ จะบันทึกไม่ได้เพราะ "ป้อนยอดชำระเกิน"
- ยังไม่ได้พอร์ต flow สถานะของ 213/235 (`doc_flow.go`) บิลหนี้ต้นทางจึงไม่มีสถานะ "วางบิลแล้ว" ที่มาจากใบวางบิล
- ใบวางบิลที่ถูกใช้แล้ว ปิดแล้ว หรือถูกยกเลิกแล้ว จะแก้ไขหรือลบไม่ได้ (ดู [[faq-cannot-delete-document]])

## ดูเพิ่ม
- [[doc-ar-billing]]
- [[doc-ap-billing-receive]]
- [[tbl-ap-ar-trans-detail]]
- [[faq-ar-receipt-ap-payment-gl]]
- [[faq-ap-ar-balance-where]]

## ที่มาในโค้ด
- `frontend/account/tabs/transMenuMap.ts:1544` เมนู "ใบวางบิล (ลูกหนี้)" 235 (ยกเลิก 236 ที่ `:1562`)
- `frontend/account/tabs/transMenuMap.ts:1345` เมนู "ใบรับวางบิล (เจ้าหนี้)" 213 (ยกเลิก 214 ที่ `:1363`)
- `backend/internal/application/process/docs.go:526` `billSides` จับคู่ใบวางบิลกับใบชำระ 235↔239, 213↔19
- `backend/internal/application/process/docs.go:645` `OutstandingBills` ใช้ `filter_pay_bill` และหักเฉพาะยอดชำระ
- `backend/internal/application/process/pay_check.go:168` `billSaveCheck` คำนวณยอดคงเหลือใหม่ตอนบันทึก
- `backend/internal/application/process/pay_check.go:221` `checkBills` ตรวจวางบิลซ้ำ ชำระเกิน และบังคับอ้างอิงใบวางบิล
- `backend/internal/application/process/service.go:1731` `glRebuildTransFlags` ไม่มี 213/235
- `frontend/account/transaction/TransBillsGrid.tsx:382` ปุ่มอ้างอิงใบวางบิลในใบรับ/จ่ายชำระ
