---
title: "trans_flag ตัวหนึ่งถูกจัดการที่ไหนในโค้ดบ้าง (ถ้าจะเพิ่มหรือแก้ชนิดเอกสารต้องดูไฟล์ไหน)"
tags: [faq, trans-flag, dev, backend, frontend]
aliases: ["เพิ่ม trans_flag ใหม่", "flag นี้ไปอยู่ตรงไหนบ้าง", "calcFlagByTransFlag", "glRebuildTransFlags", "glRuleByScreen", "stockRowsSQL", "periodExemptFlags", "gridItemFlags", "TRANS_MENU_MAP", "transLayouts.ts"]
sources: ["backend/internal/application/process/transcalc.go:14", "backend/internal/application/process/stock_rebuild.go:18", "backend/internal/application/process/service.go:1731", "backend/internal/application/process/gl_template_rules.go:20", "backend/internal/application/process/trans_save_rules.go:53", "backend/internal/application/process/period.go:128", "backend/internal/application/process/trans_grid.go:87", "frontend/account/tabs/transMenuMap.ts:52", "frontend/account/transaction/transLayouts.ts:274"]
---
# trans_flag ตัวหนึ่งถูกจัดการที่ไหนในโค้ดบ้าง

**ตอบสั้น:** ไม่มีตารางกลางตารางเดียว — `trans_flag` ถูกใส่เป็นรายการ/แผนที่กระจายอยู่หลายไฟล์ใน `backend/internal/application/process/` และ 2 ไฟล์ฝั่ง `frontend/account/` ถ้าเพิ่มหรือเปลี่ยนชนิดเอกสาร ต้องไล่เช็กทุกจุดในตารางด้านล่างว่า flag นั้นควรอยู่ในรายการหรือไม่

## รายละเอียด
ความหมายของรหัสแต่ละตัวดู [[acc-trans-flag-map]] และ [[term-trans-flag]] หน้านี้เป็นแผนที่ "แต่ละเรื่องไปแก้ที่ไหน"

| เรื่อง | จุดในโค้ด | ผลต่อ flag |
|---|---|---|
| ทิศทางสต็อก `calc_flag` (+1/-1/0) | `transcalc.go` `calcFlagByTransFlag` | flag ที่ไม่อยู่ในลิสต์ = 0 (ไม่กระทบ) |
| บรรทัดที่นับเป็นความเคลื่อนไหวสต็อก | `stock_rebuild.go` `stockRowsSQL` (`trans_flag IN (...)`) | flag นอกลิสต์ไม่เข้ายอด `balance_qty` — ดู [[faq-stock-rebuild]] |
| สร้าง GL ใหม่ได้หรือไม่ | `service.go` `glRebuildTransFlags` + `buildStandardGLLines` | flag นอกลิสต์ไม่ถูกลบ/สร้าง GL ซ้ำ — ดู [[faq-gl-rebuild-when]] |
| รูปแบบ GL ตามรหัสหน้าจอ | `gl_template_rules.go` `glRuleByScreen` (screen code → เลข flag + กฎ `glRuleNN`) | ถ้าไม่พบ screen code ไม่ใช้รูปแบบ GL — ดู [[faq-gl-template-doc-format]] |
| ตรวจตอนบันทึก (ภาษีซื้อ ฯลฯ) | `trans_save_rules.go` `inputVatFlags` ฯลฯ | เช่น บังคับเลขที่ใบกำกับภาษี |
| ตรวจงวดบัญชี | `trans_validate.go:44` + `period.go` `periodExemptFlags` | 521/522/523 บันทึกได้โดยไม่ตรวจงวด ([[faq-period-closed-cannot-save]]) |
| ภาษีสมุดรายวัน | `journaltax.go` (1999, 1501, 1502) | แท็บภาษีของ JV ([[faq-journal-voucher-jv]]) |
| กริดรายการ (คอลัมน์/ราคา/คลัง) | `trans_grid.go` `gridItemFlags`, `saleGroupFlags`, `purchaseGroupFlags` ฯลฯ | flag ที่ไม่มีใน `gridItemFlags` ไม่มีกริดสินค้า |
| เอกสารยอดหัว/มัดจำ | `trans.go` `headerAmountFlags`, `depositFlags` | ไม่มีบรรทัดรายการ / ตรรกะมัดจำ |
| เมนู → flag | `frontend/account/tabs/transMenuMap.ts` `TRANS_MENU_MAP` (`transFlag`, `calcFlag`, `screenCode`, `docFormatCode`, `prefix`) | หน้าจอเอกสารสร้างจาก config นี้ ([[faq-menu-code-to-screen]]) |
| เลย์เอาต์หน้าจอ | `frontend/account/transaction/transLayouts.ts` `getTransLayout` | ฟิลด์หัว/แท็บ/โหมดกริดต่อ flag |

ขั้นตอนเมื่อเพิ่ม flag ใหม่: (1) เพิ่มแถวใน `TRANS_MENU_MAP` (2) ใส่ `calcFlagByTransFlag` ถ้ากระทบสต็อก (3) ใส่ `stockRowsSQL` ถ้านับเป็นยอดสต็อก (4) ใส่ `glRuleByScreen` / `glRebuildTransFlags` ถ้าต้องลง GL (5) ใส่ชุด flag ใน `trans_grid.go` ถ้ามีกริดสินค้า (6) เขียน test เทียบพฤติกรรมกับ C# เดิม ([[faq-parity-csharp-bccm]])

## ข้อควรระวัง
- รายการ flag ซ้ำกันหลายที่ ไม่มีการตรวจอัตโนมัติว่าตรงกัน (comment ใน `service.go:1730` เขียนว่า "must match the cases in buildStandardGLLines") ใส่ไม่ครบจะได้ผลเงียบ เช่น สต็อกไม่ขยับหรือ GL ไม่ถูกสร้างใหม่
- `calc_flag` ใน `ic_trans_detail` ถูกคำนวณจาก flag ตอนบันทึก (`trans.go:1152`) ไม่ใช่ค่าที่ผู้ใช้กรอก

## ดูเพิ่ม
- [[acc-trans-flag-map]]
- [[term-trans-flag]]
- [[acc-transaction-save-flow]]
- [[faq-menu-code-to-screen]]
- [[faq-gl-rebuild-when]]
- [[faq-stock-rebuild]]

## ที่มาในโค้ด
- `backend/internal/application/process/transcalc.go:14` `calcFlagByTransFlag` (+1 / -1 ต่อ flag)
- `backend/internal/application/process/stock_rebuild.go:18` `stockRowsSQL` กรอง `trans_flag IN (...)`
- `backend/internal/application/process/service.go:1731` `glRebuildTransFlags`
- `backend/internal/application/process/gl_template_rules.go:20` `glRuleByScreen`
- `backend/internal/application/process/trans_save_rules.go:53` `inputVatFlags`
- `backend/internal/application/process/period.go:128` `periodExemptFlags` (ใช้ที่ `trans_validate.go:44`)
- `backend/internal/application/process/trans_grid.go:87` `gridItemFlags` และกลุ่มขาย/ซื้อ (บรรทัด 92-93)
- `frontend/account/tabs/transMenuMap.ts:52` `TRANS_MENU_MAP` / `frontend/account/transaction/transLayouts.ts:274` `getTransLayout`
