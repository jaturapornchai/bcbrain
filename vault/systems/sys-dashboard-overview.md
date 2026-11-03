---
title: "แดชบอร์ด BI ผู้บริหาร ภาพรวม (SYS-09 Executive Dashboard)"
tags: [systems, dashboard, bi, executive]
aliases: ["Dashboard", "แดชบอร์ด BI", "Executive Dashboard", "SYS-09", "/dashboard", "ExecutiveDashboard", "GET /api/v1/dashboard/overview"]
sources: ["frontend/src/app/dashboard/page.tsx:1-16", "frontend/shared/layout/SystemPortalScreen.tsx:233-248", "frontend/shared/layout/Header.tsx:110", "frontend/shared/layout/PersistentWorkspaceHost.tsx:44-46", "frontend/shared/layout/PersistentWorkspaceHost.tsx:554", "frontend/dashboard/index.ts:1-3", "frontend/dashboard/ExecutiveDashboard.tsx:42-52", "frontend/dashboard/ExecutiveDashboard.tsx:507-530", "frontend/dashboard/ExecutiveDashboard.tsx:595-598", "frontend/src/app/api/dashboard/overview/route.ts:1-57", "backend/internal/adapter/inbound/http/router.go:250-256", "backend/internal/adapter/inbound/http/dashboard/handler.go:36", "backend/internal/adapter/inbound/http/dashboard/handler.go:110-118"]
---
# แดชบอร์ด BI ผู้บริหาร (SYS-09)

แดชบอร์ดคือหน้า "สรุปภาพรวมธุรกิจ" ของ BC Ai Account สำหรับเจ้าของกิจการและผู้บริหาร ดึงตัวเลขจากเอกสารซื้อ-ขาย สต็อก ลูกหนี้ เจ้าหนี้ และเงินสด/เช็ค มาแสดงเป็นการ์ดตัวเลขเคลื่อนไหวและกราฟ พร้อมแท็บ "ปฏิทินปฏิบัติการ" ที่เป็นหน้าแรก

## ใครใช้ / เปิดอย่างไร
- ผู้ใช้หลัก: เจ้าของ/ผู้บริหาร/หัวหน้าฝ่ายที่ต้องการดูตัวเลขรวมและงานค้างประจำเดือน (ใช้เป็นจอทีวีในห้องประชุมได้ด้วยโหมดทีวีผู้บริหาร)
- เปิดจากหน้ารวมระบบ (Portal) การ์ด `SYS-09` "แดชบอร์ด BI" กลุ่ม "growth" ซึ่งลิงก์ไป `/dashboard` หรือจากแถบหัวระบบ "ระบบ แดชบอร์ด BI"
- หน้า `/dashboard` เป็น Server Page: ไม่มี session เด้งไป `/login`, ยังไม่เลือกฐานข้อมูลเด้งไป `/select-database` ถ้าผ่านจะวาง `WorkspaceRouteSync` แล้ว `PersistentWorkspaceHost` แสดงจอ `ExecutiveDashboard` (ค้างสถานะเมื่อสลับระบบ ดู [[fe-tabs-workspace]])

## 5 แท็บในจอ
| แท็บ (id) | ชื่อบนจอ | เนื้อหา |
|---|---|---|
| `calendar` (ค่าเริ่มต้น) | ปฏิทินปฏิบัติการ (Calendar) | ปฏิทินงานประจำเดือน เอกสาร เช็ค และภารกิจ ดู [[sys-dashboard-executive-calendar]] |
| `all` | ภาพรวม 360° | แสดงทุกส่วนด้านล่าง |
| `sales` | ยอดขาย & ลูกหนี้ | ส่วนกราฟ: เส้นยอดขายเทียบยอดซื้อรายวัน และโดนัทมูลค่าสินค้าตามหมวด |
| `inventory` | คลัง & จัดซื้อ | ทั้งส่วนกราฟและส่วนรายการ |
| `finance` | การเงิน & เช็ค | ส่วนรายการ: 7 สินค้ามูลค่าสูงสุด เรดาร์สินค้าใกล้หมด เอกสารล่าสุด และมาตรวัด |

การ์ดตัวเลข 6 ใบ (ยอดขาย, มูลค่าสินค้าคงคลัง, ยอดสั่งซื้อ/รับเข้า, ลูกหนี้, เจ้าหนี้, กระแสเงินสด & เช็ค) แสดงอยู่ในทุกแท็บ

ปุ่มควบคุมบนแถบบน: "โหมดทีวีผู้บริหาร" (สลับ 5 แท็บอัตโนมัติทุก 12 วินาที), "เล่นกราฟซ้ำ" (เล่นแอนิเมชันใหม่), "ซิงค์ข้อมูล" (โหลดตัวเลขใหม่) รายละเอียดตัวเลขและกราฟดู [[sys-dashboard-executive-bi-kpi]]

