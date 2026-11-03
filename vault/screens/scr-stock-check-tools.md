---
title: "เครื่องมือตรวจสอบสินค้า ราคา บาร์โค้ด และ Serial (CheckPriceScreen, BarcodeCheckerScreen, SerialStockCountScreen, SerialAnalyzeScreen)"
tags: [screens, master]
aliases: ["CheckPriceScreen", "BarcodeCheckerScreen", "SerialStockCountScreen", "SerialAnalyzeScreen", "ตรวจสอบราคาสินค้า", "ตรวจสอบบาร์โค๊ดจาก Text File", "ตรวจสอบสินค้า Serial Number", "ตรวจสอบ Serial มีปัญหา", "ตรวจนับด้วย Serial", "2017", "2018", "2044", "2066", "check_price", "menu_ic_item_barcode_checker", "menu_ic_serialnumber_checker", "menu_ic_serial_analyze"]
sources: ["frontend/account/master/IcExtraScreens.tsx:573", "frontend/account/master/IcExtraScreens.tsx:595", "frontend/account/master/IcExtraScreens.tsx:637", "frontend/account/master/StockCheckScreens.tsx:23", "frontend/account/master/StockCheckScreens.tsx:37", "frontend/account/master/StockCheckScreens.tsx:112", "frontend/account/master/SerialStockCountScreen.tsx:92", "frontend/account/master/SerialStockCountScreen.tsx:146", "frontend/account/tabs/screenRegistry.tsx:442", "frontend/account/tabs/screenRegistry.tsx:767"]
---
# เครื่องมือตรวจสอบสินค้า ราคา บาร์โค้ด และ Serial

สี่จอเล็กในหมวดสินค้า/คลัง ใช้ตรวจข้อมูลที่ยิงหรือนำเข้า มีสามจอที่ **อ่านอย่างเดียว** (ไม่แก้ฐานข้อมูล) ยกเว้นจอตรวจราคา (2017) ที่แก้ราคาที่ 1 ของบาร์โค้ด และจอตรวจนับ Serial (2044) ที่สร้างเอกสารนับสต็อก กฎของ 3 จอหลัง (barcodecheck, serialanalyze, serialscan/serialcountsave, checkpricesave) อยู่ที่ Go `/api/process/stocktools/*` ดู [[proc-stock-tools]] และ [[api-proc-actions-stock]]

| รหัส | เมนู | จอ | ไฟล์ |
|---|---|---|---|
| 2017 | ตรวจสอบราคาสินค้า (`check_price`) | `CheckPriceScreen` | `IcExtraScreens.tsx:573` |
| 2018 | ตรวจสอบบาร์โค๊ดจาก Text File (`menu_ic_item_barcode_checker`) | `BarcodeCheckerScreen` | `StockCheckScreens.tsx:37` |
| 2044 | ตรวจสอบสินค้า Serial Number (`menu_ic_serialnumber_checker`) | `SerialStockCountScreen` | `SerialStockCountScreen.tsx:39` |
| 2066 | ตรวจสอบ Serial มีปัญหา (`menu_ic_serial_analyze`) | `SerialAnalyzeScreen` | `StockCheckScreens.tsx:112` |
ผูกที่ `screenRegistry.tsx:442-465` (2018/2044/2066) และ `:767-777` (2017) กลไกเมนูดู [[fe-screen-registry-menu]]

## 2017 ตรวจสอบราคาสินค้า (`CheckPriceScreen`)
จำลองเครื่องตรวจราคาของโปรแกรมเดิม (`BCPOSControl._checkPriceUserControl`, รหัสเก่า 2.1.21)
- ช่อง **ยิงบาร์โค้ด** รับบาร์โค้ด รหัสสินค้า หรือชื่อสินค้า แล้ว Enter หรือปุ่ม **ค้นหา** / **ตรวจสอบราคา** (ค้นแบบมีคำอยู่ในข้อความ ไม่สนตัวพิมพ์ ผ่าน SQL ตรงด้วย `queryList` จำกัด 100 แถว เรียงตามรหัสสินค้า/บาร์โค้ด, `:595-614`) เปิดจอแล้วค้นด้วยคำว่างทันที จึงเห็นรายการแรก 100 แถว
- แถวแรกของผลถูกเติมเข้าฟอร์มอัตโนมัติ (บาร์โค้ด, รหัส--ชื่อ (หน่วย), ราคาปัจจุบัน, ราคาใหม่ = ราคาปัจจุบัน); คลิกแถวอื่นในตารางเพื่อเปลี่ยนบาร์โค้ดที่เลือก ตารางแสดงราคาทั่วไป/สมาชิก/ที่ 2/ที่ 3 (ไม่แสดงราคาที่ 4)
- **บันทึก**: ต้องมีสิทธิ์แก้ไข และเลือกบาร์โค้ดแล้ว ถามยืนยันด้วยกล่องเบราว์เซอร์ `ต้องการเปลี่ยนราคาเป็น : <ราคา> บาท` (ตามโปรแกรมเดิม) แล้ว `POST /api/process/stocktools/checkpricesave` ด้วย `{barcode, newPrice}` สำเร็จขึ้น `ปรับราคาบาร์โค้ด <บาร์โค้ด> เป็น <ราคา> เรียบร้อยแล้ว` และโหลดตารางใหม่ (`:637-660`)
- กฎอยู่ที่ Go `CheckPriceSave` (`check_price.go:41-75`): ราคาใหม่ต้องมากกว่า 1 (ไม่งั้นขึ้น "ราคาใหม่ต้องมากกว่า 1"), ปัดตามทศนิยมราคาของบริษัท, ล็อกแถวบาร์โค้ดแล้ว `UPDATE ic_inventory_barcode SET price` ในธุรกรรมเดียว (ไม่พบบาร์โค้ดขึ้น `ไม่พบบาร์โค้ด <รหัส>`) และบันทึกราคาเก่า/ใหม่ลงบันทึกกระบวนการชื่อ "ตรวจสอบราคา" จึงแก้ได้เฉพาะ **ราคาที่ 1 (คอลัมน์ `price`)** ของบาร์โค้ด ราคาอื่นและราคาตามกลุ่มลูกค้าแก้ที่ [[scr-modify-price]]
- จอนี้ใช้กรอบจอของไฟล์ `IcExtraScreens` (ไม่มีคีย์ลัด Ctrl+S / Esc) ใช้ปุ่มเท่านั้น

