<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# กฎประจำโปรเจกต์ `d:\bcbrain` (BC Brain Auto-Sync & Anti-Hallucination Rules)

## 1. กฎเหล็กห้ามแก้นอกโปรเจกต์ `d:\bcbrain` (Workspace Isolation & Read-Only 100%)
- **ห้ามสร้าง แก้ไข ลบ หรือล็อกไฟล์ใดๆ นอกโฟลเดอร์ `d:\bcbrain` เด็ดขาด** (รวมถึง `D:\bcaiaccount`, `D:\bcaiwebsite-live`, `D:\yalecom`, `D:\jarvisbcaiaccount` และโปรเจกต์อื่นทุกแห่งบนเครื่อง)
- ทุกคำสั่ง `git` ที่อ่านโปรเจกต์ภายนอกต้องใส่ `--no-optional-locks` และอ่านอย่างเดียวเท่านั้น
- ตัวสกัดความรู้ AI อัตโนมัติใน `scripts/hourly-sync.mjs` บังคับจำกัดสิทธิ์ที่ `--tools "Read,Glob,Grep"` เท่านั้น (ไม่มี `Write`/`Edit`/`Bash`) และ controller ยอมเขียนเฉพาะไฟล์ `.md` ภายใน `d:\bcbrain\vault\` เท่านั้น
- หากต้องการให้โปรเจกต์ภายนอก (`D:\yalecom`, `D:\jarvisbcaiaccount` ฯลฯ) ปรับโค้ดหรือเพิ่มความสามารถเพื่อใช้ BC Brain ให้ **เขียนเป็น Prompt สำเร็จรูปส่งให้ลุงจืด** (และอัปเดตไว้ใน `docs/client-prompts.md`) เพื่อให้ AI ประจำโปรเจกต์นั้นเป็นผู้แก้เองเสมอ

## 2. กฎอัปเดตสมองอัตโนมัติทุก 1 ชั่วโมง + Auto-Deploy
- **Antigravity Automation (`Hourly BC Brain Sync & Deploy`)**: รันทุก 1 ชั่วโมง (`CRON_TZ=Asia/Bangkok 0 * * * *`) ด้วย Agent ของ Antigravity เอง (ไม่เรียก Claude/DeepSeek ใน Antigravity):
  1. รัน `node scripts/hourly-sync.mjs --plan-only --json` (คำนวณ SHA-256 content hash ของโค้ดจริงใน `D:\bcaiaccount`, `sources:` EOF drift, เมนูใหม่ใน `bcMenu.json`) — หาก `hasChanges === false` ออกทันทีแบบ `NOOP` (~1 วินาที)
  2. หากมีการเปลี่ยนแปลง อ่านโค้ดจริงใน `D:\bcaiaccount` ด้วย `read_file` แบบ Read-Only 100% และอัปเดตโน้ตใน `vault/` (รวมถึงปรับปรุงความเร็ว/ความฉลาด/กันหลอนใน `lib/` หรือ `app/` ได้เมื่อจำเป็น)
  3. รัน `node scripts/hourly-sync.mjs --finalize` เพื่อตรวจ 7 ด่านกันหลอน + deploy อัตโนมัติขึ้น `https://brain.bcsmethai.com` + ยิง `mcp-eval` ยืนยัน (และ commit เฉพาะ `vault/` + `public/sync-meta.json` ใน git local; ไม่ `git push` อัตโนมัติ)
- **Windows Scheduled Task สำรอง (`\bcbrain\hourly-sync`)**: รัน `scripts/hidden.vbs` → `scripts/hourly-sync.cmd` → `node scripts/hourly-sync.mjs` ทุก 1 ชั่วโมงนาทีที่ `:30` แบบไม่แสดงหน้าต่าง console เพื่อรองรับช่วงที่ปิด IDE (หาก Antigravity Automation ซิงก์รอบนั้นไปแล้ว จะจบแบบ `NOOP` ใน ~1 วินาที)

## 3. 7 ด่านตรวจกันหลอนก่อน Deploy (Anti-Hallucination Quality Gates)
ห้าม deploy หากไม่ผ่านครบทั้ง 7 ด่าน (หากไม่ผ่านให้ rollback `vault/` กลับสภาพเดิมทันที):
1. `node scripts/check-notes.mjs D:/bcaiaccount --strict` (frontmatter, slug, `sources:` EOF, `[[wikilinks]]`, ห้ามศัพท์โค้ดในโซน `user`, ห้าม `FORBIDDEN_SECURITY`)
2. `node scripts/scan-secrets.mjs` (ห้าม secret/hash/email/public IP หลุด)
3. `node scripts/verify-grounding.mjs` (ตรวจรหัสเมนู 4 หลักเทียบ `bcMenu.json` จริง, ตาราง SQL ในบล็อกโค้ดเทียบ schema/backend จริง, และ shrink guard กันโน้ตหดหาย >45%)
4. `npx tsc --noEmit`
5. `npm test` (`scripts/selftest.ts`)
6. `npm run test:deep` (`scripts/deep-test.ts` — Top5 100%, Top1 ≥ 98%, 0 isolation leaks, < 0.5 ms uncached)
7. `node scripts/deploy.mjs` → build + สแกนความลับ + สลับ `/opt/bcbrain` แบบ atomic (เก็บ `/opt/bcbrain.prev`) + ยิง `node scripts/mcp-eval.mjs https://brain.bcsmethai.com/mcp` บน Production จริง (**หาก `mcp-eval` พังให้ rollback `/opt/bcbrain.prev` บนเซิร์ฟเวอร์อัตโนมัติทันที**)

