---
title: "จอเอกสารธุรกรรมแบบเดียวกันทุกจอ (UniversalTransScreen)"
tags: [frontend, transaction, document, ic_trans, ap_ar_trans, workbench]
aliases: ["UniversalTransScreen", "UniversalTransactionScreen", "TransactionEngineScreen", "จอเอกสาร", "ใบสั่งซื้อ ใบขาย จอบันทึกเอกสาร", "TransLayoutConfig", "getTransLayout", "TransGridMode", "handleSave", "saveTrans", "saveDoc", "generateDocNo", "ยกเลิกเอกสาร", "อนุมัติเอกสาร", "UniversalCancelConfirmScreen"]
sources: ["frontend/account/transaction/UniversalTransScreen.tsx:403", "frontend/account/transaction/UniversalTransScreen.tsx:2584", "frontend/account/transaction/UniversalTransScreen.tsx:2902", "frontend/account/transaction/transLayouts.ts:193", "frontend/account/transaction/UniversalCancelConfirmScreen.tsx:469", "frontend/account/tabs/transMenuMap.ts:2466", "frontend/src/lib/doc-no.ts:17", "frontend/src/lib/query-client.ts:801"]
---

# จอเอกสารธุรกรรมแบบเดียวกันทุกจอ (`UniversalTransScreen`)

เอกสารซื้อ/ขาย/สินค้าคงคลัง/ลูกหนี้/เจ้าหนี้/เงินสดธนาคาร/สมุดรายวัน (160 เมนูใน `TRANS_MENU_MAP`) ใช้คอมโพเนนต์เดียว `UniversalTransScreen` (4,387 บรรทัด) แล้วปรับหน้าตาด้วย "config ต่อเมนู" (`transMenuMap.ts`) และ "layout ต่อชนิดเอกสาร" (`transLayouts.ts`)
รายชื่อเมนูทั้งหมดอยู่ใน [[fe-transaction-menu-purchase-sale-stock]] และ [[fe-transaction-menu-debt-cashbank]]

## ทำงานอย่างไร

**ทางเข้า**: `screenRegistry` วนทุกคีย์ของ `TRANS_MENU_MAP` ที่ไม่อยู่ใน `NON_TRANS_MENUS` แล้วสร้างจอด้วย `createTransScreen` (`screenRegistry.tsx:167`, ลูป `1024-1055`, ทางสำรองตอนค้นเมนู `1075-1095`; ดู [[fe-screen-registry-menu]]) ซึ่งส่ง config เข้า `UniversalTransScreen` (`UniversalTransScreen.tsx:403`); `TransactionEngineScreen.tsx` (8 บรรทัด) และ `UniversalTransactionScreen.tsx` (9 บรรทัด) เป็นไฟล์ re-export สั้นๆ.
1. `getTransMenuConfig(menuKey)` (`transMenuMap.ts:2466`, คืน `undefined` ถ้าคีย์อยู่ใน `NON_TRANS_MENUS` หรือไม่มีใน map) ให้ `transFlag, transType, kind, partyType, mode, calcFlag, prefix, docFormatCode, screenCode, isTransfer, hasRefDoc, refTransFlags, origFlag, transFlags, inquiryTypeDefault` (`UniversalTransScreen.tsx:410-460`); ค่าที่ไม่มีใน map ตกไปใช้ `config.*` แล้วค่าเริ่ม (`transFlag 44`, `transType 2`, `kind ic_trans`, `partyType none`, `mode doc`).
2. ถ้า `mode` เป็น `cancel` หรือ `approve` -> เรนเดอร์ `UniversalCancelConfirmScreen` (ดูด้านล่าง; `463-483`) นอกนั้น -> `UniversalTransDocScreen` (หน้าบันทึกเอกสาร, ฟังก์ชันเริ่มที่ `509`).
3. `itemLookup` ใน config เมนู (`517`): ไม่ระบุ = ค้นรหัสจาก `ic_inventory`, ระบุ `{table,title}` = ค้นจากตารางนั้น (`3707-3708`), `null` = พิมพ์รหัสเองไม่เปิดค้นหา (`3687,3702`); เมนูที่ตั้ง `itemLookup` ไม่ใช้ `transGridLine` (`2140`).

