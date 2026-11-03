---
title: "ตารางข้อมูลของ AutoCare autocare_* และตารางหลักที่ใช้ร่วม (sys-autocare-tables)"
tags: [systems, autocare, tables, schema]
aliases: ["autocare_job_order", "autocare_job_item", "autocare_vehicle", "autocare_tire_dot_stock", "autocare_service_bay", "autocare_technician_wallet", "autocare_tire_hotel", "autocare_warranty_claim", "autocare_blind_receiving", "autocare_member_coupon"]
sources:
  - "backend/internal/adapter/inbound/http/autocare/seed.go:14-30"
  - "backend/internal/adapter/inbound/http/autocare/seed.go:31-265"
  - "backend/internal/adapter/inbound/http/autocare/seed.go:266-274"
  - "backend/internal/adapter/inbound/http/autocare/seed.go:278-379"
  - "backend/internal/adapter/inbound/http/autocare/handler.go:53-83"
  - "backend/internal/adapter/inbound/http/autocare/handler.go:85-348"
---

# ตารางข้อมูลของ AutoCare

ไม่มีไฟล์ migration แยก ตารางทั้งหมดถูกสร้างด้วย `CREATE TABLE IF NOT EXISTS` ใน `ensureSchemaAndSeed` ครั้งแรกที่ผู้ใช้เปิด Overview หรือสั่ง Action ในฐานข้อมูลนั้น และจำไว้ใน `sync.Map` ด้วยคีย์ `provider:db:autocare_v2` (seed.go:14-30) คำสั่ง DDL รันผ่าน `execBatch` ที่ตั้ง `AllowDDL: true` ส่วนคำสั่งธุรกรรมรันผ่าน `execTxBatch` (`ExecBatch`) ทั้งคู่ส่ง `UserLevel 9` (handler.go:53-83)

ทุกตารางมี `roworder SERIAL PRIMARY KEY` ค่าเงินและจำนวนใช้ `NUMERIC(18,2)`

## 10 ตาราง `autocare_*`
| ตาราง (บรรทัด DDL) | คีย์ธุรกิจ (UNIQUE) | เก็บอะไร |
|---|---|---|
| `autocare_vehicle` (seed.go:31-64) | `plate_no` | ทะเบียนรถ VIN ยี่ห้อ/รุ่น `powertrain` เลขไมล์ ลูกค้า (`cust_code` อ้าง `ar_customer`) ระดับสมาชิกและแต้ม ข้อมูล Fleet และ `fleet_credit_limit` ไซส์ยาง กำหนดสลับยางและถ่ายน้ำมันเครื่อง วันหมดอายุ พ.ร.บ. ภาษี และประกัน |
| `autocare_tire_dot_stock` (seed.go:65-93) | `sku_dot_id` | สต็อกยางหรืออะไหล่แยกตามล็อต DOT (`dot_week`, `dot_year`) `fefo_status` `quick_size_digits` สำหรับค้นไซส์ ราคาขายและโปรโมชั่น เครดิตเทิร์นยาง ค่าคอมช่าง และระยะรับประกัน ไม่มีคอลัมน์ทุน |
| `autocare_service_bay` (seed.go:94-112) | `bay_code` | ช่องซ่อมหรือฮอยท์ สถานะ ใบงานและรถที่อยู่ในช่อง ช่าง % ความคืบหน้า งานและยอดขายของวัน |
| `autocare_technician_wallet` (seed.go:113-127) | `tech_code` | ช่าง ตำแหน่ง ช่องประจำ งานที่ทำเสร็จวันนี้และเดือนนี้ `labor_fee_today` `commission_today` `wallet_balance_month` |
| `autocare_job_order` (seed.go:128-171) | `job_no` | หัวใบสั่งซ่อม รถ ลูกค้า ช่อง SA ช่าง `status` และ `progress_pct` JSON ผลตรวจล้อ 4 ล้อ, DVI 35 จุด, upsell, สเปกคาร์แคร์ ยอดเงินต่าง ๆ (`subtotal_parts`, `subtotal_labor`, `turn_in_discount`, `coupon_discount`, `owner_special_discount`, `vat_amount`, `grand_total`, `tech_commission_amt`) สถานะคำขอส่วนลด `payment_method` `accounting_posted` `bc_doc_no` `bc_gl_posted` |
| `autocare_job_item` (seed.go:172-190) | ไม่มี (ใช้ `job_no` + `line_no`) | บรรทัดใบงาน `item_category` (TIRE/PART/LABOR …) เกรดอะไหล่ `dot_code` จำนวน ราคา ส่วนลด `line_total` `tech_fee_amt` `is_upsell_approved` ระยะรับประกัน |
| `autocare_tire_hotel` (seed.go:191-210) | `storage_no` | รับฝากยางของลูกค้า ยี่ห้อ ไซส์ DOT จำนวน ความลึกดอกยาง ตำแหน่งในคลัง วันฝากและวันหมดอายุ สถานะ |
| `autocare_warranty_claim` (seed.go:211-231) | `claim_no` | ใบรับประกันหรือใบเคลม (`warranty_no`, `job_no`, `bc_doc_no`) ประเภทเคลม สินค้า DOT หรือ serial ผู้ผลิต สถานะ เลขเอกสารเปลี่ยนสินค้า |
| `autocare_blind_receiving` (seed.go:232-250) | `recv_no` | ใบรับของเข้าคลังที่ไม่มีราคาทุน `cost_masked` สถานะ `bc_purchase_doc_no` ดู [[sys-autocare-blind-receiving]] |
| `autocare_member_coupon` (seed.go:251-265) | `coupon_code` | แพ็กเกจคูปองสมาชิก จำนวนสิทธิ์ทั้งหมด ใช้ไปแล้ว และคงเหลือ `unit_value` วันหมดอายุ |

