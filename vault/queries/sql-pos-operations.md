---
title: "SQL Operations: ระบบขายหน้าร้าน POS (เครื่อง, กะ, บิล, ปิดยอด, โปรโมชัน, คูปอง และซิงก์)"
audience: dev
tags:
  - sql
  - pos
  - retail
  - shift
  - sync
  - promotion
  - coupon
  - dev
aliases:
  - sql-pos
  - query-pos-operations
  - query-pos-shifts
sources:
  - backend/internal/application/process/pos_config.go:17-370
  - backend/internal/application/process/pos_sync.go:31-100
  - backend/internal/application/process/pos_bill.go:20-625
---

# SQL Operations: ระบบขายหน้าร้าน POS

> กติกาหลัก: ใช้ `[[dev-rules-accounting-sql]]` เสมอ — คัดกรอง `COALESCE(last_status, 0) = 0`, ห้ามใช้ float, และคำนวณยอดชำระจาก `cb_trans` ที่ Join กับ `ic_trans` ซึ่งยังไม่ถูกยกเลิก — ดูภาพรวมตารางทั้งหมดที่ [[sql-overview]] และ API ที่ [[api-rest-ops-ext]]

---

## 1. สถานะเครื่อง POS และสถานะ Sync แบบออฟไลน์ (`pos_id`, `posconfig`, `pos_sync_machine`)

> คำเตือนความปลอดภัย: ห้าม Query คอลัมน์ Hash ลับของเครื่องจาก `pos_sync_machine` เด็ดขาด ให้เลือกเฉพาะคอลัมน์เชิงปฏิบัติการ

```sql
SELECT p.machinecode,
       p.pos_id,
       p.machine_name,
       p.status AS pos_active_status,
       p.branch_code,
       p.department_code,
       p.pos_ic_wht AS default_wh_code,
       p.pos_ic_shelf AS default_shelf_code,
       p.pos_config_number,
       COALESCE(cfg.shop_name, '') AS shop_name,
       COALESCE(cfg.vat_type, 1) AS vat_type,
       COALESCE(cfg.vat_rate, 7)::numeric(9, 2) AS vat_rate,
       m.paired_at,
       m.last_seen_at,
       m.last_sync_at,
       m.last_cursor,
       COALESCE(m.pending_bills, 0) AS pending_bills,
       m.last_bill_at,
       COALESCE(m.app_version, '') AS app_version
FROM pos_id p
LEFT JOIN posconfig cfg ON cfg.pos_config_number = p.pos_config_number
LEFT JOIN pos_sync_machine m ON m.machine_code = p.machinecode
ORDER BY p.branch_code, p.machinecode;
```

---

## 2. สรุปยอดขายบิล POS รายวันและช่องทางรับชำระ (`ic_trans` + `cb_trans`)

ข้อสังเกตจากโค้ดจริง:
- บิลขาย POS ใช้ `trans_flag = 44` และ `COALESCE(is_pos, 0) = 1`
- เวลายกเลิกบิล POS (`cancelPosBillTx` ใน `pos_bill.go:597-625`) ระบบจะอัปเดต `last_status = 1, is_cancel = 1` บน `ic_trans`, `ic_trans_detail` และ `cb_trans_detail` แต่ไม่ได้อัปเดต `last_status` บน `cb_trans` ดังนั้นจึงต้อง Join `cb_trans` กับ `ic_trans` ที่ `COALESCE(t.last_status, 0) = 0` เสมอ
- คอลัมน์เงินโอนใน `cb_trans` สะกดว่า `tranfer_amount` (ตามโครงสร้าง BC เดิม)

