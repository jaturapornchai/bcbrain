---
title: "ภาพรวมชุดโปรแกรม BC Ai Account สำหรับลูกค้าที่กำลังตัดสินใจซื้อ"
tags: [sales, overview]
aliases: ["BC Ai Account คืออะไร", "โปรแกรมนี้ทำอะไรได้บ้าง", "มีระบบอะไรบ้าง", "สนใจซื้อโปรแกรมบัญชี", "แนะนำโปรแกรมให้หน่อย", "เหมาะกับธุรกิจเราไหม"]
sources: ["backend/internal/application/process/bcMenu.json:4", "backend/internal/application/process/bcMenu.json:4930", "frontend/shared/layout/SystemPortalScreen.tsx:144", "frontend/shared/layout/Header.tsx:124", "frontend/src/config/editionConfig.ts:17", "backend/internal/adapter/inbound/http/dashboard/handler.go:150-160", "backend/internal/adapter/inbound/http/ai/handler.go:470", "backend/internal/adapter/inbound/http/etax/handler.go:337", "frontend/pos/lib/ui/widgets/receipt_dialog.dart:143"]
---

# ภาพรวมชุดโปรแกรม BC Ai Account

BC Ai Account เป็นโปรแกรมบัญชีและบริหารงานขายสำหรับกิจการไทยขนาดเล็กถึงกลาง ใช้งานผ่านเว็บเบราว์เซอร์ หัวใจคือระบบบัญชีที่ครอบคลุมงานขาย ลูกหนี้ (ลูกค้าที่ค้างจ่ายเรา) ซื้อ เจ้าหนี้ (ผู้ขายที่เราค้างจ่าย) สต็อก เงินสดธนาคาร ทรัพย์สิน บัญชีแยกประเภท (สมุดบัญชีที่แยกยอดตามผังบัญชี) และรายงานภาษี เอกสารซื้อขายที่บันทึกจะตัดสต็อกและลงบัญชีให้เอง รอบๆ ระบบบัญชีมีระบบเสริม เช่น ขายหน้าร้าน (POS) งานอู่ซ่อมรถ (AutoCare) แดชบอร์ดผู้บริหาร และผู้ช่วย AI ระบบเสริมบางตัวยังเป็นรุ่นสาธิต ให้บอกลูกค้าตรงๆ ตามช่อง "สถานะตอนนี้" ในตาราง และค้น [[sales-current-limits]] ก่อนรับปากฟีเจอร์ใดก็ตาม

## ระบบทั้งหมดในชุด

