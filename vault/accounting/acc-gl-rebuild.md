---
title: "กระบวนการสร้างสมุดรายวัน GL ใหม่ (GL Rebuild Process)"
tags: [accounting, gl, journal, rebuild, postgres]
aliases: ["สร้าง GL ใหม่", "RebuildGL", "ลงบัญชีอัตโนมัติ", "gl_journal", "gl_journal_detail", "trans_direct", "ประมวลผล GL"]
sources: ["backend/internal/application/process/service.go:1308", "backend/internal/application/process/service.go:1331", "backend/internal/application/process/service.go:1381", "backend/internal/application/process/service.go:1389", "backend/internal/application/process/service.go:1427", "backend/internal/application/process/service.go:1437", "backend/internal/application/process/service.go:1458", "backend/internal/application/process/service.go:1499", "backend/internal/application/process/service.go:1585", "backend/internal/application/process/service.go:1594", "backend/internal/application/process/service.go:1600", "backend/internal/application/process/service.go:1612", "backend/internal/application/process/service.go:1625", "backend/internal/application/process/service.go:1663", "backend/internal/application/process/service.go:1669", "backend/internal/application/process/service.go:1678", "backend/internal/application/process/service.go:1689", "backend/internal/application/process/service.go:1698", "backend/internal/application/process/service.go:1742", "backend/internal/application/process/service.go:1759", "backend/internal/application/process/service.go:508", "backend/internal/application/process/gl_template.go:1029", "backend/internal/application/process/gl_template.go:1046", "backend/internal/application/process/gl_template.go:1096", "backend/internal/application/process/doc_cancel.go:585"]
---

# กระบวนการสร้างสมุดรายวัน GL ใหม่ (`rebuildGLTx`)

GL ของเอกสารอัตโนมัติไม่ได้ถูกแก้ทีละบรรทัด แต่จะลบ journal อัตโนมัติเดิมทิ้ง แล้วสร้างใหม่จากเอกสารต้นทางทุกครั้ง ทั้งตอนบันทึกเอกสาร (ทีละเอกสาร) และตอนสั่ง `RebuildGL` (ตามช่วงวันที่) โดยลองใช้ template ของรูปแบบเอกสารก่อน ถ้าไม่มีจึงใช้การลงบัญชีมาตรฐาน

## ทำงานอย่างไร

### การล็อก
- `RebuildGL` (service.go:1308) ต้องระบุเลขเอกสารหรือช่วงวันที่ timeout 60 วินาที และใช้ lock แบบ exclusive (service.go:1331)
- การบันทึกเอกสารปกติใช้ `lockGLShared` (service.go:1381) = shared lock บน key "gl_journal:rebuild" จึงบันทึกเอกสารพร้อมกันได้ แต่จะรอ RebuildGL ทั้งช่วง

### ขั้นตอน (service.go:1389)
1. ลบหัว `gl_journal` ที่ไม่มีบรรทัด (orphan) แม้จะเป็น `trans_direct` = 1 — คำสั่งนี้ทำทั้งฐาน ไม่จำกัดตามเลขเอกสาร/ช่วงวันที่ (:1427)
2. ลบ `gl_journal_detail` และ `gl_journal` ที่ `trans_direct` <> 1 ของเอกสารในขอบเขตและ flag ใน `glRebuildTransFlags` (:1437, flag :1742) journal ที่คีย์มือ `trans_direct` = 1 ไม่ถูกแตะ
3. ดึงเอกสารที่ต้องลง GL (:1458)
   - `ic_trans` ที่ `is_cancel` = 0 และ flag อยู่ใน `glRebuildTransFlags` และไม่มี GL คีย์มือ
   - UNION `ap_ar_trans` 19/239 (ยอด = `total_net_value` ของหัวเอกสาร :1499; คอมเมนต์ในโค้ดเขียนว่า Σ sum_pay_money แต่ SQL ใช้ `total_net_value`)
   - เอกสารสต็อก/เงินที่ `total_amount` = 0 ใช้ผลรวมบรรทัด (`sum_of_cost`, `sum_amount`, `transfer_amount` หรือ ROUND(qty x average_cost, 2))
