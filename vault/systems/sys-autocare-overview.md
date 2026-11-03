---
title: "ระบบศูนย์บริการรถยนต์และร้านยาง BC AutoCare (sys-autocare-overview)"
tags: [systems, autocare, overview]
aliases: ["BC AutoCare", "AutoCare", "ระบบอู่ซ่อมรถ", "ระบบศูนย์บริการรถยนต์", "ระบบร้านยาง", "SYS-03"]
sources:
  - "backend/internal/adapter/inbound/http/autocare/seed.go:1-4"
  - "backend/internal/adapter/inbound/http/router.go:320-326"
  - "backend/internal/di/container.go:118"
  - "backend/internal/adapter/inbound/http/autocare/handler.go:350-886"
  - "backend/internal/adapter/inbound/http/autocare/handler.go:975-2126"
  - "frontend/shared/layout/SystemPortalScreen.tsx:122-138"
  - "frontend/src/app/autocare/page.tsx:1-16"
  - "frontend/shared/layout/PersistentWorkspaceHost.tsx:28-30"
  - "frontend/shared/layout/PersistentWorkspaceHost.tsx:155"
  - "frontend/autocare/autocareTypes.ts:281-322"
  - "frontend/autocare_flutter/lib/main.dart:56"
  - "backend/internal/adapter/inbound/http/mcp/gateway.go:2185-2199"
  - "AGENTS.md:12"
  - "video-autocare/youtube.txt:8-18"
---

# BC AutoCare — ระบบศูนย์บริการรถยนต์ ร้านยาง และอู่ซ่อม

## คืออะไร
BC AutoCare เป็นระบบงานหน้าร้านของศูนย์บริการรถยนต์ ใช้ตั้งแต่รับรถ ตรวจสภาพ เสนอซ่อมเพิ่ม ซ่อมในช่องฮอยท์ ตรวจ QC ไปจนถึงรับเงินและออกใบกำกับภาษีขาย ระบบนี้ใช้ฐานข้อมูล PostgreSQL เดียวกับ BC Account และใช้ตารางหลักร่วมกันคือ `ic_inventory`, `ic_warehouse`, `ic_shelf`, `ar_customer`, `ap_supplier` (seed.go:1-4)

มีหลักการสองข้อ (seed.go:1-4):
- **Accounting State Gate**: ใบงานที่ยังไม่ปิดบิลอยู่เฉพาะในตาราง `autocare_*` ยังไม่ลงบัญชี จนกว่าแคชเชียร์จะปิดบิล ตอนนั้นระบบจึงสร้างใบกำกับภาษีขายจริง (`ic_trans` trans_flag 44 + `cb_trans` + `gl_journal`) ดู [[sys-autocare-billing-gl]]
- **Cost Masking**: API ที่หน้าร้านใช้จะไม่ส่งราคาทุน คำตอบของ `Overview` ใส่ `cost_masked: true` (handler.go:872) ส่วนการรับของเข้าคลังก็ไม่เห็นราคาทุน ดู [[sys-autocare-blind-receiving]]

## รองรับ 4 โหมดธุรกิจ
ค่า `business_mode` อยู่ใน `BUSINESS_MODES` (autocareTypes.ts:281-322) โดย `ALL` แปลว่าทุกโหมด
- `tire_fastfit`: ร้านยาง ล้อแม็ก และ Fast-Fit
- `garage_ev`: อู่ซ่อมบำรุง ช่วงล่าง และรถ EV
- `carcare_tint`: คาร์แคร์ เคลือบแก้ว และฟิล์ม
- `accessory_bom`: ร้านประดับยนต์และชุดแต่ง

## ใครใช้
- **พนักงานหลังร้านและผู้จัดการ** ใช้หน้าเว็บ `/autocare` ซึ่งมีผังเมนู 5 หมวด 17 เมนู ดู [[sys-autocare-screens-menus]]
- **คนหน้างาน 4 บทบาท** ใช้แอป Flutter ได้แก่ SA รับรถ ช่างและ DVI คลังรับยาง และเจ้าของร้าน (main.dart:56) ดู [[sys-autocare-flutter-app]]

