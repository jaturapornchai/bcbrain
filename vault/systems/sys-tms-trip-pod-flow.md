---
title: "TMS เที่ยวรถ จุดส่งมอบ และ e-POD (UpdateDeliveryPod / CreateTripDispatch)"
tags: [systems, tms, trip, pod, delivery]
aliases: ["TMS e-POD", "UpdateDeliveryPod", "POST /api/v1/tms/pod", "POST /api/v1/tms/trip", "tms_trip_manifest", "tms_delivery_stop", "PENDING_LOAD", "IN_TRANSIT", "DELIVERED_POD", "ใบกำกับเที่ยวรถ", "ปล่อยรถ"]
sources: ["backend/internal/adapter/inbound/http/tms/handler.go:290-396", "backend/internal/adapter/inbound/http/tms/handler.go:396-440", "backend/internal/adapter/inbound/http/tms/handler.go:440-503", "backend/internal/adapter/inbound/http/tms/handler.go:504-513", "backend/internal/adapter/inbound/http/tms/handler.go:513-577", "backend/internal/adapter/inbound/http/tms/handler.go:579-615", "backend/internal/adapter/inbound/http/tms/handler.go:1170-1340", "backend/internal/adapter/inbound/http/tms/handler.go:1647-1700", "backend/internal/adapter/inbound/http/tms/handler.go:2080-2108", "backend/internal/adapter/inbound/http/market/handler.go:660-730", "frontend/tms/TmsDashboard.tsx:376-410", "frontend/tms/TmsDashboard.tsx:411-440", "frontend/tms/TmsDashboard.tsx:449-480", "frontend/tms/TmsDashboard.tsx:2179-2215", "frontend/src/app/api/tms/pod/route.ts:1-47", "frontend/src/app/api/tms/trip/route.ts:1-47"]
---
# เที่ยวรถ จุดส่งมอบ และหลักฐานส่งมอบ e-POD ของ TMS

บันทึกนี้อธิบายส่วน "ส่งของ" ของ [[sys-tms-overview]]: การเปิดเที่ยวรถ การเปลี่ยนสถานะจุดส่ง และสิ่งที่เกิดขึ้นต่อเนื่องเมื่อส่งมอบสำเร็จ (ตัดสต็อกคลังจริง และลงบันทึกกิจกรรมลูกค้า)

## จุดส่งมอบมาจากไหน
- ส่วนใหญ่จุดส่ง `tms_delivery_stop` ถูกสร้างตอนลูกค้ายืนยันสั่งซื้อที่ร้านค้าส่ง `/market` พร้อมใบงานคลัง (`wms_fulfillment_order`) ใน transaction เดียวกัน (ดู [[sys-wms-fulfillment-pick-pack-ship]])
- อีกทางคือ `POST /api/v1/tms/trip` แบบไม่ระบุ `action_type` ซึ่งเปิดเที่ยวใหม่ 1 เที่ยว + 1 จุดส่ง (หัวข้อ "เปิดเที่ยวรถ" ด้านล่าง)
- แต่ละจุดส่งผูกกับใบงานคลัง (`wms_doc_no`) และใบกำกับขายในบัญชี (`erp_inv_doc_no`) ภาพรวมจากสั่งซื้อถึงรับเงินดู [[flow-order-to-cash]]

## สถานะของจุดส่ง
`PENDING_LOAD` (รอขึ้นรถ) → `IN_TRANSIT` (กำลังส่ง) → `DELIVERED_POD` (ส่งมอบและมีหลักฐานแล้ว) ตาม `UpdateDeliveryPod`:
- ถ้าไม่ส่ง `next_status` มา ระบบเลื่อนให้เอง: `PENDING_LOAD` ไป `IN_TRANSIT`, สถานะอื่นทุกค่าไป `DELIVERED_POD`
- ปุ่มเลื่อนสถานะด่วนบนตารางจุดส่ง (`handleQuickAdvanceStop`) เรียก `/api/tms/pod` พร้อมสั่งสร้างรูปตัวอย่าง 3 รูปให้เสมอ ส่วนฟอร์มแท็บ 4 รับรูปจริงจากผู้ใช้

## บันทึกส่งมอบ (`POST /api/v1/tms/pod`)
รับ JSON หรือ multipart (ฟอร์มสูงสุด 32 MB) ฟิลด์หลัก: `stop_code` (บังคับ), `next_status`, `receiver_name`, `receiver_role`, `cod_amount`, `pod_note`, `gps_coords`, `generate_sample_photo`, `sample_photo_count`, `photo_labels`

