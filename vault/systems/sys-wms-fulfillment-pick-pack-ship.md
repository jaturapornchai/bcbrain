---
title: "WMS หยิบ-แพ็ค-ส่ง และตัดสต็อกคลังจริง (AdvanceFulfillment)"
tags: [systems, wms, fulfillment, pick-pack]
aliases: ["WMS fulfillment", "หยิบ แพ็ค ขนส่ง", "AdvanceFulfillment", "POST /api/v1/wms/fulfillment", "WAITING_PICK", "SHIPPED", "OUTBOUND_SHIP"]
sources: ["backend/internal/adapter/inbound/http/wms/handler.go:217-260", "backend/internal/adapter/inbound/http/wms/handler.go:308-362", "backend/internal/adapter/inbound/http/wms/handler.go:376-409", "backend/internal/adapter/inbound/http/wms/handler.go:458-523", "backend/internal/adapter/inbound/http/wms/handler.go:923-946", "backend/internal/adapter/inbound/http/wms/handler.go:1029-1031", "backend/internal/adapter/inbound/http/market/handler.go:660-730", "frontend/wms/WmsDashboard.tsx:183", "frontend/wms/WmsDashboard.tsx:508-549", "frontend/wms/WmsDashboard.tsx:588-700", "frontend/src/app/api/wms/fulfillment/route.ts:1-60"]
---
# WMS หยิบ-แพ็ค-ส่ง และการตัดสต็อกคลังจริง

แท็บ "1. หยิบ · แพ็ค · ขนส่ง (Pick & Pack)" ของ [[sys-wms-overview]] ทำงานกับตาราง `wms_fulfillment_order` หนึ่งแถวต่อหนึ่งใบงาน (เลขใบงาน `wms_doc_no` ผูกกับเลขใบกำกับขาย `erp_inv_doc_no`) ผู้ใช้กดเลื่อนสถานะทีละขั้นและแนบรูปหลักฐานของขั้นนั้น

## ใบงานมาจากไหน
- ใบงานที่ส่งมาจากร้านค้าส่ง `/market`: ตอนลูกค้ายืนยันสั่งซื้อ ระบบเขียนแถว `market_b2b_order` + `wms_fulfillment_order` (เริ่มที่ stage `PICKING`) + `tms_delivery_stop` ใน transaction เดียวกัน
- ฐาน `bcdemo` มีใบงานตัวอย่างใส่ให้ตอน seed ฐานอื่นเริ่มว่าง (ดู [[sys-wms-stock-ledger-reconcile]])

## สถานะและกติกา
เส้นทาง `POST /api/v1/wms/fulfillment` (Next proxy `/api/wms/fulfillment`) รับ JSON หรือ multipart (ฟอร์มสูงสุด 32 MB):
- บังคับ `wms_doc_no` ถ้าไม่ส่งตอบ 400 "กรุณาระบุเลขที่ใบงานคลัง" ถ้าไม่พบใบงานตอบ 404 "ไม่พบใบงานคลังที่ระบุ"
- ลำดับสถานะ: `WAITING_PICK` → `PICKING` → `PACKED` → `SHIPPED` ถ้าไม่ส่ง `next_stage` ระบบเลือกขั้นถัดไปให้เอง (สถานะอื่นที่ไม่รู้จักถูกพาไป `SHIPPED`)
- ช่องที่ไม่ส่งมาจะเติมค่า: ผู้หยิบ/ขนส่งใช้ค่าเดิมของใบงาน, เลขพัสดุ `TH-WMS-<เวลา>`, จำนวนกล่อง 2, น้ำหนัก 14.5 กก.
- หน้าจอมีตัวเลือกขนาดกล่องมาตรฐาน (`THAI_BOX_SIZES` เช่น BOX-S, BOX-M, BOX-L)

## รูปหลักฐานต่อขั้น
- ผู้ใช้แนบหลายรูปได้ ระบบเก็บลง MinIO (โฟลเดอร์ `wms_evidence`) และเก็บ key + ป้ายกำกับ + เวลา ลงคอลัมน์ `evidence_photos_json` (รายละเอียดที่ [[sys-wms-movements-evidence-photos]])
- ถ้าไม่ได้แนบรูปและขั้นเป็น PICKING/PACKED/SHIPPED (หรือส่ง `generate_sample_photo`) ระบบสร้างรูปตัวอย่าง 2-4 รูปให้อัตโนมัติ ดังนั้นใบงานที่ไม่มีรูปจริงก็อาจมีรูปตัวอย่างอยู่ในอัลบั้ม

