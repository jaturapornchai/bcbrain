---
title: "3D Warning ตรวจจับความผิดปกติและทุจริต ภาพรวม (SYS-15 FraudWarning)"
tags: [systems, fraudwarning, audit, mongodb, 3d, command-center]
aliases: ["FraudWarning", "3D Warning", "SYS-15", "/fraudwarning", "3D Fraud Guard", "EmployeeFraudWarning3DScreen", "ระบบตรวจสอบการทุจริตพนักงาน 7 แผนก", "mongoAuditStore"]
sources: ["frontend/shared/layout/SystemPortalScreen.tsx:338-354", "frontend/shared/layout/Header.tsx:78-80", "frontend/shared/layout/Header.tsx:131-132", "frontend/shared/layout/PersistentWorkspaceHost.tsx:99-100", "frontend/shared/layout/PersistentWorkspaceHost.tsx:171-172", "frontend/shared/layout/PersistentWorkspaceHost.tsx:567-568", "frontend/src/app/fraudwarning/page.tsx:6-18", "frontend/src/proxy.ts:10-25", "frontend/src/app/api/fraudwarning/route.ts:20-48", "frontend/src/app/api/fraudwarning/route.ts:62-133", "frontend/src/app/api/fraudwarning/route.ts:136-190", "frontend/workmonitor/WorkstationTelemetryAgent.tsx:889-890", "frontend/workmonitor/WorkstationTelemetryAgent.tsx:922-996", "frontend/workmonitor/WorkstationTelemetryAgent.tsx:1069-1104", "frontend/workmonitor/WorkstationTelemetryAgent.tsx:1188-1195", "frontend/workmonitor/WorkstationTelemetryAgent.tsx:998-1063", "frontend/workmonitor/WorkstationTelemetryAgent.tsx:1220-1255", "frontend/workmonitor/WorkstationTelemetryAgent.tsx:1382-1526", "frontend/workmonitor/mongoAuditStore.ts:21-40", "frontend/workmonitor/mongoAuditStore.ts:195-207", "frontend/workmonitor/mongoAuditStore.ts:215-242", "frontend/workmonitor/mongoAuditStore.ts:298-343", "frontend/workmonitor/mongoAuditStore.ts:1152-1198", "frontend/workmonitor/mongoAuditStore.ts:1242-1255", "frontend/workmonitor/mongoAuditStore.ts:1310-1418", "frontend/workmonitor/mongoAuditStore.ts:2058-2150", "frontend/workmonitor/mongoAuditStore.ts:2152-2367", "frontend/workmonitor/fraudWarningData.ts:3-32", "frontend/workmonitor/fraudWarningData.ts:75-125", "frontend/workmonitor/fraudWarningData.ts:172-193", "frontend/workmonitor/fraudWarningData.ts:322-409", "frontend/workmonitor/EmployeeFraudWarning3DScreen.tsx:108-110", "frontend/workmonitor/EmployeeFraudWarning3DScreen.tsx:155-183", "frontend/workmonitor/EmployeeFraudWarning3DScreen.tsx:205-299", "frontend/workmonitor/EmployeeFraudWarning3DScreen.tsx:314-370", "frontend/workmonitor/EmployeeFraudWarning3DScreen.tsx:458-503", "frontend/workmonitor/EmployeeFraudWarning3DScreen.tsx:574-624", "frontend/workmonitor/EmployeeFraudWarning3DScreen.tsx:693-760", "frontend/workmonitor/EmployeeFraudWarning3DScreen.tsx:798-868", "frontend/workmonitor/EmployeeFraudWarning3DScreen.tsx:993-1014", "frontend/workmonitor/EmployeeFraudWarning3DScreen.tsx:1021-1080", "frontend/workmonitor/EmployeeFraudWarning3DScreen.tsx:1085-1250", "frontend/workmonitor/EmployeeFraudWarning3DScreen.tsx:1314-1330", "frontend/workmonitor/EmployeeFraudWarning3DScreen.tsx:1385-1400", "frontend/workmonitor/EmployeeFraudWarning3DScreen.tsx:1463-1541"]
---
# 3D Warning ตรวจจับความผิดปกติและทุจริต (SYS-15)

