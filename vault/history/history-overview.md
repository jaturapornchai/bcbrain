---
title: "ประวัติและบทเรียนของระบบ BC Ai Account (History Overview)"
tags: [history, overview, moc, lessons]
aliases: ["ประวัติระบบ", "history hub", "บทเรียนทั้งหมด", "lessons index", "บั๊กที่เจอซ้ำ"]
sources: ["frontend/src/lib/session-name.ts:16", "AGENTS.md:33", "AGENTS.md:61", "docs/kms/KMS_SECURITY_DATA_INTEGRITY_LESSONS.md:1", "docs/kms/KMS_INDEX.md:1", ".agents/skills/secure-api-data-integrity-checklist/SKILL.md", "scripts/deploy-web-prod.mjs:66", "frontend/src/config/buildInfo.ts:2", "TODO.md:96"]
---
# ประวัติและบทเรียนของระบบ BC Ai Account

หน้านี้เป็นสารบัญ (MOC) ของมิติ "ประวัติและบทเรียน" แต่ละหน้าที่ลิงก์ไว้เล่าเรื่องเดียวกันเสมอ: **อะไรพังได้ → โค้ดวันนี้ป้องกันอย่างไร → อยู่ที่ไหน → กฎที่ต้องจำ** และมีเฉพาะบทเรียนที่ยังเห็นหลักฐานในโค้ด เทสต์ หรือเอกสารของ repo ปัจจุบัน (กฎเหล็กใน `AGENTS.md:33-84`, คลังบทเรียนใน `docs/kms/KMS_SECURITY_DATA_INTEGRITY_LESSONS.md`, เช็กลิสต์ใน `.agents/skills/secure-api-data-integrity-checklist/SKILL.md`)