## วิธีเปิด
1. ที่หน้า Portal ระบบ ให้เลือกไทล์ `autocare` รหัส `SYS-03` ซึ่งลิงก์ไป `/autocare` (SystemPortalScreen.tsx:122-138)
2. หน้า `/autocare` ต้องล็อกอินก่อน ถ้ายังไม่เลือกฐานข้อมูลจะถูกส่งไป `/select-database` (page.tsx)
3. Workspace โหลดแบบ dynamic ภายใน `PersistentWorkspaceHost` เมื่อ path ขึ้นต้นด้วย `/autocare` (PersistentWorkspaceHost.tsx:28-30, :155)

## ส่วนประกอบ
| ส่วน | ที่อยู่ | โน้ต |
|---|---|---|
| Backend API | `GET /api/v1/autocare/overview`, `POST /api/v1/autocare/action` ต้องมี Auth (router.go:320-326) | [[sys-autocare-job-flow]] |
| ตารางข้อมูล | ตาราง `autocare_*` 10 ตาราง ระบบสร้างเองเมื่อเปิดใช้ครั้งแรก | [[sys-autocare-tables]] |
| ปิดบิลและลงบัญชี | `postJobToBCAccount`, `invoicePay` | [[sys-autocare-billing-gl]] |
| รับของเข้าคลัง | `postBlindReceivingToBCAccount` สร้างเอกสารซื้อ trans_flag 12 | [[sys-autocare-blind-receiving]] |
| ยาง DOT, รับฝากยาง, เคลม, คูปอง, Rebuild | | [[sys-autocare-stock-warranty-rebuild]] |
| รายงาน | 5 รายงานที่ลงทะเบียนในระบบรายงานกลาง | [[sys-autocare-reports]] |
| ข้อมูลเดโม | seed และการโพสต์บิลตัวอย่าง | [[sys-autocare-seed-demo]] |
| MCP | ข้อมูลสรุป `autocare_summary` อ่าน `ic_trans` trans_flag 32 และ 44 (gateway.go:2185-2199) | [[api-mcp]] |

## ข้อสังเกต
- ในไฟล์ `AGENTS.md` ของ repo ระบบ `autocare` อยู่ในรายชื่อระบบที่ไม่สแกน ไม่แก้ และไม่ทดสอบ จนกว่าจะได้รับคำสั่ง (AGENTS.md:12) ดู [[std-repo-scope-rules]]
- วิดีโอแนะนำระบบสรุปข้อดีไว้ 6 ข้อ เช่น "ปิดบิล = ลงบัญชีอัตโนมัติ" และระบุว่าข้อมูลในวิดีโอเป็นข้อมูลตัวอย่าง ส่วนการส่ง LINE OA ในเดโมเป็นการจำลอง (youtube.txt:8-18) โค้ดสอดคล้องกับข้อนี้ เพราะ action `approve_lineoa_upsell` แค่ปรับข้อมูลในฐานข้อมูล ไม่ได้เรียก LINE (handler.go:2211-2224)

## ที่มาในโค้ด
- `backend/internal/adapter/inbound/http/autocare/seed.go:1-4`: คำอธิบาย package (ตารางร่วม, State Gate)
- `backend/internal/adapter/inbound/http/router.go:320-326`: route `/api/v1/autocare`
- `backend/internal/di/container.go:118`: สร้าง `autocarehttp.NewHandler`
- `frontend/shared/layout/SystemPortalScreen.tsx:122-138`: ไทล์ Portal
- `frontend/autocare/autocareTypes.ts:281-322`: `BUSINESS_MODES`
- `backend/internal/adapter/inbound/http/mcp/gateway.go:2185-2199`: `autocare_summary`

ดูเพิ่ม: [[accounting-overview]] · [[doc-sale-invoice]] · [[be-http-router-routes]] · [[api-business-modules]]
