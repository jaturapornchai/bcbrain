---
title: "ระบบ UAT ภาพรวม: บอททดสอบอัตโนมัติและ Chaos Lab (UAT System Overview)"
tags: [systems, uat, tester, issuemate, playwright]
aliases: ["UAT Tester", "openhands-swarm", "UAT Swarm", "uat-scripts", "บอททดสอบ UAT", "Chaos Lab", "runner/run.mjs", "สั่งงานตรวจ"]
sources: ["uat/package.json:1", "uat/openhands-swarm/package.json:6", "uat/openhands-swarm/runner/run.mjs:1", "uat/openhands-swarm/runner/run.mjs:209", "uat/openhands-swarm/runner/run.mjs:515", "uat/openhands-swarm/src/lib/issuemate.ts:10", "uat/openhands-swarm/src/lib/command.ts:37", "uat/openhands-swarm/src/lib/uat-runs.ts:91", "uat/openhands-swarm/src/lib/uat-runs.ts:140", "uat/openhands-swarm/src/lib/uat-runs.ts:174", "uat/openhands-swarm/src/lib/uat-runs.ts:265", "uat/openhands-swarm/src/lib/swarm-store.ts:17", "uat/openhands-swarm/src/lib/swarm-data.ts:142", "uat/openhands-swarm/src/lib/command.ts:308", "uat/chaos-lab/package.json:6"]
---
# ระบบ UAT ภาพรวม

โฟลเดอร์ `uat/` เก็บเครื่องมือทดสอบแบบ UAT (User Acceptance Test) ของ BC Ai Account สองตัว ที่ทำงานแยกกันและเป็นแอป Next.js คนละตัว

| ระบบ | ทำอะไร | โฟลเดอร์ | อ่านต่อ |
|---|---|---|---|
| UAT Tester Swarm | รัน "สคริปต์ทดสอบ" JSON ผ่านเบราว์เซอร์จริง, API และฐานข้อมูล Demo แล้วเปิด ticket เองเมื่อไม่ผ่าน | `uat/openhands-swarm/` (สั่ง `dev`/`start` ที่พอร์ต 3050) | บันทึกนี้, [[sys-uat-script-format-and-runner]], [[sys-uat-swarm-ops-and-automation]] |
| Chaos Lab | ห้องทำงานเสมือน 3 มิติ จำลองพนักงานหลายแผนกยิงรายการพร้อมกันใส่ฐานทดสอบ แล้วตรวจกฎบัญชี | `uat/chaos-lab/` (พอร์ต 3055) | [[sys-uat-chaos-lab]] |

นอกจากนี้ `uat/scratch/` เป็นสคริปต์ชั่วคราวของนักพัฒนา (สำรวจหน้าจอ ตรวจคอลัมน์ ปิด ticket ที่ยืนยันแล้ว ฯลฯ) ไม่ใช่ส่วนของระบบหลัก ส่วนโฟลเดอร์สำรอง `openhands-swarm-src-backup-*` ไม่ใช้งาน

กติกาการเขียนสคริปต์และการทำงานกับ IssueMate ในเชิงมาตรฐานอยู่ที่ [[std-uat-swarm-dsl-and-tester-rules]] และ [[std-uat-issuemate-workflow]] บันทึกชุด `sys-uat-*` นี้อธิบายตามโค้ดที่มีอยู่จริง

## การรันหนึ่งรอบทำงานอย่างไร

1. **มีสคริปต์** สคริปต์คือไฟล์ JSON ใน `uat-scripts/` (ชื่อขึ้นต้น เช่น `ask-`, `auto-`, `e2e-`, `smoke-`) หรือสร้างจากคำสั่งภาษาไทยผ่านหน้า "สั่งงานตรวจ" / MCP tool `command` (ดูข้อถัดไป)
2. **เข้าคิว** `startRuns` สร้างรอบใหม่ (id สุ่ม) และมอบให้บอทที่ตรง module + lens และยังว่างก่อน ถ้าไม่มีก็หมุนเวียนให้ตัวอื่น (`uat-runs.ts:91-125`)
3. **คุมจำนวนพร้อมกัน** `pump` เริ่มรอบถัดไปไม่เกิน `maxParallelBots` (ค่าเริ่มต้น 12 ที่ `swarm-store.ts`)
4. **รัน** เปิดโปรเซสลูก `node runner/run.mjs --script <ไฟล์> --out runs/<id> --base <เว็บ ERP>` (`uat-runs.ts:174`) ตัวรันพิมพ์เหตุการณ์ทีละบรรทัดเป็น JSON ให้เว็บอ่านต่อ
5. **เก็บหลักฐาน** ผลทั้งหมดอยู่ใน `runs/<id>/` (`run.json` และไฟล์หลักฐาน เช่นภาพ) รอบที่ไม่ผ่านเก็บวิดีโอ `video.webm` และ `trace.zip` เพิ่ม รอบที่ผ่านลบวิดีโอทิ้ง (`run.mjs:218-224`)
6. **ไม่ผ่าน -> ticket** รอบที่จบเป็น `failed` และเปิดสวิตช์ `autoIssueMate` จะเรียก `autoIssue` ส่งเข้า IssueMate เอง (`uat-runs.ts:265`) ระดับความรุนแรง S1-S4 ของสคริปต์แปลงเป็นความสำคัญ critical/high/medium/low (`issuemate.ts:10`)
7. **จดประวัติ** ทุกรอบที่จบถูกจดต่อท้ายไฟล์ประวัติรายเดือน (`recordRun` จาก `uat-runs.ts:87`) เพื่อทำหน้าแนวโน้ม
8. **ตรวจซ้ำ** เมื่อ ticket ถูกเปลี่ยนเป็น `deployed` ระบบสั่งรันสคริปต์เดิมซ้ำเอง ดู [[sys-uat-swarm-ops-and-automation]]

