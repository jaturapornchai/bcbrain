---
title: "Chaos Lab: ห้องทำงานเสมือนยิงรายการพร้อมกันเพื่อทดสอบกฎบัญชี (UAT Chaos Lab)"
tags: [systems, uat, chaos-lab, kafka, deepseek]
aliases: ["Chaos Lab", "bc-chaos-office-lab", "uat_chaos", "พายุแย่งเลขที่เอกสาร", "RAM Guard", "autopilot 24/7", "notify-chaos-lab", "bc.chaos.commander"]
sources: ["uat/chaos-lab/package.json:2", "uat/chaos-lab/docker-compose.openhands.yml:1", "uat/chaos-lab/src/types/chaos.ts:1", "uat/chaos-lab/src/types/chaos.ts:78", "uat/chaos-lab/src/types/chaos.ts:161", "uat/chaos-lab/src/lib/chaos-engine.ts:43", "uat/chaos-lab/src/lib/chaos-engine.ts:145", "uat/chaos-lab/src/lib/chaos-engine.ts:381", "uat/chaos-lab/src/lib/chaos-engine.ts:579", "uat/chaos-lab/src/lib/chaos-engine.ts:806", "uat/chaos-lab/src/lib/chaos-engine.ts:1062", "uat/chaos-lab/src/lib/chaos-engine.ts:1901", "uat/chaos-lab/src/lib/chaos-engine.ts:2419", "uat/chaos-lab/src/lib/chaos-engine.ts:2464", "uat/chaos-lab/src/lib/kafka-bus.ts:9", "uat/chaos-lab/src/lib/kafka-bus.ts:60", "uat/chaos-lab/src/lib/chaos-engine.ts:1046", "uat/chaos-lab/src/lib/deepseek-brain.ts:9", "uat/chaos-lab/src/lib/issuemate-bridge.ts:16", "uat/chaos-lab/src/app/api/chaos/route.ts:12", "uat/chaos-lab/src/app/api/code-changed/route.ts:6", "uat/chaos-lab/src/app/api/sandbox/route.ts:6", "scripts/notify-chaos-lab.mjs:1"]
---
# Chaos Lab

Chaos Lab (`uat/chaos-lab/`, ชื่อแพ็กเกจ `bc-chaos-office-lab`) เป็นแอป Next.js แยกจาก Tester ปกติ ([[sys-uat-overview]]) หน้าเว็บเป็นออฟฟิศ 3 มิติ (three.js + gsap) ที่มี "พนักงานจำลอง" 10 แผนก แต่ละคนยิงรายการจริงเข้าฐานข้อมูลทดสอบพร้อมกัน เพื่อหาบั๊กที่เกิดเฉพาะตอนใช้งานซ้อนกัน เช่น เลขที่เอกสารชน สต็อกตัดเกิน ใบสั่งซื้อถูกดึงซ้ำ แล้วตรวจกฎบัญชีหลังจบแต่ละรอบ รันด้วย `next dev -p 3055` หรือ `next start -p 3055`

## ส่วนประกอบ

| ส่วน | หน้าที่ | ไฟล์ |
|---|---|---|
| เอนจินจำลอง | สร้างพนักงาน แผนก รอบจำลอง ตรวจกฎ เฝ้าแรม | `src/lib/chaos-engine.ts` |
| สมองทีม | ให้ DeepSeek วางแผนว่าใครทำอะไรในรอบนั้น และอ่านความรู้จาก BC Brain (MCP) | `src/lib/deepseek-brain.ts` |
| บัสข้อความ | ส่งข้อความทีมผ่าน Kafka ผ่านไลบรารี kafkajs | `src/lib/kafka-bus.ts` |
| สะพาน IssueMate | เปิด ticket เมื่อกฎข้อใดไม่ผ่าน และติดตามสถานะตรวจซ้ำ | `src/lib/issuemate-bridge.ts` |
| API | `/api/chaos`, `/api/sandbox`, `/api/code-changed`, `/api/status` | `src/app/api/*` |

มีไฟล์ `docker-compose.openhands.yml` เป็นทางเลือกสำหรับรันคอนเทนเนอร์ OpenHands คู่กัน ไม่จำเป็นต่อการทำงานหลัก

## ฐานข้อมูลแซนด์บ็อกซ์

