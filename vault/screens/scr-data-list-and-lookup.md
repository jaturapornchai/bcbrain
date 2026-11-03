---
title: "รายการข้อมูล ค้นหา lookup และ dialog กลาง (BcDataList / BcLookupModal / BcDialog)"
tags: [screens, master]
aliases: ["BcDataList", "BcDataListCustomizeModal", "BcLookupModal", "BcLookupInput", "BcDialog", "AdvancedFilterModal", "BcShortcutsModal", "ThaiBankDirectoryModal", "ตัวกรองข้อมูลขั้นสูง", "คู่มือคีย์ลัด", "ปรับคอลัมน์", "DataList", "lookup"]
sources: ["frontend/account/master/BcDataList.tsx:74", "frontend/account/master/BcDataList.tsx:307", "frontend/account/master/BcDataList.tsx:577", "frontend/account/master/BcDataListCustomizeModal.tsx:295", "frontend/account/master/BcLookupInput.tsx:1", "frontend/account/master/BcLookupModal.tsx:129", "frontend/account/master/BcLookupModal.tsx:470", "frontend/account/master/BcDialog.tsx:94", "frontend/account/master/AdvancedFilterModal.tsx:1", "frontend/account/master/BcShortcutsModal.tsx:18", "frontend/account/master/ThaiBankDirectoryModal.tsx:122", "frontend/src/lib/lookup-tables.ts:4"]
---
# รายการข้อมูล ค้นหา lookup และ dialog กลาง

วิดเจ็ตกลางในโฟลเดอร์ `frontend/account/master/` ที่จอ master และจอเอกสารจำนวนมากใช้ร่วมกัน: รายการซ้ายที่ค้นหา/กรอง/ปรับคอลัมน์ได้ (BcDataList), ช่องและหน้าต่างค้นหารหัส (BcLookupInput / BcLookupModal), กล่องข้อความ (BcDialog), ตัวกรองขั้นสูง, คู่มือคีย์ลัด และหน้าต่างเลือกธนาคารไทย
โน้ตนี้อธิบายสิ่งที่ผู้ใช้เห็นและ props ที่มีผล; โค้ดตารางกลางอยู่ใน [[fe-grid-component]] และกติกากริดอยู่ใน [[std-grid-autofit-reset]]; ตัวกรองรหัส lookup อยู่ใน [[proc-lookup-filters]]

## วิธีเปิด
วิดเจ็ตเหล่านี้ไม่มีเมนูของตัวเอง ถูกฝังในจออื่น:
- BcDataList: 27 ไฟล์ import เช่น [[scr-standard-master]] (`StandardMasterScreen`), [[scr-master-detail]] (`MasterDetailScreen`), [[scr-customer]], [[scr-supplier]], [[scr-item-master]], [[scr-warehouse]], `UnitScreen`, `EmployeeScreen`, `DealerScreen`, `SystemProcessWorkbenchScreen`
- BcLookupModal: 20 ไฟล์ import รวม StandardMasterScreen, MasterDetailScreen, CustomerScreen, SupplierScreen, ItemScreen, WarehouseScreen, `UniversalTransScreen` ([[scr-universal-trans]]), `StockBeginningBalanceScreen`, `OptionsForm`
- BcLookupInput: 13 ไฟล์ เช่น StandardMasterScreen, MasterDetailScreen, CustomerScreen, SupplierScreen, ItemScreen, WarehouseScreen, `DealerScreen`, `AssetSaleScreen` ([[scr-asset-sale]]), `FieldControl`
- BcDialog: 32 ไฟล์ import (ใช้ทั้งในจอ master และจอเอกสาร)
- AdvancedFilterModal และ BcShortcutsModal: เปิดจากปุ่มใน BcDataList เท่านั้น (BcDataList.tsx:47-50,1351)
- ThaiBankDirectoryModal: mount โดย StandardMasterScreen เท่านั้น (เมนู 1066 `menu_setup_bank`) — StandardMasterScreen.tsx:1795; ส่วน `BankLogoBadge` ในไฟล์เดียวกันถูกใช้ซ้ำใน BcLookupModal.tsx:26,1016

