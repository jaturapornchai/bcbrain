---
title: "บทเรียนแท็บ MDI: คีย์ลัดแท็บซ่อน, listKey ชน, กันทิ้งข้อมูล (Hidden-Tab Hotkeys & Dirty Guard)"
tags: [history, lesson, tabs, hotkeys, dirty-guard]
aliases: ["hidden tab hotkey", "tabsApi.isActive", "confirmDiscard", "screenKey", "checkTabDirty", "offsetParent", "listHotkeysActive"]
sources: ["frontend/account/tabs/TabWorkspace.tsx:96", "frontend/account/tabs/TabWorkspace.tsx:647", "frontend/account/tabs/TabWorkspace.tsx:692", "frontend/account/tabs/TabWorkspace.tsx:709", "frontend/account/tabs/TabWorkspace.tsx:1557", "frontend/account/master/BcDataList.tsx:153", "frontend/account/master/BcDataList.tsx:588", "frontend/account/master/BcDialog.tsx:94", "frontend/account/master/BcLookupModal.tsx:314", "frontend/account/transaction/UniversalTransScreen.tsx:544", "frontend/account/transaction/UniversalTransScreen.tsx:2966", "frontend/account/transaction/StockBeginningBalanceScreen.tsx:1756", "frontend/account/master/StandardMasterScreen.tsx:456", "AGENTS.md:42"]
---

# บทเรียนแท็บ MDI: คีย์ลัดแท็บซ่อน และการกันทิ้งข้อมูล

`TabWorkspace` ให้ทุกแท็บที่เคยเปิด mount ค้างไว้ (แท็บที่ไม่ active แค่ถูกซ่อน) ดังนั้นหน้าจอที่มองไม่เห็นยังรับคีย์บอร์ดและยัง "แก้ค้าง" ได้ ถ้าไม่ระวังจะบันทึก/ปิด/เปลี่ยนรายการของแท็บที่ผู้ใช้ไม่ได้เห็น หรือทิ้งข้อมูลที่แก้ค้างโดยไม่ถาม

## อะไรพังได้
- **คีย์ลัดแท็บซ่อน**: handler ที่ผูกกับ `window` (Ctrl+S, Esc, Insert, ลูกศร) ของจอที่ซ่อนอยู่ทำงานจริง บันทึก/ปิด/เริ่มเอกสารใหม่ของแท็บอื่น
- **Esc/Enter ลามข้ามชั้น**: กล่องแจ้งเตือนรับ Esc แล้วจอหลักข้างล่างรับต่อ ปิดจอและข้อมูลที่แก้หาย
- **listKey ชนกัน**: รายการที่ไม่ได้ส่ง `listKey` ใช้คีย์ของ "แท็บที่ active" ทำให้สลับแท็บแล้วโหลดคอลัมน์/SQL ของจออื่น
- **ทิ้งข้อมูลเงียบ**: ปุ่ม `+`, Insert, ดินสอ, ดับเบิลคลิกในรายการ, ปิดแท็บ, ปิดทั้งหมด ล้างฟอร์มที่แก้ค้างโดยไม่ถาม
- **ผล async ลงผิดที่**: สแกนบาร์โค้ดแล้ว Enter ทันที เลือกแถวของผลค้นหาเก่า; โหลดเอกสารซ้อนทำให้หัวของ B ปนบรรทัดของ A