## 4. ความลับและตัวแปรสภาพแวดล้อม
- เก็บ `BC_DEPLOY_HOST` ใน `.env.local` เท่านั้น (ถูก ignore ด้วย `.env*` ห้าม commit/log/พิมพ์ค่าลงแชทเด็ดขาด) ดูรูปแบบตัวอย่างที่ `.env.example`

## 5. กฎประหยัด Token Gemini (Token-Budget Protocol)
- **NOOP จบใน 1 เทิร์น**: รัน `node scripts/hourly-sync.mjs --plan-only --json --diff` (compact payload ~120B สำหรับ NOOP / ~1.5–4KB พร้อม line-level diff ตั้งแต่รอบซิงก์ก่อนจาก `.sync-cache/baseline.json.gz`; เพิ่ม `--verbose` เมื่อต้องการรายละเอียดเต็ม) — หาก `hasChanges === false` ห้ามอ่านไฟล์อื่น จบทันที
- **อ่านเฉพาะจุดที่เปลี่ยนจริง**: ใช้ `diffs` จาก `--diff` (เทียบกับ baseline รอบซิงก์ล่าสุด แทนการรัน `git diff HEAD` ที่พ่น diff สะสมทั้งสัปดาห์) และข้ามไฟล์ที่ `status === "whitespaceOnly"` ทันที; ใช้ `read_file` เฉพาะช่วงบรรทัดที่จำเป็น แทนการอ่านไฟล์ขนาดหลายพันบรรทัดทั้งไฟล์
- **ลดรอบ LLM Turn**: แบตช์ `read_file` และ `edit_file` หลายโน้ตพร้อมกันในเทิร์นเดียว และไม่ต้องอ่าน `docs/extract-brief.md` ซ้ำทุกชั่วโมงหากแค่แก้ไขโน้ตเดิมเล็กน้อย (อ่านเมื่อสร้างโน้ตใหม่หรือติด Gate 1–3)
- **MCP Response กระชับ**: `app/mcp/route.ts` ตัด `mediaLines` ซ้ำซ้อนใน `ask_brain` (เพราะมี `## Media & Reference Links` รวมท้ายคำตอบแล้ว), จำกัด `links`/`backlinks` (6 ใน `ask_brain`, 16 ใน `read_note`), บีบ `search_brain` snippet/videos, รองรับ `compact: true` และ `max_notes` ใน `ask_brain`, และตัดหาง hit คะแนนต่ำเมื่อ `confidence === "high"` เพื่อประหยัด Token ให้ Gemini ทุกตัวที่เชื่อมต่อ `https://brain.bcsmethai.com/mcp`

## 6. กฎการสร้างสมองเพื่อรองรับ Call Center และงานขายโปรแกรม (Human-Language First)
ทุกครั้งที่สร้างโน้ตใหม่หรืออัปเดตโน้ตในโซนผู้ใช้ทั่วไป (`vault/start`, `howto`, `troubleshoot`, `faq`, `reports`, `systems`, `glossary`, `sales`, `playbook`) ต้องยึดหลัก **"ภาษาคนจริง — ครอบคลุมคำถามลูกค้าและงานขายสูงสุด"** โดยทุกข้อเท็จจริงยังคงอ้างอิงโค้ดจริงใน `D:\bcaiaccount` 100% ห้ามแต่งเติม:
1. **ขยาย `aliases` ด้วยภาษาพูดลูกค้า/ผู้ใช้ (6–15 สำนวน/โน้ต)**: ใส่ทั้งชื่อเมนูทางการ + ภาษาพูดที่ลูกค้ามักพิมพ์แชทหรือโทรถามจริง (เช่น `"บิลผิดแก้ยังไง"`, `"ขายแล้วสต็อกไม่ตัด"`, `"ออกใบกำกับย้อนหลังได้ไหม"`, `"ใช้กับร้าน...ได้ไหม"`, `"ดูยอดขายผ่านมือถือได้ไหม"`) เพื่อให้ค้นเจอแม่นแม้ลูกค้าไม่รู้ชื่อเมนู
2. **รองรับ Call Center (แก้จบในสายเดียว)**:
   - เขียนเป็นลำดับเข้าใจง่าย: **อาการ/ปัญหาที่ลูกค้าเจอ → สาเหตุภาษาคน → วิธีทำทีละขั้น (ชื่อเมนู/ปุ่ม/ช่องบนจอจริง) → จุดตรวจสอบ/ข้อควรระวัง**
   - ใส่ข้อความแจ้งเตือน (Error Message) บนหน้าจอจริงแบบคำต่อคำ เพื่อให้ AI Call Center จับคู่จากคำที่ลูกค้าอ่านให้ฟังทางโทรศัพท์ได้ตรงผ่าน `lookup_error`
