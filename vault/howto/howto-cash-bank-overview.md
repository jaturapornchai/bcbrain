---
title: "ภาพรวมระบบเงินสด ธนาคาร เช็ค และบัตรเครดิต"
tags: [howto, cash, bank, cheque]
aliases: ["ระบบการเงินทำอะไรได้บ้าง", "เมนูเงินสดธนาคารอยู่ไหน", "บันทึกเงินฝากธนาคาร", "จัดการเช็ครับเช็คจ่าย", "เงินสดย่อย", "รายได้อื่น ค่าใช้จ่ายอื่น", "บัตรเครดิตขึ้นเงิน", "เริ่มใช้ระบบเงินสดธนาคาร"]
sources: ["backend/internal/application/process/bcMenu.json:7518", "backend/internal/application/process/bcMenu.json:957", "frontend/account/tabs/transMenuMap.ts:1606", "frontend/account/tabs/transMenuMap.ts:1887", "frontend/account/tabs/transMenuMap.ts:1991", "frontend/account/tabs/transMenuMap.ts:2325"]
---
# ภาพรวมระบบเงินสด ธนาคาร เช็ค และบัตรเครดิต

**ใช้เมื่อ:** อยากรู้ว่าเรื่องเงินสด เงินฝากธนาคาร เช็ค และบัตรเครดิต ทำที่เมนูไหน และควรอ่านโน้ตไหนต่อ
**เมนู:** เงินสด/ธนาคาร (เอกสารประจำวัน) และ เริ่มต้น › ตั้งค่าระบบการเงินและธนาคาร (ข้อมูลตั้งต้น)
**ต้องมีก่อน:** ผังบัญชีและงวดบัญชีพร้อมใช้ ([[howto-gl-overview]])

## หน้าจอเอกสารใช้แบบเดียวกันทั้งหมด
- ทุกเมนูในกลุ่มนี้เปิดหน้าจอเอกสารแบบเดียวกัน ปุ่มด้านบนคือ "เพิ่มใหม่" "แก้ไข" "ลบ" "บันทึก" "พิมพ์ฟอร์ม / เลือกรูปแบบ"
- แท็บที่อาจเห็น: "รายละเอียดเพิ่มเติม" "ข้อมูลภาษี (VAT/WHT)" "การรับ/จ่ายชำระเงิน" "การลงบัญชี (GL)" แต่ละเมนูแสดงเฉพาะแท็บที่ใช้
- เมนูที่ขึ้นต้นด้วย "ยกเลิก" หรือ "บันทึกยกเลิก" เป็นหน้าจอยกเลิกเอกสาร ไม่ได้สร้างรายการใหม่

## 1. ตั้งค่าก่อนใช้งาน
- ธนาคาร สาขา ประเภทสมุด ตัวย่อ → [[howto-bank-setup]]
- สมุดเงินฝาก (บัญชีธนาคารของกิจการ) → [[howto-bank-passbook]]
- วงเงินสดย่อย → [[howto-cash-petty-cash-setup]]
- ประเภทรายได้ และประเภทค่าใช้จ่าย → [[howto-cash-income-expense-type-setup]]
- ประเภทบัตรเครดิต → [[howto-bank-credit-card]]
- ธนบัตร และรายละเอียดคูปอง → [[howto-cash-banknote-coupon-setup]]

## 2. เงินสด เงินสดย่อย รายได้และค่าใช้จ่ายอื่น
- ยอดยกมาเงินสด และเงินฝากธนาคารยกมา → [[howto-cash-beginning-balance]]
- รับ/เพิ่ม และ คืน/ลด วงเงินสดย่อย → [[howto-cash-petty-cash-topup-return]]
- รายได้อื่นๆ → [[howto-cash-other-income]]
- ค่าใช้จ่ายอื่นๆ → [[howto-cash-other-expense]]
- เพิ่มหนี้ และลดหนี้ ของรายได้อื่นและค่าใช้จ่ายอื่น → [[howto-cash-other-income-expense-adjust]]
- ยกเลิกเอกสารกลุ่มนี้ → [[howto-cash-cancel-docs]]

## 3. ธนาคาร
- ฝากเงิน ถอนเงิน → [[howto-bank-deposit-withdraw]]
- โอนเงินระหว่างธนาคาร → [[howto-bank-transfer]]
- ขึ้นเงิน PromptPay / QR (เมนู บันทึกขึ้นเงินwallet) → [[howto-bank-wallet-pass]]
- บัตรเครดิต: ทะเบียน ขึ้นเงิน ยกเลิก → [[howto-bank-credit-card]]
- แนบรูปภาพและไฟล์ให้เอกสาร → [[howto-bank-doc-attachment]]
- ยกเลิกเอกสารธนาคาร เช็ค และบัตรเครดิต → [[howto-bank-cancel-docs]]

## 4. เช็ค
- ทะเบียนเช็ครับ และเช็ครับยกมา → [[howto-cheque-received-register]]
- นำฝากเช็ค และเช็คผ่าน → [[howto-cheque-received-deposit-pass]]
- เช็ครับคืน เปลี่ยนเช็ค ตั้งหนี้ใหม่ ขาดสิทธิ์ → [[howto-cheque-received-return-renew]]
- ทะเบียนเช็คจ่าย และเช็คจ่ายยกมา → [[howto-cheque-paid-register]]
- เช็คจ่ายผ่าน คืน เปลี่ยน ขาดสิทธิ์ → [[howto-cheque-paid-manage]]

## แก้ปัญหา
- [[ts-cash-pay-incomplete]] · [[ts-cash-cancel-blocked]]
- [[ts-bank-transfer-same-book]] · [[ts-bank-transfer-dest-missing]]
- [[ts-cheque-register-readonly]] · [[ts-cheque-not-in-picker]]
- ปิดงวดแล้วบันทึกไม่ได้ → [[ts-common-period-closed]] · ไม่มีสิทธิ์ → [[ts-common-no-permission]]

## คำถามที่พบบ่อย
- [[faq-cash-petty-cash-spending]] · [[faq-cash-expense-labels-sale]] · [[faq-cash-multi-type-account]]
- [[faq-bank-transfer-fee]] · [[faq-bank-card-fee]]
- [[faq-cheque-status]] · [[faq-cheque-in-transit-account]]

## ดูต่อ
- รับเงินจากลูกค้าด้วยเช็คหรือบัตร → [[howto-ar-overview]] · จ่ายเจ้าหนี้ด้วยเช็ค → [[howto-ap-overview]]
- รายงานเงินสด ธนาคาร เช็ค → [[rpt-overview]]
- [[index]] · [[playbook-call-center]]
