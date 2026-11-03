---
title: "ผู้ช่วย AI แบบกฎคำนวณ 6 ตัว (AI Copilot ai-*)"
tags: [process, workflow, ai, copilot, report, bank-reconcile, audit, reorder, auto-gl, rule-based]
aliases: ["ai-report-sql", "ai-report-analyze", "ai-bank-reconcile", "ai-audit-copilot", "ai-smart-reorder", "ai-auto-gl", "AIReportSQL", "AIReportAnalyze", "AIBankReconcile", "AIAuditCopilot", "AISmartReorder", "AIAutoGL", "compileThaiPromptToSQL", "ai_copilot.go", "กระทบยอดธนาคาร", "จุดสั่งซื้อ", "แนะนำผังบัญชี"]
sources: ["backend/internal/application/process/ai_copilot.go:1", "backend/internal/application/process/ai_copilot.go:91", "backend/internal/application/process/ai_copilot.go:259", "backend/internal/application/process/ai_copilot.go:341", "backend/internal/application/process/ai_copilot.go:494", "backend/internal/application/process/ai_copilot.go:764", "backend/internal/application/process/ai_copilot.go:945", "backend/internal/application/process/ai_copilot.go:1089", "backend/internal/adapter/inbound/http/process/workflow_handler.go:124", "frontend/account/process/SystemProcessWorkbenchScreen.tsx:301", "frontend/account/process/SystemProcessWorkbenchScreen.tsx:841", "frontend/account/process/SystemProcessWorkbenchScreen.tsx:875"]
---

# ผู้ช่วย AI แบบกฎคำนวณ 6 ตัว (AI Copilot `ai-*`)

ไฟล์ `ai_copilot.go` (1,168 บรรทัด) รวม "AI Engine" 6 ตัวที่เรียกผ่าน `POST /process/workflow/ai-...` จากการอ่านโค้ดทั้งไฟล์ ไม่พบการเรียกบริการ LLM หรือ HTTP ภายนอกเลย (ค้นคำ `http`, `openai`, `anthropic`, `llm`, `gemini` ไม่พบ) ทุกตัวเป็นตรรกะตามกฎ: จับคำสำคัญ, SQL คงที่ และคำนวณด้วย `big.Rat` ส่วนฟิลด์ผู้ใช้/ฐานข้อมูลมาจาก token (`json:"-"`) ใช้ transaction แบบอ่านอย่างเดียว (`pgx.ReadOnly`) ทุกตัวที่แตะฐานข้อมูล

## ทำงานอย่างไร

### ภาพรวม 6 action (คอมเมนต์หัวไฟล์ `ai_copilot.go:1-14`)
| action | ฟังก์ชัน | แตะ DB |
|---|---|---|
| `ai-report-sql` | `AIReportSQL` :259 | ใช่ (รันเพื่อนับแถว) |
| `ai-report-analyze` | `AIReportAnalyze` :341 | ไม่ (วิเคราะห์ข้อมูลที่ client ส่งมา) |
| `ai-bank-reconcile` | `AIBankReconcile` :494 | ใช่ |
| `ai-audit-copilot` | `AIAuditCopilot` :764 | ใช่ |
| `ai-smart-reorder` | `AISmartReorder` :945 | ใช่ |
| `ai-auto-gl` | `AIAutoGL` :1089 | ใช่ (ค้นผังบัญชี) |

**สิทธิ์**: `workflow/ai-*` ต้องสิทธิ์ Admin ตามค่าตั้งต้นของ `RequiredRight` (`permission.go:132`) ดู [[proc-permission-rights]] ผู้เรียกจากหน้าจอ: `SystemProcessWorkbenchScreen.tsx` (แผง AI Copilot Suite การ์ด 4 ใบ: กระทบยอดธนาคาร, ตรวจก่อนปิดงวด, จุดสั่งซื้อ, แนะนำผังบัญชี ดูหัวข้อ "ฝั่งหน้าจอ" ด้านล่าง) และ `GlobalReportPrintModal.tsx` (`ai-report-sql`)

