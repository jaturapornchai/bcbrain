---
title: "แดชบอร์ด BI ตัวเลข KPI กราฟ และสูตรที่ใช้ (Executive KPI)"
tags: [systems, dashboard, kpi, charts]
aliases: ["Dashboard KPI", "KpiSummary", "dailyPoints", "donutSlices", "riskRows", "pipeline", "MotionCharts", "โหมดทีวีผู้บริหาร", "อัตรากำไรขั้นต้นประมาณการ", "ดัชนีสภาพคล่อง"]
sources: ["backend/internal/adapter/inbound/http/dashboard/handler.go:22-34", "backend/internal/adapter/inbound/http/dashboard/handler.go:117-203", "backend/internal/adapter/inbound/http/dashboard/handler.go:204-313", "frontend/dashboard/ExecutiveDashboard.tsx:48-70", "frontend/dashboard/ExecutiveDashboard.tsx:98-150", "frontend/dashboard/ExecutiveDashboard.tsx:176-232", "frontend/dashboard/ExecutiveDashboard.tsx:296-330", "frontend/dashboard/ExecutiveDashboard.tsx:418-436", "frontend/dashboard/ExecutiveDashboard.tsx:453-475", "frontend/dashboard/ExecutiveDashboard.tsx:600-815", "frontend/dashboard/ExecutiveDashboard.tsx:915-1010", "frontend/dashboard/MotionCharts.tsx:44", "frontend/dashboard/MotionCharts.tsx:123", "frontend/dashboard/MotionCharts.tsx:212", "frontend/dashboard/MotionCharts.tsx:483", "frontend/dashboard/MotionCharts.tsx:633", "frontend/dashboard/MotionCharts.tsx:708", "frontend/dashboard/MotionCharts.tsx:799"]
---
# ตัวเลข KPI กราฟ และสูตรของแดชบอร์ด BI

บันทึกนี้อธิบายว่าตัวเลขแต่ละตัวบน [[sys-dashboard-overview]] มาจากไหนและคำนวณอย่างไร เพื่อให้ผู้ใช้รู้ว่าตัวเลขไหนมาจากข้อมูลจริง และตัวเลขไหนเป็นค่าประมาณ

## การ์ดตัวเลข 6 ใบ (จาก SQL ชุดที่ 0)
Go รันคำสั่งเดียวที่ดึง 12 ค่า (ไม่มี `WHERE` ช่วงวันที่ ผลรวมทั้งตาราง):

| การ์ดบนจอ | แหล่งข้อมูล (ตามคำสั่ง SQL) |
|---|---|
| ยอดขายรวมสุทธิ (Sales Revenue) | ผลรวม `ic_trans.total_amount` ของ `trans_flag = 44` และจำนวนเอกสาร |
| ยอดสั่งซื้อและรับเข้าคลัง (Procurement) | ผลรวม `total_amount` ของ `trans_flag` 12 และ 32 และจำนวนเอกสาร |
| มูลค่าสินค้าคงคลังรวม (Inventory Value) | ผลรวม `ic_inventory.balance_qty x average_cost` และจำนวนรายการสินค้า |
| ธุรกรรมลูกหนี้การค้า (Accounts Receivable) | ผลรวม `ap_ar_trans.total_net_value` เมื่อ `trans_type = 2` และจำนวนแถว `ar_customer` |
| เจ้าหนี้การค้าคงค้าง (Accounts Payable) | ผลรวม `ap_supplier.debt_balance` และจำนวนแถว `ap_supplier` |
| กระแสเงินสดธนาคาร & ทะเบียนเช็ค | ผลรวม `cb_trans.total_net_amount` และผลรวม `cb_chq_list.amount` ทุกแถว |

ข้อสังเกต:
- ยอดขายนับเฉพาะ flag 44 (ไม่หักรับคืน/ลดหนี้) ส่วนยอดซื้อรวม flag 32 ซึ่งหน้าจอเรียกว่าใบสั่งซื้อ (PO) จึงรวมใบสั่งซื้อเข้าไปในยอด "สั่งซื้อและรับเข้า" ด้วย
- ผลรวมเช็คไม่แยกเช็ครับ/เช็คจ่าย และไม่แยกสถานะเช็ค (ดู [[term-cheque-status]]) ผลรวมเงินสด/ธนาคารก็ไม่ระบุบัญชี
- ความหมายของ `trans_flag` ดู [[term-trans-flag]]

