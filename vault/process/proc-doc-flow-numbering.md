---
title: "สถานะต่อเนื่องของเอกสาร กราฟโยงเอกสาร และเลขที่เอกสารถัดไป (Doc flow & numbering)"
tags: [process, document, doc-flow, numbering, erp_doc_format, advisory-lock]
aliases: ["docFlowTx", "flowRules", "used_status", "doc_success", "approve_status", "doc/flow", "DocFlow graph", "NextDocNo", "nextDocNo", "erp_doc_format", "autoRunPattern", "เลขที่เอกสารถัดไป"]
sources: ["backend/internal/application/process/doc_flow.go:9", "backend/internal/application/process/doc_flow.go:91", "backend/internal/application/process/doc_flow.go:146", "backend/internal/application/process/doc_flow.go:239", "backend/internal/application/process/doc_flow.go:470", "backend/internal/application/process/doc_flow_graph.go:16", "backend/internal/application/process/doc_flow_graph.go:269", "backend/internal/application/process/doc_flow_graph.go:809", "backend/internal/application/process/doc_cancel.go:391", "backend/internal/application/process/doc_no_next.go:59", "backend/internal/application/process/stock_tools.go:701"]
---

# สถานะต่อเนื่องของเอกสาร กราฟโยงเอกสาร และเลขที่เอกสารถัดไป (Doc flow & numbering)

เอกสารใน ERP โยงกันเป็นสาย (ใบขอซื้อ -> ใบสั่งซื้อ -> รับสินค้า -> ชำระ ฯลฯ) หลังบันทึก/ลบ/ยกเลิก/อนุมัติเอกสาร ระบบคำนวณสถานะ `last_status`, `used_status`, `used_status_2`, `doc_success`, `approve_status` ของเอกสารนั้นและเอกสารที่มันอ้างถึง **จากแถวดิบที่อ้างถึงมันเท่านั้น** ทำซ้ำกี่ครั้งผลเหมือนเดิม นอกจากนี้ยังมี route สร้างกราฟโยงเอกสาร (`/doc/flow`) และ route ขอเลขที่เอกสารถัดไป

## ทำงานอย่างไร

### 1. เครื่องคำนวณสถานะ (`doc_flow.go`)
- พอร์ตจาก C# `_docFlowThread._docFlowProcess` (คอมเมนต์หัวไฟล์ อ้าง cs:1970-3230)
- `docFlowTx(tx, docNos)`: คิวเอกสาร -> หา `trans_flag` ทุกตัวของเอกสาร (`docTransFlags`) -> `deriveDocFlow` ทีละ flag -> หาเอกสารต้นทางที่เอกสารนี้ชี้ไป (`docFlowSources`) ต่อคิว (ใช้ `seen` กันวน ไม่มีเพดานจำนวน) คืนจำนวนแถวที่สถานะเปลี่ยน
- `deriveDocFlow`: ถ้า flag เป็น "เอกสารต้นฉบับที่มีเอกสารยกเลิก" (`cancelFlagOf`) คำนวณ `last_status` ก่อน (`deriveLastStatus`) แล้วใช้กฎของ flag (`flowRules[flag]`) ผ่าน `applyFlowRule`
- `last_status` ของต้นฉบับ = 1 เมื่อ `is_cancel = 1` หรือมีเอกสาร flag ยกเลิกที่ `doc_ref` ชี้มา (กรอง `cancel_type` ตาม `cancelTypeFilter` ที่ `doc_flow.go:234`: ยกเลิกรายสินค้าไม่นับเป็นยกเลิกทั้งใบ) แล้วเขียนค่าเดียวกันลงบรรทัด/ซีเรียล/ap_ar/cb ที่เกี่ยวข้อง (`ic_trans_detail`, `ic_trans_serial_number`, `ap_ar_trans_detail`, `cb_trans`, `cb_trans_detail`)
- `flowRules` (map ต่อ flag) นิยาม SQL ของ `used`, `used2`, จำนวนบรรทัด/จำนวนรวม/จำนวนที่ถูกลด และโหมด `doc_success` (`successNew`, `successExact`, `successItems`, `successPR`); ตัวอย่างที่อ่านได้จากโค้ด: flag 2 ใบขอซื้อ (อนุมัติ flag 4), 6 ใบสั่งซื้อ (อนุมัติ 8), 30 ใบเสนอราคา, 34 ใบจอง (อนุมัติ 38), 36 ใบสั่งขาย (อนุมัติ 52), 10/11/40/110 มัดจำ/เงินล่วงหน้า (`depositRule`), 12/315/87/99/250/260 กลุ่มที่ถูกวางบิล (`billedRule`)
- `approve_status` (`approveSQL`): เอกสารอนุมัติอัตโนมัติ (`auto_approved = 1`) = 1; มีเอกสารอนุมัติและ `not_approve_1 = 0` = 1; `not_approve_1 = 1` = 2; ไม่มีเอกสารอนุมัติ ใช้ผลจาก `erp_credit_approved_logs` หรือค่า ELSE (ใบจอง/ใบสั่งขาย = 1)
- การตัดสิน `doc_success` ใช้ `*big.Rat` (`flowDocSuccess`, `itemsDocSuccess`, `poUsedUp`) ไม่ใช้ float
- `recheckAllDocFlow`: ตรวจทั้งบริษัท (คำนวณ `last_status` ของต้นฉบับทุกใบก่อน เพราะกฎอ่านสถานะของเอกสารอื่น แล้วค่อยใช้กฎของทุก flag); เรียกจากงานสร้างสต็อกใหม่ (`service.go:786`)
- ข้อจำกัดที่โค้ดระบุ (`ponytail`): flag ใบเบิก/ขอโอน IC (122/56/124) และ ap_ar_trans 213/235 ยังไม่พอร์ต

