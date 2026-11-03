---
title: "API ข้อมูลหลัก (Process master actions: master, master-detail, itemmaster, itemdetail, barcode, docpicture, itempicture, modifyprice)"
tags: [api, process, master]
aliases: ["/api/v1/process/master/{action}","/api/v1/process/master-detail/{action}","/api/v1/process/itemmaster/{action}","/api/v1/process/itemdetail/{action}","/api/v1/process/barcode/{action}","/api/v1/process/docpicture/{action}","/api/v1/process/docpicture/image","/api/v1/process/itempicture/{action}","/api/v1/process/itempicture/image","/api/v1/process/modifyprice/{action}","nextcode","codeleave","datalistget","datalistsave","assetdepdefaults","ean13-generate","discount-save"]
sources: ["backend/internal/adapter/inbound/http/router.go:152","backend/internal/adapter/inbound/http/process/master_handler.go:17","backend/internal/adapter/inbound/http/process/master_detail_handler.go:15","backend/internal/adapter/inbound/http/process/itemdetail_handler.go:16","backend/internal/adapter/inbound/http/process/barcode_handler.go:14","backend/internal/adapter/inbound/http/process/docpicture_handler.go:36","backend/internal/adapter/inbound/http/process/docpicture_handler.go:112","backend/internal/adapter/inbound/http/process/stocktools_handler.go:44","backend/internal/adapter/inbound/http/process/permission.go:24","backend/internal/application/process/item_master.go:559","backend/internal/application/process/master_detail.go:135","frontend/src/lib/query-client.ts:85"]
---

# API ข้อมูลหลัก (master / master-detail / itemmaster / itemdetail / barcode / docpicture / itempicture / modifyprice)

กลุ่ม action ที่เขียน/อ่านข้อมูลหลักของ ERP (สินค้า บาร์โค้ด รูปภาพ ราคา กริดย่อย) โดยตรวจกฎที่ฝั่ง Go แล้วเขียนใน transaction เดียว. ทุก action เป็น `POST /api/v1/process/<group>/<action>` (และ `/process/...` ชื่อซ้ำ) ยกเว้น 2 route `GET .../image`. ภาพรวม prefix, envelope `{"ok":true,"data":...}`, กฎสิทธิ์ `routeRights` อยู่ที่ [[api-process-run]]; แนวคิดข้อมูลหลักที่ [[proc-master-data]], [[proc-item-master-detail]], [[proc-barcode]], [[proc-doc-item-pictures]], [[proc-price-engine]].

กติการ่วม: `ProviderCode`/`DatabaseName`/`UserCode` เติมจาก claims (ฟิลด์ `json:"-"`), ไม่ใช่จากบอดี้; บอดี้เสีย = 400 "invalid request body"; ชื่อ action ที่ไม่รู้จัก = 404 "unknown <group> action"; error ธุรกิจ = 400 (ข้อความไทย) หรือ 409; ข้อผิดพลาดอื่น = 500 "internal server error" (response.Error). เพดานเวลา 60 วินาทีของ router.

## master/* — รหัสอัตโนมัติ, DataList, ค่าเริ่มต้นสินทรัพย์ (บอดี้ ≤ 1 MB)

| action | หน้าที่ | input สำคัญ | ตาราง | path:line |
|---|---|---|---|---|
| `master/nextcode` | รหัสลูกค้า/เจ้าหนี้ถัดไป (รหัสสูงสุด + 1) ใช้ตอนเพิ่มใหม่ / F2 / ชนรหัสซ้ำตอนบันทึก | `kind` (customer/supplier), `code`, `date` | ar_customer / ap_supplier (ตามชนิด) | master_handler.go:20 → master_autorun.go:64 |
| `master/codeleave` | ออกจากช่องรหัส: ถ้ารหัสที่พิมพ์ตรงกับ `erp_doc_format.code` รันตามรูปแบบนั้น มิฉะนั้นใช้เป็น prefix ต่อเลข | `kind`, `code`, `date` | erp_doc_format, erp_option, erp_doc_format_gl | master_handler.go:24 → master_autorun.go:83 |
| `master/assetdepdefaults` | อัตราค่าเสื่อมและวันหยุดคิดค่าเสื่อมเริ่มต้นของหน้าจอสินทรัพย์ | `field`, `calcType`, `age`, `calcValue`, `deadValue`, `startCalcDate` | erp_option | master_handler.go:28 → asset_depreciation.go:40 |
| `master/datalistget` | อ่านเลย์เอาต์ DataList ที่ผู้ใช้บันทึก (ไม่มี = `config:null`) | `listKey`, `userCode` | erp_user_datalist_config | master_handler.go:32 → master_datalist.go:109 |
| `master/datalistsave` | บันทึก/ลบ (config=null) เลย์เอาต์ DataList หนึ่งแถวต่อผู้ใช้ต่อ list | `listKey`, `userCode`, `config` | erp_user_datalist_config | master_handler.go:36 → master_datalist.go:132 |

