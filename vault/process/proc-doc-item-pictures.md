---
title: "แนบรูปเอกสารและรูปสินค้า (Document & item pictures)"
tags: [process, picture, attachment, bc_doc_images, images, advisory-lock]
aliases: ["docpicture", "itempicture", "bc_doc_images", "DocPictureSave", "ItemPictureSave", "replacePictureSet", "แนบรูป", "รูปเอกสาร", "รูปสินค้า", "glPictureKey"]
sources: ["backend/internal/application/process/doc_picture.go:27", "backend/internal/application/process/doc_picture.go:34", "backend/internal/application/process/doc_picture.go:200", "backend/internal/application/process/doc_picture.go:209", "backend/internal/application/process/doc_picture.go:361", "backend/internal/application/process/doc_picture.go:387", "backend/internal/application/process/doc_picture.go:426", "backend/internal/application/process/doc_picture.go:455", "backend/internal/application/process/item_picture.go:22", "backend/internal/application/process/item_picture.go:172", "backend/internal/application/process/item_picture.go:252", "backend/internal/adapter/inbound/http/process/docpicture_handler.go:36", "backend/internal/adapter/inbound/http/process/permission.go:30"]
---

# แนบรูปเอกสารและรูปสินค้า (Document & item pictures)

ระบบเก็บรูปแนบ 2 ชุดในฐานข้อมูลบริษัท: รูปประกอบ **เอกสาร** (ตาราง `bc_doc_images`) และรูปของ **สินค้า/บาร์โค้ด/พนักงาน/ทรัพย์สิน** (ตาราง `images`) ทั้งสองใช้ตัวบันทึกร่วมกันคือ `replacePictureSet` ซึ่งบันทึกแบบ "แทนที่ทั้งชุด" ภายใน transaction เดียว

## ทำงานอย่างไร

### รูปเอกสาร (`docpicture/*`)
- Action ของ route: `formats` (รายการประเภทเอกสารของโมดูล), `docs` (ค้นรายการเอกสาร, หน้าละ 50 = `docPicturePageSize`), `get` (ดูรูปของเอกสารหนึ่งใบ), `save` (บันทึก), และ `image` (GET ดึงไฟล์รูปตาม `id`)
- `DocPictureFormats` ผูกโมดูลกับ `erp_doc_format.screen_code` ผ่าน map `docPictureFormats` โมดูล `ic`, `po`, `so`, `ap`, `ar`, `cb`; โมดูล `gl` ไม่มีรายการประเภทเอกสาร
- **คีย์ของรูป** (`docPictureKey`) ก่อนอื่นตรวจว่าเอกสารมีจริง:
  - ไม่ใช่ GL: ค้น `doc_no` + `doc_format_code` ใน `ic_trans`, `ap_ar_trans` หรือ `cb_trans` (อย่างใดอย่างหนึ่ง) ถ้าไม่พบ -> `KindNotFound` "ไม่พบเอกสาร"; คีย์คือ `doc_no` ตามที่พิมพ์
  - GL: ค้น `gl_journal` ด้วย `doc_date` + `doc_no` + `book_code`; คีย์ = วันที่ `d/MM/yyyy` + `doc_no` + `book_code` แล้วลบ `/` ออก (`glPictureKey`, `doc_picture.go:204-205`) ปีเป็น พ.ศ. เมื่อ `erp_option.year_type = 1` หรือเมื่อไม่มีแถว `erp_option` เลย (ค่าเริ่มต้น th-TH, `doc_picture.go:247`)
  - คีย์ยาวเกิน 50 ตัวอักษร (`docPictureKeyLen`, เพราะ `image_id` เป็น varchar(50)) -> error "เก็บรูปไม่ได้"

### รูปสินค้า (`itempicture/*`)
- Action: `list` (ค้นพร้อมคำค้นหลายคำ, หน้าละ 50), `get`, `save`, `image`
- `Kind` มี 4 แบบ ตัวเลือก `item | barcode | staff | asset` ซึ่ง `itemPictureTarget` ค้นต้นทางต่างกัน:
  - `item`: `ic_inventory` (รหัส, `name_1`, `unit_standard`); แก้ไขได้เมื่อ `update_detail = 1`
  - `barcode`: `ic_inventory_barcode` เข้า `ic_inventory` (ชื่อจาก `description` หรือ `name_1`); แก้ไขได้ตาม `ic_inventory.update_detail = 1`
  - `staff`: `erp_user`; `asset`: `as_asset` (สองแบบนี้แก้ไขได้เสมอ)
- ถ้ารายการแก้ไขไม่ได้ -> `KindConflict` "สินค้านี้ยังไม่พร้อมแก้ไข จึงแนบรูปไม่ได้"
- เมื่อบันทึกสำเร็จเขียน `master_logs` 1 แถว (`function_code 2`, `function_type 2`, `computer_name 'WEB'`, `menu_name` = `ItemPicture` หรือ `ItemBarcodePicture`)

