---
title: "รูปแบบสคริปต์ทดสอบและตัวรัน (UAT Script Format and Runner)"
tags: [systems, uat, runner, playwright, postgres]
aliases: ["uat-scripts", "runner/run.mjs", "ขั้น do", "ui.demoLogin", "db.query", "api.request", "bc.auditScreen", "STEP_KINDS", "ฐานทดสอบที่อนุญาต"]
sources: ["uat/openhands-swarm/runner/run.mjs:1", "uat/openhands-swarm/runner/run.mjs:31", "uat/openhands-swarm/runner/run.mjs:42", "uat/openhands-swarm/runner/run.mjs:56", "uat/openhands-swarm/runner/run.mjs:132", "uat/openhands-swarm/runner/run.mjs:493", "uat/openhands-swarm/runner/run.mjs:674", "uat/openhands-swarm/runner/run.mjs:717", "uat/openhands-swarm/runner/run.mjs:1357", "uat/openhands-swarm/runner/run.mjs:1376", "uat/openhands-swarm/runner/run.mjs:1440", "uat/openhands-swarm/runner/run.mjs:260", "uat/openhands-swarm/runner/selfcheck.mjs:1", "uat/openhands-swarm/src/lib/uat-runs.ts:86", "uat/openhands-swarm/src/lib/mcp.ts:17", "uat/openhands-swarm/src/lib/mcp.ts:124", "uat/openhands-swarm/uat-scripts/security-api-session.json:1", "uat/openhands-swarm/uat-scripts/e2e-sale-cash.json:1"]
---
# รูปแบบสคริปต์ทดสอบและตัวรัน

สคริปต์ทดสอบของ [[sys-uat-overview]] คือไฟล์ JSON หนึ่งไฟล์ต่อหนึ่งเรื่อง เก็บใน `uat/openhands-swarm/uat-scripts/` และถูกรันโดย `runner/run.mjs` ครั้งละหนึ่งสคริปต์ ไฟล์เดียวกันนี้เรียกได้จากบรรทัดคำสั่ง:

```
node runner/run.mjs --script uat-scripts/security-api-session.json --out runs/manual-1 --base <เว็บ ERP ที่ทดสอบ>
```

(รันจากโฟลเดอร์ `uat/openhands-swarm/`; ตัวรันจะอ่านค่าเชื่อมฐานข้อมูล Demo จากไฟล์ตั้งค่า backend `BCConfigbcdemo.json` อัตโนมัติถ้ามี มิฉะนั้นใช้ env `UAT_PG_*`)

## โครงของสคริปต์

| ฟิลด์ | ความหมาย |
|---|---|
| `id` | ชื่อไฟล์ ใช้ a-z 0-9 และขีด |
| `title`, `description` | ชื่อและคำอธิบายภาษาไทยที่จะไปอยู่ใน ticket |
| `module` | หนึ่งใน master, sales, purchase, inventory, gl, tax, reports, security, admin, recon, cash, pos |
| `lens` | มุมตรวจ `screen` / `data` / `api` (cash มีเฉพาะ screen กับ data) |
| `severityOnFail` | S1-S4 ความรุนแรงเมื่อไม่ผ่าน |
| `steps[]` | ขั้นทดสอบเรียงลำดับ |
| `cleanup[]` | ขั้นเก็บกวาด รันเสมอแม้ขั้นหลักล้ม (`run.mjs:1440`) |
| `timeoutMs` | เวลารวมของทั้งรอบ ค่าเริ่มต้น 300 วินาที |

ชื่อชนิดขั้นอยู่ในคีย์ **`do`** (ไม่ใช่ `cmd`) ตัวอย่างจริง `security-api-session.json`: ขั้นแรก `ui.demoLogin` ขั้นสอง `api.request` แบบ GET ไป `/api/auth/session` ต้องตอบ `expectStatus: 200` ส่วนสคริปต์ธุรกิจเต็มวงจร เช่น `e2e-sale-cash.json` ยิง API เดียวกับหน้าจอขาย บันทึกบิลขายเงินสด ตรวจ VAT บัญชี สต็อก รายงาน แล้วลบคืนใน `cleanup` พร้อมตรวจว่าไม่เหลือเศษเอกสารทดสอบ

## ชนิดขั้นที่ใช้ได้ (`do`)

รายการชื่ออยู่ที่ `STEP_KINDS` ใน `src/lib/mcp.ts:17` ซึ่งใช้ตรวจตอนบันทึกสคริปต์ด้วย (`lintScript`)

