---
title: "แท็บ MDI: คีย์ลัดแท็บซ่อน, listKey ชน, กันทิ้งข้อมูล (Hidden-Tab Hotkeys & Dirty Guard)"
tags: [history, tabs, hotkeys, dirty-guard]
aliases: ["hidden tab hotkey", "tabsApi.isActive", "confirmDiscard", "screenKey"]
sources: ["git:678fc5fc", "git:7dc1b3a6", "git:324bd2a6", "git:6cb904f7", "git:a422b74f", "git:3b55658e", "git:b9c13081", "frontend/account/tabs/TabWorkspace.tsx:95"]
---

## ภาพรวม
`TabWorkspace` ให้ทุกแท็บ mount ค้าง (แท็บไม่ active แค่ซ่อน) บั๊กตระกูลเดียวกันจึงโผล่ 22-25 ต.ค. 2026: คีย์ลัด window ถูกแท็บที่มองไม่เห็นรับ, คีย์ตั้งค่าอิงแท็บ active ปนกัน, ปุ่มที่ทิ้งข้อมูลโดยไม่ถาม เกิดซ้ำทุกจอใหม่ เพราะแต่ละจอผูก `window.addEventListener("keydown")` เอง

## อาการ
- **A คีย์ลัดแท็บซ่อน** (KMS T6, M1, M2): F12/Esc/Insert/ลูกศรทำงานในแท็บที่มองไม่เห็น บันทึก/ปิด/เปิดเอกสารใหม่ของแท็บอื่น; กด Esc ปิดกล่องแจ้งเตือนแล้วข้อมูลที่แก้หาย (Esc ลามไปจอหลัก)
- **B listKey ชน** (M3): สลับแท็บแล้วรายการโหลดคอลัมน์/SQL ที่ตั้งไว้ของจออื่น
- **C ทิ้งข้อมูลเงียบ** (M6): ปุ่ม `+`/Insert/ดินสอ/ดับเบิลคลิก/ปิดแท็บ/ปิดทั้งหมด ทิ้งข้อมูลที่แก้ค้างโดยไม่ถาม
- **D state ค้างข้ามแท็บ/เอกสาร** (T5, T7, M4, M5): StockBeginningBalance หัวเอกสาร B + บรรทัดของ A แล้วบันทึกทับ; ชื่อพนักงานขาย/แผนกเก่าติดเอกสารใหม่; บาร์โค้ด+Enter เร็วเลือกผลค้นหาเก่า; รหัสใหม่แต่ชื่อเก่าค้าง `NEWCODE~ชื่อเดิม`

## สาเหตุ (root cause)
- **A** handler ผูก window โดยไม่เช็กว่าแท็บ active; `BcDialog` ไม่ใช้ capture
- **B** `BcDataList` ใช้ `tabsCtx.activeKey` (แท็บที่ผู้ใช้เปิดอยู่ ไม่ใช่แท็บเจ้าของรายการ) เป็นคีย์เมื่อไม่ได้ส่ง `listKey`
- **C** ปุ่ม `+`/Insert/ดินสอ/ดับเบิลคลิก เรียก handler เพิ่มใหม่/เลือกแถวตรงๆ ไม่มีขั้นถาม (อนุมานจากข้อความ commit `7dc1b3a6`); ตัวแท็บไม่รู้ว่าจอข้างในแก้ค้าง
- **D** โหลดหลาย `await` ไม่มีลำดับงาน; ผล async ลงตามตำแหน่งแถว (ลบ/ย้ายระหว่างรอ = ลงผิดแถว); Enter มาก่อนผลค้นหาใหม่

