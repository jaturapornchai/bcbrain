---
title: "API บัญชีแยกประเภท (Process GL actions: gl/rebuild, journal, gl-check, gl-close, สินทรัพย์ถาวร, AI)"
tags: [api, process, gl]
aliases: ["/api/v1/process/gl/rebuild","/api/v1/process/gl/template-defaults","/api/v1/process/gl/recurring","gl/rebuild","gl/template-defaults","gl/recurring","journal-list","journal-pass","gl-check","gl-close","fa-depreciation","asset-sale","ai-auto-gl","ai-bank-reconcile"]
sources: ["backend/internal/adapter/inbound/http/router.go:131","backend/internal/adapter/inbound/http/router.go:132","backend/internal/adapter/inbound/http/router.go:133","backend/internal/adapter/inbound/http/process/handler.go:90","backend/internal/adapter/inbound/http/process/handler.go:98","backend/internal/adapter/inbound/http/process/gl_template_handler.go:12","backend/internal/adapter/inbound/http/process/gl_recurring_handler.go:12","backend/internal/adapter/inbound/http/process/workflow_handler.go:45","backend/internal/adapter/inbound/http/process/permission.go:73","backend/internal/application/process/service.go:1297","backend/internal/application/process/workflow.go:442","backend/internal/application/process/fa_depreciation.go:794"]
---

# API บัญชีแยกประเภท (gl/*, workflow GL/สินทรัพย์/AI-GL)

กลุ่ม action ที่สร้าง ตรวจ ผ่านรายการ และปิดงวดสมุดรายวัน รวมทั้งเอกสารสินทรัพย์ถาวรที่ลงบัญชี. ทั้งหมดเป็น `POST` ใต้ `/api/v1/process/` (และ `/process/` ชื่อซ้ำ) ต้องมี `Authorization: Bearer <token>`; envelope สำเร็จ `{"ok":true,"data":...}`; ข้อผิดพลาด `{"error":{"message":"..."}}` (ภาพรวมที่ [[api-process-run]]). ทุก action เติม `ProviderCode`/`DatabaseName`/`UserCode` จาก claims ไม่ใช่จากบอดี้. เพดานเวลาทั้ง request 60 วินาที. แนวคิดบัญชี: [[acc-gl-rebuild]], [[acc-gl-posting-standard]], [[acc-gl-template-engine]], [[acc-period-close]], [[acc-fixed-asset-depreciation]], [[acc-fixed-asset-sale]], [[proc-workflow]], [[proc-sysproc-tools]], [[proc-ai-copilot]].

## ตาราง action

