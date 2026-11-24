# BRIEF — สกัดความรู้ BC Ai Account ใหม่ (รองรับทั้งฝั่ง User ทั่วไป และฝั่ง Dev ต่อยอดระบบ)

## เป้าหมาย
สกัดความรู้จากซอร์สโค้ดจริงใน `d:\bcaiaccount` (**อ่านอย่างเดียว ห้ามสร้าง/แก้/ลบไฟล์ใน `d:\bcaiaccount` เด็ดขาด**) ลงใน `d:\bcbrain\vault\<โฟลเดอร์>\<slug>.md` เพื่อให้:
1. **นักพัฒนา (Dev) & AI พัฒนาระบบ (`audience: "dev"`)**: เอาโครงสร้างตาราง (Schema), คำสั่ง SQL SELECT/WITH พร้อมใช้งาน, รหัส `trans_flag` / ผังบัญชี Dr/Cr, API & MCP Contract, และสถาปัตยกรรมไปพัฒนาระบบต่อยอดได้จริง
2. **ผู้ใช้ทั่วไป / Call Center / ฝ่ายขาย (`audience: "user"`)**: อ่านเข้าใจง่าย ใช้สอนงาน แก้ปัญหา และตอบคำถามก่อนซื้อได้ทันทีโดยไม่มีศัพท์โค้ดปน

---

## แหล่งความจริงใน `d:\bcaiaccount` (Read-Only 100%)
- เมนูและชื่อเมนูภาษาไทยบนหน้าจอ: `backend/internal/application/process/bcMenu.json`
- คำอธิบายช่องข้อมูลภาษาไทย: `frontend/src/config/help/data/*.json`
- หน้าจอผู้ใช้: `frontend/account/`, `frontend/shared/`, `frontend/<ระบบ>/`, `frontend/src/app/`
- กติกาหลังบ้าน, SQL รายงาน, Process Engine, ผังบัญชี: `backend/internal/application/process/`
- โครงสร้างตาราง SQL: `scripts/sql/02_data_schema.sql`, `scripts/sql/02b_sync_existing_db.sql`, `scripts/sql/03_audit_r1_migrations.sql`, `backend/migrations/`
- MCP / Query / AI Gateway / HTTP Endpoints: `backend/internal/adapter/inbound/http/**`, `services/company-brain/**`

---

## โครงสร้าง 15 โฟลเดอร์ + Root

### แกนกลาง (`both`)
- `vault/index.md` (`root`) — แผนที่สมองหลัก เชื่อมทั้งโซนผู้ใช้ทั่วไป (`user`) และโซนนักพัฒนา (`dev`)

### โซน User (`audience: "user"`)
1. `vault/playbook/` — คู่มือ AI Call Center (`playbook-call-center.md`) และฝ่ายขาย (`playbook-sales.md`)
2. `vault/start/` — เริ่มต้นใช้งานวันแรก ตั้งค่าบริษัท ผังบัญชี งวดบัญชี เลขเอกสาร สิทธิ์ เชื่อม AI
3. `vault/howto/` — วิธีทำทีละขั้นทุกเมนูหลักและระบบเสริม
4. `vault/troubleshoot/` — แก้ปัญหาตามอาการและข้อความบนจอคำต่อคำ
5. `vault/faq/` — ถาม-ตอบที่พบบ่อย
6. `vault/reports/` — คู่มือรายงาน การกรอง การอ่านตัวเลข และการคลิกเจาะลึก
7. `vault/systems/` — ภาพรวมและข้อจำกัดของทุกระบบในชุด BC (บัญชีหลัก, POS, AutoCare, WMS, TMS, CRM, LINE OA, Market, Procure, e-Tax, Dashboard, MonitorMap, WorkMonitor, Company Brain & Morning Briefing, Feature Switchboard)
8. `vault/glossary/` — คำศัพท์บัญชี-ภาษี-สต็อกภาษาคน
9. `vault/sales/` — ข้อมูลการขาย จุดเด่นแยกธุรกิจ ข้อจำกัดปัจจุบัน

