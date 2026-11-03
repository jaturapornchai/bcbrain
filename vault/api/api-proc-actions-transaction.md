---
title: "Process action กลุ่มเอกสาร/ธุรกรรม — trans, doc, lookup, cheque, tax, transgrid (Transaction process actions)"
tags: [api, process, transaction]
aliases: ["/process/trans/save","/process/trans/delete","/process/doc/save","/process/doc/delete","/process/doc/cancel","/process/doc/approve","/process/doc/bills","/process/doc/flow","/process/lookup/party-filter","/process/cheque/rebuild","/process/tax/rebuild","/process/transgrid/line","SaveTrans","SaveDoc","CancelDoc","DocFlow","TransGridLines"]
sources: ["backend/internal/adapter/inbound/http/router.go:134","backend/internal/adapter/inbound/http/process/handler.go:149","backend/internal/application/process/trans.go:267","backend/internal/application/process/docs.go:119","backend/internal/application/process/doc_cancel.go:120","backend/internal/application/process/trans_grid.go:129","backend/internal/adapter/inbound/http/process/permission.go:25","frontend/src/lib/query-client.ts:377"]
---

# Process action กลุ่มเอกสาร/ธุรกรรม

action ทั้งหมดอยู่ใต้ `/process/*` และ `/api/v1/process/*` ([[api-process-run]] — สิทธิ์ ขนาดบอดี้ envelope `{"ok":true,"data":...}` ใช้เหมือนกัน). provider/ฐาน/ผู้ใช้มาจาก token ไม่ใช่บอดี้. ค่าเงิน/จำนวนใน JSON เป็น **สตริงทศนิยม** (`^-?\d{1,15}(\.\d+)?$`, trans.go:28) ตามกฎ ACCOUNTING NUMBER. ความหมายธุรกิจดู [[proc-dispatcher]], [[proc-doc-cancel-approve]], [[proc-doc-flow-numbering]], [[proc-grid-calc]], [[proc-lookup-filters]].

## trans/* — เอกสารสินค้า (ic_trans)

| action | หน้าที่ | input สำคัญ | ตาราง | path:line |
|---|---|---|---|---|
| `trans/save` | ตรวจ-แทนที่แถวดิบ ic_trans/ic_trans_detail แล้ว rebuild สต็อกและ GL ของเอกสาร ใน transaction เดียว | `isNew`, `docNo`, `docDate`, `transFlag`, `custCode`, `branchCode`, `vatType`, `vatRate`, `lines[]`, `pay`, `deposits[]` | ic_trans, ic_trans_detail, ic_trans_shipment, ap_ar_trans_detail, ic_inventory, gl_journal, gl_journal_detail | handler.go:149 -> trans.go:267 |
| `trans/delete` | ลบแถวดิบของเอกสารแล้ว rebuild สต็อก/GL (ไม่ทิ้งยอดค้าง) | `docNo`, `transFlag` | ic_trans, ic_trans_detail, ic_trans_serial_number, cb_trans, cb_trans_detail, cb_chq_list, gl_journal* | handler.go:160 -> trans.go:382 |
| `trans/deposits` | รายการมัดจำที่ยังมียอดคงเหลือของคู่ค้า (+ที่บิลนี้ใช้อยู่) | `transFlag`, `custCode`, `docNo` | ic_trans, cb_trans_detail | deposit_handler.go:12 -> trans_deposit.go:203 |
| `trans/party-defaults` | ค่าเริ่มต้นของลูกค้า/ผู้ขายที่ใส่หัวบิล (เครดิตวัน, ประเภทราคา ฯลฯ) | `transFlag`, `custCode`, `inquiryType`, `partyType`, `docDate`, `creditDay` | ar_customer(+_detail), ap_supplier(+_detail), erp_option, erp_user | party_handler.go:12 -> trans_party.go:75 |

รายละเอียด `trans/save`:

- แกนบังคับ: `docNo` และ `transFlag` ต้องมี (ขาด = 400 "กรุณาระบุเลขที่เอกสารและประเภทเอกสาร", trans.go:385); `isNew:true` ใช้สิทธิ์ Add ไม่งั้น Edit ([[api-process-run]])
- `lines[]` (`TransLine`, trans.go:32): `itemCode`, `unitCode`, `whCode`, `shelfCode`, `qty`, `price`, `discount` (คำส่วนลด เช่น `"5%"`), `discountAmount`, `sumAmount`, `taxType`, `serials[]`, `lotNumber1`, `refDocNo` ฯลฯ — ตัวเลขเป็นสตริง
- ขั้นตอนฝั่ง service (trans.go:267-298): หาสาขา -> เงื่อนไขเงินสด/ชำระ (`cashSaleTerms`, `payBillTerms`) -> lot อัตโนมัติ -> normalize แถวสินค้า (VAT, FX) -> สร้าง args -> `checkAndSaveTransTx` (ตรวจหน้าจอ/เลขภาษี/สินค้าค้าง/อ้างอิง แล้วบันทึกพร้อม rebuild)
- ผลลัพธ์ `data`: `{docNo, stock:{itemsProcessed,rowsUpdated}, gl:{docsProcessed,journalsCreated,linesCreated,warnings[]}, transferInRows?, chequeStatuses?}` (`TransResult`, trans.go:257)

