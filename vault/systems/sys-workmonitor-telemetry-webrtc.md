---
title: "ตัวแทนบนเครื่องพนักงาน สัญญาณ WebRTC และจอผู้ดู (WorkMonitor telemetry)"
tags: [systems, workmonitor, webrtc, sse, telemetry, threejs]
aliases: ["WorkstationTelemetryAgent", "EmployeeWorkMonitor3DScreen", "workmonitor_mirror", "screen_meta", "bc-screen DataChannel", "inMemoryHub", "ท่อ WebRTC ดูหน้าจอสด", "liveHtml"]
sources: ["frontend/workmonitor/WorkstationTelemetryAgent.tsx:19-54", "frontend/workmonitor/WorkstationTelemetryAgent.tsx:84-123", "frontend/workmonitor/WorkstationTelemetryAgent.tsx:147-389", "frontend/workmonitor/WorkstationTelemetryAgent.tsx:489-509", "frontend/workmonitor/WorkstationTelemetryAgent.tsx:548-622", "frontend/workmonitor/WorkstationTelemetryAgent.tsx:624-681", "frontend/workmonitor/WorkstationTelemetryAgent.tsx:740-822", "frontend/workmonitor/WorkstationTelemetryAgent.tsx:830-882", "frontend/workmonitor/WorkstationTelemetryAgent.tsx:922-996", "frontend/workmonitor/WorkstationTelemetryAgent.tsx:1119-1203", "frontend/workmonitor/WorkstationTelemetryAgent.tsx:1560-1675", "frontend/workmonitor/inMemoryHub.ts:90-195", "frontend/workmonitor/workmonitorData.ts:151-200", "frontend/workmonitor/EmployeeWorkMonitor3DScreen.tsx:62-96", "frontend/workmonitor/EmployeeWorkMonitor3DScreen.tsx:262-310", "frontend/workmonitor/EmployeeWorkMonitor3DScreen.tsx:448-598", "frontend/workmonitor/EmployeeWorkMonitor3DScreen.tsx:601-778", "frontend/workmonitor/EmployeeWorkMonitor3DScreen.tsx:780-830", "frontend/workmonitor/EmployeeWorkMonitor3DScreen.tsx:1264-1265", "frontend/workmonitor/EmployeeWorkMonitor3DScreen.tsx:1294-1412", "frontend/workmonitor/EmployeeWorkMonitor3DScreen.tsx:1698-1717", "frontend/src/app/api/workmonitor/route.ts:96-166", "frontend/src/app/api/workmonitor/stream/route.ts:18-176"]
---
# ตัวแทนบนเครื่องพนักงาน สัญญาณ WebRTC และจอผู้ดู

บันทึกนี้อธิบายกลไกภายในของ [[sys-workmonitor-overview]] ว่าหน้าจอพนักงานไปถึงผู้ดูอย่างไร ทั้งสองฝั่งคุยกันผ่านเซิร์ฟเวอร์ Next เท่านั้น (SSE + `POST`) เซิร์ฟเวอร์ทำหน้าที่ "ไปรษณีย์" ส่งต่อสัญญาณ WebRTC (offer / answer / ICE) ภายในหน่วยความจำ ส่วนภาพจริงวิ่งตรงจากเครื่องพนักงานไปยังเครื่องผู้ดู

