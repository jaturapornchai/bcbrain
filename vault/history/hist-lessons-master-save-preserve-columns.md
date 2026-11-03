---
title: "บทเรียนการบันทึก master data ไม่ให้ข้อมูลหาย (Master Save: Preserve Columns)"
tags: [history, lesson, master-data, save, update, stale-load]
aliases: ["master save preserve columns", "DELETE+INSERT เสียคอลัมน์", "row_order หาย", "รหัสแถวเดิม read-only", "newSeq loadSeq"]
sources: ["backend/internal/application/process/item_master.go:674", "backend/internal/application/process/item_master.go:727", "backend/internal/application/process/item_master.go:635", "backend/internal/application/process/item_master.go:671", "backend/internal/application/process/trans.go:1252", "frontend/account/master/DealerScreen.tsx:382", "frontend/account/master/DealerScreen.tsx:400", "frontend/account/master/StandardMasterScreen.tsx:170", "frontend/account/master/StandardMasterScreen.tsx:311", "frontend/account/master/StandardMasterScreen.tsx:456", "frontend/account/master/StandardMasterScreen.tsx:1310", "frontend/account/master/MasterDetailScreen.tsx:169", "frontend/src/lib/thai-search.ts:576", "docs/kms/KMS_SECURITY_DATA_INTEGRITY_LESSONS.md:71"]
---
# บทเรียนการบันทึก master data ไม่ให้ข้อมูลหาย

บันทึกแบบ `DELETE` แล้ว `INSERT` ทำง่าย แต่ทำให้คอลัมน์ที่จอไม่รู้จัก (`roworder`, `create_date_time_now`, ยอดที่ตารางอื่นอ้างถึง) ถูกรีเซ็ต และถ้าโหลดรายการที่ช้ากว่ามาทับฟอร์มที่ผู้ใช้กำลังแก้ ข้อมูลจะถูกบันทึกผิดเอกสาร

## อะไรพังได้
- **คอลัมน์นอกจอถูกรีเซ็ต:** แก้ตัวแทน `ar_dealer` ด้วย DELETE+INSERT แล้ว `roworder`/วันที่สร้างและคอลัมน์ที่จอไม่แสดงกลับเป็นค่าเริ่มต้น
- **สินค้าเสียยอดและต้นทุน:** ถ้าบันทึก `ic_inventory` ด้วย DELETE+INSERT ยอดคงเหลือและต้นทุนที่ผูกกับแถวนั้นหาย
- **ค่าที่ผู้ใช้ตั้งเองถูกแทน:** `row_order` ของ `ic_unit_use` ถ้า backend ตั้งเป็นเลขแถวเสมอ ลำดับที่ผู้ใช้เรียงไว้ไม่ถูกเก็บ
- **โหลดช้ามาทับฟอร์ม:** กด "เพิ่มใหม่" ระหว่างที่รายการแรกกำลังโหลด ผลที่มาถึงทีหลังจะเขียนทับฟอร์มว่าง
- **แก้รหัสของแถวเดิม:** จอที่รหัสเป็น Lookup ถ้าแก้รหัสบนแถวเดิมได้ `UPDATE ... WHERE code = <รหัสใหม่>` จะไปทับข้อมูลของรหัสอื่น
- **ซ้ำแล้วตอบผิดชนิด:** รหัสสินค้า/บาร์โค้ดซ้ำเป็นความผิดที่ผู้ใช้แก้เองได้ ควรตอบ 400 (`KindValidation`) พร้อมข้อความไทย ไม่ใช่ 409 (`KindConflict`)
- **ค้นรหัสผสมถูกตัดคำ:** รหัสแบบ `AR0001` ถ้าตัดคำเป็นตัวอักษรกับตัวเลขแยกกัน จะค้นไม่เจอ

