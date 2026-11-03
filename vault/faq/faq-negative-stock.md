---
title: "ทำไมสต็อกติดลบได้ และตั้งห้ามติดลบที่ไหน"
tags: [faq, ic, stock, negative-stock, erp-option]
aliases: ["สต็อกติดลบ", "ห้ามติดลบ", "negative stock", "issue_stock_control", "stock_balance_control", "ic_stock_control", "transfer_stock_control", "balance_control_type", "checkStockBalance"]
sources: ["backend/internal/application/process/trans_save_rules.go:30", "backend/internal/application/process/trans_save_rules.go:55", "backend/internal/application/process/trans_save_rules.go:151", "backend/internal/application/process/trans_save_rules.go:280", "backend/internal/application/process/trans_save_rules.go:389", "backend/internal/application/process/service.go:286"]
---
# ทำไมสต็อกติดลบได้ และตั้งห้ามติดลบที่ไหน

**ตอบสั้น:** ระบบตรวจยอดคงเหลือเฉพาะตอนบันทึก **เอกสารใหม่** ของเอกสาร 5 ประเภท คือ ขาย 44, สั่งขาย 36, รับคืน 46 (บางกรณี), เบิก 56 และโอนย้าย 72 และตรวจเมื่อเปิดสวิตช์ใน `erp_option` ไว้เท่านั้น เอกสารอื่น เช่น ปรับปรุงลด 68 หรือส่งคืนผู้จำหน่าย 16 รวมถึงการแก้เอกสารเดิม จึงทำให้สต็อกติดลบได้

## รายละเอียด
**เงื่อนไขที่ระบบจะตรวจ** (`checkTransSaveRules`) ต้องครบทุกข้อ
- เป็นเอกสารใหม่ (`IsNew`)
- เปิด `erp_option.issue_stock_control`
- `trans_flag` อยู่ในชุด 72, 36, 46, 44, 56 โดยไม่นับ 46 ที่ `inquiry_type` เป็น 1 หรือ 2

**สวิตช์ต่อประเภทเอกสาร** (`stockSwitchesFor`)
- ค่าพื้นฐานมาจาก `stock_balance_control`
- ขาย 44: ตรวจเสมอเมื่อเปิด `ic_stock_control`
- เบิก 56: ตรวจเสมอเมื่อเปิด `issue_stock_control`
- 36, 34, 44, 144, 46: ถ้าไม่ได้เปิด `ic_stock_control` จะไม่ตรวจยอด
- โอนย้าย 72/70: ไม่ตรวจถ้าไม่ได้เปิด `transfer_stock_control`
- `balance_control_type` กำหนดระดับที่ตรวจ: 0 = ต่อรหัสสินค้า, 1 = ต่อคลัง, 2 = ต่อที่เก็บ
- สินค้าที่ตั้ง `ic_inventory_detail.balance_control` = 1 จะไม่ถูกตรวจ
- มีตัวตรวจเสริมคือยอดจอง (`stock_reserved_control`, เฉพาะขาย 44) และยอดค้างส่ง (`stock_accrued_control`)

ถ้ายอดไม่พอ ระบบจะไม่บันทึก และแสดงข้อความที่มีคำว่า "ห้ามติดลบ" พร้อมรหัสสินค้าที่ไม่ผ่าน

**ผลต่อต้นทุนเมื่อติดลบ:** เมื่อจ่ายออกจนจำนวนสะสม ≤0 มูลค่าสะสมจะถูกตั้งเป็น 0 ส่วนต้นทุนเฉลี่ยยังเป็นค่าเดิม เมื่อมีรายการรับเข้าครั้งถัดไป ระบบเริ่มนับใหม่จากรายการรับนั้นทันที ต้นทุนที่ตัดตอนติดลบจึงไม่ถูกปรับย้อนหลัง (ดู [[faq-moving-average-cost]])

## ข้อควรระวัง
- ไม่ตรวจตอนแก้เอกสารเดิม เพราะเงื่อนไขคือ `in.IsNew` การเพิ่มจำนวนในใบขายเดิมจึงทำให้ติดลบได้
- เอกสารที่บันทึกผ่านเครื่องมือโดยตรง (ปรับยอดจากการตรวจนับ LOT, ต้นทุนแฝง) เรียก `saveTransTx` เองโดยไม่ผ่านการตรวจยอดคงเหลือ (ดู [[faq-stock-count-adjust]], [[faq-hidden-cost-landed]])
- ต้นทุนที่ผ่านช่วงติดลบขึ้นกับลำดับเอกสาร แก้วันที่เอกสารเพียงใบเดียวอาจเปลี่ยนต้นทุนของเอกสารหลายใบ (ดู [[faq-why-stock-cost-changed]])

## ดูเพิ่ม
- [[term-stock-balance]]
- [[acc-transaction-save-flow]]
- [[hist-lessons-trans-save-rules]]
- [[faq-stock-transfer-warehouse]]
- [[faq-balance-mismatch-troubleshoot]]

## ที่มาในโค้ด
- `backend/internal/application/process/trans_save_rules.go:30` `readSaveRuleOptions` อ่านสวิตช์สต็อกจาก `erp_option`
- `backend/internal/application/process/trans_save_rules.go:55` `stockCheckFlags` = 72, 36, 46, 44, 56
- `backend/internal/application/process/trans_save_rules.go:151` ตรวจเฉพาะ `in.IsNew` และ `issue_stock_control`
- `backend/internal/application/process/trans_save_rules.go:280` `stockSwitchesFor` สวิตช์ต่อประเภทเอกสาร
- `backend/internal/application/process/trans_save_rules.go:389` `checkStockBalance`
- `backend/internal/application/process/service.go:286` รับเข้าหลังติดลบให้เริ่มนับใหม่