## 2018 ตรวจสอบบาร์โค๊ดจาก Text File (`BarcodeCheckerScreen`)
อ่านอย่างเดียว ไล่บาร์โค้ดที่ป้อนหรือนำเข้า เทียบกับ `ic_inventory_barcode` (หัวไฟล์ `:3`, โปรแกรมเดิม `_icBarcodeChecker`)
- ซ้าย: กล่องข้อความ "บาร์โค้ดที่ต้องการตรวจ (บรรทัดละ 1 ค่า)" นับ `N บาร์โค้ด (สูงสุด 2000)` ปุ่ม **นำเข้าไฟล์** (`.txt .csv .tsv` ต่อท้ายข้อความเดิม) ไฟล์ CSV/Tab ใช้ **คอลัมน์แรก** ของแต่ละบรรทัด (`parseBarcodes`, `:35`)
- ปุ่ม **ตรวจสอบ** (หรือ Ctrl+S) เรียก `POST /api/process/stocktools/barcodecheck` ด้วย `{barcodes}` ไม่มีข้อมูลขึ้น "กรุณาป้อนหรือนำเข้าบาร์โค้ดก่อน", เกิน 2000 ขึ้น `ตรวจได้ครั้งละไม่เกิน 2000 บาร์โค้ด` (`MAX_BARCODES`, `:23`)
- ขวา: ตารางที่พบ (บาร์โค้ด, รหัสสินค้า, ชื่อสินค้า, หน่วยนับ, ราคา 1-4) และกล่องแดง "ไม่พบในระบบ N รายการ" ลิสต์บาร์โค้ดที่ไม่มี; ถ้าพบไม่ครบทุกค่าตารางว่างขึ้น "ไม่พบบาร์โค้ดในทะเบียนสินค้า"
- **ล้างหน้าจอ** ล้างข้อความและผลลัพธ์ แก้ข้อความแล้วผลเดิมถูกล้างให้ตรวจใหม่ ต่างจากจอ EAN13 ใน [[scr-barcode-setup]] (2019) ที่ตรวจความถูกต้องของเลข ส่วนจอนี้ตรวจว่ามีในทะเบียนหรือไม่

