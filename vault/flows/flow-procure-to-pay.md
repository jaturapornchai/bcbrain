---
title: "จัดซื้อถึงจ่ายเงิน (Procure-to-Pay)"
tags: [flows, p2p]
aliases: ["P2P", "วงจรซื้อ", "ขอซื้อ สั่งซื้อ รับสินค้า ตั้งหนี้ จ่ายชำระ", "procure to pay"]
sources: ["backend/internal/application/process/trans_ref_import_lines.go:52", "backend/internal/application/process/service.go:1976", "backend/internal/application/process/docs.go:119", "backend/internal/application/process/trans_validate.go:43", "frontend/account/tabs/transMenuMap.ts:60"]
---
# จัดซื้อถึงจ่ายเงิน (Procure-to-Pay)

เส้นทางงานซื้อตั้งแต่ขอซื้อจนจ่ายเงินเจ้าหนี้ เอกสารฝั่งสินค้า (`ic_trans`) บันทึกผ่าน `/api/v1/process/trans/save` ส่วนวางบิลและจ่ายชำระ (`ap_ar_trans`) บันทึกผ่าน `/api/v1/process/doc/save` ดู [[acc-transaction-save-flow]] และ [[proc-doc-flow-numbering]]

## ภาพรวม

```mermaid
flowchart LR
  PR["ใบขอซื้อ (2)"] --> PRA["อนุมัติขอซื้อ (4)"]
  PR --> PO["ใบสั่งซื้อ (6)"]
  PRA --> PO
  PO --> DEP["จ่ายล่วงหน้า/มัดจำ (10/11)"]
  PO --> PI["ซื้อ/ตั้งหนี้ (12)"]
  PO --> RCV["ทยอยรับสินค้า (310)"]
  RCV --> PPI["ตั้งหนี้จากการรับ (315)"]
  PI --> RET["ส่งคืน/ลดหนี้ (16) · เพิ่มหนี้ (14)"]
  RCV --> RRET["ส่งคืนจากการรับ (311)"]
  PPI --> PRET["ลดหนี้ (317) · เพิ่มหนี้ (316)"]
  PI --> BILL["รับวางบิล (213)"]
  PPI --> BILL
  BILL --> PAY["จ่ายชำระหนี้ (19)"]
  PI --> PAY
  PAY --> CHQ["เช็คจ่าย (ดูโน้ตเงินสด-เช็ค)"]
```

ลูกศร "ดึงจากเอกสาร" มาจาก `refImportSources` (`trans_ref_import_lines.go:52-57`) ได้แก่ 6←{4,2}, 12←6, 310←6, 315←310, 16←12, 311←310, 317←315, 14←12, 316←315

## ขั้นตอน

