---
title: "ค้าส่งและตัวแทนจำหน่าย ใช้ BC Ai Account อย่างไร"
tags: [sales, business-type, wholesale]
aliases: ["ร้านค้าส่งใช้ได้ไหม", "ตัวแทนจำหน่ายใช้ได้ไหม", "ขายเชื่อ วางบิล เก็บเงิน", "ยี่ปั๊ว ซาปั๊ว", "ขายส่งให้ร้านค้า", "ดีลเลอร์"]
sources: ["backend/internal/application/process/bcMenu.json:4942", "backend/internal/application/process/bcMenu.json:4994", "backend/internal/application/process/bcMenu.json:5072", "backend/internal/application/process/bcMenu.json:6783", "backend/internal/application/process/bcMenu.json:7019", "backend/internal/application/process/bcMenu.json:7032", "backend/internal/application/process/trans_save_rules.go:486", "frontend/crm/CrmDashboard.tsx:553", "frontend/market/MarketDashboard.tsx:218", "backend/internal/application/process/trans_credit.go:201", "backend/internal/application/process/trans_deposit.go:47", "backend/internal/application/process/service.go:2320", "frontend/crm/CrmArCollectionCenter.tsx:187"]
---

# ค้าส่งและตัวแทนจำหน่าย

## ปัญหาที่เจอบ่อย

- ขายเชื่อหลายร้าน ตามวางบิลและเก็บเงินไม่ทัน ไม่รู้ว่าใครค้างเท่าไร
- เสนอราคาแล้วไม่รู้ว่าดีลไหนปิดได้
- สต็อกในโกดังกับในบัญชีไม่ตรงกัน

## ระบบที่ช่วย

| เรื่อง | ระบบหรือเมนู | อ่านต่อ |
|---|---|---|
| เสนอราคาถึงส่งของ | เมนูขาย ใบเสนอราคาขาย ใบสั่งจองสินค้า ใบสั่งขายสินค้า (มีขั้นอนุมัติ) ขายสินค้า/บริการ | [[howto-sale-overview]] |
| รับมัดจำหรือรับเงินล่วงหน้า | เมนูขาย รับเงินมัดจำ รับเงินล่วงหน้า (เงินรับล่วงหน้ายังนำไปหักในบิลขายไม่ได้ ดู [[howto-sale-advance-receipt]]) | [[sales-feature-account-core]] |
| ลูกหนี้ (ลูกค้าที่ค้างจ่ายเรา) | เมนูลูกหนี้ ทะเบียนลูกหนี้ ใบวางบิล รับชำระหนี้/ออกใบเสร็จรับเงิน | [[howto-ar-overview]] |
| วงเงินเครดิต (เพดานยอดค้างของลูกค้าแต่ละราย) | ตั้งวงเงินในทะเบียนลูกหนี้ แล้วเลือกให้ระบบเตือนหรือห้ามขายเกินวงเงิน (ใบสั่งจองและใบสั่งขายที่เกินวงเงินถูกพักไว้ แต่ยังไม่มีหน้าจออนุมัติวงเงิน และติ๊กแจ้งเตือนทำให้ใบสั่งถูกพักแทนการเตือน ดู [[howto-sale-credit-limit]]) | [[term-credit-limit]] |
| เช็ครับจากลูกค้า | ทะเบียนเช็ครับ (งานเช็คบางขั้น ขอให้เจ้าหน้าที่สาธิตกับข้อมูลจริงก่อนตัดสินใจ) | [[howto-cheque-received-register]] |
| ดูแลลูกค้าและดีล | CRM กระดานดีล คิวติดตามหนี้ เกรดลูกค้า (หลายหน้ายังเป็นตัวอย่าง และปุ่มทวงผ่าน LINE ยังไม่ส่งจริง) | [[sys-crm-overview]] |
| ให้ร้านลูกข่ายสั่งเอง | Market ตลาดค้าส่ง (รุ่นสาธิต) | [[sys-market-overview]] |
| สต็อกหลายคลัง | เมนูสินค้า หลายคลัง หลายหน่วยนับ โอนย้าย ตรวจนับ | [[howto-stock-overview]] |

## ไหลเข้าบัญชีอย่างไร

ใบขายสินค้าตั้งยอดลูกหนี้ ตัดสต็อก และลงบัญชีให้เอง เมื่อรับชำระหนี้ ยอดลูกหนี้ลดและบันทึกรับเงินเข้าเงินสดหรือธนาคาร ภาษีขายจากใบขายไปรวมในรายงานภาษีมูลค่าเพิ่ม ดู [[howto-tax-overview]]

CRM อ่านใบเสนอราคา ใบสั่งขาย และใบขายจากบัญชีมาแสดง แต่การสร้างดีลใน CRM ไม่ได้ออกเอกสารในบัญชี ส่วน Market รุ่นปัจจุบันยังไม่ลงบัญชีและไม่ตัดสต็อก ดู [[sales-current-limits]]

## คำถามที่ควรถามลูกค้า

- ขายเชื่อกี่เปอร์เซ็นต์ เครดิตกี่วัน วางบิลรอบไหน
- รับชำระเป็นเงินโอน เช็ค หรือเงินสด
- ราคาขายแยกตามกลุ่มลูกค้าหรือตามจำนวนไหม
- มีเซลส์ออกพบลูกค้าไหม ต้องการระบบติดตามดีลไหม
- ร้านลูกข่ายต้องการสั่งของออนไลน์เองไหม
- มีโกดังกี่แห่ง มีรถส่งของเองไหม (ถ้ามี ดู [[sales-by-business-warehouse-logistics]])

คำถามทั้งหมดดู [[sales-discovery-questions]]