## โค้ดป้องกันไว้อย่างไร
| ด่าน | ที่อยู่ | ทำอะไร |
|---|---|---|
| `isActive` ต่อแท็บ | `frontend/account/tabs/TabWorkspace.tsx:96-103` | `ScreenTabsProvider` ให้ `isActive(menuKey)` เป็นจริงเฉพาะเมื่อแท็บของจอนั้นคือแท็บ active |
| คีย์ลัดหน้ารายการ/เอกสาร | `frontend/account/transaction/UniversalTransScreen.tsx:544,2988,3036` | `listHotkeysActive` ผูก `tabsApi.isActive`; Ctrl+S ทำเฉพาะแท็บ active และปิดคีย์ลัดรายการขณะ `isEditing` |
| คีย์ลัดจอยอดยกมา | `frontend/account/transaction/StockBeginningBalanceScreen.tsx:133,1756` | `tabActive` และ `if (!tabActive) return` ก่อนทำคีย์ |
| ข้ามคีย์เมื่อซ่อน | `frontend/account/master/BcDataList.tsx:588` | ไม่รับคีย์ลัดเมื่อ `rootRef.offsetParent === null` |
| dialog กลืน Esc/Enter | `frontend/account/master/BcDialog.tsx:94-103` | ฟังช่วง capture + `stopPropagation` และไม่ทำงานเมื่อกล่องอยู่ในแท็บที่ซ่อน |
| คีย์รายการอิงแท็บเจ้าของจอ | `frontend/account/master/BcDataList.tsx:153-160`; `frontend/account/tabs/TabWorkspace.tsx:117` | ใช้ `listKey` ก่อน แล้ว `tabsCtx.screenKey` แล้วจึง `activeKey` |
| Enter ระหว่างรอผลค้นหา | `frontend/account/master/BcLookupModal.tsx:207,314-316,506` | `enterWhilePendingRef` รอผลล่าสุดก่อนเลือกแถวแรก |
| ถามก่อนทิ้งการแก้ไข | `frontend/account/master/StandardMasterScreen.tsx:456`; `frontend/account/transaction/UniversalTransScreen.tsx:2966-2974` | `confirmDiscard` ใช้กับปุ่มเพิ่ม/ดินสอ/ดับเบิลคลิก; จอหน้ารายการอื่นใช้ร่วมกัน (เช่น `DealerScreen.tsx:275`) |
| ตรวจแท็บค้างก่อนปิด | `frontend/account/tabs/TabWorkspace.tsx:647-668,692,709-743` | `checkTabDirty` ดูป้ายในหัวจอ ("แก้ไขแล้ว...", "โหมดแก้ไข", "เพิ่มรายการใหม่") และ `closeTab`/`closeAllTabs` เปิดหน้าต่างเตือนรายชื่อแท็บที่ยังไม่บันทึก |
| ไม่ใช้ F1-F12 | `AGENTS.md:42` | กฎโปรเจกต์: ห้ามใช้ `F1`–`F12` ลดพื้นที่ชนกันของคีย์ลัด |

## กฎที่ต้องจำ
- คีย์ลัดระดับ window ต้องเช็ก `tabsApi.isActive(menuKey)` (หรือ `offsetParent`) ก่อนทำงาน และปิดคีย์ของรายการขณะแก้ไข
- ป๊อปอัปที่รับ Esc/Enter ต้องใช้ capture + `stopPropagation`
- ทุกทางที่ทิ้งข้อมูลต้องผ่าน `confirmDiscard` หรือหน้าต่างเตือนปิดแท็บ
- `checkTabDirty` ตัดสินจากข้อความป้ายใน DOM: ถ้าเปลี่ยนข้อความป้ายต้องแก้ตรงนี้ด้วย (`TabWorkspace.tsx:657-664`)

## ที่มาในโค้ด
- `frontend/account/tabs/TabWorkspace.tsx:96-123,647-668,692,709`
- `frontend/account/master/BcDataList.tsx:153-160,588`, `BcDialog.tsx:94-103`, `BcLookupModal.tsx:314`
- `frontend/account/transaction/UniversalTransScreen.tsx:544,2966,2988`, `StockBeginningBalanceScreen.tsx:1756`
- `AGENTS.md:42`
- ดูเพิ่ม: [[fe-tabs-workspace]] · [[fe-standard-master-screen]] · [[std-frontend-ux-bug-lessons]] · [[hist-lessons-grid-ux-regressions]] · [[hist-lessons-permission-rights]] · [[history-overview]]
