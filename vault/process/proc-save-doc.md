---
title: "บันทึก/ลบเอกสารนอก ic_trans แผนคำสั่งเอกสาร และรายการเอกสารหนี้ค้างชำระ (Save Doc / Doc Plan)"
tags: [process, doc, save-doc, delete-doc, ap_ar_trans, gl_journal, bills, idempotent]
aliases: ["doc/save", "doc/delete", "doc/bills", "SaveDoc", "DeleteDoc", "SaveDocInput", "docPlan", "runDocPlan", "buildSaveDocPlan", "OutstandingBills", "UniversalTransScreen", "docKindApAr", "docKindJournal", "journalPlan", "apArPlan", "checkStoredApArEditable", "บันทึกเอกสารลูกหนี้เจ้าหนี้", "สมุดรายวันทั่วไป"]
sources: ["backend/internal/application/process/docs.go:17", "backend/internal/application/process/docs.go:35", "backend/internal/application/process/docs.go:108", "backend/internal/application/process/docs.go:119", "backend/internal/application/process/docs.go:166", "backend/internal/application/process/docs.go:179", "backend/internal/application/process/docs.go:227", "backend/internal/application/process/docs.go:402", "backend/internal/application/process/docs.go:441", "backend/internal/application/process/docs.go:457", "backend/internal/application/process/docs.go:483", "backend/internal/application/process/docs.go:628", "backend/internal/application/process/service.go:1485", "backend/internal/adapter/inbound/http/process/handler.go:168", "backend/internal/adapter/inbound/http/process/bills_handler.go:11", "backend/internal/adapter/inbound/http/router.go:136", "backend/internal/adapter/inbound/http/process/permission.go:81"]
---

# บันทึก/ลบเอกสารนอก ic_trans (Save Doc / Doc Plan)

`docs.go` เป็นแกนของ route `doc/save`, `doc/delete`, `doc/bills` ที่หน้าจอ `UniversalTransScreen` ใช้บันทึกเอกสารที่ **ไม่ได้อยู่ใน `ic_trans`** ได้แก่ `ap_ar_trans` (เอกสารลูกหนี้/เจ้าหนี้) และ `gl_journal` (สมุดรายวันทั่วไป) ส่วนเอกสารซื้อ-ขาย-สต็อกใช้ `trans/save` (กลุ่มอื่น) โน้ตนี้อธิบายกลไกของ handler/แผนคำสั่ง รายละเอียดบัญชีของเอกสารเหล่านี้ดู [[accounting-overview]]

## ทำงานอย่างไร

### Route และสิทธิ์
- `POST /process/doc/save`, `/doc/delete`, `/doc/bills`, `/doc/flow` (และ `/api/v1/process/...`) ผูกที่ `router.go:136-141, 177-182`
- สิทธิ์ (`permission.go`): `doc/save` ต้องมีสิทธิ์เพิ่มเมื่อ body มี `isNew = true` นอกนั้นเป็นสิทธิ์แก้ไข (:81-85); `doc/delete` = สิทธิ์ลบ; `doc/bills` = สิทธิ์อ่าน ดู [[proc-permission-rights]]
- handler ใส่ `ProviderCode`, `DatabaseName` และ (เฉพาะ save) `UserCode` จาก token ไม่รับจาก body (`handler.go:168-186`) ส่วน `doc/bills` ใช้ตัวถอดรหัสของกลุ่ม cheque (`bills_handler.go:11-24`)

### ชนิดเอกสารและ input (`SaveDocInput` :35)
- `kind`: `ap_ar_trans`, `gl_journal` หรือ `cb_chq_list` (:17-22) -- `cb_chq_list` (ทะเบียนเช็ค/บัตรเครดิต) **ดูอย่างเดียว** บันทึก/ลบจะได้ error "ทะเบียนเช็ค/บัตรเครดิตเป็นหน้าจอดูข้อมูลอย่างเดียว" (:435) ทั้งที่คอมเมนต์ของ handler ยังเขียนว่าเขียน `cb_chq_list` ได้ (`handler.go:168-169`)
- `isNew = true` = ปฏิเสธถ้ามีคีย์อยู่แล้ว; `false` = แทนที่เอกสารเดิม จึงบันทึกซ้ำได้ผลเดิม (idempotent ตามคอมเมนต์ :33-34)
- ฟิลด์หลัก: `docNo`, `docDate` (YYYY-MM-DD), `docTime` (HH:MM), `transType`, `transFlag`, `custCode`, `bookCode` (gl_journal, ว่าง = `JV`), สาขา/แผนก, `vatType`/`vatRate`, ส่วนลด, เงินล่วงหน้า, `dueDate`, `docRef`/`docRefDate`, `creditDay`, `remark`, `docFormatCode`, รหัสพนักงานขาย/โครงการ/จัดสรร/ด้าน/งาน/กลุ่มเอกสาร, `currencyCode`/`exchangeRate`, `fxMode`
- ตารางย่อย: `lines` (รายการ), `bills` (กริดบิลของ flag 213/235/19/239), `pay` (แท็บรับ/จ่ายชำระของ 19/239 -> `cb_trans`), `glLines` (รายการบัญชีของสมุดรายวัน), และแท็บภาษี `vatBuy`, `vatSale`, `whtIn`, `whtOut`
- เงินทุกช่องเป็นสตริงทศนิยมผ่านตัวแกะ `decimalParser` ไม่ผ่าน `float64`