`FraudWarning` คือห้องเฝ้าระวัง 3 มิติของ BC Ai Account ที่เก็บ "ร่องรอยการใช้หน้าจอ" ของพนักงานที่ล็อกอิน (เปิดจอ เลือกแถว แก้ช่อง กดบันทึก ยกเลิก ลบ หรือแก้แล้วปิดทิ้งโดยไม่บันทึก) ลงฐาน MongoDB ให้คะแนนความเสี่ยงด้วยกฎคำสำคัญ และเลือกส่งข้อความย่อไปให้ DeepSeek ช่วยวิเคราะห์ ผลแสดงเป็นห้อง 3 มิติ 7 โซนแผนก พร้อมแผงรายการแจ้งเตือน กฎคะแนนและการประหยัด Token แยกอยู่ที่ [[sys-fraudwarning-risk-rules-deepseek]]

## ใครใช้ / เปิดอย่างไร
- ผู้ใช้หลัก: เจ้าของกิจการหรือผู้ตรวจสอบภายในที่อยากดูว่าใครแก้ข้อมูลสำคัญแล้วไม่บันทึก ลบเอกสาร หรือแก้ราคา/สต็อก/สิทธิ์ผิดปกติ
- เปิดจากหน้ารวมระบบ (Portal) การ์ด `SYS-15` "3D Warning (ตรวจจับความผิดปกติ & ทุจริต)" ป้าย "3D Fraud Guard" อยู่กลุ่ม `command3d` เดียวกับ [[sys-monitormap-overview]] และ [[sys-workmonitor-overview]] ลิงก์ไป `/fraudwarning` หรือจากปุ่ม "ระบบ 3D Warning" บนแถบหัวระบบ
- `/fraudwarning` เป็น Server Page: ไม่มี session เด้งไป `/login`, ยังไม่เลือกฐานข้อมูลเด้งไป `/select-database` ถ้าผ่านจะวาง `WorkspaceRouteSync` แล้ว `PersistentWorkspaceHost` โหลดจอ `EmployeeFraudWarning3DScreen` แบบโหลดตามต้องการ (ค้างสถานะเมื่อสลับระบบ ดู [[fe-tabs-workspace]])
- เมื่อเข้าทางโดเมนเดโม ด่าน `proxy` อนุญาตเฉพาะรายการเส้นทางที่กำหนด ซึ่งมี `/fraudwarning` อยู่ด้วย