## ช่องข้อมูลสำคัญและ validation
props / ช่องที่ควรรู้ของแต่ละวิดเจ็ต
| ช่อง / prop | วิดเจ็ต | ชนิด | กติกา | path:line |
|---|---|---|---|---|
| `rows`, `idKey`, `selectedId` | BcDataList | แถวรายการ | `onSelect` เลือกแถว; `onNew` ให้ปุ่ม/คีย์ Insert ทำงาน | BcDataList.tsx:74-108 |
| `columns` | BcDataList | คอลัมน์ | ถ้าไม่ส่ง ใช้รหัส/ชื่อ; ผู้ใช้ปรับเองต่อ `listKey` ได้ | BcDataList.tsx:74-108 |
| `listKey` | BcDataList | string | คีย์เก็บ config ต่อผู้ใช้; ค่าเริ่มต้นคือ `screenKey` ของแท็บ | BcDataList.tsx:151-158 |
| `keyword`, `onSearch`, `auto` | BcDataList | string / bool | Enter = ค้นหา; ติ๊ก "Auto" แล้วพิมพ์แล้วค้นหาทันที | BcDataList.tsx:690-760 |
| `hotkeysActive` | BcDataList | bool (ค่าเริ่มต้น true) | false = ปิดคีย์ลัดของรายการ (เมื่อจอไม่ได้เป็นแท็บที่เห็น) | BcDataList.tsx:74-108,577 |
| ขนาดแบตช์ | BcDataList | 30 แถว | โหลดทีละ 30 แถว (`INITIAL_BATCH_SIZE`, `LOAD_MORE_STEP`) แถวที่เลือกอยู่ลึกกว่าจะขยายให้ | BcDataList.tsx:61-62 |
| `value`, `nameValue`, `onChange(code,name)` | BcLookupInput | string | แสดง `code~name` เมื่อไม่โฟกัส; ตอนโฟกัสแสดงข้อความดิบ | BcLookupInput.tsx |
| `notFoundLabel` | BcLookupInput | string | ตั้งแล้วรหัสที่ไม่พบถูกล้างพร้อมเตือน "ไม่พบ : <ป้าย>"; ไม่ตั้งรหัสที่พิมพ์ยังคงอยู่ | BcLookupInput.tsx |
| `uppercase` | BcLookupInput | bool (ค่าเริ่มต้น true) | แปลงรหัสเป็นตัวพิมพ์ใหญ่ | BcLookupInput.tsx |
| `tableName` / `table`, `orderBy`, `columns`, `pageSize` (50) | BcLookupModal | prop | ตารางต้องอยู่ใน `ALLOWED_LOOKUP_TABLES` ไม่งั้นแสดงรายการว่าง | BcLookupModal.tsx:129-157,44-110,242-248 |
| `onPickWithLocation`, `itemSearchTools` | BcLookupModal | prop | เปิดปุ่มเลือกสินค้าพร้อมคลัง/ที่เก็บ/หน่วยนับ และดูยอดคงเหลือ (lookup สินค้า) | BcLookupModal.tsx:129-157 |
| `type`, `title`, `message`, `confirmText`, `cancelText` | BcDialog | prop | ชนิด lock_for_edit / confirm / alert / success / error | BcDialog.tsx |
| `criteria` {codeFrom, codeTo, name1, name2} | AdvancedFilterModal | object | กรองฝั่งเบราว์เซอร์เฉพาะแถวที่โหลดแล้ว | AdvancedFilterModal.tsx |
| `open`, `existingCodes`, `importing`, `onImportBanks`, `onPickSingleBank` | ThaiBankDirectoryModal | prop | เลือกธนาคารแล้วนำเข้า หรือเลือกทีละแห่งเติมฟอร์ม | ThaiBankDirectoryModal.tsx:122-131 |

