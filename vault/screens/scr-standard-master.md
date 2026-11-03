---
title: "หน้าจอข้อมูลหลักมาตรฐาน (StandardMasterScreen)"
tags: [screens, master]
aliases: ["StandardMasterScreen", "MASTER", "หน้าจอ master ตารางเดียว", "createMasterScreen", "เมนูกำหนด...", "menu_setup_*"]
sources: ["frontend/account/tabs/screenRegistry.tsx:152", "frontend/account/master/StandardMasterScreen.tsx:63", "frontend/account/master/StandardMasterScreen.tsx:305", "frontend/account/master/StandardMasterScreen.tsx:513", "frontend/account/master/StandardMasterScreen.tsx:698", "frontend/account/master/StandardMasterScreen.tsx:724", "frontend/account/master/StandardMasterScreen.tsx:902", "frontend/account/master/StandardMasterScreen.tsx:1319", "frontend/account/master/StandardMasterScreen.tsx:1607", "frontend/src/config/schemas/icMasterSchemas.ts:18", "frontend/src/config/schemas/icMasterSchemas.ts:365", "frontend/src/config/schemas/icMasterSchemas.ts:1250"]
---
# หน้าจอข้อมูลหลักมาตรฐาน (StandardMasterScreen)

หน้าจอแบบ "รายการซ้าย + ฟอร์มขวา" สำหรับตารางข้อมูลหลักตารางเดียว ผู้ใช้ค้นหา เพิ่ม แก้ไข และลบรหัส/ชื่อได้ในจอเดียว
เมนู "กำหนด..." ในกลุ่มตั้งค่าส่วนใหญ่ใช้จอนี้ รวม 75 เมนู (รายการเต็มอยู่ในหัวข้อ "วิธีเปิด")
กลไกภายในอยู่ใน [[fe-master-screens]] และ [[fe-standard-master-screen]] โน้ตนี้เล่าเฉพาะสิ่งที่ผู้ใช้เห็นและทำได้

