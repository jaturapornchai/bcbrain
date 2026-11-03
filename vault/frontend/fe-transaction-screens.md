---
title: "จอเอกสารธุรกรรมแบบเดียวกันทุกจอ (UniversalTransScreen)"
tags: [frontend, transaction, document, ic_trans, ap_ar_trans, workbench]
aliases: ["UniversalTransScreen", "UniversalTransactionScreen", "TransactionEngineScreen", "จอเอกสาร", "ใบสั่งซื้อ ใบขาย จอบันทึกเอกสาร", "TransLayoutConfig", "getTransLayout", "TransGridMode", "handleSave", "saveTrans", "saveDoc", "generateDocNo", "ยกเลิกเอกสาร", "อนุมัติเอกสาร", "UniversalCancelConfirmScreen"]
sources: ["frontend/account/transaction/UniversalTransScreen.tsx:402", "frontend/account/transaction/UniversalTransScreen.tsx:2576", "frontend/account/transaction/UniversalTransScreen.tsx:2893", "frontend/account/transaction/transLayouts.ts:193", "frontend/account/transaction/UniversalCancelConfirmScreen.tsx:469", "frontend/src/lib/doc-no.ts:17"]
---

# จอเอกสารธุรกรรมแบบเดียวกันทุกจอ (`UniversalTransScreen`)

เอกสารซื้อ/ขาย/สินค้าคงคลัง/ลูกหนี้/เจ้าหนี้/เงินสดธนาคาร/สมุดรายวัน (160 เมนู) ใช้คอมโพเนนต์เดียว `UniversalTransScreen` (4,319 บรรทัด) แล้วปรับหน้าตาด้วย "config ต่อเมนู" (`transMenuMap.ts`) และ "layout ต่อชนิดเอกสาร" (`transLayouts.ts`)
รายชื่อเมนูทั้งหมดอยู่ใน [[fe-transaction-menu-purchase-sale-stock]] และ [[fe-transaction-menu-debt-cashbank]]

## ทำงานอย่างไร

**ทางเข้า**: `screenRegistry` สร้างจอด้วย `createTransScreen` ([[fe-screen-registry-menu]]) ส่ง `config.menuKey` เข้า `UniversalTransScreen` (`UniversalTransScreen.tsx:402`); `TransactionEngineScreen.tsx` และ `UniversalTransactionScreen.tsx` เป็นไฟล์ re-export สั้นๆ (8-9 บรรทัด).
1. `getTransMenuConfig(menuKey)` (`transMenuMap.ts:2466`) ให้ `transFlag, transType, kind, partyType, mode, calcFlag, prefix, docFormatCode, screenCode, isTransfer, hasRefDoc, refTransFlags, origFlag, transFlags, inquiryTypeDefault` (บรรทัด 410-444); ค่าที่ไม่มีใน map ตกไปใช้ `config.*` แล้วค่าเริ่ม (`transFlag 44`, `transType 2`, `kind ic_trans`).
2. ถ้า `mode` เป็น `cancel` หรือ `approve` -> เรนเดอร์ `UniversalCancelConfirmScreen` (ดูด้านล่าง) นอกนั้น -> `UniversalTransDocScreen` (หน้าบันทึกเอกสาร).

**`kind` (ตารางหลัก)**: `ic_trans` (145 เมนู), `ap_ar_trans` (8), `cb_chq_list` (5 - เช็ค), `gl_journal` (2). `cb_trans` ใช้เฉพาะแสดงรายการ/ยกเลิก ส่วนการบันทึก/ลบ `cb_trans` ตรงๆ ในจอนี้ throw "ยังไม่รองรับ" (`UniversalTransScreen.tsx:2649,2897`). `primaryTable` (1053) ใช้เลือกตารางสำหรับรายการเอกสารและสร้างเลขที่.

