---
title: "บทเรียนช่องตัวเลขและกฎศูนย์แสดงเป็นว่าง (NumberBox & Blank-Zero)"
tags: [history, lesson, numberbox, input, blank-zero, frontend]
aliases: ["NumberBox", "ศูนย์แสดงเป็นว่าง", "blank zero", "isZeroDecimal", "formatMoneyDisplay", "useFocusDraft", "decimalSql", "evalArithmeticSafe"]
sources: ["AGENTS.md:41", "AGENTS.md:42", "frontend/shared/ui/NumberBox.tsx:27", "frontend/shared/ui/NumberBox.tsx:63", "frontend/shared/ui/NumberBox.tsx:66", "frontend/shared/ui/NumberBox.tsx:153", "frontend/shared/ui/NumberBox.tsx:169", "frontend/shared/ui/NumberBox.tsx:242", "frontend/shared/ui/useSelectAllOnFocus.ts:14", "frontend/src/lib/numeric.ts:7", "frontend/src/lib/numeric.ts:110", "frontend/src/lib/numeric.ts:553", "frontend/src/lib/numeric.ts:587", "frontend/src/lib/numeric.ts:842", "frontend/src/lib/numeric.test.ts:38", "frontend/src/lib/numeric.test.ts:110", "frontend/src/lib/numeric.test.ts:120", "frontend/src/lib/numeric.test.ts:142", "frontend/shared/ui/dateText.ts:30", "frontend/shared/ui/DateBox.tsx:126", "frontend/shared/ui/dateText.test.ts:37", "frontend/account/pos/PosSetupAndControlScreen.tsx:1431"]
---

# บทเรียนช่องตัวเลขและกฎศูนย์แสดงเป็นว่าง

ช่องตัวเลขของทุกหน้าจอใช้ `NumberBox` / `CommaNumberInput` ร่วมกัน และกฎของระบบคือค่า `0` หรือ `0.00` ต้องแสดงเป็นช่องว่างทั้งหน้าจอและรายงาน (`AGENTS.md:41`) ถ้าช่องกลางพลาดหรือหน้าจอใดเช็กค่าศูนย์เอง ผู้ใช้จะเห็นเลขที่พิมพ์หาย ค่าที่ส่งเข้า SQL ผิดรูป หรือศูนย์โผล่ในที่ที่ต้องว่าง

## อะไรพังได้
- **ศูนย์ไม่ว่าง**: ค่าตัวเลขจากฐานข้อมูลเป็นข้อความ `"0.00"` ซึ่งเป็น truthy ใน JavaScript ถ้าเขียน `x ? x : ""` ช่องจะแสดง 0.00
- **พิมพ์เร็วหลังคลิกแล้วตัวแรกหาย**: การเลือกทั้งช่องที่ทำช้ากว่าปุ่มแรก ทำให้ปุ่มถัดไปเขียนทับ (พิมพ์ 123456 ได้ 23,456)
- **ข้อความที่ผู้ใช้กำลังพิมพ์ถูกทับ** ด้วยค่าที่โปรแกรมเติมเข้ามาทีหลัง (เช่น ระบบเติมราคาหลังเลือกสินค้า)
- **ค่าที่พิมพ์ค้าง** (`5.`, `.5`, `-`) ส่งเข้า SQL ไม่ได้
- **ช่องจำนวนเต็มรับ `30.00`** แล้วเอาเลขหลังจุดมาต่อกลายเป็น 3000
- **เครื่องคิดเลขตีความ `100+7%` ผิด** เป็น 100.07 แทน 107
- **วันที่ที่ไม่มีจริง** (31/02) ผ่านช่องวันที่ไปถึง SQL

