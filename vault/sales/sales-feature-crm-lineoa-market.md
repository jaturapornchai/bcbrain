---
title: "ระบบ CRM แชท LINE OA และตลาดค้าส่ง Market มีอะไรให้บ้าง"
tags: [sales, feature, crm, lineoa, market]
aliases: ["มีระบบดูแลลูกค้าไหม", "ต่อ LINE OA ได้ไหม", "ร้านลูกค้าสั่งของออนไลน์ได้ไหม", "ระบบ CRM ใช้ได้จริงไหม", "ขายผ่านแชท", "ระบบสั่งของค้าส่ง"]
sources: ["frontend/src/app/crm/page.tsx:6", "frontend/crm/CrmDashboard.tsx:553", "frontend/src/app/lineoa/page.tsx:5-16", "frontend/lineoa/LineOaChatStudio.tsx:1906-1923", "frontend/market/MarketDashboard.tsx:218", "frontend/src/app/market/page.tsx:5", "backend/internal/adapter/inbound/http/market/handler.go:273", "frontend/crm/CrmDashboard.tsx:1228", "frontend/crm/CrmArCollectionCenter.tsx:187", "backend/internal/adapter/inbound/http/crm/handler.go:1000", "backend/internal/adapter/inbound/http/crm/handler.go:1135", "frontend/src/app/api/lineoa/route.ts:687", "frontend/market/MarketDashboard.tsx:524", "frontend/market/MarketDashboard.tsx:3545", "backend/internal/adapter/inbound/http/market/handler.go:777"]
---

# ระบบ CRM แชท LINE OA และตลาดค้าส่ง Market

สามระบบนี้เกี่ยวกับการดูแลลูกค้าและช่องทางขาย ระบบ CRM อ่านข้อมูลขายจริงจากบัญชี ส่วนแชท LINE OA และ Market **ยังเป็นรุ่นสาธิต** ให้บอกลูกค้าตรงๆ

## CRM ดูแลลูกค้า

ภาพรวมดู [[sys-crm-overview]]

- กระดานดีลการขาย 4 ขั้น ดู [[howto-crm-deal-board]]
- โปรไฟล์ลูกค้า 360° ประวัติเอกสาร จดบันทึกการเข้าพบ (บางแท็บในโปรไฟล์ยังมีข้อมูลของลูกค้ารายอื่นปน และฟอร์มเข้าพบมีข้อความตัวอย่าง ดู [[howto-crm-customer-visit-note]])
- คิวติดตามหนี้ลูกค้า นัดชำระ (วันนัดชำระยังเป็นวันที่ตายตัว และปุ่มทวงผ่าน LINE ยังไม่ได้ส่งจริงแต่บันทึกว่าส่งแล้ว) ดู [[howto-crm-ar-collection]]
- แคมเปญส่งเสริมการขาย แต้มและเงินคืนสำหรับลูกค้าค้าส่ง (ตัวเลขผลลัพธ์แคมเปญเป็นค่าสมมติ และตารางสะสมแต้มยังไม่หักใบลดหนี้)
- ตารางโทรติดตามและนัดหมาย
- จัดเกรดลูกค้าตามความถี่และยอดซื้อ ดู [[sys-crm-customer-grades]]
- ข้อมูลลูกค้า ใบเสนอราคา ใบสั่งขาย และใบขาย อ่านมาจากระบบบัญชีของบริษัทเอง
- **สิ่งที่ต้องรู้:** การสร้างดีลหรือเลื่อนขั้นดีลเป็นการจดบนกระดาน CRM ไม่ได้ออกเอกสารขายในบัญชี ยังไม่ส่งข้อความหาลูกค้าจริง และตัวเลขบางหน้าเช่นผลงานทีมขายยังเป็นตัวอย่าง ดู [[faq-crm-demo-or-real]]

## แชท LINE OA

ภาพรวมดู [[sys-lineoa-overview]]

- หน้าจอแชทหน้าตาแบบ LINE Official Account รายชื่อลูกค้ามาจากระบบบัญชี
- ผู้ช่วย AI ช่วยตอบโดยดูข้อมูลจริงของบริษัท ดู [[sys-lineoa-ai-reply]]
- ร่างเอกสารขายด้วยการพิมพ์สั่ง แล้วเปิดดูหรือพิมพ์เป็นใบ A4 (ปุ่มยืนยันเปิดบิลในแชทยังไม่สร้างคำสั่งซื้อ ดู [[ts-lineoa-order-not-saved]])
- **สิ่งที่ต้องรู้:** รุ่นปัจจุบันเป็นตัวจำลอง ยังไม่เชื่อมกับ LINE จริง และเอกสารที่ร่างในแชทยังไม่ถูกบันทึกเป็นเอกสารขายในบัญชี ดู [[faq-lineoa-connect-real-line]]

## Market ตลาดค้าส่ง

ภาพรวมดู [[sys-market-overview]]

- หน้าร้านค้าส่งออนไลน์ให้ร้านลูกข่ายเลือกสินค้าและสั่งแบบเครดิต
- ราคาขั้นบันไดตามจำนวนที่ซื้อ และบัตรกำนัลส่วนลด ดู [[sys-market-pricing-vouchers]] (แชทตอบเรื่องส่วนลดบัตรกำนัลไม่ตรงกับยอดที่หักจริงในบางกรณี)
- ติดตามคำสั่งซื้อและสั่งซ้ำ
- คำสั่งซื้อหนึ่งครั้งสร้างใบงานคลัง จุดส่งของ รายการในหน้า e-Tax (เลขผู้เสียภาษียังเป็นค่าตายตัว) และประวัติลูกค้าใน CRM
- **สิ่งที่ต้องรู้:** รุ่นปัจจุบันเป็นรุ่นสาธิต คำสั่งซื้อยังไม่ลงบัญชีและไม่ตัดสต็อกในระบบบัญชี แม้ข้อความใต้ปุ่มสั่งซื้อจะบอกว่าเปิดบิลขายและออกใบกำกับให้ และร้านลูกข่ายยังไม่มีการเข้าสู่ระบบแยกของตัวเอง ดู [[faq-market-is-it-demo]] และ [[faq-market-accounting-link]]

## ถ้าลูกค้าต้องการใช้จริงตอนนี้

- งานขายและตามหนี้จริง ใช้เมนูขายและเมนูลูกหนี้ในระบบบัญชี ดู [[howto-sale-overview]] และ [[howto-ar-overview]]
- ต้องการเชื่อม LINE หรือเปิดหน้าร้านออนไลน์จริง ส่งต่อฝ่ายขาย ดู [[sales-handoff]]

อ่านต่อตามประเภทธุรกิจ [[sales-by-business-wholesale]] และ [[sales-by-business-online-line]]
