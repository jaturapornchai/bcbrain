---
title: "ระบบคลังสินค้า WMS ภาพรวม (SYS-06 Smart WMS)"
tags: [systems, wms, warehouse]
aliases: ["WMS", "ระบบคลังสินค้า", "Smart WMS", "SYS-06", "/wms", "wms_stock_bin", "wms_fulfillment_order"]
sources: ["frontend/src/app/wms/page.tsx:12-15", "frontend/shared/layout/SystemPortalScreen.tsx:178-193", "frontend/shared/layout/PersistentWorkspaceHost.tsx:554-568", "backend/internal/adapter/inbound/http/router.go:279-285", "backend/internal/adapter/inbound/http/wms/handler.go:1-8", "backend/internal/adapter/inbound/http/wms/handler.go:182-215", "backend/internal/adapter/inbound/http/wms/handler.go:1208-1286", "frontend/wms/WmsDashboard.tsx:176", "frontend/src/app/api/wms/overview/route.ts:1-57"]
---
# ระบบคลังสินค้า WMS (SYS-06 Smart WMS)

WMS คือระบบ "คลังสินค้าจริง" ของ BC Ai Account ใช้บันทึกว่าสินค้าอยู่ช่องไหนของโกดัง หยิบ-แพ็ค-ส่งไปแล้วเท่าไร และมีรูปถ่ายหลักฐานทุกขั้น โดยเก็บ **สต็อกคลังจริง** แยกจาก **สต็อกบัญชี** (ที่คำนวณจาก `ic_trans_detail`) แล้วนำสองตัวเลขมาเทียบกันบนหน้าจอเดียวกัน

## ใครใช้ / เปิดอย่างไร
- ผู้ใช้หลัก: พนักงานคลัง (หยิบ แพ็ค ขึ้นรถ รับเข้า ย้ายช่อง ตรวจนับ) และผู้จัดการคลังที่ดูความตรงกันของสต็อกจริงกับบัญชี
- เปิดจากหน้ารวมระบบ (Portal) การ์ด `SYS-06` กลุ่ม "supply" ซึ่งลิงก์ไป `/wms` หรือจากแถบหัวระบบ "ระบบ คลัง WMS"
- หน้า `/wms` เป็น Server Page: ไม่มี session จะเด้งไป `/login`, ยังไม่เลือกฐานข้อมูลจะเด้งไป `/select-database` ถ้าผ่านจะวาง `WorkspaceRouteSync` แล้วให้ `PersistentWorkspaceHost` แสดงจอ `WmsDashboard` (ค้างสถานะไว้เมื่อสลับระบบ ดู [[fe-tabs-workspace]])

## 5 แท็บในจอ
| แท็บ | เนื้อหา | อ่านต่อ |
|---|---|---|
| 1. หยิบ · แพ็ค · ขนส่ง (Pick & Pack) | ใบงานคลัง เลื่อนสถานะ WAITING_PICK → PICKING → PACKED → SHIPPED พร้อมรูปหลักฐาน | [[sys-wms-fulfillment-pick-pack-ship]] |
| 2. สต็อกคลังจริง vs สต็อกบัญชี | ตารางเทียบยอดจริง/ยอดบัญชี/ยอดจอง | [[sys-wms-stock-ledger-reconcile]] |
| 3. แผนผังโซน & ชั้นวาง (Bin Map) | 4 โซน (ZONE-A ถึง ZONE-D) และช่องเก็บ | [[sys-wms-stock-ledger-reconcile]] |
| 4. รับเข้า · ย้ายช่อง · ตรวจนับ | บันทึกความเคลื่อนไหว (movement) | [[sys-wms-movements-evidence-photos]] |
| 5. ผังเชื่อมโยง 5 ระบบ (End-to-End) | แท็บผังเชื่อมโยงของโมดูล | - |

