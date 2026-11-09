---
title: "AutoCare อู่ซ่อมรถ/ศูนย์บริการ ภาพรวม"
tags: [system, autocare]
aliases: ["AutoCare", "อู่ซ่อมรถ", "โปรแกรมอู่", "ศูนย์บริการรถ", "ร้านยาง", "ใบสั่งซ่อม", "ระบบอู่ทำอะไรได้"]
sources: ["frontend/autocare/AutoCareWorkspace.tsx:1", "frontend/autocare/autocareMenuConfig.ts:1"]
---
# AutoCare อู่ซ่อมรถ/ศูนย์บริการ

AutoCare คือระบบสำหรับอู่ซ่อมรถ ศูนย์บริการ และร้านยาง ใช้รับรถเข้าซ่อม เปิดใบงาน ใส่อะไหล่และค่าแรง ติดตามคิวช่าง ปิดบิล และดูรายงาน มีทั้งหน้าเว็บและแอปมือถือ เมื่อปิดบิลระบบสร้างเอกสารขายและลงบัญชีให้

**ข้อจำกัดที่ต้องบอกลูกค้าตรงๆ:** บางส่วนยังเป็นตัวสาธิต (เช่น ข้อมูลตัวอย่างบางจุด งานเคลมเป็นการติดตามสถานะอย่างเดียว การฝากยางยังไม่มีขั้นตอนรับยางคืน แอปมือถือส่งข้อมูลบางช่องไม่ครบ) อ่านโน้ตข้อจำกัดก่อนเสนอลูกค้า ราคาให้สอบถามฝ่ายขาย

## โน้ตในกลุ่มนี้

- [[faq-autocare-delete-job]] — ลบใบสั่งซ่อมได้ไหม และหลังปิดบิลเป็นอย่างไร
- [[faq-autocare-line-oa-approval]] — ส่งลิงก์ให้ลูกค้าอนุมัติซ่อมทาง LINE ได้จริงไหม
- [[faq-autocare-mobile-differences-web]] — แอปมือถือ AutoCare ทำอะไรได้ต่างจากเว็บ และทำไมข้อมูลที่พิมพ์ไม่ตรง?
- [[faq-autocare-payment-types]] — AutoCare รับชำระเงินแบบไหนได้บ้าง
- [[faq-autocare-report-numbers-mismatch]] — ตัวเลขในรายงาน AutoCare ไม่ตรงกัน ต้องทำอย่างไร?
- [[howto-autocare-add-parts-labor]] — เพิ่ม/ลบรายการยาง อะไหล่ และค่าแรงในใบสั่งซ่อม
- [[howto-autocare-bays-technicians]] — ตั้งช่องซ่อม ฮอยท์ และช่างประจำช่อง
- [[howto-autocare-close-bill]] — รับชำระเงิน ปิดบิล และออกใบกำกับภาษีขายใน AutoCare
- [[howto-autocare-estimate-approve]] — ตรวจสภาพรถ เสนอซ่อมเพิ่ม และบันทึกว่าลูกค้าอนุมัติ
- [[howto-autocare-job-queue-board]] — ใช้กระดานคิวซ่อมและดูสถานะช่องฮอยท์
- [[howto-autocare-member-coupon]] — ขายแพ็กเกจคูปองสมาชิกและตัดสิทธิ์ทีละครั้ง
- [[howto-autocare-mobile-intake]] — เปิดใบรับรถจากมือถือ (แถบ SA รับรถ)
- [[howto-autocare-mobile-mechanic-dvi]] — ช่างตรวจสภาพรถและแจ้งซ่อมเพิ่มจากมือถือ (แถบ ช่าง & DVI)
- [[howto-autocare-mobile-warehouse-owner]] — รับยางเข้าคลัง และเจ้าของร้านอนุมัติส่วนลดจากมือถือ
- [[howto-autocare-open-job]] — เปิดใบรับรถ / ใบสั่งซ่อมใหม่ใน AutoCare
- [[howto-autocare-rebuild]] — ประมวลผลและคำนวณข้อมูล AutoCare ใหม่ทั้งหมด
- [[howto-autocare-receive-tires]] — รับยางและอะไหล่เข้าคลังแบบไม่แสดงราคาทุน และส่งเข้าบิลซื้อ
- [[howto-autocare-register-vehicle]] — บันทึกทะเบียนรถลูกค้าและเลขตัวถัง (VIN) ใน AutoCare
- [[howto-autocare-report-queue-dashboard]] — ดูภาพรวมศูนย์บริการและคิวรถซ่อม (แดชบอร์ดภาพรวม & คิวซ่อม)
- [[howto-autocare-report-tax-ledger]] — รายงานใบกำกับภาษีขายและบัญชีของงานซ่อม (รายงานบิลภาษี & บัญชี GL)
- [[howto-autocare-report-tech-wallet]] — รายงานกระเป๋าเงินช่าง ส่วนแบ่งค่าแรงและค่าคอมมิชชั่น
- [[howto-autocare-report-tire-dot-fefo]] — รายงานสต็อกยางตามสัปดาห์ผลิต DOT และแจ้งเตือนยางค้างปี (FEFO)
- [[howto-autocare-report-warranty-ewarranty]] — รายงานทะเบียนรถลูกค้า ใบรับประกันดิจิทัล (E-Warranty) งานเคลม และแจ้งเตือนเช็กระยะ
- [[howto-autocare-tire-catalog-dot]] — ตั้งข้อมูลยาง ล้อแม็ก อะไหล่ และดูสต็อกตามสัปดาห์ผลิต (DOT)
- [[howto-autocare-tire-hotel]] — รับฝากยางลูกค้า (Tire Hotel) และบันทึกตำแหน่งชั้นวาง
- [[howto-autocare-warranty-claim]] — ใบรับประกันดิจิทัลและงานเคลมยางส่งโรงงาน
- [[sys-autocare-accounting-link]] — AutoCare เชื่อมกับระบบบัญชี BC Ai Account อย่างไร
- [[sys-autocare-demo-data-limits]] — AutoCare ส่วนไหนใช้งานจริง ส่วนไหนยังเป็นตัวสาธิต
- [[sys-autocare-job-flow]] — ขั้นตอนงานซ่อมใน AutoCare ตั้งแต่รับรถจนปิดบิล
- [[sys-autocare-menus]] — เมนูทั้งหมดของ AutoCare และใช้ทำอะไร
- [[sys-autocare-mobile-overview]] — แอปมือถือ AutoCare สำหรับพนักงานหน้าอู่
- [[ts-autocare-close-bill-failed]] — รับชำระเงินและปิดบิลไม่สำเร็จ
- [[ts-autocare-default-tire-line]] — ใบงานใหม่มียาง 4 เส้นโผล่มาเอง
- [[ts-autocare-item-not-found]] — ปิดบิลไม่ได้: ไม่พบรหัสสินค้า
- [[ts-autocare-load-failed]] — เปิด AutoCare แล้วขึ้น โหลดข้อมูล BC AutoCare ไม่สำเร็จ
- [[ts-autocare-mobile-connection-error]] — แอปมือถือ AutoCare ขึ้น \"เชื่อมต่อ API ขัดข้อง\" หรือ \"คำสั่งไม่สำเร็จ\"
- [[ts-autocare-vehicle-save-warnings]] — บันทึกทะเบียนรถไม่ได้: ข้อมูลไม่สมบูรณ์ / ทะเบียนซ้ำ
