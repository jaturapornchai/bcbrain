---
title: "บทเรียนการบันทึก master data ไม่ให้ข้อมูลหาย (Master Save: Preserve Columns)"
tags: [history, master-data, save, update, stale-load]
aliases: ["master save preserve columns", "DELETE+INSERT เสียคอลัมน์", "row_order หาย", "M7 code read-only"]
sources: ["git:75c8a5b6", "git:a352b60f", "git:4c503032", "git:91799b37", "git:5435180b", "git:c33a8b55", "backend/internal/application/process/item_master.go:674", "docs/kms/KMS_SECURITY_DATA_INTEGRITY_LESSONS.md:71"]
---

## ภาพรวม
จอ master เขียน SQL จาก browser ถึง 2026-10-19 แล้วสินค้า 2.1.1 ย้ายไป Go (a352b60f, 2026-10-20) บั๊กชนิดเดียวกันวนกลับมา: บันทึกแล้วคอลัมน์นอกจอหายหรือถูกทับ และโหลดที่ช้ากว่ามาทับฟอร์มที่ผู้ใช้กำลังแก้ ปะทุช่วง 2026-10-22..29 (BCAIACC-234, 235) เพราะ DELETE+INSERT ง่ายกว่า UPDATE เฉพาะคอลัมน์

## อาการ
- **A (75c8a5b6):** แก้ตัวแทน `ar_dealer` แล้ว `roworder`, `create_date_time_now` และคอลัมน์นอกจอถูกรีเซ็ต
- **B (4c503032):** `row_order` ของ `ic_unit_use` ที่ผู้ใช้ตั้งไม่ถูกเก็บ กลายเป็นเลขแถว
- **C (91799b37):** รหัสสินค้า/บาร์โค้ดซ้ำตอบ HTTP 409 (commit ไม่ระบุเหตุผล)
- **D (5435180b, c33a8b55):** กด "เพิ่มใหม่" แล้วระเบียนแรกที่โหลดช้ามาทับฟอร์มว่าง; F12 บันทึกค่าเก่าแล้วฟ้องชื่อว่าง
- **E (1ae4ac0c, M7):** จอที่รหัสเป็น lookup (6.1.11) แก้รหัสแถวเดิมได้ UPDATE จึงใช้รหัสใหม่ใน WHERE ทับข้อมูลคนอื่น; เช็ก FK ก่อนลบ query คอลัมน์/ตารางที่ไม่มี
- **F (BCAIACC-234/235):** ค้น `AR0001` ถูกตัดคำ; ค้นชื่ออังกฤษ/บาร์โค้ดไม่เจอ; ตารางต้นทุนมาตรฐานไม่แสดงชื่อหน่วย

## สาเหตุ (root cause)
- A: บันทึกทุกครั้งเป็น `DELETE ...; INSERT ...` (จอสินค้าก่อน a352b60f ก็ DELETE+INSERT `ic_unit_use`, barcode, `ic_wh_shelf`, `ic_standard_cost`)
- B: a352b60f พอร์ตเป็น Go แล้วตั้ง `row_order = line_number` ทิ้งโค้ดเดิม `Number(u.row_order || i+1)`; regress 9 วัน
- D: async โหลดไม่มีเลขรุ่น; effect F12 ไม่มี deps อ่าน `form.values` ค้าง; `BcDataList` default `tableName="ic_inventory"`
- E: `UnitScreen` ถาม `ic_unit_use.unit_code` (คอลัมน์จริงคือ `code`); `fkChecks` ชี้ `ap_supplier_detail.ap_type`, `ar_customer_detail.ar_type` ผิดตาราง

## วิธีแก้
- A: INSERT เฉพาะ isNew นอกนั้น `UPDATE ar_dealer SET ... WHERE upper(code)=upper(...)`
- B: `ItemUnitRow.RowOrder`; INSERT ใช้ `COALESCE(NULLIF(u.row_order,'')::int, u.line_number)`
- C: `apperr.New(KindConflict, ...)` เป็น `validation(...)` (400)
- D: `newSeq`/`docLoadSeq`/`loadSeq` ในจอ master และเอกสาร, guard ใน `masterAutoCode.ts`; effect F12 ไม่ระบุ deps; `tableName` default `""`
- E: รหัสอ่านอย่างเดียวเมื่อไม่ใช่รายการใหม่ เว้นแต่ตั้ง `rowKey`; แก้ query FK ให้ตรงตารางจริง
- F: `hasThai`/`isSameChunk` ใน `thai-search.ts`; แยกช่องค้น name_2/name_eng_1/name_eng_2/`all_barcodes`; `resolveStandardCostUnitName`; ไดอะล็อกบาร์โค้ดข้าม Enter ปิดเมื่อพบสินค้า

