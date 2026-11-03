---
title: "กระบวนการสร้างสมุดรายวัน GL ใหม่ (GL Rebuild Process)"
tags: [accounting, gl, journal, rebuild, postgres]
aliases: ["สร้าง GL ใหม่", "RebuildGL", "ลงบัญชีอัตโนมัติ", "gl_journal", "gl_journal_detail", "trans_direct", "ประมวลผล GL"]
sources: ["backend/internal/application/process/service.go:1297", "backend/internal/application/process/service.go:1370", "backend/internal/application/process/service.go:1378", "backend/internal/application/process/service.go:1413", "backend/internal/application/process/service.go:1480", "backend/internal/application/process/service.go:1567", "backend/internal/application/process/service.go:1585", "backend/internal/application/process/service.go:1614", "backend/internal/application/process/service.go:1655", "backend/internal/application/process/service.go:1678", "backend/internal/application/process/service.go:508"]
---

# กระบวนการสร้างสมุดรายวัน GL ใหม่ (`rebuildGLTx`)

GL ของเอกสารอัตโนมัติไม่ได้ถูกแก้ทีละบรรทัด แต่จะลบ journal อัตโนมัติเดิมทิ้ง แล้วสร้างใหม่จากเอกสารต้นทางทุกครั้ง ทั้งตอนบันทึกเอกสาร (ทีละเอกสาร) และตอนสั่ง `RebuildGL` (ตามช่วงวันที่) โดยลองใช้ template ของรูปแบบเอกสารก่อน ถ้าไม่มีจึงใช้การลงบัญชีมาตรฐาน

## ทำงานอย่างไร

### การล็อก
- `RebuildGL` (service.go:1297) ต้องระบุเลขเอกสารหรือช่วงวันที่ และใช้ lock แบบ exclusive
- การบันทึกเอกสารปกติใช้ `lockGLShared` (service.go:1370) = shared lock บน key "gl_journal:rebuild" จึงบันทึกเอกสารพร้อมกันได้ แต่จะรอ RebuildGL ทั้งช่วง

### ขั้นตอน (service.go:1378)
1. ลบหัว `gl_journal` ที่ไม่มีบรรทัด (orphan) แม้จะเป็น `trans_direct` = 1 (:1413)
2. ลบ `gl_journal_detail` และ `gl_journal` ที่ `trans_direct` <> 1 ของเอกสารในขอบเขต (journal ที่คีย์มือ `trans_direct` = 1 ไม่ถูกแตะ)
3. ดึงเอกสารที่ต้องลง GL (:1480)
   - `ic_trans` ที่ `is_cancel` = 0 และ flag อยู่ใน `glRebuildTransFlags` และไม่มี GL คีย์มือ
   - UNION `ap_ar_trans` 19/239 (ยอด = `total_net_value` ของหัวเอกสาร; คอมเมนต์ `service.go:1485` เขียนว่า Σ sum_pay_money แต่ SQL `:1488` ใช้ `total_net_value`)
   - เอกสารสต็อก/เงินที่ `total_amount` = 0 ใช้ผลรวมบรรทัด (`sum_of_cost`, `sum_amount`, `transfer_amount` หรือ ROUND(qty x average_cost, 2))
4. ต่อเอกสาร (:1567)
   - ลอง `tpl.post` (template จาก `erp_doc_format_gl`) ก่อน ดู [[acc-gl-template-engine]]
   - ถ้า template จัดการแล้ว ข้าม; ถ้าไม่มี template ใช้ `buildStandardGLLines` ดู [[acc-gl-posting-standard]]
   - ยอดติดลบไม่ลง; ยอดศูนย์ลงได้เฉพาะใบที่ตัดมัดจำเต็มจำนวน
   - งวด/ปีบัญชี: หาจาก `erp_account_period` ตามวันที่เอกสาร ไม่พบ = 0 (:1585)
   - สมุดบัญชีจาก `erp_doc_format.gl_book` และคำอธิบายจาก `gl_description`
   - `ValidateAndBalanceJournal(lines, 2)` (:1614, ฟังก์ชันที่ :508): ทุกบรรทัดต้องไม่ติดลบ และ Dr = Cr ที่ 2 ตำแหน่ง มิฉะนั้น error `ErrUnbalancedJournal` และ rollback
   - INSERT `gl_journal` (debit = credit = ยอดรวม, `trans_direct` = 0) และ `gl_journal_detail` (`debit_or_credit` 0 = Dr, 1 = Cr)
5. `postTemplateOnly`: โพสต์เอกสารที่มีแต่ template เช่น 72, 418 และขายสินทรัพย์ 1802
6. ปรับบัญชีของยอดยกมาสินค้า 54 ที่ไม่มีในผังบัญชี (สินค้า 1131/1130/1140, ทุน 3110/3100/3210)
7. `reverseCancelledGL` (doc_cancel.go:585) กลับรายการเอกสารยกเลิก (:1678)
8. Normalize หัว journal: period/year, `branch_code` ว่าง = '00000', book

## จุดเสี่ยง
- **GL standard ไม่ตรวจงวดปิด**: หางวดอย่างเดียว ไม่อ่าน `status` (:1585-1592) ขณะที่ template ข้ามเอกสารในงวดปิด ดังนั้น `RebuildGL` ทั้งช่วงอาจเขียน GL ใหม่ในงวดที่ปิดแล้ว ส่วนการบันทึกเอกสารปกติมีด่านงวดก่อนแล้ว ดู [[acc-period-close]]
- **สร้างผังบัญชีอัตโนมัติ**: INSERT `gl_chart_of_account` รหัส '212015' (เจ้าหนี้ไม่ถึงกำหนดตั้งหนี้) (:1655-1659) และ '1122-01' (เช็ครับระหว่างเรียกเก็บ) โดยไม่สนใจ error
- **411 แก้ GL ของเอกสารอื่น**: ตอนสร้าง GL ของ 411 จะ UPDATE บัญชีฝั่ง Dr ของเอกสาร 410 ที่ใช้เช็คเดียวกันเป็น 1122-01 ดู [[acc-cheque-transfer]]
- งวดไม่พบ = 0 ทำให้ GL มี `period_number` 0 ได้
- บัญชีที่หาไม่เจอทั้งชุด `resolveChartAccount` คืนรหัสตัวแรกที่ขอทั้งที่ไม่มีในผัง (`service.go:1769-1771`) ไม่ได้ไปตก "9999" — 9999 ใช้เฉพาะตอนไม่ได้ส่งรหัสมาเลย (`:1772`)

## ที่มาในโค้ด
- `backend/internal/application/process/service.go:1297` RebuildGL
- `backend/internal/application/process/service.go:1370` lockGLShared
- `backend/internal/application/process/service.go:1378` rebuildGLTx
- `backend/internal/application/process/service.go:1413` ลบ journal เดิม
- `backend/internal/application/process/service.go:1480` ดึงเอกสาร
- `backend/internal/application/process/service.go:1567` template ก่อน standard
- `backend/internal/application/process/service.go:1585` หางวดโดยไม่ดู status
- `backend/internal/application/process/service.go:1614` ตรวจสมดุล
- `backend/internal/application/process/service.go:1655` สร้างผังบัญชี 212015
- `backend/internal/application/process/service.go:508` ValidateAndBalanceJournal

## ดูเพิ่ม
- [[acc-gl-posting-standard]]
- [[acc-gl-template-engine]]
- [[acc-period-close]]
- [[accounting-overview]]
