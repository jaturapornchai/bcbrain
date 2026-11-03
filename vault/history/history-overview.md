---
title: "ประวัติและบทเรียนของระบบ BC Ai Account (History Overview)"
tags: [history, overview, timeline, moc]
aliases: ["ประวัติระบบ", "ไทม์ไลน์", "history hub", "บทเรียนทั้งหมด", "git timeline"]
sources: ["git:8bd921d1", "git:1ae4ac0c", "git:28307282", "git:5f188fc3", "git:62c7098f", "git:faa6e6d0", "git:6e9ae03e", "git:13f953cc", "git:75c8a5b6", "TODO.md", "docs/HANDOFF_BCCM_PARITY_2026-10-22.md", "docs/kms/KMS_SECURITY_DATA_INTEGRITY_LESSONS.md"]
---

# ประวัติและบทเรียนของระบบ BC Ai Account

หน้านี้คือศูนย์กลาง (hub) ของมิติ "ประวัติและบทเรียน": ระบบวิวัฒนาการอย่างไร และบั๊กหรือกับดักชนิดใดที่เจอซ้ำ สกัดจาก `git log` กับเอกสารส่งต่องาน (handoff) ทุกอย่างอ้าง SHA แบบ 8 ตัวอักษร และ `path:line` ของโค้ดปัจจุบัน

## ภาพรวม
- ประวัติใน git ทั้งหมดอยู่ในช่วงเดียว **19–29 ต.ค. 2026** (ไม่มี commit วันที่ 28) รวม 234 commit; ในนั้น **175 commit** แตะ `backend/` หรือ `frontend/account/` (ขอบเขตของมิตินี้)
- commit แรก `8bd921d1` (19 ต.ค.) รวม Go backend + Next.js 16 แบบแยกโมดูล + POS เข้า monorepo เดียว ส่วน `TODO.md` ถูกเพิ่มใน commit นี้และไม่เคยถูกแก้อีก จึงเป็นภาพนิ่งของยุค "เว็บพอร์ต + mock ข้อมูล" ก่อนมี Go backend จริง (ดู [[hist-todo-open-items]])
- จำนวน commit ที่แตะขอบเขตต่อวัน: 19=10, 20=12, 21=25, 22=45, 23=8, 24=33, 25=12, 26=17, 27=3, 29=10 (วันที่ 22 และ 24 หนักสุด)
- วันที่ใน log เป็น author date ตามลำดับ commit จริง บางช่วงเวลาไม่เรียงต่อเนื่อง (เช่น `a47413ec` 01:30 อยู่หลัง `6e9ae03e` 07:24 ของวันที่ 24)
- commit ที่อยู่นอกขอบเขต (59 ตัว เช่น Balloon Help, build stamp, AutoCare, form print ฝั่ง portal, เอกสาร KMS) ไม่เล่าที่นี่ ยกเว้นที่เป็นที่มาของบทเรียน เช่น `faa6e6d0` (ชุดแก้ความปลอดภัยฝั่ง `frontend/src`)

## ไทม์ไลน์ (ต.ค. 2026)

### 19 ต.ค. — รวมระบบ และไล่ปิด issue จาก GitHub เป็นก้อน
- `8bd921d1` รวม Go backend, frontend, POS เป็น monorepo
- `1ae4ac0c` ปิด issue #1–#35 (PO, C# parity) พร้อม watcher อ่าน issue อัตโนมัติ; `bc8d27d4` #36–#48 (AR); `866328e7` #49–#72 (IC layout); `bbf81811` #73–#91; `72d402f3` #92–#93 (ตรวจนับสต็อก/serial)
- `e7168c84` / `6983d7ea` รอบ audit r2: cancel/delete/VAT ตาม C#, คอลัมน์รูปเป็น bytea, partial cancel, ภาษี 19/239/1802, seed เฉพาะ `bcdemo`
- `2c273e19` บังคับสิทธิ์เมนู BC บน `/process`; `65dc0666` แท็บ VAT/WHT ในจอ 19/239/1802 → [[hist-lessons-permission-rights]], [[hist-lessons-vat-tax-mistakes]]

### 20 ต.ค. — พอร์ตเมนูและจอหลักให้ตรง C#
- `04fb2f9f` / `a352b60f` จอสินค้า 2.1.1 บันทึกผ่าน Go (`itemmaster`); `ebe66efd` rebuild `ic_serial` ตอนบันทึกสินค้า
- `a396c7b8`, `3aad0b1a`, `2c97aa3a`, `c201ca5a` ไล่ปรับเมนู 816 → 1,457 → 742 → 708 รายการให้ตรง BCCM และกำหนด trans_flag 276/801/802
- `360ff250` ครบ 26 จอในเมนู 1.1; `769fc3bb` คลัง/ที่เก็บ `ic_wh_shelf`; `6ba1a6d9` แก้ 401 token refresh และ auto stock adjust 2.19.6/2.19.7 → [[hist-lessons-master-save-preserve-columns]]

