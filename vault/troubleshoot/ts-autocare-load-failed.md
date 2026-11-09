---
title: "เปิด AutoCare แล้วขึ้น โหลดข้อมูล BC AutoCare ไม่สำเร็จ"
tags: [troubleshoot, autocare]
aliases: ["โหลดข้อมูล AutoCare ไม่สำเร็จ", "AutoCare ขึ้น error", "หน้า AutoCare ว่าง", "เกิดข้อผิดพลาดในการโหลดข้อมูล", "ดำเนินการไม่สำเร็จ", "คำสั่ง ไม่สำเร็จ", "AutoCare เปิดไม่ขึ้น"]
sources: ["frontend/autocare/AutoCareWorkspace.tsx:171", "frontend/autocare/AutoCareWorkspace.tsx:202", "frontend/autocare/AutoCareWorkspace.tsx:230", "frontend/autocare/AutoCareWorkspace.tsx:239"]
---
# เปิด AutoCare แล้วขึ้น "โหลดข้อมูล BC AutoCare ไม่สำเร็จ"

**อาการ:** เปิดหน้า AutoCare แล้วขึ้นข้อความ **"โหลดข้อมูล BC AutoCare ไม่สำเร็จ"** หรือ **"เกิดข้อผิดพลาดในการโหลดข้อมูล"** ข้อมูลไม่แสดง หรือกดปุ่มแล้วขึ้น **"คำสั่ง ... ไม่สำเร็จ"** / **"ดำเนินการไม่สำเร็จ"**

## เช็กตามลำดับ
1. กดรีเฟรชหน้า หรือปุ่ม "รีเฟรชกระดานคิวซ่อม" ดูอีกครั้ง
2. เข้าสู่ระบบอีกครั้ง (อาจหมดเวลาใช้งาน)
3. ตรวจอินเทอร์เน็ตและว่าเลือกบริษัท/ฐานข้อมูลถูก
4. ข้อความที่ต่อท้ายจากระบบ (ถ้ามี) บอกสาเหตุจริง เช่น ไม่มีสิทธิ์ [[ts-common-no-permission]]
5. ยังไม่หาย: ถ่ายภาพหน้าจอพร้อมเวลา แจ้งผู้ดูแลระบบ

## ข้อควรรู้
เปิดครั้งแรกในบริษัทใหม่ ระบบใส่ข้อมูลตัวอย่างให้เอง อาจใช้เวลานานกว่าปกติเล็กน้อย ดู [[sys-autocare-demo-data-limits]]

## ดูต่อ
[[howto-autocare-rebuild]] · [[sys-autocare-menus]]
