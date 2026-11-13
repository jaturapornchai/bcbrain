---
title: ตารางโปรโมชั่น คูปอง สะสมแต้ม และกลุ่มสมาชิก POS (pos_promotions, coupon_list, pos_point_condition, pos_member_groups, pos_slip_campaign_*)
tags:
  - schema
  - pos
  - promotion
  - loyalty
  - coupon
aliases:
  - pos_promotions
  - coupon_list
  - pos_point_condition
  - pos_point_period
  - pos_point_special_day
  - point_center_sms
  - point_center_sync
  - pos_member_groups
  - pos_temp_members
  - pos_slip_campaign
  - pos_slip_campaign_items
  - pos_slip_campaign_brand
  - pos_slip_campaign_category
  - pos_slip_campaign_group
sources:
  - backend/internal/application/process/pos_config.go:119
  - backend/internal/application/process/pos_config.go:145
  - backend/internal/application/process/pos_config.go:193
  - backend/internal/application/process/pos_config.go:246
  - backend/internal/application/process/pos_config.go:257
  - backend/internal/application/process/pos_config.go:313
  - backend/internal/application/process/pos_config.go:331
  - backend/internal/application/process/pos_config.go:841
  - backend/internal/application/process/master_detail_specs.go:531
  - scripts/sql/02_data_schema.sql:2303
  - scripts/sql/02_data_schema.sql:8282
  - scripts/sql/02_data_schema.sql:8290
  - scripts/sql/02_data_schema.sql:8330
  - scripts/sql/02_data_schema.sql:8341
  - scripts/sql/02_data_schema.sql:8353
---

# ตารางโปรโมชั่น คูปอง สะสมแต้ม และกลุ่มสมาชิก POS (`pos_promotions`, `coupon_list`, `pos_point_condition`, `pos_member_groups`)

กลุ่มตารางส่งเสริมการขายและระบบสมาชิกหน้าร้าน POS ครอบคลุมกติกาโปรโมชั่น (`pos_promotions`), คูปองส่วนลด (`coupon_list`), เงื่อนไขสะสม/แลกแต้มสมาชิก (`pos_point_*`, `point_center_*`), กลุ่มสมาชิกค้าส่ง/VIP และสมาชิกชั่วคราว (`pos_member_groups`, `pos_temp_members`) รวมถึงแคมเปญข้อความ/บาร์โค้ดท้ายสลิป (`pos_slip_campaign*`) โดยเชื่อมเข้ากับคอลัมน์แต้มสะสมใน `ar_customer` (`point_balance`, `ar_tier_code`, `price_level` ที่ขยายใน `pos_config.go:270-272`, ดูตารางลูกหนี้หลักผ่าน [[schema-overview]])

---

## 1. ภาพรวมตารางในกลุ่มโปรโมชั่นและสมาชิก POS