### ข้อจำกัดและการตรวจไฟล์
| รายการ | รูปเอกสาร | รูปสินค้า |
|---|---|---|
| จำนวนรูปสูงสุด | 8 (`docPictureMaxImages`) | 6 (`itemPictureMaxImages`) |
| ขนาดต่อรูป | 5 MB (`docPictureMaxBytes`) | ใช้ตัวถอดรหัสเดียวกัน (5 MB) |
| ขนาด body ของคำขอ save | 16 MB (`maxJSONBody`) | 48 MB (`itemPictureBodyLimit`) |

- `decodePictureItemsMax`: รูปใหม่มี `id = 0` และ `data` เป็น base64 (ตัดคำนำหน้า `data:...,` ออกให้); รูปที่เก็บไว้มี `id > 0` และ `data` ว่าง; รูปแบบอื่น -> error "รายการรูปที่ N ไม่ถูกต้อง"; เกินจำนวน -> "แนบรูปได้ไม่เกิน N รูป"; เกินขนาด -> "ใหญ่เกิน 5 MB"
- ชนิดไฟล์ตรวจจาก magic bytes (`sniffImage`) ยอมรับ PNG, JPG, GIF, BMP เท่านั้น ไม่เชื่อนามสกุลหรือ content-type ที่ผู้ใช้ส่งมา
- `DocPictureMime` คืน mime ที่ตรวจได้ หรือ `application/octet-stream`; handler ส่ง `Cache-Control: private, max-age=300` และ `X-Content-Type-Options: nosniff`

### การบันทึกแบบแทนที่ทั้งชุด (`replacePictureSet`)
1. ล็อก `pg_advisory_xact_lock(hashtext('docpic:' || ตาราง || ':' || คีย์))` กันสองคนบันทึกชุดเดียวกันพร้อมกัน
2. ตรวจว่า `roworder` ของรูปที่ขอเก็บ (`keep`) ยังอยู่ครบ ถ้าไม่ -> `KindConflict` "รูปนี้ถูกเปลี่ยนโดยผู้ใช้อื่น"
3. ลบรูปที่ไม่อยู่ใน `keep`, เรียง `image_order` ใหม่, แล้วแทรกรูปใหม่ `(image_id, image_file, guid_code, image_order)`
- การบันทึกแทนที่รูปทั้งชุดแล้วเรียง `image_order` ใหม่เริ่มที่ 0 (คอมเมนต์ `item_picture.go:20`)

### สิทธิ์
- `docpicture/formats|docs|get|image` และ `itempicture/list|get|image` = `read`; `docpicture/save` และ `itempicture/save` = `write` ([[proc-permission-rights]])

## จุดที่ต้องระวัง
- ส่ง `data` ของรูปเดิมมาซ้ำพร้อม `id > 0` ไม่ได้: โค้ดมองเป็นรายการไม่ถูกต้อง (รูปเดิมให้ส่งแค่ `id`)
- รูป GL ผูกกับคีย์ที่ประกอบจากวันที่ จึงขึ้นกับ `year_type` ของบริษัท ถ้าเปลี่ยนค่านี้คีย์ที่คำนวณจะเปลี่ยน (ข้อสรุปจากสูตรใน `glPictureKey`, ยังไม่ได้ทดสอบกับข้อมูลจริง)
- `listPictures` ใช้ `ownStorageURL` กรอง URL ภายนอก: ยอมเฉพาะ path `/api/crm/image` ที่ `key` ขึ้นต้นด้วยชื่อฐานข้อมูลของบริษัทนั้น

## ที่มาในโค้ด
- `backend/internal/application/process/doc_picture.go:27-39` - ชื่อตารางและข้อจำกัด
- `backend/internal/application/process/doc_picture.go:74` - `DocPictureFormats`; `:130` `DocPictureDocs`
- `backend/internal/application/process/doc_picture.go:200` - `glPictureKey`; `:209` `docPictureKey`; `:254` `checkPictureKeyLen`
- `backend/internal/application/process/doc_picture.go:299` - `ownStorageURL`; `:311` `DocPictureGet`; `:333` `DocPictureFile`
- `backend/internal/application/process/doc_picture.go:361` - `sniffImage`; `:376` `DocPictureMime`; `:387` `decodePictureItemsMax`
- `backend/internal/application/process/doc_picture.go:426` - `DocPictureSave`; `:455` `replacePictureSet`
- `backend/internal/application/process/item_picture.go:22` - ค่าคงที่; `:87` `ItemPictureList`; `:172` `itemPictureTarget`; `:210` `ItemPictureGet`; `:231` `ItemPictureFile`; `:252` `ItemPictureSave`
- `backend/internal/adapter/inbound/http/process/docpicture_handler.go:36` - route `docpicture`; `:89` ดึงรูป
- `backend/internal/adapter/inbound/http/process/stocktools_handler.go:44-64` - route `itempicture`
- `backend/internal/adapter/inbound/http/process/permission.go:30-42` - สิทธิ์ของ route รูป

## ดูเพิ่ม
- [[proc-dispatcher]]
- [[proc-permission-rights]]
- [[proc-item-master-detail]]
- [[proc-doc-flow-numbering]]
- [[process-overview]]
