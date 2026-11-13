---
title: "SQL ค้นหาและเจาะลึกเอกสาร 360 องศา (หัวบิล + รายการ + ชำระเงิน + GL + สายโซ่อ้างอิง)"
audience: "dev"
tags: [queries, sql, document_lookup, doc_flow, gl_journal, cb_trans]
aliases:
  - "sql ค้นหาเลขที่เอกสาร"
  - "execDocumentLookup sql"
  - "ดูรายละเอียดบิลครบทุกตาราง"
  - "เช็กการลงบัญชีของเอกสาร doc_no"
  - "ย้อนรอยเอกสารอ้างอิง SQL"
sources:
  - "backend/internal/adapter/inbound/http/mcp/gateway.go:1935-2038"
  - "backend/internal/application/process/doc_flow_graph.go:110-380"
---

# SQL ค้นหาและเจาะลึกเอกสาร 360 องศา

ชุดคำสั่ง SQL นี้สกัดตรงจาก `gateway.go:execDocumentLookup` และ `doc_flow_graph.go` สำหรับตรวจค้นเอกสารใบใดใบหนึ่งแบบครบวงจร ตั้งแต่หัวเอกสารทุกตารางหลัก รายการสินค้า การรับ-จ่ายเงิน รายการภาษี บัญชีแยกประเภท (Dr/Cr) ไปจนถึงเอกสารต้นน้ำและปลายน้ำที่เชื่อมโยงกัน (ดูแผนผังความสัมพันธ์ที่ [[doctypes-overview]] และ [[doc-flow-and-status]])

---

## 1. ค้นหาหัวเอกสารข้ามทั้ง 4 ตารางหลัก (`ic_trans`, `ap_ar_trans`, `as_trans`, `gl_journal`)

ใช้เมื่อทราบเลขที่เอกสารบางส่วน (`$1`) หรือต้องการค้นหาเอกสารล่าสุดโดยไม่ต้องเดาว่าอยู่ในตารางใด:

### พารามิเตอร์
- `$1` (`TEXT`): เลขที่เอกสารหรือคำค้น เช่น `'SI-6911%'`

```sql
SELECT * FROM (
    SELECT 'ic_trans' AS src_table, t.doc_no, t.doc_date, t.trans_flag, t.doc_format_code,
           COALESCE(t.cust_code, '') AS party_code,
           ROUND(COALESCE(t.total_amount, 0), 2) AS total_amount,
           COALESCE(t.last_status, 0) AS last_status,
           COALESCE(t.remark, '') AS remark
    FROM ic_trans t
    WHERE t.doc_no ILIKE $1

    UNION ALL

    SELECT 'ap_ar_trans' AS src_table, a.doc_no, a.doc_date, a.trans_flag, a.doc_format_code,
           COALESCE(a.cust_code, '') AS party_code,
           ROUND(COALESCE(a.total_pay_money, a.total_net_amount, 0), 2) AS total_amount,
           COALESCE(a.last_status, 0) AS last_status,
           COALESCE(a.remark, '') AS remark
    FROM ap_ar_trans a
    WHERE a.doc_no ILIKE $1

    UNION ALL

    SELECT 'as_trans' AS src_table, s.doc_no, s.doc_date, s.trans_flag, s.doc_format_code,
           COALESCE(s.cust_code, '') AS party_code,
           ROUND(COALESCE(s.total_amount, 0), 2) AS total_amount,
           COALESCE(s.last_status, 0) AS last_status,
           COALESCE(s.remark, '') AS remark
    FROM as_trans s
    WHERE s.doc_no ILIKE $1

    UNION ALL

    SELECT 'gl_journal' AS src_table, g.doc_no, g.doc_date, COALESCE(g.trans_flag, 0) AS trans_flag,
           COALESCE(g.doc_format_code, g.book_code, '') AS doc_format_code,
           '' AS party_code,
           ROUND(COALESCE(g.debit, 0), 2) AS total_amount,
           0 AS last_status,
           COALESCE(g.description, '') AS remark
    FROM gl_journal g
    WHERE g.doc_no ILIKE $1 AND COALESCE(g.trans_flag, 0) IN (0, 601)
) all_docs
ORDER BY doc_date DESC, doc_no DESC
LIMIT 50;
```

---

## 2. ดึงคู่บัญชีเดบิต-เครดิต (`gl_journal_detail`) ที่เกิดจากเอกสารใบนั้น

ใช้ตรวจสอบว่าเอกสารเลขที่ `$1` โพสต์ลงสมุดรายวันเล่มใด บัญชีใดบ้าง และสมดุล (`debit = credit`) หรือไม่:

### พารามิเตอร์
- `$1` (`TEXT`): เลขที่เอกสารเต็ม เช่น `'SI-6911-0001'`