### 1. `ai-report-sql` -- ข้อความไทย -> SELECT (`AIReportSQL`)
- Input `prompt` (บังคับ), `menuKey`, `dateFrom`, `dateTo` (สองตัวหลังไม่ถูกใช้ในโค้ด)
- `compileThaiPromptToSQL` (:91) ย่อ prompt เป็นตัวพิมพ์เล็กแล้วเลือก SQL สำเร็จรูปด้วย `strings.Contains` ตามลำดับ `switch` (ตัวแรกที่ตรงชนะ):
  1. ขนาน / parallel / เส้น / 2 หน่วย / สองหน่วย (:95) -- ถ้ามีคำว่าค้าง/สั่งซื้อ/สั่งขาย/เคลื่อนไหว ได้รายงานเอกสารหน่วยนับขนาน มิฉะนั้นได้ยอดคงเหลือหน่วยนับขนาน (`ic_inventory.unit_type IN (2,3)`)
  2. กำไร / ขายดี / ยอดขาย / sales / margin (:135)
  3. สั่งซื้อ / ค้างรับ / po / จัดซื้อ (:156)
  4. ลูกหนี้ / ar / ลูกค้า (:177)
  5. เจ้าหนี้ / ap / ซัพพลายเออร์ (:193)
  6. บัญชี / เดบิต / เครดิต / งบทดลอง / gl / ค่าใช้จ่าย (:209)
  7. เช็ค / ธนาคาร / เงินฝาก / bank / cheque (:225)
  8. ไม่ตรงอะไร (`default` :240) -- สรุปยอดคงเหลือและมูลค่าสินค้าคงคลัง
- ทุก SQL เป็นค่าคงที่ใน source (`LIMIT 500` ตามที่เห็นในตัวอย่าง) ไม่ได้ประกอบจากข้อความผู้ใช้
- รัน SQL ใน transaction อ่านอย่างเดียวเพื่อ**นับแถวและอ่านชื่อคอลัมน์**เท่านั้น แล้วคืน `{prompt, title, explanation, sql, suggestedGroupBy, previewRowCount, columns}` (ไม่คืนข้อมูลแถว)
- ข้อสังเกตจากโค้ด: คำสั้นอย่าง `po`, `ar`, `ap`, `gl` เป็น substring ของข้อความทั้งหมด จึงอาจตรงกับตัวอักษรในคำอื่นได้ (ยังไม่ได้ทดสอบ)

### 2. `ai-report-analyze` -- สรุปผู้บริหารจากแถวรายงาน (`AIReportAnalyze`)
- Input `menuKey`, `title`, `rows[]`, `totals{}`, `summaryCards[]` ทั้งหมดมาจาก client ไม่มีการอ่าน DB
- ผลลัพธ์ `{headline, highlights[], anomalies[], metrics[]}` (การ์ดมี `tone` = emerald/amber/rose/brand)
- คำนวณ: ยอดรวมแต่ละตัวใน `totals` ที่ไม่เป็นศูนย์เป็นการ์ด; ถ้ามีทั้งยอดที่ชื่อมีคำว่า เดบิต/debit และ เครดิต/credit เทียบผลต่างด้วย `big.Rat` (เท่ากัน = highlight "ดุลบัญชีถูกต้อง" ไม่เท่า = anomaly); สแกนแถวหาค่าติดลบและคอลัมน์ที่ชื่อมีคำว่า ขนาน / `qty_2` / `balance_qty_2` / `unit_code_2` ที่มีค่า
- ไม่มีแถว = คืน headline กับคำแนะนำให้ปรับเงื่อนไข

### 3. `ai-bank-reconcile` -- จับคู่รายการเดินบัญชี (`AIBankReconcile`)
- Input `statementLines[]` `{txDate, description, refNo, amount}` (ฟิลด์ `passBookCode`, `dateFrom`, `dateTo` ประกาศไว้แต่ไม่ถูกใช้ในโค้ด)
- ผู้สมัครจับคู่ (candidates) ของระบบ: `cb_chq_list` (เช็ครับ/จ่าย ยอด > 0, 100 แถวล่าสุดตาม `chq_due_date`) และ `ic_trans` flag 44 (ขาย) กับ 12 (ซื้อ) ที่ `last_status = 0`, `total_amount > 0` (100 แถวล่าสุด) -- ถ้า query พังจะข้ามเงียบ ๆ (`if err == nil`)
- **ถ้าไม่ส่ง `statementLines`** ระบบสร้างรายการทดสอบจากผู้สมัคร 6 รายการแรก (ตัวที่ 2 หักภาษี 3% ตัวที่ 3 หักค่าธรรมเนียม 15 บาท) เพื่อให้กดครั้งเดียวได้ผล (คอมเมนต์ :556-557) จึงไม่ควรใช้ผลของโหมดนี้เป็นข้อมูลจริง
- จับคู่ 3 รอบต่อรายการ (ผู้สมัครแต่ละรายใช้ได้ครั้งเดียว):
  1. `EXACT` ยอดเท่ากันทุกสตางค์ (ความมั่นใจ 100)
  2. `WHT_DEDUCTED` ยอดสุทธิ = ยอดเอกสาร - หัก ณ ที่จ่าย 1%, 2%, 3% หรือ 5% (ปัด HALF_UP 2 ตำแหน่ง) (ความมั่นใจ 95)
  3. `BANK_FEE` ยอดเอกสารมากกว่า statement ไม่เกิน 50 บาท (ความมั่นใจ 92)
  - ไม่เข้าสักรอบ = `UNMATCHED`