## วิธีเปิด
เมนูที่ config เป็น MASTER (ไม่มี `detail`) จะถูกสร้างเป็น StandardMasterScreen แบบ tab ผ่าน `createMasterScreen` (`frontend/account/tabs/screenRegistry.tsx:152-166`); ถ้า config มี `detail` จะไปจอ [[scr-master-detail]] แทน
เมนูที่ลงทะเบียนมือใน BASE_SCREENS มาก่อน จะไม่ถูกทับด้วย config นี้ (`screenRegistry.tsx:1013-1014`)
รายการเมนู MASTER ทั้ง 75 (รหัส `menu_key` ชื่อไทย) จัดตามหมวดในเมนู:
- ตั้งค่าองค์กร พนักงาน เอกสาร (1001-1023): 1003 `menu_setup_currency` กำหนดสกุลเงิน · 1004 `menu_setup_branch` กำหนดรายละเอียดสาขา · 1005 `menu_setup_department_list` กำหนดรายละเอียดแผนก · 1010 `menu_setup_staff_mis` กำหนดผู้ใช้ระบบ MIS · 1011 `menu_setup_doc_group` กำหนดกลุ่มเอกสาร · 1013 `menu_setup_transport` กำหนดประเภทการขนส่ง · 1014 `menu_setup_ar_logistic_area` กำหนดเขตการขนส่ง · 1022 `menu_setup_qr_payment` กำหนดค่า QR Code Payment
- ตั้งค่าสินค้าคงคลัง (1024-1047): 1025 `menu_setup_ic_shelf` กำหนดพื้นที่เก็บสินค้า · 1028 `menu_setup_ic_group_main` กำหนดกลุ่มสินค้าหลัก · 1029 `menu_setup_ic_group_sub` กำหนดกลุ่มสินค้าย่อย · 1030 `menu_setup_ic_group_sub2` กำหนดกลุ่มสินค้าย่อย2 · 1031 `menu_setup_ic_category` กำหนดหมวดสินค้า · 1032 `menu_setup_ic_brand` กำหนดยี่ห้อสินค้า · 1033 `menu_setup_ic_model` กำหนดรุ่นสินค้า · 1034 `menu_setup_ic_color` กำหนดสีสินค้า · 1035 `menu_setup_ic_size` กำหนดขนาดสินค้า · 1036 `menu_setup_ic_pattern` กำหนดรูปแบบสินค้า · 1037 `menu_setup_ic_grade` กำหนดเกรดสินค้า · 1038 `menu_setup_ic_design` กำหนดรูปทรงสินค้า · 1039 `menu_setup_ic_class` กำหนดระดับสินค้า · 1040 `menu_setup_ic_dimension_name` กำหนดชื่อมิติสินค้า · 1041 `menu_setup_ic_dimension` กำหนดมิติสินค้า · 1042 `menu_manufacturer_list` กำหนดผู้ผลิต · 1043 `menu_setup_ic_account_group` กำหนดกลุ่มบัญชีสินค้า · 1044 `menu_setup_ic_issue_type` กำหนดประเภทการเบิก · 1045 `menu_setup_stk_adjust` กำหนดสาเหตุการปรับปรุง · 1046 `menu_setup_ic_close_reason` กำหนดเหตุผลการปิดสินค้า · 1047 `menu_setup_ic_import_duty_point` กำหนดพิกัดศุลกากร
- ตั้งค่าขายและ POS (1048-1051): 1048 `menu_setup_ar_sale_area` กำหนดเขตการขาย · 1049 `menu_approve_credit_level` กำหนดกลุ่มอนุมัติวงเงิน
- ตั้งค่าเจ้าหนี้ (1052-1055): 1052 `menu_setup_ap_type` กำหนดประเภทเจ้าหนี้ · 1053 `menu_setup_ap_group_main` กำหนดกลุ่มเจ้าหนี้หลัก · 1054 `menu_setup_ap_group_sub` กำหนดกลุ่มเจ้าหนี้ย่อย · 1055 `menu_setup_ap_dimension` กำหนดมิติเจ้าหนี้
- ตั้งค่าลูกหนี้ (1056-1065): 1056 `menu_setup_ar_type` กำหนดประเภทลูกหนี้ · 1057 `menu_setup_ar_group_main` กำหนดกลุ่มลูกหนี้หลัก · 1058 `menu_setup_ar_group_sub` กำหนดกลุ่มลูกหนี้ย่อย · 1059 `menu_setup_ar_dimension` กำหนดมิติลูกหนี้ · 1060 `menu_ar_contact_group` กำหนดกลุ่มผู้ติดต่อ · 1061 `menu_setup_ar_credit_approve` กำหนดเหตุผลอนุมัติวงเงิน · 1062 `menu_setup_ar_pay_bill_reason` กำหนดเงื่อนไขการวางบิล · 1063 `menu_setup_ar_keep_chq_reason` กำหนดเงื่อนไขการรับเช็ค · 1064 `menu_setup_ar_keep_money` กำหนดเงือนไขการชำระเงิน · 1065 `menu_ar_credit_pay_bill` กำหนดวันครบกำหนดชำระเงิน
- ตั้งค่าการเงินและธนาคาร (1066-1075): 1066 `menu_setup_bank` กำหนดธนาคาร · 1067 `menu_setup_bank_branch` กำหนดสาขาธนาคาร · 1068 `menu_book_bank_type` ประเภทสมุดเงินฝาก · 1069 `menu_book_bank_trans_type` ตัวย่อในสมุดเงินฝาก · 1070 `menu_petty_cash` กำหนดวงเงินสดย่อย · 1071 `menu_income_list` กำหนดประเภทรายได้ · 1072 `menu_expenses_list` กำหนดประเภทค่าใช้จ่าย · 1073 `menu_setup_credit_type` ประเภทบัตรเครดิต · 1075 `menu_setup_banknotes` กำหนดธนบัตร
- ตั้งค่าสินทรัพย์ถาวร (1076-1080): 1076 `menu_asset_setup_type` กำหนดประเภทสินทรัพย์ · 1077 `menu_asset_setup_location` กำหนดตำแหน่งที่ตั้งสินทรัพย์ · 1078 `menu_asset_setup_maintain` กำหนดการบำรุงรักษาสินทรัพย์ · 1079 `menu_asset_setup_maintain_unit` กำหนดหน่วยการบำรุงรักษาสินทรัพย์ · 1080 `menu_asset_setup_retire` กำหนดประเภทการตัดจำหน่าย
- ตั้งค่าบัญชีและภาษี (1081-1092): 1082 `menu_setup_gl_journal_book` กำหนดสมุดบัญชี · 1083 `menu_setup_gl_account_type` กำหนดประเภทบัญชี · 1084 `menu_setup_gl_account_group` กำหนดกลุ่มบัญชี · 1085 `menu_setup_gl_group_for_cash_flow` กำหนดกลุ่มบัญชีกระแสเงินสด · 1086 `menu_tax_group` กำหนดกลุ่มภาษี · 1087 `menu_tax_type` กำหนดประเภทภาษี · 1088 `menu_setup_side` กำหนดหน่วยงาน · 1089 `menu_setup_project` กำหนดโครงการ · 1090 `menu_setup_job` กำหนดงาน · 1091 `menu_setup_allocate` กำหนดการจัดสรร
- อยู่นอกหมวดตั้งค่า: 2006 `menu_ic_item_serial` ทะเบียน Serial Number · 5003 `menu_ap_partner_detail` ข้อมูลคู่ค้า · 6004 `menu_ar_customer_connected` ข้อมูลคู่ค้า(ลูกหนี้) · 6008 `menu_ar_point_balance` กำหนดแต้มคงเหลือยกมา · 6010 `menu_ar_cut_point` บันทึกตัดแต้ม · 7010 `menu_book_bank` กำหนดสมุดเงินฝาก

