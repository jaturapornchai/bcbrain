---
title: "การจัดเมนูตาม Workflow หน้าจอยกเลิก/อนุมัติเอกสาร และ Lookup คลิกเดียว (Menu Workflow, Cancel Screens)"
tags: [standards, ux, menu, transaction, frontend]
aliases: ["เมนูตามลำดับงาน", "section divider เมนู", "หน้าจอยกเลิกเอกสาร", "cancel screens", "last_status", "คลิกเดียวเลือก lookup", "single-click lookup", "section cards แทน sub-tab", "ใช้ปุ่มแทน select", "ปุ่มบันทึกอยู่บนสุด", "SelectOrRadio"]
sources: ["docs/kms/KMS_BCWORK_UX_REPORT_AUTH_MAP_STANDARDS.md:7", "docs/kms/KMS_BCWORK_UX_REPORT_AUTH_MAP_STANDARDS.md:11", "docs/kms/KMS_BCWORK_UX_REPORT_AUTH_MAP_STANDARDS.md:43-46", ".agents/skills/bc-ux-workflow-and-platform-standards/SKILL.md:29-32", "AGENTS.md:44", "AGENTS.md:51", "frontend/src/config/bcMenu.json:25", "frontend/src/config/bcMenu.json:38", "frontend/shared/layout/MenuBar.tsx:404-407", "frontend/account/tabs/transMenuMap.ts:1", "frontend/account/transaction/UniversalTransScreen.tsx:463", "frontend/account/transaction/UniversalTransScreen.tsx:1130", "frontend/account/transaction/UniversalCancelConfirmScreen.tsx:26", "frontend/account/transaction/UniversalCancelConfirmScreen.tsx:377", "frontend/account/transaction/UniversalCancelConfirmScreen.tsx:439", "frontend/account/transaction/UniversalCancelConfirmScreen.tsx:490", "frontend/account/transaction/UniversalCancelConfirmScreen.tsx:813", "frontend/src/lib/query-client.ts:801", "backend/internal/adapter/inbound/http/router.go:138", "backend/internal/application/process/doc_cancel.go:120", "backend/internal/application/process/doc_cancel.go:205", "frontend/account/master/BcLookupModal.tsx:314-320", "frontend/account/master/BcLookupModal.tsx:328", "frontend/account/master/BcLookupModal.tsx:980-983", "frontend/shared/ui/SelectOrRadio.tsx:46", "frontend/shared/ui/SelectOrRadio.tsx:64"]
---

# เมนูตาม Workflow, หน้าจอยกเลิก/อนุมัติเอกสาร และ Lookup คลิกเดียว

มาตรฐาน UX หน้าจอธุรกรรมและเมนูที่ KMS (`KMS_BCWORK_UX_REPORT_AUTH_MAP_STANDARDS.md:7`, `:11`, §6 `:43-46`) บันทึกไว้ให้ทุก Session ยึดเหมือนกัน — โน้ตนี้แยกว่าข้อไหนมีโค้ดรองรับแล้ว ข้อไหนเป็นแค่ข้อความใน KMS

## กฎ/วิธีทำ
1. **ยุบ Sub-Tab เป็น Section Cards เรียงลงมาด้านล่าง** (Vertically Stacked Section Cards) และแยกเมนูย่อยที่เคยรวมกัน (`KMS…:7`) — แต่ต้องไม่ขัดกฎข้อ 6 ที่ห้ามยุบตารางหลายตัวเป็นแท็บเอง (`AGENTS.md:44`, ดู [[std-screen-header-toolbar-theme]])
2. **ตัวเลือกน้อยกว่า 10 รายการ ใช้ปุ่มกดแทน `<select>`** — ทำผ่าน `frontend/shared/ui/SelectOrRadio.tsx`: ถ้ามีตัวเลือก `> 0 && < 10` ให้วาดเป็น radio group แนวนอน (`:46-47`, เงื่อนไขที่ `:64`) ไม่เช่นนั้นคงเป็น `<select>` จอที่ import ใช้จริงมี `CustomerScreen`, `DocFormatScreen`, `IcExtraScreens`, `BarcodePrintScreen`, `CustomerDetailScreen` — จอใหม่ต้อง import เองถึงจะได้พฤติกรรมนี้
3. **ปุ่มบันทึกอยู่ด้านบนสุด** ของหน้าจอธุรกรรม (`KMS…:11`) — มีแค่ข้อความใน KMS ยังไม่ได้ตรวจเป็นกฎในโค้ดเดียว; ตำแหน่งปุ่มจริงดู Toolbar มาตรฐานใน [[std-screen-header-toolbar-theme]]
4. **Single-Click Lookup**: ตารางค้นหาใน Modal แว่นขยายเลือกข้อมูลและปิดทันทีเมื่อคลิก 1 ครั้ง — แถวใน `BcLookupModal.tsx` เรียก `handleConfirmSelect(row)` ใน `onClick` (`:980-983`)
   - ค้นหามี debounce 200 ms (`:328`)
   - ถ้ากด Enter ระหว่างที่ผลค้นหายังไม่มา (เช่นยิงบาร์โค้ดแล้ว Enter) โค้ดจดไว้แล้วเลือกแถวแรกของผลใหม่เมื่อมาถึง (`enterWhilePendingRef`, `:314-320`)
