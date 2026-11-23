---
title: ตารางเบิกค่าใช้จ่าย ตรวจสลิป และกล่องรับสลิป LINE (cb_expense_claim, cb_expense_claim_detail, cb_slip_verification_log, cb_line_expense_inbox)
tags:
  - schema
  - cb
  - expense
  - slip-verify
  - line
aliases:
  - cb_expense_claim
  - cb_expense_claim_detail
  - cb_slip_verification_log
  - cb_line_expense_inbox
sources:
  - backend/internal/application/process/expense_claim_guard.go:77
  - backend/internal/application/process/expense_claim_guard.go:96
  - backend/internal/application/process/expense_claim_guard.go:499-624
  - backend/internal/application/process/slip_verify.go:69
  - backend/internal/application/process/slip_verify.go:328-400
  - backend/internal/application/process/sme_thai_pack.go:527
  - backend/internal/application/process/sme_thai_pack.go:614-1045
---

# ตารางเบิกค่าใช้จ่าย ตรวจสลิป และกล่องรับสลิป LINE

กลุ่มตารางสมัยใหม่ของระบบบัญชี SME ไทยในโมดูล Cash & Bank สำหรับบริหารใบเบิกค่าใช้จ่ายภายใต้เกณฑ์ประมวลรัษฎากร (มาตรา 65 ตรี รายจ่ายต้องห้าม และมาตรา 82/5 ภาษีซื้อต้องห้าม), ตรวจจับสลิปซ้ำ/สลิปปลอมผ่าน QR PromptPay และ SHA-256 (`cb_slip_verification_log`), รวมถึงกล่องรับสลิปที่พนักงานส่งเข้ามาทาง LINE OA (`cb_line_expense_inbox`)

---

## 1. `cb_expense_claim` และ `cb_expense_claim_detail` — ใบเบิกค่าใช้จ่ายและตัวกรองรายจ่ายต้องห้าม

- **วัตถุประสงค์**: บันทึกใบเบิกค่าใช้จ่ายของพนักงาน/ผู้ทดรองจ่าย พร้อมผลจำแนกยอดหักภาษีได้ (`deductible_amount`), ภาษีซื้อขอคืนได้ (`claimable_vat_amount`), ยอดบวกกลับตามมาตรา 65 ตรี (`forbidden_add_back_amount`) และธงบังคับออกใบสำคัญรับเงินแทน (`needs_substitute_voucher`)
- **Primary Key**:
  - `cb_expense_claim`: `claim_doc_no` (`VARCHAR(50)`)
  - `cb_expense_claim_detail`: `(claim_doc_no, line_no)`

### คอลัมน์สำคัญ — `cb_expense_claim` (Header)

| คอลัมน์ | ชนิดข้อมูล (SQL) | ค่าเริ่มต้น | ความหมายและค่า Flag |
| :--- | :--- | :--- | :--- |
| `claim_doc_no` | `VARCHAR(50) PRIMARY KEY` | - | เลขที่ใบเบิกค่าใช้จ่าย |
| `doc_date` | `DATE NOT NULL` | - | วันที่เบิกจ่าย |
| `claimant_name` | `VARCHAR(150) NOT NULL` | `''` | ชื่อผู้เบิกจ่าย |
| `claimant_id_card` | `VARCHAR(30) NOT NULL` | `''` | เลขบัตรประชาชนผู้รับเงิน/ผู้เบิก (สำหรับใบสำคัญรับเงินแทน) |
| `claimant_position` | `VARCHAR(100) NOT NULL` | `''` | ตำแหน่งผู้เบิก |
| `credit_account_code` | `VARCHAR(25) NOT NULL` | `''` | รหัสผังบัญชีฝั่งเครดิต (เช่น เงินสด/เงินสดย่อย/เจ้าหนี้พนักงาน) เชื่อม [[tbl-gl-chart-of-account]] |
| `line_count` | `INT NOT NULL` | `0` | จำนวนรายการค่าใช้จ่าย |
| `total_amount` | `NUMERIC(18,2) NOT NULL` | `0` | ยอดเบิกรวมทั้งใบ |
| `deductible_amount` | `NUMERIC(18,2) NOT NULL` | `0` | ยอดที่ถือเป็นรายจ่ายทางภาษีได้ |
| `claimable_vat_amount` | `NUMERIC(18,2) NOT NULL` | `0` | ยอดภาษีซื้อที่ขอคืน/เครดิตภาษีขายได้ |
| `forbidden_add_back_amount` | `NUMERIC(18,2) NOT NULL` | `0` | ยอดรายจ่ายต้องห้ามที่ต้องบวกกลับตอนคำนวณ ภ.ง.ด.50 |
| `needs_substitute_voucher` | `BOOLEAN NOT NULL` | `FALSE` | `TRUE` = มีรายการที่ต้องแนบใบสำคัญรับเงิน/ใบรับรองแทนใบเสร็จ |
| `status` | `VARCHAR(20) NOT NULL` | `'DRAFT'` | สถานะใบเบิก: `'DRAFT'` (ฉบับร่าง), `'POSTED'` (ผ่านรายการลง GL แล้ว) |
| `gl_doc_no` | `VARCHAR(50) NOT NULL` | `''` | เลขที่เอกสารบัญชีที่ลงสมุดรายวันแล้ว (เชื่อม [[tbl-gl-journal]]) |
| `remark` | `TEXT NOT NULL` | `''` | หมายเหตุ |
| `created_by` | `VARCHAR(50) NOT NULL` | `''` | รหัสผู้สร้างรายการ |
| `created_at` | `TIMESTAMPTZ NOT NULL` | `NOW()` | วันเวลาที่บันทึก |