```json
POST /api/v1/process/trans/save      Authorization: Bearer <token>
{"isNew":true,"docNo":"<docNo>","docDate":"<YYYY-MM-DD>","transFlag":<transFlag>,"custCode":"<custCode>","branchCode":"<branchCode>",
 "vatType":0,"vatRate":"7",
 "lines":[{"itemCode":"<itemCode>","unitCode":"<unitCode>","whCode":"<whCode>","shelfCode":"<shelfCode>","qty":"1","price":"100.00","sumAmount":"100.00"}]}
```

## doc/* — เอกสารนอก ic_trans และสถานะเอกสาร

| action | หน้าที่ | input สำคัญ | ตาราง | path:line |
|---|---|---|---|---|
| `doc/save` | บันทึกเอกสาร 1 ใบที่ไม่ใช่ ic_trans (`kind` = `ap_ar_trans` หรือ `gl_journal`; `cb_chq_list` ดูอย่างเดียว) บันทึกซ้ำได้ผลเดิม (idempotent) | `kind`, `isNew`, `docNo`, `docDate`, `transFlag`, `custCode`, `lines[]`, `bills[]`, `pay`, `glLines[]` (`accountCode`,`debit`,`credit`), `vatBuy`, `vatSale`, `whtIn`, `whtOut` | ap_ar_trans(+_detail), gl_journal(+_detail), cb_trans(+_detail), cb_chq_list, gl_journal_vat_buy/sale, gl_wht_list(+_detail) | handler.go:170 -> docs.go:119 |
| `doc/delete` | ลบเอกสารชนิดเดียวกัน แล้วคืนสถานะที่เกี่ยวข้อง | `kind`, `docNo`, `transFlag` | ตารางเดียวกับ doc/save | handler.go:181 -> docs.go:166 |
| `doc/cancel` | สร้างเอกสารยกเลิกแยกใบ (หรือ `undo:true` = ลบ) แล้ว derive `last_status` ของต้นฉบับ + rebuild สต็อก GL เช็ค | `flag`, `origFlag`, `docRef`, `docDate`, `remark`, `undo`, `cancelType` (1 ทั้งใบ / 2 รายสินค้า), `lines[]`, `cancelDocNo` | ic_trans, ic_trans_detail, ap_ar_trans, cb_trans_detail, gl_journal | doc_cancel_handler.go:12 -> doc_cancel.go:120 |
| `doc/approve` | สร้าง/ลบเอกสารอนุมัติ (`notApprove:true` = ไม่อนุมัติ) แล้ว derive `approve_status`; ไม่ขยับสต็อก/GL | `flag`, `origFlag`, `docRef`, `undo`, `notApprove`, `approveLines[]` (PR) | ic_trans, ic_trans_detail, ap_ar_trans | doc_cancel_handler.go:17 -> doc_cancel.go:205 |
| `doc/bills` | รายการเอกสารหนี้ค้างของคู่ค้าสำหรับกริดวางบิล/รับ-จ่ายชำระ | `transFlag`, `custCode`, `docDate`, `docNo` | ap_ar_trans_detail, erp_option | bills_handler.go:12 -> docs.go:628 |
| `doc/flow` | สร้างกราฟ Document Flow ต้นทาง-ปลายทางแบบหลายต่อหลายของเอกสาร | `docNo`, `transFlag`, `kind` | ic_trans(+_detail), ap_ar_trans(+_detail), cb_trans_detail, cb_chq_list, gl_journal(+_detail) | bills_handler.go:27 -> doc_flow_graph.go:269 |

หมายเหตุ: `doc/cancel` รับ flag ยกเลิกเฉพาะที่ผูกกับต้นฉบับใน `cancelOrigFlags` (doc_cancel.go:49) เช่น 3->2, 7->6, 31->30; `doc/*` ใช้ขีดบอดี้ 16 MB เหมือน `trans/*`.

## lookup/* — ตัวกรองรายการค้นหา (สร้าง WHERE ฝั่งเซิร์ฟเวอร์)

เหตุผล: กฎสาขา/คลังขึ้นกับ `erp_option` และแถว `erp_user` ของผู้ล็อกอิน ซึ่งเบราว์เซอร์ต้องไม่ตัดสินเอง. ทุกตัวคืน `{where, columns?}` ให้หน้าจอเอาไปต่อกับ `SELECT` ของตนผ่าน [[api-query-gateway]].

