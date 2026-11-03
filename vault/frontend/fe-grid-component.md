---
title: "ตารางรายการและหน้าต่างค้นหา (BcDataList, BcLookupModal, BcLookupInput)"
tags: [frontend, grid, datalist, lookup, search, hotkeys]
aliases: ["BcDataList", "BcLookupModal", "BcLookupInput", "BcDataListCustomizeModal", "ตารางรายการ", "หน้าต่างค้นหา", "lookup", "ค้นหารหัส", "ปรับแต่งคอลัมน์", "custom sql", "LOOKUP_TABLE_MAP", "itemLookupWhere", "ALLOWED_LOOKUP_TABLES"]
sources: ["frontend/account/master/BcDataList.tsx:61", "frontend/account/master/BcDataList.tsx:140", "frontend/account/master/BcDataListCustomizeModal.tsx:326", "frontend/account/master/BcLookupInput.tsx:1", "frontend/account/master/BcLookupModal.tsx:44", "frontend/src/lib/lookup-tables.ts:4", "frontend/src/lib/lookup-filters.ts:32"]
---

# ตารางรายการและหน้าต่างค้นหา

จอบัญชีใช้ 3 ชิ้นส่วนร่วมกันทุกจอ: `BcDataList` (ตารางรายการด้านซ้าย/ล่างของจอหลัก), `BcLookupInput` (ช่องกรอกรหัส + ชื่อ) และ `BcLookupModal` (หน้าต่างค้นหาเลือกรหัส)
ทั้งสามใช้ `queryList/queryLimit` ประกอบ SQL ที่เบราว์เซอร์ ([[fe-query-client-sql-builder]]) และรับสิทธิ์จอจาก [[fe-tabs-workspace]]

## ทำงานอย่างไร

**`BcDataList`** (`BcDataList.tsx`, 1,370 บรรทัด)
- props หลัก: `rows, loading, selectedId, idKey, columns, listKey, tableName, defaultSql`, ตัวจัดการ `onSelect/onNew/onEdit/onEditRow/onRowDoubleClick/onCopy`, ช่องค้นหา `keyword/onKeywordChange/onSearch/onRefresh`, `auto/onAutoChange` (ค้นอัตโนมัติ), `onClose`, `hotkeysActive`, `strictCommands`.
- โหลดทีละ 30 แถวแล้วเลื่อนลงเพื่อโหลดเพิ่ม: `INITIAL_BATCH_SIZE=30`, `LOAD_MORE_STEP=30` (บรรทัด 61-62) ใช้ `IntersectionObserver` (~470).
- สิทธิ์: อ่าน `rights` จาก `tabsCtx.screenRights` (140-141) ถ้าไม่มีสิทธิ์เพิ่ม/แก้ไข จะไม่ส่ง handler ปุ่ม ใหม่/คัดลอก/แก้ไข ต่อ.
- คีย์เก็บค่าตั้งของผู้ใช้ `effectiveListKey` = `listKey` || `tabsCtx.screenKey` || `activeKey` || ลายเซ็น `datalist_...` จากคอลัมน์ (150-156).
- ค้นหาในหน้าจอ (`processedRows`, ~306): ตัดคำ `segmentSearchTokens`, จับคู่ `matchSegmentedAndLike` (ทุกคำ) ถ้าไม่เจอจึงจับคู่บางส่วน + ให้คะแนน `scoreSearchMatch`; กรองขั้นสูง `AdvancedFilterModal` (รหัสจาก-ถึง, ชื่อ 1, ชื่อ 2); แล้วเรียงตามหัวคอลัมน์.
- คีย์ลัด (เมื่อ `hotkeysActive` และแท็บมองเห็น): `Ctrl+F` โฟกัสช่องค้นหา (577), `Insert`/`Alt+N` เพิ่มใหม่ (585), ลูกศร/`Home`/`End`/`PageUp`/`PageDown` เลื่อนแถว (601-626). `BcShortcutsModal` (105 บรรทัด) แสดงรายการคีย์ลัดทั้งหมด รวม `Ctrl+S` และ `Escape` ที่จอแม่ใช้ ([[fe-standard-master-screen]]).

