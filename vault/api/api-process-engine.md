---
title: "สเปก Process Engine & Workflow Dispatcher (/process/*)"
audience: dev
tags: [api, process-engine, workflow, transactions, stock, gl]
aliases: ["Process Engine API", "/process/trans/save", "/process/workflow", "/process/stock/rebuild", "/process/doc/save", "StockTools API"]
sources: ["backend/internal/adapter/inbound/http/router.go:65-122", "backend/internal/adapter/inbound/http/process/handler.go:1-345", "backend/internal/adapter/inbound/http/process/jobs_handler.go:1-130", "backend/internal/adapter/inbound/http/process/options_handler.go:1-39", "backend/internal/adapter/inbound/http/process/workflow_handler.go:1-503", "backend/internal/adapter/inbound/http/process/stocktools_handler.go:46-189", "backend/internal/adapter/inbound/http/process/master_handler.go:18-60", "backend/internal/adapter/inbound/http/process/transgrid_handler.go:20-88", "backend/internal/adapter/inbound/http/process/barcode_handler.go:22-72", "backend/internal/adapter/inbound/http/process/docpicture_handler.go:36-140", "backend/internal/adapter/inbound/http/process/itemdetail_handler.go:16-59", "backend/internal/adapter/inbound/http/process/master_detail_handler.go:1-43"]
---

**Process Engine** คือหัวใจหลักในการประมวลผลทางบัญชี สต็อก การเงิน ภาษี และ Workflow อัจฉริยะทั้งหมดของ **BC Ai Account** โดย mount คู่ขนานทั้งที่ `/process/*` และ `/api/v1/process/*` (`router.go:133-215`) กำหนด Request Body สูงสุดที่ `16 MiB` (`maxJSONBody`)

> [!IMPORTANT]
> ทุก Endpoint ใต้ `/process/*` ต้องผ่านทั้ง `Auth` JWT Bearer และ `RequireRight` (ตรวจสิทธิ์เมนูตาม Session) และบางฟังก์ชันตรวจ `X-BC-Edition` สำหรับฟีเจอร์ Pro

---

## 1. Core Transaction, Document, GL & Rebuild Endpoints

