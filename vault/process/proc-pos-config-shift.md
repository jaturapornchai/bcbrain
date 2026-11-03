---
title: "POS ตั้งค่าร้าน/เครื่อง/โปรโมชัน และกะขาย รับ-ส่งเงิน (POS Config and Shift)"
tags: [process, pos, config, shift, promotion, coupon, member, settlement]
aliases: ["SavePosConfig", "PosShiftAction", "EnsurePosTables", "posConfigDDL", "api/v1/pos/config", "api/v1/pos/bootstrap", "api/v1/pos/shift", "posconfig", "pos_id", "pos_promotions", "coupon_list", "pos_period", "poscashiersettle", "pos_temp_members", "open_shift", "close_shift", "receive_money", "send_money", "ตั้งค่า POS", "เปิดกะ", "ปิดกะ", "สมาชิกชั่วคราว"]
sources: ["backend/internal/application/process/pos_config.go:16", "backend/internal/application/process/pos_config.go:373", "backend/internal/application/process/pos_config.go:381", "backend/internal/application/process/pos_config.go:493", "backend/internal/application/process/pos_config.go:587", "backend/internal/application/process/pos_config.go:811", "backend/internal/application/process/pos_config.go:974", "backend/internal/application/process/pos_config.go:1127", "backend/internal/application/process/pos_config.go:1175", "backend/internal/application/process/pos_config.go:1259", "backend/internal/adapter/inbound/http/pos/handler.go:60", "backend/internal/adapter/inbound/http/pos/handler.go:244", "backend/internal/adapter/inbound/http/pos/handler.go:264"]
---

# POS ตั้งค่าร้าน/เครื่อง/โปรโมชัน และกะขาย (POS Config and Shift)

ส่วนตั้งค่าและกะขายของ POS ใช้ร่วมกันระหว่างหน้า Setup/Back office ของ BC Ai Account กับแอป POS (คอมเมนต์แพ็กเกจ `pos/handler.go:1-2`) มี 3 จุดเข้า: `GET /api/v1/pos/bootstrap` (อ่านข้อมูลหน้าตั้งค่าทั้งก้อน), `POST /api/v1/pos/config` (บันทึกตั้งค่าตามหมวด `section`), `POST /api/v1/pos/shift` (กะขาย/รับ-ส่งเงิน/ยกเลิกบิล/สมาชิกชั่วคราว) ดูเส้นทางและการยืนยันตัวตนที่ [[proc-pos-sync]]

## ทำงานอย่างไร

### ตารางและการสร้างอัตโนมัติ
- `posConfigDDL` (`pos_config.go:16`) สร้างตารางด้วย `CREATE TABLE IF NOT EXISTS`: `posconfig`, `pos_id`, `erp_thai_qr_config`, `pos_point_condition`, `pos_promotions`, `coupon_list`, `pos_period`, `poscashiersettle`, `pos_member_groups`, `pos_temp_members`, `images`, `bc_doc_images`, `erp_business_ext`, `pos_slip_campaign_items/brand/category/group`, `bc_resource` และ `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` ของบางคอลัมน์
- `EnsurePosTables` (:373) / `ensurePosTablesPool` (:381) รันครั้งเดียวต่อ `provider:ฐาน` (ตัวจำ `s.posSeedDone`) ถ้า DDL คำสั่งใดพัง ข้ามไปทำต่อ ("best effort" ตามคอมเมนต์ :388)
- การเพิ่มข้อมูลตัวอย่าง (ลูกค้า Walk-in, ค่า `posconfig`, เครื่องตัวอย่าง, รูปสินค้าตัวอย่าง) ทำ **เฉพาะฐานชื่อ `bcdemo`** (เช็คที่ :393 ฐานอื่นหยุดหลังสร้างตาราง) ส่วนรูปสินค้าตัวอย่างและการปักธง `pos_sync_change` ทำเมื่อเป็น `bcdemo` และผู้ให้บริการไม่ใช่ `it` (:469-482)
- ทุก handler เรียก `ensureSchemaAndSeed` (`pos/handler.go:54`) ก่อนทำงาน ถ้าพลาดแค่ log ระดับ debug

### อ่านหน้าตั้งค่า `GET /pos/bootstrap` (`Bootstrap` handler.go:60)
รวมหลาย SELECT ใน batch เดียวผ่าน use case `Batch` แล้วตอบ `{ok, pos_config, pos_machines, qr_config, point_condition, promotions, coupons, member_groups, products, settlements, recent_bills, temp_members}` (:227-239) ตัวจำกัดจำนวน: คูปอง 100 ล่าสุด, สินค้า 60 รายการแรก (เรียงรหัส), รายการรับ-ส่งเงิน 50 ล่าสุด, บิลล่าสุด 50 (จาก `ic_trans`), สมาชิกชั่วคราว 50 ล่าสุด ถ้าไม่มี QR/เงื่อนไขแต้มในฐาน จะตอบค่าเริ่มต้นในโค้ด (เช่น `baht_per_point` 25.00, `points_per_baht_redeem` 10.00, `min_redeem_points` 100.00; :161-186) เงินส่งเป็นข้อความ (`::text`)