**`kind` (ตารางหลัก)**: ชนิด `TransKind` มี 6 ค่า (`transMenuMap.ts:3-9`) แต่เมนูใน map ใช้ 4 ค่า: `ic_trans` (145 เมนู), `ap_ar_trans` (8), `cb_chq_list` (5 - เช็ค), `gl_journal` (2); ไม่มีเมนูใดตั้ง `cb_trans` หรือ `pp_trans`. โค้ดจอยังรองรับสองค่านี้ในส่วนแสดงรายการ (`1108` สำหรับ `pp_trans`, `primaryTable` `1056-1062` สำหรับ `cb_trans`) แต่การบันทึก/ลบ `cb_trans` ในจอนี้ throw "ยังไม่รองรับ" (`UniversalTransScreen.tsx:2656-2658,2904-2906`). `primaryTable` (`1056`) ใช้เลือกตารางสำหรับรายการเอกสารและสร้างเลขที่.

**Layout ต่อชนิดเอกสาร** (`transLayouts.ts`): `getTransLayout(transFlag, kind, isTransfer, partyType)` (`274`) คืน `TransLayoutConfig` (`193`) ซึ่งคือชุดสวิตช์ว่าจอนี้แสดงอะไร เช่น `showParty/partyLabel`, `showInquiryType` + `inquiryOptions` (ประเภทการซื้อ/ขาย เงินสด-เชื่อ), `showVatType` (`VAT_TYPE_OPTIONS` `10`), `showTaxDoc`, `showRefDoc`, `showCreditAndDue`, `showSaleCode`, `showTransferWarehouse` (โอนคลัง), `showDepartment/showBranch`, `showHeaderAmount`, `showOnHold`, `showApproval`, `showExpire`, `showDepositTerm`, `showTransport`, คอลัมน์ในตาราง (`showWhLocation, showLotNumber, showDiscount, showPrice, compareUnitColumns, qcTotalQtyColumn, mfnColumn`) และแท็บ (`showMoreTab, showTaxTab, showVatTab, showWhtTab, showPayTab, showDepositTab, showGlTab`).
- ลำดับตัดสิน: `base` จากกฎทั่วไป (`315-378`) -> `cb_chq_list` (`380`) และ `gl_journal` (`405`) ตั้ง `gridMode: "none"` ของตัวเอง -> ที่เหลือ (`ic_trans`/`ap_ar_trans`) ใช้แถว `FLAG_SPEC[transFlag]` (`66-153`, 85 คีย์) บอกว่าช่องหัวเอกสารและแท็บใดเปิด; ถ้า flag ไม่มีแถวใน `FLAG_SPEC` ฟังก์ชันคืน `base` (`427`).
- `gridMode: TransGridMode` (`transLayouts.ts:30`) = `item` (ตารางสินค้า) | `amount` (ตารางรายการเป็นจำนวนเงิน, flag ใน `AMOUNT_CODE_LABEL`) | `bills` (ตารางใบค้างชำระ, flag ใน `BILLS_FLAGS` = 19, 213, 235, 239) | `deposit` (flag ใน `DEPOSIT_FLAGS`) | `none` (flag ใน `HEADER_AMOUNT_FLAGS` = 81, 83, 85, 93, 95, 97, 602, 604 รวมทั้งเช็ค/สมุดรายวัน).
- ตัวเลือก `inquiry_type` ต่อชนิดเอกสารประกาศเป็นค่าคงที่ (`PO_INQUIRY`, `PURCHASE_INQUIRY`, `RETURN_TYPE` ฯลฯ ที่ `transLayouts.ts:35-41`, จับคู่กับ flag ใน `INQUIRY_BY_FLAG` `42-50`) ข้อความรูปแบบ `"<เลข>: <ข้อความ>"` สร้างด้วย `inquiryOpts` (`32`); flag ที่ไม่อยู่ใน `INQUIRY_BY_FLAG` ได้ `inquiryOptions: null`; ไฟล์ทดสอบ `transLayouts.test.ts`.

