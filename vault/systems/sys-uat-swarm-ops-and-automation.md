---
title: "การทำงานอัตโนมัติของ UAT Tester: คิว ticket ตรวจซ้ำ รอบกลางคืน MCP (UAT Swarm Operations)"
tags: [systems, uat, issuemate, mcp, nightly]
aliases: ["autoIssueMate", "autoRetest", "รอบ regression กลางคืน", "nightly", "สรุปส่งมอบ", "delivery verdict", "run-history", "UAT_MCP_TOKEN", "test_db", "uat_admin"]
sources: ["uat/openhands-swarm/src/lib/swarm-store.ts:17", "uat/openhands-swarm/src/lib/uat-runs.ts:15", "uat/openhands-swarm/src/lib/uat-runs.ts:65", "uat/openhands-swarm/src/lib/uat-runs.ts:298", "uat/openhands-swarm/src/lib/issuemate.ts:114", "uat/openhands-swarm/src/lib/issuemate.ts:200", "uat/openhands-swarm/src/lib/uat-runs.ts:324", "uat/openhands-swarm/src/lib/uat-runs.ts:371", "uat/openhands-swarm/src/lib/deepseek-brain.ts:465", "uat/openhands-swarm/src/lib/swarm-store.ts:80", "uat/openhands-swarm/src/lib/auto-retest.ts:25", "uat/openhands-swarm/src/instrumentation.ts:2", "uat/openhands-swarm/src/lib/nightly.ts:46", "uat/openhands-swarm/src/lib/nightly-run.ts:29", "uat/openhands-swarm/src/lib/run-history.ts:141", "uat/openhands-swarm/src/lib/delivery.ts:41", "uat/openhands-swarm/src/lib/mcp.ts:25", "uat/openhands-swarm/src/lib/test-db.ts:34", "uat/openhands-swarm/src/app/api/mcp/route.ts:19", "uat/openhands-swarm/src/middleware.ts:6", "uat/openhands-swarm/src/lib/admin-session.ts:4"]
---
# การทำงานอัตโนมัติของ UAT Tester

บันทึกนี้ต่อจาก [[sys-uat-overview]] อธิบายส่วนที่ทำให้ Tester ทำงานเองได้หลังเริ่มรันแล้ว ได้แก่ การตั้งค่า คิว การเปิด ticket การตรวจซ้ำ รอบกลางคืน ประวัติ สรุปส่งมอบ MCP และสิทธิ์เข้าใช้

## ค่าตั้งของระบบ

ค่าอยู่ในหน่วยความจำของโปรเซสเว็บ (`swarm-store.ts:17-30`) รีสตาร์ทแล้วกลับเป็นค่าจาก env ยกเว้นค่ารอบกลางคืนที่จดลงไฟล์

| ค่า | ค่าเริ่มต้น | ความหมาย |
|---|---|---|
| `erpTargetUrl` | env `ERP_TARGET_URL` | เว็บ ERP ที่ถูกทดสอบ |
| `autoIssueMate` | เปิด (ปิดด้วย env `ISSUEMATE_AUTO=0`) | รอบไม่ผ่านเปิด ticket เอง |
| `autoRetest` | เปิด (ปิดด้วย env `UAT_AUTO_RETEST=0`) | ticket เป็น `deployed` แล้วตรวจซ้ำเอง |
| `autoScripts` | ปิด | ให้ AI คิดสคริปต์ `auto-*` เพิ่มเอง |
| `maxParallelBots` | 12 | จำนวนรอบที่รันพร้อมกันสูงสุด ตั้งได้ 1-32 (`swarm-store.ts:80`) |
| `headed` | env `UAT_HEADED=1` | เปิดหน้าต่าง Chrome ให้เห็น |
| `nightlyEnabled`, `nightlyTime` | อ่านจาก `runs/nightly.json` | รอบกลางคืน |

## คิวและสถานะรอบ

- เว็บเก็บรอบล่าสุดในหน่วยความจำไม่เกิน 60 รอบ (`KEEP_RUNS`, `uat-runs.ts:15`) แต่ผลที่จบแล้วอยู่ถาวรที่ `runs/<id>/run.json` (`uat-runs.ts:86`)
- ตอนเริ่มเซิร์ฟเวอร์ `rerunStranded` (`uat-runs.ts:65`) รันใหม่เองสำหรับรอบที่ไม่ผ่านและค้างโดยไม่มี ticket เมื่อเปิด `autoIssueMate`
- `stopRun` (`uat-runs.ts:371`) สั่งหยุดรอบที่กำลังรัน คิวและสถานะบอทอยู่ในหน่วยความจำ รีสตาร์ทแล้วสถิติของบอทเริ่มใหม่