| action | หน้าที่ | input สำคัญ | ตาราง | path:line | สิทธิ์ / บอดี้ |
|---|---|---|---|---|---|
| `gl/rebuild` | ลบสมุดรายวันที่ระบบสร้างอัตโนมัติ (`COALESCE(trans_direct,0)<>1`) ของเอกสารเป้าหมาย แล้วสร้าง gl_journal + gl_journal_detail ที่สมดุลใหม่จาก ic_trans ใน transaction เดียว | `docNo`, `transFlag`, `dateFrom`, `dateTo` | gl_journal, gl_journal_detail, ic_trans, ic_inventory, ic_trans_detail, ap_supplier, ar_customer | handler.go:98 → service.go:1297 | `docNo` ไม่ว่าง = Write, ทั้งฐาน = Admin (permission.go:74-78); 16 MB |
| `gl/template-defaults` | แถวรูปแบบ GL เริ่มต้นของจอหนึ่ง (ปุ่ม "ดึงรูปแบบ" ของ DocFormat); ระบบสต็อกต่อเนื่อง (`inventory_gl_post=0`) ตัด action 101/103 ออก | `screenCode` | erp_option | gl_template_handler.go:12 → gl_template_defaults.go:58 | Read; 1 MB |
| `gl/recurring` | รายการเทมเพลตสมุดรายวันประจำพร้อมแถวที่ถอดรหัสแล้ว (คอมโบของจอสมุดรายวัน) | `{}` (ไม่มีฟิลด์) | gl_recurring | gl_recurring_handler.go:12 → gl_recurring.go:42 | Read; 1 MB |
| `workflow/journal-list` | ใบสำคัญตามเงื่อนไขพร้อมข้อผิดพลาดที่ทำให้ผ่านรายการไม่ได้ | `dateFrom`, `dateTo`, `docFrom`, `docTo`, `undo` | gl_journal, gl_journal_detail, gl_chart_of_account | workflow_handler.go:45 → workflow.go:442 | Read; 1 MB |
| `workflow/journal-pass` | ตั้ง `gl_journal.is_pass` (1 ผ่าน / 0 ยกเลิก) ตามเลขที่ที่เลือก แล้วซิงก์ `gl_journal_detail.is_pass` | `menuName`, `docNos[]` (1-5000 ใบ), `undo` | gl_journal, gl_journal_detail, gl_chart_of_account | :52 → workflow.go:480 | Write; 1 MB |
| `workflow/gl-check` | ตรวจ 8 ข้อตามลำดับของ C# (รายการ `checks` มี 8 ข้อ `workflow.go:587-613` ส่วนคอมเมนต์ที่ `:552` เขียนว่า nine) (เขียนเฉพาะการซิงก์ `journal_type` ของรายละเอียดจากหัว) | `dateFrom`, `dateTo`, `showAll`, `onlyBookSelect`, `skipCancelDoc` | ic_trans, erp_doc_format, gl_journal, gl_journal_detail, gl_chart_of_account, gl_journal_book, ap_ar_trans | :59 → workflow.go:554 | Read; 1 MB |
| `workflow/gl-close` | พรีวิวหรือบันทึกรายการปิดบัญชีสิ้นงวด/สิ้นปี; บันทึกซ้ำได้ (เอกสารปิดเลขเดิมถูกแทนที่ใน transaction เดียวกัน) | `menuName`, `mode` (period/year), `periodNumber`, `accountYear`, `dateFrom`, `dateTo`, `docNo`, `docFormatCode`, `bookCode`, `closeToAccount`, `remark`, `save` | erp_account_period, gl_chart_of_account, gl_journal, gl_journal_detail, gl_journal_book | :66 → workflow.go:817 | Admin (permission.go:50); 1 MB |
| `workflow/fa-depreciation` | พรีวิว (`save:false`) หรือบันทึกเอกสารโอนค่าเสื่อมสินทรัพย์ (1801) พร้อมสมุดรายวัน; `delete:true` ลบเอกสาร | `menuName`, `dateBegin`, `dateEnd`, `processBy` (1 วัน/2 เดือน/3 ปี), `processMode` (0 สรรพากร/1 บัญชี/2 วันจริง), `fromAsCode`..`toAsType`, `docNo`, `docDate`, `docFormatCode`, `bookCode`, `branchCode`, `save`, `delete` | as_trans, as_trans_detail, as_asset, as_asset_detail, erp_account_period, erp_option, gl_chart_of_account | :73 → fa_depreciation.go:794 | `delete:true` = Delete, ไม่งั้น Write (permission.go:112-117); 1 MB |
| `workflow/asset-sale` | พรีวิว / บันทึก (เพิ่มหรือแก้ idempotent ตาม `docNo`) / ลบ เอกสารขายสินทรัพย์ (1802) | `menuName`, `op` (preview/save/delete), `docNo`, `oldDocNo`, `docDate`, `docFormatCode`, `bookCode`, `custCode`, `inquiryType`, `vatType`, `vatRate`, `creditDay`, `lines[]`, `wht[]` | as_trans_detail, as_asset, as_asset_detail, ar_customer_detail, ap_supplier, gl_chart_of_account, erp_option | :80 → fa_sale.go:382 | preview = Read, delete = Delete, อื่น = Write (permission.go:118-127); 1 MB |
| `workflow/ai-auto-gl` | เสนอรายการสมุดรายวันสมดุลจากคำอธิบายภาษาไทย + จำนวนเงิน (ใช้ `*big.Rat`) | `description`, `amount` (string ทศนิยม), `includeVat` | gl_chart_of_account | :159 → ai_copilot.go:1089 | ไม่อยู่ใน routeRights = **Admin**; 1 MB |
| `workflow/ai-bank-reconcile` | จับคู่รายการ statement ธนาคารกับ cb_chq_list, ap_ar_trans, ic_trans | `passBookCode`, `dateFrom`, `dateTo`, `statementLines[]` | cb_chq_list, ic_trans, ap_supplier, ar_customer | :138 → ai_copilot.go:494 | ไม่อยู่ใน routeRights = **Admin**; 1 MB |

หมายเหตุ: `workflow/audit-list` และ `workflow/change-code` อยู่ใน [[api-proc-actions-workflow]]; ตัวช่วยสต็อกที่ผูกกับ GL (`stock/rebuild`, `workflow/point-recal`) อยู่ใน [[api-proc-actions-stock]].

## รายละเอียดรายตัว

### gl/rebuild

