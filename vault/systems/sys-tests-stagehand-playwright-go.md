---
title: "Stagehand, Playwright และ Go test: ทดสอบด้วย AI, สคริปต์ตรวจหน้าจอ และชุดทดสอบ backend"
tags: [systems, tests, stagehand, playwright, go-test, postgres]
aliases: ["tests/stagehand", "tests/playwright", "Stagehand", "go test", "make test-integration", "testcontainers", "testscript/stock.md", "deepseek-llm.mjs", "ทดสอบหลายหน่วยนับ"]
sources: ["tests/stagehand/package.json:6", "tests/stagehand/package.json:11", "tests/stagehand/package.json:18", "tests/stagehand/browser.mjs:1", "tests/stagehand/browser.mjs:86", "tests/stagehand/deepseek-llm.mjs:6", "tests/stagehand/deepseek-llm.mjs:17", "tests/stagehand/deepseek-llm.mjs:43", "tests/stagehand/explore-buttons.mjs:1", "tests/stagehand/explore-buttons.mjs:21", "tests/stagehand/crud-item.mjs:1", "tests/stagehand/crud-item.mjs:12", "tests/stagehand/item-screen.mjs:1", "tests/stagehand/launch-visible-chrome.ps1:1", "tests/playwright/package.json:6", "tests/playwright/watch-playwright.ps1:1", "tests/playwright/test-1-1.mjs:5", "tests/playwright/test-full-crud.mjs:7", "package.json:12", "backend/Makefile:24", "backend/Makefile:31", "backend/test/identity_integration_test.go:1", "backend/test/blob_integration_test.go:1", "backend/internal/application/process/barcode_discount_test.go:122", "backend/internal/application/process/doc_flow_test.go:145", "backend/internal/adapter/inbound/http/pos_http_e2e_test.go:79", "backend/internal/application/process/report_engine_test.go:45", "backend/internal/adapter/inbound/http/ai/context_sales_ar_test.go:57", "backend/internal/application/process/ai_copilot_test.go:9", "testscript/stock.md:1"]
---
# Stagehand, Playwright และ Go test

บันทึกนี้อธิบายชุดทดสอบที่เหลือจาก [[sys-tests-uat-bots]] ได้แก่ สคริปต์ที่ให้ AI ขับเบราว์เซอร์ (Stagehand) สคริปต์ Playwright ตรวจเฉพาะจุด ชุด Go test ของ backend และคู่มือทดสอบด้วยมือ ภาพรวมทั้งหมดอยู่ที่ [[sys-tests-overview]]

## Stagehand (tests/stagehand)

แพ็กเกจแยก `bcaiaccount-stagehand` ใช้ Stagehand v4 (`@browserbasehq/stagehand` ^4.3.0) กับ `zod` ต้องใช้ Node 22.18 ขึ้นไป (`package.json:7-9`, `:20-22`) สคริปต์ให้โมเดลภาษาสั่งเบราว์เซอร์ทีละขั้น (act / observe / extract) เหมาะกับการสำรวจหน้าจอที่ยังไม่มีสคริปต์ตายตัว

| คำสั่ง `npm run` | ไฟล์ | ทำอะไร |
|---|---|---|
| `smoke` | `smoke.mjs` | ทดสอบเบื้องต้นว่า Chrome + Stagehand + DeepSeek ทำงานกับเว็บในเครื่องได้ (ไม่ชี้ไปเว็บบนอินเทอร์เน็ต) |
| `item` | `item-screen.mjs` | หน้าจอข้อมูลสินค้า (เมนู `menu_ic_item_detail`) แบบอ่านอย่างเดียว เลือกสินค้าแถวแรก เปิดทุกแท็บ แล้วรายงานสิ่งผิดปกติ |
| `explore` | `explore-buttons.mjs` | คลิกทุกปุ่มบนหน้าจอเดียว ไม่บันทึกและไม่ลบ: `confirm()` ตอบยกเลิกเสมอ ปุ่มที่ตรง regex `DENY` ถูกข้าม โมดัลปิดอย่างเดียว และโหลดหน้าใหม่ทิ้งสถานะแก้ไข |
| `crud` | `crud-item.mjs` | เพิ่ม แก้ ลบสินค้าชั่วคราวหนึ่งรายการ ตรวจทุกขั้นทั้งบนหน้าจอ (ข้อความในกล่องโต้ตอบ) และใน PostgreSQL ปฏิเสธถ้า URL ไม่ใช่ localhost |
| `audit-1-1`, `crud-1-1`, `exhaustive-1-1`, `sec1-rem` | `audit-section-1-1.mjs`, `crud-and-buttons-1-1.mjs`, `exhaustive-test-1-1.mjs`, `test-section-1-remaining.mjs` | ชุดสคริปต์ตรวจรายหมวดของเมนู (ตามเลขหมวดในชื่อไฟล์) ใช้ตัวช่วยเปิดเบราว์เซอร์ตัวเดียวกัน |