## ข้อมูลและตาราง
เมื่อเรียก Overview ครั้งแรกของแต่ละฐานข้อมูล แบ็กเอนด์จะสร้างตารางเองด้วย `CREATE TABLE IF NOT EXISTS` (ผ่านสิทธิ์ `AllowDDL`):
- `wms_stock_bin`: ยอดจริงต่อ "สินค้า x ช่องเก็บ" (physical, reserved, inbound putaway, min/max)
- `wms_fulfillment_order`: ใบงานหยิบ-แพ็ค-ส่ง ผูกกับเลขใบกำกับขาย (ERP) และเก็บ JSON รูปหลักฐาน
- `wms_movement_log`: สมุดความเคลื่อนไหว (รับเข้า ย้าย นับ ส่งออก) ใช้สร้างยอด physical ขึ้นใหม่
- อ่านเพิ่มจากตารางหลักของบัญชี: `ic_trans_detail` (ยอดบัญชี), `ic_inventory` (รายการสินค้า), `images` (รูปสินค้า) ดู [[tbl-ic-trans-detail]], [[tbl-ic-inventory]]
- ข้อมูลตัวอย่าง (seed) ใส่ให้เฉพาะฐาน `bcdemo` เท่านั้น ฐานอื่นเริ่มว่าง

## API และการเชื่อมต่อ
- Next.js proxy: `/api/wms/overview`, `/api/wms/fulfillment`, `/api/wms/movement` (ตรวจ session แล้วเรียก Go ด้วย token; ไม่มี token ตอบ `NO_TOKEN` 401) ดู [[fe-api-proxy-routes]]
- Go (chi) ใต้ `/api/v1/wms` ทุกเส้นอยู่หลัง `Auth` ดูรายละเอียด request/response ที่ [[api-business-modules]]
- เชื่อมกับระบบอื่น: เมื่อใบงานเป็น `SHIPPED` ระบบอัปเดต `market_b2b_order` เป็น `SHIPPED_IN_TRANSIT` และ `tms_delivery_stop` เป็น `IN_TRANSIT` ใน transaction เดียว (ดู [[sys-wms-fulfillment-pick-pack-ship]]) และฝั่ง TMS ปิดใบงานคลังให้เมื่อส่งมอบ (ดู [[sys-tms-trip-pod-flow]])
- ใช้ MinIO เก็บรูปหลักฐาน ฐานข้อมูลเก็บเฉพาะ key และ JSON

## ข้อจำกัดที่ควรรู้
- ตัวเลขจำนวน/น้ำหนักในแฮนด์เลอร์ใช้ `float64` ไม่ใช่ decimal (หลักการเงินดู [[std-data-integrity-money-transactions]])
- ค่า "ความแม่นยำสต็อก" และ "การใช้ความจุ" บนหัวจอมีค่าตั้งต้นที่ฝังในโค้ด (รายละเอียดใน [[sys-wms-stock-ledger-reconcile]])

## ที่มาในโค้ด
- `frontend/src/app/wms/page.tsx:12-15` redirect ตาม session และวาง `WorkspaceRouteSync`
- `frontend/shared/layout/SystemPortalScreen.tsx:178-193` การ์ด SYS-06 และลิงก์ `/wms`
- `frontend/shared/layout/PersistentWorkspaceHost.tsx:554-568` ติดตั้งจอ `WmsDashboard` ในโฮสต์
- `backend/internal/adapter/inbound/http/router.go:279-285` เส้นทาง `/api/v1/wms` (overview, fulfillment, movement)
- `backend/internal/adapter/inbound/http/wms/handler.go:1-8` คำอธิบายแพ็กเกจ; `:182-215` โครง `OverviewResponse` และ `Overview`; `:1208-1286` DDL สามตาราง
- `frontend/wms/WmsDashboard.tsx:176` ชนิดแท็บ `fulfillment | ledger | binmap | operations | ecosystem`
- ดูเพิ่ม: [[sys-wms-fulfillment-pick-pack-ship]] · [[sys-wms-stock-ledger-reconcile]] · [[sys-wms-movements-evidence-photos]] · [[sys-tms-overview]] · [[api-business-modules]] · [[backend-overview]] · [[be-multi-tenant]]
