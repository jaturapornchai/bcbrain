---
title: "ตารางรายการและหน้าต่างค้นหา (BcDataList, BcLookupModal, BcLookupInput)"
tags: [frontend, grid, datalist, lookup, search, hotkeys]
aliases: ["BcDataList", "BcLookupModal", "BcLookupInput", "BcDataListCustomizeModal", "ตารางรายการ", "หน้าต่างค้นหา", "lookup", "ค้นหารหัส", "ปรับแต่งคอลัมน์", "custom sql", "LOOKUP_TABLE_MAP", "itemLookupWhere", "ALLOWED_LOOKUP_TABLES"]
sources: ["frontend/account/master/BcDataList.tsx:63", "frontend/account/master/BcDataList.tsx:141", "frontend/account/master/BcDataListCustomizeModal.tsx:326", "frontend/account/master/BcLookupInput.tsx:1", "frontend/account/master/BcLookupModal.tsx:45", "frontend/src/lib/lookup-tables.ts:4", "frontend/src/lib/lookup-filters.ts:32"]
---

# ตารางรายการและหน้าต่างค้นหา

จอบัญชีใช้ 3 ชิ้นส่วนร่วมกันทุกจอ: `BcDataList` (ตารางรายการด้านซ้าย/ล่างของจอหลัก), `BcLookupInput` (ช่องกรอกรหัส + ชื่อ) และ `BcLookupModal` (หน้าต่างค้นหาเลือกรหัส)
ทั้งสามใช้ `queryList/queryLimit` ประกอบ SQL ที่เบราว์เซอร์ ([[fe-query-client-sql-builder]]) และรับสิทธิ์จอจาก [[fe-tabs-workspace]]

## ทำงานอย่างไร

**`BcDataList`** (`BcDataList.tsx`, 1,431 บรรทัด)
- props หลัก: `rows, loading, selectedId, idKey, columns, listKey, tableName, defaultSql`, ตัวจัดการ `onSelect/onNew/onEdit/onEditRow/onRowDoubleClick/onCopy`, ช่องค้นหา `keyword/onKeywordChange/onSearch/onRefresh`, `auto/onAutoChange` (ค้นอัตโนมัติ), `onClose`, `hotkeysActive`, `strictCommands`.
- โหลดทีละ 30 แถวแล้วเลื่อนลงเพื่อโหลดเพิ่ม: `INITIAL_BATCH_SIZE=30`, `LOAD_MORE_STEP=30` (บรรทัด 63-64) ใช้ `IntersectionObserver` (บรรทัด 472) เพิ่มจำนวนแถวที่แสดงเมื่อเลื่อนถึงท้ายตาราง.
- สิทธิ์: อ่าน `rights` จาก `tabsCtx.screenRights` (141) แล้วคิด `canAdd`/`canEdit` (142-143): ไม่มีสิทธิ์เพิ่ม = ไม่ส่ง handler `onNew`/`onCopy`, ไม่มีสิทธิ์แก้ไข = ไม่ส่ง `onEdit`/`onEditRow`/`onRowDoubleClick` ต่อ (144-148).
- คีย์เก็บค่าตั้งของผู้ใช้ `effectiveListKey` = `listKey` || `tabsCtx.screenKey` || `activeKey` || ลายเซ็น `datalist_...` จากคอลัมน์ (153-159).
- ค้นหาในหน้าจอ (`processedRows`, บรรทัด 311): ตัดคำ `segmentSearchTokens`, จับคู่ `matchSegmentedAndLike` (ทุกคำ) ถ้าไม่เจอจึงจับคู่บางส่วน + ให้คะแนน `scoreSearchMatch`; กรองขั้นสูง `AdvancedFilterModal` (รหัสจาก-ถึง, ชื่อ 1, ชื่อ 2); แล้วเรียงตามหัวคอลัมน์.
- คีย์ลัด (เมื่อ `hotkeysActive` และแท็บมองเห็น): `Ctrl+F` โฟกัสช่องค้นหา (590-591), `Insert`/`Alt+N` เพิ่มใหม่ (599), ลูกศร/`Home`/`End`/`PageUp`/`PageDown` เลื่อนแถว (615-646; `PageUp/PageDown` ข้ามทีละ 10 แถว). ทั้งหมดอยู่ใน `useEffect` ที่ออกก่อนถ้า `hotkeysActive` เป็นเท็จหรือแท็บถูกซ่อน (586-588). `BcShortcutsModal` (105 บรรทัด) แสดงรายการคีย์ลัดทั้งหมด รวม `Ctrl+S` และ `Escape` ที่จอแม่ใช้ ([[fe-standard-master-screen]]).

