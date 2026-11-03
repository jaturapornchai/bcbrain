---
title: "ปิดบัญชีสิ้นงวด/สิ้นปี (โอนรายได้-ค่าใช้จ่ายเข้ากำไรสะสม) ทำอย่างไร ระบบลงบัญชีอะไร"
tags: [faq, period, year-end, gl, closing]
aliases: ["ปิดบัญชีสิ้นปี", "ประมวลผลสิ้นปี", "ประมวลผลสิ้นงวด", "year end close", "GLClose", "trans_flag 1998", "trans_flag 1999", "close_to_account", "menu_gl_end_of_year", "menu_close_account_process"]
sources: ["backend/internal/application/process/workflow.go:723", "backend/internal/application/process/workflow.go:766", "backend/internal/application/process/workflow.go:791", "backend/internal/application/process/workflow.go:817", "backend/internal/application/process/workflow.go:868", "backend/internal/application/process/workflow.go:891", "frontend/account/process/SystemProcessWorkbenchScreen.tsx:149"]
---
# ปิดบัญชีสิ้นงวด/สิ้นปี (โอนรายได้-ค่าใช้จ่ายเข้ากำไรสะสม) ทำอย่างไร ระบบลงบัญชีอะไร

**ตอบสั้น:** ใช้เมนูประมวลผลสิ้นงวด (1998) หรือประมวลผลสิ้นปี (1999) ระบบรวมยอดคงเหลือของบัญชีรายได้/ค่าใช้จ่าย (`account_type` 3, 4) ในช่วงวันที่ แล้วกลับรายการทุกบัญชี ยอดสุทธิ (กำไร/ขาดทุน) ลงบัญชีที่ผู้ใช้เลือกเป็น "บัญชีที่ปิดเข้า" ไม่มีรหัสกำไรสะสมตายตัวในโค้ด

## รายละเอียด
ดู [[flow-period-year-close]] และ [[acc-period-close]]

**เมนู** (ทุกเมนูไปที่จอ `gl_close_period`)
- `menu_gl_end_of_period` "ประมวลผลสิ้นงวด" → โหมด period (1998)
- `menu_gl_end_of_year` "ประมวลผลสิ้นปี" และ `menu_close_account_process` "ประมวลผลกำไร/ขาดทุน และต้นทุนขาย" → โหมด year (1999)
- เมนูอยู่หมวด "③ ตรวจสอบ ผ่านรายการ สอบถามบัญชี และปิดงวด" เฉพาะผู้ดูแล (adminOnly)

**ช่วงวันที่ (`resolveCloseDates`)**
- period: อ่าน `date_start`, `date_end` ของงวดที่เลือก ไม่พบ → "ไม่พบงวดบัญชีที่ %d"
- year: min(`date_start`) ถึง max(`date_end`) ของ `period_year` ไม่พบ → "ไม่พบงวดบัญชีของปี %d"
- หรือส่งช่วงวันที่เอง

**การคำนวณ (`computeGLClose`, `glCloseFromSums`)**
- ยอดต่อบัญชี = SUM(debit − credit) ของ `gl_journal_detail` ([[tbl-gl-journal]]) ในช่วงวันที่
- ยอดเดบิตคงเหลือ → Cr บัญชีนั้น, ยอดเครดิตคงเหลือ → Dr บัญชีนั้น (ปัด 2 ตำแหน่ง)
- กำไร = เครดิต − เดบิต; กำไร > 0 → Cr บัญชีที่ปิดเข้า, ขาดทุน → Dr บัญชีที่ปิดเข้า

**การบันทึก (`GLClose`)**
1. กดดูตัวอย่างก่อน (ไม่บันทึก) จอถามยืนยันก่อนบันทึกจริง
2. ต้องระบุเลขที่เอกสาร (≤ 25 ตัว), สมุดรายวัน, บัญชีที่ปิดเข้า
3. `checkGLCloseDoc`: สมุดต้องมีจริง, บัญชีที่ปิดเข้าต้องเป็นบัญชีย่อย (`status` = 0) ไม่ใช่ → "ไม่พบบัญชีที่ปิดเข้า X (ต้องเป็นบัญชีย่อย)", เลขที่ถูกใช้กับเอกสารอื่น → conflict
4. ลบเอกสารปิดเลขเดิม (`gl_trans`, `gl_trans_detail`, `gl_journal`, `gl_journal_detail`) แล้วสร้างใหม่ จึงรันซ้ำเลขเดิมได้
5. ไม่มียอด → "ไม่มียอดรายได้/ค่าใช้จ่ายในช่วงวันที่ ..."
6. เขียน `gl_journal` journal_type 2, trans_direct 1, วันที่ = วันสุดท้ายของช่วง และบันทึก process log

## ข้อควรระวัง
- งานนี้ไม่ตรวจว่างวดเปิดอยู่ และไม่เปลี่ยน `status` ของงวด การปิดงวดต้องแก้ที่เมนู 1.8.1 เอง ([[faq-period-closed-cannot-save]])
- ยอดรวมใช้ `gl_journal_detail` ทุกแถวในช่วง ไม่กรอง `is_pass` และรวมเอกสารปิดเลขอื่นในช่วงเดียวกันด้วย ถ้าปิดรายงวด (1998) ไปแล้ว ยอดสิ้นปีจะเหลือเฉพาะส่วนที่ยังไม่ปิด
- ปัด 2 ตำแหน่งตายตัว (`closeLine`) ไม่อ่าน `gl_no_decimal`
- `gl_trans_detail` เก็บฝั่งยอดคงเหลือ (สลับ Dr/Cr กับ `gl_journal_detail`)
- 1999 อยู่ใน `journalFlags` ของหน้าจอ JV (`period.go:131`) ([[faq-journal-voucher-jv]])
- ไม่พบโค้ดปิดต้นทุนขาย/สต็อกในงานนี้ แม้ชื่อเมนูมีคำว่า "ต้นทุนขาย"

## ดูเพิ่ม
- [[flow-period-year-close]]
- [[faq-period-closed-cannot-save]]
- [[faq-journal-voucher-jv]]
- [[faq-gl-rebuild-when]]
- [[tbl-erp-account-period]]

## ที่มาในโค้ด
- `backend/internal/application/process/workflow.go:723` `resolveCloseDates` (`:741` ไม่พบงวดของปี)
- `backend/internal/application/process/workflow.go:754` `closeLine` ปัด 2
- `backend/internal/application/process/workflow.go:766` `computeGLClose` (`account_type IN (3, 4)`)
- `backend/internal/application/process/workflow.go:791` `glCloseFromSums`
- `backend/internal/application/process/workflow.go:817` `GLClose` (1998/1999, ลบแล้วสร้างใหม่)
- `backend/internal/application/process/workflow.go:868` `checkGLCloseDoc`; `:891` `insertGLCloseDoc`
- `frontend/account/process/SystemProcessWorkbenchScreen.tsx:149` เลือกโหมด year/period; `:530` `runGLClose`
- `frontend/account/tabs/screenRegistry.tsx:1163` เมนูที่ไปจอ `gl_close_period`
- `frontend/src/config/bcMenu.json:9638` `menu_gl_end_of_period`; `:9652` `menu_gl_end_of_year`; `:9666` `menu_close_account_process`