- **Request**: `{"docNo":"<docNo>","transFlag":<transFlag>,"dateFrom":"2026-01-01","dateTo":"2026-12-31"}` (handler.go:90-95). ส่ง `docNo` = post ใหม่เฉพาะเอกสารที่เพิ่งบันทึก (ใช้หลังหน้าจอรายการค้า); ไม่ส่ง = ทั้งฐานตามช่วงวันที่ (ต้อง Admin)
- **Response 200**: `{"ok":true,"data":{"docsProcessed","journalsCreated","linesCreated","warnings":[...]}}` — `warnings` คือเอกสารที่ GL template engine ข้ามหรือส่งกลับไปใช้การลงบัญชีมาตรฐาน (service.go:60-66)
- **Errors**: 401 ไม่มี token; 403 สิทธิ์ไม่พอ (ข้อความไทย); 400 บอดี้เสีย; 500 ภายใน
- **ผู้เรียก**: `rebuildGl()` ที่ query-client.ts:105-114 (หลังบันทึกเอกสาร), `account/process/SystemProcessWorkbenchScreen.tsx:652` (ประมวลผลทั้งช่วง)

### gl/template-defaults และ gl/recurring

- `POST gl/template-defaults` บอดี้ `{"screenCode":"<screenCode>"}` → อาร์เรย์แถวเริ่มต้นของ `erp_doc_format_gl` (ผู้เรียก `account/master/DocFormatScreen.tsx:856`; ตาราง [[tbl-erp-doc-format-gl]])
- `POST gl/recurring` บอดี้ `{}` → อาร์เรย์เทมเพลต; ถ้า XML เดิมถอดไม่ได้ จะ log เตือนด้วย code ของเทมเพลตแล้วคืนแถวนั้นต่อ (gl_recurring_handler.go:13-23). ผู้เรียก `account/transaction/GlRecurringBar.tsx:23`

### workflow/journal-list, journal-pass, gl-check

- journal-list ต้องระบุช่วงวันที่ (YYYY-MM-DD) มิฉะนั้น 400 "ต้องระบุช่วงวันที่ (YYYY-MM-DD)" (workflow.go:444); journal-pass เลือก 1-5000 ใบ มิฉะนั้น 400 "ต้องเลือกใบสำคัญ 1-5000 ใบ" (workflow.go:488)
- ผลลัพธ์: journal-pass `{"journals":<n>,"detailLines":<n>}` (`journals` นับเฉพาะใบที่ `is_pass` เปลี่ยนจริง `workflow.go:515`); gl-check อาร์เรย์ `{check,detail,error}` ต่อข้อ (SystemProcessWorkbenchScreen.tsx:658,671)
- journal-list คืนต่อใบ `{docDate,docNo,bookCode,description,amount,isPass,remark,selectable}`; `remark` เรียงความสำคัญ "ไม่พบผังบัญชี" > "รหัสบัญชีผิดประเภท" > "ยอดไม่ Balance" > "ผ่านรายการแล้ว" และ `selectable=false` เมื่อเป็นสามข้อแรก (workflow.go:402-426); `undo:true` กรองเฉพาะ `is_pass = 1` (workflow.go:452-454); journal-pass แบบผ่านรายการ (ไม่ใช่ undo) ตรวจซ้ำฝั่งเซิร์ฟเวอร์ ใบที่ `selectable=false` ถูกปฏิเสธทั้งชุด (workflow.go:495-510) แต่แบบ undo ไม่ตรวจ
- ฝั่งหน้าจอ: โหมด `gl_journal_pass` ของ [[scr-system-process-workbench]] — เมนู 9009 ผ่านรายการ / 9022 ยกเลิกผ่านรายการ เรียก journal-list (`undo` = true เฉพาะ 9022) แล้วส่งใบที่ติ๊กไป journal-pass (`SystemProcessWorkbenchScreen.tsx:425-446`, `:666-674`) ส่วน 9008 ตรวจสอบความถูกต้อง เรียก gl-check (`:657-665`) หน้าจอไม่ให้ติ๊กใบที่ `selectable=false` ทั้งเมนูผ่านและเมนูยกเลิก (`:1712`)
- ตัวอย่าง:

```json
POST /api/v1/process/workflow/journal-pass     (Authorization: Bearer <token>)
{"menuName":"<menuKey>","docNos":["<docNo1>","<docNo2>"],"undo":false}
```

### workflow/gl-close

