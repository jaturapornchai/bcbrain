---
title: "สคริปต์ประจำโปรเจกต์ ภาพรวม: ดีพลอยเว็บ ประทับรุ่น สร้างฐานข้อมูล และตัวเฝ้า ticket (Scripts Overview)"
tags: [systems, scripts, deploy, postgres, issuemate]
aliases: ["scripts/", "deploy-web-prod", "stamp-build-info", "ask_deepseek", "BUILD_INFO", "buildInfo.ts", "สคริปต์ root", "BC_DEPLOY_HOST"]
sources: ["scripts/deploy-web-prod.mjs:7", "scripts/deploy-web-prod.mjs:22", "scripts/deploy-web-prod.mjs:46", "scripts/deploy-web-prod.mjs:63", "scripts/deploy-web-prod.mjs:76", "scripts/deploy-web-prod.mjs:96", "scripts/stamp-build-info.mjs:7", "scripts/stamp-build-info.mjs:23", "frontend/package.json:10", "scripts/ask_deepseek.mjs:1", "scripts/ask_deepseek.mjs:9", "scripts/provision-postgres.mjs:5", "scripts/notify-chaos-lab.mjs:1", "scripts/wait_for_issue.py:1"]
---
# สคริปต์ประจำโปรเจกต์ (scripts/)

โฟลเดอร์ `scripts/` ที่รากของโปรเจกต์เก็บเครื่องมือบรรทัดคำสั่งที่นักพัฒนาและ AI ผู้ช่วยรันเอง ไม่ได้เป็นส่วนของเว็บหรือ backend ที่ผู้ใช้เห็น ทุกไฟล์ต้องรันจาก **ราก repo** (`provision-postgres.mjs` เขียนผลลงโฟลเดอร์ `scripts/sql` ตามไดเรกทอรีที่รันอยู่)

| สคริปต์ | หน้าที่ | อ่านต่อ |
|---|---|---|
| `deploy-web-prod.mjs` | แพ็กเว็บ Next.js แบบ standalone ส่งขึ้นเซิร์ฟเวอร์ และรีสตาร์ทบริการ | บันทึกนี้ |
| `stamp-build-info.mjs` | เขียนเลขรุ่นและวันเวลา build ลงไฟล์ให้หน้าเว็บแสดง | บันทึกนี้ |
| `ask_deepseek.mjs` | ถามคำถามงานบัญชีและ ERP กับ DeepSeek Reasoner จากบรรทัดคำสั่ง | บันทึกนี้ |
| `provision-postgres.mjs` + `sql/` | สร้างสคริปต์ SQL โครงสร้างฐานข้อมูลและข้อมูลตั้งต้น พร้อมชุดสคริปต์ SQL แก้ข้อมูลเดโม | [[sys-scripts-provision-postgres-and-sql]] |
| `wait_for_issue.py` | ตัวเฝ้า ticket ของ IssueMate (รอแบบไม่เปลืองโทเคน) พร้อมประตูตรวจก่อน deploy | [[sys-scripts-issuemate-watcher]] |
| `notify-chaos-lab.mjs` | ปลุก Chaos Lab ให้ทดสอบซ้ำหลังแก้โค้ด | [[sys-uat-chaos-lab]] |

## deploy-web-prod.mjs

ดีพลอยเว็บอย่างเดียว (ส่วน Go backend ไม่เกี่ยว) ต้องตั้ง env `BC_DEPLOY_HOST` เป็นปลายทาง SSH ก่อน ถ้าไม่ตั้งจะหยุดทันที (`:7-8`) ที่อยู่เซิร์ฟเวอร์ไม่ถูกเก็บในสคริปต์ และต้อง build เว็บแบบ standalone (`frontend/.next/standalone`) ไว้ก่อนรัน

ขั้นตอน:

1. **เตรียม** ลบรายการที่ขึ้นต้นด้วยจุดในโฟลเดอร์ standalone (ยกเว้น `.next`) แล้วคัดลอก `.next/static`, `public` และ `src/config/help/data` เข้าไป (`:46-60`)
2. **แพ็ก** สร้าง `bc_web_standalone.tar.gz` ในโฟลเดอร์ชั่วคราวด้วย `tar.exe` ใช้ชื่อไฟล์แบบสัมพัทธ์เพราะ GNU tar ใน Git Bash อ่าน `C:` ในพาธว่าเป็นโฮสต์ระยะไกล (`:62-72`)
3. **อัปโหลด** `scp` ไฟล์ไปไว้ใน `/tmp` ของเซิร์ฟเวอร์ (`:74-96`)
4. **เปิดใช้** `ssh` แตกไฟล์ลงโฟลเดอร์เว็บ รีสตาร์ท systemd service ของเว็บ รอ 3 วินาที แล้วตรวจ `is-active` และลบไฟล์ชั่วคราว (`:98-116`)

