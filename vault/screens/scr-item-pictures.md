---
title: "กำหนดรูปภาพสินค้า/พนักงาน/สินทรัพย์ และบันทึกรูปภาพเอกสาร (ItemPictureScreen, DocumentPictureScreen)"
tags: [screens, master]
aliases: ["ItemPictureScreen", "DocumentPictureScreen", "PictureGallery", "กำหนดรูปภาพ", "บันทึกรูปภาพเอกสาร", "รูปภาพบาร์โค้ด", "รูปภาพพนักงาน", "2005", "2011", "2048", "1007", "1111", "8002", "3019", "4017", "5015", "6020", "7032", "9007"]
sources: ["frontend/account/master/ItemPictureScreen.tsx:31", "frontend/account/master/ItemPictureScreen.tsx:60", "frontend/account/master/ItemPictureScreen.tsx:95", "frontend/account/master/DocumentPictureScreen.tsx:35", "frontend/account/master/DocumentPictureScreen.tsx:122", "frontend/account/master/PictureGallery.tsx:10", "frontend/account/master/PictureGallery.tsx:44", "frontend/account/tabs/screenRegistry.tsx:379", "frontend/account/tabs/screenRegistry.tsx:503"]
---
# กำหนดรูปภาพ และบันทึกรูปภาพเอกสาร

สองจอที่หน้าตาเหมือนกัน (รายการซ้าย / ข้อมูลอ้างอิงและกล่องรูปขวา) ใช้แนบรูปให้ "ข้อมูลหลัก" หรือ "เอกสาร" โดยใช้กล่องรูปกลาง `PictureGallery` ร่วมกัน การเก็บรูป/กฎขนาด/คีย์อยู่ที่ฝั่ง Go (`/api/process/itempicture/*` และ `/api/process/docpicture/*`) ดู [[proc-doc-item-pictures]]

## วิธีเปิด
| รหัส | เมนู | จอ | ชนิด |
|---|---|---|---|
| 2005 | กำหนดรูปภาพ (`menu_ic_item_picture`) | ItemPictureScreen | `kind="item"` รูปต่อรหัสสินค้า |
| 2011 | กำหนดรูปภาพตามบาร์โค้ด (`menu_ic_item_barcode_picture`) | ItemPictureScreen | `kind="barcode"` รูปต่อบาร์โค้ด |
| 1007 | กำหนดรูปภาพพนักงาน (`menu_setup_staff_pic`) | ItemPictureScreen | `kind="staff"` |
| 8002 | กำหนดรูปภาพ (`menu_asset_picture`) | ItemPictureScreen | `kind="asset"` รูปสินทรัพย์ |
| 1111 | นำเข้ารูปภาพสินค้า (`menu_import_ic_picture`) | ItemPictureScreen | `kind="item"` เหมือน 2005 ไม่ใช่ตัวนำเข้าเป็นชุด (`screenRegistry.tsx:411`) |
| 2048 / 3019 / 4017 / 5015 / 6020 / 7032 | บันทึกรูปภาพเอกสาร (สินค้า / ซื้อ / ขาย / เจ้าหนี้ / ลูกหนี้ / เงินสดธนาคาร) | DocumentPictureScreen | `module = ic / po / so / ap / ar / cb` |
| 9007 | บันทึกรูปภาพ (`menu_gl_picture`) | DocumentPictureScreen | `module="gl"` สมุดรายวัน |
ผูกที่ `screenRegistry.tsx:379-411` (ItemPicture) และ `:503-559` (DocumentPicture) กลไกเมนูดู [[fe-screen-registry-menu]]

## ItemPictureScreen
- ซ้าย: รายการแบบแบ่งหน้า (ค้นจากเซิร์ฟเวอร์ `POST /api/process/itempicture/list` ด้วย `{kind, keyword, page}`) คอลัมน์ รหัส (หรือ "บาร์โค้ด" + "รหัสสินค้า" ในโหมดบาร์โค้ด), ชื่อ, หน่วย (พนักงานใช้ "แผนก"), จำนวนรูป ท้ายรายการมี "ทั้งหมด N รายการ", ปุ่ม ก่อนหน้า / ถัดไป, "หน้า x/y" (`:159-165`) ค้นแล้วเลือกแถวแรกให้อัตโนมัติ
- ขวา: ช่องข้อมูลอ้างอิงอ่านอย่างเดียว (รหัส/ชื่อ/หน่วย; โหมดบาร์โค้ดเพิ่ม "บาร์โค้ด") แล้วกล่องรูป จำนวนสูงสุดตามที่เซิร์ฟเวอร์ส่งมา (`view.max`, ค่าเริ่มต้น 6 `:58`) ข้อความช่วย: "กดปุ่ม เลือกรูป เพื่อแนบรูปภาพ" / "ยังไม่มีรูปภาพ" / "เลือกรายการจากรายการด้านซ้าย"
- ปุ่ม: โหมดดู = **แก้ไข**, **ลบ** (ลบรูปทั้งหมดของรายการ ถามยืนยัน `ลบรูปภาพทั้งหมดของ <คีย์> ?`), **ปิดหน้าจอ**; โหมดแก้ = **บันทึก** (กดได้เมื่อมีการเปลี่ยนแปลง) และ **ปิดหน้าจอ** (ยกเลิกการแก้)
- คีย์ลัด **Ctrl+S** บันทึก, **Esc** ยกเลิก ขณะแก้ไข (`ScreenFrame.tsx:37-58`) ดับเบิลคลิกแถว = เลือกแล้วเข้าโหมดแก้ทันทีถ้ารายการนั้นแก้ได้
- กฎ: รายการที่ `editable = false` (เซิร์ฟเวอร์กำหนด) ขึ้น "สินค้านี้ยังไม่พร้อมแก้ไข จึงแนบรูปไม่ได้"; บันทึกรูปใช้สิทธิ์ "แก้ไข" แต่บันทึกรายการว่าง (ปุ่มลบ) ใช้สิทธิ์ "ลบ" (`save`, `:99-105`) สำเร็จขึ้น "บันทึกรูปภาพแล้ว" หรือ "ลบรูปภาพแล้ว"; เปลี่ยนรายการขณะมีรูปที่ยังไม่บันทึก ขึ้น "มีรูปที่ยังไม่บันทึก กรุณาบันทึกหรือยกเลิกก่อน..." 
- ส่งบันทึกเป็นรายการ `{id}` สำหรับรูปเดิม และ `{data}` สำหรับรูปใหม่ ไปที่ `POST /api/process/itempicture/save`

