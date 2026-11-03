---
title: "รับชำระหนี้ (239) / จ่ายชำระหนี้ (19) ลงบัญชี GL ยังไง เช็ค โอน ภาษีหัก ไปไหน"
tags: [faq, gl, ar, ap, receipt, payment, cheque, wht]
aliases: ["รับชำระลงบัญชียังไง", "จ่ายชำระหนี้ GL", "receipt payment journal", "trans_flag 239", "trans_flag 19", "menu_ar_debt_billing", "menu_ap_debt_billing", "เช็ครับ 1122", "กำไรขาดทุนอัตราแลกเปลี่ยน"]
sources: ["backend/internal/application/process/service.go:1497", "backend/internal/application/process/service.go:2170", "backend/internal/application/process/service.go:1871", "backend/internal/application/process/service.go:1861", "backend/internal/application/process/gl_pay_other.go:17", "backend/internal/application/process/gl_template_rules.go:20"]
---
# รับชำระหนี้ (239) / จ่ายชำระหนี้ (19) ลงบัญชี GL ยังไง เช็ค โอน ภาษีหัก ไปไหน

**ตอบสั้น:** รับชำระ 239 = Dr เงินที่รับ (เงินสด/ธนาคาร/เช็ครับ/บัตร/ภาษีถูกหัก) / Cr ลูกหนี้ จ่ายชำระ 19 = Dr เจ้าหนี้ / Cr เงินที่จ่าย (เงินสด/ธนาคาร/เช็คจ่าย/ภาษีหัก ณ ที่จ่าย) ยอดแยกมาจากแท็บชำระเงิน `cb_trans`

## รายละเอียด
19/239 อยู่ใน `ap_ar_trans` ระบบดึงมาลง GL ด้วย `total_net_value` ถ้ามีรูปแบบ GL ใช้รูปแบบก่อน (DE = glRule29, EE = glRule25, ดู [[faq-gl-template-doc-format]]) ไม่มีจึงใช้เส้นมาตรฐาน ([[acc-gl-posting-standard]])

**ชุดรายการชำระเงิน (`payTenders`)** อ่านช่องเงินสด, ธนาคาร (โอน+wallet), เช็ค, บัตร จาก `cb_trans` ส่วนภาษีหักใช้ `total_tax_at_pay` ถ้าเป็น 0 ใช้ผลรวม `gl_wht_list.tax_value` ผลรวมทุกช่องต้องเท่ายอดเงินจึงแยกบรรทัด ไม่เท่าใช้เงินสดบรรทัดเดียว ถ้ามีแต่ภาษีหัก ระบบเติมเงินสด = ยอด − ภาษีหัก

| ช่อง | รับ (239) | จ่าย (19) |
|---|---|---|
| เงินสด | 1111/1110/1100 | เหมือนกัน |
| ธนาคาร | สมุดบัญชีที่เลือก หรือ 1112/1113/1111 | เหมือนกัน |
| เช็ค | 1122 | 2112 |
| บัตร | บัญชีลูกหนี้ | บัญชีธนาคาร |
| ภาษีหัก | 1153/1154/1152/2122 | 2122/2123/2120 |

รายได้/ค่าใช้จ่ายอื่นในแท็บชำระเงิน (`cb_trans_detail` doc_type 11 ค่าใช้จ่าย = Dr, 12 รายได้ = Cr) ปรับเข้ายอดเงินและลงตาม `gl_account_code` ของรายการ ([[acc-payment-tab]])

ส่วนต่างอัตราแลกเปลี่ยน: ยอดหนี้ = total + `lost_profit_exchange_amount` รับน้อย/จ่ายมาก → Dr 511030 ได้เพิ่ม → Cr 420040 ([[acc-fx-multi-currency]])

## ข้อควรระวัง
- รหัสที่ไม่มีในผัง ระบบใช้รหัสแรกของลิสต์ตรงๆ (เช่น 1122/2112) ดู [[faq-gl-not-balanced]]
- ลิสต์ภาษีถูกหักฝั่งรับมี 1154 ซึ่งเป็นรหัสแรกของลิสต์ภาษีซื้อ
- ประมวลผลใหม่ดึงเฉพาะ `is_cancel = 0` และข้ามเลขเอกสารที่มี GL บันทึกตรง (`trans_direct = 1`) การกลับรายการดู [[flow-cancel-edit-reversal]]

## ดูเพิ่ม
- [[doc-ar-receipt]]
- [[doc-ap-payment]]
- [[acc-cheque-transfer]]
- [[faq-wht-certificate-pnd]]
- [[faq-payment-tab-tenders]]

## ที่มาในโค้ด
- `backend/internal/application/process/service.go:1497` ดึง ap_ar_trans 19/239 ด้วย total_net_value
- `backend/internal/application/process/service.go:2170` case 19/239 และส่วนต่างอัตราแลกเปลี่ยน
- `backend/internal/application/process/service.go:1871` `payTenders`
- `backend/internal/application/process/service.go:1861` `money()` รวมรายได้/ค่าใช้จ่ายอื่น
- `backend/internal/application/process/gl_pay_other.go:17` `payOtherGL` doc_type 11/12
- `backend/internal/application/process/gl_template_rules.go:20` รหัสจอ → กฎรูปแบบ GL
