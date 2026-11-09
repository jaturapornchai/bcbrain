---
title: "Serial Number บันทึกไม่ได้ (ซ้ำ ยาวเกิน ไม่พบในทะเบียน มากเกินไป)"
tags: [troubleshoot, stock]
aliases: ["ซีเรียลซ้ำ", "Serial ซ้ำในเอกสาร", "ไม่พบ Serial Number", "Serial ยาวเกิน", "Serial มากเกินไป", "ยิงซีเรียลไม่ขึ้น", "มี Serial Number ว่าง"]
sources: ["backend/internal/application/process/trans.go:984", "backend/internal/application/process/trans.go:988", "backend/internal/application/process/trans.go:995", "backend/internal/application/process/stock_tools.go:377", "backend/internal/application/process/stock_tools.go:411", "backend/internal/application/process/stock_beginning.go:254", "backend/internal/application/process/stock_beginning.go:26", "backend/internal/application/process/stock_tools.go:367", "frontend/src/config/schemas/erpOption/tab3Item.ts:153"]
---
# Serial Number บันทึกไม่ได้ (ซ้ำ ยาวเกิน ไม่พบในทะเบียน มากเกินไป)

**ข้อความที่เห็น:**
- "Serial Number ... ของสินค้า ... ซ้ำในเอกสาร"
- "Serial Number ... ยาวเกิน 50 ตัวอักษร"
- "จำนวน Serial Number มากเกินไป" หรือ "จำนวนรายการหรือ Serial Number มากเกินไป" (ยอดยกมา)
- ตอนตรวจนับด้วย Serial: "มีการป้อน Serial Number ... ซ้ำ", "มี Serial Number ว่างในรายการ", "ไม่พบ Serial Number ... ในทะเบียน Serial", "ต้องมี Serial Number 1-5000 รายการ"

**เกิดตอน:** บันทึกเอกสารที่มีสินค้า Serial หรือบันทึกที่เมนู สินค้า › ตรวจนับสต็อกและปรับปรุงจากการตรวจนับ › ตรวจสอบสินค้า Serial Number

**สาเหตุ:**
- Serial 1 ตัวคือของ 1 ชิ้น จึงใส่ซ้ำในเอกสารเดียวกันไม่ได้ (มักเกิดจากยิงบาร์โค้ดซ้ำ 2 ครั้ง)
- Serial ยาวได้ไม่เกิน 50 ตัวอักษร
- ใส่ Serial ในเอกสารเดียวมากเกินที่ระบบรับได้ (เอกสารทั่วไปรับได้ไม่เกิน 20000 ตัว ตรวจนับด้วย Serial รับได้ไม่เกิน 5000 ตัวต่อครั้ง)
- ตัวเลือก อนุญาติให้บันทึก Serial No ซ้ำ ในการตั้งค่า ตัวเลือกนี้มีบนจอ แต่รุ่นปัจจุบันยังไม่มีผล ระบบยังห้าม Serial ซ้ำในเอกสารเดียวกันเสมอ
- ตอนตรวจนับ ระบบหา Serial ในทะเบียนไม่เจอ แปลว่ายังไม่เคยรับเข้า หรือพิมพ์ผิด

**วิธีแก้ (บอกลูกค้าได้เลย):**
1. ลบแถว Serial ที่ซ้ำหรือว่างออก
2. ตรวจว่ายิงบาร์โค้ดถูกตัว ไม่ได้ยิงบาร์โค้ดสินค้าแทน Serial
3. ถ้า Serial มากเกินไป แบ่งเป็นหลายเอกสาร
4. ถ้าไม่พบในทะเบียน ตรวจว่าเคยบันทึกรับเข้า Serial นี้แล้ว ([[howto-stock-serial]])
5. หา Serial ที่ประวัติผิดปกติ ใช้เมนู สินค้า › สอบถามและวิเคราะห์ข้อมูลสินค้า (บนหน้าจอ) › ตรวจสอบ Serial มีปัญหา ([[howto-stock-serial-count]])

**ส่งต่อทีมงานเมื่อ:** Serial มีในทะเบียนแล้วแต่ระบบหาไม่เจอ หรือ Serial เดียวกันโผล่อยู่หลายสินค้า

## ดูต่อ
- [[howto-stock-serial]] · [[howto-stock-serial-count]] · [[howto-stock-overview]]