**Layout ต่อชนิดเอกสาร** (`transLayouts.ts`): `getTransLayout(transFlag, ...)` (274) คืน `TransLayoutConfig` (193) ซึ่งคือชุดสวิตช์ว่าจอนี้แสดงอะไร เช่น `showParty/partyLabel`, `showInquiryType` + `inquiryOptions` (ประเภทการซื้อ/ขาย เงินสด-เชื่อ), `showVatType` (`VAT_TYPE_OPTIONS`), `showTaxDoc`, `showRefDoc`, `showCreditAndDue`, `showSaleCode`, `showTransferWarehouse` (โอนคลัง), `showDepartment/showBranch`, `showHeaderAmount`, `showOnHold`, `showApproval`, `showExpire`, `showDepositTerm`, `showTransport`, คอลัมน์ในตาราง (`showWhLocation, showLotNumber, showDiscount, showPrice, compareUnitColumns, qcTotalQtyColumn, mfnColumn`) และแท็บ (`showMoreTab, showTaxTab, showVatTab, showWhtTab, showPayTab, showDepositTab`).
- `gridMode: TransGridMode` (`transLayouts.ts:30`) = `item` (ตารางสินค้า) | `amount` (ตารางรายการเป็นจำนวนเงิน) | `bills` (ตารางใบค้างชำระ) | `deposit` | `none`.
- ข้อความตัวเลือกเป็นข้อความตรงตัวจาก resource ของโปรแกรม BC C# เดิม (คอมเมนต์ที่ `transLayouts.ts:34`); ไฟล์ทดสอบ `transLayouts.test.ts`.

**ส่วนประกอบหน้าจอ** (ไฟล์ใน `account/transaction/`; ลำดับตามการเรนเดอร์ใน `UniversalTransScreen.tsx`)
| ส่วน | ไฟล์ | หน้าที่ |
|---|---|---|
| รายการเอกสารซ้าย | `TransDocListPane.tsx` (137 บรรทัด) ภายใต้ `ResizableSplit` (2992) | ช่วงวันที่ + `BcDataList` (ดู [[fe-grid-component]]) |
| หัวเอกสาร | `TransTopForm.tsx` (958) | ช่องหัวเอกสารตามสวิตช์ใน `TransLayoutConfig` (เลขที่ วันที่ คู่ค้า ประเภท VAT เครดิต คลัง ฯลฯ) |
| แถบรายวันประจำ | `GlRecurringBar.tsx` (57) | เลือกรายการ `gl_recurring` (ผ่าน `POST /api/process/gl/recurring`) มาเติมสมุดรายวัน |
| ตารางใบค้างชำระ | `TransBillsGrid.tsx` (530) | จอลูกหนี้/เจ้าหนี้ (ตัดชำระใบวางบิล) |
| ตารางสินค้า | `TransItemGrid.tsx` (1284) | รายการสินค้า/จำนวนเงิน (ดู `Modal` ด้านล่าง) |
| แท็บมัดจำ | `TransDepositTab.tsx` (147) | หักเงินล่วงหน้า/มัดจำ |
| ภาษี / หัก ณ ที่จ่าย | `JournalTaxTabs.tsx` (1174) | แท็บ VAT และ WHT |
| แท็บเพิ่มเติม | `TransExtraTabs.tsx` (1145) + `TransPayTendersGrid.tsx`, `TransPayOtherGrid.tsx` | ข้อมูลเสริมของเอกสาร, รับ/จ่ายชำระ (เงินสด/โอน/เช็ค/บัตร/รายได้-ค่าใช้จ่ายอื่น), สมุดรายวันของจอ GL |
| แผงล่าง/ยอดรวม | `TransBottomPanel.tsx` (459) | ยอดรวมจาก `TransTotalsResult` + ช่องวันที่ (ใช้ `transDates.ts`) และข้อมูลท้ายเอกสาร |
| ผังเอกสาร | `DocumentFlowModal.tsx` (1107) | แสดงเอกสารต้นทาง/ปลายทาง |
| พิมพ์ฟอร์ม | `GlobalDocFormPrintModal` (4247) | ดู [[fe-report-print-designer]] |
| กล่องช่วย | `StockBalanceModal, SerialNumberModal, LotModal, PriceInfoModal, PriceFormulaModal, ItemHistoryModal, ItemRemarkModal, ItemNameModal, ItemReplacementModal, CostLockModal, CreditApproveModal, ChequePickerModal, GridShortcutPopover, ItemGridContextMenu` | ยอดคงเหลือ, ซีเรียล, ล็อต, ราคา ฯลฯ |

