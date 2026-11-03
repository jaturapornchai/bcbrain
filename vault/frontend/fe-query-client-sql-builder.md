---
title: "ตัวเรียก API และตัวประกอบ SQL ฝั่งเบราว์เซอร์ (api-client, query-client, bc-query-builder)"
tags: [frontend, api-client, query, sql, thai-search]
aliases: ["apiPost", "apiGet", "ApiResult", "queryList", "queryLimit", "queryExec", "queryExecBatch", "buildInsertSql", "buildBcSearchWhere", "escapeSql", "thai-search", "ค้นหาภาษาไทย"]
sources: ["frontend/src/lib/api-client.ts:24", "frontend/src/lib/api-client.ts:86", "frontend/src/lib/api-client.ts:160", "frontend/src/lib/query-client.ts:16", "frontend/src/lib/query-client.ts:374", "frontend/src/lib/bc-query-builder.ts:136", "frontend/src/lib/bc-query-builder.ts:263", "frontend/src/lib/thai-search.ts:539"]
---

# ตัวเรียก API และตัวประกอบ SQL ฝั่งเบราว์เซอร์

จอบัญชีเรียก backend ผ่าน 3 ชั้น: `api-client.ts` (fetch พื้นฐาน + จัดการ session หมดอายุ), `query-client.ts` (ฟังก์ชันสำเร็จรูปต่อ endpoint) และ `bc-query-builder.ts` (ประกอบ SQL string แบบเดียวกับ BCERP เดิม)
ข้อมูลหลักอ่าน/เขียนด้วย SQL ที่เบราว์เซอร์ประกอบเอง ส่วนงานที่มีกติกาธุรกิจ (บันทึกเอกสาร, คำนวณยอด, รายงาน) เรียก `/api/process/*`

## ทำงานอย่างไร

**`api-client.ts`**
- `ApiResult<T> = {ok:true,data} | {ok:false,error,code?}` (บรรทัด 13-24); ฟังก์ชัน `apiGet/apiPost/apiPut/apiPatch/apiDelete` (บรรทัด 160-185) ห่อ `request()` ที่ `fetch` แบบ `cache:"no-store"` + `Content-Type: application/json` และ **ไม่ throw** - ต้องเช็ก `res.ok` ทุกครั้ง.
- ถ้าได้ 401 หรือ code อยู่ใน `NO_SESSION/NO_TOKEN/SESSION_EXPIRED/UNAUTHORIZED` (หรือข้อความ "หมดเวลาใช้งาน") จะบันทึก `sessionStorage["bc_return_to"]` แล้ว dispatch event `bc:session-expired` (บรรทัด 77-90, 112-118, 134-141) ให้ `PersistentWorkspaceHost` แสดง modal ([[fe-app-shell-routing]]). ยกเว้น `/api/auth/login`.
- เมื่อ POST ที่เปลี่ยนฐานข้อมูล/ผู้ใช้ (`/api/auth/login|demo|google|databases`, `/api/workspace/select-db`) สำเร็จ เรียก `invalidateBcSettings()` เพื่อโหลดทศนิยม/ปี พ.ศ. ใหม่ (บรรทัด 10, 146-148) - ดู [[fe-numeric-money]].
- 403 ที่ไม่มี body -> "ไม่มีสิทธิ์เข้าถึงข้อมูลส่วนนี้ (403)" (บรรทัด 123-127).