### บันทึกตั้งค่า `POST /pos/config` (`SavePosConfig` :493)
- body JSON อ่านด้วย `UseNumber` ไม่เกิน 1 MiB (`decodeJSONMapUseNumber` handler.go:288) เลือกหมวดจาก `section` (ค่าเริ่มต้น `startup`) ทำทั้งหมวดใน transaction เดียว หมวดที่ไม่รู้จัก = error "ไม่รู้จักหมวดตั้งค่า POS: ..."
- ตัวเลขเงิน/อัตรา อ่านผ่าน `posDec` (:1259) ซึ่งรับสตริงหรือ `json.Number` โดยไม่ผ่าน `float64` (ตามกฎ ACCOUNTING NUMBER)
- หมวดและตารางที่เขียน:
  | `section` | เขียนลง | สาระ |
  |---|---|---|
  | `startup` | `posconfig` (upsert ตาม `pos_config_number`) | ชื่อร้าน/สาขา/เลขผู้เสียภาษี, ลูกค้าเริ่มต้น `cust_code_default`, ส่วนลดสมาชิก, `max_pos_money`, `vat_type`/`vat_rate`, `service_charge_rate`, หัว-ท้ายใบเสร็จ, สิทธิ์แก้ราคา/ส่วนลด/ยกเลิกบิล |
  | `machine`, `machines` | `pos_id` (upsert ตาม `machinecode` ตัวพิมพ์ใหญ่) | รหัสเครื่อง, รูปแบบเลขที่เอกสาร (`doc_format`, `doc_format_vat_full`, `doc_format_cancel`, `doc_format_fillmoney`, `doc_format_cashiersettle`), คลัง/ที่เก็บ (`pos_ic_wht`, `pos_ic_shelf`), สาขา/แผนก, ชนิดราคา `price_number`, เครื่องพิมพ์/จอลูกค้า/ลิ้นชัก; ต้องมี `machinecode` และ `doc_format` ผ่าน `checkPosDocFormatUnique` (มี `#` และไม่ซ้ำเครื่องอื่น ดู [[proc-pos-sync]]) |
  | `qr` | `erp_thai_qr_config` (แถว `pos_id = 'ALL'`) | พร้อมเพย์/วอลเล็ต/ชื่อร้านค้า/รหัสผู้ให้บริการ |
  | `point` | `pos_point_condition` | บาทต่อแต้ม, แต้มต่อบาทที่แลก, แต้มขั้นต่ำที่แลก, ตัวคูณเดือน/วันเกิด, เกณฑ์ระดับ VIP |
  | `coupon` | `coupon_list` (upsert ตาม `number` ตัวพิมพ์ใหญ่) | มูลค่า, ยอดคงเหลือ, วันหมดอายุ, ใช้ครั้งเดียว, ลูกค้า |
  | `coupon_batch` | `coupon_list` | สร้างคูปองหลายใบ (`count` 1-50; ค่าเริ่มต้น 5), เลขที่ `<prefix>-<ลำดับ>`; ถ้าไม่ส่ง `date_expire` ใช้ค่าคงที่ในโค้ด `2026-12-31` (:793; โปรโมชัน `date_end` และคูปองเดี่ยว :770, :935 ใช้ค่าเดียวกัน) |
  | `promotion` | `pos_promotions` | ดูด้านล่าง |
  | `promotion_toggle` | `pos_promotions.is_active` | เปิด/ปิดตาม `promo_code` |
  | `promotion_delete` | `pos_promotions` | ลบตาม `promo_code` |
- โปรโมชัน: `promo_type_code` แปลงเป็นชื่อชนิด (`pTypeStr`) ตามโค้ด (1,3 `BUY_X_GET_Y`; 2,5 `BUNDLE_QTY`; 4 `SPECIAL_PRICE`; 6 `SPEND_GET_ITEM`; 7 `STEP_SPEND` (ค่าเริ่มต้น); 8 `MEMBER_TIER`; 101 `HOUSE_BRAND_COUPON`; 102 `TIER_REDEMPTION`) ฟิลด์ที่เขียน เช่น `min_qty`, `min_spend`, `discount_amount`, `discount_pct`, `free_qty`, `strict_unit_ratio`, `allow_mix_match`, `auto_add_free_item`, `max_qty_per_bill`, `customer_only`, ช่วงวัน/เวลา, `day_filter`, `items_include_json`, สินค้าของแถม (:811-945)
- การเปลี่ยนในตาราง `pos_id`, `pos_promotions`, `coupon_list`, `posconfig` และอื่น ๆ ถูกจับโดย trigger ของระบบซิงก์ จึงถึงเครื่อง POS ในรอบ `sync` ถัดไป ดู [[proc-pos-sync]]
- ฟิลด์ที่ไม่ส่งมาในหมวด `machine` ใช้ค่าเริ่มต้นที่เขียนในโค้ด (เช่น คลัง `MMA01` ที่เก็บ `SH-01` สาขา `00000` แผนก `SALE`) -- ยังไม่ยืนยันว่า upsert เขียนทับทุกคอลัมน์ด้วยค่าเริ่มต้นเมื่อไม่ส่ง