ผังบัญชีเต็ม (9001/9002) ไม่ใช่จอนี้ ดู [[scr-chart-of-accounts]]; 1083-1085 และ 1082 ใช้จอนี้

## ช่องข้อมูลสำคัญและ validation
ฟอร์มขวาประกอบจากค่าใน `MasterScreenConfig` (`icMasterSchemas.ts:18-60`) ช่องหลักจึงเหมือนกันทุกเมนู ส่วนที่ต่างคือ `extraFields`
| ช่อง | กติกาที่เห็นในโค้ด | path:line |
|---|---|---|
| รหัส (`idKey`, ค่าเริ่มต้น `code`) | แปลงเป็นตัวพิมพ์ใหญ่ทุกครั้งที่พิมพ์, ยาวสุด 30 ตัว, แก้ได้เฉพาะตอน "เพิ่มใหม่" (ยกเว้นจอที่มี `rowKey`), กด Enter ในช่องไม่ส่งฟอร์ม; บังคับกรอก: "กรุณาระบุรหัส" | StandardMasterScreen.tsx:529,1319-1321 |
| ชื่อ (`nameKey`, ค่าเริ่มต้น `name_1`) | บังคับกรอก: "กรุณาระบุชื่อ" | StandardMasterScreen.tsx:540 |
| ชื่อ 2 (`name_2`) | ซ่อนและไม่บันทึกเมื่อ config ตั้ง `noName2` | StandardMasterScreen.tsx:75,620,1357 |
| ยกเลิกการใช้งาน (`status` 0/1) | ซ่อนเป็นค่าเริ่มต้น แสดงเมื่อ config ตั้ง `showStatus` | StandardMasterScreen.tsx:74,1607 |
| กลุ่มแม่ (`parentFilter`) | dropdown เหนือรายการ; ตอนบันทึกต้องเลือก: "กรุณาเลือก<ชื่อกลุ่ม>ก่อนบันทึก" | StandardMasterScreen.tsx:566-588 |
| กลุ่มแม่ชั้นที่ 2 (`dependentFilter`) | dropdown ที่ขึ้นกับกลุ่มแม่ (ใช้ที่ 1030) | icMasterSchemas.ts:176 |
| ช่องรหัสแบบกล่องค้นหา (`idLookupTable`) | ใช้ BcLookupInput แทนช่องพิมพ์ (1049, 6004) — [[scr-data-list-and-lookup]] | StandardMasterScreen.tsx:1299-1311 |
| `extraFields` | ชนิด text, textarea, number, calc, date, select, radio, checkbox, lookup; number/calc แปลงด้วย `sqlDecimal`, lookup เก็บส่วนก่อน `~` | StandardMasterScreen.tsx:186-199 |
| ค่าคงที่ (`fixedValues`) | ต่อเป็นเงื่อนไขตอนอ่าน/แก้/ลบ เช่น `trans_flag` ของเอกสารแต้ม (6008=801, 6010=802) | StandardMasterScreen.tsx:174,293,640 |

