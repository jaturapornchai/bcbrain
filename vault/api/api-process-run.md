---
title: "API เครื่องยนต์ process /process/* — เส้นทาง สิทธิ์ ขนาดบอดี้ (Process engine run API)"
tags: [api, process]
aliases: ["/process","/api/v1/process","/api/process","RequiredRight","routeRights","peekJSON","serveTrans","maxJSONBody","processhttp.Handler"]
sources: ["backend/internal/adapter/inbound/http/router.go:126","backend/internal/adapter/inbound/http/router.go:168","backend/internal/adapter/inbound/http/process/permission.go:23","backend/internal/adapter/inbound/http/process/permission.go:231","backend/internal/adapter/inbound/http/process/handler.go:19","backend/internal/adapter/inbound/http/process/handler.go:189","backend/internal/adapter/inbound/http/process/stocktools_handler.go:23","backend/internal/adapter/inbound/http/middleware/permission.go:60","frontend/src/lib/api-server.ts:496","frontend/src/app/api/process/trans/[action]/route.ts:11"]
---

# API เครื่องยนต์ process `/process/*`

ที่ทำ "งานที่แตะเงิน/สต็อก/GL" ทั้งหมดของระบบ: บันทึก-ลบเอกสาร, rebuild สต็อกและบัญชี, รายงาน, เครื่องมือสต็อก, workflow. ตารางเงินห้ามเขียนผ่าน [[api-query-exec]] ต้องมาทางกลุ่มนี้ (write lockdown, [[adr-0011-query-exec-write-lockdown]]). โครงภายในอ่านที่ [[proc-dispatcher]]; รายการ action แยกตามโดเมนอยู่ในโน้ตต่อไปนี้:

