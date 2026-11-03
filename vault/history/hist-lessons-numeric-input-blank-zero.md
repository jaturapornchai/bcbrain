---
title: "บทเรียน ช่องตัวเลข/วันที่และกฎ 'ศูนย์แสดงเป็นว่าง' (Numeric input, DateBox and blank-zero)"
tags: [history, numberbox, datebox, input, blank-zero]
aliases: ["NumberBox lessons", "DateBox lessons", "blank zero bug", "DATEBOX-INVALID-BLUR", "NUMBERBOX-RESYNC"]
sources: ["git:82dbe5d4", "git:65344f12", "git:faa6e6d0", "git:848b9e05", "git:309f9986", "git:4758d54a", "git:5fa7e098", "AGENTS.md:40-41"]
---

## ภาพรวม
`DateBox`/`NumberBox` เป็น widget กลางที่ทุกหน้าจอใช้ แก้ผิดที่เดียวพังทั้งระบบ ช่วง 22-24 ต.ค. 2026 เจอ 4 กลุ่ม: วันที่ที่พิมพ์ (slash หาย/วันที่เป็นไปไม่ได้ผ่าน), ปุ่มแรกหลัง focus หาย, ตัวเลขกึ่งสำเร็จ (`5.`, `.5`, `100+7%`) เพี้ยน, และค่า 0 ที่ต้องว่างแต่ DB ส่ง string `'0.00'` ซึ่ง truthy ใน JS ทุกเคสแก้ที่ widget/helper กลาง ไม่แก้ทีละหน้าจอ

## อาการ
- A) พิมพ์ `1/2/2569` slash ถูกกิน; `31/02/2026` ช่องรับค่าทั้งที่ไม่มีวันนั้น
- B) UAT NB-1/M-3/OBS-LOOKUP-FASTTYPE: พิมพ์เร็วหลัง focus `123456` ได้ `23,456`, `1122-00` ได้ `122-00`
- C) `100+7%` ได้ 100.07 (ควร 107); `"30.00"` ในช่องจำนวนเต็มกลายเป็น `"300"`; วาง/พิมพ์ `.5`/`5.` ถูกปฏิเสธหรือ caret กระโดด (N1-N4)
- D) ช่องราคา 0 โชว์ `0.00` ทั้งที่กติกาตาม C# คือเว้นว่าง

## สาเหตุ (root cause)
- A) ฟอร์แมตระหว่างพิมพ์ไม่รู้ว่า slash มาจากผู้ใช้ และ `dmyToIso` ไม่ตรวจว่าวันที่มีจริง (diff `82dbe5d4` ตรวจแล้ว)
- B) select-all หลัง focus ใช้ `requestAnimationFrame` จึงช้ากว่า keystroke แรก ปุ่มแรกถูก select ทับ; อีกชั้น draft ถูก resync จากค่าที่ backend เติมระหว่างผู้ใช้กำลังพิมพ์ (NUMBERBOX-RESYNC)
- C) (diff `faa6e6d0` ตรวจแล้ว) ช่องไม่รับทศนิยมลบจุดแล้วเอาเลขมาต่อ แทนตัดส่วนหลังจุด; `decimalSql` ไม่รับ `.5`/`5.` ที่ NumberBox เก็บตามที่พิมพ์; `%` ถูกตีเป็นเศษส่วนแทน "บวก 7% ของ 100"; caret นับบนข้อความที่มี comma (`1,234`)
- D) `848b9e05` เขียน `x ? x : ""` แต่ DB ให้ `'0.00'` (truthy) จึงไม่ว่าง ต้องแก้ซ้ำใน `309f9986` เป็น `Number(x) ? x : ""` บั๊กเดิมพลาดสองรอบ

