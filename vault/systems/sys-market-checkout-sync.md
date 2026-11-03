---
title: "ราคาขั้นบันได คูปอง และการสั่งซื้อ B2B ที่ซิงก์ข้ามระบบ (sys-market-checkout-sync)"
tags: [systems, market, sales, credit, rebate, rounding]
aliases: ["PLACE_B2B_ORDER", "checkout market", "ราคาขั้นบันได", "Tier price", "VIP3000", "วงเงินร้านค้าช่วง", "rebate ร้านค้าช่วง", "marketDealerBalanceSQL"]
sources: ["backend/internal/adapter/inbound/http/market/handler.go:305-453", "backend/internal/adapter/inbound/http/market/handler.go:550-646", "backend/internal/adapter/inbound/http/market/handler.go:648-653", "backend/internal/adapter/inbound/http/market/handler.go:665-794", "backend/internal/adapter/inbound/http/market/handler.go:805-813", "backend/internal/adapter/inbound/http/market/handler.go:1864-1897", "backend/internal/adapter/inbound/http/market/handler.go:1989-2056", "frontend/market/MarketDashboard.tsx:800-834", "frontend/market/MarketDashboard.tsx:950-970", "docs/kms/KMS_SECURITY_DATA_INTEGRITY_LESSONS.md:30-31", "docs/kms/KMS_SECURITY_DATA_INTEGRITY_LESSONS.md:77"]
---
# ราคาขั้นบันได คูปอง และการสั่งซื้อ B2B ที่ซิงก์ข้ามระบบ (sys-market-checkout-sync)

โน้ตนี้อธิบายการคิดราคาในตะกร้าของ `/market` และสิ่งที่เกิดขึ้นเมื่อกดสั่งซื้อ (`action_type: "PLACE_B2B_ORDER"`) ใน `market/handler.go`

## ราคาในตะกร้า (`ADD_TO_CART`)

- ค่าตั้งต้นเมื่อไม่ส่งมา: SKU ตัวอย่าง จำนวน 10 และร้านค้าช่วงรหัส `AR-0001` (`handler.go:305-317`)
- ถ้า SKU ยังไม่อยู่ใน `market_product_catalog` จะดึงจาก `ic_inventory` มาเพิ่มในแคตตาล็อก โดยตั้งราคาจาก `average_cost` (ต้นทุน 350 เมื่อไม่มีค่า) ตามตารางด้านล่าง ราคาเหล่านี้ปัดเป็นบาทเต็มด้วย `math.Round` (`:336-391`)

| ราคา | สูตรในโค้ด | จำนวนขั้นต่ำ |
|---|---|---|
| ปลีก (`retail_price`) | ต้นทุน × 1.35 | - |
| Tier 1 | ต้นทุน × 1.22 | 1 |
| Tier 2 | ต้นทุน × 1.14 | 20 |
| Tier 3 | ต้นทุน × 1.07 | 50 |

- `computeTierPrice` เลือก Tier 3 ก่อน แล้วจึง Tier 2 ตามจำนวนขั้นต่ำ ถ้าไม่ถึงทั้งสองใช้ Tier 1 (`:805-813`)
- ยอดบรรทัด = `mulSatang(จำนวน, ราคาที่ใช้)` ส่วนลดบรรทัด = (ราคาปลีก − ราคาที่ใช้) × จำนวน (`:414-416`)
- แถวแคตตาล็อกที่ดึงเพิ่มและแถวในตะกร้าบันทึกใน transaction เดียว (`:444`)

## สรุปยอดตอนสั่งซื้อ (`:550-646`)

1. อ่านทุกแถวใน `market_cart_item` (SQL ไม่มีเงื่อนไขร้านค้าช่วง) และอ่านโปรไฟล์ร้านค้าช่วงตาม `dealer_code`
2. รวมยอด: `gross` = Σ ราคาปลีก × จำนวน, `subTotal` = Σ ยอดบรรทัด, ส่วนลดขั้นบันได = Σ ส่วนลดบรรทัด
3. ส่วนลดคูปอง: `VIP3000` = 3000 เมื่อ `subTotal` ≥ 30000 ไม่เช่นนั้น 1000, `YIPUA1500` = 1500, `DEALER500` = 500 (`:631-644`)
4. ยอดหลังหักส่วนลด = `subSatangNonNeg(subTotal, คูปอง)` แล้วคิด VAT และยอดสุทธิด้วย `vatAndNetSatang` คือ VAT = ปัด 2 ตำแหน่ง (ยอด × 7/100) (`:645-646`, `:2046-2056`)

หน้าจอคิดยอดเดียวกันในเบราว์เซอร์เพื่อแสดงผล โดย VAT = `Math.round(afterDisc × 0.07 × 100) / 100` (`MarketDashboard.tsx:800-834`) ยอดที่บันทึกจริงมาจาก backend

## เลขเอกสารที่สร้าง (`:648-653`)

| เอกสาร | รูปแบบ |
|---|---|
| คำสั่งซื้อ | `MKT-SO-<เวลา>` |
| เลขอ้างอิง ERP | `INV6910-<เวลา>` |
| ใบจัดสินค้า WMS | `WMS-MKT-<เวลา>` |
| เที่ยวรถ TMS | `TRIP-6910-02` (ค่าคงที่) |
| e-Tax | `ETAX-MKT-<เวลา>` |

