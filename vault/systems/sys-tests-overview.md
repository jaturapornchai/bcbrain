---
title: "ระบบทดสอบ ภาพรวม: บอท UAT, Stagehand, Playwright และ Go test (Tests Overview)"
tags: [systems, tests, playwright, stagehand, go-test]
aliases: ["tests/", "ชุดทดสอบ", "ทดสอบระบบ", "testscript", "frontend/e2e", "go test", "smoke test"]
sources: ["package.json:11", "package.json:12", "frontend/package.json:9", "frontend/package.json:10", "backend/Makefile:24", "backend/Makefile:31", "tests/uat/lib.mjs:15", "tests/uat/lib.mjs:187", "tests/uat/smoke-all.mjs:1", "tests/stagehand/package.json:11", "tests/stagehand/crud-item.mjs:12", "tests/playwright/package.json:6", "backend/test/blob_integration_test.go:1", "testscript/stock.md:1"]
---
# ระบบทดสอบ ภาพรวม

โปรเจกต์ BC Ai Account มีชุดทดสอบกระจายอยู่ 4 ที่ ไม่ได้รวมเป็นคำสั่งเดียว แต่ละชุดมีวัตถุประสงค์ต่างกัน และมีกติกาความปลอดภัยร่วมกันคือ **ทดสอบกับเครื่องและฐานข้อมูลในเครื่องเท่านั้น**

| ชุดทดสอบ | อยู่ที่ | ทดสอบอะไร | อ่านต่อ |
|---|---|---|---|
| บอท UAT ในเครื่อง | `tests/uat/` | เปิดทุกเมนูแล้วจับ error (smoke) กับไล่งานจริงของแต่ละตำแหน่ง ตรวจทั้งหน้าจอ, API และฐานข้อมูล แล้วเขียนผลเป็นไฟล์ finding | [[sys-tests-uat-bots]] |
| Stagehand | `tests/stagehand/` | ให้ AI (DeepSeek) ขับเบราว์เซอร์ สำรวจปุ่มและทดสอบ CRUD ของหน้าจอ | [[sys-tests-stagehand-playwright-go]] |
| Playwright สคริปต์ย่อย | `tests/playwright/` | สคริปต์ตรวจหน้าจอเฉพาะจุดผ่าน Chrome ที่เปิดไว้ (CDP) | [[sys-tests-stagehand-playwright-go]] |
| Go test | `backend/internal/**`, `backend/test/` | ทดสอบ backend ทั้งแบบไม่ต้องใช้ฐานข้อมูล แบบต่อฐานข้อมูลจริง (ตั้ง env แล้วค่อยรัน) และแบบ integration ด้วย Docker | [[sys-tests-stagehand-playwright-go]] |
| คู่มือทดสอบด้วยมือ | `testscript/stock.md` | แนวทางทดสอบ E2E ระบบสินค้าหลายหน่วยนับ ในมุมผู้ใช้คนไทย | [[sys-tests-stagehand-playwright-go]] |

โฟลเดอร์ `frontend/e2e/` มีอยู่แต่ว่างเปล่า และ `frontend/package.json` มีเพียง script `lint` กับ `prebuild` ไม่มี script `test` (`frontend/package.json:9-10`) ฝั่งหน้าเว็บจึงไม่มี unit test ในโปรเจกต์นี้ การตรวจหน้าเว็บทั้งหมดทำผ่านชุด E2E ข้างต้น

## แยกให้ออกจาก "ระบบ UAT"

`tests/uat/` เป็นสคริปต์ที่นักพัฒนารันเอง ผลลัพธ์เป็นไฟล์ในโฟลเดอร์ `out/` ส่วนโฟลเดอร์ `uat/` ที่ราก (Tester Swarm และ Chaos Lab) เป็นแอปเว็บที่เปิด ticket เข้า IssueMate เอง ทั้งสองอย่างใช้แนวคิดเดียวกัน (เปิดหน้าจอจริง ตรวจ API และฐานข้อมูล) แต่เป็นคนละโค้ด ดู [[sys-uat-overview]] และ [[sys-uat-script-format-and-runner]]

## กติกาที่ทุกชุดทดสอบใช้ร่วมกัน