- ใช้ฐานชื่อ `uat_chaos` ที่สร้างจากแม่แบบ `uat_template` (ถ้าไม่มีแม่แบบ ใช้สำเนา `bcdemo`) แล้วติดป้าย COMMENT `uat-tester` (`chaos-engine.ts:806-840`)
- การล้างแล้วสร้างใหม่ (`resetClean`) ปฏิเสธถ้าฐานไม่มีป้ายนี้ จึงลบฐานที่ไม่ใช่ของ Chaos Lab ไม่ได้
- เพิ่มข้อมูลทดสอบ เช่น หน่วยนับ กก./ถุง/ตัว คลังห้องเย็น และสินค้ารหัสขึ้นต้น `UAT-` สำหรับสินค้าชั่งน้ำหนักสองหน่วย เอกสารที่ทีมสร้างใช้เลขที่ขึ้นต้น `UAT-CHAOS-`
- การเชื่อมฐานอ่านจาก env `UAT_PG_*` (และตัวแปร `UAT_PSQL` ระบุ psql) ตรงกับ Tester ปกติ

## แผนกและพนักงาน

มี 10 แผนก (`DEPARTMENTS`, `chaos-engine.ts:145`): ขายปลีก/เคาน์เตอร์, ขายส่ง B2B, จัดซื้อ, คลังสินค้า, ลูกหนี้, เจ้าหนี้, เงินสดและธนาคาร, ภาษี, บัญชีแยกประเภท/ต้นทุน, ตรวจสอบ/ไอที จำนวนพนักงานปรับได้ 10 / 20 / 30 / 50 คน หรือ `auto`

## ฉากทดสอบ (scenario)

| รหัส | ชื่อ | ทดสอบอะไร |
|---|---|---|
| `TEAM-AI` | ทีม DeepSeek + Kafka สุ่มโจมตีข้ามแผนก | ทั้ง 10 แผนกคุยประสานผ่าน Kafka ตามแผนของสมองทีม |
| `CHAOS-01` | พายุแย่งเลขที่เอกสาร | ขายปลีก ขายส่ง จัดซื้อ ขอเลขที่เอกสารและบันทึกพร้อมกัน เลขต้องไม่ซ้ำ |
| `CHAOS-02` | ตัดสต็อกหมูชั่งกิโลและหน่วยนับขนาน | สต็อกสองหน่วย (กก. และถุง/ตัว) ต้องตรงกับความเคลื่อนไหว |
| `CHAOS-03` | แย่งดึงใบสั่งขาย/ซื้อใบเดียวกัน | ห้ามดึงเกินยอดค้างส่ง |
| `CHAOS-04` | คำนวณต้นทุน/ปิดงบขณะทุกระบบกำลังคีย์บิล | สั่งคำนวณต้นทุนและสร้างรายการบัญชีใหม่ (rebuild) ระหว่างที่รายการยังเข้าต่อเนื่อง |
| `CHAOS-05` | กดบันทึกซ้ำและแก้บิลเดียวกันชนกัน | ไม่มีหัวบิลกำพร้าหรือ lost update |
| `CHAOS-06` | นำเข้าสินค้าต่างประเทศ ปันส่วนค่าขนส่ง/อากร | ผลรวมต้นทุนแฝงที่ปันส่วนต้องเท่ากับยอดรวม |

นอกจากนี้ มีรหัสฉาก `full_office_simulation` ใน `chaos.ts:161` สำหรับจำลองทั้งออฟฟิศ

## กฎที่ตรวจหลังจบแต่ละรอบ (invariants)

`auditSandboxInvariants` (`chaos-engine.ts:1062`) ตรวจจากฐานข้อมูลและบริการจริง ผลแต่ละข้อมี ค่าที่คาดหวัง ค่าจริง และไฟล์ต้นทางที่เกี่ยวข้อง:

