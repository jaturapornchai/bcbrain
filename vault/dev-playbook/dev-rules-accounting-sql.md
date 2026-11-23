---
title: "กฎเหล็กบัญชีและ SQL สำหรับนักพัฒนา (Accounting & SQL Invariants)"
audience: dev
tags: [dev-playbook, sql-rules, accounting, precision, security]
aliases: ["กฎ SQL BC", "กฎเหล็กบัญชี", "last_status", "big.Rat", "NUMERIC", "WritePolicy", "มาตรฐาน SQL BC"]
sources: ["AGENTS.md:1-66", "backend/internal/application/process/service.go:131-240", "backend/internal/application/process/report_menu_ic.go:244-282", "backend/internal/application/process/docs.go:680-810", "backend/internal/application/process/stock_rebuild.go:19-45", "backend/internal/domain/query/query.go:1-521", "backend/internal/domain/query/write_policy.go:1-103", "frontend/src/lib/numeric.ts:1-66", "frontend/src/lib/numeric.ts:550-960"]
---

การเขียน SQL คิวรีข้อมูลหรือพัฒนาระบบต่อยอดบนฐานข้อมูล PostgreSQL ของ **BC Ai Account** มีกฎเหล็กทางบัญชีและความปลอดภัยที่ต้องปฏิบัติตามอย่างเคร่งครัด เพื่อป้องกันยอดเงินเพี้ยน สต็อกกลับด้าน หรือดึงเอกสารยกเลิกมานับซ้ำ

---

## 1. กฎความแม่นยำตัวเลขเงินและทศนิยม (`NUMERIC` + `big.Rat`)