## การเปิด ticket ใน IssueMate

เมื่อรอบจบเป็น `failed` และเปิด `autoIssueMate` ระบบเรียก `reportRun` (`issuemate.ts:200`):

- หัวเรื่อง `[UAT S1] <ชื่อสคริปต์> — ขั้น N <ชื่อขั้น>` ประเภท bug ป้ายกำกับ `uat` + module + lens + ระดับ ความสำคัญแปลงจาก S1/S2/S3/S4 เป็น critical/high/medium/low ผู้แจ้งชื่อ `UAT Tester Swarm`
- รายละเอียดรวมขั้นที่ไม่ผ่านพร้อมค่าที่คาดหวังเทียบค่าจริง ลิงก์หลักฐาน (ภาพ วิดีโอ trace) และบรรทัด `สคริปต์: uat-scripts/<id>.json` ซึ่งใช้ผูก ticket กับสคริปต์ตอนตรวจซ้ำ
- กันเปิดซ้ำด้วยไฟล์ `runs/issuemate-sent.json` (คีย์ = สคริปต์ + ขั้นแรกที่พัง): ถ้ามี ticket เดิมที่ยังไม่ปิด จะต่อท้ายผลใน ticket เดิมแทนเปิดใหม่ และถ้า ticket เดิมเป็น `deployed`/`wont_fix`/`closed` แล้วจึงเปิดใหม่ได้
- รอบที่จบเป็น `error` (ตัวรันล้มเองหรือหมดเวลา) ไม่ถูกส่งอัตโนมัติ ส่งเองได้ด้วย `sendToIssueMate` (`uat-runs.ts:346`)
- ส่วนวิเคราะห์ต้นตอและแนวทางแก้ใน ticket ใช้ DeepSeek Reasoner (`diagnoseStuckOrFailedScriptWithDeepSeek`, `deepseek-brain.ts:465`; คีย์จาก env `DEEPSEEK_API_KEY`) ถ้าเรียกไม่ได้จะใช้ข้อความสำรองจากขั้นที่พัง
- เมื่อสคริปต์ที่เคยมี ticket รันผ่านอีกครั้ง `closeLoop` (`uat-runs.ts:324`) เรียก `resolvePassedIssue` (`issuemate.ts:114`): ถ้า ticket ยังเปิดอยู่ ระบบเลื่อนสถานะไปเป็น `deployed` ผ่านชุดคำสั่ง MCP ของ IssueMate (ส่ง review แบบ fix, claim, mark_deployed) แล้วคอมเมนต์ว่าตรวจซ้ำผ่าน ถ้า ticket ปิดไปแล้วจะแค่คอมเมนต์
- ปลายทางตั้งด้วย env `ISSUEMATE_MCP_URL`, `ISSUEMATE_PROJECT`, `ISSUEMATE_TOKEN` (ค่าอยู่ใน env ไม่เขียนในเอกสาร) ขั้นตอนฝั่งคนแก้ ticket อยู่ที่ [[std-uat-issuemate-workflow]]

## ตรวจซ้ำอัตโนมัติ (autoRetest)

IssueMate ไม่มี webhook ออก ดังนั้น `instrumentation.ts` ตั้งตัวตรวจทุก 5 นาที เรียก `pollDeployed` (`auto-retest.ts:25`):

1. ดึงรายการ ticket ที่เป็น `deployed` และผู้แจ้งขึ้นต้น `UAT Tester Swarm`
2. อ่านชื่อสคริปต์จากบรรทัด `สคริปต์: uat-scripts/<id>.json` ใน ticket
3. สั่งรันสคริปต์นั้นเป็นรอบตรวจซ้ำ (`retestOf` = เลข ticket) แล้วผลผ่านจะปิด ticket ตามหัวข้อก่อนหน้า
4. จดสถานะลง `runs/auto-retest.json` ก่อนสั่งรัน เพื่อไม่วนสั่งซ้ำเมื่อรีสตาร์ท; ครั้งแรกที่เปิดสวิตช์ (ยังไม่มีไฟล์) จะแค่จด ticket ที่เป็น `deployed` อยู่แล้ว ไม่ตรวจย้อนหลัง

## รอบ regression กลางคืน