## 1) ตัวแทนบนเครื่องพนักงาน (`WorkstationTelemetryAgent`)
- **ติดตั้ง**: วางไว้ในทุกหน้า workspace ผ่าน `PersistentWorkspaceHost` และไม่ทำงานเมื่อเป็น iframe กระจก (`workmonitor_mirror=1` หรือหน้าต่างอยู่ใน frame อื่น) หรือเมื่ออยู่หน้า `/workmonitor`, `/fraudwarning` ผลลัพธ์ของคอมโพเนนต์เป็น `null` ไม่มี UI
- **รหัสโต๊ะ** `deskId` = `live-<รหัสผู้ใช้ตัวเล็กเฉพาะตัวอักษรและตัวเลข>-<4 ตัวสุ่ม>` เก็บใน `sessionStorage` คีย์ `bc_workmonitor_tab_desk_id_v2` ดังนั้น 1 แท็บเบราว์เซอร์ = 1 โต๊ะ ผู้ใช้เปิดหลายแท็บจะเห็นหลายโต๊ะ
- **ลงทะเบียน**: เปิด SSE `/api/workmonitor/stream?role=agent` พร้อมพารามิเตอร์ `deskId`, `empCode`, `empName`, `machineLabel`, `desktopResolution`, `routePath`, `moduleId`, `menuCode`, `screenTitle` ฝั่งเซิร์ฟเวอร์สร้างโต๊ะทันทีและแจ้งผู้ดูด้วย `desk_update`
- **ชื่อหน้าจอ**: แปลง `routePath` เป็นรหัสเมนู + ชื่อไทยด้วยตาราง 12 เส้นทาง (`/home`, `/pos`, `/dashboard`, `/crm`, `/market`, `/procure`, `/wms`, `/tms`, `/etax`, `/ai`, `/monitormap`, `/lineoa`) และอ่านแท็บที่กำลัง active ใน workspace ของหน้า `/home` (ดู [[fe-tabs-workspace]])
- **ตัวชี้วัด**: ตำแหน่งเมาส์เป็นสัดส่วน 0-1, `kpmRate` = จำนวนการกดแป้นภายใน 60 วินาทีล่าสุด, ช่องที่กำลังพิมพ์ (ชื่อช่อง + ค่า), สถานะ `TYPING` ถ้ามีการกดแป้นไม่เช่นนั้น `ONLINE`, และธง "สลับไปดูเว็บอื่น" เมื่อแท็บถูกซ่อนหรือหน้าต่างเสียโฟกัส (ชื่อหน้าจอถูกขึ้นต้นด้วยข้อความเตือน)
- **ภาพรวม DOM** (`captureCurrentScreenDomSnapshot`): หัวเรื่องไม่เกิน 80 ตัวอักษร, ช่องกรอกไม่เกิน 10 ช่อง (ชื่อช่อง ≤32, ค่า ≤48 ตัวอักษร ไม่รวม `hidden` และ `password`), ตารางแรกที่เจอ (หัวคอลัมน์ ≤5 คอลัมน์, แถวที่มองเห็น ≤6 แถว, ข้อความในเซลล์ ≤24 ตัวอักษร), รายการแท็บที่เปิด, ตำแหน่ง scroll และ `liveHtml`
- **`liveHtml`**: ก๊อปปี้ HTML ของส่วนหัว + โมดูลที่เปิดอยู่ + dialog ที่ลอยบน `body` โดยตัดแท็บที่ซ่อนและแท็ก `script` ออก และคัดลอกค่าที่ผู้ใช้กรอก (input / textarea / select) ลงในแอตทริบิวต์ของสำเนา ยกเว้น `input` ชนิด `password`
- **รหัสผ่าน**: ข้ามชนิด `password` ทุกจุด (ภาพรวมช่องกรอก, สำเนา HTML, ค่าตั้งต้นตอนโฟกัส) และฟังก์ชันอ่านค่าช่องคืน `[REDACTED]` ให้ชนิดนี้
- **จังหวะส่ง**: ตัวจับเวลา 2 วินาทีเรียก `telemetry_ping` เมื่อมีคนดู; `MutationObserver` ตัวหน่วง 160 มิลลิวินาทีส่งทันทีเมื่อ DOM เปลี่ยน; และส่งซ้ำเมื่อสลับแท็บ, เลื่อนหน้าจอ, คลิก, พิมพ์ ข้อมูลหน้าจอ `domSnapshot` ถูกแนบเฉพาะตอนมีคนดู (หรือถูกบังคับ)
- **ปิดแท็บ**: `pagehide` / `beforeunload` ส่ง `disconnect` ด้วย `keepalive`
- **บันทึกพฤติกรรมไป FraudWarning**: ตัวแทนตัวเดียวกันส่ง `POST /api/fraudwarning` (`record_activity`) ทุกครั้งที่เปิดจอ แก้ช่อง บันทึก ยกเลิก ลบ หรือทิ้งจอที่แก้ค้าง ไม่ขึ้นกับว่ามีผู้ดู `WorkMonitor` หรือไม่ (ค่าเก่า/ค่าใหม่ของช่องที่แก้เก็บยาวไม่เกิน 64 ตัวอักษร และข้ามช่องที่ชื่อเป็นการค้นหา/กรอง) รายละเอียดที่ [[sys-fraudwarning-overview]]