- **ห้ามใช้ Binary Float โดยเด็ดขาด**:
  - ใน PostgreSQL ต้องใช้ `NUMERIC` / `DECIMAL` (เช่น `NUMERIC(18,2)` หรือ cast `::numeric`) ห้ามใช้ `float4`, `float8`, `real`, `double precision`
  - ใน Go Backend คำนวณผ่าน `*math/big.Rat` ด้วย `ParseDecimalRat` และปัดเศษ `RoundHalfUp` (`service.go:131-210`)
  - ใน TypeScript Frontend ใช้ helper ใน `frontend/src/lib/numeric.ts` เช่น `cleanNumericString`, `calcAfterDiscount`, `vatCalc` (คำนวณด้วย `BigInt` ความแม่นยำ 28 หลักเทียบเท่า C# `decimal` / Go `*big.Rat` และรับ `discountType`, `discountVatType`, `roundType`, `discountStepRoundOff` จาก `useRuntimeOptions`; ส่งค่าเลขฐานสิบเป็น string เท่านั้น) ห้ามใช้ `parseFloat()` หรือ `Number()` มาบวก ลบ คูณ หาร ยอดเงินและภาษี
  - เมื่อเปลี่ยนค่าทศนิยมหรือตัวเลือกคำนวณใน `erp_option` ฝั่ง Frontend เรียก `invalidateBcSettings()` เพื่อล้างแคชทั้งทศนิยมและ `bc_runtime_options_v1` พร้อมแจ้งรีโหลดข้ามคอมโพเนนต์ (`bc:runtime-options-invalidate`)
- **สเกลทศนิยมอ้างอิงจาก `erp_option`**:
  - Backend อ่านจำนวนหลักทศนิยมราคาและยอดเงินจากตาราง `erp_option` (`stockScales` ใน `service.go`) ก่อนบันทึกและปัดเศษ `HALF_UP`
- **ความต่างระหว่าง JSON API กับ DB**:
  - คอลัมน์จำนวนเงินที่อ่านผ่าน MCP หรือ Process API ส่งเป็น decimal text หรือ format scale ชัดเจน เพื่อไม่ให้ JavaScript JSON parser ทำตัวเลขหลักสิบล้านเสียความแม่นยำ
- **กฎแสดงผลศูนย์ (Blank Zero)**:
  - ช่องกรอก `NumberBox` และตารางรายงานมาตรฐาน BC แปลงค่า `0` / `0.00` เป็นช่องว่าง `""` ตอนแสดงผล (ยกเว้นฐานข้อมูลที่เก็บ `0` ตามจริง)

---

## 2. กฎกรองเอกสารยกเลิก สำเนา และเอกสาร POS

เกือบทุกตารางเอกสารหลักและรายละเอียดใช้ธงสถานะร่วมกัน ถ้าลืมกรองจะทำให้งบการเงินและยอดสต็อกซ้ำซ้อนทันที:

1. **กรองเอกสารที่ถูกยกเลิก (`last_status`)**:
   - `last_status = 0` คือ **เอกสารปกติ (Live)**
   - `last_status = 1` คือ **เอกสารที่ถูกยกเลิกแล้ว**
   - รูปแบบที่ต้องเขียนเสมอ:
     ```sql
     COALESCE(last_status, 0) = 0
     ```
   - หมายเหตุพิเศษ: ใน `cb_trans` ตารางหัวการเงินบางจุดใช้ `COALESCE(status, 0) = 0` ควบคู่กับ `cb_trans_detail.last_status = 0` (`service.go:748-749`) ส่วนใน `ic_trans_detail_lot` ให้เช็กว่าหัวเอกสาร `ic_trans` ยังไม่ถูกยกเลิก (`stock_lot.go:315-318`)
2. **กรองเอกสารสำเนา/ชั่วคราว (`is_doc_copy`)**:
   - รายงานสต็อกมาตรฐานใน `report_menu_ic.go:264` บังคับกรอง:
     ```sql
     COALESCE(d.is_doc_copy, 0) = 0
     ```
3. **กรองเอกสารบิลสรุป POS ที่ซ้ำซ้อน (`notpos`)**:
   - เมื่อมีบิล POS ระดับเครื่องที่มี `is_pos = 1` และอ้างอิง `doc_ref` กลับไปหาเอกสารหลัก รายงานสต็อกและคลังมาตรฐานจะตัดแถวซ้ำออกด้วยเงื่อนไข:
     ```sql
     NOT (COALESCE(d.doc_ref, '') <> '' AND COALESCE(d.is_pos, 0) = 1)
     ```
     (อ้างอิง `stock_rebuild.go:22` และ `report_menu_ic.go:262`)
4. **วันที่คำนวณสต็อก (`doc_date_calc` vs `doc_date`)**:
   - การจัดเรียงลำดับบัตรคุมสินค้าและคำนวณยอดคงเหลือตามเวลาจริง ให้ใช้:
     ```sql
     COALESCE(d.doc_date_calc, d.doc_date)
     ```
     เรียงต่อด้วย `COALESCE(d.doc_time, '')`, `d.doc_no`, `COALESCE(d.line_number, 0)` (`report_menu_ic.go:256-264, 567`)

---

## 3. กฎตารางใช้ร่วมหลายบทบาท (`trans_flag` + `inquiry_type`)

BC ใช้โครงสร้างตารางกลาง 1 คู่สำหรับเอกสารหลายประเภท (เช่น ซื้อ ขาย เบิก โอน ปรับปรุง ทั้งหมดอยู่ใน `ic_trans` + `ic_trans_detail`) จึงห้ามคิวรีโดยไม่ระบุ `trans_flag`!

### สรุปกฎทิศทางใน `ic_trans_detail` (จาก `report_menu_ic.go:266-275` และ `stock_rebuild.go:19-45`)

| เงื่อนไข | ความหมาย |
| :--- | :--- |
| `COALESCE(i.item_type, 0) <> 5` | ตัดรายการสินค้าประเภทสูตร/บริการที่ไม่คุมยอดคงเหลือจริง (`report_menu_ic.go:254`) |
| `bq = ROUND(COALESCE(d.qty,0) * COALESCE(NULLIF(d.stand_value,0),1) / COALESCE(NULLIF(d.divide_value,0),1), 2)` | แปลงจำนวนจากหน่วยบนบิลให้เป็น **หน่วยฐาน/หน่วยต้นทุน (Base Qty)** เสมอ (`report_menu_ic.go:258`) |
| **ขาเข้าปริมาณ (`f_in`)** | `trans_flag IN (70, 54, 60, 58, 310, 12)` หรือ `(trans_flag = 66 AND qty > 0)` หรือ `(trans_flag = 14 AND inquiry_type = 0)` หรือ `(trans_flag = 48 AND inquiry_type < 2)` |
| **ขาออกปริมาณ (`f_out`)** | `(trans_flag IN (56, 68, 72, 44) OR (trans_flag = 66 AND qty < 0) OR (trans_flag IN (46, 16) AND inquiry_type IN (0, 2)) OR (trans_flag = 311 AND inquiry_type = 0))` และต้องผ่าน `notpos` |
| **ขามูลค่าอย่างเดียว (ไม่มีปริมาณ)** | `trans_flag IN (14, 16, 311) AND inquiry_type IN (1, 3)` (เช่น เพิ่มหนี้/ลดหนี้ราคาอย่างเดียว หรือปรับต้นทุนแฝง flag `66` `qty = 0`) |
| **เครื่องหมายคำนวณ (`cf`)** | ถ้า `calc_flag <> 0` ใช้ `calc_flag`; ถ้า `trans_flag = 66` ใช้ `+1` (สำหรับ amount ปกติ); ถ้า `f_ina` ใช้ `+1`; ถ้า `f_outa` ใช้ `-1` |
| **โอนสินค้า (72 -> 70)** | บันทึก 2 ฝั่งในเอกสารเดียว: `72` = โอนออก (`-1` คลังต้นทาง), `70` = โอนเข้า (`+1` คลังปลายทาง) (`trans.go:1133-1136`) |

> [!TIP]
> ต้นทุนปกติอ่านจาก `sum_of_cost` ส่วนต้นทุนรวมต้นทุนแฝง (Hidden/Landed Cost) อ่านจาก `sum_of_cost_1` และยอดปรับต่างผลกำไร/ขาดทุนต้นทุนบวกเพิ่มจาก `COALESCE(profit_lost_cost_amount, 0)`

### สรุปกฎใน `ap_ar_trans` / `ap_ar_trans_detail` (จาก `docs.go:759-805`)

- ตาราง `ap_ar_trans_detail` เก็บทั้งรายการตัดชำระหนี้จริง และรายการมัดจำ/อ้างอิงบิล:
  - ยอดตั้งหนี้ลูกหนี้ (`arDebtWhere`): `trans_flag = 44 (inquiry_type IN (0,2))`, `46, 93, 95, 99, 101, 418`, `250/254 (inquiry_type IN (0,2))`, และขายสินทรัพย์ `1802` ใน `as_trans`
  - ยอดลดหนี้ลูกหนี้ (`arCreditWhere`): `trans_flag = 48 (inquiry_type IN (0,2,4))`, `97, 103`, `252 (inquiry_type IN (0,2))`
  - ยอดตั้งหนี้เจ้าหนี้ (`apDebtWhere`): `trans_flag = 12 (inquiry_type IN (0,2))`, `14, 316, 81, 83, 87, 89`, `315 (inquiry_type IN (0,2))`, `260/264 (inquiry_type IN (0,2))`
  - ยอดลดหนี้เจ้าหนี้ (`apCreditWhere`): `trans_flag IN (16, 317) AND inquiry_type IN (0,1)`, `85, 91`, `262 (inquiry_type IN (0,2))`
- รายละเอียดรหัสเอกสารทั้งหมดดูเพิ่มเติมได้ที่ [[doctypes-overview]]

---

## 4. กฎความปลอดภัยการอ่าน-เขียน SQL (`Query` vs `WritePolicy`)

ระบบ Backend แบ่งสิทธิ์การทำงานผ่านตัวตรวจวิเคราะห์ AST/SQL ใน `domain/query/query.go` และ `write_policy.go`:

1. **Read-Only Guard (`NewStatement`)**:
   - อนุญาตเฉพาะ Single Statement ที่ขึ้นต้นด้วย `SELECT` หรือ `WITH` เท่านั้น (`query.go`)
   - บล็อก `SELECT INTO`, `COPY`, `MERGE`, `DDL` ทุกชนิด, คำสั่งหลายชุดคั่นด้วย `;`, Unicode escape `U&"..."` และฟังก์ชันอันตรายของ PostgreSQL
   - รันภายใต้ Transaction Mode `ReadOnly` + `RepeatableRead` และกำหนด `statement_timeout`
2. **Write Protection (`WritePolicy` — `write_policy.go`)**:
   - ปฏิเสธการเขียนตรงผ่าน `/query/exec` และ `/query/execBatch` (คืนค่า `ErrMoneyTableViaExec`) เมื่อคำสั่ง `INSERT/UPDATE/DELETE` แตะตารางการเงิน สต็อก บัญชี ภาษี สินทรัพย์ หรือเช็ค (`moneyTablePattern`) และคอลัมน์สต็อกคงเหลือ (`inventoryBalanceColumns`)
   - ตารางตั้งค่าระบบเช่น `erp_option` ต้องใช้สิทธิ์ผู้ใช้ระดับ Admin (`user_level >= 9`, `ValidateUserLevel`)
   - การสร้าง/แก้/ยกเลิกเอกสารธุรกิจต้องเรียกผ่าน [[api-process-engine]] เท่านั้น เพื่อป้องกันยอดสต็อกเพี้ยนหรืองบไม่ดุล
3. **การปิดบังตัวแปร (Masking)**:
   - ระบบ Logging ของ Query Gateway (`handler.go`) ปิดบัง literal ใน SQL ด้วย `maskSQLLiterals` และบันทึกเฉพาะ hash สำหรับ audit เขียนข้อมูล

---

## 5. มาตรฐานวันที่ ปฏิทิน พ.ศ./ค.ศ. และรหัสค้นหา

- **DB Storage**: คอลัมน์วันที่ (`doc_date`, `due_date`, `tax_date`, `doc_date_calc`) เป็น `DATE` ระบบ **ค.ศ. (Gregorian `YYYY-MM-DD`)** เสมอ
- **UI & Report Output**: Backend `applyReportYearType` (`report.go:650`) และ Frontend `DateBox` แปลงแสดงผลตาม `erp_option.year_type` (`0` = ค.ศ., `1` = พ.ศ. เช่น `2569 = 2026 + 543`)
- **Parameter Inputs**: API รายงานและ MCP ยอมรับช่วงวันที่รูปแบบ ISO `YYYY-MM-DD` เสมอ
