---
title: "พื้นที่ทำงานแบบแท็บ MDI และสิทธิ์จอ (TabWorkspace)"
tags: [frontend, tabs, mdi, workspace, rights, permission]
aliases: ["TabWorkspace", "TabsContext", "แท็บหลายจอ", "MDI", "openScreen", "ScreenRights", "สิทธิ์จอ", "เมนูที่ใช้บ่อย", "ค้นหาเมนู", "ปิดแท็บมีข้อมูลค้าง", "useTabs", "useScreenRights", "canSaveWithRights"]
sources: ["frontend/account/tabs/TabWorkspace.tsx:59", "frontend/account/tabs/TabWorkspace.tsx:201", "frontend/account/tabs/TabWorkspace.tsx:258", "frontend/account/tabs/TabWorkspace.tsx:536", "frontend/account/tabs/TabWorkspace.tsx:647", "frontend/account/tabs/TabsContext.tsx:15", "frontend/account/tabs/TabsContext.tsx:41", "frontend/shared/layout/PersistentWorkspaceHost.tsx:37"]
---

# พื้นที่ทำงานแบบแท็บ MDI และสิทธิ์จอ (TabWorkspace)

`TabWorkspace` คือ "หน้าต่างโปรแกรมบัญชี" ที่เปิดหลายจอเป็นแท็บพร้อมกันในหน้าต่างหลักเดียว (แบบ MDI) มีแถบเมนูบน, ผังเมนู, เมนูที่ใช้บ่อย, ค้นหาเมนู และแท็บของจอที่เปิดอยู่
จอทุกจอได้รับสิทธิ์ เพิ่ม/แก้ไข/ลบ ผ่าน `TabsContext` (กันฝั่ง UI เพื่อ UX เท่านั้น backend ตรวจซ้ำ)

## ทำงานอย่างไร

**ตัวห่อ**: `PersistentWorkspaceHost` โหลด `TabWorkspace` แบบ `dynamic` (`PersistentWorkspaceHost.tsx:37-39`) และส่ง `session`, `autoOpen` (จาก `?open=`) เข้ามา ดู [[fe-app-shell-routing]].

**สถานะหลัก** (`TabWorkspace.tsx:216-256`): `tabs` (`{key,title,code}`), `activeKey`, `mountedTabKeys`, `popupScreen`, `freqStats`, `expandedNodes`, `quickSearch`, `screenRightsMap`, `rightsLoaded`, `permissionDeniedNotice`.

**คีย์แท็บ**: เปิดเมนูเดียวกันซ้ำ = แท็บใหม่อิสระ คีย์เป็น `menu_x`, `menu_x#2`, `menu_x#3` ... และชื่อแท็บต่อท้าย ` #N`; `getBaseMenuKey` (`TabWorkspace.tsx:59-63`) ตัดส่วนหลัง `#` เพื่อหาคีย์ใน `SCREENS` ([[fe-screen-registry-menu]]).

**Keep-alive**: จอที่เคยเปิดจะอยู่ใน `mountedTabKeys` และไม่ถูก unmount เมื่อสลับแท็บ (ซ่อนไว้ ข้อมูลที่พิมพ์ค้างยังอยู่) - คีย์จะถูกเติมเข้า `mountedTabKeys` เมื่อเป็นแท็บ active (`:225-233`) และเรนเดอร์แผงเฉพาะแท็บ active หรือแท็บที่อยู่ใน `mountedTabKeys` (`:1554-1561`) แต่ละแผงมี `data-workspace-tab-panel` / `data-workspace-tab-active`.

**ลำดับตรวจใน `openScreen(menuName, {reuseExisting})`** (`TabWorkspace.tsx:536-613`)
1. ไม่มีใน `SCREENS` -> คืน `false`.
2. ผู้ใช้ไม่ใช่ admin และ `isAdminOnlyMenu` -> modal "จำกัดสิทธิ์เฉพาะผู้ดูแลระบบ".
3. ผู้ใช้ไม่ใช่ admin และสิทธิ์ยังโหลดไม่เสร็จ -> modal "กำลังตรวจสอบสิทธิ์".
4. ผู้ใช้ไม่ใช่ admin และไม่มี `right.read` ของจอนั้น -> modal "ไม่มีสิทธิ์เข้าใช้งานหน้าจอนี้".
5. `recordMenuUsage` นับสถิติเมนูที่ใช้บ่อย; ถ้า `screen.mode === "popup"` เปิดเป็น modal (`popupScreen`); ถ้า `reuseExisting` และมีแท็บอยู่แล้ว -> สลับไปแท็บนั้น; ไม่งั้นเปิดแท็บใหม่.

