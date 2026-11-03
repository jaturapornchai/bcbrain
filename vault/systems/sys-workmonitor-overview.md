---
title: "3D จอพนักงาน ภาพรวม (SYS-14 WorkMonitor)"
tags: [systems, workmonitor, 3d, webrtc, monitoring]
aliases: ["WorkMonitor", "3D จอพนักงาน", "SYS-14", "/workmonitor", "3D Office Live", "EmployeeWorkMonitor3DScreen", "Workstation & Screen Monitor", "ระบบ 3D จอพนักงาน"]
sources: ["frontend/shared/layout/SystemPortalScreen.tsx:77-82", "frontend/shared/layout/SystemPortalScreen.tsx:321-337", "frontend/shared/layout/Header.tsx:74-80", "frontend/shared/layout/Header.tsx:129-130", "frontend/shared/layout/PersistentWorkspaceHost.tsx:81-86", "frontend/shared/layout/PersistentWorkspaceHost.tsx:93-102", "frontend/shared/layout/PersistentWorkspaceHost.tsx:167-172", "frontend/shared/layout/PersistentWorkspaceHost.tsx:511-514", "frontend/src/app/workmonitor/page.tsx:1-18", "frontend/src/proxy.ts:10-25", "frontend/src/app/api/workmonitor/route.ts:24-42", "frontend/src/app/api/workmonitor/route.ts:168-220", "frontend/workmonitor/inMemoryHub.ts:53-88", "frontend/workmonitor/inMemoryHub.ts:459-484", "frontend/workmonitor/inMemoryHub.ts:486-526", "frontend/workmonitor/workmonitorData.ts:113-149"]
---
# 3D จอพนักงาน (SYS-14)

`WorkMonitor` คือจอ "ออฟฟิศ 3 มิติ" ที่ให้ผู้ดูแลเห็นว่าเครื่องของพนักงานที่กำลังเปิด BC Ai Account อยู่ตอนนี้กำลังทำอะไร: โต๊ะแต่ละตัวในฉาก Three.js คือหนึ่งแท็บของพนักงาน คลิกแล้วเห็นหน้าจอสดของแท็บนั้นในกรอบด้านขวา ข้อมูลทั้งหมดอยู่ในหน่วยความจำของเซิร์ฟเวอร์ ไม่มีตารางฐานข้อมูล รายละเอียดการส่งหน้าจอและการสร้างสัญญาณ WebRTC อยู่ที่ [[sys-workmonitor-telemetry-webrtc]]

## ใครใช้ / เปิดอย่างไร
- ผู้ใช้หลัก: ผู้บริหารหรือหัวหน้างานที่ต้องการเห็นการใช้งานจริงของพนักงานในฐานข้อมูล (บริษัท) เดียวกัน
- เปิดจากหน้ารวมระบบ (Portal) การ์ด `SYS-14` "3D จอพนักงาน (ดูหน้าจอการทำงานสด)" ป้าย "3D Office Live" ในกลุ่ม "④ 3D Command Center & ตรวจสอบ" ลิงก์ไป `/workmonitor` หรือจากแถบหัวระบบ "ระบบ 3D จอพนักงาน"
- หน้า `/workmonitor` เป็น Server Page: ไม่มี session เด้งไป `/login` ยังไม่เลือกฐานข้อมูลเด้งไป `/select-database` ถ้าผ่านจะวาง `WorkspaceRouteSync` แล้ว `PersistentWorkspaceHost` โหลดจอ `EmployeeWorkMonitor3DScreen` แบบโหลดตามต้องการ (ดู [[fe-tabs-workspace]])
- บนโดเมนเดโม ด่าน `proxy` อนุญาตเส้นทาง `/workmonitor` ไว้ในรายการที่กำหนด (เหมือน `/monitormap` และ `/fraudwarning` ที่อยู่กลุ่มเดียวกัน ดู [[sys-monitormap-overview]])