**ส่วนประกอบหน้าจอ** (ไฟล์ใน `frontend/account/transaction/`; ลำดับตามการเรนเดอร์ใน `UniversalTransScreen.tsx`)
| ส่วน | ไฟล์ | หน้าที่ |
|---|---|---|
| รายการเอกสารซ้าย | `TransDocListPane.tsx` (137 บรรทัด; ใช้ที่ `3007`) ภายใต้ `ResizableSplit` (`3000`, `storageKey="bc_trans_split"`, กว้างเริ่ม 520) | ช่วงวันที่ + `BcDataList` (ดู [[fe-grid-component]]); จอยกเลิก/อนุมัติใช้ตัวเดียวกัน |
| หัวเอกสาร | `TransTopForm.tsx` (960; ใช้ที่ `3196`) | ช่องหัวเอกสารตามสวิตช์ใน `TransLayoutConfig` (เลขที่ วันที่ คู่ค้า ประเภท VAT เครดิต คลัง ฯลฯ) |
| แถบรายวันประจำ | `GlRecurringBar.tsx` (387; ใช้ที่ `3310-3345` เฉพาะ `kind === "gl_journal"`) | ต้นแบบสมุดรายวันประจำ: ต้นแบบในตัว 5 รายการ + ต้นแบบของกิจการจาก `POST /api/process/gl/recurring` (`GlRecurringBar.tsx:119`), บันทึก/ลบต้นแบบ, ปุ่มกลับรายการ (รายละเอียดใน [[fe-transaction-menu-debt-cashbank]]) |
| ตารางใบค้างชำระ | `TransBillsGrid.tsx` (530; ใช้ที่ `3583` เมื่อ `gridMode === "bills"`) | จอลูกหนี้/เจ้าหนี้ (ตัดชำระใบวางบิล) ดึงใบค้างด้วย `outstandingBills` = `POST /api/process/doc/bills` (`query-client.ts:779-785`) |
| ตารางสินค้า | `TransItemGrid.tsx` (1,284; ใช้ที่ `3629`) | รายการสินค้า/จำนวนเงิน; เรียก `ChequePickerModal` (`1147`), `GridShortcutPopover` (`1170`), `CostLockModal` (`1178`) ภายในตัวเอง และใช้ `useExpireColumn.ts` |
| แถบสรุปหน่วยบรรจุ | `MultiUnitPackSummaryBar.tsx` (ใช้ที่ `3840`) | สรุปหน่วยบรรจุของบรรทัดสินค้า และปุ่มแปลงเป็นหน่วยฐาน (ดู [[scr-multi-unit-pack-summary]]) |
| แท็บใช้เงินมัดจำ | `TransDepositTab.tsx` (147; ใช้ที่ `3869`) | ดึงใบมัดจำค้างของคู่ค้าด้วย `listOpenDeposits` = `POST /api/process/trans/deposits` (`query-client.ts:553-558`), หักเงินล่วงหน้า/มัดจำ |
| ภาษี / หัก ณ ที่จ่าย | `JournalTaxTabs.tsx` (1,174; ใช้ที่ `3879,3931,3953`) | 4 แท็บภาษีของสมุดรายวัน/ตัดชำระหนี้ (`JOURNAL_TAX_TABS` `whtOut, whtIn, vatBuy, vatSale` ที่ `JournalTaxTabs.tsx:29-35`) และแผง VAT/WHT ในแท็บภาษีของเอกสาร `ic_trans` |
| แท็บเพิ่มเติม | `TransExtraTabs.tsx` (1,145; ใช้ที่ `3890`) + `TransPayTendersGrid.tsx`, `TransPayOtherGrid.tsx` | แท็บ `more` (`196`) ข้อมูลเสริมของเอกสาร, `tax` (`573`), `pay` (`638`) รับ/จ่ายชำระ (เงินโอน/PromptPay/เช็ค/บัตร และรายได้-ค่าใช้จ่ายอื่น), `gl` (`899`) การลงบัญชี/สมุดรายวัน |
| แผงล่าง/ยอดรวม | `TransBottomPanel.tsx` (461; ใช้ที่ `4096` เมื่อ `gridMode !== "none"`) | ยอดรวม ส่วนลด VAT สกุลเงิน เครดิต/วันครบกำหนด (ใช้ `transDates.ts`) และหมายเหตุท้ายเอกสาร |
| ผังเอกสาร | `DocumentFlowModal.tsx` (1,107; ใช้ที่ `4305`) | แสดงเอกสารต้นทาง/ปลายทาง จาก `POST /api/process/doc/flow` (`DocumentFlowModal.tsx:161`); คลิกโหนดของจอเดียวกันเปิดในจอนี้ ต่างจอเปิดแท็บเมนูนั้นแล้วส่งเลขที่ผ่าน `sessionStorage["bc:pending-open-doc"]` + event `bc:open-doc` (`DocumentFlowModal.tsx:271-297`, รับที่ `UniversalTransScreen.tsx:1824-1857`) |
| พิมพ์ฟอร์ม | `GlobalDocFormPrintModal` (ใช้ที่ `4315`) | ดู [[fe-report-print-designer]] |
| กล่องช่วยที่เรียกจากจอนี้ | `StockBalanceModal` (`4228`), `SerialNumberModal` (`4248`), `PriceFormulaModal` (`4269`), `PriceInfoModal` (`4293`), `CreditApproveModal` (`4302`) และกล่องเลือกเอกสารอ้างอิงที่เขียนในไฟล์เอง (`refDocList` `4199`) | ยอดคงเหลือ, ซีเรียล, สูตรราคา, ราคาขาย 3 ตาราง, ใส่รหัสอนุมัติเกินวงเงินเครดิต, เลือกเอกสารอ้างอิง |

