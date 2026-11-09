---
title: "อภิธานศัพท์ BC Ai Account: คำศัพท์บัญชีและเอกสารแบบเข้าใจง่าย"
tags: [term, general]
aliases: ["อภิธานศัพท์", "คำศัพท์", "glossary", "ศัพท์บัญชี", "คำนี้แปลว่าอะไร", "คืออะไร", "ศัพท์ในโปรแกรม"]
sources: ["backend/internal/application/process/bcMenu.json:180", "backend/internal/application/process/bcMenu.json:9373", "frontend/src/config/help/data/trans.json:99"]
---
# อภิธานศัพท์ (คำศัพท์ในระบบ BC)

## ความหมายแบบบ้านๆ
รวมคำที่ลูกค้าถามบ่อย อธิบายแบบชาวบ้าน พร้อมบอกว่าในโปรแกรมอยู่เมนูไหน และระบบทำอะไรให้เอง
ใช้คู่กับ [[playbook-call-center]] เมื่อต้องอธิบายคำให้ลูกค้าฟัง

## ซื้อ-ขาย
- [[term-quotation]] ใบเสนอราคา
- [[term-sale-order]] ใบสั่งจอง / ใบสั่งขาย
- [[term-purchase-requisition]] ใบขอซื้อ
- [[term-purchase-order]] ใบสั่งซื้อ
- [[term-goods-receipt]] รับสินค้า / ซื้อสินค้า
- [[term-credit-cash-sale]] ขายสด / ขายเชื่อ
- [[term-tax-invoice]] ใบกำกับภาษี
- [[term-approve]] อนุมัติเอกสาร
- ดูขั้นตอน: [[howto-sale-overview]], [[howto-buy-overview]]

## ลูกหนี้-เจ้าหนี้
- [[term-ar-customer]] ลูกหนี้ / ลูกค้า
- [[term-ap-supplier]] เจ้าหนี้ / ผู้จำหน่าย
- [[term-receipt]] ใบเสร็จรับเงิน / รับ-จ่ายชำระหนี้
- [[term-billing-note]] ใบวางบิล
- [[term-set-debt]] ตั้งหนี้
- [[term-credit-debit-note]] ใบลดหนี้ / ใบเพิ่มหนี้
- [[term-deposit]] เงินมัดจำ
- [[term-advance-payment]] เงินล่วงหน้า
- [[term-credit-limit]] วงเงินเครดิต
- [[term-credit-days-due-date]] เครดิตเทอม / วันครบกำหนด
- [[term-loyalty-points]] แต้มสะสม / สมาชิก
- ดูขั้นตอน: [[howto-ar-overview]], [[howto-ap-overview]]

## ภาษี
- [[term-vat]] ภาษีมูลค่าเพิ่ม (VAT)
- [[term-input-output-vat]] ภาษีซื้อ / ภาษีขาย
- [[term-vat-not-due]] ภาษีไม่ถึงกำหนด
- [[term-wht]] ภาษีหัก ณ ที่จ่าย
- [[term-tax-id-branch]] เลขประจำตัวผู้เสียภาษี / สาขา
- ดูขั้นตอน: [[howto-tax-overview]]

## สินค้า-คลัง
- [[term-item-type]] ประเภทสินค้า
- [[term-cost-method]] วิธีคิดต้นทุน
- [[term-warehouse-location]] คลัง / ที่เก็บ
- [[term-unit]] หน่วยนับ
- [[term-lot-serial-expire]] ล็อต / Serial / วันหมดอายุ
- [[term-stock-issue-transfer]] เบิก / โอนสินค้า
- [[term-stock-count-adjust]] ตรวจนับ / ปรับปรุงสต็อก
- [[term-landed-cost]] ต้นทุนแฝง / ต้นทุนนำเข้า
- ดูขั้นตอน: [[howto-stock-overview]]

## เงินสด-ธนาคาร-เช็ค
- [[term-cheque]] เช็ครับ / เช็คจ่าย
- [[term-petty-cash]] เงินสดย่อย
- [[term-currency-fx]] สกุลเงิน / อัตราแลกเปลี่ยน
- [[term-other-income-expense]] รายได้อื่น / ค่าใช้จ่ายอื่น
- ดูขั้นตอน: [[howto-cash-bank-overview]], [[howto-setup-currency]]

## บัญชี-งบ
- [[term-chart-of-accounts]] ผังบัญชี
- [[term-debit-credit]] เดบิต / เครดิต
- [[term-journal-voucher]] ข้อมูลรายวัน / ใบสำคัญ
- [[term-posting]] ผ่านรายการ / ประมวลผลลงบัญชี
- [[term-accounting-period]] งวดบัญชี / ปิดงวด
- [[term-trial-balance]] งบทดลอง / บัญชีแยกประเภท
- [[term-financial-statements]] งบดุล / งบกำไรขาดทุน
- [[term-depreciation]] สินทรัพย์ถาวร / ค่าเสื่อมราคา
- ดูขั้นตอน: [[howto-gl-overview]], [[howto-asset-overview]], [[rpt-overview]]

## ทั่วไป
- [[term-opening-balance]] ยอดยกมา
- [[term-doc-no]] เลขที่เอกสาร / รูปแบบเลขที่
- [[term-doc-ref]] เอกสารอ้างอิง / ดึงเอกสารต้นทาง
- [[term-cancel-doc]] ยกเลิกเอกสาร / คืนสถานะ
- ดูขั้นตอน: [[howto-doc-edit-cancel-delete]], [[start-first-day]]

## ข้อควรรู้
- อัตราภาษีและกำหนดยื่นตามกฎหมาย ไม่อยู่ในอภิธานศัพท์นี้ เรื่องข้อกฎหมายให้ปรึกษาผู้สอบบัญชี/สรรพากร
- ราคาและแพ็กเกจ สอบถามฝ่ายขาย

## ดูต่อ
- [[index]]
- [[sys-account-overview]]
- [[playbook-call-center]]