## แผนที่บันทึกบทเรียน
| หมวด | โน้ต | ใจความ |
|---|---|---|
| เงินและบัญชี | [[hist-lessons-rounding-decimal]] | เงินใช้ `big.Rat` เลือกโหมดปัดตามจุดใช้ และทศนิยมมาจาก `erp_option` |
| | [[hist-lessons-gl-posting-balance]] | เดบิต = เครดิตบังคับด้วย `ValidateAndBalanceJournal` และบัญชีต้องอยู่ในผัง |
| | [[hist-lessons-vat-tax-mistakes]] | ปีภาษีเก็บ ค.ศ. ทุกเอกสารที่ลง VAT ต้องอยู่ใน `transVatTabs` เลขใบกำกับกันซ้ำด้วยล็อก |
| | [[hist-lessons-payment-cheque-tenders]] | ยอดช่องทางชำระ + WHT ต้องเท่ายอดสุทธิ ยอดบิลคำนวณใหม่ใน backend ภายใต้ล็อก |
| | [[hist-lessons-stock-cost-moving-average]] | ต้นทุนถัวเฉลี่ยคำนวณซ้ำจากรายการดิบ ไม่สะสมทีละก้อน |
| เอกสาร | [[hist-lessons-trans-save-rules]] | กฎตอนบันทึกอยู่ใน Go ภายใน transaction เดียว browser เป็นแค่ผู้ถาม (409 `CONFIRM:`) |
| | [[hist-lessons-doc-ref-docflow]] | สถานะ Document Flow คำนวณที่เดียว (`docFlowTx`) และดึงอ้างอิงมีกติกาตายตัว |
| | [[hist-lessons-serial-lot-shipment]] | Serial/ข้อมูลขนส่งเขียนใน transaction เดียวกับเอกสาร แล้ว rebuild `ic_serial` ซ้ำได้ |
| | [[hist-lessons-cancel-delete-partial]] | ยกเลิก/ลบต้องเช็กว่ามีใครอ้างอิง ลบ GL กลับรายการ และยอดหัวบิลผ่านทางเดียว |
| ข้อมูลหลักและสคีมา | [[hist-lessons-master-save-preserve-columns]] | บันทึก master ไม่ลบทิ้งแล้วสร้างใหม่ทั้งแถว เพื่อไม่ให้คอลัมน์นอกจอหาย |
| | [[hist-lessons-schema-drift-invented-columns]] | ชื่อคอลัมน์ต้องตรง `information_schema`/สคริปต์สคีมา มีเทสต์เทียบ |
| ธุรกรรมและพร้อมกัน | [[hist-lessons-atomic-transactions-swallowed-errors]] | เขียนหลายตารางใน `ExecBatch` เดียว คืน error ทุกจุด ยอด derive คำนวณใหม่ |
| | [[hist-lessons-concurrency-advisory-locks]] | advisory lock เรียงลำดับคงที่ (สต็อกรายสินค้า, GL shared/exclusive, บิล) |
| | [[hist-lessons-performance-and-load]] | งานเบื้องหลังต้องมี session/single-flight/timeout กรองก่อน `LIMIT` |
| ความปลอดภัย | [[hist-lessons-query-gateway-write-lockdown]] | ทุกช่องทางเขียนจาก browser ใช้นโยบายตารางเดียวกัน |
| | [[hist-lessons-permission-rights]] | `RequireRight` ปิดไว้ก่อน (fail-closed) แยกสิทธิ์ตามฐานข้อมูล |
| | [[hist-lessons-tenant-auth-sessions]] | ผู้เช่ามาจาก session refresh แบบ single-flight ตรวจ Google token และกุญแจ fail-closed |
| | [[hist-lessons-web-vulns-xss-redirect]] | `safeReturnPath`, `escapePopupHtml`, `safeMediaContentType` |
| หน้าจอและผลลัพธ์ | [[hist-lessons-grid-ux-regressions]] | ตาราง/เลย์เอาต์ที่ถอยหลังง่าย ตัวลากคอลัมน์ ผลโหลดซ้อน |
| | [[hist-lessons-hidden-tab-hotkeys-dirty-guard]] | แท็บ MDI ที่ซ่อนอยู่ต้องไม่รับคีย์ลัด และถามก่อนทิ้งข้อมูลที่แก้ค้าง |
| | [[hist-lessons-numeric-input-blank-zero]] | ศูนย์แสดงว่าง เลือกทั้งช่องเมื่อโฟกัส และพิมพ์ `.5` ได้ |
| | [[hist-lessons-dates-buddhist-year]] | DB เก็บ ค.ศ. หน้าจอ/รายงานแปลงตาม `year_type` และใช้ `todayLocal()` |
| | [[hist-lessons-thai-text-pdf]] | ตัวเลข/วันที่ไม่ตกบรรทัด ตัดคำไทยไม่แยกสระ ใน PDF |
| | [[hist-lessons-report-engine-rules]] | รายงานกลาง: ทะเบียนรายงาน ชนิดคอลัมน์ ไม่ตัดแถวเงียบๆ |
| | [[hist-lessons-uat-regression-checks]] | เทสต์ถอยหลังที่เหลืออยู่ในโค้ดและเกตสิทธิ์ของ Custom SQL |
| สถานะงาน | [[hist-todo-open-items]] | ข้อจำกัดที่ผู้พัฒนาประกาศไว้ในโค้ดและงานที่ `TODO.md` ยังค้าง |

## รูปแบบบั๊กที่วนซ้ำ
1. **เขียนครึ่งๆ กลางๆ แล้วตอบสำเร็จ** — ทิ้ง error ของคำสั่งเขียน หรือเขียนทีละคำสั่งนอก transaction → [[hist-lessons-atomic-transactions-swallowed-errors]], [[hist-lessons-serial-lot-shipment]]
2. **ยอดสะสมแทนที่จะคำนวณใหม่** — ต้นทุน เครดิต ยอดช่องเก็บ ควร rebuild จากรายการดิบให้ได้ผลเดิมทุกครั้ง → [[hist-lessons-stock-cost-moving-average]], [[hist-lessons-concurrency-advisory-locks]]
3. **ประตูเขียนข้อมูลหลายบาน** — query gateway, blob, proxy ต้องใช้นโยบายเดียวกัน → [[hist-lessons-query-gateway-write-lockdown]], [[hist-lessons-permission-rights]]
4. **ผล async ลงผิดเอกสาร/ผิดแท็บ** — โหลดซ้อน คีย์ลัดของแท็บที่ซ่อน listKey ชน → [[hist-lessons-hidden-tab-hotkeys-dirty-guard]], [[hist-lessons-grid-ux-regressions]]
5. **ตัวเลขและวันที่** — float, ปัดผิดจุด, `+543` ฝังตายตัว, `toISOString()` เป็น UTC → [[hist-lessons-rounding-decimal]], [[hist-lessons-dates-buddhist-year]], [[hist-lessons-numeric-input-blank-zero]]
6. **เชื่อสิ่งที่ browser ส่งมา** — อีเมล ผู้เช่า `returnTo` Content-Type → [[hist-lessons-tenant-auth-sessions]], [[hist-lessons-web-vulns-xss-redirect]]