3. **รองรับงานขายโปรแกรม (Sales / Pre-Sales)**:
   - อธิบายชัดว่าฟีเจอร์/ระบบนั้น **เหมาะกับธุรกิจประเภทไหน · ช่วยแก้ปัญหา/ลดงานอะไรให้เจ้าของกิจการ · ทำอะไรได้บ้าง · และข้อจำกัดปัจจุบันคืออะไรตามความจริง** (ห้ามขายเกินจริง)
   - เพิ่มคำถามแนวลูกค้าก่อนตัดสินใจซื้อ เช่น *"รองรับ ... ไหม"*, *"ทำ ... อัตโนมัติได้ไหม"*, *"ใช้ได้กี่คน/กี่สาขา"*, *"แยกสิทธิ์พนักงานได้ไหม"* (เรื่องราคา/โปรโมชัน/สัญญาเฉพาะราย ให้ยึดข้อมูลจริงที่มีในระบบหรือระบุให้สอบถามฝ่ายขาย)
4. **เพิ่มส่วนข้อความถาม-ตอบภาษาคน**: เมื่อเนื้อหามีประเด็นที่ลูกค้าถามซ้ำหรือใช้หลายสำนวน ให้เพิ่มหัวข้อ `## คำถามที่ลูกค้ามักถาม` หรือประโยคตัวอย่างภาษาพูดจริงในโน้ต โดยยังคง **ปลอดศัพท์โค้ด 100%** (ห้าม `snake_case`, นามสกุลไฟล์, SQL, `/api/`, ชื่อ framework ในโซน `user`) และระบุรายละเอียดเต็มไว้ใน `docs/extract-brief.md`

## 7. โปรเจกต์หลักที่ระบบสมองนี้รองรับ (`D:\yalecom` & `D:\jarvisbcaiaccount`) + Prompt อัปเกรดต่อเนื่อง
- ระบบสมอง `d:\bcbrain` (`https://brain.bcsmethai.com`) มีเป้าหมายหลักในการสนับสนุน **2 โปรเจกต์ปลายทาง** ให้ตอบลูกค้า ขายโปรแกรม และช่วยงานบัญชี/เทคนิคได้ฉลาด เร็ว และแม่นยำขึ้นเรื่อยๆ:
  1. **`D:\yalecom`** — ระบบ BC Call Center + J.A.R.V.I.S Voice Agent + CRM (`https://callcenter.bcsmethai.com/`)
  2. **`D:\jarvisbcaiaccount`** — ระบบ J.A.R.V.I.S BC Ai Account ผู้ช่วยเสียง/แชท Owner + Public (`https://jarvis.bcaiaccount.com/`)
- **ห้ามแก้ไฟล์ในทั้ง 2 โปรเจกต์นี้จากฝั่ง `d:\bcbrain` เด็ดขาด** — ให้ดูแลผ่าน **Prompt สำเร็จรูปเฉพาะโปรเจกต์** ที่เก็บและอัปเดตต่อเนื่องใน `docs/client-prompts.md`
- ทุกครั้งที่ `d:\bcbrain` เพิ่ม MCP Tool ใหม่, REST API ใหม่, โหมดความเร็วใหม่, ขยายโน้ต Call Center/ฝ่ายขาย, หรือเพิ่มกลไกกันหลอน (เช่น `lookup_error`, `search_sections`, `get_facts`, `whats_new`, `verify_reference`, `/api/openapi.json`, `/api/gaps`) ต้อง:
  1. อัปเดต Prompt ของทั้ง `D:\yalecom` และ `D:\jarvisbcaiaccount` ใน `docs/client-prompts.md` ให้ใช้ความสามารถใหม่ได้เต็มที่ (ระบุ endpoint/tool จริง, ตัวอย่าง routing คำถาม, และวิธีป้อน gap/feedback กลับเพื่อให้ทั้ง 2 โปรเจกต์เก่งขึ้นเรื่อยๆ)
  2. แนบ Prompt สำเร็จรูปให้ลุงจืดนำไปวางสั่ง AI ประจำ `D:\yalecom` และ `D:\jarvisbcaiaccount` อัปเกรดระบบของตัวเองทันที
