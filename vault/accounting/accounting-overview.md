---
title: "ภาพรวมระบบบัญชี BC AI Account (Accounting Overview)"
tags: [accounting, hub, overview]
aliases: ["ภาพรวมบัญชี", "flow บัญชี", "เอกสารลงบัญชีอย่างไร", "เอกสารไป GL", "accounting flow"]
sources: ["backend/internal/application/process/trans.go:267", "backend/internal/application/process/trans.go:510", "backend/internal/application/process/trans.go:593", "backend/internal/application/process/service.go:1007", "backend/internal/application/process/service.go:1378"]
---

# ภาพรวมระบบบัญชี BC AI Account

เอกสารทุกใบ (ซื้อ ขาย สต็อก เงินสด/ธนาคาร เช็ค มัดจำ) จะถูกบันทึกเป็น "ข้อมูลดิบ" (raw) ลง `ic_trans` / `ic_trans_detail` / `cb_trans` จากนั้นระบบจะ "คำนวณใหม่" (rebuild) ยอดสต็อก ต้นทุน และสมุดรายวัน GL ภายใน database transaction เดียวกัน หากขั้นใดล้มเหลว จะ rollback ทั้งเอกสาร
ตัวเลขเงินทุกตัวคำนวณด้วย `*big.Rat` และส่งต่อกันเป็น decimal string (ไม่ใช้ float)

## ทำงานอย่างไร

```
หน้าจอเอกสาร (trans_flag)
   |  SaveTrans  (trans.go:267)
   v
ตรวจก่อนบันทึก: งวดบัญชี, สิทธิ์แก้ไข, เลขใบกำกับซ้ำ, ห้ามติดลบ, วงเงินเครดิต
   v
saveTransTx (trans.go:510)  = ลบแถวเดิมของเอกสาร แล้ว insert ใหม่
   ic_trans + ic_trans_detail + VAT/WHT + cb_trans (แท็บจ่าย) + มัดจำ
   v
rebuildTransDerived (trans.go:593)
   |- rebuildStockTx      -> balance_qty, average_cost, sum_of_cost  (service.go:1007)
   |- SyncTransferPair    -> 422 โอนเงินออก สร้างคู่ 420
   |- rebuildGLTx         -> gl_journal / gl_journal_detail          (service.go:1378)
   |     ใช้ template (erp_doc_format_gl) ก่อน ถ้าไม่มีจึงใช้ standard
   |- syncStockTransferIn -> 72 โอนออก / 70 โอนเข้า
   '- RebuildChequeStatus -> cb_chq_list.status
   v
COMMIT  (ล้มที่ขั้นใดก็ rollback ทั้งหมด)
```

หลักการสำคัญ (ตามที่ comment ในโค้ดเรียกว่า "AGENTS.md rule 9" raw vs derived)
- ข้อมูลที่ผู้ใช้คีย์ = raw (บรรทัดรายการ, แท็บจ่าย, WHT, VAT ที่คีย์เอง)
- ยอดคงเหลือ, ต้นทุนเฉลี่ย, GL อัตโนมัติ, VAT แถวแรก, สถานะเช็ค, ยอดมัดจำคงเหลือ = derived คำนวณใหม่ได้เสมอ (idempotent)

## โน้ตในหมวดนี้

เอกสารและการบันทึก
- [[acc-trans-flag-map]] รหัสชนิดเอกสาร `trans_flag` และทิศทางสต็อก `calc_flag`
- [[acc-transaction-save-flow]] ลำดับการบันทึกเอกสาร, lock, transaction
- [[acc-transaction-delete-edit]] การลบ/แก้ไข/ล็อกเอกสาร
- [[acc-credit-limit-save-rules]] กฎตรวจก่อนบันทึก (ต่ำกว่าทุน, ติดลบ, lot, วงเงินเครดิต, ยอดอ้างอิง)
- [[acc-period-close]] การปิดงวดบัญชี

การคำนวณยอดและภาษี
- [[acc-transcalc-totals]] ยอดท้ายบิล VAT ส่วนลด (vatCalc) และ VAT ระดับบรรทัด
- [[acc-rounding-decimal]] การปัดเศษ, scale, decimal และจุดเสี่ยง
- [[acc-vat-register-wht]] ทะเบียนภาษีซื้อ/ขาย และภาษีหัก ณ ที่จ่าย
- [[acc-fx-multi-currency]] หลายสกุลเงินและกำไร/ขาดทุนจากอัตราแลกเปลี่ยน

สต็อกและต้นทุน
- [[acc-inventory-stock-rebuild]] การคำนวณยอดคงเหลือ และหน่วยนับขนาน (qty_2)
- [[acc-inventory-cost-moving-average]] ต้นทุนถัวเฉลี่ย, lock cost, สถานะ FIFO
- [[acc-stock-special-docs]] ยอดยกมาสินค้า (54), ปรับปรุง lot, ตรวจนับ (76) และ lot อัตโนมัติ

บัญชีแยกประเภท (GL)
- [[acc-gl-rebuild]] กระบวนการสร้าง GL ใหม่ของเอกสาร
- [[acc-gl-posting-standard]] ตาราง Dr/Cr มาตรฐานแยกตาม flag
- [[acc-gl-template-engine]] รูปแบบการลงบัญชีจาก `erp_doc_format_gl`

เงิน เช็ค มัดจำ สินทรัพย์
- [[acc-payment-tab]] แท็บรับ/จ่ายเงิน, รายได้/ค่าใช้จ่ายอื่น, ตัดชำระบิล
- [[acc-deposit-advance]] เงินมัดจำ/เงินล่วงหน้า
- [[acc-cheque-transfer]] เช็ครับ/จ่าย, บัตรเครดิต, โอนเงินระหว่างบัญชี
- [[acc-fixed-asset-depreciation]] ค่าเสื่อมราคาสินทรัพย์ (1801)
- [[acc-fixed-asset-sale]] ขายสินทรัพย์ (1802)

## จุดเสี่ยงหลักที่พบ (สรุป)
- ต้นทุน FIFO มีฟังก์ชันแต่ไม่ถูกเรียกใช้: ระบบใช้ Moving Average เสมอ ดู [[acc-inventory-cost-moving-average]]
- หลายจุด hardcode scale 2 และ VAT 7% ดู [[acc-rounding-decimal]]
- GL แบบ standard ไม่ตรวจงวดปิด และสร้างผังบัญชีให้อัตโนมัติ ดู [[acc-gl-rebuild]]
- GL ของ IA (66) ไม่เท่ากับมูลค่าสต็อก (known gap ที่ระบุไว้ในโค้ด) ดู [[acc-gl-posting-standard]]

## ที่มาในโค้ด
- `backend/internal/application/process/trans.go:267` SaveTrans
- `backend/internal/application/process/trans.go:510` saveTransTx
- `backend/internal/application/process/trans.go:593` rebuildTransDerived
- `backend/internal/application/process/service.go:1007` rebuildStockTx
- `backend/internal/application/process/service.go:1378` rebuildGLTx

## ดูเพิ่ม
- [[index]]
- [[backend-overview]]
- [[process-overview]]
- [[standards-overview]]
- [[frontend-overview]]