- ผลลัพธ์ `nextcode`/`codeleave`: `{"code","format"}` (`format` ว่างถ้าไม่ใช่รหัสรูปแบบ) (master_autorun.go:42-45).
- สิทธิ์: `nextcode`/`codeleave`/`assetdepdefaults` = Read (permission.go:37); `datalistget`/`datalistsave` = Read ถ้า `userCode` ว่างหรือตรงกับผู้ใช้ใน token มิฉะนั้น Admin (permission.go:87-96).
- ตัวอย่าง: `POST /api/v1/process/master/nextcode` บอดี้ `{"kind":"customer","code":"<prefix>","date":"2026-01-31"}`
- ผู้เรียก: `account/master/masterAutoCode.ts:25` (nextcode/codeleave), `MasterDetailScreen.tsx:404` (assetdepdefaults), `BcDataListCustomizeModal.tsx:332,359` (datalist). Next route `src/app/api/process/master/[action]`.

## master-detail/* — บันทึก header + กริดย่อยแบบ atomic (บอดี้ ≤ 1 MB)

| action | หน้าที่ | input สำคัญ | ตาราง | path:line |
|---|---|---|---|---|
| `master-detail/save` | เขียน header และแทนที่/แก้ทุกกริดใน transaction เดียว | `menuKey`, `key`, `scope`, `mode` (new/edit), `header{}`, `grids{<ชื่อกริด>:[{...}]}` | ตามสเปกของ menuKey: erp_doc_format, erp_doc_format_gl, ic_inventory, ic_inventory_barcode ฯลฯ | master_detail_handler.go:15-37 → master_detail.go:135 |
| `master-detail/delete` | ลบ header + ลูก; ปฏิเสธถ้ายังถูกอ้างอิง (หน้าจอที่ผูกกับสินค้า ล้างเฉพาะแถวของสินค้านั้น ไม่ลบสินค้า) | `menuKey`, `key`, `scope` | ตารางเดียวกับสเปก | master_detail_handler.go:15-37 → master_detail.go:177 |

- `menuKey` ต้องอยู่ใน `mdSpecs` (master_detail_specs.go:144) เช่น `menu_ic_item_set`, `menu_ic_purchase_price`, `menu_ic_item_saleprice`, `menu_ic_discount`, `menu_asset_lists`, `menu_chart_of_account`, `menu_setup_user_group`; ไม่อยู่ = 400 "ไม่รู้จักเมนู <menuKey>" (master_detail.go:136-138,178-180).
- Response: `{"ok":true,"data":{"key":"<key>","saved":{"<ชื่อกริด>":<จำนวนแถว>}}}` (MasterDetailResult).
- สิทธิ์: save = Write (Add หรือ Edit), delete = Delete (permission.go:40-47).
- ตัวอย่าง:

```json
POST /api/v1/process/master-detail/save     (Authorization: Bearer <token>)
{"menuKey":"<menuKey>","key":"<code>","mode":"edit",
 "header":{"<column>":"<value>"},
 "grids":{"<gridName>":[{"<column>":"<value>"}]}}
```

- ผู้เรียก: `account/master/MasterDetailScreen.tsx:565` (save), `:600` (delete); สเปกหน้าจอที่ `src/config/schemas/masterDetailSchemas.ts`. ภาพรวมที่ [[fe-master-screens]], [[fe-standard-master-screen]].

## itemmaster/* — บันทึก/ลบสินค้า (menu 2.1.1, 2.1.2, 2.1.24)