| action | หน้าที่ | input สำคัญ | ตาราง | path:line |
|---|---|---|---|---|
| `lookup/party-filter` | WHERE รายชื่อลูกหนี้/เจ้าหนี้ที่เลือกได้ (ลูกค้าจำกัดตามสาขาผู้ใช้) | `side` (`ar`/`ap`), `withBranch` | ar_customer, ap_supplier, erp_option, erp_user | lookup_handler.go:13 -> lookup_party.go:46 |
| `lookup/ref-doc-filter` | WHERE รายการเอกสารอ้างอิงของ ic_trans | `transFlag`, `custCode`, `vatType` | ic_trans, ap_ar_trans, erp_option | lookup_trans_handler.go:13 -> lookup_trans.go:92 |
| `lookup/wh-filter` | WHERE คลัง/ชั้นเก็บของหัวบิลและกริด ตามสาขาและสิทธิ์ผู้ใช้ | `transFlag`, `branchCode` | ic_warehouse, erp_branch_list, erp_user_group_wh_shelf | lookup_trans_handler.go:20 -> lookup_trans.go:119 |
| `lookup/wh-pick-check` | ตรวจว่าคลัง/ชั้นที่เลือกจากฟอร์มยอดคงเหลือ (perm_wh_shelf=1) อนุญาตหรือไม่ | `itemCode`, `whCode`, `shelfCode` | ic_wh_shelf, erp_user_group_wh_shelf | lookup_trans_handler.go:27 -> perm_wh_shelf.go:118 |
| `lookup/wh-perm-filter` | WHERE คลังตามกลุ่มผู้ใช้ | `transFlag`, `branchCode` | ic_warehouse, erp_user_group_detail | lookup_trans_handler.go:34 -> perm_wh_shelf_rest.go:25 |

## cheque/* และ tax/rebuild

| action | หน้าที่ | input สำคัญ | ตาราง | path:line |
|---|---|---|---|---|
| `cheque/candidates` | รายการเช็คที่หน้าจอเลือกได้ กรองตามสถานะ | `transFlag`, `custCode`, `passBookCode`, `search` | cb_chq_list, ic_trans_detail, ap_supplier, ar_customer | cheque_handler.go:30 -> cheque.go:266 |
| `cheque/rebuild` | ซิงก์คู่โอน (เมื่อมี `docNo`) แล้ว rebuild สถานะเช็ค ใน transaction เดียว (Admin) | `docNo`, `chqNumbers[]` | cb_chq_list, ic_trans, ic_trans_detail, gl_journal | cheque_handler.go:15 -> cheque.go:329 |
| `tax/rebuild` | สร้างแถวทะเบียน VAT ซื้อ/ขายของเอกสาร ic_trans/as_trans ใหม่จากหัวเอกสาร และลบแถว VAT/WHT ที่เอกสารหายไป (Admin, idempotent) | ไม่ต้องส่ง (`providerCode`/`databaseName` ถูกเขียนทับด้วยค่าจาก token โดย `decodeCheque`, cheque_handler.go:53; Next ยังใส่ให้จาก session) | gl_journal_vat_buy, gl_journal_vat_sale, cb_trans_detail, ic_trans, as_trans | tax_handler.go:12 -> trans_tax.go:252 |

## transgrid/* — คำนวณกริดรายการสินค้า (ไม่เขียนข้อมูล)