## ประวัติของ repo นี้ (`git log`)
repo `bcaiaccount` ปัจจุบันมีประวัติสั้น: 6 commit ทั้งหมดอยู่ในวันเดียว (3 พ.ย. 2026) ประวัติรุ่นก่อนไม่ได้ติดมา
| ลำดับ | commit ทำอะไร |
|---|---|
| 1 | จุดเริ่มประวัติ BC Ai Account: นำเข้าโค้ดทั้งชุด (1,334 ไฟล์ — backend Go, frontend Next.js, POS, สคริปต์ SQL, เอกสาร KMS, ชุด UAT) |
| 2 | แก้ชื่อโปรเจกต์ใน `README.md` ให้เป็น `bcaiaccount` |
| 3 | `video-autocare/pg.sh` อ่านรหัสผ่านฐานข้อมูลจากไฟล์ตั้งค่าของ BC แทนที่ตายตัว |
| 4 | ย้ายทุกโฮสต์มาอยู่ใต้โดเมน `bcsmethai.com` (คงคำนำหน้าโฮสต์เดิม), รายชื่อโฮสต์ที่ล็อกอินสาธิตอัตโนมัติเหลือเฉพาะโฮสต์สาธิต เพื่อไม่ให้โดเมนหลักพาผู้เยี่ยมชมเข้า `bcdemo` เอง (ตรวจที่ `frontend/src/lib/session-name.ts:16`), ปรับ OAuth redirect ในเอกสาร KMS ให้ตรง route `/api/auth/google` |
| 5 | แก้สคริปต์ deploy `scripts/deploy-web-prod.mjs`: สร้างไฟล์ tar ด้วยชื่อสัมพัทธ์ในโฟลเดอร์ temp เพราะ GNU tar ใน Git Bash อ่าน `C:` เป็นชื่อเครื่องปลายทาง (คอมเมนต์ที่ `scripts/deploy-web-prod.mjs:66`) |
| 6 | ประทับรุ่น/เวลา deploy ใน `frontend/src/config/buildInfo.ts` (`BUILD_INFO.version`, `deployedAt`) เป็น deploy ครั้งแรกขึ้นโดเมนใหม่ |

บทเรียนในหน้าอื่นๆ จึงไม่ได้ผูกกับ commit ใด แต่ผูกกับโค้ด เทสต์ และกฎใน `AGENTS.md` ที่มีอยู่จริงตอนนี้ — ถ้าโค้ดเปลี่ยน ให้ตรวจ `path:line` ในหัวข้อ "ที่มาในโค้ด" ของแต่ละหน้าใหม่

## วิธีอ่านอย่างระวัง
- เลขบรรทัดอ้างตามไฟล์บนดิสก์ ณ ตอนเขียน ถ้าไฟล์ถูกแก้ ให้ค้นชื่อฟังก์ชันที่ระบุไว้แทน
- ข้อที่ระบุว่า "ไม่ได้ตรวจ" ในแต่ละหน้า คือสิ่งที่ยังไม่มีหลักฐานในโค้ด จึงไม่ได้นับเป็นบทเรียน

## ดูเพิ่ม
[[standards-overview]] · [[adr-index]] · [[std-data-integrity-money-transactions]] · [[std-frontend-ux-bug-lessons]] · [[std-security-lessons-idor]] · [[acc-rounding-decimal]] · [[acc-gl-rebuild]] · [[acc-inventory-stock-rebuild]] · [[std-report-pdf-thai-wrap-multilevel]]

## ที่มาในโค้ด
- `AGENTS.md:33-84` กฎเหล็กประจำโปรเจกต์, `docs/kms/KMS_INDEX.md` สารบัญ KMS, `docs/kms/KMS_SECURITY_DATA_INTEGRITY_LESSONS.md` คลังบทเรียนความปลอดภัยและความถูกต้องของข้อมูล
- `git -C <repo> log --oneline` ได้ 6 commit; `scripts/deploy-web-prod.mjs:66`, `frontend/src/config/buildInfo.ts:2-4`
- `TODO.md:96` รายการแผนงานที่ยังค้าง (ดู [[hist-todo-open-items]])