## ภาพรวมการทำงาน
1. **เก็บเหตุการณ์ที่เบราว์เซอร์ของพนักงาน** ตัวแทน `WorkstationTelemetryAgent` (ตัวเดียวกับของ WorkMonitor ดู [[sys-workmonitor-telemetry-webrtc]]) ดักการคลิกแถวตาราง ปุ่มที่ข้อความตรงกับ "บันทึก/ยกเลิก/แก้ไข/ลบ" คีย์ลัด Ctrl+S และ Esc การแก้ช่อง การสลับหน้าต่างออกนอกระบบ และการสลับ/ปิดหน้าจอ แล้วส่ง `POST /api/fraudwarning` ด้วย `action: "record_activity"` ทุกครั้ง ไม่ขึ้นกับว่ามีคนเปิดดู WorkMonitor อยู่หรือไม่ ตัวแทนไม่ส่งเหตุการณ์จากหน้า `/workmonitor`, `/fraudwarning` และ iframe กระจก
2. **เซิร์ฟเวอร์บันทึก** route เติม `clientIp` (จาก `x-forwarded-for` หรือ `x-real-ip`) แล้วเรียก `insertActivityLogsToMongo`: ตัดความยาวชื่อช่อง/ค่าเดิม/ค่าใหม่ จัดแผนกด้วย `resolveFraudDepartment` ให้คะแนนด้วย `evaluateActivityRisk` แล้วเขียนคอลเลกชัน `employee_activity_logs`
3. **แจ้งเตือนทันทีแบบไม่เสียโทเคน** ถ้าคะแนน 45 ขึ้นไป (และเข้าเงื่อนไข `needsDeepSeekScan`) สร้างแจ้งเตือนลงคอลเลกชัน `fraud_warning_logs` ทันที ระบุ `detectedBy` เป็น `HYBRID_RULE_DEEPSEEK`, `modelUsed` เป็น `hybrid-rule-0token`, `tokensUsed` เป็น 0 พร้อมลำดับหลักฐาน 4 ขั้น (เปิดจอ, เลือกรายการ, แก้ไข, บันทึกหรือปิดหนี)
4. **ให้ DeepSeek ตรวจต่ออัตโนมัติ** เมื่อตัวแทนตั้ง `autoRunDeepSeek` (ตอนทิ้งจอที่แก้ค้าง, ปิดหลังเปิดดูหลายรายการ, ลบ, และบันทึก/ยกเลิกที่มีช่องถูกแก้) และมีเหตุเสี่ยงสูง route จะเรียก `runDeepSeekFraudInspection` แบบ `HIGH_RISK_TRIGGER` สูงสุด 5 บันทึก รายละเอียดที่ [[sys-fraudwarning-risk-rules-deepseek]]
5. **จอ 3 มิติดึงภาพรวม** `GET /api/fraudwarning` ทุก 4.5 วินาที ได้ `mongoStatus`, `kpi`, `zones`, `departmentBreakdown`, `desks`, `warnings`, `activityLogs`, `deepseekBatches` ในก้อนเดียว
6. **ผู้ตรวจสอบสั่งการบนจอ**: ปุ่ม "ให้ DeepSeek ตรวจทันที" (`run_deepseek_scan`, สูงสุด 8 บันทึก, กรองตามแผนกที่เลือก), ปุ่มเปลี่ยนสถานะแจ้งเตือน "กำลังตรวจสอบ" (`INVESTIGATING`) และ "ตรวจสอบแล้ว/แก้ไขแล้ว" (`RESOLVED`) (`update_warning_status`), และแถบ "ทดสอบจำลองทุจริต" 7 ปุ่มต่อแผนก (`simulate_fraud_scenario`)

เหตุการณ์ที่ตัวแทนแปลงเป็นประเภทการกระทำ (`BehaviorActionType`):

| เหตุการณ์ในเบราว์เซอร์ | ประเภทที่บันทึก | ผลลัพธ์ (`savedOutcome`) |
|---|---|---|
| เปิดหน้าจอใหม่ | `OPEN_SCREEN` | `IN_PROGRESS` |
| คลิกแถวในตาราง (ไม่ใช่ปุ่ม) | `SELECT_RECORD` | `IN_PROGRESS` |
| กดปุ่มที่ข้อความเป็น "แก้ไข…", "เพิ่มใหม่" หรือ "เพิ่มรายการ" | `START_EDIT` | `IN_PROGRESS` |
| แก้ค่าช่องกรอก (ข้ามช่องที่ชื่อเป็นค้นหา/กรอง) | `MODIFY_FIELD` | `IN_PROGRESS` |
| กดปุ่ม "บันทึก/Save/ชำระเงิน/ยืนยันสั่งซื้อ" หรือ Ctrl+S | `SAVE_DOCUMENT` | `SAVED` |
| กด "ยกเลิก/คืนค่า" หรือ Esc หลังแก้ | `CANCEL_EDIT` | `CANCELLED_AFTER_EDIT` |
| กดปุ่มลบ/ลบรายการ/void | `DELETE_RECORD` | `DELETED` |
| สลับ/ปิดหน้าจอทั้งที่แก้ค้างและยังไม่บันทึก | `ABANDON_WITHOUT_SAVE` | `ABANDONED_UNSAVED` |
| สลับ/ปิดจอหลังเลือกดูตั้งแต่ 3 รายการโดยไม่บันทึก | `CLOSE_AFTER_PEEKING` | `PEEKED_NO_SAVE` |
| เบราว์เซอร์ถูกซ่อนขณะมีช่องที่แก้ค้าง | `TAB_OUTSIDE_SYSTEM` | `IN_PROGRESS` |

