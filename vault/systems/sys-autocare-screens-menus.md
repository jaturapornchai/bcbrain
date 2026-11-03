---
title: "หน้าจอเว็บและผังเมนู 5 หมวดของ AutoCare (sys-autocare-screens-menus)"
tags: [systems, autocare, screens, menu, frontend]
aliases: ["AutoCareWorkspace", "เมนู AutoCare", "autocareMenuConfig", "AutoCareScreenContent", "ac_raw_intake", "ac_proc_checkout_gate"]
sources:
  - "frontend/autocare/autocareMenuConfig.ts:89-289"
  - "frontend/autocare/AutoCareWorkspace.tsx:51-69"
  - "frontend/autocare/AutoCareWorkspace.tsx:152-246"
  - "frontend/autocare/AutoCareWorkspace.tsx:1152-1162"
  - "frontend/autocare/AutoCareScreenContent.tsx:880-1078"
  - "frontend/autocare/AutoCareScreenContent.tsx:935-958"
  - "frontend/autocare/AutoCareScreenContent.tsx:1080"
  - "frontend/autocare/AutoCareScreenContent.tsx:3239-3256"
  - "frontend/autocare/autocareTypes.ts:281-322"
  - "frontend/src/app/api/autocare/overview/route.ts:28"
  - "frontend/src/app/api/autocare/action/route.ts:27"
  - "frontend/shared/layout/Header.tsx:107-108"
  - "backend/internal/adapter/inbound/http/autocare/handler.go:360-373"
---

# หน้าจอเว็บและผังเมนูของ AutoCare

## โครงหน้าจอ
`AutoCareWorkspace` คือหน้าหลักของ `/autocare` ด้านบนมีตัวเลือกโหมดธุรกิจ (`BUSINESS_MODES`, autocareTypes.ts:281-322) และช่องค้นหาเมนู ด้านซ้ายเป็นผังเมนูแบบ TreeView ที่ย่อได้ ตรงกลางเป็นแท็บของหน้าจอที่เปิดอยู่ ลากสลับลำดับแท็บได้ และมีกลุ่มเมนูที่ใช้บ่อย หัวเว็บแสดงชื่อ "ระบบ BC AutoCare (Web+Flutter)" (Header.tsx:107-108)

แท็บที่เปิดไว้ตั้งแต่ต้นมี 7 เมนู ได้แก่ 4.1, 2.1, 2.2, 2.3, 2.4, 1.1 และ 1.2 (AutoCareWorkspace.tsx:51-59)

## การดึงข้อมูล
- `loadOverview` เรียก `GET /api/autocare/overview?q=&mode=` ด้วย `cache: "no-store"` (AutoCareWorkspace.tsx:152-170) Next.js route จะส่งต่อไปที่ `${SERVICE_BASE_URL}/api/v1/autocare/overview` พร้อม Bearer token (overview/route.ts:28) ดู [[fe-api-proxy-routes]]
- ฝั่ง backend ใช้ `mode` กรองตาม `business_mode` ถ้า `q` มีตัวเลขอย่างน้อย 5 หลัก จะค้น `quick_size_digits` ด้วย เช่น พิมพ์ `2055516` เพื่อหายาง 205/55 R16 (handler.go:360-373)
- `runAction` ส่ง `POST /api/autocare/action` เมื่อสำเร็จจะแสดงข้อความแล้วโหลด Overview ใหม่ ถ้าคำตอบมี `job_no` จะเลือกใบงานนั้นให้ทันที (AutoCareWorkspace.tsx:215-246)

## ผังเมนู (autocareMenuConfig.ts:89-289)
หมวด 1 ข้อมูลหลักศูนย์บริการ
- 1.1 `ac_master_vehicles` รถยนต์ VIN และลูกหนี้ Fleet → `AutoCareVehicleScreen` <!-- pragma: allowlist secret -->
- 1.2 `ac_master_catalog_dot` ยาง ล้อแม็ก อะไหล่ และล็อต DOT <!-- pragma: allowlist secret -->
- 1.3 `ac_master_bays_techs` ช่องซ่อม ฮอยท์ และช่าง <!-- pragma: allowlist secret -->
- 1.4 `ac_master_coupons` แพ็กเกจคูปองสมาชิก <!-- pragma: allowlist secret -->

