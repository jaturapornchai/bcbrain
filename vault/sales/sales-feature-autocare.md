---
title: "ระบบ AutoCare สำหรับอู่ซ่อมรถและร้านยาง มีอะไรให้บ้าง"
tags: [sales, feature, autocare]
aliases: ["โปรแกรมอู่ซ่อมรถ", "โปรแกรมร้านยาง", "AutoCare ทำอะไรได้", "ระบบศูนย์บริการรถยนต์", "เปิดใบงานซ่อม", "คิวซ่อมรถ"]
sources: ["frontend/autocare/AutoCareWorkspace.tsx:1", "frontend/autocare/autocareMenuConfig.ts:1", "backend/internal/adapter/inbound/http/autocare/handler.go:2495", "backend/internal/adapter/inbound/http/autocare/handler.go:993", "backend/internal/adapter/inbound/http/autocare/seed.go:14", "backend/internal/adapter/inbound/http/autocare/handler.go:2659", "backend/internal/adapter/inbound/http/autocare/handler.go:2008", "backend/internal/adapter/inbound/http/autocare/handler.go:1405", "backend/internal/adapter/inbound/http/autocare/handler.go:2155", "frontend/autocare/AutoCareScreenContent.tsx:1838", "frontend/autocare/AutoCareScreenContent.tsx:2650", "frontend/autocare/autocareTypes.ts:347"]
---

# ระบบ AutoCare มีอะไรให้บ้าง

AutoCare ใช้กับอู่ซ่อมรถ ศูนย์บริการ และร้านยาง รับรถเข้า เปิดใบงาน ใส่อะไหล่และค่าแรง ติดตามคิวช่าง จนปิดบิลแล้วส่งเข้าระบบบัญชี ภาพรวมเชิงระบบดูที่ [[sys-autocare-overview]]

## งานซ่อม 5 ขั้น

รับรถ → ตรวจสภาพและให้ลูกค้าอนุมัติ → ขึ้นฮอยท์ (ช่องยกรถ) ซ่อม → ตรวจคุณภาพ (QC) → รับชำระเงินและปิดบิล ดู [[sys-autocare-job-flow]]

## สิ่งที่มีให้

- ทะเบียนรถลูกค้าและเลขตัวถัง (VIN) ดู [[howto-autocare-register-vehicle]]
- เปิดใบรับรถ ใบสั่งซ่อม เพิ่มยาง อะไหล่ ค่าแรง ดู [[howto-autocare-open-job]] และ [[howto-autocare-add-parts-labor]]
- ตรวจสภาพรถ เสนอซ่อมเพิ่ม และบันทึกว่าลูกค้าอนุมัติ (หัวข้อตรวจยังไม่ครบชุด และปุ่มเสนอซ่อมเพิ่มรายการราคาตัวอย่าง) ดู [[howto-autocare-estimate-approve]]
- ตั้งช่องซ่อม ฮอยท์ และช่างประจำช่อง กระดานคิวซ่อม ดู [[howto-autocare-bays-technicians]] และ [[howto-autocare-job-queue-board]] (การ์ดขั้นรอรับเงินยังไม่มีปุ่มรับชำระ)
- สต็อกยางตามสัปดาห์ผลิต (DOT) และเตือนยางค้างปี ดู [[howto-autocare-report-tire-dot-fefo]] (หน้ารับยางเข้าคลังยังเพิ่มสต็อกเฉพาะยางตัวอย่าง ดู [[howto-autocare-receive-tires]])
- ขายแพ็กเกจคูปองสมาชิก แล้วตัดสิทธิ์ทีละครั้ง (คูปองยังไม่ลดยอดในบิลให้เอง และแพ็กเกจใหม่ยังผูกกับลูกค้าตัวอย่าง) ดู [[howto-autocare-member-coupon]]
- กระเป๋าเงินช่าง ส่วนแบ่งค่าแรงและค่าคอมมิชชั่น ดู [[howto-autocare-report-tech-wallet]] (ถ้าแก้ใบงานจากหน้าเว็บ ช่างในใบงานถูกตั้งเป็นช่างคนแรก ส่วนแบ่งค่าแรงอาจเข้าผิดคน)
- ใบรับประกันดิจิทัลออกเองตอนปิดบิล
- ตัวเลือกโหมดธุรกิจ 5 แบบสำหรับกรองรายการยางและอะไหล่ ดู [[sys-autocare-menus]]
- แอปหน้าจอเล็กสำหรับมือถือหรือแท็บเล็ต แยก 4 บทบาท คือ รับรถ ช่าง คลังรับยาง เจ้าของร้าน ดู [[sys-autocare-mobile-overview]]

## ปิดบิลแล้วเข้าบัญชีอย่างไร

กดรับชำระเงินแล้วระบบสร้าง **ใบกำกับภาษีขาย** ในระบบบัญชี ตัดสต็อก ลงบัญชีอัตโนมัติ และบันทึกการรับเงินในครั้งเดียว รับชำระได้ด้วยพร้อมเพย์ บัตรเครดิต เงินสด หรือขายเชื่อให้ลูกค้ากลุ่มรถบริษัท (Fleet) (วันครบกำหนดตอนนี้เท่ากับวันที่ออกบิล ไม่ใช่ 30 วันตามชื่อ และระบบยังไม่เช็กวงเงิน) ดู [[sys-autocare-accounting-link]] และ [[howto-autocare-close-bill]]

รหัสลูกค้าและรหัสสินค้าในใบงานต้องมีในระบบบัญชีก่อน

## ส่วนที่ยังเป็นรุ่นสาธิต (บอกลูกค้าตรงๆ)

- ครั้งแรกที่เปิด AutoCare ระบบจะใส่ข้อมูลตัวอย่างลงฐานข้อมูลบริษัท แนะนำให้ทดลองกับฐานข้อมูลทดลองก่อน ดู [[sys-autocare-demo-data-limits]]
- ลิงก์ให้ลูกค้าอนุมัติซ่อมทาง LINE ยังไม่ส่งข้อความจริง ดู [[faq-autocare-line-oa-approval]]
- การเคลมยางและการฝากยางยังไม่มีขั้นตอนต่อ
- คูปองสมาชิกยังไม่ลดยอดในบิลให้เอง
- แอปมือถือยังมีข้อมูลตัวอย่างใส่ไว้ หลายช่องยังไม่บันทึกลงใบงาน และไม่มีโหมดออฟไลน์ ดู [[faq-autocare-mobile-differences-web]]
- ยังไม่มีตัวเลือกรับชำระด้วยการโอนเงินผ่านบัญชีธนาคาร ดู [[faq-autocare-payment-types]]
- เมนูคำนวณข้อมูลใหม่ บันทึกบิลขายของงานที่ปิดแล้วซ้ำ ห้ามใช้กับข้อมูลจริงก่อนคุยกับเจ้าหน้าที่ ดู [[howto-autocare-rebuild]]
- ปุ่มอนุมัติส่วนลด VIP เป็นส่วนลดตายตัว ถ้าต้องการจำกัดคนอนุมัติส่วนลด ขอให้เจ้าหน้าที่สาธิตก่อนใช้งาน

รายการทั้งหมดดู [[sales-current-limits]] กิจการอู่ที่สนใจอ่านต่อ [[sales-by-business-autocare]]