| ตาราง | Primary Key / Unique Key | วัตถุประสงค์หลัก | ที่มา DDL |
| :--- | :--- | :--- | :--- |
| `pos_promotions` | `promo_code VARCHAR(50) PRIMARY KEY` | กติกาโปรโมชั่นหน้าร้าน (แถม, จับคู่, ลดขั้นบันได, ราคาพิเศษ, แลกแต้ม) | `pos_config.go:145` |
| `coupon_list` | `roworder`, `number` (`UNIQUE`) | ทะเบียนคูปองส่วนลด/เงินสด มูลค่าคงเหลือ วันหมดอายุ และสถานะการใช้ | `pos_config.go:193`, `02_data_schema.sql:2303` |
| `pos_point_condition` | `roworder`, `condition_code` (`UNIQUE`) | กติกาหลักในการได้แต้ม แลกแต้ม โบนัสวันเกิด และเกณฑ์ระดับ VIP | `pos_config.go:119`, `02_data_schema.sql:8330` |
| `pos_point_period` | `roworder` (`SERIAL NOT NULL`) | ช่วงเวลาให้แต้มพิเศษ (`from_date` – `to_date`) | `02_data_schema.sql:8341` |
| `pos_point_special_day` | `roworder` (`SERIAL NOT NULL`) | ตัวคูณแต้มวันพิเศษ/รายวันในสัปดาห์ (`day_0`..`day_7`) | `02_data_schema.sql:8353` |
| `point_center_sms`, `point_center_sync` | `roworder` (`SERIAL NOT NULL`) | คิวซิงค์แต้มส่วนกลางและแจ้งเตือน SMS | `02_data_schema.sql:8282, 8290` |
| `pos_member_groups` | `group_code VARCHAR(50) PRIMARY KEY` | กลุ่มสมาชิกรวมแต้ม/ส่วนลดค้าส่ง (`pool_points`, `shared_points`) | `pos_config.go:246` |
| `pos_temp_members` | `telephone VARCHAR(50) PRIMARY KEY` | สมาชิกชั่วคราวตามเบอร์โทรระหว่างรอผูกกับ `ar_customer` | `pos_config.go:257` |
| `pos_slip_campaign` *(ฐานข้อมูลเดิม)* | `code` (ดู `master_detail_specs.go:532`) | แคมเปญพิมพ์หัว/ท้ายสลิป POS *(เฉพาะ `ALTER TABLE` ใน `pos_config.go:313-330`)* | `pos_config.go:313` |
| `pos_slip_campaign_items`, `_brand`, `_category`, `_group` | `roworder SERIAL PRIMARY KEY` | เงื่อนไขสินค้า/ยี่ห้อ/หมวด/กลุ่มสินค้าที่ร่วมแคมเปญท้ายสลิป | `pos_config.go:331-368` |

---

## 2. โครงสร้างตารางสำคัญ

### `pos_promotions` — กติกาโปรโมชั่นหน้าร้าน
* **Primary Key**: `promo_code VARCHAR(50) PRIMARY KEY`
* **รหัสประเภทโปรโมชั่น `promo_type_code` → `promo_type`** (อ้างอิง `pos_config.go:841-860`):
  * `1`, `3` → `'BUY_X_GET_Y'` (ซื้อ X แถม Y)
  * `2`, `5` → `'BUNDLE_QTY'` (จัดชุดครบจำนวน)
  * `4` → `'SPECIAL_PRICE'` (ราคาพิเศษ)
  * `6` → `'SPEND_GET_ITEM'` (ยอดถึงเกณฑ์รับของแถม)
  * `7` → `'STEP_SPEND'` (ส่วนลดขั้นบันไดตามยอดซื้อ, ค่าเริ่มต้น)
  * `8` → `'MEMBER_TIER'` (โปรโมชั่นระดับสมาชิก)
  * `101` → `'HOUSE_BRAND_COUPON'`
  * `102` → `'TIER_REDEMPTION'`
* **คอลัมน์เงื่อนไขและเวลาใช้สิทธิ์**:
  * `promo_name` (`VARCHAR(200)`), `description` (`TEXT`), `target_barcode` (`VARCHAR(64)`)
  * `min_qty` (`NUMERIC(18,2)`), `min_spend` (`NUMERIC(18,2)`), `discount_amount` (`NUMERIC(18,2)`), `discount_pct` (`NUMERIC(18,2)`), `discount_text` (`VARCHAR(64)`), `free_qty` (`NUMERIC(18,2)`)
  * การคุมหน่วยสินค้า: `unit_stand` (`NUMERIC(18,2) DEFAULT 1`), `unit_divide` (`NUMERIC(18,2) DEFAULT 1`), `strict_unit_ratio` (`INT DEFAULT 1`)
  * เงื่อนไขจัดชุด/ของแถม: `allow_mix_match` (`INT DEFAULT 1`), `auto_add_free_item` (`INT DEFAULT 1`), `max_qty_per_bill` (`NUMERIC(18,2)`), `customer_only` (`INT DEFAULT 0`)
  * ช่วงวันที่-เวลา: `date_begin` (`VARCHAR(30)`), `date_end` (`VARCHAR(30)`), `time_start` (`VARCHAR(10)`), `time_end` (`VARCHAR(10)`), `day_filter` (`VARCHAR(50) DEFAULT 'ALL'`)
  * รายการและสินค้าของแถม: `items_include_json` (`TEXT DEFAULT '{}'`), `reward_item_code` (`VARCHAR(64)`), `reward_item_name` (`VARCHAR(200)`), `is_active` (`INT DEFAULT 1`)

