---
title: "ระบบขายหน้าร้าน POS มีอะไรให้บ้าง"
tags: [sales, feature, pos]
aliases: ["POS ทำอะไรได้บ้าง", "มีโปรแกรมขายหน้าร้านไหม", "แคชเชียร์ใช้อะไร", "เน็ตหลุดขายได้ไหม", "POS เข้าบัญชีเองไหม", "ร้านค้าปลีกใช้ได้ไหม"]
sources: ["frontend/pos/README.md:1", "frontend/account/pos/PosSetupAndControlScreen.tsx:1", "frontend/pos/lib/services/sync_engine.dart:20", "backend/internal/application/process/pos_bill.go:131", "backend/internal/application/process/pos_bill.go:316", "frontend/pos/lib/ui/widgets/receipt_dialog.dart:143", "frontend/pos/lib/ui/widgets/payment_dialog.dart:413", "backend/internal/application/process/bcMenu.json:5163", "frontend/pos/lib/ui/widgets/payment_dialog.dart:371", "backend/internal/application/process/pos_sync.go:579", "frontend/account/pos/PosSetupAndControlScreen.tsx:449", "frontend/account/pos/PosSetupAndControlScreen.tsx:3088", "backend/internal/application/process/pos_bill.go:394", "backend/internal/application/process/pos_bill.go:646", "frontend/pos/lib/ui/widgets/settings_dialog.dart:203"]
---

# ระบบขายหน้าร้าน POS มีอะไรให้บ้าง

POS มี 2 ส่วน คือ **แอปแคชเชียร์** ที่เคาน์เตอร์ และ **หลังบ้านบนเว็บ** ที่เจ้าของร้านหรือฝ่ายบัญชีใช้ตั้งค่าและดูบิล บิลที่ขายจะเข้าระบบบัญชีให้เอง ภาพรวมดูที่ [[sys-pos-overview]]

## ฝั่งแคชเชียร์

- ยิงบาร์โค้ด แก้จำนวน แก้ราคา ลบรายการ ดู [[howto-pos-app-sell-basic]]
- รับชำระด้วยเงินสด QR พร้อมเพย์ โอนเงิน หรือบัตรเครดิต ได้วิธีเดียวต่อบิล (บัตรต้องรูดที่เครื่องของธนาคารแล้วกรอกเลขอ้างอิง เพราะแอปยังไม่เชื่อมเครื่องรูดบัตร) ดู [[howto-pos-app-pay]]
- พักบิลแล้วเรียกกลับมาขายต่อ ดู [[howto-pos-app-hold-bill]]
- ส่วนลดท้ายบิล ส่วนลดรายการ คูปอง และโปรโมชั่น ดู [[howto-pos-app-discount-coupon]] และ [[sys-pos-app-promotions]] (โปรอัตโนมัติอาจทับส่วนลดที่แคชเชียร์กรอกเอง และยังแลกแต้มเป็นส่วนลดในบิลไม่ได้)
- เลือกลูกค้าสมาชิกในบิล ดู [[howto-pos-app-member-customer]]
- ดูประวัติบิล พิมพ์ซ้ำบนจอ และยกเลิกบิล (ยกเลิกได้ทั้งบิล ยังคืนสินค้าบางส่วนไม่ได้) ดู [[howto-pos-app-reprint-cancel-bill]]
- **ขายต่อได้แม้อินเทอร์เน็ตหลุด** บิลเก็บไว้ในเครื่องแล้วส่งขึ้นระบบเองเมื่อเน็ตกลับมา ส่งซ้ำก็ไม่เกิดบิลซ้ำ ดู [[sys-pos-app-offline-sync]] และ [[faq-pos-app-need-internet]]

## ฝั่งหลังบ้าน

- ตั้งชื่อร้าน สาขา เลขผู้เสียภาษี และสิทธิ์แคชเชียร์ ให้เครื่อง POS ได้ ส่วนลดสมาชิก การปัดเศษ ค่าบริการ และรูปแบบใบเสร็จ บันทึกได้แต่ยังไม่ส่งไปที่เครื่อง ดู [[howto-pos-web-startup-config]]
- ลงทะเบียนเครื่อง POS แต่ละเครื่อง กำหนดคลังที่ตัดสต็อกและรูปแบบเลขที่บิล ดู [[howto-pos-web-machine-register]]
- สร้างรหัสเชื่อมเครื่องให้เครื่องแคชเชียร์เครื่องใหม่ ดู [[howto-pos-web-pair-device]]
- ดูสถานะการส่งบิลของแต่ละเครื่อง บิลค้างส่ง บิลผิดพลาด ดู [[howto-pos-web-monitor-sync]]
- สร้างคูปอง กำหนดสูตรโปรโมชั่น 10 รูปแบบ กำหนดเงื่อนไขสะสมแต้ม ตั้งค่า QR พร้อมเพย์ (มีข้อจำกัด เช่น คูปองที่สร้างเป็นชุดหมดอายุในวันที่สร้าง โปรยังไม่มีวันเริ่มและวันสิ้นสุด แต้มยังไม่คิดตัวคูณวันเกิดและระดับสมาชิก QR ใช้เลขพร้อมเพย์อย่างเดียว ดู [[howto-pos-web-coupons]] [[howto-pos-web-promotions]] [[howto-pos-web-loyalty-points]] [[howto-pos-web-qr-payment]])
- บันทึกรับเงินทอนเปิดกะและส่งเงินปิดกะ เก็บเป็นรายการคุมเงิน ยังไม่ลงบัญชี ยังไม่ได้ปิดกะจริงและยังไม่นับเงินเทียบยอด ดู [[howto-pos-web-shift-cash]]
- รายละเอียดหลังบ้านทั้งหมดดู [[sys-pos-web-backoffice]]

## บิลขายไหลเข้าบัญชีอย่างไร

เมื่อบิลส่งขึ้นระบบ บิลจะกลายเป็นเอกสารขายสินค้าแบบขายสดในระบบบัญชี ตัดสต็อกจากคลังที่ผูกกับเครื่องนั้น ลงบัญชีอัตโนมัติแยกตามช่องทางรับเงิน และบันทึกแต้มให้ลูกค้าสมาชิก ไม่ต้องคีย์ซ้ำ (แต้มคงเหลือที่ส่งให้เครื่อง POS ยังไม่นับแต้มยกมา) ดู [[sys-pos-web-bill-to-accounting]]

## สิ่งที่ลูกค้ามักถามต่อ

- พิมพ์ใบเสร็จออกเครื่องพิมพ์ได้ไหม → [[faq-pos-app-print-receipt]]
- รับคืนสินค้าได้ไหม → [[faq-pos-app-return-goods]]
- ออกใบกำกับภาษีเต็มรูปได้ไหม → [[faq-pos-web-full-tax-invoice]]
- ฟังก์ชันที่รุ่นปัจจุบันยังไม่มี → [[sales-current-limits]] และ [[sys-pos-app-limits]]
- จำนวนเครื่อง POS ที่ใช้ได้ต่อแพ็กเกจ และอุปกรณ์ฮาร์ดแวร์ สอบถามฝ่ายขาย

ร้านค้าปลีกที่สนใจ POS อ่านต่อที่ [[sales-by-business-retail]]
