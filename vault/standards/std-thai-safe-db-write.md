---
title: "เขียนข้อมูลไทยลง PostgreSQL ไม่ให้เป็น ???? (Thai-Safe DB Write)"
tags: [standards, postgres, thai, seed, encoding, uat]
aliases: ["thai-safe-db-write", "ไทยกลายเป็น ????", "seed ภาษาไทย", "PowerShell 5.1 OutputEncoding", "octet_length char_length", "กู้ข้อมูล ????", "UTF-8 BOM ps1", "psql stdin"]
sources: [".agents/skills/thai-safe-db-write/SKILL.md:6-9", ".agents/skills/thai-safe-db-write/SKILL.md:11-26", ".agents/skills/thai-safe-db-write/SKILL.md:27-40", ".agents/skills/thai-safe-db-write/SKILL.md:42-47", ".agents/skills/thai-safe-db-write/SKILL.md:49-53", ".agents/skills/thai-safe-db-write/SKILL.md:55-69", "AGENTS.md:48"]
---

# เขียนข้อมูลไทยลง PostgreSQL ไม่ให้เป็น `????`

Skill `thai-safe-db-write` เกิดจากเหตุที่ข้อมูลทดสอบ POS/UAT ถูก seed ผ่าน PowerShell here-string แล้วชื่อสินค้า หน่วยนับ ชื่อผู้ใช้ หมายเหตุเอกสาร ชื่อภาษี และ log กลายเป็น `?` ถาวร จนหลุดไปถึงหน้าจอเดโมและติดไปกับทุกฐานที่ clone ต่อ (`SKILL.md:9`) ใช้ทุกครั้งที่ seed/insert/update ข้อมูลทดสอบหรือเดโมผ่าน shell บน Windows (`SKILL.md:3`)

เกี่ยวกับกฎข้อ 7: มีเฉพาะแถว `UAT*` ใน `bcdemo` ที่แก้ได้ (`AGENTS.md:48`) — งาน seed ตามโน้ตนี้จึงต้องใช้รหัส `UAT-…` และฐานทดสอบเท่านั้น

## ลำดับที่ปลอดภัย (Workflow)
1. **เขียน SQL เป็นไฟล์ UTF-8 ไม่มี BOM แล้วส่งทาง stdin** (`psql … < seed.sql`) — ปลอดภัยที่สุด ใช้ได้ทั้งเครื่องและเซิร์ฟเวอร์ ใส่ `-v ON_ERROR_STOP=1` เสมอ (`SKILL.md:12-16`)
2. **PowerShell 5.1 ห้าม pipe SQL ไทยเข้า exe ตรงๆ** (`$sql | psql`, `@"…"@ | docker exec -i …`) เพราะ `$OutputEncoding` เริ่มต้นเป็น `us-ascii` — ถ้าจำเป็นต้องตั้ง `$OutputEncoding`, `[Console]::InputEncoding`, `[Console]::OutputEncoding` เป็น `UTF8Encoding $false` ก่อนในคำสั่งเดียวกัน (`SKILL.md:17-20`)
3. **ไฟล์ `.ps1` ที่มีภาษาไทยต้องเป็น UTF-8 with BOM** เพราะ PowerShell 5.1 อ่านไฟล์ไม่มี BOM เป็น ANSI แล้ว parse error (`SKILL.md:21`)
4. **ตรวจทันทีหลังเขียน** ห้ามดูแค่ `INSERT 0 1` — ไทย 1 ตัวใน UTF-8 = 3 ไบต์ ถ้า `octet_length(col) = char_length(col)` แปลว่าไทยหายแล้ว (`SKILL.md:22-26`)
5. **ก่อนจบงาน seed สแกนทั้งฐาน ต้องได้ 0 แถว**: query วนทุกคอลัมน์ชนิด `character varying`/`text`/`character` ของตารางจริงใน schema `public` นับค่าที่ตรง `[?]{3,}` (`SKILL.md:27-40`)