### 21 ต.ค. — ชุด BCCM parity และ "กฎ R-" ฝั่ง backend
- `28307282` ดึงพิมพ์เขียว (blueprint) C#/Java ทั้งชุดมาเทียบ → [[hist-parity-bccm]]
- ชุด `fix(bccm-parity)` 10 commit (`8698303f`…`a0b12158`): header default, price engine, AP/AR, stock rebuild/average cost, docflow, GL + ค่าเสื่อม, lookup, รายงาน
- `239b0997` ย้าย SQL เขียนฝั่ง frontend เข้า backend + ล็อกการเขียน `/query/exec` (`923fae86` ปรับเลข ADR เป็น 0011) → [[hist-lessons-query-gateway-write-lockdown]]
- ห้ากลุ่ม "R-": `5f188fc3` R-SAVE, `2a125c8e` R-CALC, `d51fcdd4` R-REPORT, `21bb411b` R-GRID-UI, `9f47a34c` R-LOOKUP → [[hist-lessons-trans-save-rules]], [[hist-lessons-rounding-decimal]]
- `7b6fe34b` พอร์ต GL template engine; `9e29f6df` ต้นทุนแฝง (flag 66) → [[hist-lessons-gl-posting-balance]], [[hist-lessons-stock-cost-moving-average]]

### 22 ต.ค. — วันที่หนักสุด: คลื่น R3 และปิดรอบ parity
- รอบ R3: FX (`ee422543`), price center (`26c7af0d`), pay tab (`d1ebfe18`), `find_lot_auto` + credit approval (`b002e065`), set items (`054c6063`), `perm_wh_shelf` (`1b79fbc9`), ref-import เป็น endpoint เดียว (`070e845d`, `f0c1eee8`) → [[hist-lessons-doc-ref-docflow]], [[hist-lessons-payment-cheque-tenders]]
- กันบั๊กพร้อมกัน: `4341ae81` ล็อกต่อสินค้ากัน deadlock `40P01`, `ac839a65` ล็อก GL rebuild กับการบันทึก → [[hist-lessons-concurrency-advisory-locks]]
- ช่องกรอก/รายงาน: `82dbe5d4` DateBox/NumberBox, `09bed48b`, `5e33f5c2`, `77780f6e` → [[hist-lessons-numeric-input-blank-zero]], [[hist-lessons-report-engine-parity]], [[hist-lessons-thai-text-pdf]]
- ทิ้งโค้ดเดิม: `20dd8f27` ลบ legacy report runners และจอ tax amendment
- เริ่มใช้ตั๋ว IssueMate: `b9502e64` (BCAIACC-106) ถึง `3b55658e` (BCAIACC-113) → [[hist-lessons-uat-s1-bugs-2026-10-29]]
- ปิดรอบ: เอกสารส่งต่อ `a087ff10`, merge `62c7098f` (R3E/R3F/R3G), อัปเดตรายงาน parity `58fe0ccf`

### 23 ต.ค. — จอข้อมูลภูมิศาสตร์/ธนาคาร และ UX
- `a422b74f` ตรวจงานที่ยังไม่บันทึกก่อนปิดแท็บ → [[hist-lessons-hidden-tab-hotkeys-dirty-guard]]
- `ab7d1893`, `bd57ff05`, `c0bcbb85`, `3839482d` ต้นไม้จังหวัด/อำเภอ/ตำบล, GPS, แผนที่ Leaflet, โลโก้ธนาคาร
- `33cf6477` แท็บย่อยกลายเป็น Section Card; `5fa7e098` ย้ายโดเมนผลิตจริง, ตัดคำไทย, `year_type` แบบไดนามิก → [[hist-lessons-grid-ux-regressions]], [[hist-lessons-dates-buddhist-year]]