| โดเมน | โน้ต |
|---|---|
| เอกสาร/ธุรกรรม (trans, doc, lookup, cheque, tax, transgrid) | [[api-proc-actions-transaction]] |
| รายงาน (report/run, report/pdf, ai-report-*) | [[api-proc-actions-report]] |
| ข้อมูลหลัก (master, master-detail, itemmaster, itemdetail, barcode, docpicture, itempicture, modifyprice) | [[api-proc-actions-master]] |
| บัญชี GL (gl/*, journal, close, สินทรัพย์) | [[api-proc-actions-gl]] |
| สต็อก (stock/rebuild, stocktools/*) | [[api-proc-actions-stock]] |
| workflow ที่เหลือ + ดัชนี workflow ทั้ง 19 action | [[api-proc-actions-workflow]] |

## เส้นทางและการติดตั้ง

- มี 2 prefix ที่ชี้ handler ชุดเดียวกันทุกตัว: `/process/*` (router.go:127-166) และ `/api/v1/process/*` (router.go:168-208) — ใช้ได้เท่ากัน; Next เรียก `/api/v1/process/*`
- ติดตั้งเมื่อ `ex.Process != nil` เท่านั้น (router.go:126); ทั้งกลุ่มผ่าน `Auth` (Bearer access token, ดู [[api-auth-login]]) แล้วตามด้วย `RequireRight(ex.Rights, processhttp.RequiredRight)` (router.go:128-129)
- provider / database / user ถูกประทับจาก claims ใน token เสมอ (`SetScope`, stocktools_handler.go:23-35; `run(claims.ProviderCode, claims.DatabaseName)`, handler.go:189-205) — ค่าที่ใส่ใน JSON ถูกเขียนทับ ผู้เรียกข้ามบริษัทไม่ได้
- ทุก route เป็น `POST` ยกเว้น 2 route `GET` ส่งรูป: `/docpicture/image?id=` และ `/itempicture/image?id=` (รายละเอียดใน [[api-proc-actions-master]])

| กลุ่ม path | action | handler |
|---|---|---|
| `/stock/rebuild` | - | RebuildStock (router.go:130) |
| `/gl/rebuild`, `/gl/template-defaults`, `/gl/recurring` | - | RebuildGL, GLTemplateDefaults, GLRecurring |
| `/trans/{save,delete,deposits,party-defaults}` | 4 | SaveTrans, DeleteTrans, TransDeposits, TransPartyDefaults |
| `/doc/{save,delete,cancel,approve,bills,flow}` | 6 | SaveDoc, DeleteDoc, CancelDoc, ApproveDoc, DocBills, DocFlow |
| `/lookup/{party-filter,ref-doc-filter,wh-filter,wh-pick-check,wh-perm-filter}` | 5 | Lookup* |
| `/cheque/{rebuild,candidates}`, `/tax/rebuild` | 3 | RebuildCheque, ChequeCandidates, RebuildTransTax |
| `/transgrid/{action}` | 7 | TransGrid |
| `/barcode/{action}` | 9 | Barcode |
| `/master/{action}` | 5 | Master |
| `/master-detail/{save,delete}` | 2 | MasterDetail |
| `/itemmaster/{save,delete}`, `/itemdetail/{get,save}` | 4 | ItemMaster, ItemDetail |
| `/docpicture/{formats,docs,get,save}`, `/itempicture/{list,get,save}` | 7 | DocPicture, ItemPicture |
| `/modifyprice/{preview,apply}` | 2 | ModifyPrice |
| `/stocktools/{action}` | 23 | StockTools |
| `/workflow/{action}` | 19 | Workflow |
| `/report/run`, `/report/pdf` | - | RunReport, RenderReportPDF |

action ที่ไม่รู้จักในกลุ่ม `{action}` = 404 (`KindNotFound`, ข้อความ `unknown <group> action`).

## Response และ error

- สำเร็จ: HTTP 200 `{"ok":true,"data":<ผลลัพธ์>}` (handler.go:84, 216; `serve` ใน stocktools_handler.go:23). `report/pdf` ตอบไฟล์ PDF ตรง ๆ ไม่ใช่ JSON ([[api-proc-actions-report]])
- ล้มเหลว: `response.Error` -> `{"error":{"message":"..."}}` — validation 400 (บอดี้อ่านไม่ได้/เกินขีด = `invalid request body`), 401, 403, 404, 409, อื่น ๆ 500 `internal server error` (ดู [[be-error-response-shape]])
- ตัวอย่างผล `trans/save`: `{"ok":true,"data":{"docNo":"<docNo>","stock":{"itemsProcessed":N,"rowsUpdated":N},"gl":{"docsProcessed":N,"journalsCreated":N,"linesCreated":N,"warnings":[]}}}` (`TransResult`, application/process/trans.go:257; `RebuildStockResult`/`RebuildGLResult`, service.go:44,60)
- ทุกการเรียกบันทึก log (provider, company, user, docNo) ที่ระดับ info/warn — ไม่ log บอดี้ (handler.go:197-211)

## สิทธิ์ (RequiredRight)

`RequireRight` โหลดสิทธิ์เมนูของ session แล้วเทียบกับ right ที่ `RequiredRight(r)` ตัดสิน; ไม่พอ = 403 ข้อความไทยจาก `deniedMessages` (middleware/permission.go:60-80). ชนิด right: `Read`, `Write` (= Add หรือ Edit), `Add`, `Edit`, `Delete`, `Admin` (Admin ผ่านทุกชนิด) — ดู [[proc-permission-rights]], [[be-menu-rights-permission]].

1. **กฎสำคัญ: route ที่ไม่อยู่ใน `routeRights` ต้องใช้ Admin** (permission.go:23-24, 130-132) — ใส่ route ใหม่แล้วลืมจัดชั้น = ล็อกอยู่เป็น Admin โดยอัตโนมัติ (action `workflow/ai-*` ทั้ง 5 ตัวไม่อยู่ในตาราง จึงต้องใช้ Admin)
2. `routeRights` (permission.go:25-52) จัดชั้นตามกลุ่ม:
   - **Read**: ตัวช่วยค้น/คำนวณ/พรีวิว เช่น `doc/bills`, `doc/flow`, `lookup/*`, `cheque/candidates`, `transgrid/*`, `barcode/{item,ean13-check,ean13-generate,print-items,discount-load}`, `docpicture/{formats,docs,get,image}`, `itempicture/{list,get,image}`, `itemdetail/get`, `modifyprice/preview`, `stocktools/{formats,docnonext,barcodecheck,serialanalyze,serialscan,lotamountload,lotautolist,lotautocheck,notcountedlist,itemnextcode,hiddencostcalc}`, `workflow/{journal-list,gl-check,province-list}`, `master/{nextcode,codeleave,assetdepdefaults}`, `report/*`, `gl/{template-defaults,recurring}`, `trans/{deposits,party-defaults}`
   - **Write**: `doc/{cancel,approve}`, `barcode/{save,ean13-apply,discount-save}`, `docpicture/save`, `itempicture/save`, `itemdetail/save`, `modifyprice/apply`, `master-detail/save`, `stocktools/{serialcountsave,lotamountsave,lotautorun,hiddencostsave,notcountedrun,itemsaved,stockbeginningsave,pointdocsave,checkpricesave}`, `workflow/{journal-pass,point-recal,import-transport-label,province-load}`
   - **Delete**: `trans/delete`, `doc/delete`, `master-detail/delete`, `itemmaster/delete`, `stocktools/{stockbeginningdelete,pointdocdelete,hiddencostdelete}`
   - **Admin**: `cheque/rebuild`, `tax/rebuild`, `workflow/{gl-close,change-code,audit-list}`
3. **กฎที่ขึ้นกับบอดี้** (`RequiredRight`, permission.go:54-128; อ่านบอดี้ด้วย `peekJSON` สูงสุด 1 MB แล้วคืนให้ handler, :231):

| route | เงื่อนไขในบอดี้ | right |
|---|---|---|
| `report/run`, `report/pdf` | `customSql` ไม่ว่าง | Admin; ไม่งั้น Read |
| `stock/rebuild` | `ItemCodes` ไม่ว่าง (rebuild เฉพาะสินค้าที่เพิ่งบันทึก) | Write; ทั้งฐาน = Admin |
| `gl/rebuild` | `docNo` ไม่ว่าง (post ใหม่เฉพาะเอกสาร) | Write; ไม่งั้น Admin |
| `trans/save`, `doc/save`, `itemmaster/save`, `stocktools/{pointdocsave,stockbeginningsave}` | `isNew` | Add ถ้าใหม่ ไม่งั้น Edit |
| `master/{datalistget,datalistsave}` | `userCode` ว่างหรือเป็นของตนเอง | Read; ของผู้อื่น = Admin |
| `workflow/check-ic-trans` | `apply:false` | Read; `apply:true` (ซ่อมข้อมูล) = Admin |
| `barcode/format` | `action` = `save` / `delete` / อื่น | Add / Delete / Read |
| `workflow/fa-depreciation` | `delete:true` | Delete; ไม่งั้น Write |
| `workflow/asset-sale` | `op` = `preview` / `delete` / อื่น | Read / Delete / Write |

## ขนาดบอดี้สูงสุด (`MaxBytesReader`)

| ขีด | route | ที่มา |
|---|---|---|
| 16 MB | `stock/rebuild`, `gl/rebuild`, `trans/{save,delete}`, `doc/{save,delete,cancel,approve}`, `report/run`, `report/pdf` | handler.go:19 (`maxJSONBody`) |
| 64 MB | `docpicture/save` (8 รูป x 5 MB เป็น base64) | docpicture_handler.go:32 |
| 48 MB | `itempicture/save` (6 รูป x 5 MB) | stocktools_handler.go:40 |
| 24 MB | `stocktools/stockbeginningsave` | stocktools_handler.go:156 |
| 8 MB | `modifyprice/*`, `stocktools/{serialcountsave,lotamountsave}` | docpicture_handler.go:112; stocktools_handler.go:108,116 |
| 4 MB | `stocktools/*` อื่น ๆ (`small`), `itemdetail/save`, `itemmaster/save` | stocktools_handler.go:90; itemdetail_handler.go:22,35 |
| 1 MB | ที่เหลือทั้งหมด: `decodeCheque` (`doc/{bills,flow}`, `cheque/*`, `tax/rebuild`, `lookup/*`, `trans/{deposits,party-defaults}`, `transgrid/*`, `barcode/*`, `master-detail/*`), `master/*`, `workflow/*`, `gl/{template-defaults,recurring}`, `docpicture/{formats,docs,get}`, `itempicture/{list,get}`, `itemdetail/get`, `itemmaster/delete` | cheque_handler.go:49; master_handler.go:18; workflow_handler.go:25 |

เกินขีด = 400 `invalid request body`. ทั้ง request ยังมี timeout 60 วินาที (router.go:64).

## ตัวอย่างคำขอ

```json
POST /api/v1/process/stock/rebuild      Authorization: Bearer <token>
{"itemCodes":["<itemCode>"]}
```

```json
POST /api/v1/process/gl/rebuild         Authorization: Bearer <token>
{"docNo":"<docNo>","transFlag":<transFlag>}
```

ฟิลด์ของ `stock/rebuild`: `itemCodes[]`, `processCommand`, `updateUnitRatio`, `action`, `flowCommand` (handler.go:33-39); `gl/rebuild`: `docNo`, `transFlag`, `dateFrom`, `dateTo` (handler.go:50-55). ตัวอย่าง `trans/save` เต็มดู [[api-proc-actions-transaction]].

## ผู้เรียกฝั่งหน้าเว็บ

- Next route ใต้ `src/app/api/process/**/route.ts` — แต่ละไฟล์ตรวจ `ACTIONS` (whitelist) ก่อน: action นอกรายการ = 404 `NOT_FOUND`; แล้ว `requireSession` -> `getValidAccessToken` (ไม่มี token = 401 `NO_TOKEN`) -> `proxyToService("/api/v1/process/<group>/<action>")` (api-server.ts:496). ถ้า Go ตอบ JSON ที่มี `ok` เป็น boolean ส่งต่อตรง ๆ; ถ้าไม่ใช่ ห่อสำเร็จเป็น `{ok:true,data}`; 401 = `SESSION_EXPIRED`; อื่น ๆ ใช้ข้อความจาก `error.message` ([[fe-api-proxy-routes]])
- whitelist ต่อ route: `trans` {save, delete, deposits, party-defaults}, `doc` {save, delete, bills, cancel, approve, flow}, `lookup` 5 ตัว, `cheque` {rebuild, candidates}, `transgrid` 7, `barcode` 9, `master` 5, `master-detail` 2, `itemmaster` 2, `itemdetail` 2, `docpicture` 4, `itempicture` 3, `modifyprice` 2, `stocktools` 23, `workflow` 19; route เดี่ยว: `stock/rebuild`, `gl/{rebuild,recurring,template-defaults}`, `tax/rebuild`, `report/{run,pdf}`, `docpicture/image`, `itempicture/image`
- ตัวช่วยกลางใน `src/lib/query-client.ts`: `rebuildStock` :76, `itemNextCode` :83, `saveItemMaster` :90 / ลบ :98, `rebuildGl` :111, `saveTrans` :377, `transGrid*` :444-540, `lookup*` :607-652, `deleteTrans` :683, `saveDoc` :775, `docBills` :785, `deleteDoc` :797, `runReport` :1023, `renderReportPdf` :1033 — ดู [[fe-query-client-sql-builder]]
- หน้าจอเรียก workflow ผ่านตัวช่วย `workflow()` ใน `account/process/SystemProcessWorkbenchScreen.tsx:34-38` ([[fe-process-pos-screens]])

## ที่มาในโค้ด

- `backend/internal/adapter/inbound/http/router.go:126-208`
- `backend/internal/adapter/inbound/http/process/permission.go:14-132,135-161,231`
- `backend/internal/adapter/inbound/http/middleware/permission.go:27,60-80`
- `backend/internal/adapter/inbound/http/process/handler.go:19-40,50-55,84,149-221`
- `backend/internal/adapter/inbound/http/process/stocktools_handler.go:12-40,90,108,116,156`
- `backend/internal/adapter/inbound/http/process/docpicture_handler.go:14-32,112`; `cheque_handler.go:49`; `master_handler.go:18`; `workflow_handler.go:25`; `itemdetail_handler.go:16-44`
- `backend/internal/application/process/trans.go:257`; `service.go:44,60`
- `frontend/src/app/api/process/*/route.ts`; `frontend/src/lib/api-server.ts:496-554`; `frontend/src/lib/query-client.ts:76-1033`