### คอลัมน์สำคัญ — `cb_expense_claim_detail` (Lines)

| คอลัมน์ | ชนิดข้อมูล (SQL) | ค่าเริ่มต้น | ความหมาย |
| :--- | :--- | :--- | :--- |
| `claim_doc_no`, `line_no` | `VARCHAR(50)`, `INT` | PK | เลขที่ใบเบิก และลำดับบรรทัด |
| `description` | `VARCHAR(255) NOT NULL` | `''` | รายละเอียดค่าใช้จ่าย |
| `expense_category` | `VARCHAR(30) NOT NULL` | `'GENERAL'` | หมวดค่าใช้จ่าย (เช่น `'GENERAL'`, ค่ารับรอง, ค่าเดินทาง ฯลฯ) |
| `evidence_type` | `VARCHAR(30) NOT NULL` | `'CASH_RECEIPT'` | ประเภทหลักฐานประกอบ (ใบกำกับภาษีเต็มรูป, บิลเงินสด, ไม่มีบิล ฯลฯ) |
| `payee_name`, `payee_tax_id` | `VARCHAR(150)`, `VARCHAR(30)` | `''` | ชื่อและเลขผู้เสียภาษีผู้รับเงิน |
| `expense_account_code` | `VARCHAR(25) NOT NULL` | `''` | รหัสผังบัญชีค่าใช้จ่าย |
| `amount`, `vat_amount`, `gross_amount` | `NUMERIC(18,2) NOT NULL` | `0` | มูลค่าก่อน VAT, ภาษีมูลค่าเพิ่ม, ยอดรวมสุทธิ |
| `tax_rule_code`, `tax_rule_badge` | `VARCHAR(40)`, `VARCHAR(120)` | `''` | รหัสกฎและป้ายเตือนทางภาษี |
| `deductible_amount`, `claimable_vat_amount`, `add_back_amount` | `NUMERIC(18,2) NOT NULL` | `0` | ยอดหักภาษีได้, VAT ขอคืนได้, ยอดบวกกลับระดับบรรทัด |
| `requires_substitute_voucher` | `BOOLEAN NOT NULL` | `FALSE` | บังคับทำใบรับรองแทนใบเสร็จหรือไม่ |
| `legal_note` | `TEXT NOT NULL` | `''` | คำอธิบายข้อกฎหมายประกอบรายการ |

---

## 2. `cb_slip_verification_log` — ประวัติตรวจสอบสลิปโอนเงิน

- **วัตถุประสงค์**: เก็บผลการถอด QR (EMVCo Mini-QR / CRC16), แฮชรูปภาพ (`image_sha256`), เทียบบัญชีปลายทางกับ `erp_pass_book`, ตรวจจับสลิปซ้ำ (`trans_ref` หรือ `image_sha256` ซ้ำ) และให้คะแนนความเสี่ยง (`risk_score`)
- **Primary Key**: `id` (`BIGSERIAL`)
- **Unique Key**: `verify_doc_no` (`VARCHAR(50)`)
- **Indexes**:
  - `idx_cb_slip_verify_ref` ON `cb_slip_verification_log` (`sending_bank_code`, `trans_ref`)
  - `idx_cb_slip_verify_sha` ON `cb_slip_verification_log` (`image_sha256`)