ตัวแทนตัดค่าช่องที่แก้ไว้ไม่เกิน 64 ตัวอักษร (เซิร์ฟเวอร์ตัดซ้ำที่ 64 สำหรับชื่อช่อง และ 80 สำหรับค่าเดิม/ค่าใหม่) ช่องรหัสผ่านถูกแทนค่าด้วย `[REDACTED]` ก่อนส่ง (ยังบันทึกว่ามีการแก้ช่องนั้น แต่ไม่เก็บรหัส) และการเปลี่ยนหน้าจอถูกบันทึกเป็น `OPEN_SCREEN` ให้ทุกหน้าที่ไม่ใช่ `/workmonitor` หรือ `/fraudwarning`

## ข้อมูลที่เก็บ (MongoDB ไม่ใช่ตารางบัญชี)
ระบบนี้ไม่ใช้ PostgreSQL และไม่ผ่านชั้น Go จึงไม่มีตารางบัญชีเกี่ยวข้อง (ข้อมูลเดียวที่ปนกับระบบอื่นคือเซสชันสดในหน่วยความจำของ WorkMonitor ที่นำมาแสดงเป็นโต๊ะทำงาน)

| คอลเลกชัน | เก็บอะไร | เอกสาร |
|---|---|---|
| `employee_activity_logs` | หนึ่งแถวต่อหนึ่งการกระทำ: พนักงาน แผนก หน้าจอ เส้นทาง ประเภทการกระทำ รหัสเอกสาร ช่องที่แก้ (ก่อน/หลัง) ผลลัพธ์ คะแนนความเสี่ยงเบื้องต้น เหตุผลที่ติดธง | `EmployeeActivityLogDoc` |
| `fraud_warning_logs` | แจ้งเตือน: ระดับความรุนแรง คะแนน 5-99 หมวดทุจริต หัวข้อไทย ลำดับหลักฐาน เหตุผลจาก AI คำแนะนำ ผู้ตรวจพบ สถานะ `OPEN`/`INVESTIGATING`/`RESOLVED`/`FALSE_POSITIVE` | `FraudWarningDoc` |
| `deepseek_audit_batches` | หนึ่งแถวต่อรอบตรวจ: จำนวนที่สแกน/คัดทิ้ง/ส่งจริง ข้อความย่อที่ส่ง รุ่นโมเดล โทเคน เปอร์เซ็นต์ประหยัด เวลาตอบ | `DeepSeekAuditBatchDoc` |

