---
title: "พื้นที่ทำงานแบบแท็บ MDI และสิทธิ์จอ (TabWorkspace)"
tags: [frontend, tabs, mdi, workspace, rights, permission]
aliases: ["TabWorkspace", "TabsContext", "แท็บหลายจอ", "MDI", "openScreen", "ScreenRights", "สิทธิ์จอ", "เมนูที่ใช้บ่อย", "ค้นหาเมนู", "ปิดแท็บมีข้อมูลค้าง", "useTabs", "useScreenRights", "canSaveWithRights"]
sources: ["frontend/account/tabs/TabWorkspace.tsx:58", "frontend/account/tabs/TabWorkspace.tsx:197", "frontend/account/tabs/TabWorkspace.tsx:254", "frontend/account/tabs/TabWorkspace.tsx:532", "frontend/account/tabs/TabWorkspace.tsx:643", "frontend/account/tabs/TabsContext.tsx:15", "frontend/account/tabs/TabsContext.tsx:41", "frontend/shared/layout/PersistentWorkspaceHost.tsx:37"]
---

# พื้นที่ทำงานแบบแท็บ MDI และสิทธิ์จอ (TabWorkspace)

`TabWorkspace` คือ "หน้าต่างโปรแกรมบัญชี" ที่เปิดหลายจอเป็นแท็บพร้อมกัน เลียนแบบ MDI ของ BC เดิม มีแถบเมนูบน, ผังเมนู, เมนูที่ใช้บ่อย, ค้นหาเมนู และแท็บของจอที่เปิดอยู่
จอทุกจอได้รับสิทธิ์ เพิ่ม/แก้ไข/ลบ ผ่าน `TabsContext` (กันฝั่ง UI เพื่อ UX เท่านั้น backend ตรวจซ้ำ)

## ทำงานอย่างไร

**ตัวห่อ**: `PersistentWorkspaceHost` โหลด `TabWorkspace` แบบ `dynamic` (`PersistentWorkspaceHost.tsx:37`) และส่ง `session`, `autoOpen` (จาก `?open=`) เข้ามา ดู [[fe-app-shell-routing]].

**สถานะหลัก** (`TabWorkspace.tsx:200-255`): `tabs` (`{key,title,code}`), `activeKey`, `mountedTabKeys`, `popupScreen`, `freqStats`, `expandedNodes`, `quickSearch`, `screenRightsMap`, `rightsLoaded`, `permissionDeniedNotice`.

**คีย์แท็บ**: เปิดเมนูเดียวกันซ้ำ = แท็บใหม่อิสระ คีย์เป็น `menu_x`, `menu_x#2`, `menu_x#3` ... และชื่อแท็บต่อท้าย ` #N`; `getBaseMenuKey` (บรรทัด 58) ตัดส่วนหลัง `#` เพื่อหาคีย์ใน `SCREENS` ([[fe-screen-registry-menu]]).

**Keep-alive**: จอที่เคยเปิดจะอยู่ใน `mountedTabKeys` และไม่ถูก unmount เมื่อสลับแท็บ (ซ่อนไว้ ข้อมูลที่พิมพ์ค้างยังอยู่) - เรนเดอร์ที่ `TabWorkspace.tsx:1539-1550`, แต่ละแผงมี `data-workspace-tab-panel` / `data-workspace-tab-active`.

**ลำดับตรวจใน `openScreen(menuName, {reuseExisting})`** (บรรทัด 532-600)
1. ไม่มีใน `SCREENS` -> คืน `false`.
2. ผู้ใช้ไม่ใช่ admin และ `isAdminOnlyMenu` -> modal "จำกัดสิทธิ์เฉพาะผู้ดูแลระบบ".
3. ผู้ใช้ไม่ใช่ admin และสิทธิ์ยังโหลดไม่เสร็จ -> modal "กำลังตรวจสอบสิทธิ์".
4. ผู้ใช้ไม่ใช่ admin และไม่มี `right.read` ของจอนั้น -> modal "ไม่มีสิทธิ์เข้าใช้งานหน้าจอนี้".
5. `recordMenuUsage` นับสถิติเมนูที่ใช้บ่อย; ถ้า `screen.mode === "popup"` เปิดเป็น modal (`popupScreen`); ถ้า `reuseExisting` และมีแท็บอยู่แล้ว -> สลับไปแท็บนั้น; ไม่งั้นเปิดแท็บใหม่.

**สิทธิ์จอ (screen rights)**
- ผู้ใช้ที่ `session.isDemo || role === "ADMIN" || userLevel >= 9` ถือเป็น admin ไม่ต้องโหลดสิทธิ์ (บรรทัด 197, 254-260). คนอื่นเรียก `GET /api/workspace/my-screen-rights` (บรรทัด 261-280) ได้ `{is_admin, role, user_code, menus[]}` แล้วทำ map ตาม `code`.
- `getScreenRights(key)` (บรรทัด 622-632) -> `ScreenRights {canAdd, canEdit, canDelete, readOnly}` (`TabsContext.tsx:41-47`): admin = `FULL_SCREEN_RIGHTS`; เมนู admin-only = อ่านอย่างเดียว; ระหว่างโหลด = `PENDING_SCREEN_RIGHTS` (ทุกอย่างปิด, บรรทัด 128); อื่นๆ ตาม `right.add/edit/delete`.
- จอใช้ผ่าน hook ใน `TabsContext.tsx`: `useScreenRights()` (64) และ `useTabs()` (69); `canSaveWithRights(rights, isNew)` (57) = รายการใหม่ต้อง `canAdd`, รายการเดิมต้อง `canEdit` (ใช้ใน [[fe-standard-master-screen]] และ [[fe-transaction-screens]]).