**สิทธิ์จอ (screen rights)**
- ผู้ใช้ที่ `session.isDemo || role === "ADMIN" || userLevel >= 9` ถือเป็น admin ไม่ต้องโหลดสิทธิ์ (`sessionIsAdmin` บรรทัด 201, state `isAdminUser` บรรทัด 250, เงื่อนไขข้ามการโหลด 258-265). คนอื่นเรียก `GET /api/workspace/my-screen-rights` (บรรทัด 266-282) ได้ `{is_admin, role, user_code, menus[]}` แล้วทำ map ตาม `code`.
- `getScreenRights(key)` (`TabWorkspace.tsx:626-638`) -> `ScreenRights {canAdd, canEdit, canDelete, readOnly}` (`TabsContext.tsx:41-47`): admin = `FULL_SCREEN_RIGHTS` (`TabsContext.tsx:49-54`); เมนู admin-only = อ่านอย่างเดียว; ระหว่างโหลด = `PENDING_SCREEN_RIGHTS` (ทุกอย่างปิด, `TabWorkspace.tsx:129`); อื่นๆ ตาม `right.add/edit/delete`.
- จอใช้ผ่าน hook ใน `TabsContext.tsx`: `useScreenRights()` (64) และ `useTabs()` (69); `canSaveWithRights(rights, isNew)` (57) = รายการใหม่ต้อง `canAdd`, รายการเดิมต้อง `canEdit` (ใช้ใน [[fe-standard-master-screen]] และ [[fe-transaction-screens]]).

**ค่าที่ `TabsApi` ให้จอ** (`TabsContext.tsx:15-38`): `openScreen`, `session`, `activeKey`, `isActive(menuKey)`, `screenKey` (คีย์เมนูของจอนี้), `screenRights`, `closeScreen()` (ปิดแบบตรวจข้อมูลค้าง), `discardAndCloseScreen(menuKey)` (ปิดทันที ใช้หลังจอถามยืนยันเองแล้ว). `ScreenTabsProvider` (`TabWorkspace.tsx:80-126`) ครอบแต่ละแผง (`:1670-1678`) และป๊อปอัป (`:1880-1888`) ให้ `screenKey/rights` ถูกต่อจอ.

**ปิดแท็บเมื่อมีข้อมูลค้าง**
- `checkTabDirty(tabKey)` (`TabWorkspace.tsx:647-668`) ตรวจ DOM ของแผงนั้น: ไล่ `span` ในแผง (รวม `header.card-head span` และ `[data-dirty-indicator='true']`) หาข้อความ "มีการแก้ไขข้อมูล", "เพิ่มรายการใหม่", "แก้ไขแล้ว ...", "โหมดแก้ไข" (ยกเว้นจอ `menu_mis_change_password`) โดยข้าม `span` ที่อยู่ใน dialog/datalist; หรือ flag `dirtyInputTabsRef` (`:640`) ที่ `onInputCapture` (`:1567-1597`) ตั้งเมื่อพิมพ์ใน input/textarea/select ที่ไม่ใช่ readOnly/disabled, ไม่อยู่ใน datalist/dialog, ไม่ใช่จอที่คีย์มีคำว่า `report` และ placeholder/`data-testid` ไม่ใช่ช่องค้นหา/กรอง. `Ctrl+S` ล้าง flag (`:1598-1603`) และการคลิกปุ่มที่ข้อความมี "บันทึก", "ยกเลิก", "ปิดหน้าจอ" หรือ "คืนค่า" ก็ล้างเช่นกัน (`:1655-1661`).
- `closeTab` (`:690-707`) ถ้า dirty เปิด `closeWarnState` (modal เตือน `data-testid="tab-unsaved-warning-modal"`, `:1725-1863`; โหมด `single` หรือ `all`) ไม่งั้นเรียก `forceCloseTab` (`:670-688`) ซึ่งเลือกแท็บข้างเคียงเป็น active. ปุ่ม "ปิด Tab ทั้งหมด" เรียก `closeAllTabs` (`:709-743`, ปุ่ม `:1415-1426`): ปิดแท็บที่ไม่ค้างทันที เหลือแท็บที่ค้างไว้พร้อม modal โหมด `all`.

**บันทึกสภาพ**: แท็บที่เปิดอยู่ + แท็บ active + สถานะผังเมนู เก็บ `localStorage["bc_workspace_tabs_v1_<db>_<USER>"]` (สร้างคีย์ `:210-214`, เขียน `tabKeys/activeKey/showTreePanel/expandedNodes` ที่ `:373-381`) และคืนค่าเมื่อเปิดใหม่ (`:295-357`; ข้ามจอแบบ popup). เก็บ `sessionStorage["bc_last_active_menu"]` และ(`:370`) และยิง event `bc:workspace-tab-change` (รายละเอียด activeKey/tabKey/code/title/tabCount) ให้ส่วนอื่นฟัง (`:383-392`).