### คอลัมน์สำคัญ

| คอลัมน์ | ชนิดข้อมูล (SQL) | ค่าเริ่มต้น | ความหมายและค่า Flag |
| :--- | :--- | :--- | :--- |
| `verify_doc_no` | `VARCHAR(50) NOT NULL UNIQUE` | - | เลขที่รายการตรวจสลิป |
| `source_type` | `VARCHAR(30) NOT NULL` | `'MANUAL'` | ช่องทางนำเข้าสลิป (เช่น `'MANUAL'`, LINE) |
| `ref_doc_no` | `VARCHAR(50) NOT NULL` | `''` | เลขที่เอกสารขาย/ใบเบิกที่อ้างอิง |
| `sending_bank_code` | `VARCHAR(10) NOT NULL` | `''` | รหัสธนาคารต้นทางในสลิป |
| `trans_ref` | `VARCHAR(120) NOT NULL` | `''` | เลขอ้างอิงธุรกรรมในสลิป (ใช้ตรวจจับสลิปซ้ำ) |
| `image_sha256` | `VARCHAR(64) NOT NULL` | `''` | ค่า Hash SHA-256 ของไฟล์ภาพสลิป |
| `trans_date` | `DATE` | `NULL` | วันที่โอนเงินบนสลิป |
| `expected_amount` | `NUMERIC(18,2) NOT NULL` | `0` | ยอดเงินที่คาดหวังจากเอกสาร |
| `slip_amount` | `NUMERIC(18,2) NOT NULL` | `0` | ยอดเงินที่อ่านได้จากสลิป |
| `amount_diff` | `NUMERIC(18,2) NOT NULL` | `0` | ผลต่างยอดเงิน (`slip_amount - expected_amount`) |
| `receiver_account` | `VARCHAR(80) NOT NULL` | `''` | เลขบัญชี/พร้อมเพย์ผู้รับเงินบนสลิป |
| `receiver_matched` | `BOOLEAN NOT NULL` | `FALSE` | `TRUE` = ตรงกับ `erp_pass_book` ของกิจการ |
| `qr_valid` | `BOOLEAN NOT NULL` | `FALSE` | `TRUE` = โครงสร้าง EMVCo Mini-QR และ CRC ถูกต้อง |
| `is_duplicate` | `BOOLEAN NOT NULL` | `FALSE` | `TRUE` = พบ `trans_ref` หรือ `image_sha256` ซ้ำกับรายการก่อนหน้า |
| `duplicate_of_doc_no` | `VARCHAR(50) NOT NULL` | `''` | ชี้ไปยัง `verify_doc_no` ของสลิปต้นฉบับที่ซ้ำกัน |
| `risk_score` | `INT NOT NULL` | `0` | คะแนนความเสี่ยงของสลิป |
| `status` | `VARCHAR(30) NOT NULL` | `'VALID'` | ผลการตรวจ (`slip_verify.go:69`):<br>• `'VALID'` = ผ่านการตรวจสอบ<br>• `'DUPLICATE'` = สลิปซ้ำ<br>• `'AMOUNT_MISMATCH'` = ยอดไม่ตรง<br>• `'SUSPICIOUS'` = น่าสงสัย (QR/ผู้รับไม่ตรง) |
| `status_reason` | `TEXT NOT NULL` | `''` | เหตุผลสรุปของผลการตรวจ |
| `verified_by`, `verified_at` | `VARCHAR(50)`, `TIMESTAMPTZ` | `NOW()` | ผู้ตรวจและเวลาที่ตรวจ |

---

## 3. `cb_line_expense_inbox` — กล่องรับสลิปและเอกสารค่าใช้จ่ายจาก LINE

- **วัตถุประสงค์**: รองรับ Webhook จาก LINE Official Account (ตรวจสอบ HMAC-SHA256) เก็บสลิป/ข้อความค่าใช้จ่ายไว้ในสถานะรอตรวจสอบ (`PENDING`) ก่อนแปลงเป็นใบเบิกค่าใช้จ่าย (`cb_expense_claim`) หรือเอกสารจ่ายเงิน (`CONVERTED`)
- **Primary Key**: `id` (`BIGSERIAL`)
- **Unique Key**: `inbox_doc_no` (`VARCHAR(40)`)

