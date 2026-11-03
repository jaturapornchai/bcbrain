---
title: "ผลิตวิดีโอสอนใช้งาน YouTube 1440p (Video Tutorial Production)"
tags: [standards, video, playwright, ffmpeg, process]
aliases: ["วิดีโอสอน", "product-video", "demo-video", "rec.mjs", "record.mjs", "render-mg.mjs", "build.mjs", "motion graphic", "ElevenLabs", "1440p", "loudnorm -14 LUFS"]
sources: ["media/product-video/tts.mjs:7-8", "video-promo/tts.mjs:7-8", "video-autocare/tts.mjs:7", "video-fraudwarning/tts.mjs:7", "video-wms/tts.mjs:7", "video-workmonitor/tts.mjs:7", "docs/kms/video-tutorial-production.md:12-21", "docs/kms/video-tutorial-production.md:57-65", "docs/kms/video-tutorial-production.md:83-88", "media/product-video/script.md:1", "media/product-video/record.mjs:1", "media/product-video/rec.mjs:7", "media/product-video/rec.mjs:27-29", "media/product-video/build.mjs:7", "media/product-video/build.mjs:106", "media/product-video/build.mjs:126-129"]
---

# ผลิตวิดีโอสอนใช้งาน YouTube 1440p

เอกสาร KMS นี้กำหนดวิธีทำวิดีโอสอน BC AI Account ให้ตัวหนังสือบนจออ่านออกทุกตัว ดูเหมือนคนจริงเล่น และมี motion graphic คั่นบท ตัวอย่างงานแรกคือคลิป "สอนใช้หน้าจอสินค้า + บาร์โค้ด" ที่ `media/product-video/` (ต่อยอดจาก `media/demo-video/`)

## กฎ/วิธีทำ
1. **สเปกภาพ**: viewport 1920×1080 + `deviceScaleFactor` 4/3 ได้ภาพจริง 2560×1440 (`rec.mjs:27-29`) (ห้ามตั้ง viewport 2560 ตรงๆ เพราะตัวหนังสือจะเล็ก) ส่งออก 30fps, H.264 High, `yuv420p` bt709 — เอกสาร (`:17`) ระบุ CRF 16–18 และ AAC 320k แต่ `build.mjs` ตั้ง CRF 18 และ AAC 384k จริง (`build.mjs:127`, `:129`) ให้ยึดโค้ด
2. **เสียงพากย์**: ElevenLabs เสียงไทย normalize −14 LUFS (`loudnorm=I=-14`, `build.mjs:106`); ที่มาของคีย์ API แยก 2 แบบตามโค้ด: `tts.mjs` ใน `media/demo-video` และ `media/product-video` อ่านจาก env `ELEVENLABS_API_KEY` (`:7-8`) ส่วน `tts.mjs` ใน `video-autocare`, `video-fraudwarning`, `video-promo`, `video-wms`, `video-workmonitor` อ่านจากไฟล์คีย์ในโฟลเดอร์ข้อมูลโปรแกรมของผู้ใช้เครื่องนั้นตอนรัน (`:7`) และอ่านบทจาก `script.json` (`:8`) ทุกแบบไม่พิมพ์ค่าคีย์ ห้ามเขียนคีย์หรือที่อยู่ไฟล์คีย์ลง repo/log/โน้ต
3. **ซับไทย**: ไฟล์ `.ass` + filter `ass=...:shaping=complex` (`build.mjs:126`; `PlayResX 2560` / `PlayResY 1440`) เพราะ `subtitles=`/`drawtext` ทำวรรณยุกต์หาย; ข้อความ motion graphic เรนเดอร์จาก HTML/CSS ใน Chrome เพื่อให้สระ/วรรณยุกต์ไทยถูกต้อง
4. **ภาพประกอบใช้จอจริงเท่านั้น** ห้ามสร้างภาพจากบริการภายนอก
5. **ข้อมูลที่อัด**: อัดจากฐานเดโม `bcdemo` เท่านั้น (ทุกฉาก) ฉากเพิ่ม/แก้ใช้รหัสทดลองขึ้นต้น `VDO-` แล้วลบทิ้งหลังอัดเสร็จ — โฮสต์ที่เอกสารระบุ (`:59`) ไม่ตรงกับ `BASE` ใน `media/product-video/rec.mjs:7` ให้ตรวจ `BASE` ก่อนอัดทุกครั้งว่าเป็นกิจการเดโม
6. **ห้ามแสดงข้อมูลลูกค้าจริงในวิดีโอเด็ดขาด** (ชื่อกิจการ ภาพ ตัวเลข ชื่อสินค้า/คู่ค้า ในบท, motion graphic และภาพปก) หน้าจอเลือกกิจการที่มีชื่อลูกค้าต้องตัดหรือเบลอ
7. **เนื้อหาภาษี/บัญชี** ในบทต้องตรวจกับแหล่งทางการก่อน (เคยพลาดอ้างมาตราผิดจาก AI จนต้องตัดทิ้ง)