- ปิดไว้เป็นค่าเริ่มต้น เปิด/ตั้งเวลา (เวลาไทย ค่าเริ่มต้น 02:00) ได้ที่หน้าตั้งค่าหรือ MCP tool `nightly` ค่าเก็บใน `runs/nightly.json` (`nightly.ts:8-10`)
- ตัวตั้งเวลาเป็น `setInterval` ทุก 30 วินาทีในโปรเซสเว็บเอง เริ่มจาก `instrumentation.ts` (`nightly-run.ts:29-35`) ไม่ต้องมี cron บนเซิร์ฟเวอร์
- ถึงเวลาแล้ว `tick` (`nightly.ts:69`) สั่งรันสคริปต์ทั้งคลังยกเว้นกลุ่ม `ask-*` และ `auto-*` (ที่เขียนอัตโนมัติและยังไม่มีคนตรวจ) เลยเวลาเกิน 180 นาทีแล้วไม่ตามไปรัน (`GRACE_MIN`)
- ไม่ซ้อนกัน: ถ้ายังมีรอบค้าง จะรอแล้วลองใหม่ ไม่รันซ้ำคืนเดียวกัน เพราะจดคืนที่สั่งแล้วลงไฟล์ก่อนสั่งรัน
- สรุปเช้า (`summarize`, `nightly.ts:124`) นับผ่าน/ล้ม/ผิดพลาด/ข้าม ระบุรายการที่ล้มพร้อมเหตุผล เลข ticket และบอกว่าล้มใหม่หรือล้มซ้ำเทียบคืนก่อน และรายการที่ซ่อมแล้ว
- ตรวจตรรกะด้วย `pnpm check:nightly` (เวลาปลอม ไม่รันสคริปต์จริง)

## ประวัติถาวรและแนวโน้ม

- ทุกรอบที่จบถูกจดหนึ่งบรรทัดลงไฟล์รายเดือน `data/run-history/YYYY-MM.jsonl` (append-only, นอก `runs/`) ฟิลด์: id, scriptId, module, lens, bot, status, passed, failed, durationMs, startedAt, finishedAt, ticket, retestOf
- ตอนเริ่มเซิร์ฟเวอร์ `backfillHistory` เติมรอบเก่าจาก `runs/*/run.json` ที่ยังไม่อยู่ในไฟล์
- หน้า `/trends` และ API `GET /api/history?days=7|30|90` (ช่วงสูงสุด 90 วัน) แสดงอัตราผ่านต่อโมดูลต่อวัน สคริปต์ที่ช้าลงผิดปกติ และสคริปต์ที่ผลไม่นิ่ง
- กติกาตัดสินอยู่ใน `RULES` (`run-history.ts:141`): ช้า = ค่ากลางเวลาของ 3 รอบล่าสุดช้ากว่าค่ากลางของรอบผ่านก่อนหน้า (ต้องมี 5-20 รอบ) อย่างน้อย 1.5 เท่าและเกิน 3 วินาที; ไม่นิ่ง = อย่างน้อย 4 รอบ สลับผ่าน/ไม่ผ่าน 2 ครั้งขึ้นไปและไม่น้อยกว่า 30% ของจังหวะ

## สรุปส่งมอบ (Delivery verdict)

`buildDelivery` (`delivery.ts:41`) ใช้รอบล่าสุดที่จบแล้วของแต่ละสคริปต์ จัดผลเป็นรายเมนู รายงาน และสคริปต์ตรวจ แล้วเทียบกับทะเบียนเมนูใน `src/lib/erp-menus.json` เพื่อหาเมนูที่ยังไม่เคยทดสอบ คำตัดสินมี 4 ระดับตามลำดับความสำคัญ:

| คำตัดสิน | เงื่อนไข |
|---|---|
| `blocked` | มีรายการไม่ผ่านระดับ S1 หรือ S2 |
| `incomplete` | ไม่มี S1/S2 แต่ยังมีเมนูหรือสคริปต์ที่ยังไม่ได้ทดสอบ |
| `conditional` | ทดสอบครบแล้วแต่มีไม่ผ่านระดับ S3/S4 |
| `ready` | ทดสอบครบและผ่านทั้งหมด |

เรียกดูได้จากหน้าเว็บ หรือ `GET /api/delivery`

## MCP สำหรับให้ AI สั่ง Tester

`POST /api/mcp` เป็น JSON-RPC (Streamable HTTP ไม่มี session) ตรวจ `Authorization: Bearer` กับ env `UAT_MCP_TOKEN` หรือ token ที่ผู้ดูแลสร้างจากหน้าเว็บ (เก็บเฉพาะค่าแฮช SHA-256 ใน `runs/mcp-tokens.json`) ถ้ายังไม่มี token ใดเลยตอบ 503 และถ้า token ผิดตอบ 401 (`route.ts:42-43`) มี 11 tool (`mcp.ts:25-75`):