| Endpoint (`POST`) | หน้าที่ | รายละเอียดสำคัญ |
| :--- | :--- | :--- |
| `/process/trans/save` | บันทึกเอกสารซื้อ-ขาย-สินค้า-ฝากขาย (`ic_trans` + `ic_trans_detail` + ชำระเงิน/มัดจำ) | ตรวจสิทธิ์ Pro หากใช้สกุลเงินต่างประเทศ (`isForeignCurrencySave`), รัน `DocFlow`, คิว Rebuild สต็อก |
| `/process/trans/delete` | ลบเอกสารรายการสินค้า-ซื้อ-ขาย | คืนสถานะ DocFlow ของเอกสารต้นทางที่เคยอ้างอิง |
| `/process/trans/deposits` | ดึง/คำนวณเงินมัดจำคงเหลือเพื่อนำมาตัดยอดในบิล | - |
| `/process/trans/party-defaults` | ดึงค่าเริ่มต้นคู่ค้า (เครดิต ราคา ประเภทภาษี ที่อยู่) | - |
| `/process/doc/save` | บันทึกเอกสารบัญชี/เจ้าหนี้/ลูกหนี้/เงินสดธนาคาร/เช็ค (`gl_journal`, `ap_ar_trans`, `cb_trans`) | ตรวจสอบสมดุล Dr=Cr และสิทธิ์แก้เอกสารที่ถูกใช้แล้ว (`apArEditLocked`) |
| `/process/doc/delete` | ลบเอกสาร GL / AR / AP / CB | ลบรายการชำระ/เช็ค/VAT ที่ผูกกันครบชุด |
| `/process/doc/cancel` | ยกเลิกเอกสารแบบเก็บ Audit Trail (`last_status = 1`) | อัปเดต `DocFlow` ย้อนกลับเอกสารอ้างอิง |
| `/process/doc/approve` | อนุมัติเอกสาร (`approve_status`) | - |
| `/process/doc/bills` | ดึงรายการบิลค้างชำระเพื่อรับ/จ่ายเงิน (`OutstandingBills`) | รองรับทั้งฝั่ง AR และ AP รวมตั้งหนี้ยกมาและขายสินทรัพย์ (`1802`) |
| `/process/doc/flow` | คำนวณสถานะอ้างอิงเอกสาร (`used_status`, `doc_success`) | ใช้เวลาตรวจหรือซ่อมแซมความเชื่อมโยงเอกสาร |
| `/process/stock/rebuild` | ประมวลผลยอดสต็อกและต้นทุนสินค้าใหม่ (`RebuildStock`) | รองรับ `async: true` (+ `ChainNext`) และคำสั่งแบบ `update_trans_detail`, `recheck_trans_flow`, `check_so_doc_success`, `recheck_doc_flow` |
| `/process/gl/rebuild` | ลงบัญชีอัตโนมัติ (Rebuild GL) ตามช่วงวันที่/ผังบันทึก | รองรับ `async: true` (+ `ChainNext`), ตรวจสอบงวดบัญชีและคำนวณ Dr/Cr ให้สมดุล |
| `/process/ar/rebuild` | คำนวณยอดลูกหนี้คงค้างและตัดชำระใหม่ (`RebuildAR`) | ปรับปรุงยอดค้างชำระลูกหนี้ให้ตรงกับรายการรายวัน |
| `/process/ap/rebuild` | คำนวณยอดเจ้าหนี้คงค้างและตัดชำระใหม่ (`RebuildAP`) | ปรับปรุงยอดค้างชำระเจ้าหนี้ให้ตรงกับรายการรายวัน |
| `/process/options/runtime` | `GET` / `POST` อ่านสวิตช์ `CompanyRuntimeOptions` จาก `erp_option` + สิทธิ์ `erp_user` | ให้ Web / Desktop / Mobile ใช้กติกาชุดเดียวกันกับฝั่ง Go (`runtime_options.go`) |
| `/process/jobs/enqueue` | สั่งรันคิวงานประมวลผลเบื้องหลัง (`stock_rebuild`, `ar_rebuild`, `ap_rebuild`, `gl_rebuild`) | รองรับ `priority`, `idempotencyKey` และ `chainNext` (`202 Accepted`) — ดูสถาปัตยกรรม [[part_of_arch::arch-process-jobs-queue]] |
| `/process/jobs`, `/process/jobs/health`, `/process/jobs/{jobId}` | `GET` ดูรายการคิว, สถานะ Cluster/AutoScaler และรายละเอียดงาน (`POST .../cancel` เพื่อยกเลิก) | ใช้ Broker แบบ Resilient Redis/Memory และรองรับสตรีมสด SSE |
| `/process/jobs/events`, `/process/jobs/{jobId}/events` | `GET` SSE Stream ติดตามความคืบหน้าคิวงานทั้งบริษัทหรือราย `jobId` | ส่ง Event อัปเดตความคืบหน้าแบบเรียลไทม์ |
| `/process/gl/template-defaults` | โหลดรูปแบบลงบัญชีอัตโนมัติ (`gl_journal_template`) | - |
| `/process/gl/recurring` | จัดการรายการลงบัญชีประจำงวดอัตโนมัติ (Recurring JV) | - |
| `/process/cheque/rebuild` | ประมวลผลสถานะเช็ครับ/เช็คจ่ายใหม่ทั้งหมด | - |
| `/process/cheque/candidates` | ค้นหาเช็คที่พร้อมนำไปขึ้นเงิน/ฝาก/ผ่าน | - |
| `/process/tax/rebuild` | ประมวลผลตารางภาษีซื้อ/ภาษีขายใหม่ | - |
| `/process/report/run` | รันรายงานตาราง JSON + Drilldown Spec | ดู [[api-report-catalog]] |
| `/process/report/pdf` | สร้างไฟล์ PDF มาตรฐาน `%PDF-1.4` | ใช้เทมเพลตจาก `erp_report_template` |

---

## 2. Lookup & Grid Utility Dispatchers

### Lookup Filters (`POST /process/lookup/{type}`)
- `party-filter`: กรองลูกหนี้/เจ้าหนี้ตามสิทธิและเงื่อนไขเอกสาร
- `ref-doc-filter`: ค้นหาเอกสารอ้างอิงที่ยังไม่ปิด (`doc_success = 0`)
- `wh-filter`, `wh-pick-check`, `wh-perm-filter`: กรองคลังสินค้า ตรวจคลังหยิบสินค้า และสิทธิ์เข้าถึงคลังตามผู้ใช้