**ปรับแต่งคอลัมน์ต่อผู้ใช้** (`BcDataListCustomizeModal.tsx`, 1,401 บรรทัด)
- สองแท็บ: "columns" (เลือก/เรียง/ตั้งความกว้างคอลัมน์) และ "sql" (394). ชื่อไทยของฟิลด์อยู่ที่ `FIELD_THAI_LABELS` (77), ชุดคอลัมน์สินค้าสำเร็จรูป `ITEM_DATALIST_PRESETS` (162), รูปแบบเซลล์ `formatDataListCellValue` (227).
- เก็บค่าที่ DB ต่อผู้ใช้ผ่าน `POST /api/process/master/datalistget` (`loadUserDataListConfigFromDb`, 326) และ `.../datalistsave` (`saveUserDataListConfigToDb`, 352) และสำรองที่ `localStorage` ด้วยคีย์จาก `getUserDataListStorageKey` (295).
- โหมด `useCustomSql` (398): ผู้ใช้เขียน SQL เองแทน `defaultSql`; `BcDataList` รันผ่าน `queryLimit(sqlClean, 500, 0, true)` (~217) แล้วใช้ผลเป็น `customSqlRows` (268).

**`BcLookupInput`** (`BcLookupInput.tsx`, 174 บรรทัด) - ช่องกรอกรหัส
- props: `value, nameValue, onChange, table, title, whereClause, onOpenLookup, uppercase, notFoundLabel`.
- เมื่อออกจากช่อง (`onBlur`, บรรทัด 126) `fetchName` (51) ดึงชื่อด้วย `queryList` จากตารางที่แปลงชื่อเล่นแล้ว; ถ้าไม่พบรหัสจะเปิด `BcDialog` เตือน (เนื้อหาเรียก `notFoundLabel`).

**`BcLookupModal`** (`BcLookupModal.tsx`, 1,090 บรรทัด) - หน้าต่างค้นหา
- props (129+): `open, title, tableName|table, whereClause, orderBy="code", items` (ส่ง rows เองแทนค้น DB), `columns`, `pageSize=50`, `initialValue`, `onSelect`, `onPickWithLocation(row, whCode, shelfCode, withUnit)` (145), `itemSearchTools` (147), `onClose`.
- ลำดับหาตาราง: `resolveLookupTable(name)` แปลงชื่อเล่นเป็นตารางจริงผ่าน `LOOKUP_TABLE_MAP` (`lookup-tables.ts:4`; ตัวอย่าง `warehouse`->`ic_warehouse`, `gl_account`->`gl_chart_of_account`, `staff`->`erp_user`, `item`->`ic_inventory`, `customer`->`ar_customer`); ไม่ผ่านแผนที่ใช้ชื่อเดิม.
- คอลัมน์: ถ้าผู้เรียกไม่ส่ง `columns` ใช้ `LOOKUP_SCREEN_COLUMNS[ตาราง]` (`lookup-tables.ts:100`, ถอดจาก `bcerpviewtemplate.xml` ของ BCERP เดิมสำหรับจอสินค้า/ลูกหนี้/เจ้าหนี้) หรือค่าเริ่ม รหัส / ชื่อ / ชื่อ (ภาษาอังกฤษ) (150-156); `LookupScreenColumn` มี `expr` (นิพจน์ SQL), `search`, `numKind: "qty"|"amount"` (81). ตารางใน `NO_NAME2_TABLES` (`ic_dimension_name`, `ar_dealer`, บรรทัด 110) ไม่ select `name_2`.
- ค้นหา: หน่วงเวลาเล็กน้อยแล้ว `queryLimit(sql, pageSize, (หน้า-1)*pageSize, true)` เรียง "รหัสตรงเป๊ะ -> ขึ้นต้นด้วยคำค้น -> อื่นๆ" ตามด้วยคอลัมน์ที่เรียง; ใช้ `buildBcSearchWhere(kw, searchFields, strict=true)` (ทุกคำต้องตรง) ถ้าไม่เจอเลยจึงลองแบบหลวม (N-1 คำ) และตั้งธง `partialServer` -> `isPartialFallback` (บรรทัด 362) เพื่อบอกว่าเป็นผลแบบใกล้เคียง (รูปแบบข้อความที่แสดง ยังไม่ยืนยัน).
- คีย์ในหน้าต่าง: ลูกศร ขึ้น/ลง เลือกแถว, `Enter` เลือก, `PageUp/PageDown` เปลี่ยนหน้า (495-511); ถ้า `Enter` ตอนผลยังไม่มา จะจำไว้ใช้เมื่อโหลดเสร็จ (`enterWhilePendingRef`).
- โหมดค้นสินค้า (เมื่อตาราง `ic_inventory` และ `itemSearchTools`): ช่องยิงบาร์โค้ดแปลงเป็น `ic_code` ด้วย SQL ตาราง `ic_inventory_barcode` (~450), ดูยอดคงเหลือด้วย `StockBalanceModal`, เลือกพร้อมคลัง/ที่เก็บ/หน่วยผ่าน `onPickWithLocation`.