## ภาพรวมการทำงาน
1. ทุกหน้าของ workspace ที่ล็อกอินแล้วมีตัวแทนเงียบ `WorkstationTelemetryAgent` ติดอยู่ใน `PersistentWorkspaceHost` (ไม่แสดงอะไรบนหน้าจอพนักงาน) มันเปิด SSE `GET /api/workmonitor/stream?role=agent` เพื่อลงทะเบียน "โต๊ะ" ของแท็บนี้
2. ผู้ดูเปิด `/workmonitor` จอเปิดสวิตช์ดูสดเป็นค่าเริ่มต้น แล้วเปิด SSE ฝั่งผู้ดู (`role=viewer`) เซิร์ฟเวอร์ส่ง `init_snapshot` กลับ และบอกทุกแท็บพนักงานว่า "มีคนดูอยู่"
3. เมื่อมีคนดู ตัวแทนบนเครื่องพนักงานเริ่มส่งสถานะหน้าจอ (หน้าที่เปิด ช่องที่กำลังพิมพ์ ตำแหน่งเมาส์ ภาพรวม DOM) ผ่าน `POST /api/workmonitor` (`telemetry_ping`) และเปิดท่อ WebRTC ตรงไปยังผู้ดู
4. ผู้ดูเห็นโต๊ะในฉาก 3 มิติ เลือกโต๊ะเพื่อดูหน้าจอจำลองแบบสดและซูมได้ ลากย้ายโต๊ะหรือสั่งจัดผังอัตโนมัติ (`move_desk`, `apply_preset_layout`) ตำแหน่งใหม่ถูกกระจายให้ผู้ดูทุกคนทันที
5. ปิดสวิตช์ดูหรือไม่มีผู้ดูเหลือ: เซิร์ฟเวอร์สั่งตัวแทนปิดท่อ WebRTC และ `telemetry_ping` ถูกข้าม (`skippedBecauseNoViewer`) จึงไม่มีข้อมูลหน้าจอของพนักงานถูกส่งเข้าเซิร์ฟเวอร์ (แต่การบันทึกพฤติกรรมไป `/api/fraudwarning` ยังทำงานตามปกติ ดูหัวข้อความสัมพันธ์)
6. พนักงานปิดแท็บ: ตัวแทนส่ง `disconnect` แล้วโต๊ะหายจากฉาก

เส้นทาง `/api/workmonitor` (GET, POST 6 การกระทำ) และ `/api/workmonitor/stream` อธิบายไว้ครบที่ [[api-ops-health-monitormap]] ไม่เขียนซ้ำที่นี่ ทั้งสองเป็นเส้นทางของชั้น Next เท่านั้น ไม่ผ่านระบบหลังบ้าน Go

## ข้อมูลอยู่ที่ไหน (ไม่มีตารางฐานข้อมูล)
`getInMemoryHub(database)` เก็บสถานะใน `globalThis.__bcWorkMonitorRamHubMap` แยกตามชื่อฐานข้อมูลของ session (ตัวพิมพ์เล็ก ค่าเริ่มต้น `bcdemo`) แต่ละฐานมี:
- `sessions` โต๊ะ/แท็บที่ออนไลน์ (`EmployeeDeskNode`) และ `layouts` ตำแหน่งโต๊ะที่ผู้ดูลากไว้
- `logs` ประวัติการเปลี่ยนหน้าจอล่าสุดสูงสุด 30 รายการ (ตอบกลับ 25)
- `viewers` และ `agents` คือ callback ของ SSE ที่เชื่อมอยู่ และ `totalSignalsRelayed` ตัวนับสัญญาณ WebRTC ที่ส่งต่อ

ผลที่ตามมา: รีสตาร์ท Next แล้วข้อมูลหายหมด และถ้ารันหลาย process/หลายเครื่องจะไม่ใช้สถานะร่วมกัน ผู้ดูกับพนักงานต้องต่อเข้า process เดียวกัน

กฎล้างโต๊ะที่ค้าง (`pruneStaleInMemorySessions`) ทำงานทุกครั้งที่ขอ snapshot:
- โต๊ะที่ `routePath` เป็น `/workmonitor` ถูกลบทิ้ง (ไม่แสดงหน้าจอของจอดูเอง)
- โต๊ะที่มี SSE ตัวแทนเชื่อมอยู่: ลบทั้งโต๊ะและตัวแทนเมื่อไม่มีการอัปเดตเกิน 180 วินาที
- โต๊ะที่ไม่มี SSE ตัวแทน: ลบเมื่อเงียบเกิน 15 วินาที

ข้อสังเกตจากการอ่านโค้ด (ยังไม่ได้ทดสอบจริง): ตัวแทนส่ง `telemetry_ping` เฉพาะตอนมีคนดูหรือเมื่อสั่งบังคับ จึงไม่มีสัญญาณต่ออายุเป็นระยะตอนไม่มีผู้ดู โต๊ะที่เปิดค้างนานเกิน 180 วินาทีก่อนผู้ดูคนแรกเข้า อาจถูกล้างออกจาก hub ตอนผู้ดูเปิดจอ

