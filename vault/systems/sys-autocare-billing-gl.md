---
title: "ยอดเงิน ส่วนลด VAT และการปิดบิลลงบัญชีของ AutoCare (sys-autocare-billing-gl)"
tags: [systems, autocare, accounting, vat, gl, payment]
aliases: ["ปิดบิล AutoCare", "postJobToBCAccount", "invoicePay", "Accounting State Gate", "AC-INV", "ใบกำกับภาษีขาย AutoCare"]
sources:
  - "backend/internal/adapter/inbound/http/autocare/handler.go:2226-2302"
  - "backend/internal/adapter/inbound/http/autocare/handler.go:1040-1046"
  - "backend/internal/adapter/inbound/http/autocare/handler.go:2495-2753"
  - "backend/internal/adapter/inbound/http/autocare/handler.go:2754-2768"
  - "backend/internal/adapter/inbound/http/autocare/handler_pay_test.go:10-30"
  - "backend/internal/application/process/trans.go:756-772"
  - "backend/internal/application/process/transcalc.go:135-176"
  - "frontend/autocare/AutoCareScreenContent.tsx:2510-2518"
---

# ยอดเงิน ส่วนลด VAT และการปิดบิลลงบัญชี

ค่าเงินทั้งหมดใน AutoCare คำนวณด้วย `*big.Rat` ผ่าน `appprocess.ParseDecimalRat` และ `FormatRat(x, 2)` และเก็บในคอลัมน์ `NUMERIC(18,2)` (handler.go:2250-2300) ไม่มีการใช้ float

## 1. คำนวณยอดใบงาน `recalculateJobTotals` (handler.go:2226-2302)
ฟังก์ชันนี้ถูกเรียกหลังเพิ่มรายการ หลังอนุมัติ upsell หลังอนุมัติส่วนลด และทุกครั้งที่ Rebuild
- **อะไหล่และค่าแรง**: รวม `line_total` ของทุกบรรทัด ถ้า `item_category = "LABOR"` จะนับเป็น `subtotal_labor` บรรทัดอื่นนับเป็น `subtotal_parts` (handler.go:2255-2259)
- **ค่าคอมช่าง**: `tech_commission_amt = SUM(tech_fee_amt)` (handler.go:2254)
- **ส่วนลดท้ายบิล** = `turn_in_discount` + `coupon_discount` + `owner_special_discount` โดยส่วนลดตัวสุดท้ายนับเฉพาะเมื่อ `discount_request_status = 'APPROVED'` (handler.go:2262-2270) ยอดรวมนี้ส่งต่อเป็น `DiscountWord`
- **VAT และยอดสุทธิ** ไม่ได้คำนวณเองใน AutoCare แต่เรียก `h.process.TransTotals` ด้วยค่า `TransType 2, TransFlag 44, VatType 0, VatRate "7"` ซึ่งเป็นชุดเดียวกับที่ใช้ตอนโพสต์จริง หน้าจอจึงแสดงยอดเท่ากับใบกำกับที่จะออก (handler.go:2271-2290) ผลที่ได้บันทึกเป็น `vat_amount` และ `grand_total`
- บรรทัดที่ไม่มี `item_code` ยังนับในยอดอะไหล่และค่าแรง แต่ไม่ถูกส่งเข้า TransTotals ถ้าใบงานไม่มีบรรทัดที่มีรหัสเลย VAT และยอดสุทธิจะเป็น 0 (handler.go:2251-2253, 2272-2289)
- ตอนรับรถ `create_intake_job` คิด VAT ตั้งต้นแบบรวมใน `net × 7 / 107` (handler.go:1040-1046) แต่ค่านี้ถูกแทนที่เมื่อ recalc หรือ rebuild ทำงาน

## 2. VatType 0 คำนวณอย่างไร
`TransTotals` โหลดค่าตั้งค่าบริษัทด้วย `loadGridOptions` (trans.go:756-772) จากนั้น `vatCalc` กรณี `vatType 0` (แยกนอก) ทำงานตามตัวเลือก (transcalc.go:135-176)
- `DiscountType ≠ 1`: คิด VAT จากฐานก่อนหักส่วนลดท้ายบิล แล้วจึงหักส่วนลดออกจากยอดสุทธิ
- `DiscountType = 1` และ `DiscountVatType = 0`: หักส่วนลดจากฐานภาษีก่อน ถ้าส่วนลดมากกว่าฐานภาษี ส่วนที่เกินจะไปหักจากยอดที่ไม่มีภาษี
- `DiscountType = 1` และ `DiscountVatType = 1`: เฉลี่ยส่วนลดตามสัดส่วนระหว่างยอดที่มีภาษีและไม่มีภาษี
- ปัดเศษด้วย `bcRound` ตาม `AmountDec` และ `RoundType` ของบริษัท

รายละเอียดเต็มอยู่ที่ [[acc-transcalc-totals]]