## สิ่งที่บันทึกใน transaction เดียว (`:665-794`)

1. `marketDealerOpeningSQL` ล็อกแถวร้านค้าช่วง และบันทึกยอดยกมาครั้งแรก
2. insert `market_b2b_order` สถานะ `WMS_PACKING`
3. `marketDealerBalanceSQL` คำนวณวงเงินและ rebate ใหม่
4. insert `wms_fulfillment_order` สถานะ `PICKING`
5. insert `tms_delivery_stop` สถานะ `PENDING_LOAD` โดย `payment_term` เก็บเฉพาะรหัสประเภทคำสั่งซื้อ
6. insert `crm_customer_activity` บันทึกว่าปิดการขายแล้ว
7. insert `etax_document_log` เป็น `ETAX_SALES_INVOICE` ฐานภาษี = ยอดหลังหักส่วนลด, `vat_rate` 7, `etda_status` = `TIMESTAMP_VERIFIED` (เลขผู้เสียภาษีเป็นค่าคงที่ในโค้ด ไม่คัดลอกมาที่นี่)

ถ้าขั้นใดล้มจะคืน error และไม่มีอะไรถูกบันทึก (`:786-793`) บทเรียนเดิมที่เคยตัดเครดิตทั้งที่ insert ล้มบันทึกไว้ที่ `KMS_SECURITY_DATA_INTEGRITY_LESSONS.md:30` และแนวทาง transaction เดียวอยู่ที่ `:77` ดู [[std-data-integrity-money-transactions]]

## วงเงินและ rebate ของร้านค้าช่วง (`:1864-1897`)

| ค่า | สูตร |
|---|---|
| `credit_used` | `credit_used_opening` + Σ `net_order_amount` |
| `credit_available` | `GREATEST(0, credit_limit − credit_used)` |
| `rebate_accumulated` | `rebate_opening` + Σ ปัด 2 ตำแหน่ง ((`net_order_amount` − `vat_amount`) × 0.01) |

- นับเฉพาะคำสั่งซื้อที่ `order_status` ไม่ขึ้นต้นด้วย `CANCEL` (`marketDealerOrdersFilter`)
- คำนวณจากผลรวมใหม่ทุกครั้ง ไม่ใช้ `credit_used = credit_used + x` เพื่อไม่ให้คำขอที่ส่งซ้ำตัดวงเงินสองครั้ง

## ข้อสังเกตจากโค้ด

- ไม่พบการตรวจว่ายอดสั่งซื้อเกิน `credit_available` ก่อนรับคำสั่งซื้อ ค่าคงเหลือถูกกดไว้ที่ 0 ด้วย `GREATEST`
- ไม่มีการล้างตะกร้าหลังสั่งซื้อ และตะกร้าเป็นตารางเดียวของทุกร้านค้าช่วง
- ใบจัดสินค้า WMS และจุดส่ง TMS ใช้ SKU และ bin ของบรรทัดแรก พร้อมจำนวนรวมของทุกบรรทัด
- ใน `market/handler.go` ไม่มีการเขียน `ic_trans` หรือ `gl_journal` เลข `INV6910-…` จึงเป็นเพียงเลขอ้างอิง ยังไม่มีใบกำกับภาษีขายในระบบบัญชี ดู [[doc-sale-invoice]] และ [[flow-order-to-cash]]
- แถว e-Tax ที่สร้างถูกนับเป็นภาษีขายในหน้า `/etax` ดู [[sys-etax-vat-wht-summary]]

## ที่มาในโค้ด

- `backend/internal/adapter/inbound/http/market/handler.go:305-453` `ADD_TO_CART` และการดึงสินค้าจาก ERP
- `backend/internal/adapter/inbound/http/market/handler.go:550-646` รวมยอดและคูปอง
- `backend/internal/adapter/inbound/http/market/handler.go:648-653` เลขเอกสาร
- `backend/internal/adapter/inbound/http/market/handler.go:665-794` ชุดคำสั่งใน transaction เดียว
- `backend/internal/adapter/inbound/http/market/handler.go:805-813` `computeTierPrice`
- `backend/internal/adapter/inbound/http/market/handler.go:1864-1897` วงเงินและ rebate
- `backend/internal/adapter/inbound/http/market/handler.go:1989-2056` ตัวช่วยปัดเงิน (`roundSatang`, `mulSatang`, `addSatang`, `subSatangNonNeg`, `vatAndNetSatang`)
- `frontend/market/MarketDashboard.tsx:800-834` คิดยอดฝั่งหน้าจอ, `:950-970` ส่ง `PLACE_B2B_ORDER`
- `docs/kms/KMS_SECURITY_DATA_INTEGRITY_LESSONS.md:30-31`, `:77` บทเรียน B8, B9 และแนวทาง transaction
- ดูเพิ่ม: [[sys-market-overview]] · [[acc-rounding-decimal]] · [[sys-crm-overview]] · [[sys-etax-overview]]
