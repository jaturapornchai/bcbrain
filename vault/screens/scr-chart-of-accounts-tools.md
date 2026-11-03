---
title: "แถบเครื่องมือผังบัญชี (แม่แบบ TFRS / ส่งออก CSV / นำเข้า CSV)"
tags: [screens, master]
aliases: ["ChartOfAccountToolsBar", "แม่แบบผังบัญชี TFRS", "ส่งออก CSV ผังบัญชี", "นำเข้า CSV ผังบัญชี", "coa-tools-bar", "TFRS for NPAEs"]
sources: ["frontend/account/master/ChartOfAccountToolsBar.tsx:30", "frontend/account/master/ChartOfAccountToolsBar.tsx:70", "frontend/account/master/ChartOfAccountToolsBar.tsx:154", "frontend/account/master/ChartOfAccountToolsBar.tsx:172", "frontend/account/master/ChartOfAccountToolsBar.tsx:202", "frontend/account/master/ChartOfAccountToolsBar.tsx:238", "frontend/account/master/ChartOfAccountToolsBar.tsx:264", "frontend/account/master/ChartOfAccountToolsBar.tsx:325", "frontend/account/master/MasterDetailScreen.tsx:1198", "frontend/src/lib/query-client.ts:63"]
---
# แถบเครื่องมือผังบัญชี (ChartOfAccountToolsBar)

แถบด้านบนของจอ [[scr-chart-of-accounts]] ทั้งเมนู 9001 (`menu_chart_of_account`) และ 9002 (`menu_chart_of_account_fast`) มี 3 ปุ่ม: "แม่แบบผังบัญชี TFRS" (เพิ่มชุดบัญชีมาตรฐานที่ยังไม่มี), "ส่งออก CSV / Excel" และ "นำเข้า CSV" ทั้งหมดอยู่ในคอมโพเนนต์ `ChartOfAccountToolsBar` ที่ [[scr-master-detail]] วางไว้เหนือส่วนแสดงข้อผิดพลาดและเนื้อหา (MasterDetailScreen.tsx:1198-1207)
คอมโพเนนต์นี้เขียนตาราง `gl_chart_of_account` ด้วยคำสั่ง SQL โดยตรงผ่าน `queryExecBatch` ไม่ใช้ `master-detail/save` ของ Go

## วิธีเปิด
| ที่ | เงื่อนไข | หลักฐาน |
|---|---|---|
| 9001 รายละเอียดผังบัญชี | `config.menuKey === "menu_chart_of_account"` ส่ง `existingCodes` = รหัสจากรายการซ้าย (`rows`) | MasterDetailScreen.tsx:1198-1203 |
| 9002 ปรับปรุงผังบัญชีแบบเร็ว | `config.menuKey === "menu_chart_of_account_fast"` ส่ง `existingCodes` = รหัสจากกริด `accounts` | MasterDetailScreen.tsx:1198-1202 |

`onRefresh` ของแถบเรียก `setRefreshKey` เพื่อให้จอกลางโหลดรายการใหม่หลังเพิ่ม/นำเข้า (MasterDetailScreen.tsx:1205)

## ปุ่ม / คีย์ลัด
| ปุ่ม | `data-testid` | ทำอะไร |
|---|---|---|
| แม่แบบผังบัญชี TFRS | `coa-open-template-btn` | เปิดโมดัลเลือกชุดแม่แบบ |
| ส่งออก CSV / Excel | `coa-export-csv-btn` | ดึงผังบัญชีทั้งตารางแล้วดาวน์โหลดเป็นไฟล์ CSV |
| นำเข้า CSV | `coa-open-import-btn` | เปิดโมดัลนำเข้า (วางข้อความหรือเลือกไฟล์) |

ทุกปุ่มถูกปิดระหว่างที่งานกำลังทำ (`busy`) ไม่มีคีย์ลัดเฉพาะของแถบนี้ ผลลัพธ์แสดงเป็นแถบข้อความสีเขียว/แดงใต้แถบ (`coa-tools-banner`) ที่กดปิดได้ — ChartOfAccountToolsBar.tsx:172-186,388-440

