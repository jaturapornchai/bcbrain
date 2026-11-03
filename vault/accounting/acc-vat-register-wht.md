---
title: "ทะเบียนภาษีซื้อ/ภาษีขาย และภาษีหัก ณ ที่จ่าย (VAT Register & WHT)"
tags: [accounting, vat, wht, tax, postgres]
aliases: ["ภาษีซื้อ", "ภาษีขาย", "รายงานภาษี", "ภาษีหัก ณ ที่จ่าย", "ภาษีถูกหัก ณ ที่จ่าย", "เลขใบกำกับซ้ำ", "gl_journal_vat_buy", "gl_wht_list", "RebuildTransTax"]
sources: ["backend/internal/application/process/trans_tax.go:16", "backend/internal/application/process/trans_tax.go:37", "backend/internal/application/process/trans_tax.go:48", "backend/internal/application/process/trans_tax.go:74", "backend/internal/application/process/trans_tax.go:109", "backend/internal/application/process/trans_tax.go:169", "backend/internal/application/process/trans_tax.go:252", "backend/internal/application/process/trans_tax_doc_no.go:18", "backend/internal/application/process/journaltax.go:15", "backend/internal/application/process/journaltax.go:82", "backend/internal/application/process/journaltax.go:153"]
---

# ทะเบียนภาษีซื้อ/ภาษีขาย และภาษีหัก ณ ที่จ่าย

ภาษีซื้อเก็บใน `gl_journal_vat_buy` ภาษีขายเก็บใน `gl_journal_vat_sale` ส่วนภาษีหัก ณ ที่จ่ายเก็บใน `gl_wht_list` + `gl_wht_list_detail` แถว VAT ของเอกสารปกติเป็นค่า derived ที่สร้างจากหัวเอกสารทุกครั้งที่บันทึก ส่วน WHT และ VAT ที่ผู้ใช้คีย์เองเป็น raw ที่ไม่ถูกคำนวณทับ

## ทำงานอย่างไร

### flag ที่มีแท็บ VAT (`transVatTabs` trans_tax.go:37)
- ภาษีซื้อ: 12, 14, 16, 87, 89, 91, 260, 262, 264, 315, 316, 317, 461, มัดจำ 11, 25
- ภาษีขาย: 44, 46, 48, 99, 101, 103, 144, 250, 252, 254, 1802, มัดจำ 110, 112
- เอกสารลดหนี้ (16, 91, 262, 317, 48, 103, 252, 25, 112) เก็บยอดเป็นบวก แต่ `vat_calc` = -1
- ap_ar_trans 19 (จ่ายชำระหนี้) และ 239 (รับชำระหนี้) มีแท็บ VAT + WHT ที่ผู้ใช้คีย์ทั้งหมด (`apArTaxTabs` :53, `apArTaxStmts` :169) ใช้กับภาษีบริการที่ถึงกำหนดเมื่อชำระ (comment ในโค้ดอ้าง ประมวลรัษฎากร ม.78/1(1) และ ม.86; ยังไม่ได้ตรวจกับแหล่งทางการ)

### แถว VAT อัตโนมัติ (`defaultTransVat` trans_tax.go:74)
- vat_type 3 (ไม่กระทบภาษี) ไม่สร้างแถว
- ฐานภาษี = `total_before_vat`, ภาษี = `total_vat_value`, ยอดรวม = round2(ฐาน) + round2(ภาษี), ยกเว้น = `total_except_vat` (scale 2 ทั้งหมด)
- เลขที่/วันที่ใบกำกับว่าง ใช้เลขที่/วันที่เอกสาร
- อัตราเป็น 0 แต่มีฐานและภาษี: คำนวณอัตรากลับ = ภาษี x 100 / ฐาน (ปัด 2)
- ถ้าผู้ใช้ติ๊ก VAT เอง (`ManualVat`) หรือส่งมามากกว่า 1 แถว จะบันทึกตามที่ส่ง และตั้ง `ic_trans.is_manual_vat` = 1 (`transTaxStmts` :109)