## 2044 ตรวจสอบสินค้า Serial Number (`SerialStockCountScreen`)
ยิง Serial ทีละตัวแล้วบันทึกเป็น **เอกสารนับสต็อก 1 ใบ** (`trans_flag = 76`, ประเภทเอกสาร CO, โปรแกรมเดิม `_serialNumberChecker`) ดูเอกสารนี้ที่ [[doc-stock-count]]
- ซ้าย: รายการเอกสารนับสต็อกที่มีอยู่ (วันที่, เลขที่เอกสาร, คลัง, หมายเหตุ) 200 ใบล่าสุดจาก `ic_trans` (`:56`) ค้นจากเลขที่/หมายเหตุ/คลัง; คลิกเอกสารเพื่อดู (อ่านอย่างเดียว) โหลดรายการ Serial ของเอกสารจาก `ic_trans_serial_number` ไม่เกิน 500 แถว (`:176`)
- **เพิ่มใหม่** (ต้องมีสิทธิ์เพิ่ม) ล้างฟอร์มเข้าโหมดเพิ่ม ป้ายเหลือง "เพิ่มรายการใหม่" ช่องหัวเอกสาร: เลขที่เอกสาร (ออกให้เองเมื่อบันทึก), ประเภทเอกสาร (จากรูปแบบเลขที่ CO), วันที่, เวลา (5 ตัวอักษร), เลขที่/วันที่อ้างอิง, **คลัง** และ **ที่เก็บ** (ตัวเลือกกรองตามสิทธิ์คลัง/ที่เก็บของผู้ใช้ ดู [[proc-wh-shelf-permission]]; เปลี่ยนคลังจะล้างที่เก็บ), หมายเหตุ, มูลค่ารวม (อ่านอย่างเดียว)
- ช่อง **Serial Number** ตัวพิมพ์ใหญ่ ยิง/พิมพ์แล้ว Enter หรือปุ่ม **เพิ่ม Serial** เรียก `serialscan` ได้สินค้า/หน่วยนับ/ราคา: ซ้ำในรายการขึ้น `มีการป้อน Serial Number <รหัส> ไปแล้ว`, ไม่พบขึ้น `ไม่พบ Serial Number <รหัส> ในทะเบียน Serial` ([[tbl-ic-serial]]) ติ๊ก Auto Focus เพื่อให้เคอร์เซอร์กลับช่องสแกนทุกครั้ง; ลิงก์ "ลบรายการล่าสุด" ถอดตัวสุดท้าย
- ตาราง: หมายเลขเครื่อง, รหัสสินค้า, ชื่อสินค้า, หน่วยนับ, ราคาซื้อ/ขาย (แก้ได้ขณะเพิ่ม ราคา 0 แสดงเป็นว่าง)
- **บันทึก** (Ctrl+S; Esc ยกเลิก) ตรวจตามลำดับ: สิทธิ์ "เพิ่มข้อมูลใหม่", "กรุณาเลือกคลังและที่เก็บ", "ยังไม่มี Serial Number ในรายการ" แล้ว `POST /api/process/stocktools/serialcountsave` ส่งหัว + รายการ Serial + ราคาต่อ Serial สำเร็จขึ้น `บันทึกเอกสารนับสต็อก <เลขที่> แล้ว (N สินค้า, M Serial)` การรวมบรรทัดตามสินค้า, การออกเลขที่และเขียน `ic_trans_serial_number` ทำที่ Go (หัวไฟล์ `:5-6`) ดู [[tbl-ic-trans]] และ [[tbl-ic-trans-serial-number]]
- ไม่มีปุ่ม แก้ไข/ลบ ของเอกสารที่บันทึกแล้ว: เอกสารเก่าดูได้อย่างเดียว

## 2066 ตรวจสอบ Serial มีปัญหา (`SerialAnalyzeScreen`)
อ่านอย่างเดียว หา Serial ที่ประวัติรับ/จ่ายผิดลำดับ (หัวไฟล์ `:4`, โปรแกรมเดิม `_serialAnalyze*`)
- ช่อง "รหัสสินค้า" (ว่าง = ทุกสินค้า) ปุ่ม **วิเคราะห์** หรือ Ctrl+S เรียก `POST /api/process/stocktools/serialanalyze` **เปิดจอแล้ววิเคราะห์ทันที** ทุกสินค้า (`useEffect`, `:125`)
- ผล: แถบ `ตรวจ N Serial พบปัญหา M รายการ` และตาราง รหัสสินค้า, Serial Number, ปัญหาที่พบ, เลขที่เอกสารที่ผิด ว่างขึ้น "ไม่พบ Serial ที่ประวัติผิดปกติ" ข้อความ "ปัญหาที่พบ" มาจากเซิร์ฟเวอร์ ตรรกะ Serial ดู [[term-lot-serial-expire]]
- จอนี้ไม่มีปุ่มแก้ไขข้อมูล แสดงผลอย่างเดียว

## ข้อควรระวัง
- จอ 2044 รวมมูลค่ารวมบนหน้าจอโดยบวกด้วยตัวเลขของเบราว์เซอร์ (`Number(s.price)`, `:109-116`) ต่างจากแนวคิดเงินเป็นสตริงใน [[fe-numeric-money]] เป็นยอดแสดงผลเท่านั้น ยอดที่บันทึกคำนวณที่ Go
- 2017 ไม่มีโหมดแก้ไข/ยกเลิก: กดบันทึกแล้วยืนยันหนึ่งครั้ง ราคาในฐานข้อมูลเปลี่ยนทันที (ราคาเดิมอยู่ในบันทึกกระบวนการเท่านั้น)

## ที่มาในโค้ด
- `frontend/account/master/IcExtraScreens.tsx:573-1026` ตรวจราคา (`:595-614` ค้น, `:637-660` บันทึก)
- `frontend/account/master/StockCheckScreens.tsx:23-35` ค่าคงที่/คอลัมน์; `:37-110` ตรวจบาร์โค้ด; `:112-165` วิเคราะห์ Serial
- `frontend/account/master/SerialStockCountScreen.tsx:39-305` (`:92-110` สแกน, `:146-165` บันทึก, `:170-188` เปิดดูเอกสาร); ตัวช่วยร่วมที่ `StockToolBits.tsx`
- `frontend/account/tabs/screenRegistry.tsx:442-465,767-777`
- `backend/internal/application/process/check_price.go:41-75` (อ่านเทียบกฎ)
- ดูเพิ่ม: [[scr-lot-adjust]] · [[scr-barcode-setup]] · [[fe-master-screens]] · [[screens-overview]]