- ผลลัพธ์ `{summary{totalLines, matchedExact, matchedWht, matchedFee, unmatched, totalStatementAmount, totalSystemAmount, totalDiffAmount}, matches[]}`; ตัวเลขทั้งหมดเป็นข้อความทศนิยม 2 ตำแหน่ง

### 4. `ai-audit-copilot` -- ตรวจก่อนตรวจสอบบัญชี (`AIAuditCopilot`)
- Input `dateFrom`, `dateTo` ประกาศไว้ แต่ไม่ถูกใช้ในโค้ด
- ตรวจ 3 ข้อ (แต่ละข้อได้ finding `PASS` เมื่อผ่าน):
  1. สินค้าหน่วยนับขนาน (`unit_type IN (2,3)`, 50 รายการแรก) -- WARNING ถ้าไม่มีหน่วยที่สองใน `ic_opposite_unit` หรือยอดคงเหลือหลักกับขนานมีเครื่องหมายไม่สอดคล้อง
  2. ใบรายวันบัญชีที่ผลรวมเดบิต != เครดิต ใน `gl_journal_detail` (20 ใบแรก) -- CRITICAL ต่อใบ
  3. สินค้า `balance_qty < 0` ใน `ic_inventory` -- WARNING หนึ่ง finding ต่อทั้งหมด
- `healthScore = 100 - 20 x critical - 5 x warning` ต่ำสุด 0; คืน `{scannedAt, healthScore, criticalCount, warningCount, passCount, findings[]}` (`category` มี `PARALLEL_UNIT`, `STOCK_COST`, `GL_BALANCE`, `TAX_VAT`)
- ข้อสังเกต: คอมเมนต์หัวไฟล์ระบุ "duplicate tax invoices" และประเภท `TAX_VAT` ถูกประกาศ แต่ในโค้ดไม่มีขั้นตรวจใบกำกับภาษีซ้ำ (มีเพียง 3 ข้อด้านบน)

### 5. `ai-smart-reorder` -- แนะนำจุดสั่งซื้อ 2 หน่วย (`AISmartReorder`)
- Input `onlyParallel` (แสดงเฉพาะสินค้าหน่วยนับขนาน)
- อ่าน `ic_inventory` สูงสุด 40 รายการ (เรียงสินค้าขนานก่อน แล้วตามรหัส) พร้อมยอดค้างรับ/ค้างส่งจาก `ic_trans_detail`: ใบสั่งซื้อ = `trans_flag IN (6, 10)`, ใบสั่งขาย = `trans_flag IN (32, 34, 36)` เฉพาะ `last_status = 0` ทั้งหัวและรายการ (SQL ไม่กรองว่าใบถูกปิดหรือรับครบแล้ว)
- `net = balance + PO - SO` ต่อหน่วยหลักและหน่วยขนาน; ค่าความปลอดภัยตายตัว หน่วยหลัก 100 และหน่วยขนาน 20 (ในโค้ด `safetyTarget1/2`); ถ้า `net` ต่ำกว่าเป้า ยอดแนะนำสั่ง = เป้า - net; สถานะ "สต็อกเพียงพอ" หรือ "แนะนำสั่งซื้อเพิ่ม (Reorder)"
- คืน `{totalItemsAnalyzed, parallelItemsCount, needReorderCount, items[]}` เรียงสินค้าขนานก่อน

### 6. `ai-auto-gl` -- เสนอรายการบัญชีคู่ (`AIAutoGL`)
- Input `description` (ว่าง = "ซื้อสินค้าและวัสดุสำนักงาน"), `amount` (<= 0 = 1,070.00), `includeVat`
- เลือกบัญชีเดบิตจากคำในคำอธิบาย (ไฟ/น้ำ/สาธารณูปโภค, ขนส่ง/เดินทาง, เงินเดือน/ค่าจ้าง, ไม่ตรง = "ซื้อ") ค้น `gl_chart_of_account` ด้วย `name_1 ILIKE` หรือ `code ILIKE` ถ้าไม่พบใช้รหัสตั้งต้นที่ฝังในโค้ด; ภาษีซื้อค้น "%ภาษีซื้อ%"; เครดิตค้น "%เงินฝาก%"
- `includeVat`: ฐาน = `RoundHalfUp(amount x 100 / 107, 2)`, ภาษี = amount - ฐาน (3 บรรทัด เดบิตฐาน + เดบิตภาษีซื้อ + เครดิตเต็ม); ไม่ใช้ VAT: 2 บรรทัด เดบิต=เครดิต=amount
- คืน `confidence` ค่าคงที่ 96 และ `reason` -- ไม่ได้คำนวณความมั่นใจจากข้อมูลจริง (ตัวเลขฝังในโค้ด) เป็นข้อเสนอให้ผู้ใช้ตรวจ ไม่บันทึกอะไรลงฐานข้อมูล