| ขั้น | เอกสาร/หน้าจอ | ตารางที่เขียน | ผลบัญชี/สต็อก | path:line |
|---|---|---|---|---|
| 1 | ใบขอซื้อ (2) `menu_purchase_requisition` (เมนู "ใบเสนอซื้อสินค้า (PR)") [[doc-purchase-requisition]] | [[tbl-ic-trans]], [[tbl-ic-trans-detail]] | ไม่ตัดสต็อก ไม่ลง GL (2 ไม่อยู่ใน `stockRowsSQL` และ `glRebuildTransFlags`) | `frontend/account/tabs/transMenuMap.ts:60`, `backend/internal/application/process/stock_rebuild.go:18-19`, `backend/internal/application/process/service.go:1742-1756` |
| 2 | อนุมัติใบขอซื้อ (4) | [[tbl-ic-trans]] | ไม่มีผลบัญชี | `frontend/account/tabs/transMenuMap.ts:74` |
| 3 | ใบสั่งซื้อ (6) `menu_po_purchase_order` [[doc-purchase-order]] ดึงจาก 4/2 · อนุมัติใบสั่งซื้อ (8) | [[tbl-ic-trans]], [[tbl-ic-trans-detail]] | ไม่ตัดสต็อก ไม่ลง GL | `frontend/account/tabs/transMenuMap.ts:103`, `:119`, `backend/internal/application/process/trans_ref_import_lines.go:52` |
| 4 | จ่ายเงินล่วงหน้า (10) / จ่ายมัดจำ (11) [[doc-purchase-advance-payment]] [[doc-purchase-deposit-payment]] | [[tbl-ic-trans]], [[tbl-cb-trans]], [[tbl-cb-trans-detail]] | 10: Dr เงินจ่ายล่วงหน้า 115710 เต็มยอด / Cr ช่องทางจ่าย · 11: Dr มัดจำจ่าย 153010 ยอดก่อน VAT + Dr ภาษีซื้อ / Cr ช่องทางจ่าย · ใบคืน 20/25 กลับข้าง | `backend/internal/application/process/trans_deposit.go:39-40`, `backend/internal/application/process/service.go:2196-2216` |
| 5a | ซื้อสินค้า/ตั้งหนี้ (12) `menu_po_purchase_billing` [[doc-purchase-invoice]] ดึงจาก 6 | [[tbl-ic-trans]], [[tbl-ic-trans-detail]], [[tbl-gl-journal]], [[tbl-gl-journal-detail]] (+ ภาษีซื้อ ดู [[flow-tax-vat-wht-reports]]) | สต็อกเข้า (12 อยู่ใน `stockRowsSQL`) · Dr ซื้อ 5111 (ยอดก่อน VAT + มัดจำที่ตัดใช้ก่อน VAT) + Dr ภาษีซื้อ 1154 / Cr เจ้าหนี้ 2111 (inquiry 0/2) หรือ Cr ช่องทางจ่าย (inquiry 1/3 = ซื้อเงินสด) / Cr มัดจำจ่าย 153010 เท่ายอดมัดจำที่ตัดใช้ | `frontend/account/tabs/transMenuMap.ts:299`, `backend/internal/application/process/service.go:1976-1994`, `:1839-1851`, `backend/internal/application/process/trans_deposit.go:53` |
| 5b | ทยอยรับสินค้า (310) `menu_po_purchase_partial_item` [[doc-purchase-partial-receive]] ดึงจาก 6 | [[tbl-ic-trans]], [[tbl-ic-trans-detail]], GL | สต็อกเข้าที่ 310 · Dr ซื้อ / Cr เจ้าหนี้ไม่ถึงกำหนดตั้งหนี้ 212015 (ลำดับสำรอง 2113) ยอดก่อน VAT ไม่มีบรรทัดภาษี · ระบบสร้างบัญชี 212015 ในผังให้อัตโนมัติถ้าไม่มี | `frontend/account/tabs/transMenuMap.ts:330`, `backend/internal/application/process/service.go:1934-1944`, `:1667-1671` |
| 5c | ตั้งหนี้จากการรับ (315) `menu_po_purchase_partial_1` [[doc-purchase-partial-invoice]] ดึงจาก 310 | [[tbl-ic-trans]], GL, ภาษีซื้อ | ไม่ตัดสต็อกซ้ำ (315 ไม่อยู่ใน `stockRowsSQL`) · Dr 212015 (ยอดก่อน VAT + มัดจำที่ตัดใช้) + Dr ภาษีซื้อ / Cr เจ้าหนี้ (หรือ Cr ช่องทางจ่ายเมื่อ inquiry 1/3) / Cr มัดจำจ่าย 153010 ที่ตัดใช้ | `frontend/account/tabs/transMenuMap.ts:361`, `backend/internal/application/process/service.go:1958-1974` |
| 6 | ส่งคืน/ลดหนี้ (16) ← 12 · ส่งคืนจากการรับ (311) ← 310 · ลดหนี้ (317) ← 315 [[doc-purchase-return]] [[doc-purchase-partial-return]] [[doc-purchase-partial-credit-note]] | [[tbl-ic-trans]], GL | สต็อกออก (16, 311) ส่วน 317 ไม่เข้าสต็อก · 16/317: Dr เจ้าหนี้ (inquiry 0/1) หรือ Dr ช่องทางรับ (inquiry 2/3 คืนเป็นเงิน) / Cr ซื้อ 5111 + Cr ภาษีซื้อ (317 เครดิตบัญชีซื้อ ไม่ใช่ 212015) · 311: Dr 212015 / Cr ซื้อ (ยอดก่อน VAT) | `frontend/account/tabs/transMenuMap.ts:392`, `:408`, `:424`, `backend/internal/application/process/service.go:1995-2007`, `:1946-1956` |
| 7 | เพิ่มหนี้ (14) ← 12 · เพิ่มหนี้ (316) ← 315 [[doc-purchase-debit-note]] [[doc-purchase-partial-debit-note]] | [[tbl-ic-trans]], GL | 14 เข้าสต็อก โดย 14/16/311 inquiry 1/3 = ปรับมูลค่าอย่างเดียวไม่เปลี่ยนจำนวน (`stockValueOnlySQL`) · 316 ไม่เข้าสต็อก · GL เหมือน 12 (Dr ซื้อ + ภาษีซื้อ) แต่ 14/316 Cr เจ้าหนี้เสมอ | `frontend/account/tabs/transMenuMap.ts:483`, `:499`, `backend/internal/application/process/stock_rebuild.go:19`, `:26`, `backend/internal/application/process/service.go:1988-1992` |
| 8 | รับวางบิล (213) `menu_ap_pay_bill` [[doc-ap-billing-receive]] | [[tbl-ap-ar-trans]], [[tbl-ap-ar-trans-detail]] | ไม่ลง GL (`glFlag` มีแค่ 19/239) | `frontend/account/tabs/transMenuMap.ts:1349`, `backend/internal/application/process/docs.go:389-390` |
| 9 | จ่ายชำระหนี้ (19) `menu_ap_debt_billing` [[doc-ap-payment]] เลือกบิลจาก `/doc/bills` | [[tbl-ap-ar-trans]], [[tbl-ap-ar-trans-detail]], [[tbl-cb-trans]], [[tbl-cb-trans-detail]], [[tbl-cb-chq-list]], GL | Dr เจ้าหนี้ (ยอด + ผลต่างอัตราแลกเปลี่ยน) / Cr ช่องทางจ่าย (เงินสด/โอน/เช็คจ่าย 2112/บัตร → ธนาคาร/ภาษีหัก ณ ที่จ่าย ลำดับ 2122 → 2123 → 2120) เมื่อยอดใน `cb_trans` รวมเท่ายอดจ่าย ไม่เช่นนั้น Cr เงินสดบรรทัดเดียว · ขาดทุน Dr 511030 / กำไร Cr 420040 | `frontend/account/tabs/transMenuMap.ts:1378`, `backend/internal/application/process/service.go:2170-2194`, `:1871-1931`, `backend/internal/adapter/inbound/http/router.go:181` |

