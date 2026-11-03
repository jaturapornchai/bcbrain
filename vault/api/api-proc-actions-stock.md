---
title: "API สต็อกสินค้า (Process stock actions: stock/rebuild, stocktools/*, point-recal, check-ic-trans, ai-smart-reorder)"
tags: [api, process, stock]
aliases: ["/api/v1/process/stock/rebuild","/api/v1/process/stocktools/{action}","stock/rebuild","stocktools","docnonext","serialcountsave","lotamountsave","lotautorun","notcountedrun","hiddencostsave","stockbeginningsave","pointdocsave","checkpricesave","point-recal","check-ic-trans","ai-smart-reorder"]
sources: ["backend/internal/adapter/inbound/http/router.go:130","backend/internal/adapter/inbound/http/router.go:162","backend/internal/adapter/inbound/http/process/handler.go:19","backend/internal/adapter/inbound/http/process/handler.go:41","backend/internal/adapter/inbound/http/process/stocktools_handler.go:23","backend/internal/adapter/inbound/http/process/stocktools_handler.go:89","backend/internal/adapter/inbound/http/process/permission.go:24","backend/internal/adapter/inbound/http/process/permission.go:68","backend/internal/application/process/service.go:559","backend/internal/application/process/stock_tools.go:49","backend/internal/application/process/stock_lot.go:347","backend/internal/application/process/sysproc_tools.go:47"]
---

# API สต็อกสินค้า (stock/rebuild, stocktools/*, workflow สต็อก)

กลุ่ม action ที่คำนวณยอดคงเหลือ/ต้นทุนเฉลี่ย ตรวจนับ ปรับยอดล็อต ต้นทุนแฝง ยอดยกมา และคะแนนสะสม. ทุกตัวเป็น `POST /api/v1/process/<group>/<action>` (และ `/process/...` ชื่อซ้ำ) ต้อง `Authorization: Bearer <token>`; envelope `{"ok":true,"data":...}`; error `{"error":{"message"}}`; `ProviderCode`/`DatabaseName`/`UserCode` เติมจาก claims เสมอ. ภาพรวมที่ [[api-process-run]]; แนวคิด [[acc-inventory-stock-rebuild]], [[acc-inventory-cost-moving-average]], [[acc-stock-special-docs]], [[proc-stock-tools]], [[proc-hidden-cost]], [[proc-sysproc-tools]], [[proc-ai-copilot]].

## stock/rebuild

- **เมธอด + path**: `POST /api/v1/process/stock/rebuild` (router.go:130, 171)
- **สิทธิ์**: `itemCodes` ไม่ว่าง (rebuild เฉพาะสินค้าที่เพิ่งบันทึก) = Write; ทั้งฐาน = Admin (permission.go:68-73). บอดี้ ≤ 16 MB; ถ้า `Content-Length` เป็น 0 ใช้ค่าว่างทั้งหมดได้ (handler.go:49)
- **Request** (handler.go:32-38):

```json
POST /api/v1/process/stock/rebuild     (Authorization: Bearer <token>)
{"itemCodes":["<itemCode>"],"processCommand":"","updateUnitRatio":true,"action":"","flowCommand":""}
```