| กลุ่ม | ชนิดขั้น | ทำอะไร |
|---|---|---|
| หน้าจอ | `ui.goto`, `ui.demoLogin`, `ui.openMenu`, `ui.click`, `ui.fill`, `ui.select`, `ui.press`, `ui.readText` | เปิดหน้า ล็อกอิน Demo เปิดเมนูตามรหัส กดและกรอก |
| ตรวจหน้าจอ | `ui.expectText`, `ui.expectVisible`, `ui.expectValue`, `ui.expectUrl`, `ui.expectClean`, `ui.screenshot`, `ui.pdf` | ตรวจข้อความ/ค่า/URL, ตรวจว่าไม่มี HTTP 400+ JS error SQLSTATE, ตรวจแถวไม่เหลื่อมระนาบ, เทียบภาพกับภาพอ้างอิงใน `baselines/` |
| ช่วยตรวจเชิงลึก | `ui.act`, `ui.see`, `ui.play` | ตรวจ/กดปุ่มด้วย DOM ในเครื่อง ไม่เรียกโมเดลภาษา (ดู [[sys-uat-overview]]) |
| ชุดตรวจของ BC | `bc.toolbar`, `bc.searchList`, `bc.auditScreen`, `bc.probeButtons`, `bc.auditReport`, `bc.auditAccounting`, `bc.auditThreeWay`, `bc.auditStrictUx`, `bc.auditTaxBoundary`, `bc.auditSecurityAndLock`, `bc.auditSchemaAndCoverage` | ชุดตรวจสำเร็จรูปที่รู้จักโครงสร้างจอ BC (แถบเครื่องมือ ค้นหา รายงาน บัญชี สามทาง ภาษี สิทธิ์/ล็อก โครงสร้างตาราง) |
| API / รายงาน | `api.request`, `report.pdf` | เรียก API ด้วยคุกกี้ของเบราว์เซอร์ที่ล็อกอินแล้ว (หรือ `noAuth`), ขอ PDF แบบเดียวกับปุ่มพิมพ์ |
| ฐานข้อมูล | `db.query`, `db.exec` | `db.query` อ่านอย่างเดียว, `db.exec` เขียน (ใช้กับข้อมูลทดสอบ) |
| อื่น ๆ | `wait`, `set`, `ui.adminLogin` | หน่วงเวลา (สูงสุด 30 วินาที), ตั้งตัวแปร, ล็อกอินผู้ดูแล (ปัจจุบันเรียกการล็อกอิน Demo) |

ตัวเทียบค่าใน `expect`: `eq`, `ne`, `gt`, `gte`, `lt`, `lte`, `contains`, `matches`, `exists`, `empty`, `same` (ตรวจแล้วในส่วนเทียบค่าของ `run.mjs` ที่ใช้ `check()`) ตัวเลขเงินเทียบด้วยสตริงทศนิยมผ่าน BigInt ไม่ใช้ float (`run.mjs:56-69`)

## ตัวแปรระหว่างขั้น

- ใส่ `{{ชื่อ}}` ในพารามิเตอร์ของขั้น (ยกเว้นฟิลด์ `sql`) ระบบแทนค่าให้ก่อนรัน ตัวแปรสำเร็จรูป `{{run.id}}`, `{{run.short}}`, `{{run.tag}}` (รูป `UAT-<รอบ>`) ใช้ตั้งชื่อเอกสารทดสอบไม่ให้ชนกัน
- ขั้น `api.request` และ `db.query` เก็บค่าจากผลลัพธ์ด้วย `save` แล้วนำไปใช้ขั้นถัดไป ใน SQL เรียกด้วยตัวแปร psql รูป `:'ชื่อ'`
- อ่านตัวแปรสภาพแวดล้อมได้เฉพาะชื่อขึ้นต้น `env.UAT_` และห้ามชื่อที่มี PASS/TOKEN/SECRET/KEY (`run.mjs:42-55`)

## กติกาความปลอดภัยของตัวรัน