| ระบบ | ช่วยเรื่องอะไร | สถานะตอนนี้ | อ่านต่อ |
|---|---|---|---|
| ระบบบัญชี | บันทึกขาย ซื้อ รับจ่ายเงิน สต็อก ลงบัญชีอัตโนมัติ ออกรายงานภาษีและงบการเงิน | ใช้งานจริง บางตัวเลือกบนจอยังไม่มีผล ส่วนตัวเลขงบการเงิน ภาษี และการปิดงวด ขอให้เจ้าหน้าที่สาธิตกับข้อมูลจริงก่อนตัดสินใจ | [[sys-account-overview]] · [[sales-feature-account-core]] |
| ขายหน้าร้าน POS | แอปแคชเชียร์ ขายได้แม้เน็ตหลุด บิลเข้าบัญชีเอง | ใช้งานจริง บางฟังก์ชันยังไม่มี เช่น พิมพ์ใบเสร็จออกเครื่องพิมพ์ แบ่งจ่ายหลายวิธีในบิลเดียว คืนสินค้าบางส่วน | [[sys-pos-overview]] · [[sales-feature-pos]] |
| AutoCare | งานอู่ซ่อมรถและร้านยาง ตั้งแต่รับรถถึงปิดบิล | ใช้งานได้ หลายส่วนยังเป็นรุ่นสาธิต | [[sys-autocare-overview]] · [[sales-feature-autocare]] |
| e-Tax | รวมเอกสารภาษีจากหลายระบบ สรุปภาษีขาย ภาษีซื้อ หัก ณ ที่จ่าย | ยังไม่ส่งข้อมูลถึงกรมสรรพากรจริง การประทับเวลาและการอ่านบิลจากรูปยังเป็นค่าจำลอง | [[sys-etax-overview]] · [[sales-feature-etax]] |
| WMS คลังสินค้า | หยิบ แพ็ค ส่ง ตรวจนับตามชั้นวาง | ส่วนใหญ่เป็นรุ่นสาธิต | [[sys-wms-overview]] · [[sales-feature-wms-tms-procure]] |
| TMS ขนส่ง | ทริปส่งของ รูปถ่ายยืนยันการส่ง ทะเบียนรถ งานซ่อมบำรุงรถ | ส่วนใหญ่เป็นรุ่นสาธิต | [[sys-tms-overview]] · [[sales-feature-wms-tms-procure]] |
| Procure จัดซื้อ | ขอราคาเทียบผู้ขาย ใบสั่งซื้อ รับของ ตรวจเทียบเอกสาร | ส่วนใหญ่เป็นรุ่นสาธิต | [[sys-procure-overview]] · [[sales-feature-wms-tms-procure]] |
| CRM | ดูแลลูกค้า กระดานดีลการขาย ติดตามหนี้ | อ่านข้อมูลขายจริง หลายหน้ายังเป็นตัวอย่าง | [[sys-crm-overview]] · [[sales-feature-crm-lineoa-market]] |
| LINE OA | หน้าจอแชทลูกค้าที่ AI ช่วยตอบและร่างเอกสารขาย | รุ่นจำลอง ยังไม่ต่อ LINE จริง | [[sys-lineoa-overview]] · [[sales-feature-crm-lineoa-market]] |
| Market ตลาดค้าส่ง | ร้านลูกค้าสั่งของออนไลน์ ราคาตามระดับ บัตรกำนัล | รุ่นสาธิต ยังไม่ลงบัญชีและไม่ตัดสต็อก | [[sys-market-overview]] · [[sales-feature-crm-lineoa-market]] |
| แดชบอร์ดผู้บริหาร | สรุปตัวเลขธุรกิจบนจอเดียว เปิดบนทีวีได้ | ใช้ข้อมูลจริงบางส่วน ยอดขายยอดซื้อยังนับเอกสารที่ยกเลิก และบางตัวเป็นค่าคงที่ | [[sys-dashboard-overview]] · [[sales-feature-dashboard-ai]] |
| ผู้ช่วย AI | ถามข้อมูลบริษัทเป็นภาษาไทย ได้คำตอบเป็นรายงาน | ใช้ข้อมูลจริง อ่านอย่างเดียว คำถามและสรุปตัวเลขถูกส่งไปประมวลผลภายนอก ยังปิดการส่งสรุปตัวเลขไม่ได้ | [[sys-ai-overview]] · [[sales-feature-dashboard-ai]] |
| 3D Monitor TV | แผนที่ประเทศไทย 3 มิติสำหรับจอในออฟฟิศ | จุดบนแผนที่ใช้ชุดข้อมูลของหน้าเอง | [[sys-monitormap-overview]] |
| 3D จอพนักงาน | ดูว่าผู้ใช้แต่ละคนเปิดหน้าจอไหนอยู่ | ใช้งานได้ | [[sys-workmonitor-overview]] |
| 3D Warning | บันทึกการแก้ข้อมูลของพนักงานและให้คะแนนความเสี่ยง | ใช้งานได้ เป็นเครื่องมือช่วยดู ไม่ใช่หลักฐานชี้ขาด | [[sys-fraudwarning-overview]] |

## เหมาะกับใคร

- กิจการที่ต้องทำบัญชีและภาษีเอง ทั้งที่จดและยังไม่จดภาษีมูลค่าเพิ่ม (VAT)
- ร้านค้าปลีกที่มีหน้าร้าน → [[sales-by-business-retail]]
- ค้าส่งและตัวแทนจำหน่ายที่ขายเชื่อ → [[sales-by-business-wholesale]]
- อู่ซ่อมรถ ร้านยาง ศูนย์บริการรถ → [[sales-by-business-autocare]]
- กิจการที่มีคลังสินค้าหรือรถส่งของ → [[sales-by-business-warehouse-logistics]]
- กิจการที่ขายออนไลน์หรือผ่าน LINE → [[sales-by-business-online-line]]
- บริษัทบริการและสำนักงาน → [[sales-by-business-service]]

เมนูที่เห็นขึ้นกับรุ่นของโปรแกรม เช่น บางรุ่นไม่มีหมวดบัญชีแยกประเภทและทรัพย์สิน (ดู [[faq-gl-starter-no-gl]]) รายละเอียดรุ่น ราคา และแพ็กเกจ สอบถามฝ่ายขาย

## โน้ตขายอื่นๆ

- คำถามที่ลูกค้าถามบ่อยก่อนซื้อ → [[sales-faq-before-buy]]
- คำถามที่ควรถามลูกค้าเพื่อเลือกระบบ → [[sales-discovery-questions]]
- สิ่งที่รุ่นปัจจุบันยังไม่มี → [[sales-current-limits]]
- เมื่อไรต้องส่งต่อฝ่ายขาย และต้องเก็บข้อมูลอะไร → [[sales-handoff]]
- ความสามารถแต่ละด้าน → [[sales-feature-account-core]] · [[sales-feature-etax]] · [[sales-feature-pos]] · [[sales-feature-autocare]] · [[sales-feature-wms-tms-procure]] · [[sales-feature-crm-lineoa-market]] · [[sales-feature-dashboard-ai]]
- วิธีคุยกับลูกค้าในบทบาทผู้ช่วยขาย → [[playbook-sales]]
