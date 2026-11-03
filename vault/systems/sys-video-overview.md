---
title: "ภาพรวมวิดีโอสาธิตระบบ (Video Systems Overview)"
tags: [systems, video, demo, playwright, ffmpeg]
aliases: ["video-autocare", "video-fraudwarning", "video-wms", "video-workmonitor", "video-promo", "คลิปสาธิต", "วิดีโอแนะนำระบบ", "mp4 สาธิต"]
sources: ["video-promo/capture.mjs:1", "video-autocare/capture.mjs:1-3", "video-autocare/script.json:1-8", "video-autocare/render.mjs:1-3", "video-autocare/render.mjs:37-40", "video-fraudwarning/capture.mjs:1-3", "video-wms/capture.mjs:1-3", "video-wms/render.mjs:1-3", "video-workmonitor/capture.mjs:1-2", "video-promo/capture.mjs:1-6", "video-promo/video.html:65-120", "video-autocare/lib.mjs:4", "video-fraudwarning/lib.mjs:4", "video-wms/lib.mjs:4", "video-workmonitor/lib.mjs:4", "video-autocare/reset.mjs:1-3"]
---
# ภาพรวมวิดีโอสาธิตระบบ

ที่รากของโปรเจกต์มีโฟลเดอร์ `video-*` ห้าโฟลเดอร์ แต่ละโฟลเดอร์ผลิตวิดีโอแนะนำระบบหนึ่งคลิป เป็นไฟล์ mp4 ความละเอียด 1920x1080 ที่ 30 เฟรมต่อวินาที มีเสียงพากย์ภาษาไทย ซับไตเติลไทย และกราฟิกเน้นจุด ภาพทั้งหมดเป็นหน้าจอจริงของระบบ หรือภาพนิ่งหน้าจอจริงของเว็บสาธิต (ส่วนหัวของ `video-promo/capture.mjs` ระบุว่าไม่ใช้ภาพที่สร้างขึ้น) วิธีผลิตเหมือนกันทุกโฟลเดอร์ อธิบายไว้ใน [[sys-video-shared-pipeline]] รายละเอียดของแต่ละคลิปอยู่ใน [[sys-video-clips-catalog]]

โฟลเดอร์เหล่านี้ไม่ได้เป็นส่วนของเว็บหรือ backend ที่ผู้ใช้เห็น เป็นเครื่องมือฝั่งนักพัฒนาสำหรับทำสื่อการตลาดและการสอน และไม่เกี่ยวกับมาตรฐานทำวิดีโอสอน 1440p ใน [[std-video-tutorial-production]] ซึ่งเป็นสายการผลิตอีกชุดที่ใช้ `media/product-video`

## คลิปทั้งห้า

| โฟลเดอร์ | เรื่อง | ฉาก | ความยาวโดยประมาณ | ชนิดฉาก | ที่อยู่เว็บที่อัด |
|---|---|---|---|---|---|
| `video-autocare` | ระบบบริหารร้านยางและศูนย์บริการรถยนต์ รับรถจนถึงลงบัญชี | 24 | 11 นาที 10 วินาที | `clip` 21, `flow`, `benefits`, `cta` | env `AC_BASE` |
| `video-fraudwarning` | 3D แจ้งเตือนพฤติกรรมน่าสงสัยของพนักงาน พร้อม AI คัดกรอง | 22 | 8 นาที 51 วินาที | `clip` 16, `pitch`, `steps`, `split`, `mcp`, `tips`, `cta` | env `WM_BASE` |
| `video-wms` | คลังสินค้า หยิบ-แพ็ค-ส่ง และสต็อกสองชั้น | 22 | 8 นาที 43 วินาที | `clip` 16, `pitch`, `dual`, `data`, `mcp`, `tips`, `cta` | env `WM_BASE` |
| `video-workmonitor` | 3D จอพนักงาน ดูหน้าจอสดในห้องสามมิติ | 12 | 3 นาที 5 วินาที | `clip` 8, `flow`, `emp`, `tips`, `cta` | env `WM_BASE` |
| `video-promo` | แนะนำระบบทั้งชุด 12 ส่วนจากภาพนิ่งหน้าเว็บสาธิต | 16 | 3 นาที 48 วินาที | `hook`, `hub`, `screen` 12, `flow`, `cta` | กำหนดตายตัวในโค้ด |

จำนวนฉากและชนิดนับจาก `script.json` ของแต่ละโฟลเดอร์ ส่วนความยาวมาจาก `timeline.json` ที่สร้างล่าสุด (บอกเวลาจบฉากสุดท้าย) จึงเปลี่ยนเมื่อแก้บท

## สิ่งที่แต่ละโฟลเดอร์มี