---

### `coupon_list` — ทะเบียนคูปองส่วนลด POS
* **Unique Indexes**: `idx_coupon_list_number_uq` บน `(number)` (`pos_config.go:207`) และ `idx_coupon_list_cust_code` บน `(cust_code)` (`02_data_schema.sql:2321`)
* **คอลัมน์**: `roworder` (`SERIAL PRIMARY KEY`), `number` (`VARCHAR(64) UNIQUE NOT NULL`), `amount` (`NUMERIC(18,2)`), `balance_amount` (`NUMERIC(18,2)` — มูลค่าคงเหลือที่ใช้ได้), `last_status` (`INT` / `smallint`, `0` = พร้อมใช้), `date` (`TIMESTAMP`), `date_expire` (`TIMESTAMP`), `remark` (`VARCHAR(255)`), `coupon_type` (`INT DEFAULT 0`), `single_use` (`INT DEFAULT 1` ใน Go / `smallint DEFAULT 0` ใน `02_data_schema.sql`), `cust_code` (`VARCHAR(50)`), `coupon_group` (`VARCHAR(50) DEFAULT 'SME-PROMO'`), `guid_code` (`VARCHAR(35)` ใน `02_data_schema.sql`)

---

### กลุ่มตารางสะสมแต้ม (`pos_point_*`, `point_center_*`)
* **`pos_point_condition`** (`pos_config.go:119`, Unique Index `idx_pos_point_condition_code_uq`):
  * `condition_code` (`VARCHAR(50) UNIQUE NOT NULL DEFAULT 'POINT-STD'`)
  * อัตราคำนวณแต้ม: `baht_per_point` (`NUMERIC(18,2) DEFAULT 25.00`), `points_per_baht_redeem` (`NUMERIC(18,2) DEFAULT 10.00`), `min_redeem_points` (`NUMERIC(18,2) DEFAULT 100.00`)
  * โบนัสวันเกิด: `birth_month_multiplier` (`NUMERIC(18,2) DEFAULT 2.00`), `birth_day_multiplier` (`NUMERIC(18,2) DEFAULT 3.00`), `birth_month_use` (`INT DEFAULT 1`), `birth_day_use` (`INT DEFAULT 1`) *(ใน Legacy `02_data_schema.sql:8330` ใช้ `birth_month`, `birth_day` แทน)*
  * เกณฑ์ระดับ VIP: `vip_tier_silver_min` (`500.00`), `vip_tier_gold_min` (`2000.00`), `vip_tier_platinum_min` (`5000.00`)
* **`pos_point_period`** (`02_data_schema.sql:8341`): `from_date`, `to_date`, `amount`, `point_value`, `point_value_condition` (`VARCHAR(1000)`)
* **`pos_point_special_day`** (`02_data_schema.sql:8353`): `from_date`, `to_date`, `multiply_point`, `description`, `day_0` ถึง `day_7` (`smallint`), `order_condition`
* **`point_center_sms`** (`02_data_schema.sql:8282`): `telephone_number` (`VARCHAR(10)`)
* **`point_center_sync`** (`02_data_schema.sql:8290`): `doc_no`, `amount`, `command` (`smallint`)

---

### `pos_member_groups` และ `pos_temp_members`
* **`pos_member_groups`** (`pos_config.go:246`): `group_code VARCHAR(50) PRIMARY KEY`, `group_name VARCHAR(200)`, `group_type VARCHAR(50) DEFAULT 'WHOLESALE'`, `primary_member_code VARCHAR(50)`, `tier_level VARCHAR(50) DEFAULT 'GOLD'`, `discount_pct NUMERIC(18,2) DEFAULT 5.00`, `pool_points INT DEFAULT 1`, `shared_points NUMERIC(18,2) DEFAULT 0`, `member_count INT DEFAULT 1`
* **`pos_temp_members`** (`pos_config.go:257`): `telephone VARCHAR(50) PRIMARY KEY`, `temp_name VARCHAR(200)`, `source_terminal_id VARCHAR(50) DEFAULT 'POS-01'`, `bill_count INT DEFAULT 1`, `total_spend NUMERIC(18,2) DEFAULT 0`, `pending_points NUMERIC(18,2) DEFAULT 0`, `status VARCHAR(30) DEFAULT 'PENDING'` *(เปลี่ยนเป็น `'RECONCILED'` เมื่อรวมเข้าสมาชิกจริง — `pos_config.go:1189`)*, `target_member_code VARCHAR(50)`, `target_group_id VARCHAR(50)`, `created_at TIMESTAMP`