`LotModal`, `ItemHistoryModal`, `ItemRemarkModal`, `ItemNameModal`, `ItemReplacementModal` และ `ItemGridContextMenu` อยู่ในโฟลเดอร์เดียวกันแต่ไม่ได้ถูกเรียกจาก `UniversalTransScreen`/`TransItemGrid` - ผู้เรียกคือ `StockBeginningBalanceScreen.tsx` (ดู [[scr-stock-beginning-balance]]).

**แถบแท็บ** (`3362-3579`) แสดงตามสวิตช์ใน layout: `items` ("รายการสินค้า / เอกสาร", หรือ "รายการ" เมื่อ `gridMode === "amount"`; ซ่อนเมื่อ `kind === "gl_journal"` หรือ `gridMode === "none"`), `gl` ("การลงบัญชี (GL)" เมื่อ `gridMode === "none"`; กรณี `gridMode` อื่นแสดงเมื่อ `showGlTab` และรุ่นที่ใช้มี `hasGl` จาก `useEdition()` `556,561`), `more` ("รายละเอียดเพิ่มเติม"), `tax` ("ข้อมูลภาษี (VAT/WHT)" หรือ "ภาษีมูลค่าเพิ่ม" ถ้าไม่มี WHT; ซ่อนเมื่อจอตัดชำระหนี้ใช้แท็บภาษี 4 แท็บแทน), `pay` ("การรับ/จ่ายชำระเงิน"), แท็บภาษีของสมุดรายวัน/ตัดชำระหนี้ และ `deposit` ("ใช้เงินมัดจำ").

**โหลดรายการเอกสาร**: `loadDocList` (`1064-1199`) ประกอบ SQL ตามชนิด (เช็ค `cb_chq_list`, สมุดรายวัน `gl_journal` (แสดง `book_code` เป็นรหัส), `pp_trans`, และเอกสารทั่วไปจาก `primaryTable` join `ap_supplier` หรือ `ar_customer` ตาม `partyType`), กรอง `trans_flag IN (...)`, ตัดเอกสารที่ `last_status <> 0` (ยกเลิกแล้ว) ยกเว้น `cb_trans`, ค้นด้วย `ILIKE` เลขที่/รหัสคู่ค้า/หมายเหตุ, ทุกสาขา `LIMIT 150`, เรียงวันที่ใหม่ก่อน. ใช้ `escapeSql` กับคำค้นและวันที่ (`1068-1071`). ช่วงวันที่เริ่มต้นคือย้อนหลัง 3 เดือนถึงวันนี้ (`535-540`). `loadDocDetail` (`1206-1812`) โหลดหัว + บรรทัด + แท็บอื่น ด้วย `queryListRows` ต่อตาราง `*_trans`/`*_trans_detail` (แท็บชำระอ่าน `cb_trans` และ `cb_trans_detail` `doc_type` 1,2,3,21 และ 11,12 ที่ `1366-1380`; แท็บมัดจำเรียก `listOpenDeposits` ที่ `1358-1360`).

