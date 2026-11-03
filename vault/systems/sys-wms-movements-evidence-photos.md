---
title: "WMS รับเข้า ย้ายช่อง ตรวจนับ และรูปหลักฐาน (CreateMovement)"
tags: [systems, wms, movement, cycle-count, evidence-photos]
aliases: ["WMS movement", "INBOUND_PUTAWAY", "BIN_TRANSFER", "CYCLE_COUNT", "ADJUST", "POST /api/v1/wms/movement", "wms_movement_log", "รูปหลักฐานคลัง", "wms_evidence", "wms_move"]
sources: ["backend/internal/adapter/inbound/http/wms/handler.go:534-560", "backend/internal/adapter/inbound/http/wms/handler.go:596-690", "backend/internal/adapter/inbound/http/wms/handler.go:690-760", "backend/internal/adapter/inbound/http/wms/handler.go:762-837", "backend/internal/adapter/inbound/http/wms/handler.go:1256-1286", "backend/internal/adapter/inbound/http/wms/handler.go:1748-1790", "backend/internal/adapter/inbound/http/wms/handler.go:1829-1884", "backend/internal/adapter/inbound/http/wms/handler.go:2050-2062", "frontend/wms/WmsDashboard.tsx:2743", "frontend/wms/WmsDashboard.tsx:3435-3440", "frontend/src/app/api/wms/movement/route.ts:1-60"]
---
# รับเข้า ย้ายช่อง ตรวจนับ และรูปหลักฐานของ WMS

แท็บ "4. รับเข้า · ย้ายช่อง · ตรวจนับ" ของ [[sys-wms-overview]] บันทึกการเคลื่อนไหวของสต็อกจริงลงสมุด `wms_movement_log` ผ่าน `POST /api/v1/wms/movement` (Next proxy: `/api/wms/movement`) รับได้ทั้ง JSON และ multipart ที่แนบรูป

## ประเภทการเคลื่อนไหว (`move_type`)
| ค่า | ใช้เมื่อ | พฤติกรรม |
|---|---|---|
| `INBOUND_PUTAWAY` (ค่าเริ่มต้น) | รับของเข้าและจัดเก็บขึ้นชั้น | จำนวน `qty` <= 0 ใช้ 50; ยอดช่องเพิ่ม; ลด `inbound_putaway_qty` ของช่องปลายทาง; ต้นทางแสดงเป็น "DOCK-IN (หน้าท่ารับของ)"; เลขที่ขึ้นต้น `WMS-PUT` |
| `BIN_TRANSFER` | ย้ายช่องเก็บ | `qty` <= 0 ใช้ยอดทั้งหมดของช่องต้นทาง; ลดช่องต้นทาง เพิ่มช่องปลายทาง; เลขที่ `WMS-TRF` |
| `CYCLE_COUNT` | ตรวจนับ | ค่า `qty` คือ "ยอดที่นับได้"; ระบบบันทึกเป็น `ADJUST` ด้วยส่วนต่าง (นับได้ - ยอดเดิม); เลขที่ `WMS-CNT` |
| `ADJUST` | ปรับยอด | บวก `qty` (ติดลบได้) เข้ายอดเดิม |

กติการ่วม:
- บังคับ `ic_code` ไม่ส่งตอบ 400 "กรุณาเลือกรหัสสินค้า" ถ้าสินค้าไม่มีแถวช่องเก็บใน `wms_stock_bin` ตอบ 404 "ไม่พบสินค้าในระบบคลัง WMS"
- ถ้าช่องปลายทางยังไม่มี ระบบสร้างแถวช่องใหม่ยอด 0 (`WmsEnsureTargetBinSQL`) และกำหนดโซนจากอักษรตัวแรกของชื่อช่อง
- ผู้ปฏิบัติงาน (`staff_name`) ถ้าไม่ส่งจะใช้ชื่อตัวอย่างในโค้ด และเอกสารอ้างอิง (`ref_erp_doc`) ถ้าไม่ส่งจะใช้ค่า `PO/REF-<วันเดือน>`
- ทุกครั้งทำใน `ExecBatch` ชุดเดียว: Opening, (สร้างช่อง), บันทึกสมุด, ปรับช่อง, Rebuild ยอดช่องจากสมุด ดังนั้นยอดช่องกับสมุดตรงกันเสมอ (สูตรดู [[sys-wms-stock-ledger-reconcile]])
- คอลัมน์ `erp_accounting_qty` ในสมุดของ endpoint นี้ถูกเก็บเป็นยอดจริงก่อนทำรายการ ไม่ใช่ยอดจากบัญชี ใช้อ้างอิงยอดบัญชีจริงจาก Overview แทน