```sql
SELECT
    d.doc_date,
    COALESCE(d.book_code, '') AS book_code,
    d.doc_no,
    COALESCE(d.trans_flag, 0) AS trans_flag,
    d.line_number,
    d.account_code,
    COALESCE(NULLIF(d.account_name, ''), c.name_1, '') AS account_name,
    ROUND(COALESCE(d.debit, 0), 2) AS debit,
    ROUND(COALESCE(d.credit, 0), 2) AS credit,
    COALESCE(d.description, '') AS line_description,
    COALESCE(d.branch_code, '') AS branch_code
FROM gl_journal_detail d
LEFT JOIN gl_chart_of_account c ON c.code = d.account_code
WHERE d.doc_no = $1
ORDER BY d.trans_flag ASC, d.line_number ASC;
```

---

## 3. ดึงสายโซ่ความสัมพันธ์ต้นน้ำและปลายน้ำของเอกสาร (`doc_no = $1`)

รวมจุดเชื่อมหลักทั้งหมด (ใบสั่งซื้อ/สั่งขาย ↔ บิลซื้อ/ขาย ↔ ลดหนี้/เพิ่มหนี้ ↔ วางบิล ↔ รับ/จ่ายชำระหนี้ ↔ มัดจำ ↔ ใบยกเลิก):

### พารามิเตอร์
- `$1` (`TEXT`): เลขที่เอกสารเป้าหมาย

```sql
SELECT DISTINCT relation_role, related_doc_no, related_date, related_flag, status_flag
FROM (
    -- 1. เอกสารต้นน้ำที่ถูกอ้างผ่าน ic_trans_detail.ref_doc_no
    SELECT 'UPSTREAM_ITEM_REF' AS relation_role, u.doc_no AS related_doc_no, u.doc_date AS related_date,
           u.trans_flag AS related_flag, COALESCE(u.last_status, 0) AS status_flag
    FROM ic_trans_detail d
    JOIN ic_trans u ON u.doc_no = d.ref_doc_no
    WHERE d.doc_no = $1 AND COALESCE(d.ref_doc_no, '') <> ''

    UNION ALL

    -- 2. เอกสารปลายน้ำที่อ้างมายัง $1 ผ่าน ic_trans_detail.ref_doc_no หรือ ic_trans.doc_ref
    SELECT 'DOWNSTREAM_IC_DOC' AS relation_role, h.doc_no, h.doc_date, h.trans_flag, COALESCE(h.last_status, 0)
    FROM ic_trans h
    WHERE h.doc_ref = $1
       OR EXISTS (SELECT 1 FROM ic_trans_detail d WHERE d.doc_no = h.doc_no AND d.trans_flag = h.trans_flag AND d.ref_doc_no = $1)

    UNION ALL

    -- 3. ใบวางบิล (213, 235) และใบรับ/จ่ายชำระหนี้ (19, 239) ที่อ้างบิล $1 ใน ap_ar_trans_detail
    SELECT CASE WHEN p.trans_flag IN (213, 235) THEN 'BILLING_NOTE' ELSE 'SETTLEMENT_VOUCHER' END,
           p.doc_no, p.doc_date, p.trans_flag, COALESCE(p.last_status, 0)
    FROM ap_ar_trans_detail p
    WHERE p.billing_no = $1

    UNION ALL

    -- 4. บิลหนี้ที่ถูกตัดชำระภายในใบวางบิล/ใบเสร็จ/ใบจ่ายชำระ $1
    SELECT 'SETTLED_INVOICE' AS relation_role, p.billing_no, p.billing_date, p.bill_type, COALESCE(p.last_status, 0)
    FROM ap_ar_trans_detail p
    WHERE p.doc_no = $1 AND COALESCE(p.billing_no, '') <> ''

    UNION ALL

    -- 5. การตัดเงินมัดจำ/เงินล่วงหน้าใน cb_trans_detail (doc_type 5, 6)
    SELECT 'DEPOSIT_APPLIED' AS relation_role, cd.trans_number, cd.doc_date, cd.doc_type, COALESCE(cd.last_status, 0)
    FROM cb_trans_detail cd
    WHERE cd.doc_no = $1 AND cd.doc_type IN (5, 6) AND COALESCE(cd.trans_number, '') <> ''
) links
ORDER BY related_date ASC NULLS LAST, related_doc_no ASC;
```

---

## 4. ข้อควรระวัง (Gotchas)
1. **คีย์คู่ `(doc_no, trans_flag)`**: แม้ในทางปฏิบัติเลขที่เอกสารมักมีคำนำหน้าต่างกัน (`SI-`, `PU-`, `EE-`) แต่ในตารางเดียวกัน (เช่น ใบโอนคลัง `72` กับแฝดรับเข้า `70` หรือโอนเงิน `422` กับแฝด `420`) จะมี `doc_no` เดียวกันอยู่ 2 แถวโดยต่างกันที่ `trans_flag` เสมอ!
2. **ต้องการเรียกผ่าน MCP Tool สำเร็จรูป**: หากเชื่อมต่อผ่าน MCP Gateway สามารถเรียก tool `bc_document_lookup` โดยส่ง `doc_no` ได้ทันที (ดูสเปกใน [[api-mcp-gateway]])