- `script.json` บทพากย์และชนิดฉาก
- สคริปต์ Node ของสายการผลิต: `tts.mjs`, `capture.mjs`, `build.mjs` (ไม่มีใน promo), `render.mjs` และ `lib.mjs` (ไม่มีใน promo)
- `video.html` หน้าที่ประกอบกราฟิก ซับ และเฟรมที่อัดไว้ให้เป็นภาพตามเวลา
- `youtube.txt` ข้อความอัปโหลด YouTube
- ผลลัพธ์ที่สร้างขึ้นระหว่างผลิต (มีไม่ครบทุกโฟลเดอร์): `tts/`, `narration.wav`, `timeline.json`, `clips/`, `data.js`, `boxes.json`, `facts.json` และไฟล์ mp4 ของคลิป
- เฉพาะ `video-autocare` มี `reset.mjs` (คืนฐานเดโมหลังอัด), `peek.mjs` (ดูเฟรมที่อัดไว้), `pg.sh` และ `dbbak/` (ไฟล์สำรองตาราง `autocare_*`)

## เทคนิคที่ใช้ร่วมกัน

- **บทไป เสียงไป ภาพไป** บทเป็น JSON ให้ ElevenLabs ทำเสียงพากย์ไทยพร้อมเวลาของทุกตัวอักษร เวลาเหล่านั้นกำหนดทั้งซับไตเติลและจังหวะที่สคริปต์คลิกหน้าจอจริง
- **อัดหน้าจอจริงด้วย Playwright** เปิด Chrome เป็นภาพ 1920x1080 จริง บันทึกเฟรมผ่าน CDP screencast และบันทึกตำแหน่งเมาส์แยกต่างหาก แล้ววาดเคอร์เซอร์ทับทีหลัง
- **ประกอบเป็นหน้าเว็บ** กราฟิกเขียนด้วย HTML/CSS เป็นฟังก์ชันของเวลา เรนเดอร์ได้ซ้ำเท่าเดิมทุกครั้ง ข้อความไทยจึงสระและวรรณยุกต์ถูกต้องเพราะ Chrome วาดเอง
- **เรนเดอร์เป็น mp4** ส่งภาพทีละเฟรมเข้า ffmpeg: H.264 `crf 18`, เสียง AAC 384 kbps, ปรับความดังที่ -14 LUFS (`render.mjs:37-40`)

## ความปลอดภัยของข้อมูล

- อัดบนสำเนาเว็บที่รันแยกในเครื่องและฐานข้อมูลเดโม (เช่น `video-wms/capture.mjs:1-3`) ฐานของ `video-fraudwarning` เป็น MongoDB แยกต่างหาก และ `video-workmonitor` เก็บสถานะห้องในหน่วยความจำ จึงไม่ปนข้อมูลระบบจริง
- ฉากที่เขียนข้อมูลลงฐานเดโม (เช่น ปิดบิลใน AutoCare) ต้องคืนฐานหลังอัด `video-autocare/reset.mjs` ทำหน้าที่นี้
- ห้ามให้ชื่อลูกค้าจริงปรากฏในภาพ ตามกฎใน [[std-video-tutorial-production]]
- คีย์เสียงพากย์ ElevenLabs อ่านจากไฟล์ในเครื่อง ไม่อยู่ใน repo ไม่ลงในบันทึกนี้
- ในคลิปที่พูดถึง AI ผ่าน MCP บทระบุตรง ๆ ว่าเป็นส่วนเสริมที่ต้องตั้งค่าเอง ไม่ได้ติดมากับหน้าจอ

## ข้อควรรู้

- คลิปที่อัดหน้าจอสดต้องรันระบบจริงในเครื่องระหว่างอัด ถ้าแก้เฉพาะกราฟิกใน `video.html` รัน `node render.mjs` ใหม่ได้โดยไม่ต้องอัดซ้ำ
- ความยาวคลิปตามเสียงพากย์ แก้บทแล้วเฉพาะฉากที่ข้อความเปลี่ยนที่จะเรียกบริการเสียงใหม่ (แคชตามข้อความ) ใน `video-autocare` และ `video-wms` การคลิกผูกกับเวลาของคำพูดในฉาก จึงควรอัดฉากที่แก้ซ้ำด้วย `ONLY=ชื่อฉาก`

## ที่มาในโค้ด
- `video-autocare/script.json:1-8`, `video-autocare/capture.mjs:1-3` โครงบทและส่วนหัวของการอัด
- `video-autocare/render.mjs:1-3`, `:37-40` คำสั่งเรนเดอร์และพารามิเตอร์ ffmpeg, `video-wms/render.mjs:1-3`
- `video-fraudwarning/capture.mjs:1-3`, `video-wms/capture.mjs:1-3`, `video-workmonitor/capture.mjs:1-2`, `video-promo/capture.mjs:1-6` วิธีอัดของแต่ละคลิป
- `video-autocare/lib.mjs:4`, `video-fraudwarning/lib.mjs:4`, `video-wms/lib.mjs:4`, `video-workmonitor/lib.mjs:4` ที่อยู่เว็บที่อัดอ่านจาก env
- `video-promo/video.html:65-120` ชนิดฉากของคลิป promo, `video-autocare/reset.mjs:1-3` คืนฐานเดโม
- ดูเพิ่ม: [[sys-video-shared-pipeline]] · [[sys-video-clips-catalog]] · [[std-video-tutorial-production]]