## วิธีแก้
- **A** `678fc5fc`: F12 เฉพาะแท็บที่เห็น (`listHotkeysActive`), `hotkeysActive={listHotkeysActive && !isEditing}`; `7dc1b3a6`: `BcDataList` ข้ามเมื่อ `offsetParent === null`, `BcDialog` ฟัง capture + `stopPropagation`
- **B** `7dc1b3a6`: `TabsContext.screenKey` ผ่าน `ScreenTabsProvider` (memo) ให้รายการใช้ก่อน `activeKey`
- **C** `3b55658e` ปุ่ม "ปิด Tab ทั้งหมด"; `a422b74f` ตรวจก่อนปิดแท็บ/ปิดทั้งหมด พร้อม modal เตือนรายชื่อแท็บที่ยังไม่บันทึก; `7dc1b3a6`/`324bd2a6` เพิ่ม `confirmDiscard()` ในจอ master และ snapshot dirty ใน `UniversalTransScreen` (ตามข้อความ commit)
- **D** `678fc5fc` sequence guard + ล้างค่าที่รั่ว; `324bd2a6` `row_key`; `7dc1b3a6` Enter รอผลค้นหาใหม่, ค้นชื่อใหม่ตอน blur เมื่อรหัสเปลี่ยน (ตามข้อความ commit)
- **E** `b9c13081` (25 ต.ค.): ถอด F1-F12 ทั้งระบบ เหลือ Ctrl+S และปุ่มกด

## commit ที่เกี่ยวข้อง
- `3b55658e` (22 ต.ค.) ปิดทุกแท็บ; `a422b74f` (23 ต.ค.) เช็กค้างก่อนปิด
- `678fc5fc`, `7dc1b3a6`, `324bd2a6`, `6cb904f7` (24 ต.ค.) — hotkey แท็บซ่อน, screenKey, confirm ทิ้ง, row_key, สิทธิ์ต่อแท็บ
- `b9c13081` (25 ต.ค.) — Button-Only

## โค้ดปัจจุบันที่ป้องกัน
- `frontend/account/tabs/TabWorkspace.tsx:95` `isTabActive` + `screenKey` memo; `:636` `dirtyInputTabsRef`, `:643` `checkTabDirty` (สแกนป้าย "แก้ไขแล้ว..." ใน DOM), `:705` `closeAllTabs`
- `frontend/account/master/BcDataList.tsx:151` `effectiveListKey`, `:574` ข้ามเมื่อซ่อน
- `frontend/account/master/BcDialog.tsx:94-103` capture + `stopPropagation`; `frontend/account/master/BcLookupModal.tsx:206,503` `enterWhilePendingRef`
- `frontend/account/transaction/UniversalTransScreen.tsx:543` `listHotkeysActive`, `:2958` `confirmDiscard`, `:2980` Ctrl+S เฉพาะแท็บ active; `frontend/account/transaction/StockBeginningBalanceScreen.tsx:132,1730` `tabActive`; `frontend/account/master/StandardMasterScreen.tsx:456` `confirmDiscard`

## บทเรียน / กฎที่ได้
- คีย์ลัดระดับ window ต้องเช็ก `tabsApi.isActive(menuKey)` และปิดคีย์ลัดรายการขณะแก้ไข (`b9c13081` เพิ่มไว้ใน AGENTS.md; ปัจจุบัน AGENTS.md:41 "ห้ามใช้ F1-F12")
- ป๊อปอัป/dialog ที่ดัก Esc/Enter ต้องใช้ capture + `stopPropagation`; คีย์ตั้งค่าต้องมาจากแท็บเจ้าของจอ ไม่ใช่แท็บ active
- ทางเข้าที่ทิ้งข้อมูลทุกทาง (ปุ่ม, Insert, ดับเบิลคลิก, ปิดแท็บ, ปิดทั้งหมด) ต้องผ่าน `confirmDiscard`; ผล async ต้องผูกกับตัวตนแถว/เลขลำดับงาน
- เปราะ: `checkTabDirty` จับ dirty จากข้อความป้ายใน DOM เปลี่ยนป้ายต้องแก้ regex ด้วย

## ดูเพิ่ม
[[fe-tabs-workspace]] · [[fe-standard-master-screen]] · [[std-frontend-ux-bug-lessons]] · [[hist-lessons-grid-ux-regressions]] · [[hist-lessons-permission-rights]] · [[history-overview]]

## ที่มาในโค้ด
- git: ทุก SHA ข้างต้น (ตรวจ diff: `7dc1b3a6`, `678fc5fc` บางไฟล์, `a422b74f`, `3b55658e`, `b9c13081`; ส่วนที่เหลือตามข้อความ commit; ยังไม่ได้ตรวจ diff)
- `docs/kms/KMS_SECURITY_DATA_INTEGRITY_LESSONS.md` §4-5 (T5-T7, M1-M6)