ทุก action ใช้สิทธิ์ Read, ขีดบอดี้ 1 MB, คืนผลคำนวณให้หน้าจอแสดง (พอร์ตจาก C# `_icTransControl`).

| action | หน้าที่ | input สำคัญ | ตาราง | path:line |
|---|---|---|---|---|
| `transgrid/line` | ผลการแก้ 1 เซลล์ของกริด (ราคา หน่วย คลัง ส่วนลด การตรวจ) | `transFlag`, `docDate`, `custCode`, `vatType`, `vatRate`, `inquiryType`, `currencyCode`, `branchCode`, `creditDay`, `whFrom`, `locationFrom`, `whTo`, `locationTo`, `prev*`, `changed`, `lines[]` (ผล: `GridLineResult` มี `line`,`error`,`warnings`,`confirm`) | ic_inventory(+_barcode), erp_option, ar_customer_detail | transgrid_handler.go:28 -> trans_grid.go:129 |
| `transgrid/formula` | หน้าต่างสูตรราคา (Ctrl+3): ทุกแถวสูตรของสินค้าตามหน่วย พร้อมราคาแต่ละระดับ | `itemCode`, `custCode` | ic_inventory_price_formula, ar_customer | :36 -> trans_grid.go:730 |
| `transgrid/totals` | ยอดรวมหัวบิลที่ `trans/save` จะเก็บ (ตาม erp_option: ส่วนลด VAT ปัดเศษ) | ฟิลด์เดียวกับ `trans/save` | erp_option | :42 -> trans.go:756 |
| `transgrid/shortcut` | ประเมินค่าที่พิมพ์ลัด (จำนวน/ราคา/`=สูตร`) | `transFlag`, `field`, `text` | erp_option | :48 -> grid_shortcut.go:46 |
| `transgrid/priceinfo` | ตารางราคาอ่านอย่างเดียวของสินค้า | `itemCode`, `custCode` | ar_customer_detail, ar_group, ic_unit | :54 -> price_info.go:66 |
| `transgrid/fx` | สวิตช์หลายสกุลเงินและอัตราแลกเปลี่ยน | `transFlag`, `currencyCode`, `bills` | erp_currency, erp_option | :60 -> fx.go:91 |
| `transgrid/refimport` | ดึงแถวสินค้าจากเอกสารอ้างอิงเข้ากริด | `docNo`, `refDocs[]`, `reload` + ฟิลด์ของ `line` | ic_trans, ic_inventory, ic_wh_shelf | :66 -> trans_ref_import_lines.go:107 |

(คอลัมน์ตารางแสดงเฉพาะตารางหลักที่ service และตัวช่วยของมันแตะ ไม่ใช่ทุกตาราง)

## Errors โดยรวมของกลุ่มนี้

400 บอดี้ผิดรูป/เกินขีด/ข้อมูลไม่ผ่านการตรวจ (ข้อความไทยจาก service), 401 token, 403 สิทธิ์ไม่พอ, 404 action ไม่รู้จัก (เฉพาะกลุ่ม `{action}`), 409 ข้อขัดแย้งของข้อมูล, 500 ข้อความกลาง — รูป `{"error":{"message":"..."}}` ([[be-error-response-shape]]).

## ผู้เรียกฝั่งหน้าเว็บ (หนึ่งบรรทัดต่อ action)

- `trans/save` — `saveTrans` `src/lib/query-client.ts:377`; `trans/delete` — `deleteTrans` :683; `trans/deposits` — :558; `trans/party-defaults` — :598
- `doc/save` — `saveDoc` query-client.ts:775; `doc/delete` — :797; `doc/bills` — :785; `doc/cancel` และ `doc/approve` — เรียกผ่าน path แบบ `${action}` ที่ :820; `doc/flow` — `account/transaction/DocumentFlowModal.tsx:161`
- `lookup/*` — query-client.ts:607 (ref-doc), :626 (wh-filter), :636 (wh-pick-check), :644 (wh-perm-filter), :652 (party-filter)
- `cheque/candidates` — `account/transaction/ChequePickerModal.tsx:102`; `cheque/rebuild` และ `tax/rebuild` — ไม่พบผู้เรียกในหน้าจอ (มี Next route เท่านั้น: `src/app/api/process/cheque/[action]/route.ts`, `tax/rebuild/route.ts`)
- `transgrid/*` — query-client.ts:444 (totals), :450 (line), :468 (formula), :484 (shortcut), :519 (priceinfo), :540 (fx), :673 (refimport)
- หน้าจอที่ใช้: [[fe-transaction-screens]], [[fe-transaction-menu-purchase-sale-stock]], [[fe-transaction-menu-debt-cashbank]]

## ที่มาในโค้ด

- `backend/internal/adapter/inbound/http/router.go:134-153`
- `backend/internal/adapter/inbound/http/process/handler.go:149-221`; `bills_handler.go:12,27`; `deposit_handler.go:12`; `party_handler.go:12`; `doc_cancel_handler.go:12,17`; `lookup_handler.go:13`; `lookup_trans_handler.go:13-40`; `cheque_handler.go:15,30`; `tax_handler.go:12`; `transgrid_handler.go:20-75`
- `backend/internal/application/process/trans.go:28,32,101,257,267,382,756`; `docs.go:35,119,166,628`; `doc_cancel.go:23,120,205`; `doc_flow_graph.go:269`; `trans_deposit.go:203`; `trans_party.go:75`; `lookup_party.go:46`; `lookup_trans.go:92,119`; `perm_wh_shelf.go:118`; `perm_wh_shelf_rest.go:25`; `cheque.go:266,329`; `trans_tax.go:252`; `trans_grid.go:129,730`; `grid_shortcut.go:46`; `price_info.go:66`; `fx.go:91`; `trans_ref_import_lines.go:107`
- `backend/internal/adapter/inbound/http/process/permission.go:25-52,54-128`
- `frontend/src/lib/query-client.ts:377-820`