- **action** (`rebuildStockWithOptionsTx` service.go:588-627): ค่าว่าง = คำนวณ `ic_inventory.balance_qty` + ต้นทุนเฉลี่ยเคลื่อนที่ (`sum_of_cost`, `average_cost`) ใหม่ทุก/บางสินค้า พร้อม backfill การโอนคลังและ `updateUnitRatio` (ค่าเริ่มต้น true) ปรับ stand_value/divide_value; `update_trans_detail` = ปรับ ic_trans_detail; `recheck_trans_flow` / `recheck_doc_flow` (ใช้ `flowCommand`) = ตรวจกระแสเอกสารใหม่; `check_so_doc_success` = คำนวณ `doc_success` ของใบสั่งขาย (flag 36) จากจำนวนที่ใบ 37/44 อ้างอิง (`checkSODocSuccessTx` service.go:705-724). `flowCommand` รับ 4 รูปแบบ (service.go:742-786): `SELECT ...` (อ่านอย่างเดียว ใช้คอลัมน์แรกเป็นเลขที่เอกสาร), `docno=<เลขที่>`, `จาก:ถึง` (ช่วง `doc_no`) หรือรายการคั่นด้วย `,`. ทั้งหมดอยู่ใน transaction เดียว timeout 60 วินาที (service.go:565)
- **Response 200**: `{"ok":true,"data":{"itemsProcessed":<n>,"rowsUpdated":<n>}}` (service.go:44-47). `processCommand` ที่กรองแล้วไม่เหลือสินค้า = คืน `itemsProcessed:0` (มี `rowsUpdated` ของการปรับอัตราส่วนหน่วย)
- **ตาราง**: erp_option, ic_trans_detail, ic_trans, ic_inventory, cb_trans, cb_trans_detail, ap_ar_trans, ap_ar_trans_detail, ic_unit_use
- **ผู้เรียก**: `rebuildStock()` ที่ query-client.ts:72 (หลังบันทึกเอกสารสต็อก ส่ง `itemCodes`), `account/process/SystemProcessWorkbenchScreen.tsx:624` (ส่ง `processCommand`, `updateUnitRatio`, `action`, `flowCommand`); Next route `src/app/api/process/stock/rebuild`

## stocktools/{action} — 23 action

`serve()` generic (stocktools_handler.go:23-37) ถอดบอดี้ด้วย `decodeLimited`, เติม scope จาก claims, เรียก service, ตอบ `{"ok":true,"data":...}`. ค่า `small` ของกลุ่มนี้ = 4 MB (stocktools_handler.go:90); action ที่ไม่รู้จัก = 404. Next route `src/app/api/process/stocktools/[action]/route.ts:12` มี whitelist ครบ 23.