นอกจากนี้มี `test-doc-form-ai-white-paper.mjs` และ `test-form-designer-1-9.mjs` สำหรับหน้าออกแบบฟอร์มเอกสาร และสคริปต์ย่อย `check-*`, `inspect-*`, `fix-*` ที่เป็นเครื่องมือค้นหาปัญหาเฉพาะกิจ

### ตั้งค่าและตัวช่วย

- **env** ที่สคริปต์อ่าน: `STAGEHAND_BASE_URL` (ค่าเริ่มต้นเป็นเว็บในเครื่อง), `STAGEHAND_HEADLESS=0` (เปิดหน้าต่างให้ดู), `STAGEHAND_MENU` (เมนูเป้าหมายของ `explore`), `STAGEHAND_OUT` (โฟลเดอร์ผลลัพธ์, ค่าเริ่มต้นอยู่ใต้ `out/`), `STAGEHAND_CDP_URL` (เกาะ Chrome ที่เปิดอยู่แล้ว) และคีย์โมเดลใน env `DEEPSEEK_API_KEY` (ห้ามเก็บในไฟล์ที่ commit) scripts โหลด env ผ่านตัวเลือก `--env-file-if-exists` ของ Node
- เว็บที่ถูกทดสอบต้องรันด้วย `FORCE_BCDEMO=1` (เป็นผู้ใช้เดโม) และ backend ต่อฐานข้อมูลในเครื่อง (`crud-item.mjs:3`)
- `browser.mjs` เลือกวิธีเปิดเบราว์เซอร์: ถ้าตั้ง `STAGEHAND_CDP_URL` หรือมี Chrome เปิดพอร์ตดีบักค้างอยู่ จะเกาะ Chrome ตัวนั้นผ่านพร็อกซีที่ตัดหัว `Origin` ออก (เพื่อให้ Chrome ที่ไม่ได้เปิด `--remote-allow-origins=*` ยังเชื่อมได้) ไม่เช่นนั้นเปิด Chrome ส่วนตัวของตัวเอง (`browser.mjs:1-4`, `:86-101`)
- `launch-visible-chrome.ps1` เปิด Chrome ที่มีพอร์ต CDP บนเดสก์ท็อปของผู้ใช้ เพื่อให้มองเห็นการทำงาน เพราะ shell ของ AI รันบนเดสก์ท็อปที่มองไม่เห็น (`launch-visible-chrome.ps1:1-4`) แล้วรันสคริปต์ด้วย `STAGEHAND_CDP_URL` ชี้มาที่หน้าต่างนั้น
- `deepseek-llm.mjs` คืออะแดปเตอร์โมเดลที่ผู้ใช้นำมาเอง (BYO-LLM) ให้ Stagehand เรียก DeepSeek ได้ รุ่นเริ่มต้น `deepseek-flash` เปลี่ยนด้วย `DEEPSEEK_MODEL` และ `DEEPSEEK_BASE_URL` (`:6-7`) **รองรับเฉพาะข้อความ** ถ้าสคริปต์ขอส่งภาพจะโยน error ชัดเจนแทนการทิ้งภาพเงียบๆ (`:17-18`) และปิดโหมดคิดเพื่อให้แต่ละคำสั่งเร็วและถูก (`:58`)

## Playwright สคริปต์ย่อย (tests/playwright)

