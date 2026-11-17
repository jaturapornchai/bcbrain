---
title: กฎคำนวณและลงบัญชี GL สำหรับ Marketplace, เงินเดือน ม.33 (2569), DBD Taxonomy, e-VRT ภ.พ.10 และ Print Audit
tags: [doctypes, gl-posting, marketplace, payroll, sso, dbd-efiling, tourist-vat-refund, print-audit]
aliases: [MarketplaceReconcile GL, PayrollSsoPnd1 GL, AutoClassifyDbdTaxonomy, CalculateTouristVatRefund, VerifyPrintAuditChain]
sources:
  - backend/internal/application/process/marketplace_reconcile.go:1-1444
  - backend/internal/application/process/marketplace_abb_oauth.go:1-394
  - backend/internal/application/process/payroll_sso_pnd1.go:1-1177
  - backend/internal/application/process/dbd_efiling_taxonomy.go:1-569
  - backend/internal/application/process/tourist_vat_refund.go:1-252
  - backend/internal/application/process/public_bill_pay.go:1-767
  - backend/internal/application/process/print_audit.go:1-2071
---

# กฎคำนวณและลงบัญชี GL สำหรับ Marketplace, เงินเดือน ม.33 (2569), DBD Taxonomy, e-VRT ภ.พ.10 และ Print Audit

สรุปสูตรคำนวณ `*big.Rat` และโครงสร้างคู่บัญชีเดบิต–เครดิตของเวิร์กโฟลว์อัตโนมัติใน `backend/internal/application/process/`

---

## 1. Marketplace Reconciliation & Daily ABB (`marketplace_reconcile.go`, `marketplace_abb_oauth.go`)

- **สูตรยอดโอนสุทธิ**: `netPayout = grossSales - (refundAmount + platformFee + paymentFee + shippingDiff + adsFee + feeVatAmount + whtDeducted)` (ปัดครึ่งขึ้น 2 ตำแหน่ง)
- **ป้องกันนำเข้าซ้ำ**: คำนวณ SHA-256 `batch_hash` จาก `PLATFORM|sorted_order_ids` บันทึกลง `ar_marketplace_settlement` + `ar_marketplace_settlement_detail`
- **การลงบัญชีสมุดรายวัน (`trans_flag = 1999`)**:
  - **Dr** เงินฝากธนาคาร (`expectedPayout`) + **Dr** ค่าธรรมเนียมแพลตฟอร์ม/ชำระเงิน/โฆษณา + **Dr** ส่วนต่างค่าขนส่ง + **Dr** รับคืน/ส่วนลด (`refundAmount`) + **Dr** ภาษีซื้อค่าธรรมเนียม (`feeVatAmount`) + **Dr** ภาษีถูกหัก ณ ที่จ่าย (`whtDeducted`)
  - **Cr** รายได้จากการขาย (`grossSales`) *(หากยอดโอนสุทธิติดลบจะกลับด้านเป็น Cr ธนาคารอัตโนมัติ)*
- **Daily ABB (`ar_marketplace_daily_abb`)**: `net = RoundHalfUp(gross - refund, 2)`, `beforeVat = RoundHalfUp(net * 100 / 107, 2)`, `vat = net - beforeVat`

---

## 2. Payroll ประกันสังคม ม.33 เพดานขั้นบันได & ภ.ง.ด.1 (`payroll_sso_pnd1.go`)

- **เพดานฐานค่าจ้าง ม.33 (`resolveSsoStepCeiling`, ขั้นต่ำ `1,650.00`, อัตรา `5%` ปัดเป็นจำนวนเต็มบาท)**:
  - ปี ค.ศ. `< 2026` (`< 2569`): เพดาน `15,000` (สูงสุด `750` บาท)
  - ปี ค.ศ. `2026..2028` (`2569..2571`): เพดาน `17,500` (สูงสุด `875` บาท)
  - ปี ค.ศ. `2029..2031` (`2572..2574`): เพดาน `20,000` (สูงสุด `1,000` บาท)
  - ปี ค.ศ. `>= 2032` (`2575+`): เพดาน `23,000` (สูงสุด `1,150` บาท)
- **การลงบัญชีสมุดรายวัน (`trans_flag = 1999`, บันทึก `erp_payroll_run` / `erp_payroll_line`)**:
  - **Dr** เงินเดือนและค่าจ้าง (`totalGrossPay`) + **Dr** เงินสมทบประกันสังคมส่วนนายจ้าง (`totalEmployerSso`)
  - **Cr** เงินฝากธนาคาร/เงินสดจ่ายสุทธิ (`totalNetPay`) + **Cr** ประกันสังคมค้างจ่าย (`totalEmpSso + totalEmployerSso`) + **Cr** ภาษีหัก ณ ที่จ่าย ภ.ง.ด.1 ค้างจ่าย (`totalPnd1Tax`)

---

## 3. DBD Taxonomy Auto-Classification (`dbd_efiling_taxonomy.go`) & Tourist VAT Refund ภ.พ.10 (`tourist_vat_refund.go`)

- **`AutoClassifyDbdTaxonomy` (`gl_dbd_taxonomy_map`)**: จับคู่รหัสนำหน้าผังบัญชีอัตโนมัติ (`111->111000`, `112/113->112000`, `114/115->113000`, `11->119000`, `12/1->123000`, `21->211000`, `22/2->220000`, `31->310000`, `32/33/3->320000`, `4->410000`, `51->510000`, `52/53/5/6->520000`) พร้อมโอนกำไรสะสมระหว่างงวดเข้า `320000` และตรวจ `totalAssets == totalLiabilities + totalEquity`
- **`CalculateThaiTouristVatRefund`**: ยอดขั้นต่ำ `>= 2,000.00` บาท; ยอด `2,000..199,999.99` ใช้ตารางขั้นบันได `lookupPP10Tier`; ยอด `>= 200,000.00` คืน `RoundHalfUp(gross * 61 / 1000, 2)` (6.1%); ตั้ง flag `RequiresCustomsStampOver20k` (`>= 20,000`) และ `RequiresRevenueAirsideInspection` (สินค้าฟุ่มเฟือย `>= 40,000` หรือพกพา `>= 100,000`)

---

## 4. Public Bill Pay (`public_bill_pay.go`) & Print Audit Hash Chain (`print_audit.go`)

- **`confirmPublicBillSlip`**: ตรวจภาพสลิป (`<= 2.5 MB`), ถอด QR ด้วย `DecodeQRFromImageBase64` (Pure-Go Reed-Solomon ISO/IEC 18004), จัดสรรยอด `paidCash + wht` แบบ FIFO แล้วสร้างใบเสร็จรับเงิน `ap_ar_trans` (`trans_flag = 239`)
- **`RecordPrintAudit` / `VerifyPrintAuditChain`**: ผูกห่วงโซ่ `chain_hash = SHA256(prevChain|printUID|docKind|transFlag|DOC_NO|printSeq|totalAmount|printedBy|pdfSha|snapSha)` ลง `erp_print_audit_log` และตรวจความผิดปกติ 5 สถานะ: `UNSAVED_ATTEMPT`, `DELETED_AFTER_PRINT`, `CANCELLED_AFTER_PRINT`, `MODIFIED_AFTER_PRINT`, `REPRINT_ORIGINAL`

---

## ดูต่อที่เกี่ยวข้อง
- [[writes_table::tbl-ar-contract-marketplace]] · [[writes_table::tbl-gl-advanced]] · [[writes_table::tbl-auto-bill-and-print-audit]]
- [[exposes_api::api-inbound-handlers-workflows]]
- [[has_query::sql-marketplace-payroll-subledger-audit]]