```sql
SELECT t.doc_date,
       COALESCE(NULLIF(t.branch_code, ''), '00000') AS branch_code,
       COALESCE(t.pos_id, '') AS pos_id,
       COALESCE(t.cashier_code, '') AS cashier_code,
       COUNT(t.doc_no) AS bill_count,
       SUM(COALESCE(t.total_before_vat, 0))::numeric(18, 2) AS total_before_vat,
       SUM(COALESCE(t.total_vat_value, 0))::numeric(18, 2) AS total_vat_value,
       SUM(COALESCE(t.total_amount, 0))::numeric(18, 2) AS total_sales_amount,
       SUM(COALESCE(cb.cash_amount, 0))::numeric(18, 2) AS cash_amount,
       SUM(COALESCE(cb.tranfer_amount, 0))::numeric(18, 2) AS transfer_amount,
       SUM(COALESCE(cb.wallet_amount, 0))::numeric(18, 2) AS qr_wallet_amount,
       SUM(COALESCE(cb.card_amount, 0))::numeric(18, 2) AS card_amount,
       SUM(COALESCE(cb.coupon_amount, 0))::numeric(18, 2) AS coupon_amount,
       SUM(COALESCE(t.sum_point, 0))::numeric(18, 2) AS total_earned_points
FROM ic_trans t
LEFT JOIN cb_trans cb
       ON cb.doc_no = t.doc_no
      AND cb.trans_flag = t.trans_flag
WHERE t.trans_flag = 44
  AND COALESCE(t.is_pos, 0) = 1
  AND COALESCE(t.last_status, 0) = 0
  AND COALESCE(t.is_cancel, 0) = 0
  AND COALESCE(t.is_doc_copy, 0) = 0
  AND t.doc_date BETWEEN $1::date AND $2::date
GROUP BY t.doc_date, COALESCE(NULLIF(t.branch_code, ''), '00000'), COALESCE(t.pos_id, ''), COALESCE(t.cashier_code, '')
ORDER BY t.doc_date DESC, branch_code, pos_id, cashier_code;
```

### 2.1 รายการยกเลิกบิล POS (`trans_flag = 45`)

```sql
SELECT c.doc_no AS cancel_doc_no,
       c.doc_date AS cancel_date,
       c.doc_time AS cancel_time,
       c.doc_ref AS orig_bill_doc_no,
       c.pos_id,
       c.cashier_code,
       c.total_amount::numeric(18, 2) AS cancelled_amount,
       c.remark AS cancel_reason,
       ib.cancelled_by,
       ib.cancelled_at
FROM ic_trans c
LEFT JOIN pos_bill_inbox ib ON ib.doc_no = c.doc_ref
WHERE c.trans_flag = 45
  AND COALESCE(c.is_pos, 0) = 1
  AND COALESCE(c.last_status, 0) = 0
  AND c.doc_date BETWEEN $1::date AND $2::date
ORDER BY c.doc_date DESC, c.doc_time DESC;
```

---

## 3. กะ POS และใบปิดยอดแคชเชียร์ (`pos_period`, `poscashiersettle`)

```sql
SELECT p.period_guid,
       p.machine_code,
       p.period_status,
       TO_CHAR(p.begin_date, 'YYYY-MM-DD') AS begin_date,
       p.begin_time,
       COALESCE(TO_CHAR(p.end_date, 'YYYY-MM-DD'), '') AS end_date,
       p.end_time,
       p.begin_user_code,
       p.end_user_code,
       p.float_amount::numeric(18, 2) AS float_amount,
       s.docno AS settle_doc_no,
       COALESCE(s.cashamount, 0)::numeric(18, 2) AS settle_cash,
       COALESCE(s.creditcardamount, 0)::numeric(18, 2) AS settle_card,
       COALESCE(s.transferamount, 0)::numeric(18, 2) AS settle_transfer,
       COALESCE(s.coupongamount, 0)::numeric(18, 2) AS settle_coupon,
       COALESCE(s.chqamount, 0)::numeric(18, 2) AS settle_chq,
       COALESCE(s.total_in, 0)::numeric(18, 2) AS cash_in_drawer,
       COALESCE(s.total_out, 0)::numeric(18, 2) AS cash_out_drawer,
       COALESCE(s.total_cancel, 0)::numeric(18, 2) AS settle_cancel_amt,
       COALESCE(s.total_amount, 0)::numeric(18, 2) AS settle_total_amount,
       COALESCE(s.total_balance, 0)::numeric(18, 2) AS settle_balance
FROM pos_period p
LEFT JOIN poscashiersettle s
       ON s.machinecode = p.machine_code
      AND s.docdate::date = COALESCE(p.end_date, p.begin_date)::date
      AND s.cashiercode = COALESCE(NULLIF(p.end_user_code, ''), p.begin_user_code)
WHERE p.begin_date::date BETWEEN $1::date AND $2::date
ORDER BY p.begin_date DESC, p.begin_time DESC;
```

