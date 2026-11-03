---
title: "ระบบนี้เหมือนโปรแกรม C# เดิม (BCCM) แค่ไหน ตรวจ parity อย่างไร และเมื่อต่างกันให้ยึดอะไร"
tags: [faq, parity, csharp, bccm, porting, dev, troubleshooting]
aliases: ["parity กับ C#","BCCM","100% clone","ตรงกับโปรแกรมเดิม","bccm_parity_report","ผลต่างจาก C#","พอร์ตหน้าจอจาก C#","source-first","extract-bccm-blueprint","ทำไมไม่เหมือนโปรแกรมเดิม"]
sources: ["docs/bccm_parity_report.json:3", "scripts/extract-bccm-blueprint.mjs:155", "scripts/extract-bccm-blueprint.mjs:599", "AGENTS.md:42", "backend/internal/application/process/price_center.go:19", "backend/internal/application/process/doc_flow.go:90", "backend/internal/application/process/trans_credit.go:18"]
---
# ระบบนี้เหมือนโปรแกรม C# เดิม (BCCM) แค่ไหน ตรวจ parity อย่างไร และเมื่อต่างกันให้ยึดอะไร

**ตอบสั้น:** โครงสร้าง (เมนู ตาราง ฟิลด์ master ภาษา) ถูกสกัดจากซอร์ส C# และเทียบครบแล้ว แต่ "พฤติกรรมเหมือน C#" ยังไม่มีตัวชี้วัดอัตโนมัติ ต้องพิสูจน์ด้วยเทสต์/UAT ทีละเรื่อง กติกาคือ C# เป็นความจริงสูงสุดของ "ธุรกิจ" และใช้เป็นฐานความรู้ (KMS) อ่านอย่างเดียว ไม่แก้ย้อนกลับ ส่วนที่เว้นไว้หรือจงใจต่างถูกทำเครื่องหมายเป็นคอมเมนต์ `ponytail:` ในโค้ด Go

## รายละเอียด
**รายงาน parity บอกอะไร** (`docs/bccm_parity_report.json`, สร้างโดย `scripts/extract-bccm-blueprint.mjs`):
| ตัวเลข | ค่าในรายงาน | ความหมาย |
|---|---|---|
| `totalLeafMenus` | 708 | เมนูใบทั้งหมด (`:3`) นับ `bcMenu.json` แบบง่ายตอนนี้ได้ราว 710 วิธีนับต่างกัน จึงอย่าใช้เป็นตัวชี้วัด |
| ตาราง / lookup / ภาษา | 520 / 180 / 5,145 | สกัดจากไฟล์ metadata ต้นฉบับ |
| เมนูแยกตามตัวจัดการหน้าเว็บ | 66 + 80 + 19 + 390 + 153 | เฉพาะตัวจัดการ (จอเฉพาะ, `StandardMasterScreen`, `MasterDetailScreen`, รายงาน/workbench, `UniversalTransScreen`) |
| `masterScreenFieldDiscrepanciesCount` | 0 | ฟิลด์จอ master ตรงกับ C# **เฉพาะจอ `StandardMasterScreen`** (`extract-bccm-blueprint.mjs:599`) |

**สิ่งที่รายงานไม่ได้พิสูจน์:**
- สถานะ "100% Ported & Verified" ของ 8 โดเมน backend เป็นสตริงที่เขียนตายตัวในอาร์เรย์ `backendDomainMapping` (`extract-bccm-blueprint.mjs:155` เป็นต้นไป) ไม่ใช่ผลเทียบ และชื่อไฟล์ Go ในช่อง `goSources` ปัจจุบันมีอยู่จริงเพียง 13 จาก 33 รายการใน `backend/internal/application/process/` (เช่น `rebuild.go`, `stock_check.go`, `price.go` ไม่พบในโค้ดแล้ว) แปลว่าแผนที่โดเมนล้าหลังการจัดไฟล์ใหม่
- จอธุรกรรม รายงาน และ process ไม่ได้ถูกเทียบพฤติกรรมในสคริปต์ ต้องดูเทสต์และ UAT ([[hist-parity-bccm]], [[hist-lessons-report-engine-parity]])

**ลำดับถอดแบบจอจาก C# (source-first)** ตาม `AGENTS.md:42`: หา `menuKey` ใน `bcMenu.json` → ไล่ `case "<menuKey>"` ใน `_selectMenu.cs` ของโมดูลที่เกี่ยวข้อง → แกะ `.cs` และ `Designer.cs` (ดู `RemoveAt`/`Dispose`/`Visible = false` เพราะแท็บอาจถูกซ่อน) → ทำ schema ฝั่งเว็บให้ครบทุกฟิลด์ ([[std-csharp-screen-porting]], [[faq-menu-code-to-screen]])