## ตัวเลขสรุป (KPI)
`getInMemoryWorkMonitorSnapshot` คำนวณจำนวนโต๊ะ ออนไลน์ กำลังพิมพ์ ว่าง ค่าเฉลี่ยจำนวนครั้งกดแป้นใน 60 วินาทีล่าสุด (`avgKpmRate`) และผลรวม `txVolumeToday` / `docsProcessedToday` ของทุกโต๊ะ ข้อจำกัดของโค้ดปัจจุบัน:
- `docsProcessedToday` ไม่มีจุดใน hub ที่บวกเพิ่ม ตัวเลข "เอกสารที่ประมวลผล" จึงเป็น 0 เสมอ
- `txVolumeToday` รับได้เฉพาะเมื่อ `telemetry` ส่ง `txAmount` มา แต่ตัวแทนไม่ส่งค่านี้ จึงเป็น 0 เสมอ
- ตัวแทนตั้งสถานะได้เพียง `ONLINE` หรือ `TYPING` (มีการกดแป้นภายใน 60 วินาที) จำนวนโต๊ะ "ว่าง" (`IDLE`) จึงเป็น 0

## ความสัมพันธ์กับระบบบัญชีและระบบอื่น
- ไม่อ่านหรือเขียนตารางบัญชี ใช้เพียง session (`userCode`, `userName`, `database`) จากการล็อกอิน ดู [[fe-auth-session]]
- ชื่อหน้าจอที่โชว์มาจากแท็บ workspace ที่พนักงานเปิดจริง (รหัสเมนู + ชื่อจอ) เช่น POS, WMS, TMS, e-Tax ดู [[fe-tabs-workspace]] และ [[fe-screen-registry-menu]]
- ตัวแทนตัวเดียวกันนี้ยังบันทึกพฤติกรรมการแก้ไขข้อมูลส่งไป `/api/fraudwarning` ตลอดเวลา ไม่ขึ้นกับว่ามีคนดูหรือไม่ ดู [[sys-fraudwarning-overview]]
- ปุ่มบนแถบควบคุม "3D Warning (ตรวจทุจริต)" พาไปยัง `/fraudwarning`; ระบบพี่น้องในกลุ่มเดียวกันคือ [[sys-monitormap-overview]]

## ข้อควรระวังและข้อจำกัด
- **ตัวแทนไม่แจ้งพนักงาน**: ตัวแทน `return null` ไม่มีป้ายหรือปุ่มใดบนหน้าจอพนักงาน และไม่ขอสิทธิ์จากเบราว์เซอร์ การแจ้งพนักงานจึงเป็นเรื่องของนโยบายบริษัท ไม่ใช่ของโปรแกรม
- **ที่อยู่เครื่อง** มาจากหัวข้อ `x-forwarded-for` หรือ `x-real-ip` ถ้าไม่มีใช้ค่าเครื่องตัวเอง จึงเชื่อถือได้เฉพาะเมื่อผ่านพร็อกซีที่ตั้งค่าถูกต้อง
- **ใช้ได้เฉพาะ process เดียว** และ STUN ที่ใช้เป็นบริการสาธารณะของผู้ให้บริการภายนอก ถ้าเครือข่ายองค์กรบล็อก ท่อ WebRTC อาจไม่ขึ้น (ฝั่งดูยังเห็นภาพ DOM ที่ส่งผ่านเซิร์ฟเวอร์ ดู [[sys-workmonitor-telemetry-webrtc]])

## ที่มาในโค้ด
- `frontend/shared/layout/SystemPortalScreen.tsx:77-82,321-337` กลุ่มและการ์ด SYS-14; `frontend/shared/layout/Header.tsx:74-80,129-130` ป้ายหัวระบบ
- `frontend/shared/layout/PersistentWorkspaceHost.tsx:81-86` โหลดตัวแทน; `:93-102` โหลดจอผู้ดู/จอ 3D Warning; `:167-172` จับคู่เส้นทาง; `:511-514` วางตัวแทนในทุกหน้า workspace
- `frontend/src/app/workmonitor/page.tsx:1-18` redirect ตาม session; `frontend/src/proxy.ts:10-25` รายการเส้นทางบนโดเมนเดโม
- `frontend/src/app/api/workmonitor/route.ts:24-42` GET snapshot; `:168-220` `telemetry_ping` (ข้ามเมื่อไม่มีผู้ดู, ที่อยู่จากหัวข้อ)
- `frontend/workmonitor/inMemoryHub.ts:53-88` โครง hub แยกตามฐาน; `:459-484` กฎล้างโต๊ะ; `:486-526` KPI และสถิติ
- `frontend/workmonitor/workmonitorData.ts:113-149` โซนพื้นของฉาก 3 มิติ
- ดูเพิ่ม: [[sys-workmonitor-telemetry-webrtc]] · [[sys-fraudwarning-overview]] · [[sys-monitormap-overview]] · [[api-ops-health-monitormap]] · [[fe-api-proxy-routes]]