**`query-client.ts`** (ฟังก์ชันสำคัญ; ทุกตัวคืน `ApiResult`)
| ฟังก์ชัน | endpoint | หมายเหตุ |
|---|---|---|
| `queryList(sql)` | `POST /api/query/list` | SELECT/WITH ทุกแถว (บรรทัด 16) |
| `queryLimit(sql, limit=50, offset=0, includeTotal=true, source?)` | `/api/query/limit` | แบ่งหน้า + นับรวม (25) |
| `queryExec(sql)` | `/api/query/exec` | INSERT/UPDATE/DELETE (44) |
| `queryBatch(sql[])`, `queryExecBatch(sql[])` | `/api/query/batch`, `/api/query/execBatch` | หลายคำสั่งใน transaction เดียว (54, 63) |
| `saveTrans`, `deleteTrans`, `saveDoc`, `deleteDoc`, `setDocStatus` | `/api/process/trans/*`, `/api/process/doc/*` | บันทึก/ลบ/อนุมัติ/ยกเลิกเอกสาร (374, 679, 774, 791, 801) |
| `transTotals`, `transGridLine`, `transGridFormula`, `transGridShortcut`, `transGridPriceInfo`, `transFx`, `transGridRefImport` | `/api/process/transgrid/*` | คำนวณตารางรายการ (441-540, 672) |
| `getPartyDefaults`, `getPartyLookupFilter`, `getRefDocLookupFilter`, `getWhLookupFilter`, `checkWhPick`, `getWhPermFilter`, `listOpenDeposits`, `outstandingBills` | `/api/process/trans/*`, `lookup/*`, `doc/bills` | ค่าตั้งต้นคู่ค้า/คลัง/มัดจำ/ใบค้างชำระ (553-790) |
| `rebuildStock`, `rebuildGl`, `itemNextCode`, `itemMasterSave/Delete` | `/api/process/stock|gl|stocktools|itemmaster/*` | (72-111) |
| `runBackendReport`, `fetchBackendReportPdf` | `/api/process/report/run|pdf` | รายงาน (1020, 1029) |

**`bc-query-builder.ts`** (ลอกวิธีเดียวกับ BCERP เดิม `MyLib._myScreen.cs`)
- `escapeSql`, `sqlText/sqlLookup/sqlDecimal/sqlDate/formatSqlFieldValue` (24-96) แปลงค่าฟอร์มเป็น literal (ว่าง -> `null`).
- `buildInsertSql/buildUpdateSql/buildDeleteSql` (263/292/321) สร้าง SQL จาก `ScreenSchema` ([[fe-form-engine]]); `masterLogSql` (35) บันทึก log การ เพิ่ม/แก้/ลบ ลง `master_logs`.
- `buildBcSearchWhere(keyword, searchFields=["code","name_1"], strict=false)` (136) สร้างเงื่อนไขค้นหา: แยกคำด้วยช่องว่าง, คำที่ขึ้นต้น `+` = ต้องตรงตัว, ใช้ `thai-search.ts` ตัดคำไทยเป็นพยางค์/ขยายคำพ้อง/หน่วยนับค้าส่ง และเมื่อคำค้นยาว (>= 3 พยางค์) ยอมให้ตรงบางส่วน (N-1) ยกเว้น `strict=true` (ใช้กับ lookup) ซึ่งเป็น AND ทุกคำ.

**ข้อควรระวัง**
- SQL ถูกประกอบที่เบราว์เซอร์แล้วส่งเป็นข้อความ (`{sql}`); ตารางที่เกี่ยวกับเงิน/เอกสารใช้ endpoint `/api/process/*` แทน.
- ทศนิยมของ SQL ใช้ `decimalSql` ใน `numeric.ts` ไม่ใช้ `Number()` ([[fe-numeric-money]]).

## ที่มาในโค้ด
- `frontend/src/lib/api-client.ts:13-24,76-160` - ApiResult, session expired, request
- `frontend/src/lib/query-client.ts:16-111,374-820,1020-1060` - endpoint wrappers
- `frontend/src/lib/bc-query-builder.ts:17-96,136-215,263-330` - SQL builders
- `frontend/src/lib/thai-search.ts:539-668` - ตัดคำ/ให้คะแนนการค้นหา

## ดูเพิ่ม
[[frontend-overview]] · [[fe-api-proxy-routes]] · [[fe-grid-component]] · [[fe-numeric-money]] · [[fe-form-engine]] · [[backend-overview]]