- ชื่อฐานข้อมูลมาจาก env `MONGODB_AUDIT_DB` (ค่าเริ่มต้น `bc_audit_log`); ฐาน `bcdemo` ใช้ชื่อนี้ตรง ๆ ฐานอื่นต่อท้ายด้วยชื่อฐานของ session (เช่น `bc_audit_log_<ชื่อฐาน>`) จึงแยกข้อมูลตามบริษัท โดยค่า "ฐานปัจจุบัน" ส่งผ่าน `AsyncLocalStorage` (`withAuditDatabase`) ตั้งแต่ต้นคำขอ
- การเชื่อมต่อ: โค้ดมีไคลเอนต์ BSON/OP_MSG เขียนเองบน TCP ตรง ดึงโฮสต์และพอร์ตจาก env `MONGODB_URI` (ส่วนชื่อผู้ใช้/รหัสผ่านในสตริงถูกข้าม ไม่ถูกใช้) แล้วลองโฮสต์ loopback พอร์ต 27017 และ 27018 ต่อ หมดเวลา 2.5 วินาทีต่อครั้ง ไม่มีขั้นตอนยืนยันตัวตนและไม่เข้ารหัสการเชื่อมต่อ จึงเหมาะกับ MongoDB ภายในเครื่อง/เครือข่ายปิดที่ไม่บังคับล็อกอิน
- สำเนาในหน่วยความจำ (`__bcFraudMongoMirrorMap`) แยกต่อฐาน เก็บล่าสุดไม่เกิน 300 บันทึกกิจกรรม 150 แจ้งเตือน และ 50 รอบตรวจ ใช้เป็นข้อมูลสำรองเมื่อ MongoDB ไม่ตอบหรือคืนผลว่าง และหายเมื่อรีสตาร์ทเซิร์ฟเวอร์ หน้าจอจึงยังแสดงผลได้แม้ไม่มี MongoDB แต่ป้าย `mongo-connection-badge` จะแสดงชื่อฐานเสมอ ไม่ได้บอกว่าเชื่อมต่อสำเร็จจริง (ค่า `connected` อยู่ใน `mongoStatus` แต่จอไม่ได้นำมาแสดงเป็นสถานะ)
- ข้อมูลตัวอย่างหว่านเฉพาะฐาน `bcdemo` และเขียนลง MongoDB เฉพาะเมื่อคอลเลกชันแจ้งเตือนยังว่าง ฐานอื่นเริ่มว่าง
- การอ่านสำหรับภาพรวม: กิจกรรมล่าสุด 120 แถว แจ้งเตือน 80 แถว รอบตรวจ 20 แถว เรียงตามเวลาล่าสุดก่อน

## หน้าจอ
- **แถบบน**: ป้ายสถานะ `mongo-connection-badge` (ชื่อฐานและจำนวนบันทึก), `unsaved-abandon-counter` (จำนวนครั้งที่แก้แล้วปิดหนี/ไม่บันทึก), `deepseek-token-saving-badge`, ปุ่ม `btn-run-deepseek-scan`, ปุ่ม "มุมสูงเห็นครบ 7 แผนก" และลิงก์ไป "3D จอพนักงานสด" (`/workmonitor`)
- **แถบกรอง**: ปุ่มซูมโซนต่อแผนก (`zone-filter-btn-<รหัสแผนก>`) พร้อมจำนวนแจ้งเตือนค้าง และตัวกรองผลลัพธ์ "ทั้งหมด / แก้ไขแล้วไม่ Save-ปิดหนี (`filter-unsaved-only`) / กด Save แล้ว / สั่งลบรายการ"
- **ห้อง 3 มิติ** (Three.js, ทำงานเมื่อมี WebGL): พื้นห้อง 42×28 หน่วย แผ่นพื้นสีของแต่ละโซนแผนก โต๊ะพนักงานพร้อมจอที่วาดจากข้อมูลโต๊ะ (`renderFraudDeskScreenCanvas`) และเสาไซเรนสีตามระดับความรุนแรงเหนือโต๊ะ ป้ายลอยเหนือโต๊ะคำนวณพิกัดใหม่ทุก 90 มิลลิวินาทีและเลี่ยงการซ้อนทับ ถ้า WebGL ใช้ไม่ได้ ฉาก 3 มิติจะไม่ถูกสร้าง ส่วนแผงขวายังทำงาน
- **แผงขวา 4 แท็บ**: Warning (`tab-btn-warnings`) การ์ดรายละเอียดแจ้งเตือน (ระดับ/คะแนน พนักงาน เอกสาร หน้าจอ พฤติกรรมตอนจบ ลำดับหลักฐาน ตารางค่าเดิม→ค่าใหม่ ผลวิเคราะห์ AI และคำแนะนำ) กับรายการทั้งหมด; MongoDB Log (`tab-btn-logs`) แถวบันทึกกิจกรรม `mongo-activity-log-row-<ประเภท>`; "ครบ 7 แผนก" (`tab-btn-departments`) กฎและธงแดงของแต่ละแผนกเป็นข้อความอธิบาย; "ประหยัด Token" (`tab-btn-token-saver`) รอบตรวจ DeepSeek ล่าสุดและข้อความย่อที่ส่งจริง
- **โต๊ะ**: หนึ่งโต๊ะต่อพนักงาน (รหัสพนักงานหรือรหัสโต๊ะ) สร้างจากบันทึกกิจกรรม แล้วรวมกับเซสชันสดใน RAM ของ [[sys-workmonitor-overview]] วางเป็น 2 คอลัมน์ในโซนของแผนก ระดับความรุนแรงของโต๊ะมาจากคะแนนสูงสุดระหว่างแจ้งเตือนของพนักงานที่ยังไม่ `RESOLVED`/`FALSE_POSITIVE` กับคะแนนเบื้องต้นสูงสุดของบันทึกกิจกรรมของเขาในชุดที่อ่านมา (80 ขึ้นไป `CRITICAL`, 60 `HIGH`, 40 `MEDIUM`, 20 `LOW`)