## commit ที่เกี่ยวข้อง
- `a352b60f` — save/delete สินค้า 2.1.1 ไป `POST /process/itemmaster/{save,delete}` ใน pgx tx เดียว (ItemScreen -583, `item_master.go` +813)
- `ebe66efd` — `rebuildSerialTx` ใน tx ของ `ItemSaved` (ตามข้อความ commit)
- `4c503032`, `91799b37`, `e6c8e0af`, `536f2f7c`, `5f76fd75` — BCAIACC-234; `75c8a5b6` — BCAIACC-235
- `5435180b`, `c33a8b55` — guard ลำดับโหลด; `1ae4ac0c` — แก้ FK check; `a83aaacd` — ตาราง M/T ใน KMS

## โค้ดปัจจุบันที่ป้องกัน
- `frontend/account/master/DealerScreen.tsx:382` INSERT, `:400` UPDATE
- `backend/internal/application/process/item_master.go:727-730` (INSERT `COALESCE`), `:635`/`:671` (ซ้ำ -> `validation`), `:674` คอมเมนต์ห้าม delete+insert เพราะยอดคงเหลือและต้นทุนต้องคงอยู่
- `backend/internal/application/process/trans.go:1252` `validation()`; `backend/internal/platform/apperr/apperr.go:16` KindConflict = 409
- `backend/internal/application/process/stock_tools.go:562` เรียก `rebuildSerialTx` (`:625`)
- `frontend/account/master/StandardMasterScreen.tsx:169-170` (`newSeq`), `:1310-1324` (`disabled={!isEditing || (!isNew && !config.rowKey)}`)
- `frontend/src/config/schemas/icMasterSchemas.ts:508`; `frontend/src/lib/thai-search.ts:564,576`; `frontend/account/master/BcDataList.tsx:332`

## บทเรียน / กฎที่ได้
1. บันทึก master ด้วย UPDATE เฉพาะคอลัมน์ที่จอรู้จัก ห้าม DELETE+INSERT ตารางที่มี `roworder`/วันที่สร้าง/ยอดที่ตารางอื่นอ้างถึง
2. พอร์ต browser -> Go ต้องเทียบฟิลด์ทีละตัวและมี test ที่ฟิลด์ซึ่งผู้ใช้ตั้งเอง
3. async load ที่เขียนลงฟอร์มต้องมีเลขรุ่นเทียบหลังทุก await (T5 ใน KMS); effect ต้องระบุ deps หรือใช้ ref
4. รหัสของแถวเดิมต้อง read-only (M7); ความผิดที่ผู้ใช้แก้เองได้ใช้ 400 ไม่ใช่ 409
5. ยังไม่ได้ตรวจ: `CustomerDetailScreen`, `DocFormatScreen`, `ProvinceTreeScreen` ยังมี `DELETE FROM ... WHERE upper(code)` ไม่รู้ว่าเป็นแบบ DELETE+INSERT หรือไม่

## ดูเพิ่ม
[[proc-item-master-detail]] · [[proc-master-data]] · [[proc-lookup-filters]] · [[fe-master-screens]] · [[fe-standard-master-screen]] · [[std-data-integrity-money-transactions]] · [[hist-lessons-schema-drift-invented-columns]] · [[hist-lessons-serial-lot-shipment]] · [[hist-lessons-trans-save-rules]] · [[hist-lessons-uat-s1-bugs-2026-10-29]] · [[history-overview]]

## ที่มาในโค้ด
- git: 75c8a5b6, a352b60f, 4c503032, 91799b37, e6c8e0af, 536f2f7c, 5f76fd75, ebe66efd, 5435180b, c33a8b55, 1ae4ac0c, a83aaacd
- `backend/internal/adapter/inbound/http/router.go:161,202`, `process/itemdetail_handler.go:31-44`, `process/permission.go:47,81`
- `docs/kms/KMS_SECURITY_DATA_INTEGRITY_LESSONS.md:71`, `docs/HANDOFF_CLAUDE_CODE_AUDIT.md` ข้อ 2 (1)