## DocumentPictureScreen
- หัวรายการ (ยกเว้นสมุดรายวัน): ช่องเลือก **ประเภทเอกสาร** ดึงจาก `POST /api/process/docpicture/formats` (ตัวเลือกเป็น "รหัส - ชื่อ" ค่าเริ่มต้นเลือกตัวแรก) ต้องเลือกก่อนจึงโหลดรายการ เปลี่ยนประเภทขณะมีรูปค้างบันทึกถูกบล็อก
- รายการเอกสาร: วันที่เอกสาร, เลขที่เอกสาร, เลขที่อ้างอิง, หมายเหตุ (สมุดรายวันแสดง "สมุดรายวัน" และ "คำอธิบาย" แทน) ผ่าน `POST /api/process/docpicture/docs` แบ่งหน้า ข้อมูลอ้างอิงขวาอ่านอย่างเดียว
- แนบได้ **สูงสุด 8 รูปต่อเอกสาร** (`MAX_IMAGES = 8`, `:28`) บันทึกที่ `POST /api/process/docpicture/save` (คีย์เอกสาร: เลขที่+ประเภท หรือ เลขที่+วันที่+สมุด สำหรับ GL) สำเร็จขึ้น "บันทึกรูปภาพเอกสารแล้ว" หรือ "ลบรูปภาพของเอกสารแล้ว" (จำนวนสูงสุดส่งเข้ากล่องรูปที่ `:254`)
- ปุ่ม/คีย์ลัด/สิทธิ์เหมือน ItemPictureScreen

## กล่องรูปกลาง (`PictureGallery`)
- ชนิดไฟล์ PNG, JPG, GIF, BMP ขนาดไม่เกิน **5 MB** ต่อไฟล์ (`:10-11`) ผิดชนิด/เกินขนาดขึ้น `<ชื่อไฟล์>: ต้องเป็นไฟล์ PNG, JPG, GIF หรือ BMP และขนาดไม่เกิน 5 MB`; เกินจำนวนขึ้น `แนบรูปได้ไม่เกิน N รูป` (`:44-46`)
- ปุ่ม **เลือกรูป** (ปิดเมื่อครบจำนวน), ภาพย่อ 80 px ปุ่ม X ลบรูปนั้น (เฉพาะโหมดแก้ไข), คลิกภาพย่อเพื่อดูภาพขยายด้านล่าง; หัวกล่องแสดง `<ป้าย> (n/max)`
- ภาพที่เก็บแล้วดึงผ่านลิงก์ภาพย่อ (`thumbUrl`) ถ้ามี URL ในที่เก็บไฟล์ ไม่งั้นดึงจาก `/api/process/itempicture/image?id=` หรือ `/api/process/docpicture/image?id=`

## ข้อควรระวัง
- จอสินค้าแสดงรูปได้ทั้งในจอ [[scr-item-master]] (ส่วน 4 "รูปภาพสินค้า" ที่อัปโหลดเข้า MinIO ผ่าน `/api/crm/upload`) และจอนี้ (เก็บตาม `itempicture` ของ Go) 2 ทางนี้คนละเส้นทางเก็บไฟล์
- รูปของ "ข้อมูลสินค้าเพิ่มเติม" ในจอ [[scr-item-detail-2]] ดูได้อย่างเดียว (`editing={false}`, `ItemDetail2Screen.tsx:785`) ปุ่ม "รูปภาพสินค้า (N)" ดึงจาก `itempicture/get`
- ตัวกรองรายการเอกสารและชุดประเภทเอกสารถูกกำหนดที่ฝั่ง Go ไม่ใช่ที่หน้าจอ

## ที่มาในโค้ด
- `frontend/account/master/ItemPictureScreen.tsx:21-243` คอมโพเนนต์ทั้งหมด; `:60-75` โหลดรายการ; `:95-120` บันทึก
- `frontend/account/master/DocumentPictureScreen.tsx:28-279`; `:62-90` formats/docs; `:122-140` บันทึก
- `frontend/account/master/PictureGallery.tsx:10-107`
- `frontend/account/tabs/screenRegistry.tsx:379-411,503-559`
- ดูเพิ่ม: [[fe-master-screens]] · [[scr-data-list-and-lookup]] · [[screens-overview]]