## สั่งงานตรวจด้วยภาษาไทย (Code-First)

`dispatch` ใน `command.ts` รับคำสั่ง เลือกบอทจากคำสำคัญในประโยค (ถ้าไม่ตรงโมดูลใดจะเลือกสต็อก ข้อมูลหลัก รายงาน; สูงสุด 9 ตัว) แล้ว `commandBot` สร้างสคริปต์จากแม่แบบตามมุมตรวจของบอท:

| มุมตรวจ (lens) | สคริปต์ที่สร้าง |
|---|---|
| `screen` | ล็อกอิน Demo, เปิดจอที่ตรงคำสั่ง (ขั้น `bc.auditScreen`), กดปุ่มปรับความกว้างคอลัมน์/สลับภาษา, ตรวจว่าไม่มี HTTP 400+/JS error/SQLSTATE |
| `data` | `db.query` ตรวจรหัสว่างในตารางหลักของโมดูล และตรวจว่าผลต่าง Debit-Credit ของเอกสารทดสอบ `UAT%` เป็น 0.00 |
| `api` | ตรวจ `/api/auth/session` ได้ 200 และเรียกรายงาน `/api/process/report/run` ต้องได้ `executedSql` |

สคริปต์ที่สร้างต้องผ่าน `checkScript` ก่อนบันทึก ซึ่งรวมการตรวจ SQL ทุกคำสั่งด้วย `EXPLAIN` (`sqlGuard`) จากนั้นจึง `saveScript` และ `startRuns` ในโค้ดชุดนี้การสร้างสคริปต์ทำด้วยแม่แบบในเครื่อง (ข้อความในโค้ดเรียกว่า Code-First Local Engine, 0 Token) ไม่ได้ให้โมเดลภาษาเขียนสคริปต์

## จำนวนบอท

บอทสร้างจากอาร์เรย์ใน `swarm-data.ts`: 12 โมดูล (master, sales, purchase, inventory, gl, tax, reports, security, admin, recon, cash, pos) คูณมุมตรวจหน้าจอ/ฐานข้อมูล/API โดยเงินสด/ธนาคาร (cash) มีเฉพาะหน้าจอกับฐานข้อมูล รวมเป็น 35 บอทตามการคำนวณจากโค้ด ส่วนคอมเมนต์เหนืออาร์เรย์ `LENSES` (`swarm-data.ts:142`) และหัวข้อ README ยังเขียนว่า 32 ซึ่งเป็นตัวเลขก่อนเพิ่มโมดูล POS

## ข้อควรรู้เมื่อเทียบกับ README ของโฟลเดอร์

- ขั้น `ui.act`, `ui.see`, `ui.play` ในตัวรันปัจจุบันตรวจด้วย DOM ในเครื่อง (ข้อความในโค้ดระบุ 0 Token) ส่วนโค้ดเรียก Ollama Cloud/Stagehand ยังอยู่ในไฟล์แต่ตัวแปร `needsStagehand` ตั้งเป็น `false` (`run.mjs:166-194`)
- ขั้น `ui.adminLogin` ในตัวรันปัจจุบันเรียกการล็อกอิน Demo เดียวกัน (`run.mjs:515-517`) แต่ถ้าสคริปต์มีขั้นนี้ ตัวรันจะไม่อัดวิดีโอ/trace (`run.mjs:209`)
- README ในโฟลเดอร์ยังบรรยายการให้ AI เขียนสคริปต์/วิเคราะห์ ticket ด้วยโมเดลหลายรุ่น ให้ยึดโค้ดเป็นหลักเมื่อไม่ตรงกัน

## ที่มาในโค้ด
- `uat/package.json:1` และ `uat/openhands-swarm/package.json:6` แอป Tester (พอร์ต 3050 ใน script `dev`/`start`) ส่วน `uat/chaos-lab/package.json:6` ใช้พอร์ต 3055
- `uat/openhands-swarm/src/lib/uat-runs.ts:91-125` เข้าคิวและเลือกบอท, `:140` `pump` คุมจำนวนพร้อมกัน, `:174` เปิดโปรเซสตัวรัน, `:265` ส่ง ticket อัตโนมัติเมื่อรอบไม่ผ่าน
- `uat/openhands-swarm/src/lib/swarm-store.ts:17-30` ค่าตั้งต้นของระบบ (`maxParallelBots` 12, `autoIssueMate`, `autoRetest`)
- `uat/openhands-swarm/src/lib/swarm-data.ts:142` ที่มาของจำนวนบอท
- `uat/openhands-swarm/src/lib/command.ts:308` `commandBot` สร้างสคริปต์จากแม่แบบแล้วสั่งรัน
- `uat/openhands-swarm/runner/run.mjs:1-4` ตัวรันสคริปต์ทีละเรื่อง
- ดูเพิ่ม: [[sys-uat-script-format-and-runner]] · [[sys-uat-swarm-ops-and-automation]] · [[sys-uat-chaos-lab]] · [[std-uat-swarm-dsl-and-tester-rules]] · [[std-uat-issuemate-workflow]] · [[sys-tests-overview]] · [[sys-scripts-overview]]