## โมดัล "เลือกแม่แบบผังบัญชีมาตรฐานไทย (TFRS for NPAEs)"
- 3 ชุด (`CoaTemplatePack`): `trading` "ธุรกิจซื้อมาขายไป" (38 บัญชี), `service` "ธุรกิจบริการ" (38 บัญชี), `manufacturing` "ธุรกิจผลิตและโรงงาน" (42 บัญชี) แต่ละชุด = บัญชีแกนกลาง `CORE_COA_ROWS` 32 บัญชี + บัญชีเฉพาะชุด (6 / 6 / 10) เรียงตามรหัส — ChartOfAccountToolsBar.tsx:30-119
- การ์ดแต่ละชุดแสดงจำนวนบัญชีและ "ขาด N" (จำนวนที่ยังไม่มีในระบบ) ตารางด้านล่างแสดงรหัสบัญชี / ชื่อไทย / ชื่ออังกฤษ / บัญชีคุม (`main_code`) / หมวดบัญชี / สถานะในระบบ ("มีแล้ว" หรือ "+ เพิ่มใหม่") และเยื้องชื่อตามระดับบัญชี
- ข้อความกำกับ: "ระบบจะเพิ่มเฉพาะรหัสบัญชีที่ยังไม่มีในฐานข้อมูล (ไม่ทับรหัสบัญชีเดิมของกิจการ)"
- ปุ่ม "เพิ่มผังบัญชีที่ยังไม่มี (N บัญชี)" เรียก `handleApplyTemplate`: ถ้าไม่ขาดเลยแสดง "ผังบัญชีในชุด ... มีครบในฐานข้อมูลแล้วทั้งหมด" แล้วปิดโมดัล ไม่ก็สร้าง SQL ต่อบัญชีที่ขาดด้วย `buildCoaUpsertSql` แล้วส่ง `queryExecBatch` ครั้งเดียว สำเร็จแล้วแสดง "เพิ่มผังบัญชีมาตรฐาน (...) สำเร็จ N บัญชี" และรีโหลดรายการ — ChartOfAccountToolsBar.tsx:197-200,238-262
- `buildCoaUpsertSql` เขียนแบบ `INSERT ... SELECT ... WHERE NOT EXISTS (จับคู่ UPPER(code))` กำหนดคอลัมน์ `code`, `name_1`, `name_2`, `main_code`, `account_level`, `account_type`, `status`, `balance_mode`, `tax_type`, `balance_sheet_status`, `account_close` และ `active_status = 1` ไม่ได้กำหนดกลุ่มบัญชี / กลุ่มกระแสเงินสด / ธงแยกหน่วยงาน-แผนก-โครงการ (ค่าที่เหลือเป็นค่าเริ่มต้นของตาราง) — ChartOfAccountToolsBar.tsx:154-170

## ส่งออก CSV
`handleExportCsv` อ่านทุกแถวของ `gl_chart_of_account` เรียงตามรหัส 12 คอลัมน์ (`code`, `name_1`, `name_2`, `main_code`, `account_level`, `account_type`, `status`, `balance_mode`, `tax_type`, `balance_sheet_status`, `account_close`, `active_status`) ผ่าน `queryList` (ซึ่งดึงทุกแถว — query-client.ts:13-20) สร้างไฟล์ UTF-8 มี BOM ขึ้นบรรทัดใหม่แบบ CRLF ชื่อไฟล์ `gl_chart_of_account_<วันที่ ISO>.csv` แล้วสั่งดาวน์โหลดทันที — ChartOfAccountToolsBar.tsx:264-323

## นำเข้า CSV
- โมดัล "นำเข้าผังบัญชีจากไฟล์ CSV / Excel": ปุ่ม "เลือกไฟล์ .CSV จากเครื่อง" (อ่านเป็น UTF-8 ลงกล่องข้อความ), ปุ่ม "เติมตัวอย่าง CSV" (ตัวอย่าง 2 แถว), กล่องข้อความวาง CSV (`coa-import-textarea`), ข้อความ "ตรวจพบ N แถวพร้อมนำเข้า" และตารางตัวอย่างพร้อมป้าย "เพิ่มรหัสใหม่" / "อัปเดตรหัสเดิม"
- ลำดับคอลัมน์ที่อ่าน: `code`, `name_1`, `name_2`, `main_code`, `account_level`, `account_type`, `status`, `balance_mode`, `tax_type`, `balance_sheet_status`, `account_close` (ข้ามบรรทัดหัวที่คอลัมน์แรกเป็น `CODE` หรือ "รหัสบัญชี" และข้ามแถวที่ไม่มีรหัสหรือไม่มี `name_1`; รหัสและ `main_code` แปลงเป็นตัวพิมพ์ใหญ่) — ChartOfAccountToolsBar.tsx:130-152,202-236
- ค่าเริ่มต้นเมื่อ "ไม่มีคอลัมน์นั้นในแถว": `account_type` จากเลขหลักแรกของรหัส (1-5 → 0-4 ไม่งั้น 0), `balance_mode` = 1 (เครดิต) เมื่อประเภทเป็น 1-3 ไม่งั้น 0, `account_level` = 1 ถ้ามี `main_code` ไม่งั้น 0, `status` = 0 ถ้ามี `main_code` ไม่งั้น 1, `balance_sheet_status` = 3 เมื่อประเภทเป็น 4 ไม่งั้น 0, `account_close` = `3210-00` เมื่อประเภทเป็น 3 หรือ 4 ไม่งั้นว่าง — ChartOfAccountToolsBar.tsx:218-232
- ปุ่ม "นำเข้าผังบัญชี (N รายการ)" เรียก `handleImportCsv`: รหัสที่มีอยู่ใน `existingCodes` → `UPDATE` (ชื่อ, `main_code`, ระดับ, ประเภท, สถานะ, ด้านบัญชี, ภาษี, ผลกระทบงบ, บัญชีปิด; ไม่แตะ `active_status` และฟิลด์อื่น) ส่วนรหัสใหม่ → `buildCoaUpsertSql` แล้วส่ง `queryExecBatch` ครั้งเดียว สำเร็จแล้วแสดง "นำเข้าและอัปเดตผังบัญชีจาก CSV สำเร็จ N รายการ" ล้างกล่องข้อความและรีโหลดรายการ — ChartOfAccountToolsBar.tsx:325-361

