---
title: "คุณลักษณะสินค้า, โปรโมชั่น, ของแถม และระบบแต้มสมาชิก POS"
tags: [schema, inventory, attributes, promotion, premium, pos_point, bcaiaccount]
aliases: [ic_type, ic_group, ic_category, ic_brand, ic_promotion, ic_purchase_permium, pos_point_condition]
sources:
  - scripts/sql/02_data_schema.sql:4805-4908
  - scripts/sql/02_data_schema.sql:4992-5041
  - scripts/sql/02_data_schema.sql:5118-5182
  - scripts/sql/02_data_schema.sql:5836-5849
  - scripts/sql/02_data_schema.sql:5864-5877
  - scripts/sql/02_data_schema.sql:6086-6257
  - scripts/sql/02_data_schema.sql:6373-6380
  - scripts/sql/02_data_schema.sql:6481-6505
  - scripts/sql/02_data_schema.sql:7205-7218
  - scripts/sql/02_data_schema.sql:8282-8298
  - scripts/sql/02_data_schema.sql:8330-8371
  - scripts/sql/04_seed_data.sql:242-348
  - backend/internal/application/process/pos_config.go:119-155
  - backend/internal/application/process/point_doc.go:14-34
---

# คุณลักษณะสินค้า, โปรโมชั่น, ของแถม และระบบแต้มสมาชิก POS

กลุ่มตารางนี้รวมมาสเตอร์การจัดหมวดหมู่/คุณลักษณะของสินค้าใน [[tbl-ic-inventory]], เงื่อนไขโปรโมชั่นขายปลีก, ของแถมฝั่งซื้อ/ขาย, และกฎการให้คะแนนสะสมสมาชิก POS (รวมถึงการบันทึกรายการแต้ม `801`/`802` ใน [[tbl-ic-trans]])

## 1. ตารางคุณลักษณะและการจัดหมวดหมู่สินค้า (Attributes & Classification)

ทุกตารางหลักใช้รูปแบบมาตรฐาน `(code varchar(25), name_1 varchar(100), name_2 varchar(100), status smallint, guid_code)` พร้อม `roworder SERIAL` และ Index `idx_<table>_code` (ไม่มี SQL `PRIMARY KEY` ใน `02_data_schema.sql`):

| ตาราง (`02_data_schema.sql`) | คอลัมน์เชื่อมใน `ic_inventory` / บทบาท | หมายเหตุสำคัญ |
|---|---|---|
| `ic_type` (`7205-7218`) | ประเภทสินค้าทั่วไป | Index `idx_ic_type_code` |
| `ic_group` (`5133-5147`) | `group_main` (กลุ่มสินค้าหลัก) | มี `sort_order smallint` |
| `ic_group_sub` (`5149-5164`) | `group_sub` (กลุ่มย่อยระดับ 1) | ผูก `main_group`, `sub_no` |
| `ic_group_sub2` (`5166-5182`) | `group_sub2` (กลุ่มย่อยระดับ 2) | ผูก `main_group`, `ic_group_sub_code`, `sub_no` |
| `ic_category` (`4833-4846`) | `item_category` (หมวดหมู่สินค้า) | — |
| `ic_category_thai7` (`4848-4863`) | หมวดหมู่สำหรับแพลตฟอร์มภายนอก | มี `parent_code`, `cate_type` |
| `ic_brand` (`4818-4831`), `ic_model` (`5864-5877`) | `item_brand` (ยี่ห้อ), `item_model` (รุ่น) | — |
| `ic_design` (`4992-5005`), `ic_grade` (`5118-5131`), `ic_class` (`4880-4893`), `ic_character` (`4865-4878`) | `item_design`, `item_grade`, `item_class`, `item_character` | ลักษณะ รูปแบบ เกรด คลาส |
| `ic_dimension_name` (`5024-5041`) & `ic_dimension` (`5007-5022`) | นิยามชื่อมิติ 1–45 (`dimension_number`) และค่าตัวเลือกมิติ (`dimension_no`) | ใช้ใน `ic_inventory_detail.dimension_1..20` |
| `ic_attribute_thai7` (`4805-4816`) | คุณลักษณะเพิ่มเติม (`attribute_name`, `attribute_value`) | ผูก `ic_code`, `member_id` |
| `ic_issue_type` (`5836-5849`), `ic_close_reason` (`4895-4908`) | ประเภทการเบิกใช้ (`ISS01..`) และเหตุผลการปิดรายการ (`CLS01..`) | `04_seed_data.sql:334-348` |
| `ic_specific_search` (`6481-6492`) & `ic_specific_search_word` (`6494-6505`) | คำค้นหาเฉพาะทาง / อะไหล่ (`ic_code`, `keyword`, `engine_valve`, `displacement`, `market_names`) | ใช้จับคู่ค้นหารหัสสินค้า |
| `ic_report_sort_item` (`6373-6380`) | จัดลำดับการเรียงสินค้าบนรายงาน (`ic_code`, `line_number`) | — |

## 2. โปรโมชั่นและสูตรโปรโมชั่น (`02_data_schema.sql:6086-6216` & `pos_config.go:145-155`)

