---
title: "คลังคำสั่ง SQL มาตรฐานและกฎการ Query ข้อมูลบัญชี-การเงิน (SQL Query Hub)"
audience: "dev"
tags: [queries, sql, overview, postgresql, accounting]
aliases:
  - "sql overview"
  - "คลังคำสั่ง SQL"
  - "ตัวอย่าง SQL BC Ai Account"
  - "query ยอดขาย ลูกหนี้ เจ้าหนี้ งบการเงิน ภาษี"
  - "กฎเหล็กการเขียน SQL บัญชี"
  - "bc_query_readonly sql"
sources:
  - "backend/internal/adapter/inbound/http/mcp/gateway.go:1812-2230"
  - "backend/internal/application/process/report_menu_ap_ar.go:541-655"
  - "backend/internal/application/process/report_menu_gl_fa.go:343-1305"
  - "backend/internal/application/process/report_menu_cb.go:640-845"
  - "backend/internal/application/process/report_menu_so_po.go:524-835"
---

# คลังคำสั่ง SQL มาตรฐานและกฎการ Query ข้อมูลบัญชี-การเงิน

เอกสารนี้เป็นศูนย์กลางคำสั่ง PostgreSQL (`SELECT` / `WITH` แบบ Read-Only) ที่สกัดตรงจาก Engine รายงาน, Process Service และ MCP Gateway ของ BC Ai Account เพื่อให้นักพัฒนาและ AI นำไปรันผ่าน `bc_query_readonly` / `bc_batch_readonly` (ดู [[api-mcp-gateway]]) หรือใช้สร้าง Dashboard/BI ต่อยอดได้ทันทีโดยตัวเลขตรงกับหน้าจอโปรแกรม 100%

(ดูแผนที่หลักที่ [[index]], กฎเหล็กตัวเลขที่ [[dev-rules-accounting-sql]], โครงสร้างตารางที่ [[schema-overview]] และรหัสเอกสารที่ [[doctypes-overview]])

---

## 1. กฎเหล็ก 5 ข้อก่อนรัน SQL ทุกคำสั่งในฐานข้อมูล BC Ai Account

1. **กรองเอกสารยกเลิกเสมอ (`COALESCE(last_status, 0) = 0`)**:
   - ตาราง `ic_trans`, `ic_trans_detail`, `ap_ar_trans`, `ap_ar_trans_detail`, `cb_trans`, `cb_trans_detail`, `as_trans`, `as_trans_detail` ใช้ `COALESCE(last_status, 0) = 0`
   - ตาราง `cb_trans` / `cb_trans_detail` ต้องตรวจหัวเอกสารแม่ด้วย (`ap_ar_trans` สำหรับ `19, 239`, `as_trans` สำหรับ `1802`, ที่เหลือตรวจ `ic_trans` — ดู [[doc-impact-cash-bank-cheque]])
   - ตาราง `gl_journal` / `gl_journal_detail` กรอง `COALESCE(d.is_pass, 0) IN (0, 1)` และเมื่อคำนวณงบกำไรขาดทุนต้องตัดรายการปิดบัญชีสิ้นงวดออกด้วย **`COALESCE(d.journal_type, 0) <> 2`**
2. **ห้ามใช้ `FLOAT` / `DOUBLE PRECISION` เด็ดขาด**:
   - ใช้ `NUMERIC` และ `ROUND(..., 2)` (หรือ `::numeric(18,2)`) เสมอเพื่อป้องกันเศษทศนิยมเพี้ยน
3. **ระวังเครื่องหมายใบลดหนี้ (Credit Note Sign Reversal)**:
   - หัวบิลใบลดหนี้ (`48, 97, 103, 252` และ `16, 317, 85, 91, 262`) เก็บ `total_amount` เป็น **ค่าบวก (`> 0`)**
   - แต่บรรทัดตัดชำระใบลดหนี้ใน `ap_ar_trans_detail` (`trans_flag IN (19, 239)`) เก็บ `sum_pay_money` เป็น **ค่าติดลบ (`< 0`)**! ดังนั้นยอดคงค้างของใบลดหนี้คือ `-1 * (COALESCE(t.total_amount, 0) + paid)` (ดู [[doc-impact-ar-ap-deposit]])
4. **แยกเงินสด vs เงินเชื่อด้วย `inquiry_type` คู่กับ `trans_flag` เสมอ**:
   - ขายเชื่อ (`44, 46, 1802`) และซื้อเชื่อ (`12, 315, 14, 316`): `COALESCE(inquiry_type, 0) IN (0, 2)`
   - ลดหนี้ขายเชื่อ (`48`): `COALESCE(inquiry_type, 0) IN (0, 2, 4)`
   - ลดหนี้ซื้อเชื่อ (`16, 317`): `COALESCE(inquiry_type, 0) IN (0, 1)`