struct ที่ API ส่งออกตรงกับตารางเหล่านี้ (handler.go:85-348) ส่วน `AutoCareKpiSummary` เป็นค่าสรุปที่คำนวณขึ้น ไม่ได้มาจากตาราง

## ตารางหลักของ BC Account ที่ AutoCare ใช้หรือเขียน
- `ALTER TABLE` เพิ่มคอลัมน์ในตารางร่วม ถ้ายังไม่มี (seed.go:266-269)
  - `ic_shelf.wh_code`
  - `ic_shelf.whcode`
  - `ic_inventory.balance_qty`
  - `ic_inventory.average_cost`
- seed เพิ่มข้อมูลด้วย `ON CONFLICT DO NOTHING` ลงตารางเหล่านี้ (seed.go:278-379) ดู [[sys-autocare-seed-demo]]
  - [[tbl-ic-warehouse]]
  - [[tbl-ic-shelf]]
  - [[tbl-ap-supplier]]
  - [[tbl-ar-customer]]
  - [[tbl-ic-inventory]]
  - [[tbl-ic-unit-use]]
- ตอนปิดบิลและรับของ ระบบเขียน [[tbl-ic-trans]], [[tbl-ic-trans-detail]], [[tbl-cb-trans]] และ [[tbl-gl-journal]] ผ่าน `SaveTrans` ไม่ได้ INSERT ตรง ดู [[sys-autocare-billing-gl]]

## ที่มาในโค้ด
- `backend/internal/adapter/inbound/http/autocare/seed.go:14-30`: EnsureSeeded และ cache key
- `backend/internal/adapter/inbound/http/autocare/seed.go:31-265`: DDL 10 ตาราง
- `backend/internal/adapter/inbound/http/autocare/seed.go:266-269`: ALTER ตารางร่วม
- `backend/internal/adapter/inbound/http/autocare/handler.go:53-83`: execBatch และ execTxBatch

ดูเพิ่ม: [[tables-overview]] · [[sys-autocare-overview]] · [[sys-autocare-stock-warranty-rebuild]]