**โหลดรายการเอกสาร**: `loadDocList` (1061) ประกอบ SQL ตามชนิดตาราง (เช็ค `cb_chq_list`, สมุดรายวัน `gl_journal` (แสดง `book_code` เป็นรหัส), `pp_trans` และเอกสารทั่วไปจาก `primaryTable` join `ap_supplier` หรือ `ar_customer` ตาม `partyType`), กรอง `trans_flag IN (...)`, ตัดเอกสารที่ `last_status <> 0` (ยกเลิกแล้ว) ยกเว้น `cb_trans`, ค้นด้วย `ILIKE` เลขที่/รหัสคู่ค้า/หมายเหตุ, `LIMIT 150` (1121-1172). ใช้ `escapeSql` กับคำค้น. `loadDocDetail` (1203) โหลดหัว + บรรทัด + แท็บอื่น ด้วย `queryList` ต่อตาราง `*_trans`/`*_trans_detail`.

**เพิ่มเอกสารใหม่**: `handleStartNew` (1895) ต้อง `rights.canAdd` -> ตั้งวันที่/เวลาเป็นวันนี้, ตั้ง `inquiryType` เป็นค่าเริ่ม, ล้างสาขา/แผนก/คู่ค้า, เรียก `getPartyDefaults` ([[fe-query-client-sql-builder]]) แล้ว `handleAutoDocNo` (1855) ขอเลขที่ถัดไปจาก `generateDocNo` (`doc-no.ts:17`) = `POST /api/process/stocktools/docnonext` ตามตาราง `erp_doc_format` (ผิดพลาด = แสดงข้อความ ไม่เริ่มเลขที่ 1 เงียบๆ ตามคอมเมนต์ `doc-no.ts:13-15`).

**คำนวณยอด**
- ทุกครั้งที่บรรทัด/ส่วนลด/VAT/มัดจำ/สกุลเงินเปลี่ยน รอ 200 ms แล้วเรียก `transTotals` (`/api/process/transgrid/totals`) เก็บใน `serverTotals` (822-841); ยอดสดที่แสดงทันทีคำนวณฝั่งหน้าจอด้วย `vatCalc`/`sumDec` (`totals` memo ~846, ดู [[fe-numeric-money]]).
- แก้บรรทัดสินค้า (รหัส/จำนวน/ราคา/หน่วย/ส่วนลด) เรียก `transGridLine` (2149) ส่ง `changed` + บรรทัดที่เกี่ยวข้อง backend ตอบบรรทัดที่คำนวณใหม่; สินค้าชุด (`item_type` 3,5) ส่งบรรทัดย่อยไปด้วย (2143-2146). ทางลัดกรอกช่อง (`transGridShortcut`, 3773), สกุลเงิน (`transFx`, 779/817).