| action | หน้าที่ | input สำคัญ | ตาราง | path:line | บอดี้ |
|---|---|---|---|---|---|
| `itemmaster/save` | ตรวจกฎของหน้าจอสินค้า (`ItemMasterSave` ใน `item_master.go:559`) แล้วเขียนสินค้า + หน่วย + หน่วยตรงข้าม + บาร์โค้ด + คลัง/ชั้น + ต้นทุนมาตรฐาน + รูป ใน transaction เดียว พร้อมเขียน master_logs | `menuKey`, `isNew`, `item{}`, `units[]`, `oppositeUnits[]`, `barcodes[]`, `whShelves[]`, `standardCosts[]`, `images[]` | ic_inventory, ic_inventory_barcode, master_logs, erp_option, erp_user_group(+_detail), ic_trans_detail | itemdetail_handler.go:33,35 → item_master.go:559 | 4 MB |
| `itemmaster/delete` | ลบสินค้าที่ยังไม่ถูกใช้ + ข้อมูลลูกทั้งหมด; รหัสที่มีใน ic_trans_detail ถูกข้าม | `menuKey`, `codes[]` | ic_inventory, ic_inventory_set_detail, ic_trans_detail, master_logs, erp_user_group(+_detail) | itemdetail_handler.go:39 → item_master.go:817 | 1 MB |

- สิทธิ์: save = **Add** ถ้า `isNew:true` มิฉะนั้น **Edit** (permission.go:81-86); delete = Delete (permission.go:47).
- Response: save `{"ok":true,"data":{"code","itemsProcessed","rowsUpdated"}}`; delete `{"data":{"deleted":[...],"used":[...]}}` (`used` = รหัสที่ถูกข้ามพร้อมเหตุผลไทย) (item_master.go:146,806; query-client.ts:85-99).
- ผู้เรียก: `itemMasterSave`/`itemMasterDelete` ใน query-client.ts:88,96 → `account/master/ItemScreen.tsx:1027`.

## itemdetail/* — ข้อมูลสินค้าเพิ่มเติม (เมนู menu_ic_item_detail_2 และรุ่นบาร์โค้ด)

| action | หน้าที่ | input สำคัญ | ตาราง | path:line | บอดี้ |
|---|---|---|---|---|---|
| `itemdetail/get` | โหลดทุกแท็บของสินค้า/บาร์โค้ดหนึ่งตัว | `code`, `barcode` | ic_inventory, ic_inventory_barcode | itemdetail_handler.go:18 → item_detail.go:221 | 1 MB |
| `itemdetail/save` | เขียนทุกแท็บใน transaction เดียว แล้วโหลดมุมมองใหม่คืน | `code`, `item`, `detail`, `market`, `billing`, `short`, `pos`, `colors` | ic_inventory, ic_inventory_detail, ic_inventory_barcode, erp_doc_format | itemdetail_handler.go:22 → item_detail.go:367 | 4 MB |

- สิทธิ์: get = Read, save = Write (permission.go:32,42). ผู้เรียก: `account/master/ItemDetail2Screen.tsx:412` (get), `:436` (save).

## barcode/* — บาร์โค้ด, ส่วนลดตามบาร์โค้ด, EAN13, พิมพ์ป้าย (menu 2.1.7-2.1.17; บอดี้ ≤ 1 MB)

| action | หน้าที่ | input สำคัญ | ตาราง | path:line | สิทธิ์ |
|---|---|---|---|---|---|
| `barcode/item` | โหลดสินค้าพร้อมบาร์โค้ด หน่วย ชั้นเก็บ (code เป็นรหัสสินค้าหรือบาร์โค้ดก็ได้) | `code` | ic_inventory, ic_inventory_barcode, ic_unit, ic_unit_use, ic_wh_shelf, ic_warehouse | barcode_handler.go:22 → barcode.go:123 | Read |
| `barcode/save` | แทนที่แถวบาร์โค้ดของสินค้าใน transaction เดียว (ลบตาม ic_code แล้วใส่ใหม่) | `itemCode`, `barcodes[]`, `shelf`, `whCode`, `locationCode` | ic_inventory, ic_inventory_barcode, ic_wh_shelf | :28 → barcode.go:252 | Write |
| `barcode/discount-load` | โหลดบาร์โค้ดและแถวส่วนลดแยกตาม discount_type เรียงตาม priority | `barcode` | ic_inventory_barcode, ic_inventory_barcode_price | :34 → barcode_discount.go:83 | Read |
| `barcode/discount-save` | เขียนกริดส่วนลดให้ทุกบาร์โค้ดใน transaction เดียว (ทุกบาร์โค้ดต้องมีอยู่จริง) | `barcodes[]`, `replace`, `grids` | ic_inventory_barcode_price, ic_inventory_barcode | :40 → barcode_discount.go:253 | Write |
| `barcode/ean13-check` | รายการบาร์โค้ด 13 หลักที่ checksum EAN13 ไม่ผ่าน | (ไม่มี) | ic_inventory_barcode | :46 → barcode.go:436 | Read |
| `barcode/ean13-generate` | สร้าง EAN13 ใหม่ที่ไม่ซ้ำให้แต่ละบาร์โค้ดเก่า (ไม่เขียนอะไร) | `prefix`, `barcodes[]` | ic_inventory_barcode | :52 → barcode.go:472 | Read |
| `barcode/ean13-apply` | แทนที่บาร์โค้ดเก่าด้วยใหม่ใน transaction เดียว | `rows[]` | ic_inventory_barcode | :58 → barcode.go:531 | Write |
| `barcode/print-items` | แถวป้ายพร้อมชื่อหน่วยและราคา price_0 จากสูตรราคา | `barcodes[]`, `docNo` | ic_trans_detail, ic_inventory_price_formula, ic_inventory_barcode, ic_unit | :66 → barcode.go:588 | Read |
| `barcode/format` | รายการ/บันทึก(upsert ตามรหัส)/ลบ รูปแบบป้าย | `action` (list/save/delete), `format{}` | bc_barcode_print_format, erp_doc_format | :72 → barcode.go:661 | list=Read, save=**Add**, delete=Delete (permission.go:102-110) |