## ผลทดสอบของวิธีส่ง (ค่าที่ถูกของ `octet_length('ทดสอบ')` = 15, `SKILL.md:55-65`)
| วิธีส่ง | ผล |
|---|---|
| PowerShell 5.1 pipe เข้า `docker exec -i … psql` (ค่าเริ่มต้น) | 5 (ไทยกลายเป็น `?`) |
| PowerShell 5.1 หลังตั้ง `$OutputEncoding` UTF-8 | 15 |
| PowerShell 5.1 `psql -c "…"` ในไฟล์ `.ps1` ที่มี BOM | 15 |
| PowerShell 5.1 ไฟล์ `.ps1` ไม่มี BOM | parse error |
| Git Bash `psql < file.sql` หรือ `psql -c` | 15 |
| Node `spawnSync("docker", […], { input: sql })` | 15 |

## กู้ข้อมูลที่เป็น `????` แล้ว (`SKILL.md:42-47`)
- จำนวน `?` เท่ากับจำนวนตัวอักษรไทยเดิม (สระ/วรรณยุกต์นับเป็น 1 ตัว) ใช้เทียบความถูกต้องของค่าที่หามาได้
- หาค่าที่ถูกต้องตามลำดับ: ตาราง master ในฐานเดียวกัน (เช่น `ic_inventory.name_1` → `ic_trans_detail.item_name`, `ap_supplier.name_1` → `gl_journal_vat_buy.ap_name`) → log ของ AI ที่ seed ไว้ → ฐานอื่นที่ seed ด้วยวิธีที่ไม่เสีย
- ถ้าเสียที่ **รหัส** (เช่น รหัสหน่วยนับ) ต้องแก้ทุกตารางที่อ้างพร้อมกันใน transaction เดียว — skill ระบุ `ic_inventory.unit_cost/unit_standard`, `ic_inventory_barcode.unit_code`, `ic_inventory_detail.start_*_unit`, `ic_unit_use.code`
- `UPDATE` ใส่ `and <col> ~ '[?]{3,}'` เสมอ ให้รันซ้ำได้และไม่ทับค่าที่ถูกอยู่แล้ว
- ค่าที่หาค่าที่ถูกต้องไม่ได้และต้องแต่งใหม่ → แจ้งลุงจืดว่าเป็นค่าอนุมาน ห้ามบอกว่า "กู้คืน"

## Config / Dependency (`SKILL.md:49-53`)
- รหัส DB อ่านจาก `backend/configs/BCConfigbcdemo.json` เข้าตัวแปรแล้วส่งด้วย `-e PGPASSWORD` — ห้ามพิมพ์ลงคำสั่ง แชท หรือ log (กฎข้อ 21)
- ต้องมี Docker container Postgres (ชื่อ container ของเครื่องและของเซิร์ฟเวอร์ดูใน skill) และ `psql` ภายใน container

## ข้อจำกัด (`SKILL.md:67-69`)
- ทดสอบเฉพาะ PowerShell 5.1, Git Bash และ Node บน Windows — ยังไม่ได้ทดสอบ PowerShell 7 ให้ใช้ไฟล์ + stdin ไปก่อน
- การสแกน `[?]{3,}` จับได้เฉพาะ `?` ติดกัน 3 ตัวขึ้นไป ข้อความไทย 1–2 ตัวที่เสียจะหลุด ต้องตรวจรายแถวตามข้อ 4

## หมายเหตุสถานะเอกสาร
Skill นี้ไม่อยู่ในตารางชี้เป้า Task → Skill → KMS ของ `AGENTS.md` (`:19-29`) และ `docs/kms/KMS_INDEX.md` จึงต้องเรียกใช้เองเมื่อเจองาน seed/ข้อมูลไทยเสีย ([[std-three-tier-knowledge-architecture]])

## ที่มา
- `.agents/skills/thai-safe-db-write/SKILL.md` (ทั้งไฟล์ 69 บรรทัด)
- `AGENTS.md` กฎข้อ 7

## ดูเพิ่ม
[[standards-overview]] · [[std-add-screen-workflow]] · [[std-data-integrity-money-transactions]] · [[std-repo-scope-rules]]