### โซน Dev (`audience: "dev"`)
10. `vault/dev-playbook/` — คู่มือ AI นักพัฒนา (`playbook-dev.md`), กฎเหล็ก SQL/บัญชี (`dev-rules-accounting-sql.md`), แนวทางเริ่มต้นเชื่อมระบบ (`dev-integration-quickstart.md`)
11. `vault/schema/` — Data Dictionary ตารางธุรกิจครบทุกระบบ (PK, Indexes, คอลัมน์, ชนิดข้อมูล, flag, JOIN)
12. `vault/queries/` — คลังคำสั่ง SQL `SELECT`/`WITH` พร้อมใช้งานจริงทุกหมวดธุรกิจ
13. `vault/api/` — สเปก MCP Gateway (11 tools), Query Gateway, Process Actions, Report `menuKey` catalog, REST API
14. `vault/doctypes/` — รหัส `trans_flag`, Document Flow, ผลกระทบสต็อก/AR/AP/VAT/เช็ค, ผังบัญชี Dr/Cr (TFRS)
15. `vault/architecture/` — สถาปัตยกรรม Multi-Tenant, Feature Switchboard 28 โมดูล, Company Brain, แนวทางเขียนแอป/Dashboard/Webhook ต่อยอด

---

## กฎความปลอดภัยสูงสุด (ห้ามฝ่าฝืนทั้งฝั่ง User และ Dev)
1. **ห้ามมีตารางความลับ / Auth / Token / รหัสผ่าน**: ห้ามสกัดหรือเอ่ยชื่อตารางความลับระบบยืนยันตัวตน/โทเค็น/รหัสผ่านของระบบ, ห้ามใส่คอลัมน์รหัสผ่าน/hash/token/key, ห้ามใส่รหัสสาธิต, อีเมลจริง, เบอร์โทร, IP สาธารณะ, หรือวิธี bypass สิทธิ์/รายละเอียดช่องโหว่ลงในโน้ตโดยเด็ดขาด
2. **ห้ามแต่งเติม**: เขียนเฉพาะสิ่งที่พบในซอร์สโค้ดจริงของ `d:\bcaiaccount` เท่านั้น
3. **ทุกไฟล์ต้องมี YAML Frontmatter ครบ**:
```yaml
---
title: "ชื่อเรื่องภาษาไทย (ฝั่ง dev ใส่ชื่อตาราง/คีย์เทคนิคในวงเล็บได้)"
tags: [folder_or_type, domain]
aliases: ["คำค้นที่คนหรือ AI มักพิมพ์หา 4-10 แบบ"]
sources: ["backend/internal/application/process/xxx.go:123"]
---
```
- ห้ามใส่ `## ที่มาในโค้ด` ในเนื้อหา (เก็บใน `sources` ของ frontmatter เท่านั้น)
- ชื่อไฟล์ (slug) เป็น ascii kebab-case ตัวเล็กเท่านั้น และห้ามซ้ำกันข้ามโฟลเดอร์เด็ดขาด!

---