## API / process actions
- `POST /api/query/execBatch` `{sql: string[]}` (ผ่านฟังก์ชัน `queryExecBatch`) — Go รันทุกคำสั่งใน 1 transaction ถ้าคำสั่งใดล้มเหลวจะย้อนทั้งชุด — query-client.ts:61-67; backend/internal/application/query/port.go:100-107
- `POST /api/query/list` (ผ่าน `queryList`) สำหรับส่งออก — query-client.ts:13-20

## ตารางที่ข้อมูลลงไป
- [[tbl-gl-chart-of-account]] เท่านั้น

## ข้อควรระวัง
- แถบนี้ไม่ผ่านกติกาตรวจของ Go ที่ใช้กับการบันทึกปกติ (`master_detail_specs.go` ตรวจช่วงค่า, การมีอยู่ของบัญชีหลัก/กลุ่มบัญชี — [[scr-chart-of-accounts]]) ค่าจาก CSV ถูกใส่ลงในคำสั่ง SQL หลังผ่าน `escapeSql` ส่วนตัวเลขใช้ `Number()` โดยตรง จึงไม่มีการตรวจช่วงค่า 0-4 / 0-7 ฝั่งแถบ (อ่านจากโค้ด ยังไม่ได้ทดสอบกับข้อมูลจริง)
- ช่อง CSV ที่มีคอลัมน์แต่เว้นว่างจะถูกอ่านเป็น 0 เพราะ `Number("") = 0` ถือเป็นตัวเลขที่ใช้ได้ ค่าเริ่มต้นข้างต้นจึงใช้เฉพาะเมื่อแถวสั้นจนไม่มีคอลัมน์นั้นเลย
- ใน 9001 รายการ `existingCodes` มาจากรายการซ้ายที่โหลดสูงสุด 500 แถวและกรองตามคำค้นที่ใช้อยู่ (`queryLimit(sql, 500, 0, true)` — MasterDetailScreen.tsx:250-252) ถ้ารหัสที่นำเข้ามีอยู่ในฐานข้อมูลแต่ไม่อยู่ในรายการที่เห็น แถบจะถือเป็นรหัสใหม่ → ใช้ `INSERT ... WHERE NOT EXISTS` ซึ่งไม่เพิ่มและไม่แก้แถวเดิม แต่ข้อความสำเร็จยังนับรวมแถวนั้น (อนุมานจากโค้ด ยังไม่ได้ทดสอบ) ใน 9002 ใช้รหัสจากกริดที่โหลดสูงสุด 2000 แถว (MasterDetailScreen.tsx:142-157)
- ชื่อชุดบนจอระบุ "TFRS for NPAEs" ตามข้อความในโค้ด ความถูกต้องของรหัส/หมวดตามมาตรฐานบัญชีไทยยังไม่ได้ตรวจในบันทึกนี้ ผู้ใช้ควรทบทวนผังกับนักบัญชีก่อนใช้จริง
- การอัปเดตจาก CSV ทับ `name_1`, `name_2`, `main_code`, ระดับ, ประเภท, สถานะ, ด้านบัญชี, ภาษี, ผลกระทบงบ และ `account_close` ของบัญชีเดิมทั้งหมดตามไฟล์ ไม่มีขั้นยืนยันก่อนส่งนอกจากตารางตัวอย่างในโมดัล

## ที่มาในโค้ด
- `frontend/account/master/ChartOfAccountToolsBar.tsx:30-119,122-170` — แม่แบบ 3 ชุด, ป้ายหมวด, `parseCsvLine`, `buildCoaUpsertSql`
- `frontend/account/master/ChartOfAccountToolsBar.tsx:172-262` — state, การคำนวณรายการที่ขาด, การแยกวิเคราะห์ CSV, `handleApplyTemplate`
- `frontend/account/master/ChartOfAccountToolsBar.tsx:264-361` — `handleExportCsv`, `handleImportCsv`
- `frontend/account/master/ChartOfAccountToolsBar.tsx:388-716` — ปุ่ม แถบแจ้งผล และโมดัลทั้งสอง
- `frontend/account/master/MasterDetailScreen.tsx:250-252,1198-1207` — ที่ติดตั้งแถบและที่มาของ `existingCodes`
- `frontend/src/lib/query-client.ts:13-20,61-67`, `backend/internal/application/query/port.go:100-107` — ช่องทางอ่าน/เขียน SQL
- ดูเพิ่ม: [[scr-chart-of-accounts]] [[scr-master-detail]] [[tbl-gl-chart-of-account]]