โฟลเดอร์นี้ไม่ใช่ชุดทดสอบแบบ `playwright test` สคริปต์ `npm test` ในแพ็กเกจเป็นข้อความตัวอย่างที่ตั้งให้ล้มเหลว (`package.json:6-8`) ที่ใช้งานจริงคือไฟล์ `.mjs` เดี่ยวที่รันด้วย `node`:

- `test-1-1.mjs`, `test-crud-1-1.mjs`, `test-1-1-7-new.mjs`, `test-full-crud.mjs` ทดสอบหน้าจอและ CRUD โดยเชื่อม Chrome ที่เปิดอยู่ผ่าน CDP (env `CDP_URL`, `BASE_URL`) และเก็บภาพหน้าจอใน `out/`
- `test-full-crud.mjs` ตรวจผลใน PostgreSQL ด้วย psql โดยอ่านการเชื่อมต่อจากไฟล์ตั้งค่า backend `backend/configs/BCConfigbcdemo.json` ตอนรัน
- `check-*.mjs`, `inspect-*.mjs`, `find-tabs.mjs` เป็นสคริปต์ตรวจเฉพาะกิจ (โครงสร้างตาราง แท็บ เมนู POS ฯลฯ)
- `watch-playwright.ps1` เปิด Chrome ให้มองเห็นผ่าน `../stagehand/launch-visible-chrome.ps1` รอให้พอร์ต CDP พร้อม ตั้ง `CDP_URL` / `BASE_URL` แล้วรัน `test-1-1.mjs` (`watch-playwright.ps1:1-40`)
- แพ็กเกจ Playwright ในโฟลเดอร์นี้ถูก `tests/uat/lib.mjs` นำเข้าไปใช้ด้วย (`lib.mjs:5`) จึงต้องติดตั้งก่อนรันบอท UAT

## Go test (backend)

ไฟล์ทดสอบ Go ราว 117 ไฟล์ใต้ `backend/internal` (89 ไฟล์อยู่ใน `application/process`) กับอีก 2 ไฟล์ใน `backend/test` แบ่งเป็น 3 ชนิด:

| ชนิด | ตัวอย่าง | วิธีรัน |
|---|---|---|
| unit test ไม่ต้องใช้ฐานข้อมูล | `ai_copilot_test.go` ทดสอบตัวตรวจ SQL ที่อ่านอย่างเดียวของผู้ช่วย AI (`TestValidateReadOnlySelectSQL`, `:9`) ดู [[proc-ai-copilot]] | `npm run backend:test` (`go test ./internal/...`, `package.json:12`) |
| ต่อฐานข้อมูลจริง (ถูกข้ามถ้าไม่ตั้ง env) | `barcode_discount_test.go`, `doc_flow_test.go`, `pos_http_e2e_test.go`, `report_engine_test.go` | ตั้ง env แล้วรันคำสั่งเดียวกัน |
| integration ด้วย Docker | `backend/test/identity_integration_test.go`, `blob_integration_test.go` | `cd backend && make test-integration` |

**ชนิดที่ต่อฐานข้อมูลจริง** เรียก `t.Skip` เมื่อ env ไม่ครบ เช่น `TRANS_IT_DB` (ฐานบริษัทสำหรับทดสอบ, ใช้ใน `barcode_discount_test.go:127`), `DOCFLOW_IT_DB` (`doc_flow_test.go:145`), `POS_IT_DB` และ `S3_ENDPOINT` (`pos_http_e2e_test.go:79-84`), `BC_TEST_PG_DSN` (`report_engine_test.go:45`), `AI_TEST_PG_DSN` (`context_sales_ar_test.go:57-61`) ตัวแปรอื่นในรูปแบบเดียวกันคือ `GLIT_DB`, `HOLD_IT_DB`, `PROVINCE_IT_DB`, `SAVE_RULES_IT_DB`, `SERIAL_IT_DB`, `TAXDOC_IT_DB` และ `IC_DUMP_SQL`/`SOPO_DUMP_SQL` (สั่งให้เขียน SQL ที่รายงานสร้างลงโฟลเดอร์เพื่อตรวจ) การเชื่อมใช้ `PGHOST`/`PGPORT`/`PGUSER`/`PGPASSWORD` ตามคอมเมนต์ในไฟล์ทดสอบ (ค่าอยู่ใน env ของผู้รัน) บางชุด เช่นชุดส่วนลดบาร์โค้ด เขียนข้อมูลแล้ว rollback ท้ายการทดสอบ (`barcode_discount_test.go:122`) ผลที่ "ผ่าน" โดยไม่ได้ตั้ง env จึงไม่ได้พิสูจน์ส่วนนั้น