## กราฟและรายการ
| ส่วนบนจอ | ข้อมูลจริงจาก SQL |
|---|---|
| แนวโน้มยอดขายเทียบยอดจัดซื้อรายวัน (กราฟเส้น 2 เส้น) | `ic_trans` จัดกลุ่มตาม `doc_date` เอา 14 วันล่าสุดที่มีเอกสาร (เรียงเก่าไปใหม่ตอนส่งกลับ) ยอดขาย = flag 44 และ 36 รวมกัน ยอดซื้อ = flag 12 และ 32 |
| สัดส่วนมูลค่าสินค้าตามหมวด (โดนัท) | `ic_inventory` จัดกลุ่มตาม `group_main` เชื่อม `ic_group` เอา 6 หมวดมูลค่าสูงสุด กำหนดสีวนตามชุดสีในโค้ด |
| 7 อันดับสินค้ามูลค่าคงคลังสูงสุด (แท่งแนวนอน) | `ic_inventory` เรียงตาม `balance_qty x average_cost` มากไปน้อย 7 รายการ ป้ายแสดง "คงเหลือ N หน่วย" |
| เรดาร์สินค้าใกล้หมด (ตาราง 6 แถว) | `ic_inventory` เรียงตามยอดคงเหลือน้อยไปมาก 6 รายการ เชื่อม `ic_wh_shelf.min_point` (ค่าเริ่มต้น 20 เมื่อไม่มี) และผู้ขาย/เวลานำของจาก `purchase_planning_item_supplier_setting` (ค่าเริ่มต้น 3 วัน) หน้าจอทำเครื่องหมาย "ควรสั่งซื้อเพิ่ม" เมื่อยอดคงเหลือ <= จุดต่ำสุด |
| เอกสารล่าสุด 8 รายการ | `ic_trans` เรียงวันที่แล้วลำดับแถวล่าสุด |
| ปริมาณเอกสารหมุนเวียน (pipeline) | `ic_trans` นับเอกสารและยอดรวมต่อ `trans_flag` เฉพาะ flag 44, 36, 40, 12, 32, 30 |

เรดาร์เลือก "6 รายการยอดคงเหลือต่ำสุด" เสมอ ไม่ได้กรองเฉพาะที่ต่ำกว่าจุดสั่งซื้อ แถวที่ไม่ต่ำกว่าจุดสั่งซื้อจึงแสดงด้วย แค่ไม่มีเครื่องหมายเตือน

## ตัวเลขที่เป็นค่าประมาณหรือค่าคงที่
คำนวณฝั่งหน้าจอ ไม่ใช่ตัวเลขทางบัญชี:
- **อัตรากำไรขั้นต้นประมาณการ** = (ยอดขาย - ยอดซื้อ x 0.68) / ยอดขาย x 100 จำกัดค่าระหว่าง 12 ถึง 65 และเป็น 28.5 เมื่อยอดขายเป็น 0 สัมประสิทธิ์ 0.68 เป็นค่าสมมติในโค้ด ไม่ใช่ต้นทุนขายจริง
- **ดัชนีสภาพคล่อง** = (ลูกหนี้ + เงินสด/ธนาคาร + เช็ค) / เจ้าหนี้ x 100 เป็น 145 เมื่อเจ้าหนี้เป็น 0 มาตรวัดวงแหวนแสดงค่า min(98.5, ดัชนี x 0.65)
- **ความพร้อมสต็อก (In-Stock Readiness)** บนมาตรวัดวงแหวนเป็นค่าคงที่ 94.2 ไม่ได้คำนวณจากข้อมูล
- ถ้าต้องการกำไรขั้นต้นจริงต้องใช้รายงานทางบัญชีหรือต้นทุนขายจากเอกสาร ไม่ใช่การ์ดนี้

## ป้ายชนิดเอกสาร (`flagBadge`) กับความหมายกลาง
ตารางเอกสารล่าสุดและ pipeline แปลง `trans_flag` เป็นป้ายภาษาไทยด้วยตารางในหน้าจอ: 44 ขายสินค้า/ใบกำกับ, 36 ใบสั่งขาย (SO), 40 ใบเสนอราคา (QT), 46 รับคืน/ลดหนี้ (CN), 12 ซื้อ/รับสินค้า (PU), 32 ใบสั่งซื้อ (PO), 30 ใบขอซื้อ (PR) ส่วนอื่นขึ้นป้าย "คลัง/ปรับปรุง (เลข flag)"