- ตัวอย่าง: `POST /api/v1/process/barcode/ean13-generate` บอดี้ `{"prefix":"<prefix>","barcodes":["<barcode>"]}`; ผลเป็นอาร์เรย์แถว `{barcodeOld, barcodeNew,...}` (BarcodeScreens.tsx:162,840).
- Next route `src/app/api/process/barcode/[action]/route.ts:12-29` มี whitelist ครบ 9 action. ผู้เรียก: `account/master/BarcodeScreens.tsx:355,359,819,840,850`, `BarcodeDiscountScreens.tsx:600,629,783`, `BarcodePrintScreen.tsx:205,214,222`, `ItemScreen.tsx:1479`.

## docpicture/* — รูปประกอบเอกสาร

| action | หน้าที่ | input สำคัญ | ตาราง | path:line | บอดี้ |
|---|---|---|---|---|---|
| `docpicture/formats` | ประเภทเอกสารของโมดูลหนึ่ง | `module` (ic/po/so/ap/ar/cb/gl) | erp_doc_format, erp_doc_format_gl | docpicture_handler.go:44 → doc_picture.go:79 | 1 MB |
| `docpicture/docs` | รายการเอกสารของประเภทที่เลือก (ค้นทั้ง ic_trans, ap_ar_trans, cb_trans) แบ่งหน้า | `module`, `formatCode`, `keyword`, `page` | gl_journal, ic_trans, ap_ar_trans, cb_trans | :52 → doc_picture.go:135 | 1 MB |
| `docpicture/get` | รูปที่ผูกกับเอกสารหนึ่งใบ | `module`, `formatCode`, `docNo`, `docDate`, `bookCode` (สองตัวหลังเฉพาะ GL) | ic_trans, ap_ar_trans, cb_trans, gl_journal, erp_option | :60 → doc_picture.go:327 | 1 MB |
| `docpicture/save` | แทนที่ชุดรูปของเอกสารแบบ atomic (ลบทั้งหมดแล้วใส่ตามหน้าจอ) | ฟิลด์ของ get + `items[]` | เหมือน get | :68 → doc_picture.go:563 | 256 MB (`docPictureBodyLimit`, docpicture_handler.go:32); ไม่จำกัดจำนวนไฟล์แนบ (`docPictureMaxImages = 0` doc_picture.go:40) แต่ไฟล์ละ ≤ 25 MB (`docPictureMaxBytes` doc_picture.go:41,533-535) ส่งเป็น base64 ชนิดที่รับ: PNG, JPG, WEBP, GIF, BMP, PDF, XLS, XLSX, CSV, DOC, DOCX, PPT, PPTX, TXT, ZIP (doc_picture.go:538) |
| `GET docpicture/image?id=<roworder>` | ส่งไบต์รูปหนึ่งรูป | query `id` (จำนวนเต็ม > 0 มิฉะนั้น 400 "invalid image id") | bc_doc_images | docpicture_handler.go:89 → doc_picture.go:349 | - |

## itempicture/* — รูปสินค้า/บาร์โค้ด/พนักงาน/สินทรัพย์