**ชนิด integration** มี build tag `//go:build integration` จึงไม่ถูกรวมใน `go test ./...` ใช้ Postgres จริงผ่าน testcontainers-go ต่อกับ composition root จริง (`internal/di`) ไม่ใช้ของปลอม ต้องมี Docker (`backend/Makefile:28-32`, `backend/test/identity_integration_test.go:1-9`) ชุดนี้ครอบคลุมบริบท identity (เข้าสู่ระบบ เลือกบริษัท รีเฟรช ออกจากระบบ โปรไฟล์) และ blob insert (`POST /blob/insert`) โครงตารางทดสอบอยู่ใน `backend/test/testdata/`

## คู่มือทดสอบด้วยมือ: testscript/stock.md

เอกสารภาษาไทยที่กำหนดให้ทดสอบแบบ E2E ในมุมผู้ใช้คนไทย เรื่องสินค้าหลายหน่วยนับ มีใจความ:

- **หน่วยต้นทุน** คือหน่วยที่ระบบใช้คำนวณต้นทุนของสินค้านั้น เมื่อมีรายการซื้อขายแล้วห้ามเปลี่ยน
- การแปลงหน่วยต้องตั้งเป็น **การหาร** เสมอ
- สินค้าตัวอย่าง: บะหมี่กึ่งสำเร็จรูป (ห่อ / โหล / กล่อง) ที่ต้องแสดงยอดแบบทอนหน่วย และกระเบื้อง (เก็บเป็นกล่อง ขายเป็นตารางเมตร ต้องแปลงกลับได้)
- ขอบเขตทดสอบ 3 ฝั่ง: ซื้อ (รับของเข้าเป็นหน่วยใหญ่), ขาย (ขายหลายหน่วย), สต็อก (ตรวจนับ ดูแบบทอนหน่วย และเทียบรายงานสต็อกการ์ดกับยอดคงเหลือ) แล้วส่งผลต่อให้เครื่องมือ UAT ตรวจซ้ำ ดู [[sys-uat-overview]]

## ที่มาในโค้ด
- `tests/stagehand/package.json:7-22` เวอร์ชัน Node, script ทั้งหมด (`:11-18`) และ dependency
- `tests/stagehand/browser.mjs:1-4` ลำดับการเลือกเบราว์เซอร์, `:86-101` ตัวแปร env ที่เกี่ยวข้อง
- `tests/stagehand/deepseek-llm.mjs:6-7` โมเดลเริ่มต้น, `:17-18` ไม่รองรับภาพ, `:43-45` อ่านคีย์จาก env
- `tests/stagehand/explore-buttons.mjs:1-6` กติกาไม่บันทึก/ไม่ลบ, `:21` รายการปุ่มต้องห้าม
- `tests/stagehand/crud-item.mjs:1-3` ขั้นตอน CRUD, `:12` ล็อกเฉพาะเครื่อง
- `tests/playwright/package.json:6` สคริปต์ตัวอย่าง, `tests/playwright/watch-playwright.ps1:1-40` เปิด Chrome ที่เห็นได้และรันทดสอบ
- `backend/Makefile:24-32` คำสั่ง test และ test-integration, `package.json:12` `backend:test`
- `backend/test/identity_integration_test.go:1-9`, `backend/test/blob_integration_test.go:1-12` ชุด integration
- `testscript/stock.md:1-46` คู่มือทดสอบหลายหน่วยนับ
- ดูเพิ่ม: [[sys-tests-overview]] · [[sys-tests-uat-bots]] · [[sys-uat-overview]] · [[proc-ai-copilot]] · [[sys-ai-overview]]