5. **แปลงปี พ.ศ./ค.ศ. ในตารางภาษีมูลค่าเพิ่ม**:
   - คอลัมน์ `vat_effective_year` ใน `gl_journal_vat_buy` และ `gl_journal_vat_sale` อาจเก็บทั้ง `2569` (พ.ศ.) หรือ `2026` (ค.ศ.) ให้แปลงด้วย `CASE WHEN vat_effective_year > 2400 THEN vat_effective_year - 543 ELSE vat_effective_year END` เสมอ

---

## 2. ตารางสรุปการกรองข้อมูลแยกตามหมวดตาราง

| ตารางเป้าหมาย | เงื่อนไข `WHERE` บังคับพื้นฐาน | คอลัมน์ยอดเงินหลัก (`NUMERIC`) |
|---|---|---|
| `ic_trans` | `COALESCE(last_status, 0) = 0` | `total_value`, `total_before_vat`, `total_vat_value`, `total_except_vat`, `total_amount` |
| `ic_trans_detail` | `COALESCE(last_status, 0) = 0` | `qty`, `price`, `sum_amount`, `sum_amount_exclude_vat`, `sum_of_cost` |
| `ap_ar_trans` | `COALESCE(last_status, 0) = 0` | `total_net_amount`, `total_pay_money`, `lost_profit_exchange_amount` |
| `ap_ar_trans_detail` | `COALESCE(last_status, 0) = 0` + ระบุ `trans_flag` (`19,239` vs `213,235`) | `sum_debt_amount`, `sum_pay_money`, `lost_profit_exchange_amount` |
| `cb_chq_list` | เช็คในมือ/ค้างตัด: `COALESCE(status, 0) NOT IN (2, 7, 8)` | `amount` (`chq_type`: `1`=เช็ครับ, `2`=เช็คจ่าย, `3`=บัตร, `21`=Wallet) |
| `gl_journal_detail` | `COALESCE(is_pass, 0) IN (0, 1)` (+ `journal_type <> 2` สำหรับงบกำไรขาดทุน) | `debit`, `credit` |
| `gl_journal_vat_buy` | ตรวจเอกสารแม่ไม่ยกเลิก (`last_status = 0`) | ฐานภาษี: `base_amount`, ภาษี: `vat_amount`, ยกเว้น: `except_vat` |
| `gl_journal_vat_sale` | ตรวจเอกสารแม่ไม่ยกเลิก (`last_status = 0`) | ฐานภาษี: `except_amount_1` / `base_caltax`, ภาษี: `amount` |

---

## 3. สารบัญคลังคำสั่ง SQL หมวดการเงิน บัญชี ซื้อ-ขาย และภาษี

### 3.1 หมวดขายและรายได้ (Sales & Order-to-Cash)
- [[sql-sale-revenue-summary]] — สรุปยอดขายสุทธิรายวัน/รายเดือน (`44 + 46 - 48`), แยกขายสด-ขายเชื่อ-POS และแยกภาษี
- [[sql-sale-by-customer-item-saleman]] — ยอดขายแยกตามสินค้า (SKU), ลูกค้า, พนักงานขาย, กำไรขั้นต้นหลังหักรับคืน และตรวจขายต่ำกว่าทุน
- [[sql-sale-quotation-so-backlog]] — ติดตามใบเสนอราคา (`30`) และใบสั่งขาย (`36`) ค้างส่งระดับหน่วยฐาน
- [[sql-sale-document-lookup]] — ค้นหาเอกสารแบบ 360 องศา (หัวบิล + รายการบรรทัด + ช่องทางชำระเงิน + บัญชี GL + สายโซ่อ้างอิง)

### 3.2 หมวดลูกหนี้การค้าและเงินมัดจำรับ (Accounts Receivable)
- [[sql-ar-outstanding-invoices]] — บิลลูกหนี้คงค้างรายตัวและรายลูกหนี้ (รวมขายสินทรัพย์ `1802` และหักใบลดหนี้ตามสูตรจริง)
- [[sql-ar-aging-analysis]] — วิเคราะห์อายุหนี้ลูกหนี้ (AR Aging Buckets) ณ วันสิ้นงวด และสรุปยอดเกินกำหนดชำระ
- [[sql-ar-billing-and-receipts]] — รายงานใบวางบิลลูกหนี้ (`235`), ใบเสร็จรับเงินประจำวัน (`239`) แยกช่องทางรับเงิน และการ์ดเคลื่อนไหวลูกหนี้
- [[sql-ar-deposit-advance-balance]] — ยอดคงเหลือเงินรับล่วงหน้า (`40/9040`) และเงินมัดจำรับ (`110/9110`) พร้อมประวัติการตัดใช้