### 2. กราฟโยงเอกสาร (`POST /process/doc/flow`)
- Input `DocFlowInput`: `docNo`, `transFlag`, `kind`; ว่าง `docNo` -> "กรุณาระบุเลขที่เอกสาร"; สิทธิ์ `read`
- ค้นหาทั้งขึ้นและลงจากเอกสารตั้งต้นสูงสุด 6 hop และไม่เกิน 80 เอกสาร (`maxDocs`) ผ่านความสัมพันธ์ `doc_ref`, `ref_doc_no`, `billing_no`, `cb_trans_detail.trans_number` (doc_type 5/6) และเช็ค (`cb_chq_list`)
- Output `DocFlowResult`: `nodes` (`DocFlowNode`: `docNo`, `docDate`, `transFlag`, `kind` = `ic_trans`/`ap_ar_trans`/`payment`/`gl_journal`, `stage`, `typeLabel`, `menuKey`, `partyCode/Name`, `amount`, `paidAmount`, `remainAmount`, `status`, `statusLabel`, `isCurrent`, `payBreakdown`, `glLines`) และ `edges` (`DocFlowEdge`: `fromId`, `toId`, `relation`, `amount`, `lineCount`, `items`)
- สถานะ node (`deriveNodeStatus`): `cancelled` (ยกเลิกแล้ว/เอกสารยกเลิก), `approved`, `completed`, `partial`, `active`; ใบซื้อ/ขายเชื่อ (flag 12/44/315 ตามคอมเมนต์ "Credit Purchase / Sale Invoices") เทียบยอดชำระกับยอดรวมด้วย `big.Rat`
- ช่องทางชำระใน `payBreakdown`: เงินสด, โอน, พร้อมเพย์, เช็ค, บัตร, มัดจำ, รายจ่าย/รายได้อื่น (`DocFlowPaySummary`)