**ค่าที่ `TabsApi` ให้จอ** (`TabsContext.tsx:15-38`): `openScreen`, `session`, `activeKey`, `isActive(menuKey)`, `screenKey` (คีย์เมนูของจอนี้), `screenRights`, `closeScreen()` (ปิดแบบตรวจข้อมูลค้าง), `discardAndCloseScreen(menuKey)` (ปิดทันที ใช้หลังจอถามยืนยันเองแล้ว). `ScreenTabsProvider` (บรรทัด 79) ครอบแต่ละแผงและป๊อปอัปให้ `screenKey/rights` ถูกต่อจอ.

**ปิดแท็บเมื่อมีข้อมูลค้าง**
- `checkTabDirty(tabKey)` (643-665) ตรวจ DOM ของแผงนั้น: หาข้อความหัวจออย่าง "มีการแก้ไขข้อมูล", "เพิ่มรายการใหม่", "แก้ไขแล้ว ...", "โหมดแก้ไข" (ยกเว้นจอ `menu_mis_change_password`) นอกจาก dialog/datalist; หรือ flag `dirtyInputTabsRef` ที่ `onInputCapture` ตั้งเมื่อพิมพ์ในช่องที่ไม่ใช่ช่องค้นหา/readOnly/รายงาน. `Ctrl+S` ล้าง flag (บรรทัด 1586-1588).
- `closeTab` (686) ถ้า dirty เปิด `closeWarnState` (modal เตือน, โหมด `single` หรือ `all`, บรรทัด 1711+) ก่อนเรียก `forceCloseTab` (666). ปิดแล้วเลือกแท็บข้างเคียงเป็น active.

**บันทึกสภาพ**: แท็บที่เปิดอยู่ + แท็บ active + สถานะผังเมนู เก็บ `localStorage["bc_workspace_tabs_v1_<db>_<USER>"]` (บรรทัด 207-212, 360-378) และคืนค่าเมื่อเปิดใหม่ (290-). เก็บ `sessionStorage["bc_last_active_menu"]` และยิง event `bc:workspace-tab-change` (รายละเอียด activeKey/code/title/tabCount) ให้ส่วนอื่นฟัง (บรรทัด 380).

**เมนูที่ใช้บ่อย / ค้นหาเมนู**
- `freqStats` เก็บ `{count,lastAt}` ต่อเมนู ใน `localStorage["bc_user_freq_menus_v1_<db>_<USER>"]` (บรรทัด 201-205, 395-441); จัดอันดับตาม count แล้ว lastAt ตัดที่ 16 รายการ (บรรทัด 464-465) และ dropdown แสดง 10 รายการแรก (บรรทัด 1476). รายการที่แสดงต้องมีจอใน `SCREENS` และอยู่ในรุ่นที่อนุญาตเท่านั้น (บรรทัด 448-455; ไม่ได้กรองตามสิทธิ์ แต่ `openScreen` ตรวจสิทธิ์ตอนคลิก).
- ค้นหาเมนู (`quickSearch`, บรรทัด 745-795): ใช้ `matchSegmentedAndLike` กับ `code, legacyCode, text, name, owner, csharpModule` ก่อน (ตรงทุกคำ) ถ้าไม่เจอจึงจับคู่บางส่วนแล้วจัดคะแนน; แสดงสูงสุด 14 รายการ; กด Enter เปิดรายการแรก (บรรทัด 1186).
- หมวดเมนูบนแถบ: `getMenuCategory` (master / daily / cancel / report / general) จาก `MenuBar.tsx` ใช้จัดกลุ่มสีและชื่อในผังเมนู ([[fe-app-shell-routing]]).

**กรองตามรุ่นผลิตภัณฑ์**: แท็บ/ป๊อปอัปที่ไม่อยู่ใน `editionAllowedMenuSet` จะถูกซ่อนและสลับ active ไปแท็บอื่น (บรรทัด 466-490) ดู [[fe-screen-registry-menu]].

**ข้อควรระวัง**
- ตรวจ dirty อ่านข้อความภาษาไทยจาก DOM - ถ้าเปลี่ยนข้อความหัวจอ (เช่น "มีการแก้ไขข้อมูล") ตัวเตือนปิดแท็บจะไม่ทำงาน.
- คีย์แท็บมี `#N` เสมอเมื่อซ้ำ จอที่ใช้ `screenKey` ต้องใช้ฐานคีย์ ไม่ใช่คีย์แท็บ.

## ที่มาในโค้ด
- `frontend/account/tabs/TabWorkspace.tsx:58-62,79,128` - คีย์แท็บ, provider, สิทธิ์ระหว่างรอ
- `frontend/account/tabs/TabWorkspace.tsx:184-290` - รุ่น, admin, โหลดสิทธิ์
- `frontend/account/tabs/TabWorkspace.tsx:360-465` - บันทึกแท็บ, เมนูใช้บ่อย
- `frontend/account/tabs/TabWorkspace.tsx:532-632` - `openScreen`, `getScreenRights`
- `frontend/account/tabs/TabWorkspace.tsx:643-740,1711-1830` - ปิดแท็บ + modal เตือน
- `frontend/account/tabs/TabWorkspace.tsx:745-795,1186` - ค้นหาเมนู
- `frontend/account/tabs/TabWorkspace.tsx:1304-1330,1539-1660,1850-1875` - ลากสลับแท็บ (`moveTab` 492), แผง keep-alive, ป๊อปอัป
- `frontend/account/tabs/TabsContext.tsx:15-72` - `TabsApi`, `ScreenRights`, hooks

## ดูเพิ่ม
[[frontend-overview]] · [[fe-screen-registry-menu]] · [[fe-app-shell-routing]] · [[fe-auth-session]] · [[fe-standard-master-screen]] · [[fe-transaction-screens]]
