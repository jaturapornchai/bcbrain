---
title: "บันทึกเอกสารแล้วขึ้น GL ไม่สมดุล (debit credit do not balance) แก้ยังไง"
tags: [faq, gl, troubleshoot, balance, validation]
aliases: ["เดบิตเครดิตไม่เท่ากัน", "GL ไม่บาลานซ์", "unbalanced journal", "ErrUnbalancedJournal", "debit and credit totals do not balance", "menu_gl_check_data", "ตรวจสอบความถูกต้อง GL", "gl-check"]
sources: ["backend/internal/application/process/service.go:29", "backend/internal/application/process/service.go:508", "backend/internal/application/process/service.go:1625", "backend/internal/application/process/gl_template.go:1046", "backend/internal/application/process/docs.go:286", "backend/internal/application/process/workflow.go:554", "backend/internal/application/process/service.go:1766"]
---
# บันทึกเอกสารแล้วขึ้น GL ไม่สมดุล (debit credit do not balance) แก้ยังไง

**ตอบสั้น:** ข้อความ "GL journal debit and credit totals do not balance: debit=… credit=…" มาจากการลงบัญชีมาตรฐาน เมื่อผลรวม Dr ≠ Cr ที่ 2 ตำแหน่ง หรือยอดเป็น 0 ระบบยกเลิกการบันทึกทั้งเอกสาร ตรวจยอดหัวเอกสาร ยอดแท็บชำระเงิน และรูปแบบ GL

## รายละเอียด
มีจุดตรวจสมดุล 3 จุด
1. **เส้นมาตรฐาน** `ValidateAndBalanceJournal(lines, 2)`: ต้องมีบรรทัด, Dr = Cr หลังปัด HALF_UP 2 ตำแหน่ง และยอดรวม > 0 ไม่ผ่าน → error ประเภท validation ข้อความขึ้นต้น `doc <เลขที่>:` และ transaction ย้อนกลับ ([[faq-save-atomic-partial]])
2. **รูปแบบ GL** ([[faq-gl-template-doc-format]]): ไม่สมดุล → ไม่ error แต่เก็บคำเตือน "รายการบัญชีตามรูปแบบ GL (…) ไม่สมดุล เดบิต … เครดิต …" แล้วลองเส้นมาตรฐานต่อ
3. **ข้อมูลรายวัน JV**: "ยอดเดบิต (…) และเครดิต (…) ไม่เท่ากัน" ([[faq-journal-voucher-jv]])

สาเหตุที่เป็นไปได้ตามโค้ด
- บรรทัดทั้งหมดเป็น 0 (ระบบตัดบรรทัด 0 ทิ้ง) หรือยอดรวม 0 → ไม่ผ่านเงื่อนไขยอดรวม > 0
- เส้นมาตรฐานสร้าง Dr/Cr จากยอดชุดเดียวกัน (base = total − vat) ส่วนยอดแท็บชำระเงินที่ไม่ตรง ระบบใช้เงินสดบรรทัดเดียวแทน จึงไม่ทำให้ไม่สมดุล แต่บัญชีอาจผิด ([[acc-payment-tab]]) กรณีไม่สมดุลอื่นของแต่ละ flag ไม่ชัดจากโค้ด
- รูปแบบ GL ขาดแถวหรือ action ผิด → ไม่สมดุลแล้วตกไปเส้นมาตรฐาน ตั้ง action 90 เพื่อชดเชยเศษเล็ก

**ตรวจย้อนหลัง** ใช้ "ตรวจสอบความถูกต้อง" (`menu_gl_check_data`) ที่จอประมวลผลระบบ ([[scr-system-process-workbench]]) ตรวจ: รายวันย่อยที่ไม่มีผังบัญชี, ใช้ผังบัญชีหลัก, รายวันที่ Dr ≠ Cr, ไม่พบหัวเอกสาร, ไม่พบสมุดรายวัน, เอกสารที่ยังไม่ลงบัญชี และรับ/จ่ายชำระที่ยังไม่ลงบัญชี

## ข้อควรระวัง
- เส้นมาตรฐานไม่ตรวจว่ารหัสบัญชีมีในผังจริง: ถ้าไม่พบรหัสในลิสต์ `resolveChartAccount` คืนรหัสแรกของลิสต์ (ไม่ใช่ 9999) GL จะสมดุลแต่ใช้รหัสที่ไม่มีในผัง ใช้ข้อตรวจ "รายวันย่อยที่ไม่มีผังบัญชี" หาได้
- ข้อความ error ของเส้นมาตรฐานเป็นภาษาอังกฤษ ส่วนคำเตือนของรูปแบบ GL ไม่แสดงบนหน้าจอ

## ดูเพิ่ม
- [[hist-lessons-gl-posting-balance]]
- [[faq-gl-rebuild-when]]
- [[faq-balance-mismatch-troubleshoot]]
- [[acc-gl-posting-standard]]

## ที่มาในโค้ด
- `backend/internal/application/process/service.go:29` `ErrUnbalancedJournal`
- `backend/internal/application/process/service.go:508` `ValidateAndBalanceJournal`
- `backend/internal/application/process/service.go:1625` เรียกตรวจ แล้วห่อ KindValidation
- `backend/internal/application/process/gl_template.go:1046` รูปแบบ GL ไม่สมดุล → เส้นมาตรฐาน
- `backend/internal/application/process/docs.go:286` ตรวจ Dr = Cr ของ JV
- `backend/internal/application/process/workflow.go:554` `GLCheck` รายการตรวจ
- `backend/internal/application/process/service.go:1766` `resolveChartAccount`