### โครงแผน `docPlan` (:108) และ `runDocPlan` (:179)
`buildSaveDocPlan` / `buildDeleteDocPlan` ตรวจ input แล้วสร้าง "แผน" (คำสั่ง SQL แบบพารามิเตอร์เรียงลำดับ + ตัวตรวจหลังเขียน) จากนั้น `runDocPlan` รันใน transaction เดียวตามลำดับ:
1. ล็อกเอกสารด้วย `pg_advisory_xact_lock(hashtext(lockKey))` (`gl_journal:<เลขที่>` หรือ `ap_ar_trans:<เลขที่>`) และล็อกร่วมระดับบัญชีแยกประเภท (`lockGLShared`)
2. `isNew` = ตรวจซ้ำด้วย `existsSQL`; ถ้าไม่ใช่และเป็น `ap_ar_trans` ล็อกคีย์เดียวกับการยกเลิกเอกสาร (`ic_trans:<เลขที่>:<flag>`) แล้วตรวจ `checkStoredApArEditable` -- เอกสารที่ถูกใช้ (`used`), เสร็จสมบูรณ์ (`success`) หรือยกเลิกแล้ว (`last_status`) แก้/ลบไม่ได้ (`apArEditLocked` :457 อ้างอิง C# `_ar_ap_trans._myManageData1__checkEditData`); เอกสารที่ไม่มีอยู่ผ่าน
3. ถ้าเป็นเอกสารที่ผูกการอ้างอิง (`docFlow`) อ่านเอกสารต้นทางเดิมไว้ก่อน
4. รันคำสั่งทีละตัว (ลบของเดิมแล้วแทรกใหม่); ข้อผิดพลาดฐานข้อมูลแปลงด้วย `execError`
5. รันตัวตรวจหลังเขียน (`checks`, ไฟล์ `pay_check.go` -- เช่นยอดแท็บชำระครบ)
6. `docFlow`: คำนวณสถานะ used/success ของเอกสารที่บิล/ชำระอ้างถึงใหม่ทั้งก่อนและหลัง (`docFlowTx`) ดู [[proc-doc-flow-numbering]]
7. `glFlag > 0` (:219): สร้างรายการบัญชีของเลขที่นั้นใหม่ด้วย `rebuildGLTx` -- ตั้งเฉพาะตอนบันทึก `ap_ar_trans` flag 19 และ 239 (:389-391) และ `rebuildGLTx` รองรับสองแฟลกนี้จริง (`service.go:1485,1495,1738`) ส่วนแฟลกอื่นของ `ap_ar_trans` และ `gl_journal` ไม่สร้างบัญชีซ้ำ; คอมเมนต์ที่ `docs.go:73` ยังเขียนว่า "no GL rebuild ... no-op" ซึ่งขัดกับโค้ดที่ตั้ง `glFlag` (ถือว่าคอมเมนต์ค้างเก่า -- ยังไม่ยืนยันโดยรันจริง) การลบไม่ตั้ง `glFlag` แต่ลบ `gl_journal` ตาม `doc_no` ตรง ๆ

### ก่อนรัน `SaveDoc` (:119)
- หาสาขาตามผู้ใช้ (`userBranchCode`), เตรียมค่าหลายสกุลเงิน (`billFx`, `checkFxMode`) สำหรับ flag 19/239, อ่านจำนวนทศนิยมของแท็บชำระ (`faAmountScale`) บน pool ก่อนเปิด transaction (เพื่อให้การอ่านพลาดไม่ทำ transaction ล้ม)
- ใน transaction: `checkSaveDocPeriod` (`period.go:109`; กลุ่มงวดบัญชี ไม่ได้อธิบายที่นี่) แล้วจึงสร้าง/รันแผน -- เอกสารหลายสกุลเงินสร้างแผนใน transaction หลัง `refreshFxBills` อ่านคอลัมน์หนี้ล่าสุด

### สมุดรายวัน `gl_journal` (:227-)
- เลขที่เอกสาร 1-25 ตัวอักษร, วันที่เอกสารบังคับ; ข้ามแถวที่ไม่มีรหัสบัญชี; ยอดเดบิตรวมต้องเท่ากับเครดิตรวม ไม่งั้น error "ยอดเดบิต (...) และเครดิต (...) ไม่เท่ากัน"
- เขียน `gl_journal_detail` + `gl_journal` พร้อมงวด/ปีบัญชีหาจาก `erp_account_period` (ไม่พบ ใช้เดือน/ปีของวันที่)
- `journalPlan` (:441) แตะเฉพาะ JV มือ (`trans_flag` 0 หรือ 1999 ตามคอมเมนต์อ้าง C# `JournalDataProcess.cs:20`) -- GL ที่ `rebuildGLTx` สร้างจากเอกสารอื่นเลขเดียวกันไม่ถูกลบ; ลบสมุดรายวันลบแท็บภาษีด้วย (`journalTaxDeleteStmts`)

### เอกสาร `ap_ar_trans` (:300-)
- `apArPlan` (:483) ลบแถวเดิมใน `ap_ar_trans_detail`, `ap_ar_trans`, `cb_trans_detail`, `cb_trans`, `cb_chq_list` (เช็คจากแท็บชำระ) ของเลขที่+flag นั้น แล้วแทรกหัว `ap_ar_trans`, กริดบิล, แท็บชำระ และแท็บภาษี (19: ภาษีซื้อ + หัก ณ ที่จ่ายรับ, 239: ภาษีขาย + หัก ณ ที่จ่ายจ่าย)
- flag ที่มีกริดบิล: 213/235/19/239; ถ้าไม่มี ยอดรวมมาจาก `lines`; กรณีมีกริดบิล `total_net_value` = ผลรวม `sum_pay_money` ตาม C# `_reCalc`
- `ap_ar_trans` เป็นคีย์เดียวด้วย `doc_no` (ชื่อ constraint ในคอมเมนต์ :482) จึงตรวจแก้ไขด้วย `doc_no` อย่างเดียว กันแก้ผิด flag แล้วหลุดจากตัวป้องกัน
- ลบ (`buildDeleteDocPlan` :402): นอกจากแผนข้างต้น ลบ `gl_journal_detail`/`gl_journal` ตาม `doc_no` และแท็บภาษีตาม `doc_no` + flag (อ้างอิง C# `_ar_ap_trans.cs:3068, 2972-2986`) ต้องระบุ `transFlag` > 0

### รายการเอกสารหนี้ค้างชำระ `doc/bills` (`OutstandingBills` :628)
- Input `{transFlag (213/235/19/239), custCode, docDate, docNo}`: `docNo` คือเอกสารที่กำลังแก้ ยอดชำระของมันเองไม่หักยอดคงค้าง; ไม่รู้จัก flag = "ประเภทเอกสารนี้ไม่มีรายการเอกสารหนี้"; ไม่ระบุรหัสลูกหนี้/เจ้าหนี้ = error
- คัดเอกสารหนี้/ใบลดหนี้จาก `ic_trans` รวมการขายสินทรัพย์เชื่อ (`as_trans` flag 1802) ด้วยชุดเงื่อนไข flag ใน `arDebtWhere/arCreditWhere/apDebtWhere/apCreditWhere` (:599-609, อ้างอิง C# `_process.cs _createQuery` 588-956) ใบลดหนี้คิดเป็นยอดติดลบ; กรองใบวางบิลซ้ำเมื่อ `erp_option.filter_pay_bill = 1`
- ผลลัพธ์คือ `BillLine[]` (ใช้เติมกริดบิล) รองรับหลายสกุลเงินผ่าน `billFx`

## ที่มาในโค้ด
- `backend/internal/application/process/docs.go:17-98` - ชนิดเอกสาร, `SaveDocInput`, `DeleteDocInput`
- `backend/internal/application/process/docs.go:100-225` - `docPlan`, `SaveDoc`, `DeleteDoc`, `runDocPlan`
- `backend/internal/application/process/docs.go:227-427` - `buildSaveDocPlan`, `buildDeleteDocPlan`
- `backend/internal/application/process/docs.go:429-497` - ทะเบียนเช็คอ่านอย่างเดียว, `journalPlan`, ล็อกแก้ไข `ap_ar_trans`, `apArPlan`
- `backend/internal/application/process/docs.go:498-702` - `BillLine`, `billStmts`, `OutstandingBills`
- `backend/internal/adapter/inbound/http/process/handler.go:168-186` - `SaveDoc`, `DeleteDoc`
- `backend/internal/adapter/inbound/http/process/bills_handler.go:11-24` - `DocBills`
- `backend/internal/adapter/inbound/http/router.go:136-141,177-182` - ผูก route
- `backend/internal/adapter/inbound/http/process/permission.go:24,39,47,81-85` - สิทธิ์

## ดูเพิ่ม
- [[proc-doc-flow-numbering]]
- [[proc-doc-cancel-approve]]
- [[proc-permission-rights]]
- [[proc-dispatcher]]
- [[accounting-overview]]
- [[process-overview]]