### กะขายและรับ-ส่งเงิน `POST /pos/shift` (`PosShiftAction` :974)
- `action` (ค่าเริ่มต้น `receive_money`), วัน/เวลาเริ่มต้นเป็นเวลาเซิร์ฟเวอร์ปัจจุบัน; ไม่มีรหัสเครื่อง = error "ต้องระบุรหัสเครื่อง POS" (ยกเว้น `reconcile_temp_member`)
  | `action` | ผล |
  |---|---|
  | `receive_money`, `open_shift` | เปิดกะใน `pos_period` ถ้าเครื่องนี้ยังไม่มีกะค้าง (`period_status = 0`) แล้วบันทึกรับเงินทอนเข้าลิ้นชักใน `poscashiersettle` (`trans_type = 1`); เลขเอกสารไม่ระบุ = `RCV-<ปีเดือน>-<เลขสุ่มจากเวลา>` |
  | `send_money`, `close_shift` | `close_shift` ปิดกะที่เปิดอยู่ (`period_status = 1`, บันทึกวันเวลาปิดและผู้ปิด) แล้วบันทึกนำส่งเงิน `poscashiersettle` (`trans_type = 2`) แยกเงินสด/บัตร/คูปอง/โอน ยอดรวมคำนวณจากส่วนประกอบ ถ้ารวมได้ 0 ใช้ `total_amount` ที่ส่งมา; เลขเอกสารไม่ระบุ = `SND-...` |
  | `cancel_bill` | ส่งต่อ `CancelPosBill` ดู [[proc-pos-bill]]; ต้องระบุ `doc_no` (เหตุผลเริ่มต้น "ลูกค้าขอยกเลิกบิล / คีย์รายการผิด") |
  | `upload_temp_members` | อัปโหลดสมาชิกชั่วคราวที่สร้างตอน offline ลง `pos_temp_members` (คีย์เบอร์โทร ข้ามแถวไม่มีเบอร์; แถวที่ `RECONCILED` แล้วไม่ถูกแก้; สถานะเริ่ม `PENDING`) |
  | `reconcile_temp_member` | ตั้งสถานะ `RECONCILED` พร้อมรหัสสมาชิกปลายทาง/กลุ่ม แล้วสร้าง `ar_customer` ใหม่ถ้ายังไม่มีรหัสนั้น (ไม่ระบุรหัส = `AR-` + เบอร์โทร) |
- เลขเอกสารรับ/ส่งเงินที่ซ้ำ (`docno`) จะอัปเดตแถวเดิม (`ON CONFLICT (docno) DO UPDATE`) -- ส่งซ้ำได้ผลเดิม
- action อื่น = error "ไม่รู้จักคำสั่งกะขาย: ..."
- พื้นฐานจากโค้ด C# ตามคอมเมนต์: `_periodOpenForm.cs:123` (เปิดกะเฉพาะเมื่อไม่มีกะเปิด) และ `_moneyReceive.cs:79-81` (บันทึกรับเงิน) ที่ `pos_config.go:1020-1022`

### ข้อสังเกตจากโค้ด (ยังไม่ยืนยันผลกระทบในใช้งานจริง)
- ค่าคงที่วันหมดอายุคูปอง `2026-12-31`, ค่าเริ่มต้นรหัสสาขา `00000` และคลัง `MMA01` ฝังในโค้ดของหมวดตั้งค่า (ไม่ได้อ่านจากตัวเลือกบริษัท)
- มีประเด็นด้านความปลอดภัยที่ทีมพัฒนาต้องตรวจ (ไม่เผยแพร่รายละเอียดบนเว็บสาธารณะ)

## ที่มาในโค้ด
- `backend/internal/application/process/pos_config.go:16-369` - `posConfigDDL`
- `backend/internal/application/process/pos_config.go:371-488` - `EnsurePosTables`, `ensurePosTablesPool` (ข้อมูลตัวอย่างเฉพาะ `bcdemo`)
- `backend/internal/application/process/pos_config.go:491-969` - `SavePosConfig` ทุกหมวด (`startup` :506, `machine` :587, `qr` :660, `point` :684, `coupon` :741, `coupon_batch` :779, `promotion` :811, `promotion_toggle` :946, `promotion_delete` :954)
- `backend/internal/application/process/pos_config.go:972-1208` - `PosShiftAction`
- `backend/internal/application/process/pos_config.go:1210-1285` - ตัวช่วย `firstPresent`, `posStr`, `posInt`, `posDec`
- `backend/internal/adapter/inbound/http/pos/handler.go:60-240` - `Bootstrap`
- `backend/internal/adapter/inbound/http/pos/handler.go:243-296` - `SaveConfig`, `ShiftAction`, `decodeJSONMapUseNumber`
- `backend/internal/adapter/inbound/http/router.go:329-348` - ผูก `/bootstrap`, `/config`, `/shift`

## ดูเพิ่ม
- [[proc-pos-sync]]
- [[proc-pos-bill]]
- [[proc-price-engine]]
- [[proc-master-data]]
- [[process-overview]]