### คอลัมน์สำคัญ

| คอลัมน์ | ชนิดข้อมูล (SQL) | ค่าเริ่มต้น | ความหมายและค่า Flag |
| :--- | :--- | :--- | :--- |
| `inbox_doc_no` | `VARCHAR(40) NOT NULL UNIQUE` | - | เลขที่รายการในกล่องรับ LINE |
| `line_user_id` | `VARCHAR(100) NOT NULL` | `''` | รหัสผู้ใช้ LINE OA (ไม่ใช่ข้อมูลบัญชีเข้าสู่ระบบ ERP) |
| `sender_display_name` | `VARCHAR(200) NOT NULL` | `''` | ชื่อที่แสดงของผู้ส่งใน LINE |
| `message_id` | `VARCHAR(100) NOT NULL` | `''` | รหัสข้อความจาก LINE Webhook |
| `message_type` | `VARCHAR(30) NOT NULL` | `'IMAGE_SLIP'` | ชนิดข้อความที่ส่งเข้า inbox |
| `expense_category` | `VARCHAR(80) NOT NULL` | `'GENERAL'` | หมวดค่าใช้จ่าย |
| `vendor_name`, `vendor_tax_id` | `VARCHAR(250)`, `VARCHAR(20)` | `''` | ชื่อและเลขผู้เสียภาษีร้านค้า |
| `slip_amount`, `vat_amount` | `NUMERIC(18,2) NOT NULL` | `0` | ยอดเงินตามสลิป และยอด VAT |
| `trans_ref`, `sending_bank_code` | `VARCHAR(120)`, `VARCHAR(20)` | `''` | เลขอ้างอิงสลิป และธนาคารผู้โอน |
| `qr_payload` | `TEXT NOT NULL` | `''` | ข้อมูล QR ที่ถอดได้จากภาพ |
| `qr_decoded_from_image` | `BOOLEAN NOT NULL` | `FALSE` | `TRUE` = ถอด QR สำเร็จจากภาพ |
| `slip_image_sha256` | `VARCHAR(64) NOT NULL` | `''` | แฮช SHA-256 ของภาพสลิป |
| `slip_image_base64` | `TEXT NOT NULL` | `''` | เนื้อไฟล์ภาพแบบ Base64 *(หมายเหตุ: คอลัมน์ขนาดใหญ่ ควรหลีกเลี่ยงใน query รายการสรุป)* |
| `signature_verified` | `BOOLEAN NOT NULL` | `FALSE` | `TRUE` = ผ่านการตรวจสอบลายเซ็น Webhook `X-Line-Signature` |
| `status` | `VARCHAR(30) NOT NULL` | `'PENDING'` | สถานะรายการ: `'PENDING'` (รอดำเนินการ), `'CONVERTED'` (แปลงเป็นเอกสารบัญชีแล้ว) |
| `converted_target` | `VARCHAR(40) NOT NULL` | `''` | เป้าหมายเอกสารที่แปลงไป: `'EXPENSE_CLAIM'` หรือ `'SLIP_LOG'` |
| `converted_doc_no` | `VARCHAR(50) NOT NULL` | `''` | เลขที่เอกสารปลายทาง (`claim_doc_no` ใน `cb_expense_claim` หรือ `verify_doc_no` ใน `cb_slip_verification_log`) |

### กติกา Transaction และความสอดคล้องของสถานะ (Atomic Convert & Delete Rollback)