| tool | ใช้ทำอะไร |
|---|---|
| `status` | สุขภาพระบบและสรุปสถานะ |
| `scripts` | ดูรายการสคริปต์ในคลัง |
| `save_script` | บันทึกสคริปต์ใหม่ (ผ่าน `lintScript`) |
| `run` | สั่งรันสคริปต์ หรือสั่งตรวจซ้ำตามเลข issue และรอผลได้ |
| `runs` | ดูผลรอบที่รัน |
| `command` | สั่งงานตรวจด้วยภาษาไทย (สร้างสคริปต์จากแม่แบบ) |
| `events` | ฟีดเหตุการณ์ล่าสุด (อยู่ในหน่วยความจำ) |
| `logs` | บันทึกการทำงานรายวัน |
| `test_db` | `list`/`create`/`drop` ฐานทดสอบ `uat_<ชื่อ>` สำเนาจากแม่แบบ `uat_template` สูงสุด 5 ฐาน ลบได้เฉพาะฐานที่มีป้าย COMMENT `uat-tester` (`test-db.ts:34`) |
| `nightly` | ดู/ตั้งรอบกลางคืนและสรุปเช้า |
| `notify` | ส่งข้อความเข้าฟีด |

## สิทธิ์เข้าใช้เว็บ

- ทุกคนดูได้ (คำขอแบบ GET) ส่วนคำสั่งที่เปลี่ยนสถานะ (รันสคริปต์ ตั้งค่า สั่งงานตรวจ ส่ง ticket) ต้องเป็นผู้ดูแลที่ล็อกอินด้วย Google และคุกกี้ `uat_admin` อายุ 7 วัน (`middleware.ts:6-12`, `admin-session.ts:4-6`)
- รายชื่ออีเมลผู้ดูแลมาจาก env `UAT_ADMIN_EMAIL` (คั่นด้วยจุลภาค) ตัวลงลายเซ็นคุกกี้มาจาก env `UAT_SESSION_SECRET` ไม่ตั้งสองค่านี้ = ไม่มีใครสั่งงานผ่านหน้าเว็บได้
- `/api/mcp` และ `/api/auth` ข้ามขั้นนี้ เพราะ MCP ตรวจ Bearer เอง
- ข้อมูลที่เปิดดูได้สาธารณะรวมถึง SQL ในสคริปต์ ผลคิวรีของฐาน Demo และภาพหน้าจอ Demo จึงห้ามใส่ข้อมูลจริงของลูกค้าในสคริปต์

## ที่มาในโค้ด
- `uat/openhands-swarm/src/lib/swarm-store.ts:17-30` ค่าตั้งของระบบ
- `uat/openhands-swarm/src/lib/uat-runs.ts:15` เพดาน 60 รอบ, `:65` `rerunStranded`, `:298` `autoIssue`, `:324` `closeLoop`, `:346` `sendToIssueMate`, `:371` `stopRun`
- `uat/openhands-swarm/src/lib/issuemate.ts:200` `reportRun` เปิด ticket พร้อมกันซ้ำ
- `uat/openhands-swarm/src/lib/auto-retest.ts:25` `pollDeployed`, `src/instrumentation.ts:2` ตัวตั้งเวลาเริ่มตอนเซิร์ฟเวอร์ขึ้น
- `uat/openhands-swarm/src/lib/nightly.ts:46` `dueNight`, `:69` `tick`, `src/lib/nightly-run.ts:29` ตัวตั้งเวลา 30 วินาที
- `uat/openhands-swarm/src/lib/run-history.ts:141` กติกาแนวโน้ม
- `uat/openhands-swarm/src/lib/delivery.ts:41` คำตัดสินส่งมอบ
- `uat/openhands-swarm/src/lib/mcp.ts:25` รายการ tool, `src/app/api/mcp/route.ts:19` ตรวจ Bearer, `src/lib/test-db.ts:34` ฐานทดสอบ
- `uat/openhands-swarm/src/middleware.ts:6` และ `src/lib/admin-session.ts:4` สิทธิ์ผู้ดูแล
- ดูเพิ่ม: [[sys-uat-overview]] · [[sys-uat-script-format-and-runner]] · [[sys-uat-chaos-lab]] · [[sys-scripts-overview]] · [[std-uat-issuemate-workflow]] · [[std-uat-swarm-dsl-and-tester-rules]]
