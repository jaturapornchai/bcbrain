---
title: "บทเรียนกฎตอนบันทึกเอกสาร (Trans Save Rules & Validation)"
tags: [history, lesson, trans, save, validation]
aliases: ["กฎตอนบันทึกเอกสาร", "checkTransScreenSave", "warning_branch_input", "doc_group binding", "book_code gl_journal", "CONFIRM prefix"]
sources: ["backend/internal/application/process/trans_validate.go:43", "backend/internal/application/process/trans_validate.go:26", "backend/internal/application/process/trans_validate.go:175", "backend/internal/application/process/trans.go:341", "backend/internal/application/process/trans.go:302", "backend/internal/application/process/trans_save_rules.go:134", "backend/internal/application/process/trans_save_rules.go:50", "backend/internal/application/process/trans_lot_auto.go:32", "backend/internal/application/process/trans_set_item.go:71", "frontend/account/transaction/TransTopForm.tsx:628", "frontend/account/transaction/TransExtraTabs.tsx:308", "frontend/account/transaction/UniversalTransScreen.tsx:1271", "AGENTS.md:51"]
---
# บทเรียนกฎตอนบันทึกเอกสาร

ด่านตรวจตอนบันทึก `ic_trans` ต้องอยู่ฝั่ง Go ใน transaction เดียวกับการบันทึก ถ้าปล่อยให้ browser ตรวจเอง API ที่ถูกเรียกตรงจะข้ามด่านได้ และถ้าช่องบนจอผูกคอลัมน์ผิด ข้อมูลจะถูกเขียนทับแบบไม่มีใครเห็น

## อะไรพังได้
- **ไม่มีด่านฝั่ง server:** ปิดงวด ตรวจช่องบังคับ คู่ค้า เอกสารอ้างอิง วงเงินเครดิต ยอดคงเหลือ lot ภาษีซื้อ ถ้าตรวจเฉพาะใน browser ก็เรียก API ตรงข้ามไปได้
- **ตรวจผิดจังหวะ:** ตัวเลือก `warning_branch_input` ต้องเช็ค "สิ่งที่ผู้ใช้พิมพ์ในช่องสาขา" ไม่ใช่สาขาที่ระบบเติม default ให้แล้ว ถ้าเช็คหลังเติม ช่องที่ผู้ใช้ล้างจะมองไม่เห็น
- **ช่องผูกคอลัมน์ผิด:** ช่อง "กลุ่มเอกสาร" เคยไปผูกกับ `approve_code` (กลุ่มผู้อนุมัติ) ทำให้ `doc_group` ไม่ถูกบันทึกและ `approve_code` ถูกทับ
- **ค่าค้างข้ามเอกสาร:** ช่องสมุดรายวันของ `gl_journal` ถ้าไม่ถูกตั้งค่าตอนเปิดเอกสาร เอกสาร B จะถูกบันทึกด้วย `book_code` ของเอกสาร A
- **สินค้าชุด/สูตรสี:** `item_type` 3 และ 5 ต้องกระจายเป็นแถวลูก ไม่งั้นสต็อกและยอดรวมไม่ตรง

## โค้ดป้องกันไว้อย่างไร
| ด่าน | ที่อยู่ | ทำอะไร |
|---|---|---|
| รวมด่านทั้งหมดในธุรกรรมบันทึก | `trans.go:302` เรียก `checkTransScreenSave` ภายใน `checkAndSaveTransTx` | ตรวจก่อนเขียนเอกสาร ถ้าไม่ผ่านทั้ง tx ถูกยกเลิก |
| ปิดงวด | `trans_validate.go:43-47` | `checkOpenPeriod` ทุก flag ยกเว้น `periodExemptFlags` (`period.go:128`) |
| สวิตช์จาก `erp_option` | `trans_validate.go:26-39` | อ่านด้วย `COALESCE(..., 0)` ไม่มีแถว = ปิดทุกสวิตช์ |
| สาขาที่ผู้ใช้พิมพ์ | `trans.go:341` `transBranch` คืน `(code, box)`; `trans_validate.go:175` เช็ค `branchBox` | แยกค่าที่พิมพ์ออกจากค่า default |
| เอกสารอ้างอิง | `trans_validate.go:81-87` | `checkReferencedLines` และ `checkQtyOverDocRef` (`trans_qty_over_ref.go:41`) |
| กฎบันทึกชุดใหญ่ | `trans_save_rules.go:134` `checkTransSaveRules`; `:389` `checkStockBalance`; `:522` `checkCreditLimit` | ยอดคงเหลือ เครดิต ต้นทุน ภาษี |
| ถามผู้ใช้แล้วส่งซ้ำ | `trans_save_rules.go:50` ตอบ 409 `CONFIRM:<คำถาม>`; client `UniversalTransScreen.tsx:2810-2819` | ผู้ใช้กดตกลงแล้ว client ส่งซ้ำพร้อม `confirmed` ด่านแข็งยังบล็อกเหมือนเดิม |
| lot อัตโนมัติ | `trans_lot_auto.go:32` `autoLots` (เรียกที่ `trans.go:285`) | เติม lot ฝั่ง server เฉพาะ flag 44 ใบใหม่ |
| สินค้าชุด | `trans_set_item.go:71` `expandSet` | แทรกแถวลูกใต้แถวชุด มี `ref_guid` ของแถวชุด |
| กลุ่มเอกสาร | `TransTopForm.tsx:628`, `TransExtraTabs.tsx:308` | ผูกกับ `docGroup` เท่านั้น มีคอมเมนต์กำกับว่า `approve_code` เป็นคนละช่อง |
| สมุดรายวัน | `UniversalTransScreen.tsx:1271-1274` | โหลด `book_code` ของเอกสารที่เปิดทุกครั้ง |

## กฎที่ต้องจำ
1. ด่านทุกด่านอยู่ใน `checkTransScreenSave` ภายใน tx บันทึก (กฎข้อ 10 ใน `AGENTS.md:51`: backend คุมกฎทั้งหมด) ฝั่ง browser ตรวจเพื่อ UX เท่านั้น
2. option ที่ตรวจ "ช่องบนจอ" ต้องส่งค่าที่ผู้ใช้พิมพ์จริงเข้า server ไม่ใช่ค่าหลังเติม default
3. ผูกช่องด้วยชื่อคอลัมน์ ไม่ใช่ตามป้ายบนจอ และค่าต่อเอกสารต้อง reset/โหลดใหม่ทุกครั้งที่เปิดเอกสาร
4. คำถามที่ต้องถามผู้ใช้ใช้ข้อความนำหน้า `CONFIRM:` หรือ `CREDIT_PASSWORD:` (409) แล้วให้ client ส่งซ้ำ ห้ามตัดสินใจฝั่ง client

## ที่มาในโค้ด
- `backend/internal/application/process/trans_validate.go:26-92` สวิตช์ `erp_option` และลำดับด่าน
- `backend/internal/application/process/trans.go:278,285,302,341` สาขา lot และจุดเรียกด่าน
- `backend/internal/application/process/trans_save_rules.go:50,134` โปรโตคอล CONFIRM และกฎบันทึก
- `frontend/account/transaction/UniversalTransScreen.tsx:1271-1274,2810-2819` โหลดสมุดรายวันและส่ง CONFIRM ซ้ำ
- ดูเพิ่ม: [[acc-transaction-save-flow]] · [[acc-credit-limit-save-rules]] · [[acc-period-close]] · [[proc-grid-calc]] · [[hist-lessons-doc-ref-docflow]] · [[hist-lessons-cancel-delete-partial]]