| เงื่อนไข | ผล |
|---|---|
| ไม่ส่ง `stop_code` | ตอบ 400 `stop_code is required` |
| ไม่พบจุดส่ง | ตอบ 404 `delivery stop not found` |
| ส่งเป็น `DELIVERED_POD` และ `cod_amount` เดิมเป็น 0 และไม่ได้ส่ง `cod_amount` | ยอด COD = มูลค่าบิลของจุดนั้น |
| ส่ง `cod_amount` มา (JSON ต้องมากกว่า 0; ฟอร์ม multipart รับตั้งแต่ 0) | ใช้ค่าที่ส่ง |
| ชื่อผู้รับ/ตำแหน่ง/พิกัดว่าง | ใช้ค่าเดิมในแถว ถ้าไม่มีใช้ค่าตั้งต้นของโค้ด |
| เวลาส่งมอบ (`delivered_at`) | ตั้งเฉพาะตอนเป็น `DELIVERED_POD` |

### รูปหลักฐาน
- ป้ายรูปมาตรฐาน 2-4 รูปต่อขั้น (`defaultTmsPhotoLabels`) เช่น ขั้นส่งมอบ: ภาพส่งมอบหน้าจุดตรวจรับ, ตรวจสภาพกล่อง, ใบกำกับพร้อมลายเซ็นผู้รับ, สลิป COD/พิกัดหน้าร้าน; ขั้นออกเดินทาง: ภาพจัดเรียงพัสดุ, ป้ายทะเบียน/ใบคุมรถ, พิกัด GPS ระหว่างทาง
- ถ้าไม่แนบรูปและ (`generate_sample_photo` เป็นจริง หรือสถานะเป็น `DELIVERED_POD`) ระบบสร้างรูปตัวอย่างให้เอง (จำนวนเริ่มต้นเท่ากับจำนวนป้ายของขั้นนั้น) จึงอาจมีรูปตัวอย่างอยู่ในอัลบั้มแม้ไม่มีรูปจริง
- เก็บลง MinIO โฟลเดอร์ `tms-pod` (เที่ยวรถใช้ `tms-trips`) ฐานข้อมูลเก็บเฉพาะ key + JSON (`evidence_photos_json`) หน้าจอเรียกผ่านพร็อกซีรูปของ CRM ดูหลักการเดียวกันที่ [[sys-wms-movements-evidence-photos]]
- ถ้าอัปโหลดรูปใดล้มเหลว โค้ดข้ามรูปนั้นเงียบ ๆ (ไม่คืน error) ควรเปิดอัลบั้มตรวจว่ารูปครบ

## สิ่งที่เกิดต่อเนื่องในรอบเดียว (transaction เดียว)
คำสั่งทั้งหมดรวมเป็น `syncStatements` แล้วรันด้วย `ExecBatch` ครั้งเดียว ถ้าพังจะไม่มีกรณีที่จุดส่งเป็นส่งแล้วแต่สต็อกยังไม่ตัด:
1. `UPDATE tms_delivery_stop` (สถานะ ผู้รับ COD เวลา พิกัด หมายเหตุ รูป)
2. คำนวณความคืบหน้าเที่ยวใหม่ `tms_trip_manifest.completed_stops` = จำนวนจุดของเที่ยวที่เป็น `DELIVERED_POD`; สถานะเที่ยวเป็น `COMPLETED` เมื่อทุกจุดส่งแล้ว มิฉะนั้น `IN_TRANSIT`
3. เฉพาะตอนเป็น `DELIVERED_POD` และมี `wms_doc_no`: ถ้าใบงานคลังยังไม่ `SHIPPED` ให้ตั้งเป็น `SHIPPED` แล้วตัดสต็อกคลังจริง: ใส่ `OPENING` ถ้ายังไม่มี, บันทึก `wms_movement_log` ประเภท `OUTBOUND_SHIP` ปลายทาง "DOCK-OUT (ขึ้นรถขนส่ง)", Rebuild `physical_qty` ของช่อง, และลด `reserved_pick_qty` เท่าจำนวนในใบงาน (ทำเมื่อพบแถวช่องเก็บของสินค้า x ช่องนั้นเท่านั้น; ถ้าไม่พบแถวช่อง จะไม่บันทึกการเคลื่อนไหว) สูตรสมุดและการ Rebuild ดู [[sys-wms-stock-ledger-reconcile]]
4. เฉพาะตอนเป็น `DELIVERED_POD` และมีรหัสลูกค้า: เพิ่มแถว `crm_customer_activity` ช่องทาง "TMS e-POD" หัวข้อ "ส่งสินค้าสำเร็จ (เลขเที่ยว / บิล)" พร้อมผู้รับและรูป

ข้อสังเกต: ทางลัดนี้ปิดใบงานคลังเป็น `SHIPPED` เหมือนกัน แต่ชุดคำสั่งในไฟล์ TMS ไม่ได้อัปเดต `market_b2b_order` หรือจุดส่งตามที่ทางหยิบ-แพ็ค-ส่งของ WMS ทำ (ดู [[sys-wms-fulfillment-pick-pack-ship]]) ถ้าใบงานถูกปิดผ่านทาง TMS ให้ตรวจสถานะออเดอร์ร้านค้าส่งด้วย

