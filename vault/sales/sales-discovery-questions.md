---
title: "คำถามที่ควรถามลูกค้า เพื่อเลือกระบบให้ตรงธุรกิจ"
tags: [sales, discovery]
aliases: ["ถามลูกค้าอะไรบ้าง", "คำถามสำรวจความต้องการ", "เลือกระบบให้ลูกค้า", "ลูกค้าควรใช้ระบบไหน", "สำรวจธุรกิจลูกค้า", "เก็บความต้องการ"]
sources: ["backend/internal/application/process/bcMenu.json:4", "backend/internal/application/process/bcMenu.json:4930", "backend/internal/application/process/bcMenu.json:3820", "frontend/src/config/schemas/icMasterSchemas.ts:458", "frontend/account/admin/screens/DataAccessScreen.tsx:221", "frontend/pos/README.md:1", "frontend/autocare/AutoCareWorkspace.tsx:1", "frontend/src/app/etax/page.tsx:5", "frontend/src/config/editionConfig.ts:17", "frontend/src/config/schemas/erpUser.ts:65", "backend/internal/application/process/trans_credit.go:201", "backend/internal/application/process/trans_deposit.go:47", "frontend/src/config/schemas/erpOption/tab4Sale.ts:386", "backend/internal/application/process/service.go:1772"]
---

# คำถามที่ควรถามลูกค้า

ถามทีละ 2-3 ข้อ ไม่ต้องถามครบทุกข้อ เลือกตามที่ลูกค้าเล่า แล้วจับคู่คำตอบกับระบบตามตาราง ลำดับการคุยดูที่ [[playbook-sales]]

## ธุรกิจและโครงสร้าง

| ถาม | ถ้าลูกค้าตอบว่า | หมายความว่า |
|---|---|---|
| ทำธุรกิจอะไร ขายอะไร | ร้านค้าปลีก / ค้าส่ง / อู่ / บริการ / ขายออนไลน์ | เปิดโน้ตตามประเภท [[sales-by-business-retail]] [[sales-by-business-wholesale]] [[sales-by-business-autocare]] [[sales-by-business-service]] [[sales-by-business-online-line]] |
| มีกี่บริษัท | มากกว่า 1 | แยกเป็นฐานข้อมูลต่อบริษัท จำนวนตามแพ็กเกจ สอบถามฝ่ายขาย |
| มีกี่สาขา | มากกว่า 1 | เปิดใช้ระบบสาขา [[howto-setup-branch]] |
| ใช้งานกี่คน แยกหน้าที่อย่างไร | หลายคน หลายแผนก | เชิญพนักงานด้วยอีเมลบัญชี Google แล้วกำหนดสิทธิ์รายหน้าจอ [[faq-general-users-and-roles]] (สิทธิ์ละเอียดในจอพนักงานและกลุ่มพนักงาน ขอให้เจ้าหน้าที่สาธิตก่อน [[howto-setup-staff]] [[howto-setup-user-group]]) |
| ใครทำบัญชีและปิดงบ | ทำเอง / สำนักงานบัญชี | ต้องใช้หมวดบัญชีแยกประเภท ซึ่งขึ้นกับรุ่น [[faq-gl-starter-no-gl]] |

## การขายและการเก็บเงิน

| ถาม | ถ้าลูกค้าตอบว่า | หมายความว่า |
|---|---|---|
| มีหน้าร้านไหม | มี | POS [[sales-feature-pos]] |
| ขายเชื่อไหม เครดิตกี่วัน | ขายเชื่อ | เมนูลูกหนี้ ใบวางบิล รับชำระ วงเงินเครดิต (ใบสั่งที่เกินวงเงินถูกพักไว้ แต่ยังไม่มีหน้าจออนุมัติวงเงิน) [[howto-ar-overview]] [[term-credit-limit]] [[howto-sale-credit-limit]] |
| เสนอราคาก่อนขายไหม | ใช่ | ใบเสนอราคา ใบสั่งขาย [[howto-sale-overview]] และ CRM [[sys-crm-overview]] |
| รับมัดจำหรือเงินล่วงหน้าไหม | ใช่ | เมนูขาย รับเงินมัดจำ รับเงินล่วงหน้า (เงินรับล่วงหน้ายังนำไปหักในบิลขายไม่ได้) [[sales-feature-account-core]] [[howto-sale-advance-receipt]] |
| รับเงินช่องทางไหน | โอน พร้อมเพย์ เช็ค บัตร | เมนูเงินสด/ธนาคาร [[howto-cash-bank-overview]] |
| ขายผ่าน LINE หรือออนไลน์ไหม | ใช่ | ระบบที่ตรงโจทย์ยังเป็นรุ่นสาธิต บอกตรงๆ [[sales-by-business-online-line]] |