## เมื่อเลื่อนเป็น SHIPPED (ตัดสต็อกจริง)
ทุกอย่างรันใน `ExecBatch` ชุดเดียว (transaction) ถ้าขั้นใดพังจะไม่มีกรณีที่ใบงานเป็น SHIPPED แต่สต็อกไม่ถูกตัด:
1. `UPDATE wms_fulfillment_order` (stage, ผู้หยิบ, ขนส่ง, เลขพัสดุ, กล่อง, น้ำหนัก, รูป, หมายเหตุ)
2. `WmsBinOpeningSQL` ตั้งยอดยกมา (`OPENING`) ของสินค้า x ช่อง ถ้ายังไม่มี
3. บันทึก `wms_movement_log` ประเภท `OUTBOUND_SHIP` เลขที่ `WMS-SHP-<เวลา>` ปลายทาง "DOCK-OUT (ขึ้นรถขนส่ง)" พร้อมยอดก่อน/หลัง
4. `WmsBinRebuildSQL` สร้าง `physical_qty` ของช่องใหม่จากสมุดความเคลื่อนไหว
5. ลด `reserved_pick_qty` ลงเท่าจำนวนที่ส่ง
6. `UPDATE market_b2b_order SET order_status='SHIPPED_IN_TRANSIT'` ตาม `wms_doc_no`
7. `UPDATE tms_delivery_stop SET stop_status='IN_TRANSIT'` เฉพาะจุดส่งที่ยัง `PENDING_LOAD`

ยอดจอง (reserved) ที่โชว์บน Overview คำนวณใหม่ทุกครั้งจากใบงานที่ยังไม่ SHIPPED (WAITING_PICK, PICKING, PACKED) ต่อสินค้า ถ้าไม่มีใบงานค้างจึงใช้ค่า `reserved_pick_qty` ที่เก็บไว้ในช่อง

เงื่อนไข: ทำเฉพาะตอนเปลี่ยน "เข้า" SHIPPED จากสถานะอื่น เรียกซ้ำเมื่อเป็น SHIPPED แล้วจะไม่ตัดซ้ำ ฝั่ง TMS มีทางลัดที่ปิดใบงานคลังให้เองเมื่อส่งมอบสำเร็จ ดู [[sys-tms-trip-pod-flow]]

## การสแกนบนหน้าจอ
ช่องสแกนบาร์โค้ดในแท็บนี้ตรวจฝั่งเบราว์เซอร์เท่านั้น (`handleBarcodeScanSubmit`): รหัสที่ตรงกับช่องเก็บของใบงานหรือขึ้นต้นด้วย `A-`/`B-`/`C-` ถือว่าสแกนช่องแล้ว รหัสที่ตรงสินค้า/เลขใบงาน หรือยาวตั้งแต่ 3 ตัวอักษรขึ้นไป นับเป็นสแกนสินค้า +1 (ไม่เกินจำนวนในใบงาน) และมีปุ่ม "ยืนยันทั้งหมด" ผลการสแกนไม่ถูกส่งไปเก็บที่เซิร์ฟเวอร์

## ที่มาในโค้ด
- `backend/internal/adapter/inbound/http/wms/handler.go:217-260` ตัวจัดการ `AdvanceFulfillment` และอ่านฟอร์ม; `:308-362` ตรวจ `wms_doc_no`, หาใบงาน, เลือกขั้นถัดไป, ค่าตั้งต้น
- `backend/internal/adapter/inbound/http/wms/handler.go:376-409` เก็บรูปลง MinIO และสร้างรูปตัวอย่าง
- `backend/internal/adapter/inbound/http/wms/handler.go:458-523` ชุดคำสั่ง transaction ตอน SHIPPED
- `backend/internal/adapter/inbound/http/wms/handler.go:923-946` และ `:1029-1031` ยอดจองจากใบงานที่ยังไม่ส่ง
- `backend/internal/adapter/inbound/http/market/handler.go:660-730` สั่งซื้อ /market สร้างใบงานคลังและจุดส่ง TMS
- `frontend/wms/WmsDashboard.tsx:183` ขนาดกล่อง; `:508-549` ตรรกะสแกน; `:588-700` เรียก `/api/wms/fulfillment`
- ดูเพิ่ม: [[sys-wms-overview]] · [[sys-wms-stock-ledger-reconcile]] · [[sys-tms-trip-pod-flow]] · [[api-business-modules]] · [[flow-order-to-cash]]