- **ล็อกให้ทำงานเฉพาะในเครื่อง** บอท UAT ปฏิเสธ URL ที่ไม่ใช่ `localhost`/`127.0.0.1` (`tests/uat/lib.mjs:15`) และตรวจว่าฐานข้อมูลเป็นเครื่องเดียวกันก่อนรัน SQL ส่วนสคริปต์ CRUD ของ Stagehand มีตัวป้องกันแบบเดียวกัน (`tests/stagehand/crud-item.mjs:12`)
- **ใช้โหมดเดโม** หน้าเว็บที่ถูกทดสอบรันด้วย env `FORCE_BCDEMO=1` ทุกคำขอจึงเป็นผู้ใช้เดโมที่ต่อฐาน `bcdemo` (`tests/uat/BRIEF.md:6`, `tests/stagehand/crud-item.mjs:3`)
- **ข้อมูลทดสอบติดป้าย** รหัสที่สร้างขึ้นต้น `UATB<NN>` และหมายเหตุมี `UAT-<วันที่>-B<NN>` เพื่อให้ตามเก็บ/ล้างได้ (`tests/uat/BRIEF.md:30`)
- **ตัวเลขเงินเทียบแบบ numeric จากฐานข้อมูล** ไม่ใช้ทศนิยมของ JavaScript (`tests/uat/BRIEF.md:52`)
- **ห้ามกดปุ่มอันตราย** เช่น ปิดงวด ปิดปี ส่ง e-Tax สคริปต์เปิดหน้าจอดูอย่างเดียว (`tests/uat/BRIEF.md:33`) และสคริปต์สำรวจปุ่มของ Stagehand ข้ามปุ่มที่บันทึก/ยืนยัน/อัปโหลด/ออกจากระบบ (`tests/stagehand/explore-buttons.mjs:21`)
- **ผู้ทดสอบรายงานอย่างเดียว ไม่แก้โค้ด** บอทแต่ละตัวเขียน finding ระดับ S1-S4 แล้วจบ

## วัดความครอบคลุมเมนู

`tests/uat/smoke-all.mjs` ไล่เปิดทุกเมนูใบที่มองเห็นใน `frontend/src/config/bcMenu.json` แล้วเขียนผลหนึ่งบรรทัดต่อเมนูลง `smoke.jsonl` เพื่อให้ตัวเลขความครอบคลุมมาจากการวัดจริง (ข้อความในไฟล์ระบุว่าบอท B01-B11 บันทึกเฉพาะที่ผิด) รันซ้ำแล้วข้ามเมนูที่ผ่านแล้ว และแบ่งงานเป็นหลายส่วนได้ด้วย `UAT_SHARD=1/4` (`tests/uat/smoke-all.mjs:1-29`)

## คำสั่งที่ใช้บ่อย

```
# Go: unit test ทั้ง backend (ฝั่งที่ต้องใช้ฐานข้อมูลจะถูกข้ามถ้าไม่ได้ตั้ง env)
npm run backend:test            # = cd backend && go test ./internal/...

# Go: integration (ต้องมี Docker)
cd backend && make test-integration

# บอท UAT: เปิดทุกเมนู
UAT_RUN_ID=<YYYYMMDD> node tests/uat/smoke-all.mjs

# Stagehand: สำรวจปุ่ม (ต้องตั้ง env DEEPSEEK_API_KEY)
cd tests/stagehand && npm run explore
```

## ข้อจำกัด

- script ที่รากมีเฉพาะ `backend:test` และ `lint` (`package.json:6-13`) ไม่มีคำสั่งรวมสำหรับชุด E2E ผู้รันต้องเปิดเว็บ, Go API และฐานข้อมูลเดโมไว้ก่อนเอง
- `tests/playwright/package.json` มีเพียงสคริปต์ `test` ตัวอย่างที่ตั้งให้ล้มเหลว (`:6-8`) ใช้ `npm test` ไม่ได้ ต้องรันไฟล์ `.mjs` โดยตรง
- ชุดทดสอบ Go ที่ต่อฐานข้อมูลจริงถูกข้ามอัตโนมัติเมื่อไม่ได้ตั้ง env ผลผ่านจึงไม่ได้แปลว่าทดสอบส่วนนั้นแล้ว

## ที่มาในโค้ด
- `package.json:11-12` script `backend:build` และ `backend:test` (`go test ./internal/...`) ที่ราก
- `backend/Makefile:24-32` `make test` กับ `make test-integration` (แท็ก `integration`, ต้องมี Docker)
- `tests/uat/lib.mjs:15` ล็อกเฉพาะเครื่อง, `:187` `smoke` เป็นด่านตรวจเมนูกลาง
- `tests/uat/smoke-all.mjs:1-29` วัดความครอบคลุมเมนูและแบ่ง shard
- `tests/stagehand/package.json:11-18` script ทั้งหมดของ Stagehand
- `tests/playwright/package.json:6` สคริปต์ `test` ตัวอย่าง
- `testscript/stock.md:1` คู่มือทดสอบหลายหน่วยนับ
- ดูเพิ่ม: [[sys-tests-uat-bots]] · [[sys-tests-stagehand-playwright-go]] · [[sys-uat-overview]] · [[sys-scripts-overview]] · [[sys-ai-overview]]
