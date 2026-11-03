---
title: "WMS สต็อกคลังจริง เทียบสต็อกบัญชี และโซน/ช่องเก็บ (Stock Ledger Reconcile)"
tags: [systems, wms, stock-ledger, reconcile]
aliases: ["สต็อกคลังจริง vs สต็อกบัญชี", "reconcile_status", "wms_stock_bin", "WmsBinRebuildSQL", "WmsBinOpeningSQL", "Bin Map", "ZONE-A", "variance_qty"]
sources: ["backend/internal/adapter/inbound/http/wms/handler.go:839-848", "backend/internal/adapter/inbound/http/wms/handler.go:849-866", "backend/internal/adapter/inbound/http/wms/handler.go:923-946", "backend/internal/adapter/inbound/http/wms/handler.go:997-1022", "backend/internal/adapter/inbound/http/wms/handler.go:1024-1060", "backend/internal/adapter/inbound/http/wms/handler.go:1062-1066", "backend/internal/adapter/inbound/http/wms/handler.go:1885-1897", "backend/internal/adapter/inbound/http/wms/handler.go:1119-1124", "backend/internal/adapter/inbound/http/wms/handler.go:1169-1178", "backend/internal/adapter/inbound/http/wms/handler.go:1208-1286", "backend/internal/adapter/inbound/http/wms/handler.go:1288-1300", "backend/internal/adapter/inbound/http/wms/handler.go:1430-1439", "backend/internal/adapter/inbound/http/wms/handler.go:1971-2048", "backend/internal/application/process/transcalc.go:16-24", "frontend/wms/WmsDashboard.tsx:2326", "frontend/wms/WmsDashboard.tsx:2580"]
---
# สต็อกคลังจริง เทียบสต็อกบัญชี (แท็บ 2 และ 3 ของ WMS)

หน้าที่ของแท็บนี้คือตอบว่า "ของที่อยู่ในโกดังจริง" ตรงกับ "ยอดสต็อกในบัญชี" หรือไม่ ภาพรวมระบบอยู่ที่ [[sys-wms-overview]]

## สต็อกคลังจริงคำนวณอย่างไร (สมุดความเคลื่อนไหว)
`wms_stock_bin.physical_qty` ไม่ได้ถูกแก้ตรง ๆ แต่ถูก **สร้างใหม่จาก `wms_movement_log`** ทุกครั้งที่เรียก Overview และทุกครั้งที่มีการเคลื่อนไหว:
1. `WmsBinOpeningSQL` ใส่แถว `OPENING` หนึ่งแถวต่อ "สินค้า x ช่อง" เท่ากับยอดปัจจุบันลบผลรวมความเคลื่อนไหวที่ไม่ใช่ OPENING (ใส่ครั้งเดียว ไม่ซ้ำเพราะมี `WHERE NOT EXISTS`)
2. `WmsBinRebuildSQL` ตั้ง `physical_qty` = OPENING + ผลรวมแบบมีเครื่องหมายของความเคลื่อนไหว

| move_type | ผลต่อช่อง |
|---|---|
| `INBOUND_PUTAWAY` | + qty ที่ช่องปลายทาง |
| `OUTBOUND_SHIP` | - qty ที่ช่องต้นทาง |
| `ADJUST` | + qty (ค่าติดลบได้) ที่ช่องปลายทาง |
| `CYCLE_COUNT` | + (ยอดหลัง - ยอดก่อน) ที่ช่องปลายทาง |
| `BIN_TRANSFER` | + ที่ช่องปลายทาง, - ที่ช่องต้นทาง (เมื่อสองช่องต่างกัน) |

สูตร Rebuild ไม่มีการตัดค่าติดลบให้เป็น 0 (ไม่ใช้ `GREATEST(0, ...)`) เพื่อให้สต็อกติดลบถูกเห็นและขึ้นเตือนแทนที่จะถูกซ่อน (ดูคอมเมนต์ที่ `WmsBinRebuildSQL`)

## สต็อกบัญชีคำนวณอย่างไร
คิวรีที่ 1 ของ `buildOverview` รวม `qty` ใน `ic_trans_detail` ต่อ `item_code` เฉพาะแถวที่ `COALESCE(last_status,0)=0`:
- flag `12, 54, 56, 60, 66` นับเป็น **+qty**
- flag `44, 46, 16, 58, 68` นับเป็น **-qty**
- flag อื่นไม่นับ (ความหมายของ flag ดู [[term-trans-flag]])

ข้อสังเกตเมื่อเทียบกับตารางทิศทางสต็อกกลางของแบ็กเอนด์ (`transcalc.go`): ตารางนั้นนับ flag 58 เป็น +1 และ flag 56 เป็น -1 ซึ่งตรงข้ามกับ SQL ของ WMS ที่นับ 56 เป็น + และ 58 เป็น - ควรตรวจก่อนนำยอดบัญชีบนจอ WMS ไปใช้อ้างอิงเมื่อฐานข้อมูลมีเอกสาร flag 56/58