## 3. ปิดบิล `postJobToBCAccount` (handler.go:2495-2753)
1. อ่านหัวใบงานและบรรทัด โดยดึง `item_type` จาก `ic_inventory` (handler.go:2496-2524) ลูกค้าเริ่มต้นคือ `AR-AC01` วันที่เอกสารใช้ `job_date`
2. รวมส่วนลดด้วยกฎเดียวกับข้อ 1 (handler.go:2542-2551)
3. **เลขเอกสาร**: ใช้ `fixedDocNo` ถ้าส่งมา ถ้าไม่มีให้ใช้ `bc_doc_no` เดิม (ยกเว้นเลขเดโม `AC-INV2610-001`) ถ้าไม่มีทั้งสองอย่างจะสร้างเลขใหม่เป็น `"AC-INV"` ต่อด้วย 9 ตัวแรกของ Stamp (handler.go:2553-2565)
4. **บรรทัดขาย**: ข้ามบรรทัดที่ไม่มีรหัส ทุกบรรทัดใช้คลัง `WH1` และที่เก็บ `SH1` มี `Price`, `Discount`, `SumAmount = line_total`, `TaxType 0` และ `ItemType` ตามข้อมูลหลักสินค้า ใส่รหัส DOT ไว้ใน `LotNumber1` (handler.go:2569-2606) ถ้าไม่มีบรรทัดเลย ระบบใส่บรรทัดบริการ `SRV-ALIGN-3D` ที่มูลค่าเท่า `grand_total` (handler.go:2617-2632)
5. **ขายสดหรือขายเชื่อ**: ค่าเริ่มต้น `InquiryType 1` คือขายสด ถ้า `payment_method = FLEET_CREDIT` จะเป็น `InquiryType 0` คือขายเชื่อ (handler.go:2634-2637)
6. **หัวเอกสาร**: `DocFormatCode "AC"`, `TransType 2`, `TransFlag 44`, `VatType 0`, `VatRate "7"`, `TaxDocNo` เท่ากับเลขเอกสาร, `DocRef` เท่ากับเลขใบงาน, `DueDate` เท่ากับวันที่เอกสาร, `Confirmed true` (handler.go:2639-2668)
7. เรียก `TransTotals` ก่อน ถ้าเป็นขายสดจะใส่แท็บรับเงินจาก `invoicePay(payMethod, totals.Amount)` แล้วเรียก `SaveTrans` ถ้าล้มเหลวจะลองใหม่แบบแก้ไข `IsNew=false` (handler.go:2669-2686) การบันทึก `ic_trans`, `cb_trans` และ GL เป็นหน้าที่ของ SaveTrans ดู [[acc-transaction-save-flow]] และ [[acc-gl-posting-standard]]
8. **หลังบันทึก** (เฉพาะเมื่อไม่ได้ส่ง `fixedDocNo`) ทำ 5 อย่าง (handler.go:2689-2752)
   - ตัดสต็อกใน `autocare_tire_dot_stock` ของบรรทัดที่มี DOT
   - ปล่อยช่องซ่อมเป็น `AVAILABLE` และเพิ่มยอดขายของวัน
   - บวกงานและค่าคอมเข้ากระเป๋าช่าง
   - บวกแต้มสมาชิกให้รถ 150 แต้ม
   - สร้างใบรับประกันดิจิทัล `E_WARRANTY` เลข `CLM-…` และ `WRT-…`

   ส่วนการตั้งใบงานเป็น `BILLED_POSTED`, `accounting_posted = TRUE`, `bc_doc_no` และ `bc_gl_posted = TRUE` ทำทุกครั้ง

## 4. แท็บรับเงิน `invoicePay` (handler.go:2754-2768)
| `payment_method` | ช่องในแท็บรับเงิน |
|---|---|
| `CASH` | `Cash` + `PayCashAmount` |
| `CREDIT_CARD` | `Card` |
| `PROMPTPAY_QR` | `PromptPay` |
| `BANK_TRANSFER` | `Transfer` |
| ค่าอื่น | error "วิธีรับชำระเงินไม่ถูกต้อง" |

มี unit test `TestInvoicePayUsesChosenTender` ตรวจตารางนี้ และตรวจว่าวิธีที่ไม่รู้จักถูกปฏิเสธ (handler_pay_test.go:10-30) ดู [[acc-payment-tab]]

หน้าเว็บมีตัวเลือก PromptPay QR, บัตรเครดิต, เงินสด และ "เครดิตลูกหนี้ Fleet 30 วัน" (AutoCareScreenContent.tsx:2510-2518) แต่ในโค้ดโพสต์ตั้ง `DueDate` เท่ากับวันที่เอกสาร ไม่ได้บวก 30 วัน (handler.go:2659)

## ที่มาในโค้ด
- `backend/internal/adapter/inbound/http/autocare/handler.go:2226-2302`: recalculateJobTotals
- `backend/internal/adapter/inbound/http/autocare/handler.go:2495-2753`: postJobToBCAccount
- `backend/internal/adapter/inbound/http/autocare/handler.go:2754-2768`: invoicePay
- `backend/internal/adapter/inbound/http/autocare/handler_pay_test.go:10-30`: test
- `backend/internal/application/process/transcalc.go:135-176`: vatCalc
- `backend/internal/application/process/trans.go:756-772`: TransTotals

ดูเพิ่ม: [[doc-sale-invoice]] · [[tbl-ic-trans]] · [[tbl-cb-trans]] · [[tbl-gl-journal]] · [[sys-autocare-job-flow]] · [[flow-order-to-cash]]