## ขั้นตอนผลิต
```
script.md -> tts.mjs -> tts/*.pcm + tts.json
scout.mjs -> shots/*.png        (สำรวจจอจริง ตัดเมนูที่ยังเป็นจอ generic ออกจากบท)
record.mjs -> clips/<ฉาก>.mp4 + .json   (marks + เหตุการณ์ click/key)
mograph/*.html -> render-mg.mjs -> mg/<ฉาก>.mp4
build.mjs -> ต่อฉาก + ซูม + ซับ + พากย์ + เสียงคลิก/คีย์ -> final.mp4
```
- **บท**: 1 ฉาก = 1 ย่อหน้า `> ` ใช้ `{แสดง|อ่าน}` กำหนดเสียงอ่านคำอังกฤษ/ตัวเลข ทุกบทเริ่มจากปัญหาหน้าร้าน → ทำบนจอ → สรุป 1 บรรทัด
- **ดูเหมือนคนเล่น**: เมาส์ easeInOutCubic 450–900 ms หยุดค้าง 300–600 ms ก่อนคลิก พิมพ์ทีละตัวจังหวะสุ่ม ±40% (พิมพ์ผิดแล้ว Backspace ได้ไม่เกิน 1–2 ครั้งทั้งคลิป) เสียงคลิก/คีย์สังเคราะห์ด้วย JS ใน `build.mjs` เบากว่าพากย์ราว 18 dB
- **Motion graphic**: `render-mg.mjs` หยุด animation ทั้งหมดแล้วเลื่อน `currentTime` ทีละ 1/30 วินาที ถ่ายภาพเข้า ffmpeg; ชุดมาตรฐาน Title card, Chapter card, Callout, Key badge โทนสีแบรนด์ emerald บนพื้นมืด
- ช่วงรอโหลดเกิน 1.5 วินาที เร่ง 3–5 เท่าตอนประกอบ (ไม่ต้องอัดใหม่)

## คำสั่งตัวอย่าง (จาก `media/product-video`)
```bash
node scout.mjs                  # ถ่ายจอจริงทุกเมนูในบท
node render-mg.mjs s01-title    # motion graphic ฉากเปิด
node tts.mjs                    # พากย์ (โฟลเดอร์นี้ต้องตั้ง ELEVENLABS_API_KEY ใน env ก่อน)
node record.mjs report          # กลุ่ม report เปิด Chrome แบบมีหน้าต่าง (headless แสดง PDF ไม่ได้)
node record.mjs cleanup         # ลบสินค้า VDO-xxxx หลัง build ผ่านแล้ว
node build.mjs                  # -> bc-product-barcode-1440p.mp4
```

## ตรวจก่อนส่ง (ห้ามข้าม)
- `ffprobe` ได้ 2560×1440, 30fps, มีภาพและเสียง ความยาวตรงแผน
- ดึงเฟรมทุกบทมาดู: ตัวหนังสืออ่านออก ซับไม่บังจุดที่พูด สระ/วรรณยุกต์ไม่ลอย
- `loudnorm` วัดได้ −14 ±1 LUFS และเสียงคลิกไม่กลบพากย์
- ทุกเฟรมต้องเป็นกิจการเดโม ไม่มีข้อมูลลูกค้าจริง/รหัสผ่าน/token บนจอ

## ข้อจำกัดและจุดต้องรู้ของจอจริง
- เมาส์/คีย์เป็น event จำลองใน Chrome (เคอร์เซอร์วาดเอง) และเสียงคีย์เป็นเสียงสังเคราะห์; ElevenLabs อ่านเลขเมนู/รหัสสินค้าไม่เป็นธรรมชาติ จึงต้องใช้ `{แสดง|อ่าน}`
- บันทึกสินค้าต้องมีคลังอย่างน้อย 1 แถว (กด `All WareHouse` ก่อนบันทึก); ปุ่ม `แก้ไข` มีกล่องยืนยันที่ต้องกดก่อน; หน้ารายงานต้องกดปุ่ม `ค้นหา` ตัวกรองจึงมีผล
- ไฟล์ 1440p ใหญ่ราว 1.5–2 GB ต่อ 15 นาที
- ตรวจแล้ว: โฟลเดอร์ `media/product-video/` (สคริปต์ `scout/record/build/render-mg/tts`) และ `video-promo/node_modules/playwright` มีอยู่จริง; เอกสารระบุให้ใช้ skill `ffmpeg` ระดับเครื่อง (ไม่ได้อยู่ใน repo)

## ที่มา
- `docs/kms/video-tutorial-production.md` §1–§10 (ละส่วนแผนบทรายละเอียดของคลิปตัวอย่างและค่าเชื่อมต่อ)
- `media/product-video/build.mjs`, `rec.mjs`, `record.mjs` (ชื่อไฟล์ปลายทางที่โค้ดตั้งคือ `bc-product-barcode-1440p.mp4`, `build.mjs:7`)

## ดูเพิ่ม
[[standards-overview]] · [[std-uat-swarm-dsl-and-tester-rules]] · [[std-repo-scope-rules]] · [[process-overview]] · [[sys-video-shared-pipeline]]