## ฝั่งหน้าจอ: แผง AI Copilot Suite
จอ [[scr-system-process-workbench]] มีปุ่ม "✨ AI ผู้ช่วยตรวจสอบบัญชี สต็อก 2 หน่วยนับ & กระทบยอดธนาคารอัตโนมัติ (AI Copilot Suite)" ในแถบปุ่มบนของทุกโหมด (`SystemProcessWorkbenchScreen.tsx:841-851`) กดแล้วเปิดแผง (`:875-1281`) ที่มีแท็บ "แสดงครบทั้ง 4 ระบบ" (ค่าตั้งต้น) และแท็บของแต่ละตัว (`:888-892`) แผงเรียกเฉพาะ 4 action ที่ใช้ข้อมูลธุรกิจ (`ai-report-sql` / `ai-report-analyze` ไม่ได้เรียกจากจอนี้) ผ่านตัวช่วย `workflow()` (`:34-38`) แล้วแสดงผลอย่างเดียว ไม่เขียนข้อมูลใด ๆ (`:301-367`)
| การ์ด | สิ่งที่หน้าจอส่ง | ช่องกรอกในหน้าจอ | หมายเหตุเทียบกับ backend |
|---|---|---|---|
| กระทบยอดธนาคาร (`:301-316`, การ์ด `:914-1007`) | `{dateFrom, dateTo}` | ไม่มี | ไม่ส่ง `statementLines` เลย และ backend ไม่ใช้วันที่ จึงเข้าทางสร้างรายการทดสอบเสมอ (`ai_copilot.go:556-560`) |
| ตรวจก่อนปิดงวด (`:318-333`, การ์ด `:1009-1078`) | `{dateFrom, dateTo}` | ไม่มี | backend ไม่ใช้วันที่ ตรวจทั้งระบบ |
| จุดสั่งซื้อ 2 หน่วยนับ (`:335-349`, การ์ด `:1080-1177`) | `{onlyParallel}` | checkbox "เฉพาะสินค้าหน่วยนับขนาน" (ไม่ติ๊ก `:258`) | ตรงกับ input ของ backend |
| แนะนำผังบัญชี (`:351-367`, การ์ด `:1179-1279`) | `{description, amount, includeVat}` | คำอธิบาย (ค่าตั้งต้น "จ่ายค่าไฟฟ้าและค่าอินเทอร์เน็ตสำนักงานประจำเดือน"), จำนวนเงิน (10700.00), checkbox "รวม VAT 7%" (ติ๊ก) `:283-285` | เว้นช่องว่างแล้วหน้าจอส่ง "จ่ายค่าใช้จ่ายสำนักงาน" / "1070.00" (`:356-357`) |
ผลลัพธ์ที่ผู้ใช้เห็นของแต่ละการ์ด (ป้ายสรุป ตาราง คอลัมน์) อยู่ในหัวข้อ "แผง AI Copilot Suite" ของ [[scr-system-process-workbench]] ผู้ใช้ที่ไม่ใช่ Admin เรียกไม่ได้ตามค่าตั้งต้น (`permission.go:132`) และข้อความผิดพลาดจากเซิร์ฟเวอร์จะขึ้นในแถบแดงของจอ

## ที่มาในโค้ด
- `backend/internal/application/process/ai_copilot.go:1-14` - คำอธิบาย 6 engine
- `backend/internal/application/process/ai_copilot.go:91-257` - `compileThaiPromptToSQL`
- `backend/internal/application/process/ai_copilot.go:259-312` - `AIReportSQL`
- `backend/internal/application/process/ai_copilot.go:314-428` - `AIReportAnalyze`
- `backend/internal/application/process/ai_copilot.go:430-733` - bank reconcile (`systemBankCandidate` :484)
- `backend/internal/application/process/ai_copilot.go:735-907` - `AIAuditCopilot`
- `backend/internal/application/process/ai_copilot.go:909-1056` - `AISmartReorder`
- `backend/internal/application/process/ai_copilot.go:1060-1168` - `AIAutoGL`
- `backend/internal/adapter/inbound/http/process/workflow_handler.go:124-164` - case `ai-*` (ส่ง `Username` แทน `UserCode`)
- `frontend/account/process/SystemProcessWorkbenchScreen.tsx:301-367` - ผู้เรียก `ai-bank-reconcile`, `ai-audit-copilot`, `ai-smart-reorder`, `ai-auto-gl`; `:841-851` ปุ่มเปิดแผง; `:875-1281` แผง AI

## ดูเพิ่ม
- [[proc-workflow]]
- [[scr-system-process-workbench]]
- [[proc-report-custom-sql-template]]
- [[proc-permission-rights]]
- [[proc-dispatcher]]
- [[process-overview]]