**ปรับแต่งคอลัมน์ต่อผู้ใช้** (`BcDataListCustomizeModal.tsx`, 1,439 บรรทัด)
- สองแท็บ: "columns" (เลือก/เรียง/ตั้งความกว้างคอลัมน์) และ "sql" (394). ชื่อไทยของฟิลด์อยู่ที่ `FIELD_THAI_LABELS` (77), ชุดคอลัมน์สินค้าสำเร็จรูป `ITEM_DATALIST_PRESETS` (162), รูปแบบเซลล์ `formatDataListCellValue` (227).
- เก็บค่าที่ DB ต่อผู้ใช้ผ่าน `POST /api/process/master/datalistget` (`loadUserDataListConfigFromDb`, 326) และ `.../datalistsave` (`saveUserDataListConfigToDb`, 352) และสำรองที่ `localStorage` ด้วยคีย์จาก `getUserDataListStorageKey` (295).
- โหมด `useCustomSql` (398): ผู้ใช้เขียน SQL เองแทน `defaultSql`; ถ้าจอแม่ไม่ส่ง `onCustomSqlChange` มา `BcDataList` รันเองผ่าน `queryLimit(sqlClean, 500, 0, true)` (บรรทัด 219) แล้วเก็บผลเป็น `customSqlRows` (166) และใช้แทน `rows` (270).

**`BcLookupInput`** (`BcLookupInput.tsx`, 174 บรรทัด) - ช่องกรอกรหัส
- props: `value, nameValue, onChange, table, title, whereClause, onOpenLookup, uppercase, notFoundLabel`.
- เมื่อออกจากช่อง (`onBlur`, บรรทัด 126) `fetchName` (51) ดึงชื่อด้วย `queryList` จากตาราง `table` ตามที่ผู้เรียกส่งมา (ไม่แปลงชื่อเล่นผ่าน `LOOKUP_TABLE_MAP` จึงต้องส่งชื่อตารางจริง) และต่อ `whereClause` ให้เฉพาะเมื่อไม่มี `;` หรือ `--` (บรรทัด 60-61); ถ้าไม่พบรหัสและมี `notFoundLabel` จะล้างรหัสแล้วเปิด `BcDialog` เตือน "ไม่พบ : ..." (131-136, 162-166).

**`BcLookupModal`** (`BcLookupModal.tsx`, 1,120 บรรทัด) - หน้าต่างค้นหา
- props (130+): `open, title, tableName|table, whereClause, orderBy="code", items` (ส่ง rows เองแทนค้น DB), `columns`, `pageSize=50`, `initialValue`, `onSelect`, `onPickWithLocation(row, whCode, shelfCode, withUnit)` (146), `itemSearchTools` (148), `onClose`.
- ลำดับหาตาราง: `resolveLookupTable(name)` แปลงชื่อเล่นเป็นตารางจริงผ่าน `LOOKUP_TABLE_MAP` (`lookup-tables.ts:4`; ตัวอย่าง `warehouse`->`ic_warehouse`, `gl_account`->`gl_chart_of_account`, `staff`->`erp_user`, `item`->`ic_inventory`, `customer`->`ar_customer`); ไม่ผ่านแผนที่ใช้ชื่อเดิม.
- คอลัมน์: ถ้าผู้เรียกไม่ส่ง `columns` ใช้ `LOOKUP_SCREEN_COLUMNS[ตาราง]` (`lookup-tables.ts:100`, กำหนดคอลัมน์ตายตัวไว้ในโค้ดสำหรับจอสินค้า/ลูกหนี้/เจ้าหนี้ ไม่อ่านไฟล์ภายนอกตอนรัน) หรือค่าเริ่ม รหัส / ชื่อ / ชื่อ (ภาษาอังกฤษ) (`DEFAULT_COLUMNS`, `BcLookupModal.tsx:155-159`); `LookupScreenColumn` มี `expr` (นิพจน์ SQL), `search`, `numKind: "qty"|"amount"` (81). ตารางใน `NO_NAME2_TABLES` (`ic_dimension_name`, `ar_dealer`) ไม่ select `name_2` (`BcLookupModal.tsx:111`).
- ค้นหา: หน่วงเวลาเล็กน้อยแล้ว `queryLimit(sql, pageSize, (หน้า-1)*pageSize, true)` เรียง "รหัสตรงเป๊ะ -> ขึ้นต้นด้วยคำค้น -> อื่นๆ" ตามด้วยคอลัมน์ที่เรียง; ใช้ `buildBcSearchWhere(kw, searchFields, strict=true)` (ทุกคำต้องตรง) ถ้าไม่เจอเลยจึงลองแบบหลวม (N-1 คำ) และตั้งธง `partialServer` (306) -> `isPartialFallback` (363-364) แล้วแสดงป้าย "แสดงผลใกล้เคียง" (755-757). ลำดับค้นอยู่ที่ `BcLookupModal.tsx:279-297`.
- คีย์ในหน้าต่าง: ลูกศร ขึ้น/ลง เลือกแถว, `Enter` เลือก, `PageUp/PageDown` เปลี่ยนหน้า (497-516); `Ctrl+B` เปิดช่องยิงบาร์โค้ดเฉพาะโหมดค้นสินค้า (493-495); ถ้า `Enter` ตอนผลยังไม่มา จะจำไว้ใช้เมื่อโหลดเสร็จ (`enterWhilePendingRef`).
- โหมดค้นสินค้า (เมื่อตาราง `ic_inventory` และ `itemSearchTools`): ช่องยิงบาร์โค้ดแปลงเป็น `ic_code` ด้วย SQL ตาราง `ic_inventory_barcode` (`searchByBarcode`, 448-454), ดูยอดคงเหลือด้วย `StockBalanceModal`, เลือกพร้อมคลัง/ที่เก็บ/หน่วยผ่าน `onPickWithLocation`.

