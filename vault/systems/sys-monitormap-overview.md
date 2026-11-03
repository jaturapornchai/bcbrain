---
title: "3D Monitor TV แผนที่ธุรกรรมประเทศไทย ภาพรวม (SYS-13 MonitorMap)"
tags: [systems, monitormap, 3d, command-center]
aliases: ["MonitorMap", "3D Monitor TV", "SYS-13", "/monitormap", "3D Thailand Command Center", "ThailandMonitorMapScreen", "BC AI Monitor Map"]
sources: ["frontend/shared/layout/SystemPortalScreen.tsx:77-82", "frontend/shared/layout/SystemPortalScreen.tsx:304-320", "frontend/shared/layout/Header.tsx:74-80", "frontend/shared/layout/Header.tsx:128", "frontend/shared/layout/PersistentWorkspaceHost.tsx:88-92", "frontend/shared/layout/PersistentWorkspaceHost.tsx:167-168", "frontend/src/app/monitormap/page.tsx:1-20", "frontend/src/proxy.ts:10-25", "frontend/src/app/api/monitormap/route.ts:11-26", "frontend/src/app/api/monitormap/route.ts:80-98", "frontend/src/app/api/monitormap/route.ts:321-417", "frontend/src/app/api/monitormap/route.ts:419-468", "backend/internal/adapter/inbound/http/router.go:351-358", "backend/internal/domain/query/write_policy_legacy.go:41-42"]
---
# 3D Monitor TV (SYS-13)

`MonitorMap` คือจอ "ศูนย์บัญชาการ 3 มิติ" ของ BC Ai Account วาดแผนที่ประเทศไทยด้วย Three.js แล้วแสดงคลังสินค้า รถขนส่งที่วิ่งอยู่ ร้านลูกค้า/สาขา POS เหตุการณ์สด และการแจ้งเตือนสำหรับผู้บริหาร เหมาะกับการเปิดค้างบนจอทีวีหรือจอใหญ่ในห้องประชุม รายละเอียดหน้าจอ 3 มิติอยู่ที่ [[sys-monitormap-3d-screen]] และตารางข้อมูลอยู่ที่ [[sys-monitormap-data-tables]]

## ใครใช้ / เปิดอย่างไร
- ผู้ใช้หลัก: เจ้าของ/ผู้บริหารที่อยากเห็นภาพรวมทั่วประเทศแบบเห็นภาพ และใช้เป็นจอโชว์ในห้องประชุมหรือหน้าร้าน
- เปิดจากหน้ารวมระบบ (Portal) การ์ด `SYS-13` "3D Monitor TV (แผนที่ธุรกรรม 3 มิติ)" ในกลุ่ม "④ 3D Command Center & ตรวจสอบ" ซึ่งลิงก์ไป `/monitormap` หรือจากแถบหัวระบบ "ระบบ 3D Monitor TV"
- หน้า `/monitormap` เป็น Server Page: ไม่มี session เด้งไป `/login`, ยังไม่เลือกฐานข้อมูลเด้งไป `/select-database` ถ้าผ่านจะวาง `WorkspaceRouteSync` แล้ว `PersistentWorkspaceHost` โหลดจอ `ThailandMonitorMapScreen` แบบโหลดตามต้องการ (ค้างสถานะเมื่อสลับระบบ ดู [[fe-tabs-workspace]])
- เมื่อเข้าทางโดเมนเดโม (`isBcDemoHost`) ด่าน `proxy` อนุญาตเฉพาะรายการเส้นทางที่กำหนด ซึ่งมี `/monitormap` อยู่ด้วย (อีก 2 ระบบในกลุ่มเดียวกันคือ `/workmonitor` และ `/fraudwarning`)

## ภาพรวมการทำงาน
1. จอเรียก Next.js `GET /api/monitormap` ทุก 20 วินาที (และครั้งแรกตอนเปิด)
2. route นี้หาโทเคนของฝั่งหลังบ้าน: ถ้ามี session ใช้ของผู้ใช้ ถ้าไม่มีจะขอโทเคนฐานเดโมให้อัตโนมัติ (ดูหัวข้อข้อควรระวัง)
3. ถ้าฐานเป็น `bcdemo` (หรือสั่ง `?reseed=1`) จะเรียก Go `/api/v1/crm/overview` ก่อนเพื่อให้มีตาราง `monitormap_*` แล้วหว่านข้อมูลตัวอย่างกับสร้างตาราง KPI สรุปด้วยคำสั่งชุดเดียว (`/query/execBatch`)
4. อ่านตาราง `monitormap_*` 6 ตาราง พร้อมดึงภาพรวม TMS, WMS, แดชบอร์ด และ POS มารวมในคำตอบเดียว (`source` เป็น `postgresql_live` ถ้ามีแถวคลัง ไม่เช่นนั้น `resilient_seed`)
5. หน้าจอแปลงคำตอบเป็นชุดข้อมูลโลก 3 มิติด้วย `buildMonitorWorldDataset` (รายละเอียดที่ [[sys-monitormap-data-tables]])
6. ผู้บริหารกด "สั่งการ" ที่การแจ้งเตือน: จอเปลี่ยนสถานะทันที แล้วส่ง `POST /api/monitormap` เพื่อบันทึกว่าแจ้งเตือนนั้นแก้ไขแล้ว (`RESOLVE_ALERT`, `RESET_ALERTS`, `APPROVE_ALL_ALERTS`)