กติการหัสซ้ำ: ตอนเพิ่มใหม่ระบบนับรหัสเดิมในตาราง (ไม่สนตัวพิมพ์ ใต้กลุ่มแม่เดียวกัน) ถ้าพบแจ้ง `รหัส "..." มีอยู่ในระบบแล้ว กรุณาใช้รหัสอื่น` หัวข้อ "รหัสซ้ำ" (StandardMasterScreen.tsx:590-612)
รหัสอัตโนมัติ: จอนี้ไม่มี ผู้ใช้พิมพ์รหัสเอง (`masterAutoCode` ใช้เฉพาะจอลูกหนี้/เจ้าหนี้ — ดู [[scr-customer]] [[scr-supplier]])

## ปุ่ม / คีย์ลัด
- รายการซ้ายคือ BcDataList: ค้นหา Auto, ตัวกรองขั้นสูง, ปรับคอลัมน์, Insert/Alt+N = เพิ่มใหม่, ลูกศร/Home/End/PageUp/PageDown เลื่อนแถว (ตารางคีย์ลัดเต็มอยู่ใน [[scr-data-list-and-lookup]])
- โหมดอ่าน: ปุ่มแก้ไข / เพิ่มใหม่ / ลบ / ปิดหน้าจอ ถูกปิดเมื่อไม่มีสิทธิ์ `canEdit` `canAdd` `canDelete` (ชื่อปุ่มบอก "ไม่มีสิทธิ์...ในหน้าจอนี้") — StandardMasterScreen.tsx:1143,1153,1205
- โหมดแก้ไข: ปุ่มบันทึก (กดได้เมื่อมีการแก้ไข) และ "ปิดหน้าจอ" ซึ่งทำหน้าที่ยกเลิกการแก้ไข ถ้ามีข้อมูลค้างจะถาม "ยกเลิกการแก้ไข" — StandardMasterScreen.tsx:475-496,1111,1120
- Ctrl+S = บันทึก เมื่ออยู่ในโหมดแก้ไข ไม่กำลังบันทึก มีสิทธิ์ และแท็บนี้มองเห็นอยู่ — StandardMasterScreen.tsx:902-909
- Esc/F12: ไม่พบตัวดักปุ่มในไฟล์นี้ ("(Esc)" เป็นแค่ข้อความ title ของปุ่มที่ StandardMasterScreen.tsx:1120)
- คลิกรายการอื่นระหว่างมีข้อมูลค้าง: ถามยืนยัน "เปลี่ยนรายการ" (สลับรายการ (ไม่บันทึก) / ทำงานต่อ) — StandardMasterScreen.tsx:457-473

## popup / modal ที่เรียกได้
- BcDialog: แจ้งเตือน, ยืนยันลบ "ยืนยันการลบ", "ไม่อนุญาตให้ลบ" — [[scr-data-list-and-lookup]]
- BcLookupModal: เปิดผ่าน `openLookup` จากช่อง lookup ใน `extraFields` และช่องรหัสแบบ `idLookupTable` — StandardMasterScreen.tsx:798-799,1403,1774
- ThaiBankDirectoryModal: เฉพาะ 1066 `menu_setup_bank` (ตาราง erp_bank) ปุ่ม "ดึงธนาคาร" — StandardMasterScreen.tsx:1130,1795
- แผงประวัติ Serial Number: เฉพาะ 2006 `menu_ic_item_serial` แสดงความเคลื่อนไหวของหมายเลขที่เลือก — StandardMasterScreen.tsx:106-135,1669-1700
- ปุ่ม "พิมพ์ป้ายชื่อ" (ป้ายขนส่ง) — StandardMasterScreen.tsx:1195-1198