1. **ฐานข้อมูลทดสอบเท่านั้น** ทุกขั้น `db.*` ถูกปฏิเสธถ้าฐานที่ขอหรือฐานที่ต่อติดจริงไม่อยู่ในรายชื่ออนุญาต: `bcdemo`, `bcuatadmin`, `bcerpmainuatadmin` (ตัวแปร `UAT_PG_ALLOW_DB` ทำได้แค่ลดรายชื่อ ขยายไม่ได้) บวกฐาน `uat_<ชื่อ>` ที่สร้างด้วยเครื่องมือ `test_db` และมีป้าย COMMENT `uat-tester` (`run.mjs:132-150`)
2. **ปิดบังความลับ** ค่า env ที่ชื่อมี PASS/TOKEN/SECRET/KEY (ยาวตั้งแต่ 4 ตัวอักษร) ถูกแทนด้วย `***REDACTED***` ในทุกผลลัพธ์ที่ตัวรันพิมพ์ รวม `run.json` และ ticket (`run.mjs:31-34`)
3. **ห้ามความลับในไฟล์สคริปต์** `lintScript` ปฏิเสธสคริปต์ที่อ้าง `{{env.*PASS/TOKEN/SECRET/KEY}}` หรือฝังค่าลับของเครื่อง (`mcp.ts:124-130`)
4. **เข้าเฉพาะเว็บเป้าหมาย** ขั้นหน้าจอและ API ใช้ `sameOrigin` ต่อกับค่า `--base` เท่านั้น
5. **ลองซ้ำเฉพาะขั้นที่ซ้ำแล้วผลไม่เปลี่ยน** ขั้นอ่าน/ตรวจและ `api.request` แบบ GET ลองซ้ำได้ 2 ครั้ง ส่วน `ui.click`, `ui.press`, `db.exec` และ API ที่ไม่ใช่ GET ไม่ลองซ้ำเพราะอาจสร้างเอกสารซ้ำ (`run.mjs:1376-1379`)
6. **วิดีโอและ trace** อัดเฉพาะสคริปต์ที่ไม่มีขั้น `ui.adminLogin` เก็บไว้เมื่อรอบไม่ผ่าน (`run.mjs:209-224`)

## หลักฐานที่ตัวรันสร้าง

ตัวรันเขียนไฟล์หลักฐานใน `--out` ชื่อรูป `NNN-<ชื่อ>.png` หรือ `.json` (ภาพหน้าจอ ผลคิวรี ผลเรียก API) และปิดบังความลับก่อนเขียน (`run.mjs:260-261`) ส่วน `run.json` ที่สรุปทุกขั้น (ผ่าน/ไม่ผ่าน/ข้าม ค่าที่คาดหวังเทียบค่าจริง) เขียนโดยฝั่งเว็บเมื่อรอบจบ (`src/lib/uat-runs.ts:86`) แล้วเว็บ Tester นำไปแสดงและแนบลง ticket

## ตรวจตัวรันหลังแก้โค้ด

- `node runner/selfcheck.mjs` เปิดหน้า HTML ทดสอบในเครื่องที่จงใจให้เหลื่อม/เปลี่ยนหน้าตา เพื่อดูว่าตัวรันจับความผิดได้
- `scripts/check-*.mjs` (`check-evidence`, `check-heal`, `check-nightly`, `check-rerun-stranded`, `check-run-history`, `check-script-fault`) เป็นตัวตรวจตรรกะของฝั่งเว็บด้วยของปลอม ไม่เรียกระบบจริง; `pnpm check:nightly` และ `pnpm check:history` ผูกไว้ใน `package.json`

## ที่มาในโค้ด
- `uat/openhands-swarm/runner/run.mjs:1-4` หัวไฟล์ วิธีเรียก `--script --out --base`
- `uat/openhands-swarm/runner/run.mjs:42-55` ตัวแปร `{{...}}` และการห้ามอ่านค่าลับ
- `uat/openhands-swarm/runner/run.mjs:56-69` เทียบตัวเลขเงินเป็นทศนิยมสตริง
- `uat/openhands-swarm/runner/run.mjs:132-150` รายชื่อฐานทดสอบและตัวป้องกัน `ensureDemoDb`
- `uat/openhands-swarm/runner/run.mjs:493` ตาราง `ACTIONS` ของทุกชนิดขั้น, `:674` `api.request`, `:717` `db.query`, `:1357` `db.exec`
- `uat/openhands-swarm/runner/run.mjs:1376` ชนิดขั้นที่ลองซ้ำได้, `:1440` ขั้น cleanup รันเสมอ
- `uat/openhands-swarm/src/lib/mcp.ts:17` `STEP_KINDS`, `:124` `lintScript`
- `uat/openhands-swarm/uat-scripts/security-api-session.json:1` ตัวอย่างสคริปต์เล็ก, `e2e-sale-cash.json:1` ตัวอย่างวงจรขายเงินสด
- ดูเพิ่ม: [[sys-uat-overview]] · [[sys-uat-swarm-ops-and-automation]] · [[std-uat-swarm-dsl-and-tester-rules]] · [[std-uat-issuemate-workflow]]