### 24 ต.ค. — ไล่หาบั๊กทั้งโปรเจกต์ (security + data integrity sweep)
- ความปลอดภัย: `faa6e6d0` (ตรวจ Google ID token, ปิด open redirect, escape popup แผนที่, จำกัด content-type), `7ab65d38` (fail closed ถ้าไม่มี admin key), `a47413ec` (/blob/insert ต้องผ่าน lockdown) → [[hist-lessons-web-vulns-xss-redirect]], [[hist-lessons-tenant-auth-sessions]]
- ธุรกรรม: `a47413ec`, `4de91436` (checkout ตลาดเป็น transaction เดียว, เลขเอกสารกันชน), `5e3dbd36` (rebuild ถัง WMS แบบกำหนดผลได้) → [[hist-lessons-atomic-transactions-swallowed-errors]]
- หน้าจอ: `678fc5fc`, `7dc1b3a6`, `324bd2a6`, `6cb904f7` (คีย์ลัดแท็บซ่อน, ถามก่อนทิ้งข้อมูล, ทศนิยมตาม `erp_option`)
- ข้อมูลเอกสาร: `2ab00c67` serial, `dc975db9` shipment, `a133ded8` ชำระหลายแถว, `68f5a4d4` ปี ค.ศ., `ceda88d1` ปีตาม `year_type` → [[hist-lessons-serial-lot-shipment]]
- สิทธิ์/ผู้ใช้: `a264a99a`, `0d77e6fb` สิทธิ์แยกตามฐานข้อมูลและบังคับฝั่ง backend; `a94b0748` ผู้ดูแลส่วนกลาง + เปลี่ยนรหัสผ่านเอง; `6e9ae03e` Google PDPA หลายผู้เช่า + VAT หลายใบกำกับ
- `6e89ce3a` กราฟ Document Flow; ชุด `969decaf`…`792a6eef` ตัวออกแบบฟอร์ม; `0a7580cf` AutoCare (นอกขอบเขตมิตินี้)

### 25–27 ต.ค. — รุ่น (edition), ประเภทธุรกิจ, ภาษา
- `b9c13081` กฎ "เว็บใช้ปุ่มบนจอ ไม่ใช้ F1–F12"; `a67dc5f0` เมนูเฉพาะแอดมิน; `3e69b2b5` MCP แบบอ่านอย่างเดียว
- `6442540d` / `422b5996` สลับรุ่น Starter/Account/Pro; `a4b2fa88` → `4d238d4b` 17 ประเภทธุรกิจ; `b10adb77` รหัสเมนู 4 หลัก; `9a2ce199` เลิกรุ่น Express + บังคับล็อกอินใหม่เมื่อ session หมด
- `89d49042`, `3ec04525`, `09d490a5` พิมพ์ฟอร์มเอกสาร; `d6bfe1b5` ขอคืน VAT นักท่องเที่ยว (e-VRT) → [[hist-lessons-thai-text-pdf]]
- `47fce10e` (27 ต.ค.) สลับภาษาไทย/อังกฤษทั้งระบบ + Balloon Help สองภาษา

### 29 ต.ค. — รอบ UAT S1 และตั๋ว IssueMate
- `13f953cc` แก้ 13 บั๊กระดับ S1 + 5 รายการ Hold (ลง GL, ต้นทุนถัวเฉลี่ย, สิทธิ์, ความปลอดภัยรายงาน, bcrypt)
- `a3809aba` ห้ามเรียก query/list ก่อนล็อกอิน, seed ลูกค้า POS, อนุมานอัตรา VAT เมื่อเป็น 0; `8dad8a4d` (BCAIACC-122); `3ca3b07b` (BCAIACC-123…169)
- ชุด BCAIACC-234/235: `536f2f7c`, `5f76fd75`, `4c503032`, `e6c8e0af`, `91799b37`, `75c8a5b6` (คงคอลัมน์นอกจอตอน UPDATE ของ `ar_dealer`) = commit ล่าสุดในขอบเขต → [[hist-lessons-master-save-preserve-columns]]

## รูปแบบบั๊กที่วนซ้ำ (cross-cutting)
1. **เดา/สร้างเองแทนอ่านโค้ด C#** — จอ 1.1.2 รอบแรกสร้างจาก markdown ได้ฟิลด์หาย 7 และเดาเอง 3 (บทเรียนบรรทัดแรกของ `TODO.md`), คอลัมน์ส่วนลดบาร์โค้ดที่แต่งขึ้นถูกถอดใน `7064535f` → [[hist-lessons-schema-drift-invented-columns]]
2. **ตัวเลขปัดไม่ตรงจุดของ C#** (ToEven/HALF_UP/double, `2` ตายตัว) → [[hist-lessons-rounding-decimal]]
3. **งาน async ลงผิดเอกสาร/ผิดแท็บ** (โหลดซ้อน, คีย์ลัดแท็บที่ซ่อน, listKey ชน) → [[hist-lessons-hidden-tab-hotkeys-dirty-guard]]
4. **เขียนครึ่งๆ กลางๆ + ทิ้ง error** แล้วตอบ 200 → [[hist-lessons-atomic-transactions-swallowed-errors]]
5. **ประตูเขียนข้อมูลหลายบาน** (`/query/exec`, `/blob/insert`, proxy) ต้องใช้นโยบายเดียวกัน → [[hist-lessons-query-gateway-write-lockdown]]
6. **วันที่/ปี**: `toISOString()` เป็น UTC, `+543` ตายตัว → [[hist-lessons-dates-buddhist-year]]
7. **ข้อมูลทดสอบค้างใน DB สาธิต** ลบผ่าน API ของแอป ไม่ใช่ SQL ดิบ → [[hist-lessons-uat-s1-bugs-2026-10-29]]