## กฎเฉพาะฝั่ง User (`start`, `howto`, `troubleshoot`, `faq`, `reports`, `systems`, `glossary`, `sales`)
1. **ภาษาคนทั่วไป (Human-Language First)**: ประโยคสั้น อ่านลื่น เข้าใจได้ทันทีสำหรับเจ้าของกิจการ พนักงานบัญชี พนักงานหน้าร้าน Call Center และฝ่ายขาย — ถ้ามีคำศัพท์บัญชี/ภาษี/สต็อกเฉพาะทาง ให้วงเล็บอธิบายสั้นๆ ด้วยภาษาคน
2. **ห้ามมีศัพท์โค้ดในเนื้อหาและ `aliases`**: ห้ามมีชื่อตาราง/คอลัมน์แบบ `snake_case`, นามสกุลไฟล์ (`.go`, `.tsx`, `.sql`, `.mjs`), `/api/`, `SELECT`, `INSERT`, `UPDATE`, `trans_flag`, `flag 44`, ชื่อภาษาโปรแกรม/framework/ค่าย AI (`React`, `Next.js`, `Golang`, `Postgres`, `Gemini` ฯลฯ) หรือ backtick ครอบศัพท์เทคนิคอังกฤษ ใช้เฉพาะชื่อเมนู ชื่อปุ่ม ข้อความบนจอตามจริง (ยกเว้น `playbook/` ที่สั่งงาน AI)
3. **ขยายข้อความและ `aliases` ให้ครอบคลุมคำถามภาษาคนของลูกค้ามากที่สุด**:
   - **`aliases` 6–15 สำนวนต่อโน้ต**: ห้ามใส่แค่ชื่อเมนูทางการอย่างเดียว ต้องคิดแทนลูกค้า/ผู้ใช้จริงว่าเวลาโทรถาม Call Center หรือแชทถามฝ่ายขายจะพิมพ์ว่าอะไร เช่น `"ออกบิลผิดแก้ตรงไหน"`, `"ขายแล้วสต็อกไม่ตัด"`, `"เช็คเด้งทำยังไง"`, `"ใช้กับธุรกิจขายส่งได้ไหม"`, `"ดูยอดขายบนมือถือได้ไหม"`, `"ปิดงวดแล้วแก้เอกสารไม่ได้"`, `"ย้ายเครื่องข้อมูลหายไหม"`
   - **เพิ่มหัวข้อถาม-ตอบภาษาคนเมื่อเหมาะสม** (เช่น `## คำถามที่ลูกค้ามักถาม` หรือ `## อาการที่ลูกค้ามักโทรถาม`): สรุปคำถามสั้นๆ ภาษาพูด + คำตอบชัด 1–3 บรรทัด เพื่อให้ AI Call Center / แชทบอทหยิบไปตอบลูกค้าได้ทันทีโดยไม่ต้องตีความซ้ำ
4. **มาตรฐานรองรับ Call Center (ช่วยลูกค้าหน้างานแก้จบในสายเดียว)**:
   - โน้ตวิธีทำ (`howto`) และแก้ปัญหา (`troubleshoot`) ต้องเรียงชัด: **ลูกค้ากำลังจะทำอะไร/เจออาการอะไร → สาเหตุที่พบบ่อย (ภาษาคน) → ขั้นตอนแก้ทีละข้อ (ระบุชื่อเมนู ชื่อปุ่ม ชื่อช่องตามหน้าจอจริง) → สิ่งที่ต้องตรวจซ้ำหลังทำ**
   - ถ้าหน้าจอมีข้อความแจ้งเตือน (Error / Warning) ให้คัดลอกข้อความภาษาไทยบนจอแบบคำต่อคำ (จากโค้ดจริงใน `D:\bcaiaccount`) เพื่อให้ AI ค้นเจอทันทีผ่าน `lookup_error` เมื่อลูกค้าอ่านข้อความบนจอให้ฟัง
5. **มาตรฐานรองรับงานขายโปรแกรม (Sales / Pre-Sales)**:
   - โน้ตภาพรวมระบบ (`systems`), ข้อมูลการขาย (`sales`), และ `faq` ต้องช่วยฝ่ายขายตอบคำถามก่อนซื้อได้ครบ:
     - **เหมาะกับธุรกิจแบบไหน** (เช่น ค้าปลีก, ค้าส่ง, อู่ซ่อมรถ, คลังสินค้า, ขนส่ง, ธุรกิจบริการ, บริษัทที่มีหลายสาขา)
     - **ช่วยแก้ปัญหา/ลดงานอะไรให้เจ้าของกิจการ** (ประโยชน์ภาษาคน ไม่ใช่แค่รายชื่อเมนู)
     - **ทำอะไรได้บ้าง และข้อจำกัดปัจจุบันคืออะไรตามความจริง 100%** (ห้ามโฆษณาเกินจริงหรือแต่งฟีเจอร์ที่ไม่มีในโค้ด)
     - **ครอบคลุมคำถามก่อนซื้อยอดฮิต**: *"รองรับ ... ไหม"*, *"ใช้พร้อมกันกี่คน/กี่สาขา"*, *"แยกสิทธิ์พนักงานได้ไหม"*, *"ออกใบกำกับภาษี/e-Tax ได้ไหม"*, *"ต่างจากรุ่นก่อนหน้าอย่างไร"*