ยอดค้างเจ้าหนี้ไม่ได้เก็บเป็นคอลัมน์ `OutstandingBills` คำนวณจากเอกสารหนี้ตาม `apDebtWhere` (12/315/260/264 inquiry 0/2, 14/316/81/83/87/89) ร่วมกับเอกสารลดหนี้ `apCreditWhere` (16/317 inquiry 0/1, 85/91, 262 inquiry 0/2) หักยอดที่ใบจ่ายชำระอื่นจ่ายแล้วใน `ap_ar_trans_detail.sum_pay_money` (บวก `lost_profit_exchange_amount` เฉพาะบิล 12/44/1802) (`docs.go:604-608`, `:621-626`, `:628`)

## จุดตรวจสอบ/validation

- ก่อนบันทึก `checkTransScreenSave` (`trans_validate.go:43`) ตรวจตามลำดับ:
  - งวดบัญชีเปิดอยู่ ([[flow-period-year-close]])
  - เอกสารที่แก้ไม่ถูกล็อก/ยังแก้ได้
  - หน้าจอมัดจำ/ล่วงหน้า (10/11 ฯลฯ) จบการตรวจตรงนี้ (`trans_validate.go:71-73`)
  - เลขที่เอกสาร สาขา แผนก วันส่ง (`checkScreenFields` :168)
  - รหัสเจ้าหนี้ (`checkParty` :216)
  - รายการอ้างอิง (`checkReferencedLines` :339)
  - จำนวนเกินใบอ้างอิงของใบสั่งจอง/ใบสั่งขาย (`checkQtyOverDocRef` ใช้กับ 34/36 เท่านั้น)
  - กฎบันทึก (`checkTransSaveRules` :90)
- 12/310 ห้ามรับเกินจำนวนในใบสั่งซื้อ 6 (หักยอดที่ 12/310 ใบอื่นรับไปแล้ว) ออปชัน `receive_more_po` ข้ามการตรวจนี้ (`trans_validate.go:81`, `:295-296`)
- ใบที่ให้ดึงเข้า 12/310/315 ต้อง `doc_success=0` ส่วนการดึงเข้าใบสั่งซื้อ 6 ต้อง `doc_success=0` และใบอนุมัติขอซื้อ (4) ต้อง `not_approve_1=0` ถ้าเปิด `ref_po_approve` ใบสั่งซื้อที่ดึงเข้า 12/310 ต้อง `approve_status=1` และจำกัดสาขาตามสาขาเอกสาร (`lookup_trans.go:143-146`, `:164-167`) ดู [[proc-lookup-filters]]
- ภาษีซื้อ: เมื่อเปิด `check_input_vat` และ VatType 0/1 เอกสารใน `inputVatFlags` (ฝั่งซื้อ 12/315/14/316/16/317/260/264/262) ต้องมีเลขที่และวันที่ใบกำกับ (`trans_save_rules.go:53`, `:140-145`) และเลขใบกำกับต้องไม่ซ้ำกับผู้จำหน่ายเดียวกันในธงเดียวกัน (`trans_tax_doc_no.go:18`)
- มัดจำ: ตอนใช้มัดจำจะล็อก `deposit:<doc>` แล้วตรวจยอดคงเหลือ (`trans_deposit.go:145-148`) และห้ามลบมัดจำที่ถูกใช้แล้ว (`trans_deposit.go:246`) ดู [[acc-deposit-advance]]
- ใบอ้างอิงต้องมีสินค้าที่ดึงมา (`checkRefDocItems`, `trans_ref_check.go:52`)

