---
title: "สถานะ Parity กับ BCCM ตามเอกสาร (BCCM Parity Status)"
tags: [history, parity, bccm]
aliases: ["parity BCCM", "100% clone", "bccm_parity_report", "blueprint extractor"]
sources: ["docs/bccm_parity_report.json", "scripts/extract-bccm-blueprint.mjs:155-202", "scripts/extract-bccm-blueprint.mjs:599", "docs/HANDOFF_BCCM_PARITY_2026-10-22.md", "docs/HANDOFF_CLAUDE_CODE_100_CLONE.md", "docs/HANDOFF_CLAUDE_CODE_AUDIT.md", "git:58fe0ccf", "git:a087ff10", "git:62c7098f"]
---

## ภาพรวม

โน้ตนี้สรุปว่าเอกสาร parity ใน repo บอกอะไรเกี่ยวกับความครบของการพอร์ต BCCM (C# WinForms) มาเป็น BC Ai Account (Go + Next.js) และแยกให้เห็นว่าตัวเลขไหน **นับจริงจากต้นฉบับ** ตัวไหน **เป็นข้อความที่เขียนตายตัวในสคริปต์** อย่าอ่านสถานะ "100%" เป็นผลตรวจจริงของทุกส่วน

ภาพรวมที่เอกสารรายงาน:
- โครงสร้าง (เมนู ตาราง ฟิลด์ ภาษา lookup view) ถูกสกัดจากต้นฉบับและเทียบครบ
- พฤติกรรม (event handler, สูตร SQL, report) ยังต้องตรวจเจาะรายมิติต่อ — เอกสาร `HANDOFF_CLAUDE_CODE_100_CLONE.md` ระบุเองว่าเป็นงานรอบถัดไป
- ประวัติการแก้จริงอยู่ในโน้ต UAT/บั๊กของหมวดนี้ ดู [[history-overview]]

## ตัวเลขใน `docs/bccm_parity_report.json`

รายงานสร้างเมื่อ 2026-10-22T06:09Z และถูกอัปเดตล่าสุดโดย commit `58fe0ccf` ("update bccm_parity_report.json after parity merge"):

| หัวข้อ | ค่า | ที่มา |
|---|---|---|
| เมนูใบ (leaf menu) | 708 | `totalLeafMenus` |
| ตารางใน bcdatabase | 520 | `xmlMetadataStats.bcdatabaseTables` |
| หน้าจอ lookup view (bcerpview) | 180 | `xmlMetadataStats.bcerpviewScreens` |
| รายการภาษา | 5,145 | `xmlMetadataStats.bclanguageEntries` |
| ไฟล์ backend C# | 220 | `backendStats.csBackendFilesCount` |
| เมธอด backend C# | 669 | `backendStats.csBackendMethodsCount` |
| ไฟล์ process ของ Go | 100 | `backendStats.goProcessFilesCount` |
| เมธอด Go | 1,327 | `backendStats.goBackendMethodsCount` |
| ฟิลด์ master ที่ไม่ตรง | 0 | `masterScreenFieldDiscrepanciesCount` |

การแบ่งตามตัวจัดการหน้าเว็บ (`byWebHandler`) รวมกันได้ 708 = 66 + 80 + 19 + 390 + 153 (ชื่อตัวจัดการอ่านได้จากไฟล์ JSON โดยตรง)

ข้อควรระวังเรื่องตัวเลข: `HANDOFF_CLAUDE_CODE_100_CLONE.md` ข้อ 1.1 อ้าง "756 Go functions" เทียบกับ 669 เมธอด C# ขณะที่รายงาน JSON นับได้ 1,327 เมธอด — ตัวนับสองชุดใช้เกณฑ์ต่างกัน ห้ามเอามาเทียบกันตรงๆ และเอกสารไม่ได้อธิบายเกณฑ์

## สิ่งที่ "คำนวณจริง" กับ "เขียนตายตัว"

- **สถานะ 8 โดเมน backend = "100% Ported & Verified" เป็นสตริงที่เขียนตายตัว** ใน `scripts/extract-bccm-blueprint.mjs:155-202` (อาร์เรย์ `backendDomainMapping`) ไม่ใช่ผลการเทียบอัตโนมัติ รันสคริปต์ซ้ำกี่ครั้งก็ได้ข้อความเดิม
- **ตรวจฟิลด์ที่ไม่ตรงคำนวณจริงเฉพาะหน้าที่ใช้ `StandardMasterScreen`** (80 จาก 708 เมนู) โดยเทียบชุดฟิลด์ C# กับ schema ฝั่งเว็บ ที่ `scripts/extract-bccm-blueprint.mjs:599` ดังนั้น `masterScreenFieldDiscrepanciesCount = 0` แปลว่า 80 หน้ามาสเตอร์ไม่มีฟิลด์ขาด/เกิน ไม่ได้แปลว่าอีก 628 เมนูผ่านการเทียบ
- หน้าที่เป็น `UniversalTransScreen` และตัวจัดการอื่นถูกจัดกลุ่มตามชื่อตัวจัดการเท่านั้น ไม่มีการเทียบพฤติกรรมในสคริปต์

บทเรียน: รายงาน parity นี้เป็นหลักฐานเรื่อง "โครงสร้างครบ" ไม่ใช่หลักฐานเรื่อง "พฤติกรรมเหมือน C#" — ส่วนหลังต้องมี UAT และ test จริง ซึ่งเป็นที่มาของรอบ R3a–R3g ใน [[history-overview]]

## `HANDOFF_CLAUDE_CODE_100_CLONE.md` (สถานะ + โจทย์ถัดไป)

ข้อ 1 (สิ่งที่ทำเสร็จ) ระบุว่าตัวสกัด blueprint อ่านต้นฉบับ 5,012 ไฟล์ (4,146 คลาส C#), 520 ตาราง/9,988 คอลัมน์, 180 lookup view และ 669 เมธอด backend — ตัวเลขเหล่านี้เป็นการนับจากต้นฉบับ

ข้อ 2 ตั้งโจทย์ตรวจเจาะลึก 5 มิติที่ยังเหลือ:
1. C# event handler และกฎหน้าจอแบบ dynamic (`_textBoxChanged`, `_gridCellChanged`, `_checkDataBeforeSave` ฯลฯ)
2. SQL/สูตรคำนวณใน backend (`Java\_routine.cs`, `BCGetPrice\_routine.cs`, `BCProcess\*.cs`)
3. การย้ายเป็น thin-client ฝั่งเว็บ (ตามกฎใน `AGENTS.md`)
4. lookup view และคอลัมน์ grid
5. SQL ของรายงานและหน้าเงื่อนไข (`BCERP*Report`)

ผลของโจทย์นี้กระจายอยู่ในโน้ตบทเรียน เช่น [[hist-lessons-trans-save-rules]], [[hist-lessons-report-engine-parity]], [[hist-lessons-grid-ux-regressions]]

## `HANDOFF_BCCM_PARITY_2026-10-22.md` (ส่งมอบ ณ 22 ต.ค.)

- ข้อ 1-2: โค้ดอยู่ branch `integ-bccm-parity` ที่ commit `d19d369` ผ่าน `go build`/`go vet`/`go test`, `tsc --noEmit` สะอาด, node tests 25/25 ต่อมาถูก merge เข้า main ด้วย `62c7098f` (ดูเอกสาร commit `a087ff10` ที่เป็นตัวเอกสารส่งมอบ)
- ข้อ 3: UAT r3b หยุดกลางทาง — พื้นที่ regression จบแล้ว 0 บั๊กจาก 64 เคส, r3f-trans-gl พบ B1 (บันทึกพร้อมกัน ~10 ใบที่มีสินค้าเดียวกันได้ HTTP 400 จาก deadlock) ซึ่งภายหลังแก้ใน commit `4341ae81` ดู [[hist-lessons-concurrency-advisory-locks]]; 6 พื้นที่ถูกหยุดต้องรันใหม่; พื้นที่ options (erp_option เปิด) ยังไม่เริ่ม
- ข้อ 6: งานเหลือเรียงลำดับ (UAT ต่อ → จัดกลุ่มบั๊กตาม root cause → merge → รัน extractor แล้ว commit report → ลบ worktree → deploy)
- ข้อ 7: รวม decisions ที่เลือกแล้ว (R3d/R3e/R3f/R3g) และรายการ "จงใจต่างจาก C#" ที่ต้องใส่รายงาน — เช่น REF30 เป็นการเปลี่ยน contract แบบ R1 ที่เพิ่มฟิลด์ใน `TransLine`
- ข้อ 8: open items ที่รายงานไว้แต่ยังไม่ทำ — ตรวจเทียบโค้ดปัจจุบันแล้วใน [[hist-todo-open-items]]

## `HANDOFF_CLAUDE_CODE_AUDIT.md`

เอกสารส่งงานรอบ audit: ข้อ 1 กฎเหล็กที่ต้องยึด, ข้อ 2 สิ่งที่แก้และ deploy ไปแล้วในรอบแรก, ข้อ 3 โจทย์ตรวจหน้าจอที่ยังอาจ "แปลก/ซ้ำ/ไม่ครบ" (ข้อ 3.1), ข้อ 4 วิธี deploy และทดสอบบนเซิร์ฟเวอร์เดโม (เอกสารระบุชื่อโฮสต์ ไม่คัดลอกมาที่นี่)

## วิธีอ่านสถานะ parity อย่างปลอดภัย

- ตัวเลขนับ (เมนู ตาราง คอลัมน์ ภาษา) เชื่อได้ในระดับ "สกัดจากต้นฉบับ" แต่ตัวเลขเมธอด Go/C# ใช้เกณฑ์ต่างกัน
- สถานะ "100% Ported & Verified" รายโดเมน ไม่ใช่หลักฐาน ให้ดูโน้ตบทเรียนและ UAT แทน
- รายงาน JSON ถูกสร้างวันที่ 22 ต.ค. หลังจากนั้นยังมี commit อีกหลายวัน (UAT รอบ 3 และ S1 เมื่อ 29 ต.ค.) จำนวนเมนูปัจจุบันอาจต่างจาก 708 — ต้องรัน extractor ใหม่ถ้าต้องการตัวเลขล่าสุด (ยังไม่ได้รัน เพราะ repo ต้นทางอ่านอย่างเดียว)
- กติกาพอร์ตหน้าจอ: [[std-csharp-screen-porting]], ภาพรวมมาตรฐาน: [[standards-overview]]

## ที่มาในโค้ด

- `docs/bccm_parity_report.json` — ตัวเลขรวมและ `byWebHandler` (commit `58fe0ccf`)
- `scripts/extract-bccm-blueprint.mjs:155-202` — `backendDomainMapping` และสถานะตายตัว
- `scripts/extract-bccm-blueprint.mjs:599` — เงื่อนไขตรวจฟิลด์เฉพาะ `StandardMasterScreen`
- `scripts/extract-bccm-blueprint.mjs:680-681` — ผลลง `masterScreenFieldDiscrepancies`
- `docs/HANDOFF_BCCM_PARITY_2026-10-22.md` — ข้อ 1-3, 6-8
- `docs/HANDOFF_CLAUDE_CODE_100_CLONE.md` — ข้อ 1.1 และ 2
- `docs/HANDOFF_CLAUDE_CODE_AUDIT.md` — ข้อ 1-4