**เพิ่มเอกสารใหม่**: `handleStartNew` (`1900-1979`) ต้อง `rights.canAdd` -> ตั้งวันที่/เวลาเป็นวันนี้, ตั้ง `inquiryType` เป็นค่าเริ่ม, ล้างสาขา/แผนก/คู่ค้า, เรียก `getPartyDefaults` (`query-client.ts:585`, [[fe-query-client-sql-builder]]) หาประเภทการขายเริ่มต้น, ใส่คลัง/ที่เก็บล่าสุดจาก `localStorage["ictrans_recent_<transFlag>"]` (`1953-1965`) แล้ว `handleAutoDocNo` (`1860-1897`) ขอเลขที่ถัดไปจาก `generateDocNo` (`doc-no.ts:17`) = `POST /api/process/stocktools/docnonext` ตามตาราง `erp_doc_format`; ผิดพลาด = แสดงข้อความ (`1885`) ไม่เริ่มเลขที่ 1 เงียบๆ (`doc-no.ts:15`).

**ถามก่อนทิ้งข้อมูลที่แก้ค้าง**: `formSnapshot` (`2941`) เก็บค่าฟอร์มทั้งหมดเป็น JSON, `confirmDiscard` (`2966`) ตรวจกับค่าตอนเริ่มแก้ ถ้าต่างจะเปิด `BcDialog` "เปลี่ยนรายการ" (`4371`) ก่อนเปิดเอกสารอื่น (`openListDoc` `2975`) หรือกดเพิ่มใหม่.

**คำนวณยอด**
- ยอดที่แสดง (`totals` memo `848`) แยกตามชนิด: `cb_chq_list` = ยอดเช็ค, `gl_journal` = ผลรวมเดบิต, `gridMode` `none` = ยอดหัวเอกสาร, `bills` = ผลรวม `sumPayMoney`, `ic_trans` = ผลจาก backend ล่าสุด `serverTotals` (`896-899`) และถ้ายังไม่มีผลจึงคำนวณฝั่งหน้าจอด้วย `vatCalc`/`sumDec` (`920`, ดู [[fe-numeric-money]]).
- `ic_trans` ที่มีตารางสินค้า: ทุกครั้งที่บรรทัด/ส่วนลด/VAT/มัดจำ/สกุลเงินเปลี่ยน รอ 200 ms แล้วเรียก `transTotals` (`POST /api/process/transgrid/totals`) เก็บใน `serverTotals` (`824-846`).
- แก้บรรทัดสินค้า (รหัส/จำนวน/ราคา/หน่วย/ส่วนลด) เรียก `commitGridLines` (`2143`) -> `transGridLine` (`2157`, `POST /api/process/transgrid/line`) ส่ง `changed` + บรรทัดที่เกี่ยวข้อง backend ตอบบรรทัดที่คำนวณใหม่; ทำเฉพาะ flag ใน `GRID_ITEM_FLAGS` (`263`) สินค้าชุด (`item_type` 3,5) ส่งบรรทัดย่อยไปด้วย (`2152-2155`). ทางลัดกรอกช่อง (`transGridShortcut`, `3814`), สกุลเงิน (`transFx`, `782`/`820`).