การค้นหาใน BcDataList: ตัดคำไทย/อังกฤษเป็น token แล้วต้องตรงทุก token (AND LIKE) ก่อน ถ้าไม่พบและมี token ≥ 2 จะผ่อนเป็นการตรงบางส่วนพร้อมป้ายบอก; ผลเรียงตามคะแนนความเกี่ยวข้อง หรือตามคอลัมน์ที่ผู้ใช้คลิกหัวตาราง (`localeCompare("th-TH")`) — BcDataList.tsx:307-424,764-840
ตัวกรองขั้นสูง: รหัสจาก–ถึง (เปรียบเทียบข้อความตัวพิมพ์เล็ก), ชื่อ 1, ชื่อ 2 (ตัดคำเช่นเดียวกัน) ทำงานหลังตัวกรองคำค้น — BcDataList.tsx:284-303,307-424
ค่าเงินและปริมาณในรายการแสดงตามรูปแบบคอลัมน์ (`DataListColFormat`: auto, text, qty, price, amount, int) ซึ่งจัดรูปแบบผ่าน `@/lib/numeric` — ดู [[fe-numeric-money]] — BcDataListCustomizeModal.tsx:36-75

## ปุ่ม / คีย์ลัด
คีย์ลัดของรายการ (BcDataList.tsx:577-630; ปิดเมื่อมี modal ตัวกรอง/คู่มือ/flow/ปรับคอลัมน์เปิดอยู่ หรือ `hotkeysActive=false`) และตาราง `SHORTCUTS` ใน BcShortcutsModal.tsx:18-54:
| คีย์ | หน้าที่ | หมวด |
|---|---|---|
| Ctrl + S | บันทึกข้อมูลในหน้าจอแก้ไข/เพิ่มใหม่ | form |
| Escape | ยกเลิกโหมดแก้ไข / ปิดหน้าต่างตัวกรอง / ล้างค่า | form |
| Insert, Alt + N | สร้างรายการใหม่ (New Record) | form |
| Ctrl + F | โฟกัสช่องข้อความค้นหาทันที | search |
| ↑ ↓ | เลื่อนเลือกรายการก่อนหน้า / ถัดไป | grid |
| Home, End | ไปแถวแรกสุด / แถวสุดท้าย | grid |
| PageUp, PageDown | เลื่อนกระโดดทีละ 10 แถว | grid |

ตัวดักคีย์ที่พบในโค้ดจริง: รายการ — Ctrl+F, Insert/Alt+N, ↑↓, Home/End, PageUp/PageDown ±10 (BcDataList.tsx:577-630); BcDialog — Esc = ยกเลิก/ปิด, Enter = ยืนยัน (ดักตอน capture, ข้ามถ้าโฟกัสอยู่ที่ช่อง `barcode-search-input`) (BcDialog.tsx:94-106); BcLookupModal — Esc ปิด, ↑↓ เลื่อน, Enter เลือก, PageUp/PageDown เปลี่ยนหน้า, Ctrl+B ไปช่องบาร์โค้ด (เฉพาะ lookup สินค้า) (BcLookupModal.tsx:470-520)
Ctrl+S และ Esc ที่คู่มือบอกนั้นทำงานในจอที่มี handler เอง (ผ่าน `useShortcuts` ใน `frontend/account/master/ScreenFrame.tsx`) ส่วน StandardMasterScreen และ MasterDetailScreen มี Ctrl+S แต่ไม่พบ handler Esc/F12
ปุ่มบนแถบเครื่องมือของรายการ (title): "ลำดับขั้นตอนการทำงาน (Flow)", ช่องค้นหา "ข้อความค้นหา (ตัดคำไทย/อังกฤษ)", "ล้างคำค้นหา", "ตัวกรองข้อมูลขั้นสูง" (มีจุดแสดงเมื่อกรองอยู่), "ค้นหา / ซูมข้อมูล", "ปรับคอลัมน์", "ค่าเริ่มต้น" (รีเซ็ตความกว้างคอลัมน์), ช่อง "Auto", ตัวนับ "แสดงแล้ว X จากทั้งหมด Y รายการ" — BcDataList.tsx:690-760
ปุ่มแถบซ้าย: "เพิ่มรายการใหม่ (Insert)", คัดลอก, "แถวก่อนหน้า (↑)", "แถวถัดไป (↓)", "ไปยังแถวแรก (Home)", "ไปยังแถวสุดท้าย (End)", ปรับแต่งคอลัมน์และ SQL ของผู้ใช้, คำแนะนำการใช้งาน (Help), "ปิดหน้าจอ" — BcDataList.tsx:849-980