### Grid & Master Dispatchers
| Prefix (`POST` เว้นระบุ `GET`) | ค่า `{action}` ที่รองรับ | หน้าที่ |
| :--- | :--- | :--- |
| `/process/transgrid/{action}` | `line`, `formula`, `totals`, `shortcut`, `priceinfo`, `fx`, `refimport` | คำนวณบรรทัด Grid สูตรราคา ส่วนลด FX และนำเข้าเอกสารอ้างอิงด้วย `*big.Rat` |
| `/process/barcode/{action}` | `item`, `save`, `discount-load`, `discount-save`, `ean13-check`, `ean13-generate`, `ean13-apply`, `print-items`, `format` | จัดการบาร์โค้ด สร้าง/ตรวจ Check Digit EAN-13 ส่วนลดและพิมพ์ป้าย |
| `/process/itemdetail/{action}` | `get`, `save` | โหลด/บันทึกรายละเอียดสินค้าแบบขยาย |
| `/process/itemmaster/{action}` | `save`, `delete` | สร้าง/แก้ไข/ลบสินค้าหลัก + แจ้ง `NudgeSync` เข้า Company Brain |
| `/process/master/{action}` | `nextcode`, `codeleave`, `assetdepdefaults`, `datalistget`, `datalistsave`, `recordlock`, `seeddocformats`, `seedpresets` | รันรหัสอัตโนมัติ ล็อกเรคคอร์ด Config คอลัมน์ `BcDataList` |
| `/process/master-detail/{action}` | `save`, `delete` | บันทึก/ลบ Master แบบมีตารางลูก (Atomic Header + Grid) |
| `/process/modifyprice/{action}` | `preview`, `apply` | ปรับราคาขายจำนวนมากแบบพรีวิวและบันทึกจริง |
| `/process/docpicture/{action}` | `formats`, `docs`, `get`, `save` (+ `GET /docpicture/image`) | แนบรูปภาพเอกสารและดึงรูป |
| `/process/itempicture/{action}` | `list`, `get`, `save` (+ `GET /itempicture/image`) | จัดการรูปสินค้า |

### StockTools (`POST /process/stocktools/{action}`, 23 actions ใน `stocktools_handler.go:92-189`)
- **Serial & Barcodes**: `formats`, `barcodecheck`, `serialanalyze`, `serialscan`, `serialcountsave`
- **Lot Adjustment & Auto Lot**: `lotamountload`, `lotamountsave`, `lotautolist`, `lotautocheck`, `lotautorun`
- **Hidden / Landed Cost**: `hiddencostcalc`, `hiddencostsave`, `hiddencostdelete`
- **Stock Count & Beginning**: `notcountedlist`, `notcountedrun`, `stockbeginningsave`, `stockbeginningdelete`
- **Price, Point & Doc Numbers**: `itemnextcode`, `docnonext`, `checkpricesave`, `pointdocsave`, `pointdocdelete`, `itemsaved`

---

## 3. Workflow Action Dispatcher (`POST /process/workflow/{action}`)

อ้างอิงจาก `backend/internal/adapter/inbound/http/process/workflow_handler.go:39-486` มีทั้งหมด **55 action slugs** (สัญลักษณ์ `🔒 Pro` หมายถึงต้องผ่าน `requireProEdition`):

### หมวด GL, ภาษี, ธนาคาร และสินทรัพย์
- `change-code` — เปลี่ยนรหัส Master ข้ามเอกสารที่เกี่ยวข้องทั้งหมดอย่างปลอดภัย
- `journal-list` — ดึงรายการสมุดรายวันรอผ่านรายการ
- `journal-pass` — ผ่านรายการลงบัญชี
- `gl-check` — ตรวจสอบความถูกต้องผังบัญชี/สมดุล GL
- `gl-close` — ปิดงวดบัญชีสิ้นปี/สิ้นงวด
- `fa-depreciation` — ประมวลผลค่าเสื่อมราคาสินทรัพย์ประจำงวด
- `asset-sale` — ขายสินทรัพย์และคำนวณกำไร/ขาดทุน
- `fx-revaluation` 🔒 Pro — ปรับปรุงกำไร/ขาดทุนอัตราแลกเปลี่ยนสิ้นงวด
- `tax-health` — ตรวจสุขภาพภาษีก่อนยื่น ภ.พ.30 / ภ.ง.ด.3, 53
- `rd-prep-wht` — ส่งออกไฟล์ RD Prep ภาษีหัก ณ ที่จ่าย & ตามใบ 50 ทวิ
- `foreign-service-tax` — คำนวณ ภ.พ.36 & ภ.ง.ด.54 (บริการต่างประเทศ)
- `director-loan` — ตรวจเงินกู้ยืมกรรมการ ม.65 ทวิ (4) และธุรกิจเฉพาะ
- `corporate-tax-pnd50` — กระดาษทำการ ภ.ง.ด.50 / ภ.ง.ด.51
- `dbd-efiling` — จับคู่ DBD e-Filing Taxonomy & สบช.3
- `etax-ewht` — จัดการ e-Tax Invoice & e-WHT
- `prepaid-amort` 🔒 Pro — ตัดจ่ายค่าใช้จ่ายล่วงหน้า & รายได้รอตัดบัญชี (ACT/365)
- `hire-purchase` 🔒 Pro — สัญญาเช่าซื้อ/ลีสซิ่งและเพดานรถยนต์ พ.ร.ฎ. 315
- `bank-statement-reconcile` — นำเข้า Bank Statement และกระทบยอดธนาคาร
- `slip-verify` — ตรวจสอบสลิป QR ซ้ำ/ปลอม
- `expense-claim` — เบิกเคลียร์เงินสดย่อย & ตรวจรายจ่ายต้องห้าม ม.65 ตรี