---

### แคมเปญท้ายใบเสร็จ POS (`pos_slip_campaign` และตารางลูก)
ในฐานข้อมูล Legacy ใช้ตารางหลัก `pos_slip_campaign` (`code`, `name_1`) ร่วมกับคอลัมน์ที่ `pos_config.go:313-330` ทำ `ALTER TABLE ADD COLUMN IF NOT EXISTS` ได้แก่ `name_2`, `from_date`, `to_date`, `campaign_type`, `campaign_order`, `amount_1`, `amount_2`, `status`, `lock_member`, `header_1`..`header_4`, `footer_1`..`footer_4`, `barcode_print` *(ข้อควรระวัง: ไม่มี `CREATE TABLE IF NOT EXISTS pos_slip_campaign` ใน `02_data_schema.sql` ต้องสร้างจากสคีมา Legacy หรือตรวจสอบก่อน query)* ส่วนตารางลูกทั้ง 4 ถูกสร้างไว้ใน `pos_config.go:331-368` (Key `code`, `line_number`):
* `pos_slip_campaign_items`: `code`, `line_number`, `item_code`, `unit_code`
* `pos_slip_campaign_brand`: `code`, `line_number`, `item_brand`
* `pos_slip_campaign_category`: `code`, `line_number`, `item_category`
* `pos_slip_campaign_group`: `code`, `line_number`, `group_main`

---

## 3. รูปแบบการ JOIN และคำสั่ง SELECT พร้อมใช้งาน

* `coupon_list.cust_code = ar_customer.code`
* `pos_temp_members.target_member_code = ar_customer.code`
* `pos_temp_members.target_group_id = pos_member_groups.group_code`
* `pos_member_groups.primary_member_code = ar_customer.code` ([[schema-overview]])

```sql
-- ดึงโปรโมชั่นที่กำลังเปิดใช้งานและแสดงเงื่อนไขขั้นต่ำ/ของแถม
SELECT
    promo_code,
    promo_name,
    promo_type,
    promo_type_code,
    target_barcode,
    min_qty::NUMERIC(18,2) AS min_qty,
    min_spend::NUMERIC(18,2) AS min_spend,
    discount_amount::NUMERIC(18,2) AS discount_amount,
    discount_pct::NUMERIC(18,2) AS discount_pct,
    free_qty::NUMERIC(18,2) AS free_qty,
    reward_item_code,
    date_begin,
    date_end
FROM pos_promotions
WHERE is_active = 1
ORDER BY promo_type_code ASC, promo_code ASC;
```

```sql
-- ตรวจสอบสมาชิกชั่วคราวที่ยังไม่ได้รวมยอดเข้าทะเบียนสมาชิกหลัก (PENDING) พร้อมกลุ่มเป้าหมาย
SELECT
    tm.telephone,
    tm.temp_name,
    tm.source_terminal_id,
    tm.bill_count,
    tm.total_spend::NUMERIC(18,2) AS total_spend,
    tm.pending_points::NUMERIC(18,2) AS pending_points,
    tm.target_member_code,
    c.name_1 AS target_member_name,
    tm.target_group_id,
    g.group_name AS target_group_name
FROM pos_temp_members tm
LEFT JOIN ar_customer c
    ON c.code = tm.target_member_code
LEFT JOIN pos_member_groups g
    ON g.group_code = tm.target_group_id
WHERE tm.status <> 'RECONCILED'
ORDER BY tm.created_at DESC;
```