**เมนูที่ใช้บ่อย / ค้นหาเมนู**
- `freqStats` เก็บ `{count,lastAt}` ต่อเมนู ใน `localStorage["bc_user_freq_menus_v1_<db>_<USER>"]` (สร้างคีย์ `:204-208`, โหลด `:400-415`, บวกสถิติเมื่อ `openScreen` เรียก `recordMenuUsage` `:417-439`, ปุ่ม "ล้าง" ใช้ `clearFrequentMenus` `:441-450`); จัดอันดับตาม count แล้ว lastAt ตัดที่ 16 รายการ (`:468-469`) และ dropdown แสดง 10 รายการแรก (`:1490`). รายการที่แสดงต้องมีจอใน `SCREENS` และอยู่ในรุ่นที่อนุญาตเท่านั้น (`:452-460`; ไม่ได้กรองตามสิทธิ์ แต่ `openScreen` ตรวจสิทธิ์ตอนคลิก).
- ค้นหาเมนู (`searchMatches`, `TabWorkspace.tsx:750-801`): ใช้ `matchSegmentedAndLike` (`:754-764`) กับรหัสเมนู, รหัสแบบจุดตามตำแหน่งในผัง (`legacyCode`), ข้อความเมนู, `name`, `owner` และฟิลด์ชื่อโมดูลที่เก็บในเมนู ก่อน (ตรงทุกคำ) ถ้าไม่เจอและพิมพ์ตั้งแต่ 2 คำจึงจับคู่บางส่วน (`minPartialThreshold`) แล้วจัดคะแนนด้วย `scoreSearchMatch`; แสดงสูงสุด 14 รายการ (`:772`, `:797`); กด Enter ที่ช่องค้นหาเปิดรายการแรกแล้วล้างช่อง (`:1200-1203`).
- หมวดเมนูบนแถบ: `getMenuCategory` (`frontend/shared/layout/MenuBar.tsx:131`; ค่า master / daily / cancel / report / general) ใช้จัดกลุ่มสีและชื่อในผังเมนู ([[fe-app-shell-routing]]).

**กรองตามรุ่นผลิตภัณฑ์**: แท็บ/ป๊อปอัปที่ไม่อยู่ใน `editionAllowedMenuSet` จะถูกซ่อนและสลับ active ไปแท็บอื่น (`editionAllowedMenuSet` `:188-196`; ซ่อนและสลับ active `:472-494`) ดู [[fe-screen-registry-menu]].

**ข้อควรระวัง**
- ตรวจ dirty อ่านข้อความภาษาไทยจาก DOM - ถ้าเปลี่ยนข้อความหัวจอ (เช่น "มีการแก้ไขข้อมูล") ตัวเตือนปิดแท็บจะไม่ทำงาน.
- คีย์แท็บมี `#N` เสมอเมื่อซ้ำ จอที่ใช้ `screenKey` ต้องใช้ฐานคีย์ ไม่ใช่คีย์แท็บ.

## ที่มาในโค้ด
- `frontend/account/tabs/TabWorkspace.tsx:59-63,80-126,129` - คีย์แท็บ, provider, สิทธิ์ระหว่างรอ
- `frontend/account/tabs/TabWorkspace.tsx:188-196,201,250-282` - รุ่น, admin, โหลดสิทธิ์
- `frontend/account/tabs/TabWorkspace.tsx:295-381,400-470` - บันทึกแท็บ, เมนูใช้บ่อย
- `frontend/account/tabs/TabWorkspace.tsx:536-638` - `openScreen`, `getScreenRights`
- `frontend/account/tabs/TabWorkspace.tsx:647-743,1725-1863` - ปิดแท็บ + modal เตือน
- `frontend/account/tabs/TabWorkspace.tsx:750-801,1200-1203` - ค้นหาเมนู
- `frontend/account/tabs/TabWorkspace.tsx:496-507,1314-1365,1554-1680,1865-1892` - ลากสลับแท็บ (`moveTab` `:496`), แผง keep-alive, ป๊อปอัป
- `frontend/account/tabs/TabsContext.tsx:15-75` - `TabsApi`, `ScreenRights`, hooks

## ดูเพิ่ม
[[frontend-overview]] · [[fe-screen-registry-menu]] · [[fe-app-shell-routing]] · [[fe-auth-session]] · [[fe-standard-master-screen]] · [[fe-transaction-screens]]