หมวด 2 งานรับรถและบริการหน้าร้าน
- 2.1 `ac_raw_intake` ใบรับรถและตรวจล้อแม็ก 4 ล้อ <!-- pragma: allowlist secret -->
- 2.2 `ac_raw_dvi_upsell` ตรวจ 35 จุดและเสนอซ่อมเพิ่ม (LINE OA) <!-- pragma: allowlist secret -->
- 2.3 `ac_proc_kanban_dispatch` กระดานคิวซ่อม → `AutoCareKanbanBoardScreen` <!-- pragma: allowlist secret -->
- 2.4 `ac_proc_checkout_gate` รับชำระเงิน ปิดบิล ออกใบกำกับภาษีขาย <!-- pragma: allowlist secret -->

หมวด 3 คลังสินค้า รับฝากยาง และงานเคลม
- 3.1 `ac_raw_blind_receiving` รับยางและอะไหล่เข้าคลังแบบปิดราคาทุน <!-- pragma: allowlist secret -->
- 3.2 `ac_raw_tire_hotel` รับฝากยางและเทิร์นยางเก่า <!-- pragma: allowlist secret -->
- 3.3 `ac_raw_warranty_coupon` เคลมส่งโรงงานและตัดคูปอง <!-- pragma: allowlist secret -->

หมวด 4 รายงานและวิเคราะห์ผล ดู [[sys-autocare-reports]]
- 4.1 `ac_res_executive_queue` แดชบอร์ดและจอคิวลูกค้า → `AutoCareExecutiveDashboardScreen` สลับเป็นโหมดรายงานตารางหรือ PDF ได้ (AutoCareScreenContent.tsx:3239-3256) <!-- pragma: allowlist secret -->
- 4.2 `ac_res_posted_ledger` ใบกำกับภาษีขาย สต็อกตัดจ่าย และ GL <!-- pragma: allowlist secret -->
- 4.3 `ac_res_dot_fefo_aging` สต็อกยางตาม DOT และ FEFO <!-- pragma: allowlist secret -->
- 4.4 `ac_res_tech_wallet` กระเป๋าเงินช่างและค่าคอม <!-- pragma: allowlist secret -->
- 4.5 `ac_res_warranty_crm` E-Warranty และแจ้งเตือนเช็กระยะ <!-- pragma: allowlist secret -->

หมวด 5 ประมวลผลระบบ
- 5.1 `ac_proc_master_rebuild` คำนวณข้อมูลใหม่ทั้งหมด → `AutoCareSystemProcessScreen` <!-- pragma: allowlist secret -->

## เมนูแต่ละตัวเปิดหน้าจอไหน (AutoCareScreenContent.tsx:880-1078)
- `ac_master_vehicles` เปิด `AutoCareVehicleScreen`
- เมนู 4.2 ถึง 4.5 เปิด `UniversalReportScreen` โหมดรายงานคือ `report_gl` สำหรับ 4.2, `report_ic` สำหรับ 4.3 และ `report_so` สำหรับเมนูอื่น ดู [[fe-report-screens]] <!-- pragma: allowlist secret -->
- หน้า 4.2 มีแถบปุ่มเลขใบกำกับ `bc_doc_no` สูงสุด 6 ใบ กดแล้วจะเปิด `DocumentFlowModal` ของ `ic_trans` ที่ trans_flag 44 (AutoCareScreenContent.tsx:935-958, AutoCareWorkspace.tsx:1152-1162) <!-- pragma: allowlist secret -->
- 4.1, 2.3 และ 5.1 มีหน้าจอเฉพาะของตัวเอง <!-- pragma: allowlist secret -->
- เมนูอื่นทั้งหมดใช้ `AutoCareSplitScreenWorkbench` (AutoCareScreenContent.tsx:1080) ซึ่งเป็นหน้ารายการคู่กับฟอร์มรายละเอียด ปุ่มบนฟอร์มเรียก action ตาม [[sys-autocare-job-flow]]

## ที่มาในโค้ด
- `frontend/autocare/autocareMenuConfig.ts:89-289`: กลุ่มและเมนู
- `frontend/autocare/AutoCareWorkspace.tsx:152-246`: loadOverview และ runAction
- `frontend/autocare/AutoCareScreenContent.tsx:880-1078`: เลือกหน้าจอตาม menuKey
- `frontend/src/app/api/autocare/action/route.ts:27`: ส่งต่อไป backend

ดูเพิ่ม: [[sys-autocare-overview]] · [[fe-tabs-workspace]] · [[scr-modal-document-item]] · [[sys-autocare-flutter-app]]