## popup / modal ที่เรียกได้
- BcDataListCustomizeModal: ปรับตารางรายการซ้ายแยกตามผู้ใช้ มี 2 แท็บ "1. จัดการคอลัมน์ & เลือกฟิลด์" และ "2. คำสั่งดึงข้อมูล (SQL Query)"; ต่อคอลัมน์ ซ่อน/แสดง ย้ายขึ้นลง จัดชิด รูปแบบตัวเลข ลบ; แท็บ SQL มีช่องใช้ SQL กำหนดเอง ปุ่มทดสอบ และเติมคอลัมน์จากผลลัพธ์ — BcDataListCustomizeModal.tsx:381+
  - จอสินค้า: ปุ่มสร้าง SQL อัตโนมัติ (`generateAutoSqlFromColumns`) ดึงบาร์โค้ด หน่วย และราคา (`price`–`price_4`, `price_member`–`price_member_4`) จากบาร์โค้ดแถวแรกของสินค้าใน `ic_inventory_barcode` (เรียง `line_number`, `roworder`) เท่านั้น สินค้าที่ไม่มีบาร์โค้ดได้บาร์โค้ดว่างและราคา 0 ไม่ย้อนไปใช้ `ic_inventory.barcode_1` หรือ `price_0` — BcDataListCustomizeModal.tsx:713-758
- AdvancedFilterModal: "ตัวกรองข้อมูลขั้นสูง (Advanced Filter)" ช่อง "ช่วงรหัส (Code Range)" จากรหัส/ถึง, "ชื่อ 1", "ชื่อ 2"; ปุ่ม "ล้างตัวกรอง", "ยกเลิก", "กรองข้อมูล" (Enter ก็ใช้ได้) — AdvancedFilterModal.tsx
- BcShortcutsModal: "คู่มือคีย์ลัด BC Account (Keyboard Shortcuts)" ปุ่ม "เข้าใจแล้ว" เปิดจากปุ่ม Help ของรายการ — BcShortcutsModal.tsx:18-105
- Flow modal: "ลำดับขั้นตอนการทำงานมาตรฐาน (BC Account Workflow)" 4 ขั้น ปุ่ม "รับทราบ / ปิดหน้าต่าง" — BcDataList.tsx:1275-1347
- BcLookupModal: ช่องค้นหา "พิมพ์คำค้นหา (ตัดคำไทย/อังกฤษอัตโนมัติ)..." รายการแบ่งหน้า (50 แถว) คลิกแถวหรือ Enter เพื่อเลือก; lookup สินค้ามีช่องบาร์โค้ด "ยิงหรือพิมพ์บาร์โค้ดแล้วกด Enter" (ค้น `ic_inventory_barcode.ic_code`) และปุ่ม "เลือกสินค้าแถวนี้พร้อมคลัง/ที่เก็บ", "...พร้อมหน่วยนับ", "ดูยอดคงเหลือของสินค้าแถวนี้ตามคลัง" — BcLookupModal.tsx:470-520
- BcDialog: ชนิด `lock_for_edit` แสดง "<ผู้ใช้> : ต้องการ Lock รายการนี้ก่อนแก้ไขหรือไม่" พร้อมช่อง "ต้องการแสดงหน้าจอนี้อีกในครั้งต่อไป" (key ใน localStorage `bc_lock_for_edit_show_again` ใช้โดย CustomerScreen / CustomerDetailScreen); ชื่อเริ่มต้น "สำเร็จ" / "ผิดพลาด" / "เตือน" ปุ่ม "ตกลง" / "ยกเลิก"; ถ้าข้อความตรงกับเซสชันหมดอายุ (`isSessionExpiredError`) ปุ่มเป็น "เข้าสู่ระบบใหม่" และพากลับหน้า login — BcDialog.tsx
- ThaiBankDirectoryModal: ค้นหารหัส (เช่น KBANK, SCB, 004) หรือชื่อ, กรองหมวด (ธนาคารพาณิชย์ไทย / ธนาคารของรัฐ-SFI / สาขาธนาคารต่างประเทศ), ปุ่ม "เลือกทั้งหมด", "เลือกธนาคารหลักยอดนิยม (19 แห่ง)", "ล้างที่เลือก", ตัวนับ "เลือกไว้ N จาก M แห่ง" และ "มีในฐานข้อมูลแล้ว N แห่ง", ปุ่ม "ดึงธนาคารที่เลือกเข้าสู่ระบบ (N แห่ง)"; เปิดมาโดยเลือกทุกธนาคารไว้ก่อน — ThaiBankDirectoryModal.tsx:143