**จุดที่ควรตรวจ:** ความหมายนี้ไม่ตรงกับตารางชนิดเอกสารกลางในอีกหลายจุด (ตามหมายเหตุใน [[term-trans-flag]]: 30 คือใบเสนอราคาขาย (SO), 46 คือเพิ่มหนี้ขาย, 48 คือรับคืน/ลดหนี้ขาย, ใบสั่งซื้อ PO คือ flag 6 และใบขอซื้อ PR คือ flag 2) ฝั่ง Go ใช้ flag 32 และ 40 ในยอดซื้อและ pipeline ด้วย ซึ่งไม่อยู่ในตัวอย่างของตารางกลาง จึงควรตรวจว่า flag เหล่านี้ในฐานข้อมูลจริงหมายถึงเอกสารอะไรก่อนอ้างอิงป้ายบนแดชบอร์ด

## ที่มาของข้อมูลเมื่อเรียก API ไม่สำเร็จ
ถ้า `GET /api/dashboard/overview` ไม่สำเร็จหรือไม่มี `kpi` หน้าจอยิง SQL ชุดเดียวกันตรงผ่านเกตเวย์คิวรีของเบราว์เซอร์ (`queryBatch`) ความต่างที่เห็นในโค้ด: คำสั่ง pipeline ของชุดสำรองไม่กรอง flag (นับทุกชนิดเอกสาร) ต่างจากชุดที่ Go รัน (เฉพาะ 6 flag) ดังนั้นตัวเลข pipeline อาจต่างกันได้ตามเส้นทางที่ใช้งาน

## กราฟเคลื่อนไหว (`MotionCharts.tsx`)
ชุดคอมโพเนนต์วาดด้วยตัวเอง (มี `requestAnimationFrame` ในตัวนับเลข): `AnimatedNumber` (ตัวเลขวิ่ง), `MotionSparkline` (เส้นเล็กในการ์ด), `MotionDualSplineChart` (กราฟเส้นโค้งคู่ ซื้อ-ขาย), `MotionDonutGauge` (โดนัท), `MotionRaceBars` (แท่งวิ่ง), `MotionRadialScoreboard` (มาตรวัดวงแหวน 3 ค่า), `MotionSalesFunnel` (กรวยยอดขาย ถูกส่งออกไว้แต่ยังไม่มีจอใดในโค้ดเรียกใช้) ปุ่ม "เล่นกราฟซ้ำ" เพิ่ม `replayKey` ให้คอมโพเนนต์เล่นใหม่ หลักการแอนิเมชันของโปรเจกต์ดู [[std-motion-animation-rules]]

## โหมดทีวีผู้บริหาร
เมื่อเปิด ตัวจับเวลาสลับแท็บ `calendar`, `all`, `sales`, `inventory`, `finance` ตามลำดับทุก 12 วินาที พร้อมเล่นกราฟซ้ำทุกครั้งที่สลับ และเลิกทำงานเมื่อกดปุ่มซ้ำหรือออกจากหน้า

## ที่มาในโค้ด
- `backend/internal/adapter/inbound/http/dashboard/handler.go:22-34` ชุดสีโดนัท; `:117-203` SQL 7 ชุด; `:204-313` ประกอบผลลัพธ์ (กลับลำดับกราฟรายวัน)
- `frontend/dashboard/ExecutiveDashboard.tsx:48-70` ชนิดข้อมูล KPI; `:98-150` `flagBadge`; `:176-232` เรียก API ก่อน; `:296-330` ชุด SQL สำรอง (`queryBatch`)
- `frontend/dashboard/ExecutiveDashboard.tsx:418-436` โหมดทีวี; `:453-475` สูตรกำไรขั้นต้นประมาณการและสภาพคล่อง; `:600-815` การ์ดตัวเลข; `:915-1010` เรดาร์ มาตรวัด (ค่าคงที่ 94.2)
- `frontend/dashboard/MotionCharts.tsx:44,123,212,483,633,708,799` คอมโพเนนต์กราฟเคลื่อนไหว
- ดูเพิ่ม: [[sys-dashboard-overview]] · [[sys-dashboard-executive-calendar]] · [[term-trans-flag]] · [[tbl-ic-trans]] · [[tbl-ic-inventory]] · [[tbl-ap-ar-trans]] · [[std-data-integrity-money-transactions]]