## API / process actions
จอนี้ประกอบ SQL ในเบราว์เซอร์แล้วส่งผ่าน `queryList` / `queryLimit` / `queryExec` / `queryExecBatch` (`@/lib/query-client`) — StandardMasterScreen.tsx:18
- โหลดรายการ: `select * from <ตาราง>` พร้อมค้นหา/`fixedValues`/กลุ่มแม่ เรียงตาม `idKey` จำกัด 500 แถว — StandardMasterScreen.tsx:283-305
- ค้นหา: ฟิลด์ค้นหาคือ `[idKey, nameKey, name_2]` (ตัดเหลือ `[nameKey]` เมื่อ `idKey` คือ `dimension_number`, ตัด name_2 เมื่อ `noName2`) — StandardMasterScreen.tsx:283-292
- เพิ่ม: INSERT หลังตรวจรหัสซ้ำ; แก้: UPDATE ตามรหัสเดิม + กลุ่มแม่ — StandardMasterScreen.tsx:619-682
- ลบ: `findFkUse` ตรวจ `fkChecks` ก่อน แล้วยืนยัน "ยืนยันการลบ" (`ต้องการลบรายการ "..." หรือไม่?`) แล้ว `delete from <ตาราง> where <รหัส>` — StandardMasterScreen.tsx:698-772
- ดึงธนาคารไทย: `queryExecBatch` ชุด UPDATE/INSERT บน erp_bank (รหัสใหม่ต้องมีสิทธิ์เพิ่ม รหัสเดิมต้องมีสิทธิ์แก้) — StandardMasterScreen.tsx:800-860
- เอกสารแต้ม 6008/6010 (ตาราง ic_trans, `trans_flag` 801/802): บันทึกผ่าน `POST /api/process/stocktools/pointdocsave` ลบผ่าน `POST /api/process/stocktools/pointdocdelete` — StandardMasterScreen.tsx:511,550,758; config icMasterSchemas.ts:1250-1286

## ตารางที่ข้อมูลลงไป
ตารางคือ `tableName` ของแต่ละ config เช่น [[tbl-erp-bank]] (1066), [[tbl-gl-journal-book]] (1082), [[tbl-ic-shelf]] (1025), [[tbl-ic-trans]] (6008/6010 ผ่าน API), `ic_serial` (2006)
ตรวจการใช้งานก่อนลบจาก `fkChecks`: 1082 ตรวจ `gl_journal.book_code` ("มีการใช้งานในสมุดรายวันแล้ว") — icMasterSchemas.ts:795; 1025 ตรวจ `ic_wh_shelf` และ `ic_trans_detail` โดยจำกัดด้วยคลัง `wh_code` — icMasterSchemas.ts:365
เมนู MASTER ที่ config มี `fkChecks`: 1004, 1005, 1025, 1028-1039, 1048, 1052, 1053, 1056, 1057, 1071, 1082