## แผนที่บันทึกบทเรียน

| หมวด | โน้ต |
|---|---|
| บัญชี/เงิน | [[hist-lessons-rounding-decimal]] · [[hist-lessons-gl-posting-balance]] · [[hist-lessons-vat-tax-mistakes]] · [[hist-lessons-payment-cheque-tenders]] · [[hist-lessons-stock-cost-moving-average]] |
| เอกสาร | [[hist-lessons-trans-save-rules]] · [[hist-lessons-doc-ref-docflow]] · [[hist-lessons-serial-lot-shipment]] · [[hist-lessons-cancel-delete-partial]] |
| ธุรกรรม/พร้อมกัน | [[hist-lessons-atomic-transactions-swallowed-errors]] · [[hist-lessons-concurrency-advisory-locks]] · [[hist-lessons-performance-and-load]] |
| ความปลอดภัย | [[hist-lessons-query-gateway-write-lockdown]] · [[hist-lessons-permission-rights]] · [[hist-lessons-tenant-auth-sessions]] · [[hist-lessons-web-vulns-xss-redirect]] |
| หน้าจอ/ผลลัพธ์ | [[hist-lessons-grid-ux-regressions]] · [[hist-lessons-hidden-tab-hotkeys-dirty-guard]] · [[hist-lessons-numeric-input-blank-zero]] · [[hist-lessons-dates-buddhist-year]] · [[hist-lessons-thai-text-pdf]] · [[hist-lessons-report-engine-parity]] |
| ข้อมูลหลัก/กระบวนการ | [[hist-lessons-master-save-preserve-columns]] · [[hist-lessons-schema-drift-invented-columns]] · [[hist-lessons-uat-s1-bugs-2026-10-29]] |
| สถานะงาน | [[hist-parity-bccm]] · [[hist-todo-open-items]] |

## วิธีอ่านประวัติอย่างระวัง
- `git log -- backend frontend/account` ไม่รวมไฟล์ใน `frontend/src/` และ `frontend/shared/`; ชุดแก้ความปลอดภัยฝั่งหน้าเว็บอยู่ที่ `faa6e6d0` ซึ่งไม่ผ่านตัวกรองนี้
- ข้อความ commit ช่วง 21–24 ต.ค. มักบอกแค่ชื่อเรื่อง โน้ตบทเรียนจึงระบุว่าเคสไหน "ตรวจ diff แล้ว" และเคสไหน "ตามข้อความ commit"
- working tree ปัจจุบันมีไฟล์ที่ยังไม่ commit (เช่น `AGENTS.md`, `backend/internal/adapter/inbound/http/mcp/gateway.go`) โน้ตที่อ้าง `path:line` อ้างตามไฟล์บนดิสก์ ณ 2026-10-31

## ดูเพิ่ม
[[standards-overview]] · [[adr-index]] · [[std-data-integrity-money-transactions]] · [[std-frontend-ux-bug-lessons]] · [[std-security-lessons-idor]] · [[acc-rounding-decimal]] · [[acc-gl-rebuild]] · [[acc-inventory-stock-rebuild]] · [[std-report-pdf-thai-wrap-multilevel]]

## ที่มาในโค้ด
- `git log --reverse --format='%h %ad %s' --date=short -- backend frontend/account` (175 commit ณ HEAD `3ac50564` ซึ่งเองอยู่นอกขอบเขต; commit ล่าสุดในขอบเขตคือ `75c8a5b6`)
- `TODO.md` (เพิ่มใน `8bd921d1`, ไม่เคยถูกแก้หลังจากนั้น), `docs/HANDOFF_BCCM_PARITY_2026-10-22.md`, `docs/HANDOFF_CLAUDE_CODE_100_CLONE.md`, `docs/HANDOFF_CLAUDE_CODE_AUDIT.md`
- `docs/kms/KMS_SECURITY_DATA_INTEGRITY_LESSONS.md` (ผลไล่หาบั๊ก 24 ต.ค.)