## ความสัมพันธ์กับระบบบัญชีและระบบอื่น
- ชั้น Go มีเพียงตัวพร็อกซีและแคชแผ่นแผนที่ `GET/POST /api/v1/monitormap/tile` (GET ไม่ต้องล็อกอิน, POST เติมแคชต้องล็อกอิน) ดูรายละเอียดเต็มที่ [[api-ops-health-monitormap]] (ไม่เขียนซ้ำที่นี่) ส่วน `/api/monitormap` เป็นเส้นทางที่มีเฉพาะชั้น Next
- ตาราง `monitormap_*` เป็น "แคชที่สร้างจากข้อมูลดิบ" ไม่ใช่ข้อมูลบัญชีหลัก นโยบายเขียนของระบบจึงยกเว้นให้เขียนผ่านเกตเวย์คิวรีได้ด้วยคำนำหน้า `monitormap_` ดู [[adr-0011-query-exec-write-lockdown]] และ [[be-query-write-policy]]
- ข้อมูลภาพรวมของ [[sys-tms-overview]], [[sys-wms-overview]], [[sys-dashboard-overview]] และ POS ถูกดึงมาพ่วงในคำตอบ แต่ในโค้ดปัจจุบันตัวสร้างชุดข้อมูลของหน้าจอใช้เพียงเพื่อบอกว่า "เชื่อมต่อหลังบ้านได้" ตัวเลขที่เห็นบนแผนที่มาจากตาราง `monitormap_*` (ดู [[sys-monitormap-data-tables]])

## ข้อควรระวังและข้อจำกัด
- **ข้อมูลบนแผนที่ส่วนใหญ่เป็นข้อมูลตัวอย่าง**: การหว่านข้อมูล (คลัง 12 แห่ง ลูกค้า/สาขา 24 จุด รถ 22 คัน เหตุการณ์สด 12 รายการ แจ้งเตือน 8 รายการ) ทำเฉพาะฐาน `bcdemo` หรือเมื่อสั่ง `?reseed=1` ฐานอื่นจะได้แผนที่ว่างจนกว่าจะมีคนเติมตารางเอง
- **ปุ่ม "สั่งการ" ไม่ได้สร้างเอกสารจริง**: `POST /api/monitormap` มี 3 การกระทำ ทุกอันแค่แก้ `alert_status` ในตาราง `monitormap_sme_alerts` (เช่น ข้อความ "อนุมัติเปิด PO สั่งซื้อด่วน" ไม่ได้ไปสร้างใบสั่งซื้อ) ถ้าไม่มีโทเคนจะตอบ `{ ok: true, mode: "client_only" }` และเปลี่ยนสถานะเฉพาะบนหน้าจอ
- **ปุ่ม "ปล่อยรถด่วน" เป็นการสาธิตบนจอ**: บวกตัวเลขยอดขาย/เงินสดในหน้าจอชั่วคราวโดยไม่เรียก API หรือสร้างเอกสารจริง และตัวเลขหายเมื่อจอดึงข้อมูลรอบถัดไป ดู [[sys-monitormap-3d-screen]]
- ตัวเลขเงินในแผงผู้บริหารเป็นค่าคงที่ (ฐานเดโม) หรือค่าประมาณจากสูตร ไม่ใช่ผลทางบัญชี ดู [[sys-monitormap-data-tables]]

## ที่มาในโค้ด
- `frontend/shared/layout/SystemPortalScreen.tsx:77-82` กลุ่ม `command3d`; `:304-320` การ์ด SYS-13; `frontend/shared/layout/Header.tsx:74-80,128` ปุ่มหัวระบบ
- `frontend/shared/layout/PersistentWorkspaceHost.tsx:88-92,167-168` โหลดจอและจับคู่เส้นทาง; `frontend/src/app/monitormap/page.tsx:1-20` redirect ตาม session; `frontend/src/proxy.ts:10-25` รายการเส้นทางที่อนุญาตบนโดเมนเดโม
- `frontend/src/app/api/monitormap/route.ts:11-26` หาโทเคน; `:80-98` หว่านข้อมูลเฉพาะ `bcdemo`; `:321-417` GET; `:419-468` POST
- `backend/internal/adapter/inbound/http/router.go:351-358` เส้นทาง `/api/v1/monitormap`; `backend/internal/domain/query/write_policy_legacy.go:41-42` คำนำหน้า `monitormap_` เขียนได้
- ดูเพิ่ม: [[sys-monitormap-3d-screen]] · [[sys-monitormap-data-tables]] · [[api-ops-health-monitormap]] · [[std-thai-geo-map-bank-logos]] · [[fe-api-proxy-routes]]
