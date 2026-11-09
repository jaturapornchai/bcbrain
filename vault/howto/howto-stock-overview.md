---
title: "ระบบสินค้าและคลังสินค้า (ภาพรวมทุกเรื่อง)"
tags: [howto, stock]
aliases: ["ระบบสินค้า", "ระบบคลังสินค้า", "ระบบสต็อก", "สินค้าคงคลัง", "เมนูสินค้า", "คู่มือคลังสินค้า", "ภาพรวมสต็อก", "inventory"]
sources: ["frontend/account/tabs/transMenuMap.ts:924", "frontend/account/tabs/transMenuMap.ts:996", "frontend/account/tabs/transMenuMap.ts:1149", "frontend/account/tabs/screenRegistry.tsx:297", "frontend/account/tabs/screenRegistry.tsx:1121", "frontend/src/config/schemas/erpOption/tab3Item.ts:141"]
---
# ระบบสินค้าและคลังสินค้า (ภาพรวมทุกเรื่อง)

**ใช้เมื่อ:** ลูกค้าถามเรื่องสินค้า สต็อก คลัง ราคา บาร์โค้ด ตรวจนับ ต้นทุน แล้วยังไม่รู้ว่าจะเปิดเรื่องไหน
**เมนู:** สินค้า (ทะเบียนสินค้า ราคา เอกสารคลัง ตรวจนับ สอบถาม) และ เริ่มต้น › ตั้งค่าระบบสินค้าคงคลัง (คลัง ที่เก็บ หน่วยนับ รหัสพื้นฐาน)
**ต้องมีก่อน:** ตั้งค่าตัวเลือกระบบสินค้า คลังสินค้า และหน่วยนับ ก่อนเริ่มคีย์สินค้า

## ขั้นตอน
1. เริ่มใช้ระบบ ทำตามลำดับ ตัวเลือกระบบ → คลังและที่เก็บ → รหัสพื้นฐาน → หน่วยนับ → ข้อมูลสินค้า → ยอดยกมา
2. งานประจำวัน ใช้เอกสารคลัง (เบิก โอน ปรับปรุง รับสินค้าสำเร็จรูป) ส่วนซื้อขายอยู่ในระบบซื้อและระบบขาย
3. ตรวจนับตามรอบ แล้วให้ระบบปรับปรุงสต็อกจากผลนับ
4. ดูยอด การเคลื่อนไหว และกำไรขั้นต้นจากหน้าจอสอบถาม

## ช่องสำคัญที่ต้องกรอก
| เรื่อง | ตั้งที่ |
|---|---|
| ห้ามติดลบ ทศนิยม LOT อัตโนมัติ | [[howto-stock-options]] |
| คลังสินค้า พื้นที่เก็บ | [[howto-stock-warehouse-shelf]] |
| กลุ่ม หมวด ยี่ห้อ รหัสพื้นฐาน | [[howto-stock-setup-codes]] |
| หน่วยนับ หลายหน่วย | [[howto-stock-units]] |
| ข้อมูลสินค้า ประเภทสินค้า | [[howto-stock-item-master]] |

## บันทึกแล้วระบบทำอะไรให้
- ต้นทุนสินค้าคิดแบบถัวเฉลี่ยเคลื่อนที่ (ต้นทุนเฉลี่ยใหม่ทุกครั้งที่รับเข้า) ([[faq-stock-cost-method]])
- ยอดคงเหลือและต้นทุนคำนวณใหม่ให้เองทุกครั้งที่บันทึก แก้ ลบ ยกเลิก ([[faq-stock-when-recalc]])
- เอกสารคลังบางชนิดลงบัญชีให้อัตโนมัติ ([[faq-stock-gl-posting]])

## เรื่องทั้งหมดของระบบสินค้า
**ข้อมูลสินค้า ราคา บาร์โค้ด**
- [[howto-stock-set-items]] สินค้าชุด · [[howto-stock-serial]] Serial Number · [[howto-stock-lot]] LOT
- [[howto-stock-barcode]] บาร์โค้ด · [[howto-stock-barcode-check-print]] ตรวจและพิมพ์ฉลาก · [[howto-stock-barcode-discount]] ส่วนลดตามบาร์โค้ด
- [[howto-stock-sale-price]] ราคาขาย · [[howto-stock-purchase-price]] ราคาซื้อ · [[howto-stock-price-formula]] สูตรราคา · [[howto-stock-modify-price]] ปรับราคาทีละมาก