6. **เรื่องราคา/แพ็กเกจ/กฎหมาย**: อ้างอิงเฉพาะข้อมูลราคา/แพ็กเกจที่มีหลักฐานจริงในแหล่งข้อมูลของระบบ หากเป็นราคาพิเศษ/โปรโมชัน/สัญญาเฉพาะรายให้ตอบ **"สอบถามฝ่ายขาย"** · เรื่องกฎหมาย/ภาษีให้บอกเฉพาะสิ่งที่ระบบทำได้ แล้วแนะนำปรึกษาผู้สอบบัญชี/กรมสรรพากร
7. **เลขรหัสเมนูแบบ 4 ชุด** (ถ้าจำเป็นต้องกล่าวถึง): ห้ามใส่รูปแบบคล้าย IP ในฝั่ง user ให้ใช้ชื่อเมนูบนจอหรือรหัสเมนู 4 หลักที่ตรวจสอบแล้วแทน

---

## กฎเฉพาะฝั่ง Dev (`dev-playbook`, `schema`, `queries`, `api`, `doctypes`, `architecture`)
1. **แม่นยำตามโค้ดจริง 100%**: ชื่อตาราง ชื่อคอลัมน์ ชนิดข้อมูล (`NUMERIC`, `DATE`, `INTEGER`, `TEXT`), `trans_flag`, URL path, parameter ต้องตรงกับ `d:\bcaiaccount` เป๊ะ
2. **กฎเหล็กตัวเลขและบัญชีใน SQL/โค้ดต่อยอด**:
   - กรองเอกสารยกเลิกเสมอ: `COALESCE(last_status, 0) = 0` (ใน `ic_trans`, `ap_ar_trans`, `cb_trans`, `gl_journal` ฯลฯ ตามที่ตารางนั้นใช้จริง)
   - ค่าเงิน/จำนวนใช้ `NUMERIC` / Decimal เสมอ ห้ามใช้ `float` / `double`
   - ระบุทิศทางเครื่องหมายลดหนี้/เพิ่มหนี้ และความแตกต่างของตารางใช้ร่วมหลายบทบาท (เช่น `ap_ar_trans_detail`, `ic_trans_detail`) ให้ชัดเจน
3. **SQL ทุกคำสั่ง**: เขียนเป็นบล็อก ````sql ... ```` พร้อมใช้จริง (ใช้ `SELECT` / `WITH` เท่านั้น พร้อมคำอธิบายพารามิเตอร์และคอลัมน์ที่ได้)

---

## รายการ Canonical Hub Slugs (รับประกันว่ามีอยู่จริง — ลิงก์ข้ามกลุ่มใช้ชื่อเหล่านี้เท่านั้น!)
- **แกนกลาง**: `index`
- **User Hubs**: `playbook-call-center`, `playbook-sales`, `start-first-day`, `howto-sale-overview`, `howto-ar-overview`, `howto-buy-overview`, `howto-ap-overview`, `howto-stock-overview`, `howto-cash-bank-overview`, `howto-gl-overview`, `howto-tax-overview`, `howto-asset-overview`, `howto-doc-edit-cancel-delete`, `ts-overview`, `ts-common-no-permission`, `ts-common-period-closed`, `faq-overview`, `rpt-overview`, `sys-overview`, `sys-account-overview`, `term-overview`, `sales-overview`
- **Dev Hubs**: `playbook-dev`, `dev-rules-accounting-sql`, `dev-integration-quickstart`, `schema-overview`, `sql-overview`, `api-overview`, `api-mcp-gateway`, `doctypes-overview`, `arch-overview`

> **สำคัญมาก**: ห้ามสร้าง `[[wikilink]]` ไปยัง slug ที่ไม่ได้สร้างเองหรือไม่อยู่ในรายการ Canonical Hub Slugs ด้านบน เพราะ `check-notes.mjs` จะถือว่าลิงก์เสียเป็น Error ทันที!