## ข้อผิดพลาดที่พบบ่อยตามโค้ด

| ข้อความ | สาเหตุ | path:line |
|---|---|---|
| "กรุณาป้อน รหัสเจ้าหนี้" / "ไม่พบข้อมูล : ..." | ไม่กรอกหรือรหัสไม่มีใน master | `backend/internal/application/process/trans_validate.go:227`, `:232` |
| "กรุณาป้อนเลขที่ใบกำกับภาษี" / "กรุณาป้อนวันที่ใบกำกับภาษี" | เปิด `check_input_vat` | `backend/internal/application/process/trans_save_rules.go:142`, `:145` |
| "จำนวนเกินรายการสั่งซื้อ" | รับ/ตั้งหนี้ 12/310 เกินใบสั่งซื้อ | `backend/internal/application/process/trans_validate.go:295-296` |
| "ส่งคืนเกินจำนวน" | ส่งคืน 16/311 เกินจำนวนในใบที่อ้าง | `backend/internal/application/process/trans_validate.go:286`, `:292-293` |
| "ไม่พบสินค้าในเอกสารอ้างอิง" | รายการไม่ตรงใบอ้างอิง | `backend/internal/application/process/trans_ref_check.go:71` |
| "เลขที่ใบกำกับภาษีซ้ำ : ..." | เลขใบกำกับซ้ำกับเอกสารอื่นของผู้จำหน่ายเดียวกัน | `backend/internal/application/process/trans_tax_doc_no.go:18` |
| "วันที่เอกสาร ... ได้ถูกปิดงวดไปแล้ว หรือยังไม่ได้กำหนดงวดบัญชี" | ยังไม่สร้างงวดใน `erp_account_period` | `backend/internal/application/process/period.go:53-61` |

- `resolveChartAccount` ลองรหัสตามลำดับ (รหัสตรงตัว หรือรหัสลูก `รหัส-...`) ถ้าไม่พบเลยจะใช้รหัสตัวแรกเป็นทั้งรหัสและชื่อบัญชี จึงลง GL เป็นรหัสที่ไม่มีในผัง (`service.go:1766-1784`) ดู [[flow-new-company-setup]]
- ถ้ามี template ใน `erp_doc_format_gl` ระบบใช้ template ก่อนสูตรมาตรฐาน (`service.go:1580-1591`) ดู [[acc-gl-template-engine]] และ [[acc-gl-posting-standard]]
- ลดต้นทุนสินค้าด้วยต้นทุนเฉลี่ย ดู [[acc-inventory-cost-moving-average]] ส่วนยกเลิกเอกสาร ดู [[flow-cancel-edit-reversal]]

## ที่มาในโค้ด

- `backend/internal/application/process/trans_ref_import_lines.go:52` — `refImportSources` (โซ่ดึงเอกสาร)
- `backend/internal/application/process/trans_ref_import.go:34` — `refImportSpecs` ยอดคงเหลือให้ดึง ({12,6} หักจาก {7,12,310})
- `backend/internal/application/process/lookup_trans.go:140-171` — `refDocWhere`
- `backend/internal/application/process/trans_validate.go:43`, `:168`, `:216`, `:339` — ลำดับตรวจก่อนบันทึก
- `backend/internal/application/process/trans_save_rules.go:30`, `:53`, `:134` — ออปชันและกฎบันทึก
- `backend/internal/application/process/trans.go:267`, `:593` — `SaveTrans`, `rebuildTransDerived`
- `backend/internal/application/process/stock_rebuild.go:18`, `:26` — ธงที่เข้าสต็อก
- `backend/internal/application/process/service.go:1742-1756`, `:1786-1803`, `:1934-2007`, `:2170-2216` — GL มาตรฐานฝั่งซื้อ
- `backend/internal/application/process/trans_deposit.go:39-54`, `:145`, `:246` — มัดจำ/ล่วงหน้า
- `backend/internal/application/process/docs.go:119`, `:389-390`, `:604-628` — วางบิล/จ่ายชำระ/ยอดค้าง
- `frontend/account/tabs/transMenuMap.ts:60-499`, `:1349`, `:1378` — เมนูหน้าจอฝั่งซื้อ
- `frontend/account/transaction/UniversalTransScreen.tsx:2584` — `handleSave` แยกส่ง `/trans/save` หรือ `/doc/save`