## วิธีแก้
- A) `82dbe5d4`: `formatDateTyping` เก็บ slash ที่ผู้ใช้พิมพ์ไม่เติมซ้ำ; `dmyToIso` คืน `null` เมื่อวันที่เป็นไปไม่ได้; blur ผิดเตือน "ป้อนวันที่ผิดพลาด" แล้วล้างช่อง (DATEBOX-INVALID-BLUR). `65344f12` พอร์ต `_myDateBox._checkDate` ของ C#: ตัวคั่น `' ' '-' '.' '*'` = `/`, ส่วนที่ขาดเอาจากวันที่ทำงาน, รับ ddmm/ddmmyy, ปี 2 หลัก = 20yy (มติ R3g SHAREDUI). `5fa7e098` ปรับให้รู้ `year_type`: พ.ศ. = 2500+yy
- B) `82dbe5d4`: select-all เป็น `useLayoutEffect` แบบ synchronous; `useFocusDraft` มี flag `typed` + `seenValue`/`selectEpoch` พิมพ์แล้วห้ามทับ draft ด้วยค่า programmatic
- C) `faa6e6d0`: ตัดส่วนหลังจุด, `decimalSql` normalize `.5`/`5.` ก่อนตรวจ, `100+7%`=107, วางข้อความใช้ `input.value`, blur เรียก `finishNumber()` (`5.`->`5`, `.5`->`0.5`, `-`->`0`) commit นี้รวมแก้ security หลายข้อด้วย
- D) `309f9986` แก้เป็น `Number(x) ? x : ""`; `4758d54a` เปลี่ยน input ธรรมดาใน SerialStockCountScreen/TransTopForm เป็น `NumberBox` และเก็บราคา 0 เป็น `""`

## commit ที่เกี่ยวข้อง
`82dbe5d4` (DateBox, select-all, RESYNC), `65344f12` (`completeDmy`), `5fa7e098` (ปี 2 หลักตาม year_type), `faa6e6d0` (N1-N4, N5 `invalidateBcSettings`, N6 `formatThaiDate`), `848b9e05` -> `309f9986` (blank-zero), `4758d54a` (input -> NumberBox)

## โค้ดปัจจุบันที่ป้องกัน
- `frontend/shared/ui/dateText.ts:30,51,71` (`dmyToIso`, `completeDmy`, `formatDateTyping`; ปี 2 หลัก `:61-62`); เทสต์ `frontend/shared/ui/dateText.test.ts`
- `frontend/shared/ui/DateBox.tsx:132` (alert + ล้างเมื่อ blur ผิด)
- `frontend/shared/ui/useSelectAllOnFocus.ts:20` (`useLayoutEffect` select ทันที)
- `frontend/shared/ui/NumberBox.tsx:27,31,63,66` (`useFocusDraft`, `typed`, `isUnfinishedNumber`, `finishNumber`)
- `frontend/src/lib/numeric.ts:110,553,842` (`decimalSql`, `isZeroDecimal`, `evalArithmeticSafe`); เทสต์ `numeric.test.ts:115,144`
- รูปแบบที่ถูก: `frontend/account/pos/PosSetupAndControlScreen.tsx:1431` (`Number(x) ? x : ""`)

## บทเรียน / กฎที่ได้
1. ค่าตัวเลขจาก DB เป็น string (`'0.00'`) ห้ามเช็ก truthiness ใช้ `Number(x)` หรือ `isZeroDecimal`
2. ช่องตัวเลข/วันที่ใช้ `NumberBox`/`DateBox` เท่านั้น ห้าม `<input>` ธรรมดา
3. select-all ต้อง synchronous ก่อน keystroke แรก และห้าม resync draft ทับสิ่งที่ผู้ใช้เพิ่งพิมพ์
4. ปฏิเสธวันที่เป็นไปไม่ได้ที่ชั้นแปลง (`dmyToIso` = `null`) ไม่ใช่รอ SQL ล้ม
5. แก้บั๊กรูปแบบเดียวกันต้อง grep ทุกจุดที่ใช้ pattern เดิม (blank-zero พลาดสองรอบ)
6. ยังไม่ได้ตรวจ diff `4758d54a` ครบทุกไฟล์ (ตรวจเฉพาะส่วน input -> NumberBox และ blank-zero)

## ดูเพิ่ม
[[hist-lessons-dates-buddhist-year]] · [[hist-lessons-rounding-decimal]] · [[std-input-controls-and-labels]] · [[fe-numeric-money]] · [[acc-rounding-decimal]] · [[std-frontend-ux-bug-lessons]] · [[history-overview]]

## ที่มาในโค้ด
repo `bcaiaccount` (อ่านอย่างเดียว): `frontend/shared/ui/{dateText.ts,DateBox.tsx,NumberBox.tsx,useSelectAllOnFocus.ts}`, `frontend/src/lib/numeric.ts`, `AGENTS.md:40-41`, diff ของ `82dbe5d4`, `65344f12`, `faa6e6d0`, `848b9e05`, `309f9986`, `4758d54a`, `5fa7e098`