**ตัวกรองตามชนิดเอกสาร** (`src/lib/lookup-filters.ts`, ส่งเป็น `whereClause`)
- `itemLookupWhere(transFlag, refDocNo, refTransFlag)` (32): ตัดสินค้า `item_type=5` ออก (ยกเว้นชุด flag ใน `NO_ITEM_TYPE_FILTER`), ถ้าเป็นเอกสารที่ดึงจากอ้างอิง (`REF_LIMITED_ITEMS`) ให้เห็นเฉพาะสินค้าในเอกสารต้นทาง (`ic_trans_detail`), ซ่อนสินค้าหยุดซื้อ (`is_hold_purchase`) ในเอกสารซื้อ และเลิกขาย (`is_hold_sale`) ในเอกสารขาย.
- `saleLookupWhere(transFlag)` (48): พนักงานขายของเอกสารสั่งจอง/สั่งขาย/ขาย ต้อง `is_login_user=0`.
- `shelfLookupWhere(whCode)` (57): เฉพาะที่เก็บของคลังที่เลือก (`whcode=...`).
- ไฟล์นี้ไม่ import โมดูลอื่นเลย เพื่อให้ `node --test` รันได้ตรงๆ (ไฟล์ทดสอบ `lookup-filters.test.ts`).

**ข้อควรระวัง**
- ตารางใหม่ที่จะใช้กับ lookup ต้องเพิ่มชื่อในแผนที่/รายการ `ALLOWED_LOOKUP_TABLES` ไม่งั้นหน้าต่างจะว่างโดยไม่มีข้อความผิดพลาด.

## ที่มาในโค้ด
- `frontend/account/master/BcDataList.tsx:63-64,141-159,166,198-219,270,311,472,586-646` - โหลดทีละชุด, สิทธิ์, คีย์ตั้งค่า, SQL ของผู้ใช้, ค้นหา, คีย์ลัด
- `frontend/account/master/BcDataListCustomizeModal.tsx:77,162,227,295,326,352,394,398` - ปรับแต่งคอลัมน์/SQL ต่อผู้ใช้
- `frontend/account/master/BcLookupInput.tsx:11-24,51-71,126-139,162-166` - props, ดึงชื่อ, ออกจากช่อง, เตือนไม่พบรหัส
- `frontend/account/master/BcLookupModal.tsx:45-111,130-150,155-159,279-297,363-364,448-454,487-516,755-757` - ตารางที่อนุญาต, props, คอลัมน์ตั้งต้น, ค้นหา, บาร์โค้ด, คีย์, ป้ายผลใกล้เคียง
- `frontend/src/lib/lookup-tables.ts:4,74,81,100,142` - แผนที่ชื่อเล่นตาราง, คอลัมน์ต่อจอ, คอลัมน์ค้นเจ้าหนี้ของจอจ่ายชำระหนี้ (`LOOKUP_AP_PAYMENT_COLUMNS`)
- `frontend/src/lib/lookup-filters.ts:32,48,57` - ตัวกรอง lookup ตามชนิดเอกสาร

## ดูเพิ่ม
[[frontend-overview]] · [[fe-standard-master-screen]] · [[fe-query-client-sql-builder]] · [[fe-tabs-workspace]] · [[fe-transaction-screens]] · [[fe-form-engine]]