**บันทึกเอกสาร** `handleSave` (`2584-2899`)
1. `canSaveWithRights(rights, isNewDoc)` (เอกสารใหม่ต้อง `canAdd` เดิมต้อง `canEdit`) ไม่ผ่านก็ออกเงียบ; ต้องมีเลขที่และวันที่เอกสาร; ต้องโหลดข้อมูลสกุลเงิน (`fxActive`) ได้ (`2585-2599`).
2. `kind` = `cb_chq_list`/`gl_journal`/`ap_ar_trans` -> `saveDoc` (`POST /api/process/doc/save`, `2659-2712`; `ap_ar_trans` ส่ง `bills` และ `pay` ไปด้วย); `ic_trans` -> `saveTrans` (`POST /api/process/trans/save`, `2713-2802`) พร้อม `lines` จาก `toSaveLine` (`271`), แท็บรับ/จ่ายชำระ (`pay.*` สร้างที่ `2609-2654`: เงินสด/โอน/พร้อมเพย์/เช็ค/บัตร/รายได้-ค่าใช้จ่ายอื่น), VAT/WHT.
3. backend ตอบ error พิเศษ `CONFIRM:<ข้อความ>` -> `window.confirm` แล้วส่งซ้ำพร้อม `confirmed`; `CREDIT_PASSWORD:<ข้อความ>` (เกินวงเงินเครดิต) -> เปิด `CreditApproveModal` ให้ผู้มีสิทธิ์ใส่ผู้ใช้/รหัสอนุมัติแล้วส่งซ้ำ (`2807-2821`).
4. สำเร็จ: เก็บคลัง/ที่เก็บล่าสุดใน `localStorage["ictrans_recent_<transFlag>"]` ใช้เป็นค่าเริ่มของเอกสารใหม่ (`2824`), รีโหลดรายการ, ถามพิมพ์ (`postSavePrintPromptDocNo` `4357`) หรือเปิดพิมพ์ทันที (`options.openPrintImmediately` จาก `onSaveBeforePrint`).
5. `Ctrl+S` ผูกที่ window `keydown` เมื่อกำลังแก้ไขและแท็บมองเห็น (`2987-2995`; เงื่อนไข `isEditing && listHotkeysActive`).

**ลบเอกสาร**: `handleDelete` (`2917`) ต้อง `rights.canDelete`, `window.confirm` แล้ววน `deleteOneDoc` (`2902`): `ic_trans` -> `deleteTrans` (`POST /api/process/trans/delete`, `query-client.ts:679-683`), `cb_chq_list`/`gl_journal`/`ap_ar_trans` -> `deleteDoc` (`POST /api/process/doc/delete`, `query-client.ts:791-797`). ฟังก์ชันรับรายการเลขที่ได้หลายใบ แต่ปุ่ม "ลบ" บนแถบเครื่องมือเรียกโดยไม่ส่งอาร์กิวเมนต์ = ลบใบที่เปิดอยู่ใบเดียว (`3095`).

**จอยกเลิก/อนุมัติเอกสาร** `UniversalCancelConfirmScreen` (1,040 บรรทัด)
- ใช้กับเมนูที่ `mode` = `cancel` (61 เมนู) หรือ `approve` (5 เมนู). รายการเอกสารเดิม (`origFlag`) โหลดที่ `loadDocs` (`226-256`, `LIMIT 200`) แสดงผ่าน `TransDocListPane` พร้อมคอลัมน์สถานะ; เลือกใบแล้วเรียก `setDocStatus(mode, {flag, origFlag, docRef, docFormat, screenCode, docDate, remark, undo, cancelType, lines, cancelDocNo, approveLines, notApprove, menuName})` (`UniversalCancelConfirmScreen.tsx:469`) = `POST /api/process/doc/cancel` หรือ `/api/process/doc/approve` (`query-client.ts:801-821`).
- สิทธิ์: ทำรายการได้เมื่อ `rights.canAdd || rights.canEdit` (`428`); ปุ่มสร้างใบยกเลิก/อนุมัติเปิดเมื่อเอกสารยังไม่ถูกยกเลิก/อนุมัติ (`canCreate` `434`), ปุ่มย้อนสถานะเปิดเมื่อถูกยกเลิก/อนุมัติแล้ว (`canUndo` `435`).
- รองรับ "ยกเลิกรายสินค้า" (`cancelType 2` ส่งเฉพาะบรรทัดที่ใส่จำนวนยกเลิก; เฉพาะเมนูที่ flag ของใบยกเลิก (`statusFlag` `170`) อยู่ใน `ITEM_CANCEL_FLAGS` = 3, 7, 31, 37, 39 ที่ `107`), "อนุมัติรายสินค้า" (`approveLines` ส่งบรรทัดที่แก้จำนวน/ราคา/ส่วนลด; เฉพาะ flag 4 `275`), "ไม่อนุมัติ" (`notApprove`), "ยกเลิกการอนุมัติ/คืนสถานะ" (`undo`, ส่ง `cancelDocNo` เมื่อต้องลบเฉพาะใบยกเลิกนั้น). เลขที่ใบยกเลิกออกฝั่ง backend ตาม `erp_doc_format` (คอมเมนต์ `UniversalCancelConfirmScreen.tsx:468` อ้าง `doc_cancel.go nextDocNo`).