- **ฟิลด์อนุพันธ์ใน API Response (`sme_thai_pack.go:614-830`)**: คำสั่ง `list` และ `submit` ของ `LineExpenseInbox` ส่งฟิลด์ `hasSlipImage` (`slip_image_sha256 <> ''`) และ `canVerifySlip` (`lineExpenseInboxCanVerifySlip` = มี `trans_ref` หรือ `slip_image_sha256` หรือ `qr_payload` ที่ถอด `ParseThaiSlipMiniQR` ได้) เพื่อให้ UI เปิด/ปิดปุ่มส่งตรวจสลิปอย่างถูกต้อง
- **การแปลงรายการแบบ Atomic (`convertLineExpenseInboxTx`)**: รันภายใต้ DB Transaction เดียวพร้อมล็อกแถว `cb_line_expense_inbox` ด้วย `FOR UPDATE` (หาก `status = 'CONVERTED'` และมี `converted_doc_no` แล้วจะคืน `alreadyConverted: true` แบบ idempotent) แล้วเรียก `verifyAndRecordSlipInTx` (`SLIP_LOG`) หรือ `saveExpenseClaimInTx` (`EXPENSE_CLAIM` ด้วยเลขใบเบิกใช้ `id` เต็มไม่ตัด `%10000`) ก่อนอัปเดต `status = 'CONVERTED'` ใน Transaction เดียวกัน
- **ห้ามลบ Inbox ที่แปลงเอกสารแล้ว (`deleteLineExpenseInboxTx`)**: ล็อกแถว `FOR UPDATE` และปฏิเสธด้วย Conflict error หาก `status = 'CONVERTED'` หรือ `converted_doc_no <> ''` (ต้องลบเอกสารปลายทางก่อน)
- **ลบเอกสารปลายทางแล้วคืนสถานะ Inbox อัตโนมัติ**:
  - `deleteExpenseClaimTx` (`expense_claim_guard.go:598-624`) เมื่อลบ `cb_expense_claim` + `cb_expense_claim_detail` จะอัปเดต `cb_line_expense_inbox` ที่ `converted_target = 'EXPENSE_CLAIM' AND converted_doc_no = $1` กลับเป็น `status = 'PENDING'` และล้าง `converted_target`/`converted_doc_no`
  - `deleteSlipVerificationTx` (`slip_verify.go:328-360`) เมื่อลบ `cb_slip_verification_log` (`RETURNING verify_doc_no`) จะอัปเดต `cb_line_expense_inbox` ที่ `converted_target = 'SLIP_LOG' AND converted_doc_no = $1` กลับเป็น `status = 'PENDING'` ใน Transaction เดียวกัน

---

## 4. รูปแบบการ JOIN และตัวอย่าง SQL Query

1. **ใบเบิกค่าใช้จ่ายกับรายละเอียดและ GL**: `cb_expense_claim h JOIN cb_expense_claim_detail d ON d.claim_doc_no = h.claim_doc_no`, และเชื่อมไป `gl_journal` ด้วย `h.gl_doc_no` ([[tbl-gl-journal]])
2. **ตรวจสลิปซ้ำข้าม LINE Inbox และ Slip Verify**: เทียบ `trans_ref` หรือ `image_sha256` ระหว่าง `cb_line_expense_inbox` และ `cb_slip_verification_log`

### ตัวอย่าง 1: สรุปใบเบิกค่าใช้จ่ายที่มีรายจ่ายต้องห้าม (มาตรา 65 ตรี)
```sql
SELECT
    h.claim_doc_no,
    h.doc_date,
    h.claimant_name,
    h.status,
    h.total_amount::NUMERIC(18,2) AS total_amount,
    h.deductible_amount::NUMERIC(18,2) AS deductible_amount,
    h.forbidden_add_back_amount::NUMERIC(18,2) AS forbidden_add_back_amount,
    h.claimable_vat_amount::NUMERIC(18,2) AS claimable_vat_amount,
    h.gl_doc_no
FROM cb_expense_claim h
WHERE h.doc_date BETWEEN DATE '2026-01-01' AND DATE '2026-12-31'
  AND h.forbidden_add_back_amount > 0
ORDER BY h.doc_date DESC, h.claim_doc_no DESC;
```

### ตัวอย่าง 2: ค้นหาสลิปที่น่าสงสัยหรือซ้ำ และรายการค้างแปลงจาก LINE Inbox
```sql
SELECT
    v.verify_doc_no,
    v.ref_doc_no,
    v.sending_bank_code,
    v.trans_ref,
    v.slip_amount::NUMERIC(18,2) AS slip_amount,
    v.expected_amount::NUMERIC(18,2) AS expected_amount,
    v.status,
    v.duplicate_of_doc_no,
    v.risk_score,
    v.status_reason
FROM cb_slip_verification_log v
WHERE v.status <> 'VALID'
ORDER BY v.verified_at DESC
LIMIT 50;
```