1. สมการบัญชีคู่: ผลรวมเดบิต = เครดิตของใบสำคัญ `UAT-CHAOS-%` ทั้งหมด (ผลต่าง 0.00)
2. สต็อกสองหน่วยตรงกับความเคลื่อนไหวจริง
3. ไม่มีเลขที่เอกสารซ้ำ
4. ป้องกันดึงใบสั่งเกินยอดค้างส่ง
5. ความสมบูรณ์ของธุรกรรม (ไม่มีหัวบิลกำพร้า/deadlock)
6. ความสัมพันธ์ระหว่างตาราง: รหัสสินค้าในรายการต้องมีใน `ic_inventory`, ยอดหัวบิล `ic_trans` ต้องเท่ากับผลรวมรายการย่อย `ic_trans_detail` และเดบิตของ `gl_journal` ต้องเท่ากับผลรวมรายการย่อยบัญชี
7. หน้าเว็บ ERP โหลดได้ HTTP 200 และ backend ออก JWT ให้ฐาน `uat_chaos` ได้ (ที่อยู่เว็บและ backend มาจาก env `FRONTEND_BASE_URL`, `SERVICE_BASE_URL`)
8. รายงานงบทดลอง (`GL_TRIAL_BALANCE`) สร้างได้ทั้ง JSON และ PDF และไฟล์ PDF ถูกต้องตรงกับข้อมูลในฐานทดสอบ
9. ความเสถียรของหน่วยความจำ: แรมว่างต้องไม่ต่ำกว่าเกณฑ์ (RAM Guard)
10. ต้นทุนแฝง (ค่าขนส่ง/อากรนำเข้า): ผลรวมที่ปันส่วนรายการ (`ic_hidden_cost_process_item`) ต้องเท่ากับยอดต้นทุนแฝง และเท่ากับใบปรับปรุงต้นทุน (`ic_trans_detail` ที่ `trans_flag` 66) โดยใบปรับปรุงต้องมี qty เป็น 0

กฎข้อที่ไม่ผ่านถูกส่งเป็น ticket ผ่านสะพาน IssueMate (สถานะ `open` -> `retesting` -> `verified_closed`) และมีข้อความในหัวข้อ Kafka ด้วย

## การเฝ้าแรม (RAM Guard)

`computeRamTelemetry` (`chaos-engine.ts:579`) วัดแรมว่างของเครื่องแล้วแนะนำจำนวนพนักงานและจำนวนงานพร้อมกัน: ว่างน้อยกว่า 4.5 GB แนะนำ 10 คน (พร้อมกัน 4), น้อยกว่า 9 GB แนะนำ 20 (8), น้อยกว่า 16 GB แนะนำ 30 (12), มากกว่านั้นแนะนำ 50 ระหว่างรัน ถ้าแรมว่างต่ำกว่า 2.5 GB (`RAM_GUARD_FLOOR_GB`, `chaos-engine.ts:45`) พนักงานแต่ละคนที่ยังรอคิวจะหน่วงรอ 250 มิลลิวินาทีก่อนเริ่มงานถัดไป (`chaos-engine.ts:1046-1051`) และผลตรวจข้อที่ 9 บอกว่าถูกชะลอ

## Kafka

บัสข้อความมี 4 หัวข้อ: `bc.chaos.commander`, `bc.chaos.team-chat`, `bc.chaos.transactions`, `bc.chaos.issuemate` (`kafka-bus.ts:12-17`) ที่อยู่ broker อ่านจาก env `CHAOS_KAFKA_BROKER` และชื่อคอนเทนเนอร์เริ่มต้นคือ `bc-chaos-kafka` ตอนเชื่อมต่อ ระบบสร้างหัวข้อที่ยังไม่มีให้เอง (3 พาร์ทิชัน replication factor 1) แล้วตั้งผู้รับ (consumer group `bc-chaos-office-live-consumer`) ฟังครบทั้ง 4 หัวข้อ (`kafka-bus.ts:60-94`)

## วิธีสั่งงาน

`POST /api/chaos` (`route.ts:12`) รับ `action` ได้ 5 แบบ:

| action | ทำอะไร |
|---|---|
| `runWave` (หรือไม่ระบุ action) | รันหนึ่งรอบตาม `scenarioId` (ค่าเริ่มต้น `deepseek_kafka_autonomous_team`) รันซ้อนกันไม่ได้ ถ้ารอบก่อนยังไม่จบจะโยน error |
| `setHeadcount` | ตั้ง `preset` = auto/10/20/30/50 |
| `autopilot` | `start` / `pause` / `restart` โหมด 24/7 |
| `customOrder` | ส่งคำสั่งภาษาไทยให้ทีม (`promptTh`) ระบบจับคู่คำสั่งกับฉากและแผนก และมีกลไกตัดคำสั่งซ้ำ/ถี่เกินไป |
| `retestIssue` | รันซ้ำเพื่อตรวจ ticket (`ticketCode`) |

อื่น ๆ: `POST /api/sandbox` สร้าง/ล้างฐานแซนด์บ็อกซ์ (`resetClean`), `GET /api/status` ดูสถานะ

## โหมด Autopilot 24/7 และการแจ้งเมื่อแก้โค้ด