## ความสัมพันธ์กับระบบอื่น
- [[sys-workmonitor-overview]]: ใช้ตัวแทนบนเบราว์เซอร์ตัวเดียวกันและฮับเซสชันใน RAM ตัวเดียวกัน ต่างกันที่ WorkMonitor ดูหน้าจอสด ส่วน FraudWarning เก็บประวัติและให้คะแนน
- [[api-ops-health-monitormap]] อธิบาย route กลุ่ม Next-only (`/api/monitormap`, `/api/workmonitor`, `/api/fraudwarning`) ที่ไม่ผ่านชั้น Go ไม่เขียนซ้ำที่นี่
- [[sys-monitormap-overview]] อยู่กลุ่มเดียวกันบนหน้ารวมระบบ แต่ไม่ได้แชร์ข้อมูลกับระบบนี้ (MonitorMap อ่านตาราง `monitormap_*` ส่วนระบบนี้อ่านคอลเลกชัน MongoDB)

## ข้อควรระวังและข้อจำกัด
1. **การบันทึก "Save" เป็นการเดาจากปุ่ม**: ตัวแทนตั้งสถานะว่าบันทึกแล้วทันทีที่คลิกปุ่มที่ข้อความตรงกับ "บันทึก/Save" โดยไม่รู้ว่าเซิร์ฟเวอร์บันทึกสำเร็จหรือไม่ และปุ่มที่ติดป้ายต่างจากข้อความที่ดักไว้จะไม่ถูกนับ
2. **การจัดแผนกเป็นการจับคำ** (`resolveFraudDepartment`): ตรวจแบบ "มีคำนี้อยู่ในข้อความ" ตามลำดับ POS, จัดซื้อ/เจ้าหนี้, คลัง/สต็อก/สินค้า, ขนส่ง/รถ, ขายส่ง/ลูกหนี้, บุคคล/ผู้ใช้/สิทธิ์ แล้วที่เหลือทั้งหมดตกเป็นแผนกการเงิน/บัญชี คำสั้น ๆ เช่น `po` ตรงกับข้อความอื่นได้ง่าย จึงเป็นการประมาณไม่ใช่ผังองค์กรจริง
3. **ข้อความกฎต่อแผนกบนแท็บ "ครบ 7 แผนก" เป็นคำอธิบาย** (เช่น ส่วนลดเกินร้อยละที่กำหนด หรือจำนวนครั้งยกเลิกบิลต่อกะ) ตัวให้คะแนนจริงดูที่ช่อง/การกระทำตามตารางใน [[sys-fraudwarning-risk-rules-deepseek]] ซึ่งไม่มีตัวนับต่อกะหรือเปอร์เซ็นต์ส่วนลด
4. **ปุ่มสถานะแจ้งเตือน**: จอมีปุ่มเพียง `INVESTIGATING` และ `RESOLVED` (ไม่มีปุ่ม `FALSE_POSITIVE`) และโต๊ะทุกตัวถูกตั้งเป็นออนไลน์เสมอ (`isOnline` เป็นจริงทุกกรณี) ป้ายออนไลน์จึงไม่สะท้อนสถานะจริง
5. **ตัวเลขตั้งต้นในโค้ด**: เมื่อยังไม่มีรอบตรวจ เซิร์ฟเวอร์ส่งค่าประหยัด Token 94.2% และจอแสดง 94.3% กับ 483 โทเคนก่อนโหลดครั้งแรก เป็นค่าคงที่ ไม่ใช่ผลวัด
6. **ข้อมูลส่วนบุคคลถูกเก็บและอาจถูกส่งออก**: บันทึกมีรหัส/ชื่อพนักงาน IP เครื่อง และค่าก่อน/หลังของช่องที่แก้ (ตัดความยาวเท่านั้น ไม่ปิดบังบางส่วน) เมื่อกำหนด env `DEEPSEEK_API_KEY` ข้อความย่อซึ่งมีรหัส/ชื่อพนักงานและค่าที่แก้จะถูกส่งไปยังบริการ DeepSeek ภายนอก ผู้ดูแลระบบควรแจ้งพนักงานและกำหนดสิทธิ์เข้าดูให้เหมาะสม
7. **การจำลองเขียนลงข้อมูลจริง**: ปุ่ม "ทดสอบจำลองทุจริต" เพิ่มบันทึกและแจ้งเตือนสมมติลงคอลเลกชันของฐานที่ล็อกอินอยู่ โดยมีเพียง `traceId` ที่ขึ้นต้นด้วย `trace-sim-` เป็นเครื่องหมาย และไม่มีปุ่มลบ