- **โปรโมชั่นแบบดั้งเดิม**:
  - `ic_promotion` (`6086-6104`): หัวโปรโมชั่น (`promote_code`, `promote_name`, `promote_type`, `promote_start`, `promote_stop`, `ar_type`, `ar_group`, `ar_code_1`, `ar_code_2`, `status`)
  - `ic_promotion_detail` (`6106-6125`): เงื่อนไขสินค้าและของแถมในโปรโมชั่น (`promote_code`, `ic_code`, `unit_code`, `qty_1`, `qty_2`, `promote_price`, `promote_sum_price`, `free_ic_code`, `free_ic_unit`, `free_qty`)
- **โปรโมชั่นแบบสูตรเงื่อนไข (`ic_promotion_formula*`)**:
  - `ic_promotion_formula` (`6127-6154`, Index `code`): หัวสูตร (`code`, `name_1`, `order_number`, `cust_code_condition`, `cust_group_condition`, `member_condition`, `lock_promotion`, `lock_code_list`, `lock_day`, `from_date`, `to_date`)
  - `ic_promotion_formula_condition` (`6168-6186`): เงื่อนไขสินค้า/ช่วงจำนวน (`condition_case`, `condition_from`, `condition_to`, `condition_value_from`, `condition_value_to`, `condition_group`)
  - `ic_promotion_formula_action` (`6156-6166`): คำสั่งผลลัพธ์ (`qty_from`, `qty_to`, `action_command`)
  - `ic_promotion_formula_group_qty` (`6188-6198`): จัดกลุ่มจำนวน/ยอดซื้อ (`qty`, `group_number`, `group_amount`)
  - `ic_promotion_formula_price_discount` (`6200-6216`, Index `code`, `item_code`): ราคาและส่วนลดขั้นบันได (`item_code`, `item_unit`, `qty_start`, `qty_end`, `price`, `discount`)
- **โปรโมชั่น POS ใหม่ใน Go (`pos_config.go:145-155`)**: ตาราง `pos_promotions` (`promo_code PRIMARY KEY`, `promo_type`, `target_barcode`, `min_qty`, `min_spend`, `discount_amount`, `discount_pct`)

## 3. ของแถมฝั่งซื้อ (`ic_purchase_permium*`, `02_data_schema.sql:6218-6257`)

*(หมายเหตุ: ชื่อตารางในสคีมาสะกด `permium` ตามต้นฉบับ C#)*
- `ic_purchase_permium` (`6218-6231`): หัวรายการของแถม (`permium_code`, `name_1`, `date_begin`, `date_end`, `important`, `status`)
- `ic_purchase_permium_condition` (`6235-6246`): เงื่อนไขยอดซื้อที่ได้รับสิทธิ์ (`permium_code`, `ic_code`, `unit_code`, `qty`, `stand_value`, `divide_value`)
- `ic_purchase_permium_list` (`6248-6257`): รายการของแถมที่จะได้รับ (`permium_code`, `ic_code`, `unit_code`, `qty`)

## 4. ระบบแต้มสมาชิก (`pos_point_*`, `point_center_*` และ `ic_trans` 801/802)

- **`pos_point_condition`** (`02_data_schema.sql:8330-8339` + Go Runtime `pos_config.go:119-144`): กฎสะสม/แลกแต้มพื้นฐาน + อัตราคูณวันเกิด/เดือนเกิด (`birth_month`, `birth_day`, `birth_month_use`, `birth_day_use`) ซึ่ง Go ขยายเพิ่ม `condition_code UNIQUE`, `baht_per_point`, `points_per_baht_redeem`, `min_redeem_points`, `birth_month_multiplier`, `birth_day_multiplier`, `vip_tier_silver_min`, `vip_tier_gold_min`, `vip_tier_platinum_min`
- **`pos_point_period`** (`8341-8351`): เงื่อนไขสะสมแต้มตามช่วงวันที่ (`from_date`, `to_date`, `amount`, `point_value`, `point_value_condition`)
- **`pos_point_special_day`** (`8353-8371`): ตัวคูณแต้มพิเศษตามวันในสัปดาห์ (`multiply_point`, `day_0`..`day_7`, `order_condition`)
- **`point_center_sync`** (`8290-8298`) & **`point_center_sms`** (`8282-8288`): คิวซิงก์แต้มศูนย์กลาง (`doc_no`, `amount`, `command`) และเบอร์รับข้อความ (`telephone_number`)
- **เอกสารยอดยกมาและตัดแต้ม**: บันทึกใน [[tbl-ic-trans]] (`trans_flag = 801` แต้มยกมา และ `802` ตัดแต้ม, เก็บแต้มใน `sum_point`, ไม่มี `ic_trans_detail` ตาม `point_doc.go:14-21`)

## ตัวอย่าง SQL จริง: สรุปยอดแต้มคงเหลือของสมาชิกจากเอกสาร `801`/`802` และบิลขาย POS

```sql
SELECT t.cust_code,
       SUM(CASE
           WHEN t.trans_flag = 801 THEN COALESCE(t.sum_point, 0)
           WHEN t.trans_flag = 802 THEN -COALESCE(t.sum_point, 0)
           ELSE COALESCE(t.sum_point, 0)
       END) AS net_point
FROM ic_trans t
WHERE COALESCE(t.last_status, 0) = 0
  AND t.trans_flag IN (44, 801, 802)
  AND t.cust_code = $1
GROUP BY t.cust_code;
```