### 3. เลขที่เอกสาร (`nextDocNo`)
- ใช้ร่วมกันระหว่างหน้ายกเลิก/อนุมัติ ([[proc-doc-cancel-approve]]) และ route `stocktools/docnonext` -> `Service.NextDocNo`
- ตารางที่รองรับ (`nextDocNoTables`): `ic_trans`, `ap_ar_trans`, `cb_trans`, `gl_journal`, `as_trans`, `ic_hidden_cost_process`; `gl_journal` ไม่กรอง `trans_flag` (นับเลขตามสมุด) ตารางอื่นกรองตาม `transFlag` ถ้าส่งมา
- ลำดับ: รหัสรูปแบบ `code` ว่างใช้ `screenCode`; ยังว่างใช้ `DOC<flag>` (หรือ `DOC`) -> อ่าน `erp_doc_format` (`format`, `code`) ที่ `upper(code)` หรือ `screen_code` ตรง; ไม่พบรูปแบบ ใช้ `@YYMM-####`
- `autoRunPattern` แทนโทเค็นวันที่: `DD`, `MM`, `YYYY`, `YY`, ไทย `วว`, `ดด`, `ปปปป` (พ.ศ. 4 หลัก), `ปป`, และ `@` = รหัสรูปแบบ; แถว `#` ชุดแรกคือหลักเลขรัน
- ป้องกันเลขซ้ำ: `pg_advisory_xact_lock(hashtext('docno:' || ตาราง || ':' || prefix))` ภายใน transaction แล้วอ่านเลขล่าสุดที่ขึ้นต้นด้วย prefix (กรองด้วย flag) `ORDER BY doc_no DESC LIMIT 1` -> `autoRunNext` (+1 เติมศูนย์; ล้นความกว้างวนกลับ 1)
- เลขที่เอกสารยาวเกิน 25 ตัวอักษรตอบ error "ยาวเกิน 25 ตัวอักษร กรุณาแก้รูปแบบ"
- `NextDocNo` ตรวจ: ตารางต้องอยู่ในรายการ, `transFlag` ต้องไม่ติดลบ, `docDate` ต้องเป็น YYYY-MM-DD

## จุดที่ต้องระวัง
- เลขที่ที่ route `docnonext` คืนเป็นเลขที่ "คาดว่าจะใช้" ไม่ได้จองไว้; ล็อกมีผลเฉพาะตอนสร้างเอกสารยกเลิก/อนุมัติใน transaction เดียวกัน
- กราฟเอกสารจำกัด 6 hop / 80 เอกสาร / 200 ความสัมพันธ์ต่อ hop เอกสารที่ไกลกว่านั้นจะไม่ปรากฏ
- ผลลัพธ์ของ `flowRules` ขึ้นกับตัวเลือกบริษัท `purchase_request_approve_until_end` (โหมด `successPR`)

## ที่มาในโค้ด
- `backend/internal/application/process/doc_flow.go:9-17` - ที่มา C# และหลักการคำนวณจากแถวดิบ
- `backend/internal/application/process/doc_flow.go:91-132` - `flowRules` และ `init()` เพิ่มกฎ flag ที่ได้แต่ `used_status_2`
- `backend/internal/application/process/doc_flow.go:146` - `docFlowTx`
- `backend/internal/application/process/doc_flow.go:180` - `deriveDocFlow`
- `backend/internal/application/process/doc_flow.go:239` - `deriveLastStatus`
- `backend/internal/application/process/doc_flow.go:284` - `approveSQL`
- `backend/internal/application/process/doc_flow.go:470` - `recheckAllDocFlow`
- `backend/internal/application/process/doc_flow_graph.go:16-103` - struct ของกราฟ
- `backend/internal/application/process/doc_flow_graph.go:269` - `DocFlow` (BFS 6 hop, `maxDocs = 80`)
- `backend/internal/application/process/doc_flow_graph.go:809` - `deriveNodeStatus`
- `backend/internal/application/process/doc_cancel.go:391` - `nextDocNo`; `:460` `docNoPrefix`; `:475` `nextDocSeq`
- `backend/internal/application/process/doc_no_next.go:12-70` - `NextDocNo` และตัวตรวจ input
- `backend/internal/application/process/stock_tools.go:701` - `autoRunPattern`; `:725` `autoRunNext`
- `backend/internal/adapter/inbound/http/process/stocktools_handler.go:164` - action `docnonext`

## ดูเพิ่ม
- [[proc-doc-cancel-approve]]
- [[proc-stock-tools]]
- [[proc-dispatcher]]
- [[accounting-overview]]
- [[process-overview]]