## ที่มาในโค้ด
- `frontend/shared/layout/SystemPortalScreen.tsx:338-354` การ์ด SYS-15; `frontend/shared/layout/Header.tsx:78-80,131-132` ปุ่มหัวระบบ; `frontend/shared/layout/PersistentWorkspaceHost.tsx:99-100,171-172,567-568` โหลดจอและจับคู่เส้นทาง
- `frontend/src/app/fraudwarning/page.tsx:6-18` หน้าเซิร์ฟเวอร์; `frontend/src/proxy.ts:10-25` รายการเส้นทางโดเมนเดโม; `frontend/src/app/api/fraudwarning/route.ts:20-48` GET, `:62-133` `record_activity` และ `autoRunDeepSeek`, `:136-190` สแกน/จำลอง/อัปเดตสถานะ
- `frontend/workmonitor/WorkstationTelemetryAgent.tsx:922-996` ส่งบันทึก, `:998-1063` ปิด/สลับหน้าจอ, `:1220-1255` แก้ช่อง, `:1382-1526` คลิก/คีย์ลัด
- `frontend/workmonitor/mongoAuditStore.ts:21-40` ชื่อฐาน, `:195-207` โฮสต์ที่ลอง, `:298-343` สำเนา RAM และคำสั่ง Mongo, `:1152-1198` หว่านข้อมูลเดโม, `:1310-1418` สร้างแจ้งเตือนทันทีและเขียน, `:2152-2367` ภาพรวม 3 มิติ
- `frontend/workmonitor/fraudWarningData.ts:3-125` ชนิดข้อมูลและคอลเลกชัน, `:172-193` โซนแผนก, `:322-409` จัดแผนก; `frontend/workmonitor/EmployeeFraudWarning3DScreen.tsx:155-183` ดึงทุก 4.5 วินาที, `:693-760` ป้ายและปุ่มบน, `:1021-1080` 4 แท็บ
- ดูเพิ่ม: [[sys-fraudwarning-risk-rules-deepseek]] · [[sys-workmonitor-overview]] · [[sys-workmonitor-telemetry-webrtc]] · [[sys-monitormap-overview]] · [[api-ops-health-monitormap]] · [[fe-tabs-workspace]] · [[std-security-authz-and-web-vulns]]
