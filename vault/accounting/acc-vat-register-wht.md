---
title: "ทะเบียนภาษีซื้อ/ภาษีขาย และภาษีหัก ณ ที่จ่าย (VAT Register & WHT)"
tags: [accounting, vat, wht, tax, postgres]
aliases: ["ภาษีซื้อ", "ภาษีขาย", "รายงานภาษี", "ภาษีหัก ณ ที่จ่าย", "ภาษีถูกหัก ณ ที่จ่าย", "เลขใบกำกับซ้ำ", "gl_journal_vat_buy", "gl_wht_list", "RebuildTransTax"]
sources: ["backend/internal/application/process/trans_tax.go:18", "backend/internal/application/process/trans_tax.go:37", "backend/internal/application/process/trans_tax.go:48", "backend/internal/application/process/trans_tax.go:53", "backend/internal/application/process/trans_tax.go:74", "backend/internal/application/process/trans_tax.go:109", "backend/internal/application/process/trans_tax.go:169", "backend/internal/application/process/trans_tax.go:224", "backend/internal/application/process/trans_tax.go:252", "backend/internal/application/process/trans_tax_doc_no.go:18", "backend/internal/application/process/journaltax.go:16", "backend/internal/application/process/journaltax.go:82", "backend/internal/application/process/journaltax.go:153", "backend/internal/application/process/journaltax.go:260"]
---

# ทะเบียนภาษีซื้อ/ภาษีขาย และภาษีหัก ณ ที่จ่าย

ภาษีซื้อเก็บใน `gl_journal_vat_buy` ภาษีขายเก็บใน `gl_journal_vat_sale` ส่วนภาษีหัก ณ ที่จ่ายเก็บใน `gl_wht_list` + `gl_wht_list_detail` แถว VAT ของเอกสารปกติเป็นค่า derived ที่สร้างจากหัวเอกสารทุกครั้งที่บันทึก ส่วน WHT และ VAT ที่ผู้ใช้คีย์เอง (`is_manual_vat` = 1) เป็น raw ที่บันทึกตามที่ส่งและไม่ถูกคำนวณทับ (trans_tax.go:18-22) เอกสารที่ยกเลิกยังเก็บแถวไว้ รายงานเป็นฝ่ายตัดยอดตาม `ic_trans.last_status`

## ทำงานอย่างไร

### flag ที่มีแท็บ VAT (`transVatTabs` trans_tax.go:37)
- ภาษีซื้อ: 12, 14, 16, 87, 89, 91, 260, 262, 264, 315, 316, 317, 461, มัดจำ 11, 25
- ภาษีขาย: 44, 46, 48, 99, 101, 103, 144, 250, 252, 254, 1802, มัดจำ 110, 112
- เอกสารลดหนี้ (16, 91, 262, 317, 48, 103, 252, 25, 112) เก็บยอดเป็นบวก แต่ `vat_calc` = -1
- ap_ar_trans 19 (จ่ายชำระหนี้) และ 239 (รับชำระหนี้) มีแท็บ VAT + WHT ที่ผู้ใช้คีย์ทั้งหมด (`apArTaxTabs` :53, `apArTaxStmts` :169) สำหรับ VAT ค่าบริการที่ถึงกำหนดตอนชำระเงินและภาษีที่หักจากยอดนั้น (comment trans_tax.go:25-28); แท็บที่ client ไม่ส่งมา (nil) เก็บแถวเดิมไว้

### แถว VAT อัตโนมัติ (`defaultTransVat` trans_tax.go:74)
- vat_type 3 (ไม่กระทบภาษี) ไม่สร้างแถว
- ฐานภาษี = `total_before_vat`, ภาษี = `total_vat_value`, ยอดรวม = HALF_UP 2 ตำแหน่งของฐาน + HALF_UP 2 ตำแหน่งของภาษี, ยกเว้น = `total_except_vat` (scale 2 ทั้งหมด)
- เลขที่/วันที่ใบกำกับว่าง ใช้เลขที่/วันที่เอกสาร
- อัตราเป็น 0 แต่ฐาน > 0 และภาษี > 0: คำนวณอัตรากลับ = ภาษี x 100 / ฐาน (ปัด HALF_UP 2 ตำแหน่ง)
- ถ้าผู้ใช้ติ๊ก VAT เอง (`ManualVat`) หรือส่งมามากกว่า 1 แถว จะบันทึกตามที่ส่ง และตั้ง `ic_trans.is_manual_vat` = 1 (`transTaxStmts` :109, :115, :128-129)

### WHT (`transWhtParty` trans_tax.go:48)
- "ap" ภาษีหัก ณ ที่จ่าย (เราหักผู้ขาย): 12, 16, 260, 262, 264, 315, 11, 25
- "ar" ภาษีถูกหัก ณ ที่จ่าย (ลูกค้าหักเรา): 44, 48, 144, 250, 252, 1802, 110, 112
- เขียนแท็บ WHT ใหม่เฉพาะเมื่อ client ส่งแท็บมา (`in.Wht` ไม่ใช่ nil, :132) โดยลบแถวเดิมของเอกสารแล้วใส่ใหม่ (`docWhtStmts` :148)
- มัดจำที่แท็บจ่ายปิดอยู่ ลบ WHT อย่างเดียว ไม่เขียนใหม่ (:134-135)
- บรรทัดที่ไม่มีประเภทเงินได้ถูกตัดทิ้ง; ไม่มีเลขที่เอกสารหัก ณ ที่จ่ายแต่มีบรรทัดหรือรหัสคู่ค้า error "กรุณาระบุเลขที่เอกสารหัก ณ ที่จ่าย" (`journalWhtStmts` journaltax.go:260-275)
- ฐานภาษีและภาษีของบรรทัด scale 2 อัตรา scale 4; ยอดหัว WHT = ผลรวมบรรทัด (journaltax.go:294-296)
- เลขที่เอกสารหัก ณ ที่จ่ายห้ามซ้ำในเอกสาร และ unique index `gl_wht_list_gl_wht_list_doc_no` กันซ้ำข้ามเอกสาร (journaltax.go:108, 304)