**ตัวกรองตามชนิดเอกสาร** (`src/lib/lookup-filters.ts`, ส่งเป็น `whereClause`)
- `itemLookupWhere(transFlag, refDocNo, refTransFlag)` (32): ตัดสินค้า `item_type=5` ออก (ยกเว้นชุด flag ใน `NO_ITEM_TYPE_FILTER`), ถ้าเป็นเอกสารที่ดึงจากอ้างอิง (`REF_LIMITED_ITEMS`) ให้เห็นเฉพาะสินค้าในเอกสารต้นทาง (`ic_trans_detail`), ซ่อนสินค้าหยุดซื้อ (`is_hold_purchase`) ในเอกสารซื้อ และเลิกขาย (`is_hold_sale`) ในเอกสารขาย.
- `saleLookupWhere(transFlag)` (48): พนักงานขายของเอกสารสั่งจอง/สั่งขาย/ขาย ต้อง `is_login_user=0`.
- `shelfLookupWhere(whCode)` (57): เฉพาะที่เก็บของคลังที่เลือก (`whcode=...`).
- ไฟล์นี้อ้างตรรกะจาก C# BCERP เดิมในคอมเมนต์ (ไม่ import อะไรเพื่อให้ `node --test` รันได้).

**ข้อควรระวัง**
- ตารางใหม่ที่จะใช้กับ lookup ต้องเพิ่มชื่อในแผนที่/รายการ `ALLOWED_LOOKUP_TABLES` ไม่งั้นหน้าต่างจะว่างโดยไม่มีข้อความผิดพลาด.

## ที่มาในโค้ด
- `frontend/account/master/BcDataList.tsx:61-62,140-156,191-268,306,470,577-626` - โหลดทีละชุด, สิทธิ์, คีย์ตั้งค่า, ค้นหา, คีย์ลัด
- `frontend/account/master/BcDataListCustomizeModal.tsx:77,162,227,295,326,352,394,398` - ปรับแต่งคอลัมน์/SQL ต่อผู้ใช้
- `frontend/account/master/BcLookupInput.tsx:1-174` - ช่องรหัส + ชื่อ
- `frontend/account/master/BcLookupModal.tsx:43-44,110,129-147,450,495-511` - ตารางที่อนุญาต, props, ค้นหา, คีย์
- `frontend/src/lib/lookup-tables.ts:4,74,81,100,141` - แผนที่ชื่อเล่นตาราง, คอลัมน์ต่อจอ
- `frontend/src/lib/lookup-filters.ts:32,48,57` - ตัวกรอง lookup ตามชนิดเอกสาร

## ดูเพิ่ม
[[frontend-overview]] · [[fe-standard-master-screen]] · [[fe-query-client-sql-builder]] · [[fe-tabs-workspace]] · [[fe-transaction-screens]] · [[fe-form-engine]]