## ข้อควรระวัง
- รายการซ้ายโหลดสูงสุด 500 แถว (`queryLimit(sql, 500, 0, true)` ที่ StandardMasterScreen.tsx:305) ตัวกรองขั้นสูงทำงานกับแถวที่โหลดมาแล้วเท่านั้น
- ลบแล้วถูกบล็อก: `findFkUse` ตรวจทีละตาราง หยุดที่ตารางแรกที่พบ แสดงเฉพาะข้อความของตารางนั้นหัวข้อ "ไม่อนุญาตให้ลบ" (ถ้าไม่มี `message` ใช้ "รหัสนี้มีการใช้งานอยู่ในตาราง <ตาราง> แล้ว ห้ามลบ") — StandardMasterScreen.tsx:698-735
- เมนูที่ไม่มี `fkChecks` ลบได้ทันทีหลังยืนยัน โค้ดฝั่งจอไม่ตรวจการอ้างอิงเพิ่ม (ข้อจำกัดฝั่งฐานข้อมูลไม่พบในโค้ดที่อ่าน)
- เช็ครหัสซ้ำทำที่เบราว์เซอร์ก่อน INSERT และถูกข้ามเมื่อ config มี `rowKey` (1049 `menu_approve_credit_level` ใช้ `roworder` เป็นตัวระบุแถว) — StandardMasterScreen.tsx:590-612; icMasterSchemas.ts:902
- ช่อง "ยกเลิกการใช้งาน" ใน 75 เมนู MASTER แสดงเฉพาะ 1042 `menu_manufacturer_list` (`showStatus: true` ที่ icMasterSchemas.ts:1318); `menu_account_period` ก็ตั้ง `showStatus` (icMasterSchemas.ts:1061) แต่ไปจอ [[scr-master-detail]]
- เมนูที่มี `parentFilter.required` (เช่น 1025 ต้องเลือกคลัง) จะไม่แสดงรายการ และเคลียร์ฟอร์ม จนกว่าจะเลือกกลุ่มแม่ (และกลุ่มชั้นที่ 2 ถ้ามี `dependentFilter`); dropdown จะเลือกตัวแรกให้อัตโนมัติ — StandardMasterScreen.tsx:218-221,270-282
- ปุ่ม "ปิดหน้าจอ" ในโหมดแก้ไขคือยกเลิกการแก้ไข ไม่ได้ปิดแท็บ ปุ่มปิดจริงอยู่ในโหมดอ่าน (มี confirm ถ้ามีข้อมูลค้าง) — StandardMasterScreen.tsx:774-780,1120,1205
- ตัวเลขใน `extraFields` ชนิด number/calc แปลงด้วย `sqlDecimal` และจอใช้ `@/lib/numeric` (`formatMoneyDisplay`, `getBcDecimals`, `cleanNumericString`) ไม่ผ่าน float — ดู [[fe-numeric-money]]
- ข้อความช่วยเหลือคีย์ลัดบอกว่า Escape ยกเลิกการแก้ไข แต่จอนี้ไม่มีตัวดัก Esc (ดู "ปุ่ม / คีย์ลัด")
- ข้อมูลเอกสารแต้ม 6008/6010 ไม่ผ่านเส้นทาง INSERT/UPDATE ปกติ แต่ผ่าน API ฝั่ง Go

## ที่มาในโค้ด
- `frontend/account/tabs/screenRegistry.tsx:152-166,1013-1014` — เลือก StandardMasterScreen/MasterDetailScreen ตาม `config.detail`; BASE_SCREENS มาก่อน config
- `frontend/src/config/schemas/icMasterSchemas.ts:4-60` — ชนิด `MasterFieldDef`, `MasterScreenConfig`
- `frontend/account/master/StandardMasterScreen.tsx:63-80,186-199,283-305` — ตัวแปร config, extraFields, โหลดรายการ
- `frontend/account/master/StandardMasterScreen.tsx:513-682` — บันทึก (ตรวจ, INSERT, UPDATE)
- `frontend/account/master/StandardMasterScreen.tsx:698-780` — fkChecks, ลบ, ปิดจอ
- `frontend/account/master/StandardMasterScreen.tsx:800-909` — ดึงธนาคาร, Ctrl+S
- `frontend/account/master/StandardMasterScreen.tsx:1296-1321,1607,1795` — ช่องรหัส, สถานะ, ThaiBankDirectoryModal
- ลิงก์ดูเพิ่ม: [[fe-master-screens]] [[fe-standard-master-screen]] [[scr-master-detail]] [[scr-data-list-and-lookup]] [[scr-chart-of-accounts]] [[fe-numeric-money]] [[screens-overview]]