### JV ทั่วไป (journaltax.go)
- `flagJournalVat` = 1999 (บัญชี_ข้อมูลรายวัน), `flagWhtIn` = 1502 (เราหักผู้ขาย), `flagWhtOut` = 1501 (ลูกค้าหักเรา) (journaltax.go:16-20)
- เฉพาะ JV ที่คีย์มือ (`isVoucherFlag` = flag < 1 หรือ 1999) เท่านั้นที่เป็นเจ้าของแท็บภาษี; journal อัตโนมัติไม่มี (`journalTaxStmts` :82) JV ที่หัว flag 0 เก็บแท็บภาษีใต้ 1999/1502/1501 นอกนั้นใช้ flag ของหัว (`taxFlag` :74)
- แถว VAT: เลขที่ใบกำกับว่างถูกตัดทิ้ง ซ้ำในเอกสาร error; ประเภทภาษี 0-2 (ซื้อ) / 0-1 (ขาย), สถานประกอบการ 0-1, เดือนภาษี 0-12; ฐาน/ภาษี/ยกเว้น scale 2 อัตรา scale 4 (journaltax.go:178-228)
- ชื่อ ที่อยู่ เลขผู้เสียภาษีของ WHT ดึงจาก master คู่ค้า (`whtInsert` :241); VAT ที่ชื่อ/เลขภาษี/สาขาว่างทั้งหมดจะดึงจาก `ap_supplier_detail` / `ar_customer_detail` และตั้ง `manual_add` = 0 ไม่เช่นนั้นบันทึกตามที่คีย์และตั้ง `manual_add` = 1 (`vatInsertSQL` :153)

### ห้ามเลขใบกำกับภาษีซ้ำ (`checkTaxDocNo` trans_tax_doc_no.go:18)
- ใช้เลข `tax_doc_no` (ว่างใช้เลขที่เอกสาร) เทียบแบบไม่สนตัวพิมพ์เล็ก/ใหญ่
- ภาษีขาย: `vat_number` ห้ามซ้ำกับเอกสารใดๆ
- ภาษีซื้อ: `vat_doc_no` ห้ามซ้ำภายในผู้ขายเดียวกันและ flag เดียวกัน
- ไม่ตรวจเมื่อเป็น VAT คีย์มือ (`ManualVat`) ซึ่งมี unique index `pk_ap_code_tax_no` กันแทน (:20)
- ตรวจภายใต้ advisory lock ใน transaction บันทึก; เอกสารที่บันทึกซ้ำด้วยเลขเดิมของตัวเองผ่านได้

### คำนวณทะเบียนภาษีใหม่ (`RebuildTransTax` trans_tax.go:252)
- สร้างแถว VAT derived ใหม่ของเอกสาร `ic_trans` และ `as_trans` ทุกใบที่ flag อยู่ใน `transVatTabs` จากหัวเอกสาร (`transVatSourceSQL` :224)
- ข้ามเอกสารที่ `is_manual_vat` = 1 หรือมีแถว VAT เก็บอยู่มากกว่า 1 แถว (:228-230) ไม่สร้างทับ
- ลบแถว VAT/WHT ที่เอกสารต้นทางใน `ic_trans` / `as_trans` / `ap_ar_trans` หายไปแล้ว (:237-247); ใช้ advisory lock เดียวทั้งระบบ (:277) จำกัดเวลา 120 วินาที (:257); รันซ้ำได้ผลเดิม

## ที่มาในโค้ด
- `backend/internal/application/process/trans_tax.go:18` หลัก raw vs derived
- `backend/internal/application/process/trans_tax.go:37` transVatTabs
- `backend/internal/application/process/trans_tax.go:48` transWhtParty
- `backend/internal/application/process/trans_tax.go:74` defaultTransVat
- `backend/internal/application/process/trans_tax.go:109` transTaxStmts
- `backend/internal/application/process/trans_tax.go:169` apArTaxStmts
- `backend/internal/application/process/trans_tax.go:224` transVatSourceSQL (เงื่อนไขข้ามเอกสาร)
- `backend/internal/application/process/trans_tax.go:252` RebuildTransTax
- `backend/internal/application/process/trans_tax_doc_no.go:18` checkTaxDocNo
- `backend/internal/application/process/journaltax.go:16` 1999/1501/1502
- `backend/internal/application/process/journaltax.go:82` journalTaxStmts แท็บภาษีของ JV
- `backend/internal/application/process/journaltax.go:153` vatInsertSQL
- `backend/internal/application/process/journaltax.go:260` journalWhtStmts

## ดูเพิ่ม
- [[acc-transcalc-totals]]
- [[acc-payment-tab]]
- [[acc-fixed-asset-sale]]
- [[acc-trans-flag-map]]