| action | หน้าที่ | input สำคัญ | ตาราง | path:line | บอดี้ |
|---|---|---|---|---|---|
| `itempicture/list` | รายการสินค้า (หรือบาร์โค้ด) พร้อมจำนวนรูป | `kind` (item/barcode/staff/asset), `keyword`, `page` | ic_inventory, erp_user, as_asset, ic_inventory_barcode | stocktools_handler.go:46 → item_picture.go:87 | 1 MB |
| `itempicture/get` | ชุดรูปของคีย์หนึ่ง | `kind`, `key` | ตารางเดียวกัน | :50 → item_picture.go:210 | 1 MB |
| `itempicture/save` | แทนที่ชุดรูปของคีย์หนึ่ง และเขียน master_logs | `kind`, `key`, `items[]` | master_logs + ตารางเดียวกัน | :54 → item_picture.go:252 | 48 MB (`itemPictureBodyLimit`, stocktools_handler.go:40); ไม่จำกัดจำนวนไฟล์ (`itemPictureMaxImages = 0` item_picture.go:23) ไฟล์ละ ≤ 25 MB ผ่านตัวถอดรหัสเดียวกับ docpicture (item_picture.go:257) |
| `GET itempicture/image?id=<roworder>` | ส่งไบต์รูป | query `id` | (ตารางรูป) | stocktools_handler.go:64 → item_picture.go:231 | - |

- ทั้งสอง `GET .../image` คืนไบต์ตรงๆ: `Content-Type` จาก `DocPictureMime(data)`, `X-Content-Type-Options: nosniff`, `Cache-Control: private, max-age=300` (docpicture_handler.go:105-107, stocktools_handler.go:80-82); สิทธิ์ Read; ผ่าน Next `src/app/api/process/{docpicture,itempicture}/image/route.ts` ซึ่งตรวจ `id` เป็นเลข ≤ 12 หลัก และ session ก่อน (401 `NO_TOKEN` ถ้าไม่มี token).
- สิทธิ์: list/get/formats/docs = Read; save = Write (permission.go:30-31,40,42). ผู้เรียก: `account/master/DocumentPictureScreen.tsx:65,77,102,123`, `ItemPictureScreen.tsx:64,85,106`, `ItemDetail2Screen.tsx:373`. ความหมายของรูปสินค้าที่ [[proc-doc-item-pictures]].

## modifyprice/* — แก้ราคาเป็นชุด (menu 2.1.25)

| action | หน้าที่ | input สำคัญ | ตาราง | path:line | บอดี้ |
|---|---|---|---|---|---|
| `modifyprice/preview` | เติมคอลัมน์ "ราคาเดิม" โดยไม่เขียนอะไร | `kind`, `zeroOption`, `rows[]` | ic_inventory, master_logs | docpicture_handler.go:112 → modify_price.go:75 | 8 MB |
| `modifyprice/apply` | เขียนกริดราคาและบันทึกการรันใน master_logs | เหมือน preview (`zeroOption:true` = เขียนเซลล์ที่พิมพ์ 0) | ic_inventory, master_logs | → modify_price.go:80 | 8 MB |

- action อื่นนอกจาก `preview`/`apply` = 404 "unknown modifyprice action" (docpicture_handler.go:114-118). สิทธิ์: preview = Read, apply = Write. ผู้เรียก: `account/master/ModifyPriceScreen.tsx:189`.

## ที่มาในโค้ด

- `backend/internal/adapter/inbound/http/router.go:126-208` (route ทั้งสอง prefix; กลุ่มนี้คือ barcode, master-detail, docpicture, modifyprice, itempicture, itemdetail, itemmaster, master)
- `backend/internal/adapter/inbound/http/process/permission.go:24-52` (routeRights), `81-110` (isNew → Add/Edit, datalist, barcode/format)
- `backend/internal/adapter/inbound/http/process/{master_handler,master_detail_handler,itemdetail_handler,barcode_handler,docpicture_handler,stocktools_handler}.go` (บรรทัดตามตารางด้านบน); `decodeCheque` cheque_handler.go:43-53 (เพดาน 1 MB), `decodeLimited` docpicture_handler.go:18
- `backend/internal/application/process/{master_autorun,master_datalist,master_detail,master_detail_specs,item_master,item_detail,barcode,barcode_discount,doc_picture,item_picture,modify_price,asset_depreciation}.go`
- `frontend/src/lib/query-client.ts:85-99`; `frontend/src/app/api/process/{barcode,master,master-detail,itemmaster,itemdetail,docpicture,itempicture,modifyprice}/**/route.ts`
- `frontend/account/master/*.tsx` (ผู้เรียกตามรายการข้างต้น)
