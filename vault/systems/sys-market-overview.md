---
title: "ร้านค้าส่งออนไลน์ B2B (sys-market)"
tags: [systems, market, sales, b2b, dashboard]
aliases: ["Market", "B2B Wholesale", "ร้านค้าส่ง", "/market", "สั่งซื้อร้านค้าช่วง", "ยี่ปั๊ว ซาปั๊ว"]
sources: ["frontend/src/app/market/page.tsx:5-13", "frontend/market/MarketDashboard.tsx:319-320", "frontend/market/MarketDashboard.tsx:456", "frontend/market/MarketDashboard.tsx:866-1039", "frontend/shared/layout/SystemPortalScreen.tsx:212-222", "frontend/shared/layout/PersistentWorkspaceHost.tsx:159", "backend/internal/adapter/inbound/http/router.go:313-318", "backend/internal/adapter/inbound/http/market/handler.go:248-258", "backend/internal/adapter/inbound/http/market/handler.go:270-304", "backend/internal/adapter/inbound/http/market/handler.go:454-549", "backend/internal/adapter/inbound/http/market/handler.go:852-884", "backend/internal/adapter/inbound/http/market/handler.go:1252-1360"]
---
# ร้านค้าส่งออนไลน์ B2B (sys-market)

ระบบ `/market` เป็นหน้าร้านค้าส่งให้ร้านค้าช่วง (sub-dealer) เลือกสินค้า ใส่ตะกร้า แล้วสั่งซื้อแบบตัดวงเงินเครดิตโดยไม่ต้องชำระเงินออนไลน์ เมื่อกดสั่งซื้อ ระบบจะสร้างคำสั่งซื้อและเอกสารต่อเนื่องไปยังคลัง ขนส่ง CRM และ e-Tax ใน transaction เดียว การ์ดในหน้าเลือกระบบชื่อ "ร้านค้าส่ง Market (B2B Wholesale)"

## ใครใช้ และเปิดอย่างไร

- ใช้ได้เมื่อล็อกอินและเลือกฐานข้อมูลแล้ว ถ้ายังไม่มี session ระบบจะส่งไป `/login` และถ้ายังไม่เลือกฐานจะส่งไป `/select-database` (`page.tsx:12-13`)
- เปิดได้จากการ์ดในกลุ่ม `supply` หรือพิมพ์ `/market` ตรง ๆ ดู [[fe-app-shell-routing]]
- หน้าจอมี 3 มุมมองคือ `home` (แคตตาล็อก), `cart` (ตะกร้า) และ `orders` (คำสั่งซื้อ) (`MarketDashboard.tsx:319-320`)

## Endpoint และ action

- `GET /api/v1/market/overview?q=&group=` เรียก `Overview` ซึ่งรับคำค้นและกลุ่มสินค้า (`handler.go:248-258`)
- `POST /api/v1/market/order` เรียก `CartOrOrderAction` ซึ่งอ่าน `action_type` แล้วแปลงเป็นตัวพิมพ์ใหญ่ก่อนเลือกทาง (`:270-304`)

| `action_type` | ผลในโค้ด |
|---|---|
| `ADD_TO_CART` | เพิ่มสินค้าในตะกร้า ถ้า SKU ยังไม่อยู่ในแคตตาล็อกจะดึงจาก `ic_inventory` มาเพิ่มให้ ดู [[sys-market-checkout-sync]] |
| `UPDATE_CART_QTY`, `REMOVE_CART_ITEM` | แก้จำนวนแล้วคิดราคาขั้นบันไดใหม่ หรือลบรายการ (`:454-502`) |
| `CLEAR_CART` | `DELETE FROM market_cart_item` ทั้งตาราง (`:503-510`) |
| `ADVANCE_ORDER_STATUS` | เลื่อนสถานะคำสั่งซื้อ (`:511-545`) |
| `REORDER_TO_CART` | ใส่สินค้าตัวอย่างชุดตั้งต้นกลับเข้าตะกร้า (`seedDefaultCartItems`) ไม่ได้ใช้รายการของคำสั่งซื้อเดิม (`:546-549`) |
| `PLACE_B2B_ORDER` | สั่งซื้อและซิงก์ข้ามระบบ ดู [[sys-market-checkout-sync]] |

สถานะคำสั่งซื้อเดินตามลำดับ `PENDING_CONFIRM` → `WMS_PACKING` → `TMS_IN_TRANSIT` → `DELIVERED_COMPLETED` คำสั่งซื้อใหม่เริ่มที่ `WMS_PACKING` การเลื่อนสถานะอัปเดตเฉพาะ `market_b2b_order` (`:511-545`)

## ข้อมูล

ตารางสร้างเองตอนเรียกครั้งแรก (`handler.go:1252-1360`) คอลัมน์เงินเป็น `numeric(18,2)`

| ตาราง | เก็บอะไร |
|---|---|
| `market_product_catalog` | แคตตาล็อก ราคาปลีกและราคาขั้นบันได 3 ระดับ |
| `market_subdealer_profile` | ร้านค้าช่วง วงเงิน (`credit_limit`, `credit_used`, `credit_available`) เทอม (`credit_term_days`) rebate และยอดยกมา |
| `market_cart_item` | รายการในตะกร้า |
| `market_b2b_order` | คำสั่งซื้อ พร้อมเลขเอกสารอ้างอิงของ ERP, WMS, TMS และ e-Tax |

Overview อ่านแคตตาล็อก ร้านค้าช่วง ตะกร้า คำสั่งซื้อล่าสุด 20 รายการ จำนวนสินค้าใน `ic_inventory` และรายการสินค้าจาก `ic_inventory` ร่วมกับ `ic_group` ตามคำค้น (`:852-884`) ดู [[tbl-ic-inventory]]

## ความสัมพันธ์กับระบบบัญชี

- คำสั่งซื้อเก็บเลข `erp_so_doc_no` เป็นรูปแบบ `INV6910-…` แต่ในแพ็กเกจนี้ไม่มีการเขียน `ic_trans` หรือบัญชีแยกประเภท รายละเอียดอยู่ที่ [[sys-market-checkout-sync]]
- ร้านค้าช่วงใช้รหัสรูปแบบ `AR-…` เป็นค่าตั้งต้น แต่ยอดหนี้อยู่ใน `market_subdealer_profile` ไม่ได้อยู่ใน [[tbl-ap-ar-trans]]
- วงจรขายมาตรฐานของบัญชีอยู่ที่ [[flow-order-to-cash]]
- ระบบ LINE OA ส่งคำสั่งซื้อมาที่ endpoint นี้เช่นกัน ดู [[sys-lineoa-chat-ai]]

## ที่มาในโค้ด

- `frontend/src/app/market/page.tsx:5-13` metadata และการ redirect
- `frontend/market/MarketDashboard.tsx:319-320` มุมมองหน้าจอ, `:456` ดึง overview, `:866-1039` ปุ่ม action
- `frontend/shared/layout/SystemPortalScreen.tsx:212-222` การ์ดระบบ, `frontend/shared/layout/PersistentWorkspaceHost.tsx:159` จับคู่เส้นทาง
- `backend/internal/adapter/inbound/http/router.go:313-318` route `/api/v1/market`
- `backend/internal/adapter/inbound/http/market/handler.go:248-258` `Overview`, `:270-304` รายการ action, `:454-549` action ตะกร้าและสถานะ, `:852-884` SQL ของ overview, `:1252-1360` DDL
- ดูเพิ่ม: [[sys-market-checkout-sync]] · [[api-business-modules]] · [[flow-order-to-cash]] · [[tbl-ar-customer]]