## สถานะการกระทบยอดต่อสินค้า (`reconcile_status`)
สำหรับแต่ละแถวช่องเก็บ ระบบคำนวณ:
- ยอดจอง = ผลรวม qty ของใบงานที่ยังไม่ SHIPPED (ถ้าไม่มี ใช้ `reserved_pick_qty` ของช่อง)
- ยอดพร้อมจ่าย = ยอดจริง - ยอดจอง
- ยอดบัญชี (`erp_accounting_qty`): ถ้าไม่มียอดบัญชี หรือยอดบัญชี <= 0 ระบบใช้ "ยอดจริง - ยอดจอง" แทน (ผลคือแถวนั้นจะแสดงว่าตรงกัน)
- ยอดที่ควรเป็น = ยอดบัญชี + ยอดจอง; ส่วนต่าง (`variance_qty`) = ยอดจริง - ยอดที่ควรเป็น

| เงื่อนไข (ตามลำดับที่ตรวจ) | ข้อความสถานะ |
|---|---|
| ยอดจริงติดลบ | เตือน: สต็อกคลังจริงติดลบ |
| ยอดพร้อมจ่ายติดลบ | เตือน: ยอดพร้อมจ่ายติดลบ |
| ยอดจอง > 0 และส่วนต่างเกือบ 0 | "ตัดบัญชีแล้ว · รอคลังส่ง N" (นับเป็นตรงกัน) |
| ส่วนต่างเกือบ 0 | "ตรงกัน 100% (Synced)" |
| ส่วนต่าง > 0 | "คลังจริงมากกว่าบัญชี (+N)" |
| ส่วนต่าง < 0 | "คลังจริงน้อยกว่าบัญชี (N)" |

## ตัวชี้วัดบนหัวจอ (มีค่าตั้งต้นในโค้ด)
- `accuracy_rate` = จำนวนสินค้าที่ตรงกัน / จำนวนสินค้าทั้งหมด x 100 แต่ถ้าไม่มีแถวสต็อกเลยจะได้ 99.2 และถ้าค่าที่คำนวณได้ต่ำกว่า 92.0 ระบบจะแสดง 96.5 แทน
- `capacity_utilization_pct` = ยอดจริงรวม / ความจุรวม x 100 (สูงสุด 100) ถ้าไม่มีความจุเลยแสดง 68.5; ช่องที่ความจุ <= 0 ใช้ 500 เป็นค่าตั้งต้น
- ดังนั้นตัวเลขความแม่นยำที่ดีเกินจริงอาจมาจากค่าตั้งต้นดังกล่าว ไม่ใช่ผลกระทบยอดจริงเสมอไป

## โซนและช่องเก็บ (แท็บ Bin Map)
Overview ส่งสรุป 4 โซนเสมอ (เรียง A-D):
- ZONE-A Fast-Moving (Golden Zone, FEFO)
- ZONE-B Heavy Pallet Rack (FIFO)
- ZONE-C Climate & High-Value (ควบคุมอุณหภูมิ/ล็อกนิรภัย)
- ZONE-D Cross-Dock & Staging (จุดพักรอขึ้นรถ)
- แต่ละโซนมียอดรวมและร้อยละการใช้ความจุ (ปัดทศนิยม 1 ตำแหน่ง สูงสุด 100)
- รหัสช่องมีรูปแบบ `<โซน>-<แถว>-<ชั้น>` เช่น `A-01-01` แถวที่ไม่มี `zone_code` ถูกนับเข้า ZONE-A
- เมื่อรับเข้า/ย้ายไปช่องใหม่ ระบบเดาโซนจากอักษรตัวแรกของชื่อช่อง (B, C, D ไปโซนนั้น ตัวอื่นไป ZONE-A) ด้วย `deriveZoneFromBin`

## ข้อมูลตัวอย่าง
เฉพาะฐาน `bcdemo` ระบบลบข้อมูลสามตาราง WMS แล้ว seed ใหม่ (รายการสินค้า 10 รายการจาก `ic_inventory` กระจายใน 10 ช่องของ 4 โซน) โดยทำครั้งเดียวต่อฐาน (`seedDone`) ฐานอื่นสร้างตารางแล้วหยุด ไม่ใส่ข้อมูล

## ที่มาในโค้ด
- `backend/internal/adapter/inbound/http/wms/handler.go:839-848` Opening+Rebuild ทุกครั้งที่ประกอบ Overview; `:849-866` คิวรียอดช่องและยอดบัญชี
- `backend/internal/adapter/inbound/http/wms/handler.go:997-1022` นิยาม 4 โซน; `:1024-1060` ยอดจอง ยอดบัญชี ส่วนต่าง และข้อความสถานะ
- `backend/internal/adapter/inbound/http/wms/handler.go:1169-1178` ค่าตั้งต้น accuracy และ capacity
- `backend/internal/adapter/inbound/http/wms/handler.go:1288-1300` เงื่อนไข seed เฉพาะ `bcdemo`; `:1430-1439` ช่องเก็บตัวอย่าง
- `backend/internal/adapter/inbound/http/wms/handler.go:1971-2048` สูตรผลรวมแบบมีเครื่องหมาย, `WmsBinOpeningSQL`, `WmsBinRebuildSQL`
- `backend/internal/application/process/transcalc.go:16-24` ตารางทิศทางสต็อกกลางที่ใช้เทียบข้อสังเกต flag 56/58
- `frontend/wms/WmsDashboard.tsx:2326` เนื้อหาแท็บสต็อก; `:2580` แท็บ Bin Map
- ดูเพิ่ม: [[sys-wms-overview]] · [[sys-wms-movements-evidence-photos]] · [[sys-wms-fulfillment-pick-pack-ship]] · [[term-trans-flag]] · [[tbl-ic-trans-detail]] · [[flow-stock-movement-cost]]