**เอกสารคลังสินค้า**
- [[howto-stock-opening-balance]] ยอดยกมา · [[howto-stock-finished-goods]] รับสินค้าสำเร็จรูป
- [[howto-stock-issue]] ขอเบิก เบิก รับคืน · [[howto-stock-transfer]] ขอโอน โอน · [[howto-stock-adjust]] ปรับปรุงเพิ่ม/ลด
- [[howto-stock-cancel-doc]] ยกเลิกเอกสารคลัง · [[howto-stock-doc-attachment]] แนบรูปและไฟล์

**ตรวจนับ**
- [[howto-stock-count]] ขอตรวจนับและตรวจนับ · [[howto-stock-count-auto-adjust]] ปรับปรุงอัตโนมัติจากใบตรวจนับ · [[howto-stock-serial-count]] ตรวจนับด้วย Serial

**ประมวลผล**
- [[howto-stock-recalc]] คำนวณยอดสต๊อกใหม่ · [[howto-stock-hidden-cost]] ต้นทุนแฝง

**สอบถามบนหน้าจอ**
- [[howto-stock-inquiry-balance]] ยอดคงเหลือ จุดสั่งซื้อ ค้างสต็อก · [[howto-stock-inquiry-movement]] การเคลื่อนไหว · [[howto-stock-inquiry-profit]] กำไรขั้นต้น

## แก้ไข ยกเลิก พิมพ์
- ยกเลิกเอกสารคลัง ดู [[howto-stock-cancel-doc]] หลักทั่วไปดู [[howto-doc-edit-cancel-delete]]
- พิมพ์และส่งออกรายงาน ดู [[rpt-print-export]]

## ปัญหาที่พบบ่อย
- "สินค้า [...] ห้ามติดลบ" → ([[ts-stock-negative-not-allowed]])
- "สินค้า [...] ห้ามขายเกินยอดคงเหลือลบด้วยค้างจอง" → ([[ts-stock-reserved-accrued]])
- "ห้ามแก้ไข หรือลบข้อมูล" → ([[ts-stock-doc-locked]])
- "เอกสาร ... มีการอ้างอิงไปแล้วโดยเอกสาร ... ไม่สามารถนำมายกเลิกได้" → ([[ts-stock-cancel-blocked]])
- "บาร์โค้ดซ้ำ: ..." → ([[ts-stock-barcode-duplicate]])
- "ไม่พบหน่วยนับ ... ของสินค้า ..." → ([[ts-stock-unit-not-found]])
- "ป้อนข้อมูลคลังสินค้าไม่ครบ (...)" → ([[ts-stock-wh-shelf-incomplete]])
- "รหัสสินค้า ... ยังไม่บันทึกหมายเลข LOT แบบกำหนดเอง" → ([[ts-stock-lot-required]])
- "Serial Number ... ของสินค้า ... ซ้ำในเอกสาร" → ([[ts-stock-serial-errors]])
- "ไม่พบรหัสสินค้า" หรือ "จำนวนผิดพลาด" → ([[ts-stock-line-errors]])
- "เอกสารตรวจนับ ... มีเอกสารปรับปรุงแล้ว ต้องยกเลิกเอกสารปรับปรุงเดิมก่อนประมวลผลใหม่" → ([[ts-stock-count-already-adjusted]])
- "รหัสสินค้า ... มีอยู่แล้วในระบบ ไม่สามารถสร้างซ้ำได้" → ([[ts-stock-item-code-duplicate-delete]])
- ยอดคงเหลือไม่ตรง ไม่มีข้อความ → ([[ts-stock-balance-wrong]])
- ต้นทุนไม่ตรง ไม่มีข้อความ → ([[ts-stock-cost-wrong]])

## คำถามที่พบบ่อย
- [[faq-stock-cost-method]] · [[faq-stock-gl-posting]] · [[faq-stock-count-change-stock]]
- [[faq-stock-negative-allowed]] · [[faq-stock-change-unit-after-use]] · [[faq-stock-service-not-in-stock]]
- [[faq-stock-when-recalc]] · [[faq-stock-hidden-cost-effect]] · [[faq-stock-which-price]]

## ดูต่อ
- [[howto-sale-overview]] · [[howto-buy-overview]] · [[howto-gl-overview]] · [[rpt-overview]]
- [[sys-wms-overview]] · [[sys-pos-overview]] · [[term-overview]] · [[index]]