- **Request**: `{"menuName":"<menuKey>","mode":"period","periodNumber":<n>,"accountYear":<year>,"dateFrom":"...","dateTo":"...","docNo":"<docNo>","docFormatCode":"<code>","bookCode":"<bookCode>","closeToAccount":"<accountCode>","remark":"","save":false}`
- **Response 200**: `{"ok":true,"data":{"dateFrom","dateTo","docDate","profit","lines":[...],"totalDebit","totalCredit","saved"}}` — `profit` เป็น string, ติดลบ = ขาดทุน (workflow.go GLCloseResult). ตัวเลขทั้งหมดเป็น string ทศนิยม
- **ผู้เรียก**: `SystemProcessWorkbenchScreen.tsx:533`

### workflow/fa-depreciation และ asset-sale

- fa-depreciation: `processMode` เป็น pointer — ไม่ส่งใช้ค่า 1 (บัญชี); `processBy` ไม่ส่งใช้ 2 (เดือน). service ไม่เรียก `_checkOpenPeriod` จึงไม่ปฏิเสธงวดที่ปิดแล้ว ตามพฤติกรรม C# (fa_depreciation.go:794 doc). ผู้เรียก: `SystemProcessWorkbenchScreen.tsx:571,580`
- asset-sale: สถานะ "ขายแล้ว" คำนวณจากแถว 1802 ดังนั้นการลบเอกสารคืนสถานะสินทรัพย์ (fa_sale.go:382 doc). ผู้เรียก: `account/transaction/AssetSaleScreen.tsx:30` (`API = "/api/process/workflow/asset-sale"`)
- ตัวอย่าง asset-sale (ค่าสมมติ):

```json
POST /api/v1/process/workflow/asset-sale     (Authorization: Bearer <token>)
{"menuName":"<menuKey>","op":"preview","docNo":"<docNo>","docDate":"2026-01-31","custCode":"<custCode>",
 "vatType":0,"vatRate":"7","lines":[{"<field>":"<value>"}]}
```

### ai-auto-gl และ ai-bank-reconcile

- ไม่เรียก LLM ภายนอก; คำนวณด้วยกฎ + `*big.Rat`. ai-auto-gl คืน `{"description","totalDebit","totalCredit","confidence","reason","lines":[...]}` (ai_copilot.go:1060-1088)
- ผู้เรียก: `SystemProcessWorkbenchScreen.tsx:305` (ai-bank-reconcile), `:355` (ai-auto-gl) — เรียกผ่าน helper `workflow()` ที่ยิง `/api/process/workflow/<action>` และโยน error ถ้า `ok:false` (บรรทัด 34-38). เนื่องจากสองตัวนี้ต้อง Admin (ดูตาราง) ผู้ใช้ที่ไม่ใช่ Admin จะได้ 403

## Next whitelist

ทุก `workflow/*` ผ่าน `src/app/api/process/workflow/[action]/route.ts` ซึ่งมี `ACTIONS` ครบ 19 ตัว (บรรทัด 12-32); ชื่ออื่น = 404 `NOT_FOUND` "ไม่พบคำสั่ง". `gl/*` มี Next route แยกต่อ action ใต้ `src/app/api/process/gl/{rebuild,recurring,template-defaults}/` ไม่ใช้ `[action]`.

## ที่มาในโค้ด

- `backend/internal/adapter/inbound/http/router.go:131-133,172-174` (gl/rebuild, template-defaults, recurring)
- `backend/internal/adapter/inbound/http/process/handler.go:90-140` (rebuildGLRequest, RebuildGL)
- `backend/internal/adapter/inbound/http/process/gl_template_handler.go:12`; `gl_recurring_handler.go:12`
- `backend/internal/adapter/inbound/http/process/workflow_handler.go:18-30,45-90,138,159` (decode ≤ 1 MB, case ต่อ action)
- `backend/internal/adapter/inbound/http/process/permission.go:24-52,73-78,112-127`
- `backend/internal/application/process/service.go:50-66,1297-1331`; `gl_template_defaults.go:31,58`; `gl_recurring.go:15,42`
- `backend/internal/application/process/workflow.go:365,442,463,480,532,554,679,817`; `fa_depreciation.go:534,794`; `fa_sale.go:36,382`; `ai_copilot.go:438,494,1060,1089`
- `frontend/src/lib/query-client.ts:105-114`; `frontend/account/process/SystemProcessWorkbenchScreen.tsx:34-38,305,355,426,533,571,580,652,658,671`; `account/transaction/{AssetSaleScreen.tsx:30,GlRecurringBar.tsx:23}`; `account/master/DocFormatScreen.tsx:856`