## ตาราง `wms_movement_log`
เก็บเลขที่เอกสารเคลื่อนไหว ประเภท เอกสารอ้างอิง สินค้า ต้นทาง/ปลายทาง จำนวน ยอดก่อน/หลัง ผู้ปฏิบัติ หมายเหตุ key รูปแรก และ JSON อัลบั้มรูป (`evidence_photos_json`) Overview ส่งกลับ 30 รายการล่าสุด

## รูปหลักฐานหลายมุม
- แต่ละขั้นมีป้ายกำกับรูปมาตรฐานเป็นภาษาไทย 3-4 รูป เช่น ขั้นรับเข้า: รถเทียบท่า, แกะตรวจนับ, จัดเก็บขึ้นชั้น, ใบส่งของซัพพลายเออร์ (ฟังก์ชัน `defaultStepPhotoLabels`)
- ไฟล์ที่อัปโหลดถูกตรวจชนิดจากเนื้อไฟล์ (JPEG, PNG, WebP; อื่น ๆ ถือเป็น PNG) เก็บใน MinIO ที่ key `<ฐานข้อมูล>/<โฟลเดอร์>/<เวลา>_<แฮช 14 ตัว>.<นามสกุล>` พร้อมสร้างภาพย่อ `.thumb.jpg`
- โฟลเดอร์ใน MinIO: ขั้นหยิบ-แพ็ค-ส่งใช้ `wms_evidence` ส่วนรับเข้า/ย้าย/นับใช้ `wms_move` (เป็นชื่อโฟลเดอร์ในที่เก็บไฟล์ ไม่ใช่ตารางฐานข้อมูล)
- ฐานข้อมูลเก็บเฉพาะ key และ metadata; หน้าจอเรียกรูปผ่านพร็อกซี `/api/crm/image?key=...` (เพิ่ม `&variant=thumbnail` สำหรับภาพย่อ) ซึ่งเป็นเส้นทางของโมดูล CRM
- รูปตัวอย่างอัตโนมัติ: ขั้นหยิบ-แพ็ค-ส่งสร้างให้เองเมื่อไม่แนบรูป (ดู [[sys-wms-fulfillment-pick-pack-ship]]) ส่วน movement สร้างให้เมื่อส่ง `generate_sample_photo` เท่านั้น (ค่าตั้งต้น 3 รูป สูงสุด 5)
- ถ้าเขียนไฟล์ขึ้น MinIO ไม่สำเร็จ ฟังก์ชันเก็บรูปจะคืน key เดิมโดยไม่แจ้งข้อผิดพลาด (โค้ดไม่ได้ส่ง error ออกมา) จึงควรตรวจว่ารูปเปิดได้จริงในอัลบั้ม
- หน้าจอมีอัลบั้มรูป (lightbox) เปิดดูทุกรูปของใบงานหรือรายการเคลื่อนไหว

## ที่มาในโค้ด
- `backend/internal/adapter/inbound/http/wms/handler.go:534-560` ตัวจัดการ `CreateMovement` และอ่านฟอร์ม multipart; `:596-690` อ่าน JSON, ตรวจ `ic_code`, หาแถวช่องเก็บ, ค่าตั้งต้น
- `backend/internal/adapter/inbound/http/wms/handler.go:690-760` สาขาตาม `move_type`; `:762-837` รูป เลขที่เอกสาร และ transaction
- `backend/internal/adapter/inbound/http/wms/handler.go:1256-1286` DDL `wms_movement_log`
- `backend/internal/adapter/inbound/http/wms/handler.go:1748-1790` ป้ายรูปมาตรฐาน; `:1829-1884` เก็บรูปลง MinIO และสร้าง URL พร็อกซี; `:2050-2062` `WmsEnsureTargetBinSQL`
- `frontend/wms/WmsDashboard.tsx:2743` เนื้อหาแท็บรับเข้า/ย้าย/นับ; `:3435-3440` อัลบั้มรูป
- ดูเพิ่ม: [[sys-wms-overview]] · [[sys-wms-stock-ledger-reconcile]] · [[sys-wms-fulfillment-pick-pack-ship]] · [[api-business-modules]] · [[flow-stock-movement-cost]]