## 2) สัญญาณและท่อ WebRTC
- **STUN**: ตั้งไว้ 2 ตัวในค่าคงที่ `RTC_ICE_SERVERS` ทั้งฝั่งตัวแทนและผู้ดู ไม่มีการตั้ง TURN จึงไม่มีตัวส่งต่อเมื่อเครือข่ายสองฝั่งต่อกันตรงไม่ได้
- **ลำดับ**: ผู้ดูส่ง `viewer-request` → ตัวแทนสร้าง `RTCPeerConnection` ต่อ `viewerId` ทำ offer → ผู้ดูตอบ answer → ทั้งคู่แลก ICE ผู้ดูหลายคนได้พร้อมกัน (ตัวแทนถือหนึ่ง connection ต่อผู้ดู)
- **เซิร์ฟเวอร์ส่งต่อสัญญาณ**: `POST /api/workmonitor` action `webrtc_signal` → `relayWebRtcSignal` ผู้ดูส่งหาตัวแทนตาม `deskId`, ตัวแทนส่งหาผู้ดูตาม `viewerId` ส่งถึงจะตอบ `delivered: true` เซิร์ฟเวอร์นับจำนวนสัญญาณไว้ใน `totalSignalsRelayed`
- **สิ่งที่ส่งในท่อ**: (ก) วิดีโอจาก canvas ขนาด 1280×720 ที่ `captureStream(6)` (6 เฟรมต่อวินาที) ซึ่ง `renderLiveEmployeeScreenCanvas` วาดขึ้นใหม่จากข้อมูลสถานะ (หน้าต่างจำลอง แถบที่อยู่ ตาราง/ช่องกรอก เมาส์ แถบงาน) และ (ข) DataChannel ชื่อ `bc-screen` (`ordered: false`, `maxRetransmits: 0`) ส่ง `screen_meta` = ข้อมูลโต๊ะ + ภาพรวม DOM ทุก 350 มิลลิวินาที โดยตัด `liveHtml` ถ้ายาวเกิน 180000 ตัวอักษร
- **ไม่ใช่การแชร์หน้าจอของเบราว์เซอร์**: ไฟล์ใน `frontend/workmonitor/` ไม่เรียก `getDisplayMedia` ภาพที่ผู้ดูเห็นคือภาพที่วาดซ้ำจากสถานะกับสำเนา HTML จึงไม่เห็นหน้าต่างอื่นนอกแอป ธง `entireScreenShared` ฝั่งผู้ดูมีให้อ่านแต่ตัวแทนไม่ได้ตั้งค่านี้
- **ปิดท่อ**: เมื่อสถานะ "ไม่มีผู้ดู" หรือได้รับ `viewer-leave` ตัวแทนปิด peer; ถ้า peer สุดท้ายปิด จะหยุดตัวจับเวลา 350 มิลลิวินาทีและปิดแทร็กวิดีโอ เซิร์ฟเวอร์ส่ง `viewer-leave` ให้ตัวแทนทุกตัวเมื่อผู้ดูปิดสวิตช์หรือหลุดจาก SSE

## 3) จอผู้ดู (`EmployeeWorkMonitor3DScreen`)
- `viewerId` สร้างสุ่มใหม่ทุกครั้งที่เปิดจอ (`viewer-<6 ตัว>`) และสวิตช์ดูสด `monitorPowerOn` เริ่มเป็น "เปิด" เมื่อเข้าหน้า `/workmonitor` จึงเริ่มดูทันที ปุ่ม "เปิดดูหน้าจอสดอยู่ (กดเพื่อปิด)" ส่ง `set_monitor_power`
- **SSE ฝั่งผู้ดู** รับ `init_snapshot`, `watch_state`, `desk_update`, `desk_removed`, `layout_update`, `snapshot_refresh`, `webrtc_signal` เมื่อพบโต๊ะใหม่ผู้ดูส่ง `viewer-request` ให้ทันที
- **ฉาก 3 มิติ**: Three.js วางโต๊ะตามตำแหน่ง `posX/posZ/rotationY` ภาพวิดีโอที่รับมาแปะเป็นพื้นผิวบนจอคอมพิวเตอร์ของโต๊ะนั้น (`THREE.VideoTexture`) ป้ายบนโต๊ะแสดงชื่อและหน้าจอที่เปิด กล้องหมุน/ซูมด้วยเมาส์ ลากโต๊ะเพื่อย้าย โดยเซิร์ฟเวอร์จำกัดตำแหน่ง X อยู่ใน ±24 และ Z ใน ±18 (`move_desk`) พื้นโซนในฉากมี 3 โซน (ออนไลน์สด, ฝ่ายบริหารและบัญชี, ฝ่ายขายหน้าร้านและออนไลน์)
- **จัดผัง**: ปุ่ม "จัดผังแยกโซน" (`DEPARTMENT_ZONES`) วางตามช่องมาตรฐาน 10 ช่องแรกแล้วเป็นตาราง 4 คอลัมน์, ปุ่ม "จัดผังวงกลม" (`COMMAND_RING`) วางเป็นวงรี และปุ่ม "มุมมองทั้งห้อง 3D" รีเซ็ตกล้อง ชนิดผัง `CLASSROOM_GRID` มีในชนิดข้อมูลแต่ไม่มีปุ่มและไม่มีสูตรของตัวเอง (ได้ผลเหมือนผังมาตรฐาน)
- **กรอบดูหน้าจอ (Inspector)**: เลือกโต๊ะแล้วแสดงชื่อพนักงาน ชื่อหน้าจอ และสำเนาหน้าจอใน `iframe` แบบดูอย่างเดียว (ปิดการคลิก `pointer-events-none`) ถ้ามี `liveHtml` ที่มีตัวระบุโมดูล `data-persistent-module` จะเขียนลง `iframe` พร้อมคัดลอกสไตล์ของหน้าหลัก แล้วจัดตำแหน่ง scroll ให้ตรงกับเครื่องพนักงาน ถ้าไม่มีจะเปิดเส้นทางหน้าเดียวกันใน `iframe` ด้วย `?workmonitor_mirror=1` (ตัวแทนในหน้านั้นหยุดทำงาน) มีเคอร์เซอร์เมาส์จำลองวาดทับตามสัดส่วน ซูม 100%-400% ลากเลื่อน เต็มจอ และปุ่มดูความสูงเต็ม/เลื่อนไปบนสุด/ล่างสุด
- **โหมดสลับจอ**: "ผู้ควบคุมกดดูเอง (ล็อกจอ)" (`MANUAL` ค่าเริ่มต้น) คงโต๊ะที่เลือก ส่วน "เปลี่ยนจออัตโนมัติตามการใช้งาน" (`AUTO`) จะเลือกโต๊ะที่เพิ่งสลับแท็บ/เลื่อนจอ/กำลังพิมพ์ให้เอง แต่ไม่ถี่กว่า 4 วินาทีและไม่ทับการเลือกด้วยมือภายใน 4 วินาที
- **แถบล่าง** (`workmonitor-bottom-dock`) แสดงรายการจอที่ออนไลน์ เลือกเพื่อดู และปุ่มขยับโต๊ะที่เลือก ตัวอย่าง `data-testid`: `toggle-webrtc-monitor-btn`, `switch-mode-manual-btn`, `switch-mode-auto-btn`, `preset-layout-zones-btn`, `preset-layout-ring-btn`, `inspector-live-screen-iframe`, `webrtc-zoom-viewport`, `desk-card-<deskId>`