## ข้อมูลที่อ่าน (อ่านอย่างเดียว ไม่สร้างตาราง)
แดชบอร์ดไม่มีตารางของตัวเอง และไม่เขียนข้อมูล อ่านจากตารางหลักของบัญชี:
- `ic_trans` (เอกสารซื้อ-ขาย-สต็อก แยกชนิดด้วย `trans_flag` ดู [[term-trans-flag]], [[tbl-ic-trans]])
- `ic_inventory`, `ic_group`, `ic_wh_shelf` (สต็อกและจุดสั่งซื้อ ดู [[tbl-ic-inventory]], [[tbl-ic-wh-shelf]])
- `ap_ar_trans`, `ar_customer`, `ap_supplier` (ลูกหนี้ เจ้าหนี้ ดู [[tbl-ap-ar-trans]], [[tbl-ap-supplier]])
- `cb_trans`, `cb_chq_list` (เงินสด/ธนาคาร และทะเบียนเช็ค ดู [[tbl-cb-trans]], [[tbl-cb-chq-list]])
- `purchase_planning_item_supplier_setting` (ผู้ขายหลักและเวลานำของ ใช้ในเรดาร์สินค้าใกล้หมด)

## API และการเชื่อมต่อ
- จอเรียก Next.js `GET /api/dashboard/overview` (ตรวจ session แล้วส่งต่อ Go ด้วย token; ไม่มี token ตอบ `NO_TOKEN`) ดู [[fe-api-proxy-routes]]
- Go (chi) `GET /api/v1/dashboard/overview` หลัง `Auth` รัน SQL 7 ชุดในรอบเดียว (`Batch`) แล้วคืน JSON คีย์ `kpi`, `dailyPoints`, `donutSlices`, `topItems`, `riskRows`, `recentDocs`, `pipeline` ดู [[api-business-modules]]
- ถ้าเรียกชุดนี้ไม่สำเร็จ หน้าจอสำรองด้วยการยิง SQL ชุดเดียวกันผ่านเกตเวย์คิวรีของเบราว์เซอร์ (`queryBatch`) ดู [[fe-query-client-sql-builder]]
- แท็บปฏิทินและการ์ดตัวเลขลิงก์ต่อไปยังเมนูอื่นของระบบ เช่น `/home?open=<รหัสเมนู>`, `/wms`, `/tms`, `/etax`, `/crm`, `/procure` ดู [[sys-wms-overview]] และ [[sys-tms-overview]]

## ข้อจำกัดที่ควรรู้
- ตัวเลขทั้งหมดเป็นผลรวมทั้งตาราง **ไม่มีตัวกรองช่วงวันที่** และไม่กรองสถานะเอกสาร (เช่น เอกสารยกเลิก) ในคำสั่ง SQL ที่อ่านได้ ดูประเด็นสถานะเอกสารที่ [[term-last-status-cancel-approve]]
- มีตัวเลขที่เป็น "ค่าประมาณ/ค่าคงที่" บนหน้าจอ (อัตรากำไรขั้นต้นประมาณการ ความพร้อมสต็อก) ไม่ใช่ผลทางบัญชี ดู [[sys-dashboard-executive-bi-kpi]]
- ตัวเลขเงินคำนวณด้วย `float64` ฝั่ง Go และ `Number` ฝั่งหน้าจอ เหมาะกับการแสดงผลสรุป ไม่ควรใช้เป็นตัวเลขกระทบยอด (หลักการเงินดู [[std-data-integrity-money-transactions]])
- รุ่นของระบบ (edition) มีผลกับปฏิทิน: งานบัญชีแยกประเภทและสินทรัพย์ถาวรแสดงเมื่อรุ่นที่ใช้รองรับ ดู [[sys-dashboard-executive-calendar]]

## ที่มาในโค้ด
- `frontend/src/app/dashboard/page.tsx:1-16` redirect ตาม session และวาง `WorkspaceRouteSync`
- `frontend/shared/layout/SystemPortalScreen.tsx:233-248` การ์ด SYS-09; `frontend/shared/layout/Header.tsx:110` ปุ่มหัวระบบ; `frontend/shared/layout/PersistentWorkspaceHost.tsx:44-46,554` โหลดและติดตั้ง `ExecutiveDashboard`
- `frontend/dashboard/index.ts:1-3` ส่งออก `ExecutiveDashboard`, `ExecutiveCalendar` และ `MotionCharts`
- `frontend/dashboard/ExecutiveDashboard.tsx:48` ชนิดแท็บ; `:507-530` ปุ่มแท็บ; `:595-598` ปฏิทินเป็นหน้าแรก
- `frontend/src/app/api/dashboard/overview/route.ts:1-57` proxy ไป Go
- `backend/internal/adapter/inbound/http/router.go:250-256` เส้นทาง `/api/v1/dashboard`; `backend/internal/adapter/inbound/http/dashboard/handler.go:110-118` ตัวจัดการ `Overview`
- ดูเพิ่ม: [[sys-dashboard-executive-bi-kpi]] · [[sys-dashboard-executive-calendar]] · [[std-motion-animation-rules]] · [[api-business-modules]] · [[backend-overview]]