**เมื่อโค้ด Go ต่างจาก C# ให้ยึดอะไร:**
1. ดูคอมเมนต์ในโค้ดก่อน ไฟล์ Go ที่พอร์ตจะอ้างตำแหน่ง C# (เช่น `_icTransItemGridControl._findPriceByItem cs:10385-10433` ใน `price_center.go:19`) ค้นแล้วมี 79 ไฟล์ที่อ้าง `.cs` ใช้ตามไปเทียบได้เลย
2. ค้นคำว่า `not ported`/`kept deviation`/`deliberate` ที่ท้ายไฟล์ ข้อที่ตั้งใจต่าง เช่น OTP ขอเพิ่มวงเงิน (`trans_credit.go:18-20`), ยอดมัดจำล่วงหน้าในขั้นขอวงเงินเป็น 0 (`trans_credit.go:112`), รายงานยอดค้างลูกหนี้/เจ้าหนี้กรองใบขายสินทรัพย์ที่ยกเลิกออกทั้งที่ C# ไม่กรอง (`report_menu_ap_ar.go:552`), doc flow ยังไม่พอร์ตแถว 213/235 และผู้เขียนบันทึกว่าวิธีนับ flag 99 ของ C# ดูเป็นบั๊ก จึงรอให้มีหน้าเว็บที่อ่านสถานะก่อน (`doc_flow.go:90`)
3. ถ้าคอลัมน์มีใน C# แต่ฐานเก่ายังไม่มี ห้ามตัดฟิลด์ออกจากจอ ให้เพิ่มคอลัมน์ด้วย `ADD COLUMN IF NOT EXISTS` (`AGENTS.md:51`)
4. ส่วนที่เปลี่ยน contract จริง (เพิ่มฟิลด์ใน struct) ถือเป็นการเปลี่ยนแบบ R1 ต้องบอกเหตุผล ไม่ใส่ลงช่อง client เฉย ๆ ([[hist-lessons-doc-ref-docflow]])

## ข้อควรระวัง
- อย่าอ้างว่า "ตรง C# 100%" จากรายงาน JSON เพียงอย่างเดียว ให้อ้างเทสต์หรือผล UAT ของเรื่องนั้น และดูรายการที่ยังไม่เสร็จที่ [[faq-open-items-unfinished]]
- ตัวนับ "เมธอด Go 1,327 / C# 669" ใช้เกณฑ์ต่างกัน ห้ามเทียบกันเป็นเปอร์เซ็นต์ความครบ (บันทึกต้นทางเตือนไว้เองและพบว่าเอกสาร handoff อ้างเลขอีกชุด)
- ซอร์ส C# อยู่นอก repo นี้และใช้เป็น KMS อ่านอย่างเดียว ห้ามแก้ไฟล์ C# ถ้าต้องแก้ ให้เขียนเป็นคำสั่งงานให้ผู้ดูแลทำ
- รายงาน parity สร้างเมื่อ 22 ต.ค. 2026 หลังจากนั้นมีการแก้อีกหลายรอบ (UAT รอบ 3 และ S1) ถ้าต้องการตัวเลขปัจจุบันให้รันสคริปต์ใหม่ (ไม่ได้รันในรอบตรวจนี้)
- ข้อมูลรหัสธุรกรรม (flag) ที่ต้องแมปกับ C# ดู [[acc-trans-flag-map]] และตำแหน่งที่จัดการ flag ใน [[faq-where-trans-flag-handled]]

## ดูเพิ่ม
- [[hist-parity-bccm]]
- [[std-csharp-screen-porting]]
- [[faq-open-items-unfinished]]
- [[faq-past-bugs-lessons]]
- [[faq-where-trans-flag-handled]]
- [[faq-menu-code-to-screen]]

## ที่มาในโค้ด
- `docs/bccm_parity_report.json:3` `totalLeafMenus` และสถานะโดเมนที่ตายตัว (บรรทัด 31, 43, 59 ...)
- `scripts/extract-bccm-blueprint.mjs:155` `backendDomainMapping` / `:599` เงื่อนไขตรวจฟิลด์เฉพาะ `StandardMasterScreen`
- `AGENTS.md:42` โฟลว์สืบค้นเมนู / `:51` Forward-Only และเพิ่มคอลัมน์ที่ขาด
- `backend/internal/application/process/price_center.go:19` ตัวอย่างคอมเมนต์อ้าง C# พร้อมส่วนที่ไม่พอร์ต
- `backend/internal/application/process/doc_flow.go:90` แถว 213/235 ที่ยังไม่พอร์ต พร้อมข้อสังเกตบั๊กของ C#
- `backend/internal/application/process/trans_credit.go:18` ส่วนเบี่ยงเบนที่ตั้งใจ (OTP, dblink) และ `:112`
- `backend/internal/application/process/report_menu_ap_ar.go:552` ส่วนที่ตั้งใจต่างจาก C# ในรายงาน