### หมวดลูกหนี้ เจ้าหนี้ สัญญา การขาย และงบประมาณ
- `ap-contract` 🔒 Pro / `ar-contract` 🔒 Pro — สัญญาแบ่งงวดตั้งหนี้เจ้าหนี้/ลูกหนี้
- `ar-auto-bill` 🔒 Pro / `ap-auto-bill` 🔒 Pro — วางบิล/รับวางบิลรวมอัตโนมัติ
- `public-bill-link` 🔒 Pro — สร้าง/จัดการลิงก์วางบิลออนไลน์และอนุมัติสลิป
- `cashflow-forecast` 🔒 Pro — พยากรณ์กระแสเงินสด 30/60/90 วัน
- `sales-commission` 🔒 Pro — คำนวณค่าคอมมิชชั่นทีมขาย
- `credit-group` 🔒 Pro — คุมวงเงินเครดิตกลุ่มบริษัท & เบี้ยปรับล่าช้า
- `marketplace-reconcile` 🔒 Pro — กระทบยอด Shopee / TikTok Shop / Lazada & GP
- `project-retention` 🔒 Pro — งวดงานก่อสร้าง เงินประกันผลงาน ป.73/2541 & BOQ
- `budget-approval` 🔒 Pro — งบประมาณแผนก/โครงการ & Approval Matrix
- `ocr-three-way` 🔒 Pro — อ่านบิลซื้อด้วย AI OCR & จับคู่ 3 ทาง PO-GRN-Inv

### หมวดสต็อก คลังสินค้า การผลิต และระบบงาน
- `check-ic-trans` — ตรวจสอบความผิดปกติเอกสารสต็อก
- `point-recal` — คำนวณแต้มสะสมสมาชิกใหม่
- `fifo-allocate` — ตัดชำระหนี้หรือจัดสรรแบบ FIFO อัตโนมัติ
- `consignment` 🔒 Pro — ระบบสินค้าฝากขาย & GP Settlement
- `bom-assembly` 🔒 Pro — สูตรการผลิต (BOM) & ใบสั่งประกอบสินค้า
- `stock-expiry-fefo` 🔒 Pro — คลังวันหมดอายุ FEFO & หนังสือแจ้งทำลาย ป.79/2541
- `serial-warranty-rma` 🔒 Pro — ตรวจรับประกัน Serial/IMEI & งานซ่อม RMA

### หมวด AI Copilot & ระบบบริการ SME ไทย
- `ai-report-sql` — ให้ AI สร้าง/รัน SQL รายงานอย่างปลอดภัย
- `ai-report-analyze` — ให้ AI วิเคราะห์ผลรายงาน
- `ai-bank-reconcile` — ให้ AI ช่วยจับคู่รายการ Statement
- `ai-audit-copilot` — ผู้ช่วยตรวจบัญชี & ความผิดปกติ
- `ai-smart-reorder` — วิเคราะห์จุดสั่งซื้อสินค้าอัจฉริยะ
- `ai-auto-gl` — แนะนำคู่บัญชีลงรายวันอัตโนมัติ
- `morning-briefing` — ศูนย์แจ้งเตือนงานด่วนประจำวัน ([[arch-morning-briefing-analytics]])
- `resolve-doc` — แปลรหัสเอกสาร/ตาราง/ภาษี/Master เป็นปลายทางหน้าจอเจาะลึก
- `feature-options` — อ่าน/บันทึก Switchboard 32 ระบบ & Presets ([[arch-feature-switchboard]])
- `tax-id-lookup` — ค้นหาและตรวจสอบเลขผู้เสียภาษี 13 หลัก (Mod-11)
- `line-expense-inbox` — กล่องรับสลิป/บิลค่าใช้จ่ายจาก LINE OA (รองรับตรวจ Header `X-Line-Signature`)
- `accountant-chaser` — กระดานทวงเอกสารบัญชี/ภาษีค้างส่ง
- `mobile-quick-bill` — ออกบิล/ใบเสนอราคาด่วนบนมือถือพร้อม PromptPay QR
- `payroll-sso-pnd1` — คำนวณเงินเดือน ประกันสังคม ม.33 & ภ.ง.ด.1
- `audit-list` — ประวัติ Audit Log ของเอกสารและ Master
- `import-transport-label` — นำเข้าข้อมูลใบปะหน้าขนส่ง
- `province-list` / `province-load` — จัดการข้อมูลจังหวัด/อำเภอ/ตำบลไทย