## การซื้อและสต็อก

| ถาม | ถ้าลูกค้าตอบว่า | หมายความว่า |
|---|---|---|
| มีสต็อกสินค้าไหม กี่รายการ | มี | เมนูสินค้า [[howto-stock-overview]] |
| มีกี่คลัง มีรถส่งของไหม | หลายคลัง / มีรถ | [[sales-by-business-warehouse-logistics]] |
| มีสินค้าตามล็อต เลขประจำเครื่อง หรือหลายหน่วยนับไหม | มี | รองรับในเมนูสินค้า [[howto-stock-overview]] |
| ต้องอนุมัติใบสั่งซื้อไหม | ต้อง | ใบเสนอซื้อ ใบสั่งซื้อ มีเอกสารอนุมัติ ถ้าต้องการบังคับอนุมัติก่อนพิมพ์หรือก่อนอ้างอิง ขอให้เจ้าหน้าที่สาธิตก่อน [[howto-buy-overview]] |
| คิดต้นทุนแบบไหน | ถัวเฉลี่ย / เข้าก่อนออกก่อน | ระบบคิดถัวเฉลี่ยเคลื่อนที่อย่างเดียว [[faq-stock-cost-method]] |

## ภาษีและเอกสาร

| ถาม | ถ้าลูกค้าตอบว่า | หมายความว่า |
|---|---|---|
| จด VAT (ภาษีมูลค่าเพิ่ม) แล้วหรือยัง | จดแล้ว | รายงานภาษีมูลค่าเพิ่ม [[howto-tax-vat-report]] |
| หัก ณ ที่จ่าย หรือถูกหักบ่อยไหม | บ่อย | [[howto-tax-wht-entry]] [[howto-tax-wht-export]] |
| ต้องส่งใบกำกับภาษีอิเล็กทรอนิกส์ (e-Tax) ไหม | ต้อง | รุ่นปัจจุบันยังไม่ส่งถึงกรมสรรพากรจริง ส่งต่อฝ่ายขาย [[sales-feature-etax]] |
| ใช้แบบฟอร์มเอกสารพิมพ์ของตัวเองไหม | ใช่ | ผู้ดูแลระบบปรับแบบฟอร์มได้ [[howto-setup-form-designer]] |
| ซื้อขายเงินตราต่างประเทศไหม | ใช่ | ระบบหลายสกุลเงิน [[howto-setup-currency]] |

## ระบบเดิมและข้อมูลเดิม

| ถาม | ถ้าลูกค้าตอบว่า | หมายความว่า |
|---|---|---|
| ตอนนี้ใช้โปรแกรมอะไร หรือใช้ Excel | มีข้อมูลเดิม | ตั้งยอดยกมาโดยบันทึกในโปรแกรม [[howto-stock-opening-balance]] [[howto-ap-opening-balance]] นำเข้าจากไฟล์ได้เฉพาะผังบัญชีและราคาสินค้า [[faq-general-import-old-data]] บริการย้ายข้อมูล ส่งต่อฝ่ายขาย |
| จะเริ่มใช้ตั้งแต่วันไหน | มีวันที่ชัด | จดไว้ส่งต่อฝ่ายขาย อย่ารับปากวันติดตั้ง |
| ต้องการให้ AI ภายนอกอ่านข้อมูลไหม | ต้องการ | รหัสเชื่อมต่อแบบอ่านอย่างเดียว [[howto-setup-mcp-token]] |

## งานเฉพาะทาง

| ถาม | ถ้าลูกค้าตอบว่า | หมายความว่า |
|---|---|---|
| ซ่อมรถหรือขายยางไหม | ใช่ | [[sales-by-business-autocare]] |
| เป็นร้านขายยาไหม | ใช่ | มีรายงานขายยา ขย.8 และ ขย.13 [[rpt-so-sales-summary]] |
| เจ้าของอยากดูตัวเลขบนจอเดียวไหม | ใช่ | แดชบอร์ดผู้บริหาร [[sales-feature-dashboard-ai]] |

คำตอบที่ไม่ตรงกับระบบใดเลย หรือเป็นความต้องการพิเศษ ให้จดไว้แล้วส่งต่อตาม [[sales-handoff]] ฟีเจอร์ที่ยังไม่มีดู [[sales-current-limits]]