## API / process actions
- รายการรับ `rows` จากจอเจ้าของ; BcDataList query เองเฉพาะเมื่อผู้ใช้เปิด "ใช้ SQL กำหนดเอง" และจอไม่ได้ส่ง `onCustomSqlChange` มา (`queryLimit` สูงสุด 500 แถว — BcDataList.tsx:205-224). BcLookupModal ค้นเองจากตารางใน whitelist ด้วย `buildBcSearchWhere` แบบดีบาวน์ซ์: เข้มงวดก่อน ถ้าไม่พบผ่อนเหลือ N-1 คำ (ตั้งป้ายบางส่วน) เรียงรหัสตรง รหัสขึ้นต้น แล้วคอลัมน์เรียง — BcLookupModal.tsx:254-310
- BcLookupInput ตรวจชื่อตอนออกจากช่อง: `select coalesce(name_1,'') ... from <table> where upper(code)=upper(...) [and (whereClause)] limit 1`
- config รายการต่อผู้ใช้: `POST /api/process/master/datalistget` และ `datalistsave` (บันทึก null = ลบแถว) เก็บในตาราง [[tbl-erp-user-datalist-config]]; สำเนาใน localStorage ใช้คีย์ `bc_datalist_user_cfg_v1_<db>_<USER>_<listKey>` แต่ฐานข้อมูลคือต้นฉบับ — BcDataListCustomizeModal.tsx:295-365; backend `adapter/inbound/http/process/master_handler.go:15,32,36`, `application/process/master_datalist.go:14-25` (user_code ≤ 100, list_key ≤ 150)
- ตารางที่ BcLookupModal ยอมรับ: `ALLOWED_LOOKUP_TABLES` สร้างจากคีย์/ค่าของ `LOOKUP_TABLE_MAP` (`frontend/src/lib/lookup-tables.ts:4`, alias เช่น gl_account → gl_chart_of_account, side → erp_side_list) รวมตารางหลัก เช่น `ic_inventory`, `gl_chart_of_account`, `erp_user`, `erp_department_list`; ชื่อตารางต้องผ่าน `SAFE_IDENT_RE`
- BcDialog / AdvancedFilterModal / BcShortcutsModal / ThaiBankDirectoryModal ไม่เรียก API เอง (ThaiBankDirectoryModal ส่งรายการกลับให้ StandardMasterScreen เขียน `erp_bank` — StandardMasterScreen.tsx:800-860)

## ตารางที่ข้อมูลลงไป
- [[tbl-erp-user-datalist-config]] (config คอลัมน์/SQL ของรายการต่อผู้ใช้)
- [[tbl-erp-bank]] (ผ่าน ThaiBankDirectoryModal → StandardMasterScreen)
- วิดเจ็ตอื่นไม่เขียนตารางเอง (ค้นหรือแสดงเท่านั้น)