---

## 4. คิวรับบิลออฟไลน์ที่รอประมวลผลหรือ Error (`pos_bill_inbox`, `pos_stock_queue`)

`status` ใน `pos_bill_inbox`: `0` = รอประมวลผล, `1` = สำเร็จ (`done`), `2` = เกิดข้อผิดพลาดรอ Back-Office แก้และกด Reprocess (`pos_sync.go:53`).

```sql
SELECT bill_guid::text AS bill_guid,
       machine_code,
       doc_no,
       status,
       CASE status
           WHEN 0 THEN 'PENDING'
           WHEN 1 THEN 'DONE'
           WHEN 2 THEN 'ERROR'
           ELSE 'UNKNOWN'
       END AS status_label,
       error,
       received_at,
       processed_at,
       earned_points::numeric(18, 2) AS earned_points,
       cancelled_at,
       cancel_reason,
       cancelled_by
FROM pos_bill_inbox
WHERE status IN (0, 2)
   OR cancelled_at IS NOT NULL
ORDER BY received_at DESC
LIMIT 200;
```

ตรวจคิวรอ Rebuild สต็อกหลังยิงบิล POS (`pos_stock_queue`):

```sql
SELECT q.item_code,
       COALESCE(i.name_1, '') AS item_name,
       q.queued_at
FROM pos_stock_queue q
LEFT JOIN ic_inventory i ON i.code = q.item_code
ORDER BY q.queued_at ASC;
```

---

## 5. โปรโมชัน คูปอง และระบบสะสมแต้มสมาชิก

### 5.1 โปรโมชันที่เปิดใช้งาน ณ วันที่กำหนด (`pos_promotions`)

```sql
SELECT promo_code,
       promo_name,
       promo_type,
       promo_type_code,
       target_barcode,
       min_qty::numeric(18, 2) AS min_qty,
       min_spend::numeric(18, 2) AS min_spend,
       discount_amount::numeric(18, 2) AS discount_amount,
       discount_pct::numeric(18, 2) AS discount_pct,
       free_qty::numeric(18, 2) AS free_qty,
       reward_item_code,
       reward_item_name,
       date_begin,
       date_end,
       time_start,
       time_end,
       day_filter,
       customer_only
FROM pos_promotions
WHERE is_active = 1
  AND $1::text BETWEEN date_begin AND date_end
ORDER BY promo_code;
```

### 5.2 คูปองคงเหลือและกลุ่มสมาชิก/สมาชิกชั่วคราว (`coupon_list`, `pos_member_groups`, `pos_temp_members`)

```sql
SELECT number AS coupon_no,
       coupon_group,
       coupon_type,
       single_use,
       cust_code,
       amount::numeric(18, 2) AS face_amount,
       balance_amount::numeric(18, 2) AS balance_amount,
       TO_CHAR(date, 'YYYY-MM-DD') AS issue_date,
       TO_CHAR(date_expire, 'YYYY-MM-DD') AS expire_date,
       remark
FROM coupon_list
WHERE COALESCE(last_status, 0) = 0
  AND balance_amount > 0
  AND (date_expire IS NULL OR date_expire::date >= CURRENT_DATE)
ORDER BY date_expire ASC NULLS LAST, number;
```

ดูกลุ่มสมาชิก Pool Points และสมาชิกชั่วคราวที่รอยืนยัน:

```sql
SELECT g.group_code,
       g.group_name,
       g.group_type,
       g.primary_member_code,
       g.tier_level,
       g.discount_pct::numeric(18, 2) AS discount_pct,
       g.pool_points,
       g.shared_points::numeric(18, 2) AS shared_points,
       g.member_count
FROM pos_member_groups g
ORDER BY g.group_code;
```

หมายเหตุ: พารามิเตอร์ `$1::date`, `$2::date` สำหรับช่วงวันที่ และ `$1::text` สำหรับเทียบ `date_begin`/`date_end` รูปแบบ `YYYY-MM-DD` — ดูรายละเอียด Workflow ปิดกะและ Reprocess ที่ [[api-process-engine]] และ Catalog รายงานขาย POS ที่ [[api-report-catalog]]