## โค้ดป้องกันไว้อย่างไร
| ด่าน | ที่อยู่ | ทำอะไร |
|---|---|---|
| เช็กศูนย์ด้วยตัวเลข ไม่ใช่ข้อความ | `frontend/src/lib/numeric.ts:553` `isZeroDecimal` | ปัดตามทศนิยมแล้วเทียบเป็นเลข จึงจับ `0`, `0.00`, `-0.00` ได้; ค่าว่าง `-` `.` ก็นับเป็นศูนย์; เทส `numeric.test.ts:120` |
| แสดงผลศูนย์เป็นว่าง | `numeric.ts:587` `formatMoneyDisplay` | ปัดแล้วถ้าเป็นศูนย์คืน `""` ไม่งั้นใส่จุลภาคและทศนิยมตาม `erp_option`; ทุกช่องใน `NumberBox.tsx:136` และ `:278` เรียกตัวนี้ |
| หน้าจอที่เขียนเงื่อนไขเอง | `frontend/account/pos/PosSetupAndControlScreen.tsx:1431` | รูปแบบที่ถูกคือ `Number(x) ? x : ""` (ไม่ใช่ `x ? x : ""`) |
| เลือกทั้งช่องก่อนปุ่มแรก | `frontend/shared/ui/useSelectAllOnFocus.ts:14` | ใช้ `useLayoutEffect` เลือกใน commit เดียวกับ focus และเลือกซ้ำตอนปล่อยเมาส์ถ้ายังไม่ได้ลากเลือกเอง |
| ไม่ทับสิ่งที่ผู้ใช้พิมพ์ | `frontend/shared/ui/NumberBox.tsx:27` `useFocusDraft` | มีธง `typed`: ยังไม่พิมพ์ค่อยปรับข้อความตามค่าใหม่, พิมพ์แล้วห้ามทับ |
| ปิดค่าที่พิมพ์ค้าง | `NumberBox.tsx:63` `isUnfinishedNumber`, `:66` `finishNumber` | ตอน blur `5.` -> `5`, `.5` -> `0.5`, `-` -> `0` แล้วจึงส่งต่อ |
| ส่งเข้า SQL อย่างเข้มงวด | `frontend/src/lib/numeric.ts:110` `decimalSql` | รับ `.5`/`5.` และจุลภาค ถ้ารูปแบบผิดโยน error (ไม่ส่งค่าเดา); เทส `numeric.test.ts:38` |
| ช่องไม่รับทศนิยม | `numeric.ts:7` `cleanNumericString` | ตัดส่วนหลังจุดทิ้ง `30.00` -> `30` ไม่ใช่ลบจุดแล้วต่อเลข; เทส `numeric.test.ts:142` |
| วางข้อความ | `NumberBox.tsx:169` `onPaste` | ตัดข้อความตามตำแหน่ง caret บนค่าที่ปรากฏจริง (มีจุลภาค) แล้วทำความสะอาดซ้ำ |
| เครื่องคิดเลขไม่ใช้ eval | `numeric.ts:842` `evalArithmeticSafe` | parser เลขฐานใหญ่ `x + y%` = x + x*y/100 (`100+7%` = 107); ข้อความแปลกคืน `null`; เทส `numeric.test.ts:110` |
| วันที่ต้องมีจริง | `frontend/shared/ui/dateText.ts:30` `dmyToIso` | คืน `null` เมื่อวันที่ไม่มีจริง; `DateBox.tsx:126` แจ้ง "ป้อนวันที่ผิดพลาด" แล้วล้างช่องตอน blur; เทส `dateText.test.ts:37` |

## กฎที่ต้องจำ
- ค่าตัวเลขจากฐานข้อมูลเป็นข้อความ ห้ามเช็ก truthiness ใช้ `isZeroDecimal` หรือ `Number(x) ? x : ""`
- ช่องตัวเลขใช้ `NumberBox` และในตารางใช้ `CommaNumberInput` เพื่อให้ได้กฎศูนย์ว่าง การเลือกทั้งช่อง และการปิดค่าที่ค้างชุดเดียวกัน (`AGENTS.md:41`)
- `decimalSql` โยน error กับค่าผิดรูป (ไม่ส่งค่าเดาเข้า SQL) ถ้าจะให้ได้ค่าเริ่มต้นแทนต้องส่ง fallback เป็นพารามิเตอร์ที่สองอย่างตั้งใจ
- การเลือกทั้งช่องต้องเกิดแบบ synchronous ก่อนปุ่มแรกมาถึง และห้ามเขียนทับ draft ที่ผู้ใช้เริ่มพิมพ์แล้ว
- วันที่ที่ไม่มีจริงต้องถูกปฏิเสธที่ชั้นแปลง (`dmyToIso` = `null`) ไม่รอให้ SQL ล้ม; รูปแบบวันที่และปีตาม `year_type` ดู `AGENTS.md:42`
- แก้บั๊กรูปแบบเดียวกันต้อง grep ทุกจุดที่ใช้ pattern เดิม เพราะกฎศูนย์ว่างกระจายอยู่ทั้งในช่องกลางและในหน้าจอที่เขียนเงื่อนไขเอง

## ที่มาในโค้ด
- `frontend/shared/ui/NumberBox.tsx:27-100` ตัวช่วยร่างข้อความ ปิดค่าค้าง
- `frontend/src/lib/numeric.ts:553-640` ศูนย์ว่างและการแสดงผลเงิน
- `frontend/shared/ui/useSelectAllOnFocus.ts:14-38` เลือกทั้งช่อง
- ดูเพิ่ม: [[hist-lessons-rounding-decimal]] · [[hist-lessons-dates-buddhist-year]] · [[std-input-controls-and-labels]] · [[fe-numeric-money]] · [[history-overview]]