| action | หน้าที่ | input สำคัญ | ตาราง | path:line | สิทธิ์ / บอดี้ |
|---|---|---|---|---|---|
| `formats` | รูปแบบเลขที่เอกสารของจอ (ตัวเลือก doc format) | `screenCodes[]` | erp_doc_format, erp_doc_format_gl | handler:92 → stock_tools.go:49 | Read / 4 MB |
| `docnonext` | เลขที่เอกสารถัดไป (ล็อก advisory ต่อ prefix เหมือนจอยกเลิก/นับ) | `table`, `transFlag`, `formatCode`, `screenCode`, `docDate` | erp_doc_format, erp_doc_format_gl | :164 → doc_no_next.go:59 | Read / 4 MB |
| `barcodecheck` | ค้นบาร์โค้ดที่วาง/นำเข้าใน ic_inventory_barcode (อ่านอย่างเดียว คงลำดับ input) | `barcodes[]` | ic_inventory_barcode, ic_inventory | :96 → stock_tools.go:104 | Read / 4 MB |
| `serialanalyze` | ตรวจประวัติเคลื่อนไหวของเลขซีเรียลทุกตัวของสินค้า | `itemCode` | ic_trans_serial_number, ic_trans | :100 → stock_tools.go:219 | Read / 4 MB |
| `serialscan` | แปลงเลขซีเรียลที่สแกนเป็นสินค้า | `serialNumber` | ic_serial, ic_inventory, ic_unit_use | :104 → stock_tools.go:280 | Read / 4 MB |
| `serialcountsave` | บันทึกใบนับสต็อกตามซีเรียล (ic_trans flag 76 + detail + ซีเรียล; server อ่านซีเรียลจาก ic_serial ซ้ำ) | `docNo`, `docDate`, `docTime`, `docFormatCode`, `docRef`, `remark`, `whCode`, แถวซีเรียล | ic_trans_detail, ic_trans_serial_number, ic_serial, ic_shelf, erp_option | :108 → stock_tools.go:354 | Write / 8 MB |
| `lotamountload` | โหลดล็อตสำหรับปรับมูลค่า | `dateEnd`, `itemFrom`, `itemTo` | ic_trans_detail_lot, ic_inventory | :112 → stock_lot.go:347 | Read / 4 MB |
| `lotamountsave` | สร้างเอกสารปรับมูลค่าล็อตที่ติ๊ก (server คำนวณยอดเองจาก ic_trans_detail_lot ไม่เชื่อยอดจากหน้าจอ) | `dateEnd`, `itemFrom`, `itemTo`, `docFormatCode`, `downDocFormatCode`, `keys[]` | ic_trans, ic_trans_detail_lot, ic_trans_serial_number, erp_doc_format(+_gl) | :116 → stock_lot.go:387 | Write / 8 MB |
| `hiddencostcalc` | ปุ่ม "ประมวลผล" ต้นทุนแฝง/Landed Cost: พรีวิวการปันส่วน ไม่เขียน | `calFrom` (0-1), `calFollow` (0-3), `expenses[]`/`purchases[]` (`{refType, docNo}`), ค่านำเข้าตรง `transportValue`/`insuranceAmount`/`importDutyAmount`/`clearancePortAmount`, `customsEntryNo`, `vesselContainerNo`, `incoterms`, `currencyCode`, `exchangeRate` (เก็บ/ส่งกลับเท่านั้น ไม่คูณยอด; ฟิลด์หัวเอกสารไม่ถูกใช้) → คืน `totalAmount`, `hiddenCostAmount`, `items[]` (`ratio`, `sumTotalAmount`, `averageCost`) | ic_trans, ic_trans_detail, ic_inventory | :120 → hidden_cost.go:372 | Read / 4 MB |
| `hiddencostsave` | คำนวณซ้ำแล้วเขียนเอกสารต้นทุนแฝง + เอกสารปรับ flag 66 ใน transaction เดียว (แก้ = ลบคู่เดิมก่อน; เพิ่มคอลัมน์นำเข้าด้วย `ADD COLUMN IF NOT EXISTS` ทุกครั้งภายใน transaction เดียวกัน hidden_cost.go:462) | ฟิลด์ของ calc + `docNo`, `oldDocNo`, `docDate`, `docTime`, `docFormatCode`, `branchCode`, `remark`, `docNoAdjust`, `docFormatCodeAdjust` | ic_hidden_cost_process(_ref/_item), ic_trans, ic_trans_detail, erp_company_profile, erp_branch_list | :124 → hidden_cost.go:443 | Write / 4 MB |
| `hiddencostdelete` | ลบเอกสารต้นทุนแฝงและเอกสารปรับ แล้ว rebuild สินค้าที่เกี่ยวข้อง | `docNo` | ic_hidden_cost_process(_ref/_item), ic_trans, ic_trans_detail, ic_trans_serial_number, ic_trans_shipment, cb_trans_detail | :128 → hidden_cost.go:591 | Delete / 4 MB |
| `lotautolist` | รายการใบนับสต็อกที่ใช้ปรับล็อตอัตโนมัติ | `dateBegin`, `dateEnd`, `showAll` | ic_trans, ap_ar_trans_detail | :132 → stock_lot.go:481 | Read / 4 MB |
| `lotautocheck` | บรรทัดสินค้าของใบนับที่เลือก (ค่าเริ่มต้นกรองเฉพาะสินค้านับซ้ำ) | `docNos[]`, `onlyDuplicate` | ic_trans_detail, ic_inventory_barcode, ic_inventory, ic_inventory_detail, ic_wh_shelf | :136 → stock_lot.go:552 | Read / 4 MB |
| `lotautorun` | แปลงผลต่างใบนับกับยอดบัญชีเป็นเอกสารปรับ (66 เพิ่ม / 68 ลด) และทำเครื่องหมายใบนับ | `docNos[]`, `docFormatCode`, `downDocFormatCode`, `ignoreLot` | ic_trans, ic_trans_detail, ic_trans_detail_lot, ap_ar_trans_detail, erp_account_period, gl_journal | :140 → stock_lot.go:617 | Write / 4 MB |
| `notcountedlist` | สินค้าในคลังที่เลือกซึ่งไม่ถูกนับใน `docNos` แต่ยอดไม่เป็นศูนย์ | `docNos[]`, `dateEnd`, `docTime`, `whCodes[]`, `docFormatCode`, `downDocFormatCode` | ic_trans_detail, ic_inventory | :144 → stock_lot.go:883 | Read / 4 MB |
| `notcountedrun` | สร้างเอกสารปรับ (66/68) เพื่อล้างยอดสินค้าที่ไม่ได้นับ | ฟิลด์เดียวกับ list | ic_trans, ic_trans_detail, ic_inventory, erp_doc_format(+_gl) | :148 → stock_lot.go:901 | Write / 4 MB |
| `itemnextcode` | รหัสสินค้าถัดไปที่หน้าจอใส่ให้หลังออกจากช่องรหัส | `code`, `date` | erp_doc_format, ic_inventory, erp_doc_format_gl | :152 → stock_tools.go:652 | Read / 4 MB |
| `stockbeginningsave` | บันทึกเอกสารยอดยกมา (ซ้ำได้) แล้ว rebuild สต็อก/ต้นทุน/ซีเรียลของสินค้าที่แตะ; ล้มเหลว = rollback ทั้งหมด | `isNew`, `docNo`, `docDate`, `docTime`, `docFormatCode`, `docRef`, `whFrom`, แถวสินค้า | ic_trans, ic_trans_detail, ic_inventory, erp_company_profile, erp_branch_list | :156 → stock_beginning.go:307 | **Add** (isNew) / **Edit** / 24 MB |
| `stockbeginningdelete` | ลบเอกสารยอดยกมาและสิ่งที่ลงไว้ แล้วคำนวณสต็อก/ซีเรียลใหม่ | `docNo` | ic_trans, ic_trans_detail, ic_trans_serial_number, gl_journal(+_detail), ic_trans_detail_lot | :160 → stock_beginning.go:356 | Delete / 4 MB |
| `checkpricesave` | เปลี่ยนราคาบาร์โค้ด (transaction เดียว เก็บราคาเดิมใน log) | `barcode`, `newPrice` (string ทศนิยม) | ic_inventory_barcode, erp_option | :168 → check_price.go:48 | Write / 4 MB |
| `pointdocsave` | เพิ่ม/แก้หัวเอกสารคะแนน 801/802 (ล็อกเอกสารกันบันทึกพร้อมกัน) | `transFlag`, `isNew`, `docNo`, `docDate`, `docFormatCode`, `custCode`, `sumPoint`, `remark` | ar_customer, ic_trans, erp_company_profile, erp_branch_list | :172 → point_doc.go:92 | **Add** (isNew) / **Edit** / 4 MB |
| `pointdocdelete` | ลบหัวเอกสาร 801/802 ใน transaction เดียว | `transFlag`, `docNos[]` | ic_trans, erp_option, ic_trans_detail | :176 → point_doc.go:160 | Delete / 4 MB |
| `itemsaved` | รีเฟรชคอลัมน์สินค้าที่คำนวณและยอดคงเหลือของสินค้าที่เพิ่งบันทึก | `itemCode` | ic_inventory, ic_inventory_detail, ic_trans_detail | :180 → stock_tools.go:530 | Write / 4 MB |