5. **เมนูเรียงตามลำดับการทำงาน (Workflow Order)** ใน `frontend/src/config/bcMenu.json` มี field `"section"` ต่อรายการ (เช่น `:25`, `:38`) และ `MenuBar.tsx` วาดแถบหัวข้อกลุ่มเมื่อ `section` ของรายการเปลี่ยนจากรายการก่อนหน้า (`isNewSec`, `:404-407`)
6. **แยกเมนูยกเลิก/อนุมัติเอกสารออกจากหน้าจอบันทึกปกติ**
   - ชนิดหน้าจอกำหนดใน `frontend/account/tabs/transMenuMap.ts` — `TransScreenMode = "doc" | "cancel" | "approve"` (`:1`) เมนูแบบ `menu_cancel_*` ตั้ง `mode: "cancel"` หรือ `"approve"`
   - `UniversalTransScreen.tsx:463` ถ้า `effective.mode` เป็น `cancel` หรือ `approve` ให้คืน `UniversalCancelConfirmScreen` แทนหน้าจอบันทึก (prop `mode` ที่ `UniversalCancelConfirmScreen.tsx:26`)
   - รายการเอกสารปกติกรองด้วย `COALESCE(t.last_status, 0) = 0` (`UniversalTransScreen.tsx:1130`; ใบเงินสด/ธนาคาร `cb_trans` ใช้คอลัมน์ `status` แทน) ส่วนหน้าจอยกเลิกถือว่าเอกสารที่ `last_status === 1` เป็น "ทำแล้ว" (`UniversalCancelConfirmScreen.tsx:377`)
   - ปุ่มยกเลิก/คืนสถานะเรียก `handleToggleStatus` (`:439`) → `setDocStatus` (`query-client.ts:801`) → backend `POST …/doc/cancel` และ `…/doc/approve` (`router.go:138-139`) ซึ่งสร้างใบยกเลิก/อนุมัติใน transaction เดียว (`CancelDoc` `doc_cancel.go:120`, `ApproveDoc` `:205`) — ตรงกับกฎข้อ 10 ว่า Frontend เป็น thin client (`AGENTS.md:51`)
   - การกู้คืนส่ง `undo: true` และข้อความตอบกลับคือ "คืนสถานะเอกสาร … เรียบร้อยแล้ว" (`:490`); ป้ายโหมดบนหัวจอเป็นสีเหลืองอำพัน "โหมดยกเลิกเอกสาร" / "โหมดอนุมัติเอกสาร" (`:813`)

## ส่วนที่ KMS เขียนไว้แต่โค้ดปัจจุบันไม่ตรง
- ตัวอย่าง `isCancelScreen = … menuKey.includes("_cancel") …` ใน KMS ไม่มีในโค้ดแล้ว (ค้น `isCancelScreen` ทั้ง `frontend/` ไม่พบ) — การแยกโหมดใช้ `mode` จาก `transMenuMap.ts` ตามข้อ 6
- KMS ว่าหน้าจอยกเลิกมี "แบนเนอร์สีแดง" แต่ในโค้ดที่ตรวจเป็นป้ายสีเหลืองอำพันตามข้อ 6 ไม่พบแบนเนอร์แดง
- `frontend/shared/layout/EnterpriseWorkbench.tsx` และ `AccountMainScreen.tsx` ที่ KMS อ้างว่าวาด Sidebar ไม่มีใน repo ตัวที่วาดหัวข้อกลุ่มคือ `MenuBar.tsx`
- skill (`SKILL.md:29-32`) ชี้ `frontend/src/components/...UniversalCancelConfirmScreen.tsx` ซึ่งไม่ใช่ที่อยู่ปัจจุบัน ไฟล์จริงอยู่ที่ `frontend/account/transaction/`

## ที่มา
- `docs/kms/KMS_BCWORK_UX_REPORT_AUTH_MAP_STANDARDS.md:7`, `:11` (Objective ข้อ 3, 7) และ `:43-46` (Workflow §6)
- `.agents/skills/bc-ux-workflow-and-platform-standards/SKILL.md:29-32` (Workflow ข้อ 4)
- `AGENTS.md:44`, `:51` กฎข้อ 6, 10
- โค้ดตามรายการ `sources` ข้างบน (ตรวจแล้วมีจริง)

## ดูเพิ่ม
[[standards-overview]] · [[std-add-screen-workflow]] · [[std-screen-header-toolbar-theme]] · [[std-input-controls-and-labels]] · [[std-parallel-unit-and-ref-import]] · [[std-frontend-ux-bug-lessons]] · [[frontend-overview]] · [[process-overview]]