ทุกขั้นที่เรียกโปรแกรมภายนอกผ่าน `runWithWatchdog` (`:22-40`) ซึ่งตัดการทำงานเมื่อเกินเวลาแล้วลองใหม่: tar 90 วินาที 2 ครั้ง, scp 120 วินาที 3 ครั้ง, ssh 60 วินาที 3 ครั้ง ถ้าครบจำนวนครั้งแล้วยังไม่ผ่านจะโยน error ออกมา การใช้ `BatchMode=yes` ทำให้ไม่รอรหัสผ่าน จึงต้องตั้งกุญแจ SSH ไว้ล่วงหน้า

```
BC_DEPLOY_HOST=<user@host> node scripts/deploy-web-prod.mjs
```

## stamp-build-info.mjs

เขียนไฟล์ `frontend/src/config/buildInfo.ts` ให้มีค่า `BUILD_INFO` (`version` รูปแบบ `vYYYY.MM.DD-HHMM`, `deployedAt` เป็นข้อความไทยเช่น `วว/ดด/ปปปป ชช:นน:ทท น.`, `deployedIso` ที่มี `+07:00`) และ `BUILD_BADGE_TEXT` สำหรับแสดงป้ายรุ่นบนหน้าเว็บ เวลาคำนวณเป็นเวลาไทย (UTC+7) ด้วยการบวก 7 ชั่วโมงเอง (`stamp-build-info.mjs:7-23`)

สคริปต์นี้ถูกเรียกอัตโนมัติก่อนทุกครั้งที่ `npm run build` ของ frontend ผ่าน `prebuild` (`frontend/package.json:10`) ตัวเฝ้า ticket ก็มีฟังก์ชันประทับรุ่นแบบเดียวกันด้วยตัวเลือก `--stamp-version` ([[sys-scripts-issuemate-watcher]])

## ask_deepseek.mjs

```
node scripts/ask_deepseek.mjs "คำถามเรื่องบัญชี ภาษี หรือระบบงาน"
```

ส่งคำถามไปโมเดล `deepseek-reasoner` (โหมดคิดเหตุผล) และพิมพ์คำตอบ ชื่อตัวแปรคีย์คือ `DEEPSEEK_API_KEY` โค้ดค้นจากไฟล์ `.env.local` ของโฟลเดอร์ที่รันและของ Tester ก่อน แล้วจึงตกมาอ่าน env ของ shell (`loadDeepSeekKey`, `ask_deepseek.mjs:9-31`) และไม่เขียนค่าคีย์ลงโค้ดหรือ log เป็นเครื่องมือให้นักพัฒนาถามความเห็นประกอบ คำตอบไม่ใช่แหล่งอ้างอิงทางกฎหมายภาษี

## ข้อควรรู้

- สคริปต์ที่ติดต่อเซิร์ฟเวอร์จริง (`deploy-web-prod.mjs`) ไม่มีโหมดทดลองรัน (dry run) ตรวจ `BC_DEPLOY_HOST` ให้ถูกก่อนทุกครั้ง
- `provision-postgres.mjs` เขียนทับไฟล์ SQL ที่มีชื่อเดียวกันใน `scripts/sql/` ทุกครั้งที่รัน
- ตัวเฝ้า ticket และ `ask_deepseek.mjs` เรียกบริการภายนอก ค่าเชื่อมต่อทั้งหมดอยู่ใน env ไม่มีค่าลับในโค้ด

## ที่มาในโค้ด
- `scripts/deploy-web-prod.mjs:7-8` ต้องมี `BC_DEPLOY_HOST`, `:22-40` watchdog และ retry, `:46-60` เตรียมไฟล์, `:62-72` แพ็ก tar, `:74-96` อัปโหลด, `:98-116` แตกไฟล์และรีสตาร์ท
- `scripts/stamp-build-info.mjs:7-34` คำนวณเวลาไทยและเขียน `buildInfo.ts`, `frontend/package.json:10` เรียกก่อน build
- `scripts/ask_deepseek.mjs:1-6` วิธีใช้, `:9-28` การหาคีย์, `:47-48` โมเดล
- `scripts/provision-postgres.mjs:1-5` สร้าง SQL ลง `scripts/sql`
- ดูเพิ่ม: [[sys-scripts-provision-postgres-and-sql]] · [[sys-scripts-issuemate-watcher]] · [[sys-uat-chaos-lab]] · [[sys-uat-overview]] · [[sys-tests-overview]] · [[sys-ai-overview]] · [[be-deployment]]