**ข้อควรระวัง**
- ทุกเมนูเอกสารใหม่แก้ที่ `transMenuMap.ts` + `transLayouts.ts` ไม่ต้องสร้างจอใหม่; ต้องมีแถวของ `transFlag` ใหม่ใน `FLAG_SPEC` ด้วย ไม่เช่นนั้น `getTransLayout` คืน `base` (`transLayouts.ts:427`) ซึ่งเปิดช่องและแท็บตามกฎทั่วไป. จับคู่ `transFlag` ของ 87 เมนูโหมด `doc` ชนิด `ic_trans`/`ap_ar_trans` กับคีย์ใน `FLAG_SPEC` แล้ว ครบทุกเมนู.
- ตรรกะธุรกิจ (ตัดสต็อก, GL, วงเงินเครดิต, เลขที่) อยู่ฝั่ง Go; หน้าจอส่งบรรทัดทั้งหมดไป - ยอดเงินฝั่งหน้าจอคำนวณด้วย `vatCalc`/`sumDec`/`cmpDec` จาก `@/lib/numeric` ไม่ใช้ `Number()` กับจำนวนเงิน.
- รายการเอกสารแสดงสูงสุด 150 ใบต่อการค้นหา (200 ใบในจอยกเลิก/อนุมัติ) - ใช้ช่องค้นหา/ช่วงวันที่เพื่อหาเอกสารเก่า.

## ที่มาในโค้ด
- `frontend/account/tabs/screenRegistry.tsx:167-171,1024-1055,1075-1095` - สร้างจอธุรกรรมจาก `TRANS_MENU_MAP`
- `frontend/account/tabs/transMenuMap.ts:1-50,2466-2474` - `TransKind`, `TransMenuConfig`, `NON_TRANS_MENUS`, `getTransMenuConfig`
- `frontend/account/transaction/UniversalTransScreen.tsx:403-486` - รวม config เมนู + เลือกจอ cancel/approve
- `frontend/account/transaction/UniversalTransScreen.tsx:824-952` - ยอดรวมจาก backend และยอดคำนวณหน้าจอ
- `frontend/account/transaction/UniversalTransScreen.tsx:1056-1199,1206-1812` - ตารางหลัก, รายการ/รายละเอียดเอกสาร
- `frontend/account/transaction/UniversalTransScreen.tsx:1860-1979` - เลขที่เอกสารอัตโนมัติ, เริ่มเอกสารใหม่
- `frontend/account/transaction/UniversalTransScreen.tsx:2143-2160,2584-2899,2902-2938,2941-2995` - แก้บรรทัด, บันทึก, ลบ, ถามก่อนทิ้งข้อมูล, Ctrl+S
- `frontend/account/transaction/UniversalTransScreen.tsx:3000-3010,3362-3579,4228-4385` - แบ่งซ้าย/ขวา, แถบแท็บ, กล่องช่วยและกล่องยืนยัน
- `frontend/account/transaction/transLayouts.ts:30,193,274-485` - `TransGridMode`, `TransLayoutConfig`, `getTransLayout`
- `frontend/account/transaction/UniversalCancelConfirmScreen.tsx:226-256,428-500` - โหลดรายการ, สิทธิ์, ยกเลิก/อนุมัติ
- `frontend/src/lib/query-client.ts:374-377,441-450,479-484,553-558,585-598,679-683,774-797,801-821` - `saveTrans`, `transTotals`, `transGridLine`, `transGridShortcut`, `listOpenDeposits`, `deleteTrans`, `saveDoc`, `deleteDoc`, `setDocStatus`
- `frontend/src/lib/doc-no.ts:17-39` - ขอเลขที่เอกสาร

## ดูเพิ่ม
[[frontend-overview]] · [[fe-transaction-menu-purchase-sale-stock]] · [[fe-transaction-menu-debt-cashbank]] · [[fe-query-client-sql-builder]] · [[fe-numeric-money]] · [[fe-tabs-workspace]] · [[fe-grid-component]] · [[accounting-overview]] · [[process-overview]]