- เมื่อเปิด autopilot ตัวตั้งเวลาเรียก `runNextAutopilotTick` (`chaos-engine.ts:2464`) ตามช่วงวินาทีที่ตั้ง ครั้งละหนึ่งรอบ และข้ามถ้ายังมีรอบรันค้างอยู่ ลำดับคือ (0) ตรวจว่ามีไฟล์ใน `backend/` หรือ `frontend/src/` เปลี่ยนในโฟลเดอร์ทำงาน (`:2419`) ถ้ามีจะรันฉากที่เกี่ยวข้องแล้วจบรอบนั้น (1) ถ้ามี ticket สถานะ `open` และนับรอบเป็นเลขคี่ ให้รันซ้ำเพื่อตรวจ ticket แรก (2) ถ้ามีคำสั่ง `customOrder` ค้างคิว ให้รันคำสั่งนั้น (3) ถ้าไม่มีทั้งหมดนี้ก็รอรับโจทย์ที่ส่งเข้ามาทาง API
- AI ตัวใดแก้โค้ดเสร็จสามารถปลุก Chaos Lab ได้ทันทีด้วยสคริปต์ `scripts/notify-chaos-lab.mjs`:

```
node scripts/notify-chaos-lab.mjs --files "backend/internal/..." --summary "แก้ระบบตัดสต็อก 2 หน่วยนับ"
```

  สคริปต์ส่ง `POST /api/code-changed` พร้อมรายการไฟล์ (ถ้าไม่ระบุจะอ่านจาก `git status`) ที่อยู่ปลายทางตั้งได้ด้วย env `CHAOS_LAB_URL` แล้วพิมพ์ผล `invariantsPassed` และจบด้วยรหัส 1 ถ้ากฎใดไม่ผ่าน จึงใช้เป็นด่านในขั้นตอนทำงานได้
- ฟังก์ชัน `mapChangedFilesToScenario` เลือกฉากจากชื่อไฟล์ที่เปลี่ยน

## ค่าที่ต้องมี

| ชื่อ | ใช้ทำอะไร |
|---|---|
| env `DEEPSEEK_API_KEY` | คีย์สมองทีม (ไม่มีคีย์ สมองทีมทำงานไม่ได้) |
| env `BCBRAIN_MCP_URL` | ที่อยู่ MCP ของ BC Brain สำหรับดึงความรู้ประกอบแผน |
| env `CHAOS_KAFKA_BROKER` | ที่อยู่ Kafka |
| env `UAT_PG_*`, `UAT_PSQL` | เชื่อมฐานข้อมูลและเครื่องมือ psql |
| env `ISSUEMATE_MCP_URL`, `ISSUEMATE_TOKEN`, `ISSUEMATE_PROJECT` | ปลายทางเปิด ticket |
| env `FRONTEND_BASE_URL`, `SERVICE_BASE_URL` | ที่อยู่เว็บและ backend ที่ตรวจในข้อ 7 |

## ที่มาในโค้ด
- `uat/chaos-lab/package.json:2-8` ชื่อแพ็กเกจและ script พอร์ต 3055
- `uat/chaos-lab/src/types/chaos.ts:1-11` รหัสแผนก, `:78-82` หัวข้อ Kafka, `:161-169` รหัสฉาก
- `uat/chaos-lab/src/lib/chaos-engine.ts:43-45` ชื่อฐาน `uat_chaos` ป้าย `uat-tester` และเพดานแรม, `:145` รายการแผนก, `:381` รายการฉาก, `:579` เฝ้าแรม, `:806` สร้าง/ล้างฐาน, `:1062` ตรวจกฎ, `:1901` รันหนึ่งรอบ, `:2419` ตรวจ git, `:2464` autopilot
- `uat/chaos-lab/src/lib/kafka-bus.ts:9-17` broker และหัวข้อ
- `uat/chaos-lab/src/lib/deepseek-brain.ts:9-15` โมเดลเริ่มต้นและที่อยู่ BC Brain
- `uat/chaos-lab/src/app/api/chaos/route.ts:12-103` ตัวรับคำสั่ง, `api/code-changed/route.ts:6`, `api/sandbox/route.ts:6`
- `scripts/notify-chaos-lab.mjs:1-61` สคริปต์ปลุกเมื่อแก้โค้ด
- ดูเพิ่ม: [[sys-uat-overview]] · [[sys-uat-swarm-ops-and-automation]] · [[sys-scripts-overview]] · [[std-uat-issuemate-workflow]]