**บันทึกเอกสาร** `handleSave` (2576)
1. `canSaveWithRights(rights, isNewDoc)` (เอกสารใหม่ต้อง `canAdd` เดิมต้อง `canEdit`) ไม่ผ่านก็ออกเงียบ; ต้องมีเลขที่และวันที่เอกสาร; ต้องโหลดข้อมูลสกุลเงิน (`fxActive`) ได้.
2. `kind` = `cb_chq_list`/`gl_journal`/`ap_ar_trans` -> `saveDoc` (`/api/process/doc/save`); `ic_trans` -> `saveTrans` (`/api/process/trans/save`) พร้อม `lines` จาก `toSaveLine` (270), แท็บรับ/จ่ายชำระ (`pay.*`: เงินสด/โอน/พร้อมเพย์/เช็ค/บัตร/รายได้-ค่าใช้จ่ายอื่น), VAT/WHT.
3. backend ตอบ error พิเศษ `CONFIRM:<ข้อความ>` -> `window.confirm` แล้วส่งซ้ำพร้อม `confirmed`; `CREDIT_PASSWORD:<ข้อความ>` (เกินวงเงินเครดิต) -> เปิด `CreditApproveModal` ให้ผู้มีสิทธิ์ใส่ผู้ใช้/รหัสอนุมัติแล้วส่งซ้ำ (2796-2812).
4. สำเร็จ: เก็บคลัง/ที่เก็บล่าสุดใน `localStorage["ictrans_recent_<transFlag>"]` ใช้เป็นค่าเริ่มของเอกสารใหม่ (C# `_setRecent`), รีโหลดรายการ, ถามพิมพ์ (`postSavePrintPromptDocNo`) หรือเปิดพิมพ์ทันที.
5. `Ctrl+S` ผูกที่ window `keydown` เมื่อกำลังแก้ไขและแท็บมองเห็น (2980).

**ลบเอกสาร**: `handleDelete` (2909) ต้อง `rights.canDelete`, `window.confirm` แล้ววน `deleteOneDoc` (2893): `ic_trans` -> `deleteTrans` (`/process/trans/delete`), ชนิดอื่น -> `deleteDoc` (`/process/doc/delete`).

**จอยกเลิก/อนุมัติเอกสาร** `UniversalCancelConfirmScreen` (1,040 บรรทัด)
- ใช้กับเมนูที่ `mode` = `cancel` (61 เมนู) หรือ `approve` (5 เมนู). เลือกเอกสารเดิม (`origFlag`) แล้วเรียก `setDocStatus(mode, {flag, origFlag, docRef, docFormat, screenCode, docDate, remark, undo, cancelType, lines, cancelDocNo, approveLines, notApprove, menuName})` (`UniversalCancelConfirmScreen.tsx:469`) = `POST /api/process/doc/cancel` หรือ `/api/process/doc/approve` (`query-client.ts:820`).
- รองรับ "ยกเลิกรายสินค้า" (`cancelType 2` ส่งเฉพาะบรรทัดที่ใส่จำนวนยกเลิก), "ไม่อนุมัติ" (`notApprove`), "ยกเลิกการอนุมัติ/คืนสถานะ" (`undo`). เลขที่ใบยกเลิกออกฝั่ง backend (คอมเมนต์ ~บรรทัด 463 อ้าง `doc_cancel.go nextDocNo`).

**ข้อควรระวัง**
- ทุกเมนูเอกสารใหม่แก้ที่ `transMenuMap.ts` + `transLayouts.ts` ไม่ต้องสร้างจอใหม่; แต่ต้องตรวจตาราง `FLAG_SPEC`/`HEADER_AMOUNT_FLAGS`/`BILLS_FLAGS` ใน `transLayouts.ts` ว่ามี `transFlag` ใหม่ด้วย (ยังไม่ได้ตรวจว่ากรณีไม่มีจะตกไปค่าเริ่มอะไร).
- ตรรกะธุรกิจ (ตัดสต็อก, GL, วงเงินเครดิต, เลขที่) อยู่ฝั่ง Go; หน้าจอส่งบรรทัดทั้งหมดไป - ห้ามคำนวณยอดเงินด้วย `Number()` ในจอ.
- รายการเอกสารแสดงสูงสุด 150 ใบต่อการค้นหา (ใช้ช่องค้นหา/ช่วงวันที่เพื่อหาเอกสารเก่า).

## ที่มาในโค้ด
- `frontend/account/transaction/UniversalTransScreen.tsx:402-505` - รวม config เมนู + เลือกจอ cancel/approve
- `frontend/account/transaction/UniversalTransScreen.tsx:822-841,1053-1200,1203-1330` - ยอดรวม, ตารางหลัก, รายการ/รายละเอียดเอกสาร
- `frontend/account/transaction/UniversalTransScreen.tsx:1855-1960` - เลขที่เอกสารอัตโนมัติ, เริ่มเอกสารใหม่
- `frontend/account/transaction/UniversalTransScreen.tsx:2149,2576-2870,2893-2935,2980` - แก้บรรทัด, บันทึก, ลบ, Ctrl+S
- `frontend/account/transaction/UniversalTransScreen.tsx:2992-4260` - เรนเดอร์ส่วนประกอบและกล่องช่วย
- `frontend/account/transaction/transLayouts.ts:30,193,274` - `TransGridMode`, `TransLayoutConfig`, `getTransLayout`
- `frontend/account/transaction/UniversalCancelConfirmScreen.tsx:440-500` - ยกเลิก/อนุมัติ
- `frontend/src/lib/doc-no.ts:17-39` - ขอเลขที่เอกสาร

## ดูเพิ่ม
[[frontend-overview]] · [[fe-transaction-menu-purchase-sale-stock]] · [[fe-transaction-menu-debt-cashbank]] · [[fe-query-client-sql-builder]] · [[fe-numeric-money]] · [[fe-tabs-workspace]] · [[fe-grid-component]] · [[accounting-overview]] · [[process-overview]]