### WHT (`transWhtParty` trans_tax.go:48)
- "ap" ภาษีหัก ณ ที่จ่าย (เราหักผู้ขาย): 12, 16, 260, 262, 264, 315, 11, 25
- "ar" ภาษีถูกหัก ณ ที่จ่าย (ลูกค้าหักเรา): 44, 48, 144, 250, 252, 1802, 110, 112
- ยอดหัว WHT = ผลรวมบรรทัด (journaltax.go:294); แถวที่ไม่มีประเภทเงินได้จะถูกตัดทิ้ง
- มัดจำที่ไม่ได้จ่ายเงินสด (แท็บจ่ายปิด) ลบ WHT อย่างเดียว ไม่เขียนใหม่
- `gl_wht_list.tax_doc_no` ต้องไม่ซ้ำข้ามเอกสาร

### JV ทั่วไป (journaltax.go)
- `flagJournalVat` = 1999 (บัญชี_ข้อมูลรายวัน), `flagWhtIn` = 1502 (เราหักผู้ขาย), `flagWhtOut` = 1501 (ลูกค้าหักเรา)
- เฉพาะ JV ที่คีย์มือ (`isVoucherFlag` = flag < 1 หรือ 1999) เท่านั้นที่เป็นเจ้าของแท็บภาษี; journal อัตโนมัติไม่มี
- ชื่อ ที่อยู่ เลขผู้เสียภาษีของ WHT ดึงจาก master คู่ค้า; VAT ที่ชื่อ/เลขภาษี/สาขาว่างจะดึงจาก master ไม่เช่นนั้นตั้ง `manual_add` = 1 (`vatInsertSQL` :153)

### ห้ามเลขใบกำกับภาษีซ้ำ (`checkTaxDocNo` trans_tax_doc_no.go:18)
- ภาษีขาย: `vat_number` ห้ามซ้ำกับเอกสารใดๆ
- ภาษีซื้อ: `vat_doc_no` ห้ามซ้ำภายในผู้ขายเดียวกันและ flag เดียวกัน
- ตรวจภายใต้ advisory lock ใน transaction บันทึก; เอกสารที่บันทึกซ้ำด้วยเลขเดิมของตัวเองผ่านได้

### คำนวณทะเบียนภาษีใหม่ (`RebuildTransTax` trans_tax.go:252)
- สร้างแถว VAT derived ใหม่ของทุกเอกสาร `ic_trans` และ `as_trans` จากหัวเอกสาร
- ข้ามเอกสารที่ VAT คีย์มือ หรือมีมากกว่า 1 แถว (เพื่อไม่ทับข้อมูลจากโปรแกรม C#)
- ลบแถว VAT/WHT ที่เอกสารต้นทางหายไปแล้ว; ใช้ lock เดียวทั้งระบบ; รันซ้ำได้ผลเดิม

## ที่มาในโค้ด
- `backend/internal/application/process/trans_tax.go:16` หลัก raw vs derived
- `backend/internal/application/process/trans_tax.go:37` transVatTabs
- `backend/internal/application/process/trans_tax.go:48` transWhtParty
- `backend/internal/application/process/trans_tax.go:74` defaultTransVat
- `backend/internal/application/process/trans_tax.go:109` transTaxStmts
- `backend/internal/application/process/trans_tax.go:169` apArTaxStmts
- `backend/internal/application/process/trans_tax.go:252` RebuildTransTax
- `backend/internal/application/process/trans_tax_doc_no.go:18` checkTaxDocNo
- `backend/internal/application/process/journaltax.go:15` แท็บภาษีของ JV
- `backend/internal/application/process/journaltax.go:153` vatInsertSQL

## ดูเพิ่ม
- [[acc-transcalc-totals]]
- [[acc-payment-tab]]
- [[acc-fixed-asset-sale]]
- [[acc-trans-flag-map]]