## โค้ดป้องกันไว้อย่างไร
| ด่าน | ที่อยู่ | ทำอะไร |
|---|---|---|
| บันทึกแถวหลักด้วย INSERT/UPDATE | `item_master.go:674` `writeItemMaster` (คอมเมนต์: ห้าม delete+insert เพราะยอดและต้นทุนต้องคงอยู่) | `ic_inventory` ใช้ insert เมื่อใหม่ และ update เมื่อแก้ |
| ตารางลูกของสินค้า | `item_master.go:726-755` | ลบและเขียนใหม่เฉพาะตารางลูก (`ic_unit_use`, บาร์โค้ด, `ic_wh_shelf`, `ic_standard_cost`) ใน tx เดียวกับแถวหลัก |
| เก็บ `row_order` ที่ผู้ใช้ตั้ง | `item_master.go:727-728` | `COALESCE(NULLIF(u.row_order, '')::int, u.line_number)` |
| ซ้ำ = 400 | `item_master.go:635`, `:671` เรียก `validation()` (`trans.go:1252`) | คืน `apperr.KindValidation` พร้อมข้อความไทย |
| ตัวแทนแก้ด้วย UPDATE | `DealerScreen.tsx:382` (INSERT เฉพาะใหม่), `:400` (UPDATE เฉพาะคอลัมน์ที่จอรู้จัก) | คอลัมน์ระบบไม่ถูกแตะ |
| ผลโหลดช้าไม่ทับ | `StandardMasterScreen.tsx:170` `newSeq`, `:311`; `MasterDetailScreen.tsx:169` `loadSeq`, `:337` | เทียบเลขรุ่นหลัง await ถ้าผู้ใช้กด "เพิ่มใหม่" แล้วทิ้งผลที่มาถึงทีหลัง |
| ถามก่อนทิ้งข้อมูลที่กำลังแก้ | `StandardMasterScreen.tsx:456` `confirmDiscard` | ครอบปุ่มเพิ่มใหม่ ปุ่มแก้ไขแถว และดับเบิลคลิกแถว (`:1045-1062`) |
| รหัสแถวเดิมอ่านอย่างเดียว | `StandardMasterScreen.tsx:1310` | ช่องรหัสปิดเมื่อไม่อยู่ในโหมดแก้ไข หรือไม่ใช่รายการใหม่และจอไม่มี `rowKey` ทำให้แก้รหัสได้เฉพาะรายการใหม่ (จอที่รหัสซ้ำได้ตั้ง `rowKey`) |
| ค้นรหัสผสม | `thai-search.ts:576-580` | ถ้าคำไม่มีอักษรไทย ตัวอักษรละตินกับตัวเลขอยู่ chunk เดียวกัน |

## กฎที่ต้องจำ
1. บันทึกแถวหลักของ master ด้วย UPDATE เฉพาะคอลัมน์ที่จอรู้จัก ห้าม DELETE+INSERT ตารางที่มี `roworder`/วันที่สร้าง/ยอดที่ตารางอื่นอ้างถึง
2. ฟิลด์ที่ผู้ใช้ตั้งเองต้องมีช่องใน struct ฝั่ง backend และมีค่าตกหล่นที่ชัดเจน (`COALESCE`)
3. โหลดแบบ async ที่เขียนลงฟอร์มต้องมีเลขรุ่นเทียบหลังทุก `await` (`docs/kms/KMS_SECURITY_DATA_INTEGRITY_LESSONS.md` ข้อ T5, M7)
4. รหัสของแถวเดิมต้อง read-only ความผิดที่ผู้ใช้แก้เองได้ตอบ 400
5. ข้อควรตรวจเมื่อเพิ่มจอใหม่: จอที่ยังเขียน `DELETE FROM ... WHERE upper(code)` ในฝั่ง browser ต้องเช็คว่าเป็น DELETE+INSERT ของตารางที่มีคอลัมน์ระบบหรือไม่ (ยังไม่ได้ตรวจทุกจอ)

## ที่มาในโค้ด
- `backend/internal/application/process/item_master.go:674-760` เขียนสินค้า
- `frontend/account/master/StandardMasterScreen.tsx:170,311,456,1310` เลขรุ่น ถามก่อนทิ้ง รหัส read-only
- `docs/kms/KMS_SECURITY_DATA_INTEGRITY_LESSONS.md:70-71` ข้อ M6 และ M7
- ดูเพิ่ม: [[proc-item-master-detail]] · [[proc-master-data]] · [[proc-lookup-filters]] · [[fe-master-screens]] · [[fe-standard-master-screen]] · [[std-data-integrity-money-transactions]] · [[hist-lessons-schema-drift-invented-columns]] · [[hist-lessons-serial-lot-shipment]] · [[hist-lessons-trans-save-rules]] · [[history-overview]]