### 3.3 หมวดจัดซื้อและเจ้าหนี้การค้า (Purchase & Accounts Payable)
- [[sql-buy-purchase-summary]] — สรุปยอดซื้อสุทธิ (`12, 315 + 14, 316 - 16, 317`) แยกตามผู้ขาย กลุ่มสินค้า และประเภทภาษี
- [[sql-buy-pr-po-grn-backlog]] — ติดตามใบขอซื้อ (`2`), ใบสั่งซื้อค้างรับ (`6`) และใบรับของทะยอยรับ (`310`) รอตั้งหนี้ (`2113-00`)
- [[sql-ap-outstanding-bills]] — บิลเจ้าหนี้คงค้างรายเอกสารและตารางนัดจ่ายชำระตามวันครบกำหนด
- [[sql-ap-aging-analysis]] — วิเคราะห์อายุหนี้เจ้าหนี้ (AP Aging Buckets) ณ วันสิ้นงวด และการ์ดเคลื่อนไหวเจ้าหนี้
- [[sql-ap-billing-and-payments]] — ใบรับวางบิลเจ้าหนี้ (`213`), ใบจ่ายชำระหนี้ (`19`) แยกช่องทางจ่าย และยอดคงเหลือมัดจำจ่าย (`10/11`)

### 3.4 หมวดเงินสด ธนาคาร เช็ค และการกระทบยอด (Cash, Bank & Treasury)
- [[sql-cb-cash-bank-balance]] — ความเคลื่อนไหวเงินสดในมือ, วงเงินสดย่อย (`cb_petty_cash`), สมุดเงินฝากธนาคาร (`cbmPassbookCTE`) และพยากรณ์กระแสเงินสด 30/60/90 วัน
- [[sql-cb-cheque-card-register]] — ทะเบียนเช็ครับ เช็คจ่าย บัตรเครดิต และ Wallet ค้างตัด พร้อมประวัติการเปลี่ยนสถานะเช็ค
- [[sql-cb-bank-reconcile]] — รายการเดินบัญชีธนาคารเทียบสมุดบัญชี (Bank Reconciliation) และรายการค้างกระทบยอด

### 3.5 หมวดบัญชีแยกประเภทและงบการเงิน (General Ledger & Financial Statements)
- [[sql-gl-journal-ledger]] — สมุดรายวันแยกตามเล่ม (`01`–`05`), บัญชีแยกประเภท (GL Running Balance) และคำสั่งตรวจหาใบสำคัญไม่สมดุล
- [[sql-gl-trial-balance]] — งบทดลอง (Trial Balance) ยอดยกมา-ประจำงวด-คงเหลือ, งบทดลองแยกสาขา และผังบัญชีแบบลำดับชั้น
- [[sql-gl-profit-and-loss]] — งบกำไรขาดทุน (Income Statement) รวมทั้งบริษัท แยกสาขา และปันส่วนตามแผนก (`gl_journal_depart_list`)
- [[sql-gl-balance-sheet]] — งบแสดงฐานะการเงิน (Balance Sheet) รวมกำไรสะสมระหว่างงวดที่ยังไม่ปิดบัญชี และบิลสกุลเงินต่างประเทศรอปรับมูลค่า FX

### 3.6 หมวดภาษีอากรและสินทรัพย์ถาวร (Taxation & Fixed Assets)
- [[sql-tax-vat-buy-sale-pp30]] — รายงานภาษีขาย-ภาษีซื้อ (ภ.พ.30), การแสดงบิลยกเลิกยอดศูนย์ และตรวจภาษีบริการยังไม่ถึงกำหนด (ม.78/1)
- [[sql-tax-wht-pnd-register]] — ทะเบียนภาษีหัก ณ ที่จ่าย ภ.ง.ด.3 / ภ.ง.ด.53 และทะเบียนติดตามใบรับรอง 50 ทวิ จากลูกค้า
- [[sql-tax-health-and-pnd50]] — คำสั่งตรวจสุขภาพภาษี (ใบกำกับซ้ำ, ภาษีซื้อเกิน 6 เดือน, กระทบยอด GL vs ภาษี, ภ.พ.36/ภ.ง.ด.54 และประมาณการ ภ.ง.ด.50/51)
- [[sql-fa-register-and-depreciation]] — ทะเบียนสินทรัพย์ถาวร (`as_asset`), ประวัติค่าเสื่อมราคา (`1801`) และกระทบยอดมูลค่าสุทธิทางบัญชี (NBV)
- [[sql-fa-disposal-and-leasing]] — รายงานกำไร/ขาดทุนจากการขายสินทรัพย์ (`1802`) และสัญญาเช่าซื้อ/ลีสซิ่ง (`fa_hire_purchase_contract`)

*(สำหรับคำสั่ง SQL หมวดสต็อก POS หน้าร้าน AutoCare คลัง WMS ขนส่ง TMS และระบบเสริมอื่นๆ สามารถค้นหาได้ในโฟลเดอร์ `queries/` เดียวกันนี้ หรือผ่าน `search_brain` โดยระบุ `audience: "dev"`)*
- [[has_query::sql-marketplace-payroll-subledger-audit]] — คิวรีกระทบยอด Marketplace Settlement, เงินเดือน ม.33, ตรวจประวัติพิมพ์ซ้ำ, กฎวางบิลอัตโนมัติ และสมุดเงินฝาก