## ข้อควรระวัง
- รหัสผ่านถูกกันไว้ แต่ข้อความอื่นในจอ (ค่าในช่อง ตัวเลขยอดเงิน เซลล์ตาราง) ถูกคัดลอกไปทั้งในภาพรวมและใน `liveHtml` ผู้ดูจึงเห็นข้อมูลธุรกิจจริงของแท็บนั้น ควรกำหนดผู้มีสิทธิ์เปิดจอนี้ ดู [[std-security-authz-and-web-vulns]]
- ความถี่ 6 เฟรมต่อวินาที และ 350 มิลลิวินาทีเป็นค่าที่เขียนไว้ในโค้ด ไม่ได้ปรับตามคุณภาพเครือข่าย
- สถานะอยู่ในหน่วยความจำของ process เดียว ผู้ดูและพนักงานต้องต่อเข้า process เดียวกัน ดู [[sys-workmonitor-overview]]

## ที่มาในโค้ด
- ตัวแทน `frontend/workmonitor/WorkstationTelemetryAgent.tsx`: `:19-54` STUN, ตารางเส้นทาง, รหัสโต๊ะ; `:84-123` คัดลอกค่าฟอร์ม (ข้าม password); `:147-389` ภาพรวม DOM และ `liveHtml`; `:489-509` เงื่อนไข iframe กระจก; `:548-622` ตัวชี้วัด; `:624-681` วาดเฟรม, `captureStream(6)`, DataChannel; `:740-822` ทำ offer; `:830-882` `telemetry_ping`; `:922-996` ส่ง `record_activity`; `:1119-1203` SSE และ `[REDACTED]`; `:1560-1675` observer, ตัวจับเวลา 2 วินาที, `return null`
- เซิร์ฟเวอร์: `frontend/workmonitor/inMemoryHub.ts:90-195` สถานะดู ส่งต่อสัญญาณ สวิตช์ดู; `frontend/src/app/api/workmonitor/route.ts:96-166` สัญญาณ ย้ายโต๊ะ จัดผัง ตัดการเชื่อมต่อ; `frontend/src/app/api/workmonitor/stream/route.ts:18-176` SSE สองบทบาท
- ผู้ดู `frontend/workmonitor/EmployeeWorkMonitor3DScreen.tsx`: `:62-96` รหัสผู้ดูและโหมด; `:262-310` เขียนสำเนา HTML ลง iframe; `:448-598` รับ offer ตอบ answer; `:601-778` SSE; `:780-830` สวิตช์และจัดผัง; `:1264-1265` ขีดจำกัดซูม; `:1294-1412` แถบควบคุม; `:1698-1717` iframe สองแบบ
- ผัง `frontend/workmonitor/workmonitorData.ts:151-200` ช่องวางโต๊ะและผังวงกลม
- ดูเพิ่ม: [[sys-workmonitor-overview]] · [[sys-fraudwarning-overview]] · [[api-ops-health-monitormap]]