คอลัมน์ path ใช้ `:<บรรทัด>` = บรรทัดของ `case` ใน `stocktools_handler.go`. เพดาน 8 MB ของ `serialcountsave`/`lotamountsave` อยู่ที่ stocktools_handler.go:109,117 และ 24 MB ของ `stockbeginningsave` ที่ :157.

- ตัวอย่าง:

```json
POST /api/v1/process/stocktools/docnonext     (Authorization: Bearer <token>)
{"table":"ic_trans","transFlag":<transFlag>,"formatCode":"<formatCode>","docDate":"2026-01-31"}
```

→ `{"ok":true,"data":{"docNo":"<docNo>","docFormatCode":"<formatCode>"}}` (ผู้เรียก `src/lib/doc-no.ts:21` ซึ่งมี consumer ทั้งจอรายการค้าและยกเลิกเอกสาร)

- **ผู้เรียกฝั่งหน้าเว็บ** (ทั้งหมดผ่าน Next `/api/process/stocktools/<action>`): `account/master/StockToolBits.tsx:27` (formats), `StockCheckScreens.tsx:49,120` (barcodecheck, serialanalyze), `SerialStockCountScreen.tsx:100,152` (serialscan, serialcountsave), `LotAdjustScreens.tsx:119,140,326,351,589,602,646,663` (lotamount*, notcounted*, lotauto*), `HiddenCostScreen.tsx:199,213,227` (hiddencost*), `IcExtraScreens.tsx:647` (checkpricesave), `StandardMasterScreen.tsx:550,758` (pointdoc*), `account/transaction/StockBeginningBalanceScreen.tsx:1610,1696` (stockbeginning*), `query-client.ts:83` (itemnextcode). `itemsaved` ไม่มี caller ใน `frontend/src`/`frontend/account` (มีแต่ใน whitelist ของ Next route).

