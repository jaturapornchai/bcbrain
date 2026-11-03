---
title: "ระบบจัดซื้ออัจฉริยะ (sys-procure)"
tags: [systems, procure, purchase, ap, dashboard]
aliases: ["Procure", "Smart Procurement", "จัดซื้อ PO", "/procure", "ระบบจัดซื้อ", "3-Way Matching"]
sources: ["frontend/src/app/procure/page.tsx:5-13", "frontend/procure/ProcureDashboard.tsx:363", "frontend/procure/ProcureDashboard.tsx:396-682", "frontend/procure/ProcureDashboard.tsx:1051-1121", "frontend/shared/layout/SystemPortalScreen.tsx:161-172", "frontend/shared/layout/PersistentWorkspaceHost.tsx:160-161", "backend/internal/adapter/inbound/http/router.go:297-302", "backend/internal/adapter/inbound/http/procure/handler.go:298", "backend/internal/adapter/inbound/http/procure/handler.go:318", "backend/internal/adapter/inbound/http/procure/handler.go:1507-1515", "backend/internal/adapter/inbound/http/procure/handler.go:1626-1650", "backend/internal/adapter/inbound/http/procure/handler.go:1787-1900"]
---
# ระบบจัดซื้ออัจฉริยะ (sys-procure)

ระบบ `/procure` เป็นแดชบอร์ดงานจัดซื้อแบบครบวงจร เริ่มจากตะกร้าขอซื้อ ส่งสืบราคา (RFQ) ต่อรองราคา ปิดเป็นใบสั่งซื้อ แล้วเดินสถานะไปถึงรับของเข้าคลังและจับคู่ใบกำกับภาษีซื้อ (3-Way Matching) ชื่อหน้าใน metadata คือ "ระบบจัดซื้ออัจฉริยะ (Smart Procurement · AI จุดสั่งซื้อ & 3-Way Matching)"

ระบบนี้แยกจากหน้าจอเอกสารซื้อของระบบบัญชี วงจรซื้อมาตรฐานของบัญชี (ขอซื้อ สั่งซื้อ ซื้อ/ตั้งหนี้ จ่ายชำระ) อธิบายไว้ที่ [[flow-procure-to-pay]] และ [[faq-procure-to-pay-steps]]

## ใครใช้ และเปิดอย่างไร

- ฝ่ายจัดซื้อที่ล็อกอินและเลือกฐานข้อมูลแล้ว ถ้ายังไม่มี session ระบบจะส่งไป `/login` และถ้ายังไม่เลือกฐานจะส่งไป `/select-database` (`page.tsx:12-13`)
- เปิดได้จากการ์ด "จัดซื้อ PO" ในหน้าเลือกระบบ (กลุ่ม `supply`) หรือพิมพ์ `/procure` ตรง ๆ ดู [[fe-app-shell-routing]]

## แท็บบนหน้าจอ

| แท็บ | ทำอะไร |
|---|---|
| `cart_rfq` | ตะกร้าขอซื้อ ส่งสืบราคา ต่อรอง และปิดเป็น PO ดู [[sys-procure-cart-rfq-po]] |
| `matching` | กระดานใบสั่งซื้อและการเดินสถานะ 3-Way Matching ดู [[sys-procure-3way-match-sync]] |
| `replenish` | เรดาร์เตือนจุดสั่งซื้อจากยอดในคลัง |
| `suppliers` | ตารางเปรียบเทียบผู้ขาย |
| `create` | ฟอร์มสร้าง PO ใหม่ (`CREATE_PO`) |

## เส้นทางข้อมูล

- `GET /api/v1/procure/overview` เรียก `Overview` ซึ่งอ่าน PO, ตารางผู้ขาย, ยอดในคลัง `wms_stock_bin`, ตะกร้า และ RFQ (`handler.go:1507-1515`)
- `POST /api/v1/procure/order` เรียก `AdvanceOrCreateOrder` ทุกปุ่มส่ง `action_type` มาที่ endpoint นี้ (`ProcureDashboard.tsx:396-682`)
- หน้าจอเรียกผ่าน Next API proxy `/api/procure/overview` และ `/api/procure/order`
- ตารางของระบบนี้ถูกสร้างเองตอนเรียกครั้งแรก ได้แก่ `procure_purchase_order`, `procure_supplier_matrix`, `procure_cart_item`, `procure_rfq_inquiry` คอลัมน์จำนวนและเงินเป็น `numeric(18,2)` (`handler.go:1787-1900`)

## เรดาร์จุดสั่งซื้อ (แท็บ `replenish`)

ตัวเลขในแท็บนี้คำนวณจากยอดในคลังจริงร่วมกับค่าที่กำหนดตายตัวในโค้ด (`handler.go:1626-1650`)

- ยอดพร้อมใช้ = `physical_qty − reserved_pick_qty` และ safety stock ตั้งต้น 80 เมื่อไม่มีค่า
- อัตราใช้ต่อวัน = `14 + (ลำดับแถว mod 4) × 5` ไม่ได้มาจากประวัติการขาย
- จุดสั่งซื้อ = safety + อัตราใช้ × 14
- 2 แถวแรกขึ้น `REORDER_NOW` เสมอ และ `cost_savings_pct` ตายตัวที่ 7.4

> ข้อสังเกตจากโค้ด: อัตราใช้และ KPI ประหยัดต้นทุนเป็นค่าสาธิต ยังไม่ใช่การพยากรณ์จากข้อมูลจริง

## ความสัมพันธ์กับระบบบัญชี

- เมื่อ PO เดินถึงขั้นรับของ ระบบเขียนแถว `ic_trans` และ `ic_trans_detail` ธง 12 ลงตรง และเมื่อถึงขั้น 3-Way จะเขียน `etax_document_log` ด้วย รายละเอียดและข้อสังเกตอยู่ที่ [[sys-procure-3way-match-sync]]
- รหัสผู้ขาย (`ap_code`) ใช้ใน `cust_code` ของ `ic_trans` ดู [[tbl-ap-supplier]] และ [[tbl-ic-trans]]

## ที่มาในโค้ด

- `frontend/src/app/procure/page.tsx:5-13` metadata และการ redirect
- `frontend/procure/ProcureDashboard.tsx:363` ดึง overview, `:396-682` ปุ่ม action ทั้งหมด, `:1051-1121` แท็บ
- `frontend/shared/layout/SystemPortalScreen.tsx:161-172` การ์ดระบบในหน้าเลือกระบบ
- `frontend/shared/layout/PersistentWorkspaceHost.tsx:160-161` จับคู่ `/procure` กับโมดูล
- `backend/internal/adapter/inbound/http/router.go:297-302` route `/api/v1/procure`
- `backend/internal/adapter/inbound/http/procure/handler.go:298` `Overview`, `:318` `AdvanceOrCreateOrder`, `:1507-1515` SQL ของ overview, `:1626-1650` เรดาร์จุดสั่งซื้อ, `:1787-1900` DDL
- ดูเพิ่ม: [[sys-procure-cart-rfq-po]] · [[sys-procure-3way-match-sync]] · [[flow-procure-to-pay]] · [[faq-procure-to-pay-steps]] · [[api-business-modules]]