## เปิดเที่ยวรถ (`POST /api/v1/tms/trip` แบบไม่ระบุ action)
- ฟิลด์: `route_name`, `vehicle_code`, `wms_doc_no`, `erp_inv_doc_no`, `cust_code`, `cust_name`, `delivery_address`, `ic_code`, `ic_name`, `qty`, `box_count`, `weight_kg`, `invoice_amount`, `distance_km`, `fuel_cost`, `toll_cost`, `driver_allowance`, `generate_sample_photo`, `sample_photo_count`
- ค่าตั้งต้นเมื่อไม่ส่ง: จำนวนกล่อง 4, น้ำหนัก 38 กก., ระยะทาง 54 กม., ค่าน้ำมัน 380, ทางด่วน 100, เบี้ยเลี้ยง 300, มูลค่าบิล 48,500 บาท และข้อมูลลูกค้า/สินค้าตัวอย่าง
- ค่าขนส่งรวม (`total_freight_cost`) = ค่าน้ำมัน + ค่าทางด่วน + เบี้ยเลี้ยง
- ทะเบียน/คนขับ: ตั้งค่าตัวอย่างไว้ก่อน แล้วถ้าพบแถวรถตาม `vehicle_code` ใน `tms_fleet_vehicle` จะใช้ข้อมูลของรถนั้นแทน
- เลขที่ `TRIP-<เวลา>` และ `STOP-<เวลา>` (รูปแบบ `HHMMSS` ดังนั้นเปิดสองเที่ยวในวินาทีเดียวกันได้เลขซ้ำ) เที่ยวใหม่มี 1 จุดส่ง `total_stops = 1`, สถานะเที่ยวและจุดส่งเริ่มที่ `IN_TRANSIT`, เวลาถึงโดยประมาณตั้งตายตัว 17:30
- transaction เดียว: แถวเที่ยว + แถวจุดส่ง + ตั้งรถเป็น `IN_TRANSIT` พร้อมน้ำหนักบรรทุกปัจจุบัน
- ปุ่ม "ปล่อยเที่ยวรถด่วน + ถ่ายรูปขึ้นรถ 3 มุม" บนหัวจอส่งเนื้อหาตัวอย่างตายตัว (เส้นทาง รถ ใบงาน ลูกค้า สินค้า ฯลฯ) พร้อม `generate_sample_photo` ไม่ได้เปิดฟอร์มให้กรอก การปล่อยรถจริงควรส่งค่าจริงเข้า `/api/tms/trip`

## ข้อควรระวัง
- เลื่อนจุดส่งไป `DELIVERED_POD` มีผลตัดสต็อกและเขียนกิจกรรม CRM ทันที ย้อนกลับด้วยการทำรายการใหม่ ไม่มีปุ่ม "ยกเลิกการส่งมอบ" ในโค้ดที่อ่าน
- ตัวเลขเป็น `float64` และ SQL ประกอบด้วย `escapeSQL` (ดู [[sys-tms-overview]])

## ที่มาในโค้ด
- `backend/internal/adapter/inbound/http/tms/handler.go:290-396` อ่านฟอร์ม/JSON และค้นจุดส่ง; `:396-440` เลือกสถานะถัดไปและค่า COD
- `backend/internal/adapter/inbound/http/tms/handler.go:440-503` รูปหลักฐานและ `UPDATE tms_delivery_stop`; `:504-513` คำนวณเที่ยวใหม่
- `backend/internal/adapter/inbound/http/tms/handler.go:513-577` ปิดใบงานคลังและตัดสต็อก; `:579-615` กิจกรรม CRM และ `ExecBatch`
- `backend/internal/adapter/inbound/http/tms/handler.go:1170-1340` สาขาเปิดเที่ยวรถ (ค่าตั้งต้น รูป transaction)
- `backend/internal/adapter/inbound/http/tms/handler.go:1647-1700` DDL เที่ยวและจุดส่ง; `:2080-2108` ป้ายรูปมาตรฐาน
- `backend/internal/adapter/inbound/http/market/handler.go:660-730` สั่งซื้อ /market สร้างใบงานคลังและจุดส่ง
- `frontend/tms/TmsDashboard.tsx:376-410` เลื่อนสถานะด่วน; `:411-440` ฟอร์ม e-POD; `:449-480` ปล่อยเที่ยวด่วน; `:2179-2215` ฟอร์มแท็บ 4
- ดูเพิ่ม: [[sys-tms-overview]] · [[sys-tms-fleet-maintenance]] · [[sys-wms-fulfillment-pick-pack-ship]] · [[sys-wms-stock-ledger-reconcile]] · [[flow-order-to-cash]] · [[api-business-modules]]