## workflow ที่เกี่ยวกับสต็อก

บอดี้ทุกตัว ≤ 1 MB (workflow_handler.go:25); ทุกตัวผ่าน `src/app/api/process/workflow/[action]`.

| action | หน้าที่ | input สำคัญ | ตาราง | path:line | สิทธิ์ |
|---|---|---|---|---|---|
| `workflow/point-recal` | คำนวณคะแนนสะสมใหม่จากการขาย POS (flag 44, `is_pos=1`, ไม่ยกเลิก) ในช่วงวันที่; เอกสาร 801/802 ที่คีย์มือไม่ถูกแตะ | `dateFrom`, `dateTo` | erp_option, ic_trans, sum_point, pos_point_period, ic_trans_detail, ic_inventory_detail, cb_trans | workflow_handler.go:101 → sysproc_tools.go:152 | Write (permission.go:51) |
| `workflow/check-ic-trans` | นับแถวที่แต่ละการตรวจพบ (รายการตรวจอยู่ใน `sysproc_ic_checks_data.go`) และเมื่อ `apply:true` รันคำสั่งซ่อมของการตรวจนั้น (แยก savepoint ต่อการตรวจ) | `apply`, `indexes[]` | (ตามคำสั่งตรวจ/ซ่อมแต่ละข้อ) | :94 → sysproc_tools.go:47 | `apply:false` = Read, `apply:true` = Admin (permission.go:96-101) |
| `workflow/ai-smart-reorder` | แนะนำการสั่งซื้อซ้ำจากยอดคงเหลือสุทธิ หน่วยมาตรฐานและหน่วยขนาน (`*big.Rat`, ไม่เรียก LLM) | `onlyParallel` | ic_opposite_unit, ic_trans_detail, ic_trans, ic_inventory | :152 → ai_copilot.go:945 | ไม่อยู่ใน routeRights = **Admin** |

- ผลลัพธ์: point-recal `{"docs":<n>,"updated":<n>}`; check-ic-trans อาร์เรย์ `{index,name,auto,repairable,count,updated,error?}` (ถ้า `apply:true` ไม่ส่ง `indexes` ซ่อมเฉพาะการตรวจที่ตั้ง `auto: true`); ai-smart-reorder `{totalItemsAnalyzed,parallelItemsCount,needReorderCount,items[]}`
- ผู้เรียก: `SystemProcessWorkbenchScreen.tsx:483` (check-ic-trans นับ), `:705` (ซ่อม), `:710` (point-recal), `:339` (ai-smart-reorder)

## ที่มาในโค้ด

- `backend/internal/adapter/inbound/http/router.go:126-208` (route ทั้งสอง prefix)
- `backend/internal/adapter/inbound/http/process/handler.go:19,32-88` (maxJSONBody, rebuildStockRequest, RebuildStock)
- `backend/internal/adapter/inbound/http/process/stocktools_handler.go:23-37,89-190` (serve + StockTools)
- `backend/internal/adapter/inbound/http/process/permission.go:24-52,68-73,81-86,96-101`
- `backend/internal/adapter/inbound/http/process/workflow_handler.go:25,94-115,152`
- `backend/internal/application/process/service.go:33-47,556-627,705-805` (`RebuildStock`, `rebuildStockWithOptionsTx`, `checkSODocSuccessTx`, `recheckDocFlowTx`)
- `backend/internal/application/process/{stock_tools,stock_lot,stock_beginning,hidden_cost,point_doc,check_price,doc_no_next,sysproc_tools,ai_copilot}.go` (บรรทัดตามตาราง)
- `frontend/src/lib/query-client.ts:72-84`; `frontend/src/lib/doc-no.ts:21`; `frontend/src/app/api/process/{stock/rebuild,stocktools/[action]}/route.ts`
- `frontend/account/master/*.tsx`, `frontend/account/transaction/StockBeginningBalanceScreen.tsx`, `frontend/account/process/SystemProcessWorkbenchScreen.tsx`