4. ต่อเอกสาร (:1585)
   - ลอง `tpl.post` (template จาก `erp_doc_format_gl`) ก่อน ดู [[acc-gl-template-engine]]
   - template ลงรายการแล้ว = ข้าม; template ไม่สมดุลจะได้คำเตือนแล้วไปใช้ standard (gl_template.go:1046); วันที่ไม่มีงวดหรืองวดปิด template ถือว่าจัดการแล้วแต่ไม่ลง GL พร้อมคำเตือน (gl_template.go:1029)
   - ไม่มี template ใช้ `buildStandardGLLines` ดู [[acc-gl-posting-standard]]
   - ยอดติดลบไม่ลง; ยอดศูนย์ลงได้เฉพาะใบที่ตัดมัดจำเต็มจำนวน (:1594)
   - งวด/ปีบัญชี: หาจาก `erp_account_period` ตามวันที่เอกสาร ไม่ดู `status` ไม่พบ = 0 ไว้ก่อน (:1600)
   - สมุดบัญชีจาก `erp_doc_format.gl_book` และคำอธิบายจาก `gl_description` (:1612)
   - `ValidateAndBalanceJournal(lines, 2)` (:1625, ฟังก์ชันที่ :508): ต้องมีอย่างน้อย 1 บรรทัด, ปัดแต่ละบรรทัด HALF_UP 2 ตำแหน่งแล้ว ΣDr = ΣCr และ ΣDr > 0 มิฉะนั้น error `ErrUnbalancedJournal` (ชนิด validation) และ rollback ทั้ง transaction
   - INSERT `gl_journal` (debit = credit = ยอดรวม, `trans_direct` = 0) และ `gl_journal_detail` (`debit_or_credit` 0 = Dr, 1 = Cr :1759)
5. `postTemplateOnly` (:1663): โพสต์เอกสารที่มีแต่ template คือ flag 72, 418 (gl_template.go:1096) และขายสินทรัพย์ 1802
6. ปรับบัญชีของยอดยกมาสินค้า 54 ที่ไม่มีในผังบัญชี: บรรทัด Dr = สินค้า 1131/1130/1140, บรรทัดอื่น = ทุน 3110/3100/3210 (:1678)
7. `reverseCancelledGL` (doc_cancel.go:585) กลับรายการเอกสารยกเลิก: เอกสารยกเลิกได้ GL ของต้นฉบับสลับ Dr/Cr ลงวันที่ของเอกสารยกเลิก (:1689)
8. Normalize หัว journal (:1698): period/year ที่เป็น 0/NULL หาใหม่จาก `erp_account_period` ไม่พบใช้เดือน/ปีของวันที่เอกสาร, `branch_code` ว่าง = '00000', book แล้ว sync ค่าเหล่านี้ลง `gl_journal_detail`

## จุดเสี่ยง
- **GL standard ไม่ตรวจงวดปิด**: หางวดอย่างเดียว ไม่อ่าน `status` (:1600) ขณะที่ template ข้ามเอกสารในงวดปิด ดังนั้น `RebuildGL` ทั้งช่วงอาจเขียน GL ใหม่ในงวดที่ปิดแล้ว ส่วนการบันทึกเอกสารปกติมีด่านงวดก่อนแล้ว ดู [[acc-period-close]]
- **สร้างผังบัญชีอัตโนมัติ**: INSERT `gl_chart_of_account` รหัส '212015' (เจ้าหนี้ไม่ถึงกำหนดตั้งหนี้) (:1669) และ '1122-01' (เช็ครับระหว่างเรียกเก็บ) โดยไม่สนใจ error
- **411 แก้ GL ของเอกสารอื่น**: ตอนสร้าง GL ของ 411 จะ UPDATE บัญชีฝั่ง Dr ของเอกสาร 410 ที่ใช้เช็คเดียวกันเป็น 1122-01 ดู [[acc-cheque-transfer]]
- งวดไม่พบตอนสร้าง GL: ขั้น normalize ใส่ `period_number` = เดือน และ `account_year` = ปีของวันที่เอกสารแทน จึงอาจไม่ตรงกับงวดบัญชีจริงของบริษัท
- บัญชีที่หาไม่เจอทั้งชุด `resolveChartAccount` คืนรหัสตัวแรกที่ขอทั้งที่ไม่มีในผัง (`service.go:1781`) ไม่ได้ไปตก "9999" — 9999 ใช้เฉพาะตอนไม่ได้ส่งรหัสมาเลย (`:1783`)

## ที่มาในโค้ด
- `backend/internal/application/process/service.go:1308` RebuildGL
- `backend/internal/application/process/service.go:1381` lockGLShared
- `backend/internal/application/process/service.go:1389` rebuildGLTx
- `backend/internal/application/process/service.go:1427` ลบ journal orphan
- `backend/internal/application/process/service.go:1458` ดึงเอกสาร
- `backend/internal/application/process/service.go:1585` template ก่อน standard
- `backend/internal/application/process/service.go:1600` หางวดโดยไม่ดู status
- `backend/internal/application/process/service.go:1625` ตรวจสมดุล
- `backend/internal/application/process/service.go:1669` สร้างผังบัญชี 212015
- `backend/internal/application/process/service.go:508` ValidateAndBalanceJournal

## ดูเพิ่ม
- [[acc-gl-posting-standard]]
- [[acc-gl-template-engine]]
- [[acc-period-close]]
- [[accounting-overview]]