## ข้อควรระวัง
- ตัวกรองขั้นสูงและการค้นหาในรายการทำกับแถวที่จอเจ้าของโหลดมาแล้วเท่านั้น (เช่น StandardMasterScreen / MasterDetailScreen โหลดสูงสุด 500 แถว) ไม่ได้ค้นทั้งตาราง
- `AdvancedFilterModal` เก็บค่าในช่องด้วย `useState(criteria)` ครั้งเดียวตอน mount ไม่ซิงก์ใหม่เมื่อเปิดซ้ำ; ปุ่ม "ล้างตัวกรอง" ล้างทั้ง 4 ช่อง — AdvancedFilterModal.tsx
- BcLookupModal แสดงรายการว่างโดยไม่แจ้งข้อผิดพลาดเมื่อตารางไม่อยู่ใน whitelist
- BcLookupInput ที่ไม่ตั้ง `notFoundLabel` จะเก็บรหัสที่พิมพ์ผิดไว้ในช่อง ไม่แจ้งเตือน
- BcDialog จับ Enter เป็น "ยืนยัน" ดังนั้นการกด Enter ซ้ำเมื่อกล่องยืนยันลบเปิดอยู่จะยืนยันการลบ (กล่องยืนยันลบของ StandardMasterScreen / MasterDetailScreen ใช้ BcDialog) — BcDialog.tsx:94-106
- ข้อความในคู่มือคีย์ลัดว่า Escape ยกเลิกการแก้ไข ไม่เป็นจริงใน StandardMasterScreen และ MasterDetailScreen (ไม่มี handler Esc); ปุ่ม F3/F4/F8 ที่ปรากฏในความเห็น/ปุ่มของ BcLookupModal ไม่พบ handler คีย์ในโค้ด
- config รายการต่อผู้ใช้อยู่ที่ DB เป็นหลัก ถ้าสลับผู้ใช้จะเห็นคอลัมน์ของผู้ใช้นั้น; modal ปรับคอลัมน์เปลี่ยนผู้ใช้เป้าหมายได้
- ทุกธนาคารในรายการถูกเลือกไว้ล่วงหน้าตอนเปิด ThaiBankDirectoryModal การกดนำเข้าทันทีจะส่งทั้งหมด (รหัสที่มีแล้วต้องมีสิทธิ์แก้ รหัสใหม่ต้องมีสิทธิ์เพิ่ม)

## ที่มาในโค้ด
- `frontend/account/master/BcDataList.tsx:74-158,307-424,577-630,690-980,1275-1363` — props, ค้นหา/กรอง, คีย์ลัด, แถบเครื่องมือ, modal
- `frontend/account/master/BcDataListCustomizeModal.tsx:36-75,295-365,381+` — ชนิด config, API/localStorage, modal
- `frontend/account/master/BcLookupInput.tsx`, `frontend/account/master/BcLookupModal.tsx:43-157,242-310,470-520` — ช่อง/หน้าต่างค้นหา
- `frontend/src/lib/lookup-tables.ts:4,74,100` — `LOOKUP_TABLE_MAP`, `resolveLookupTable`, `LOOKUP_SCREEN_COLUMNS`
- `frontend/account/master/BcDialog.tsx:94-106`, `AdvancedFilterModal.tsx`, `BcShortcutsModal.tsx:18-54`, `ThaiBankDirectoryModal.tsx:122-143`
- `backend/internal/adapter/inbound/http/process/master_handler.go:15,32,36`, `backend/internal/application/process/master_datalist.go:14-25`
- ลิงก์ดูเพิ่ม: [[fe-grid-component]] [[std-grid-autofit-reset]] [[proc-lookup-filters]] [[scr-standard-master]] [[scr-master-detail]] [[fe-numeric-money]] [[screens-overview]]
