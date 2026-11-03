---
title: "สายการผลิตวิดีโอสาธิตแบบ 1080p (Video Shared Pipeline)"
tags: [systems, video, playwright, ffmpeg, elevenlabs, tts]
aliases: ["tts.mjs", "capture.mjs", "render.mjs", "build.mjs", "video.html", "timeline.json", "script.json", "window.seek", "ONLY=", "screencast", "ซับไตเติลอัตโนมัติ"]
sources: ["video-autocare/script.json:1-8", "video-autocare/tts.mjs:5-26", "video-autocare/tts.mjs:28-60", "video-autocare/tts.mjs:61-65", "video-autocare/lib.mjs:7-9", "video-autocare/lib.mjs:24-48", "video-autocare/lib.mjs:51-56", "video-autocare/capture.mjs:1-19", "video-autocare/capture.mjs:21-48", "video-autocare/capture.mjs:74-79", "video-autocare/capture.mjs:94-95", "video-autocare/build.mjs:1-9", "video-autocare/video.html:88-102", "video-autocare/video.html:193-213", "video-autocare/video.html:293-313", "video-autocare/render.mjs:1-24", "video-autocare/render.mjs:26-50", "video-wms/render.mjs:19-21", "video-promo/capture.mjs:1-20", "video-autocare/youtube.txt:1", "video-autocare/peek.mjs:1"]
---
# สายการผลิตวิดีโอสาธิตแบบ 1080p

โฟลเดอร์ `video-autocare`, `video-fraudwarning`, `video-wms`, `video-workmonitor` และ `video-promo` ที่รากของโปรเจกต์ ใช้สายการผลิตเดียวกัน คือเขียนบทเป็น JSON แล้วให้สคริปต์ Node ทำเสียงพากย์ อัดหน้าจอจริงของระบบ ประกอบเป็นหน้า HTML และเรนเดอร์ออกเป็น mp4 ความละเอียด 1920x1080 ที่ 30 เฟรมต่อวินาที ไม่ใช้โปรแกรมตัดต่อ ทุกโฟลเดอร์คัดลอกโค้ดชุดเดียวกันไปปรับใช้เอง (ไม่มีโมดูลกลางร่วมกัน) รายชื่อคลิปอยู่ใน [[sys-video-overview]] และเนื้อหาแต่ละคลิปอยู่ใน [[sys-video-clips-catalog]] ส่วนมาตรฐานการทำวิดีโอสอนแบบ 1440p อีกชุดหนึ่งอยู่ที่ [[std-video-tutorial-production]] ซึ่งเป็นคนละสายการผลิต

```
script.json --tts.mjs--> tts/*.pcm|json + narration.wav + timeline.json
timeline.json --capture.mjs--> clips/<ฉาก>/{f*.jpg,index.json,cursor.json} + boxes.json + facts.json (+ sfx.json)
clips + boxes + facts --build.mjs--> data.js
video.html + data.js + timeline.json --render.mjs--> <ชื่อคลิป>.mp4
```

คำสั่งรันทีละขั้นคือ `node tts.mjs`, `node capture.mjs`, `node build.mjs`, `node render.mjs` ในโฟลเดอร์ของคลิปนั้น

## บท: script.json

เป็นอาร์เรย์ของฉาก แต่ละฉากมี `id`, `type`, `badge` (ป้ายหัวข้อที่โชว์มุมจอ) และ `say` (คำพากย์) ใน `video-promo` ไม่มี `badge` แต่มี `points` สำหรับการ์ดข้อความ `type` คือชื่อ builder ใน `video.html` เช่น `clip` (ฉากอัดหน้าจอจริง), `cta` และการ์ดเฉพาะคลิป

ในคำพากย์ มีสองรูปแบบพิเศษที่ `tts.mjs` ตีความ
- `[warm, confident]` เป็นแท็กโทนเสียง ถูกส่งไปกับข้อความให้ ElevenLabs แต่ตัดออกจากซับไตเติล
- `{แสดง|อ่าน}` ให้ซับไตเติลโชว์คำแรก แต่เสียงอ่านคำหลัง ใช้กับตัวย่อ ตัวเลข และคำอังกฤษ

## เสียง: tts.mjs

- เรียก ElevenLabs แบบ `with-timestamps` ภาษาไทย โมเดล `eleven_v4` ได้เสียง PCM 48 kHz mono 16 บิต พร้อมเวลาเริ่ม-จบของทุกตัวอักษร (`tts.mjs:15-26`) คีย์ API อ่านตอนรันจากไฟล์คีย์ในเครื่องนอก repo ไม่ใช่จาก env และไม่พิมพ์ออกหน้าจอ (`tts.mjs:1-7`) รหัสเสียงที่ใช้ก็ไม่ลงในบันทึกนี้
- แคชต่อฉาก ชื่อไฟล์ใน `tts/` มาจาก SHA-1 ของโมเดล เสียง ค่าตั้ง และข้อความ (`:32`) แก้บทเฉพาะฉากไหน ก็เรียกบริการใหม่เฉพาะฉากนั้น
- ถ้าบริการตอบ 429 หรือ 5xx จะลองใหม่สูงสุด 4 ครั้ง เว้นช่วงเพิ่มเป็นสองเท่า ถ้าตอบ 400 ขณะส่ง `previous_request_ids` (ผูกคำขอ 3 รายการก่อนหน้าให้น้ำเสียงต่อเนื่อง) จะส่งใหม่โดยไม่ผูก (`:19-22`)
- เวลาในไทม์ไลน์: เว้นเงียบก่อนพูด 0.5 วินาที (`LEAD`) หลังพูด 0.9 วินาที (`TAIL`) และฉาก `cta` ค้างท้ายเพิ่ม 3 วินาที (`END`) (`:6`, `:56`)
- ซับไตเติลแบ่งก้อนละไม่เกิน 44 ตัวอักษร (`MAXSUB`) ด้วยการเรียงคำ แล้วหาเวลาจากตำแหน่งข้อความในผล alignment ก้อนที่หาไม่เจอจะยืมเวลาจากก้อนข้างเคียง (`:41-55`)
- เขียน `narration.wav` ต่อทุกฉากเป็นไฟล์เดียว และ `timeline.json` ที่ใส่ `start`, `end`, `vStart`, `vEnd`, `subs`, `cues` ต่อฉาก (`:57-65`)
- `cues` คือเวลาของแต่ละคำพูดในฉาก ใช้ให้การคลิกปุ่มและกรอบกราฟิกตรงกับคำที่พูด มีเฉพาะ `video-autocare` และ `video-wms` เท่านั้น ส่วน `video-fraudwarning` และ `video-workmonitor` กำหนดเวลาด้วยออฟเซ็ตจากต้นฉาก (เช่น `s.start + 4.3`) ซึ่งตรงคำพูดน้อยกว่า

## อัดหน้าจอ: lib.mjs และ capture.mjs

`lib.mjs` เปิด Chrome ที่ติดตั้งในเครื่องผ่าน Playwright หน้าต่างขนาด CSS 1440x810 ตั้ง device scale factor ให้ได้ภาพจริง 1920x1080 (`lib.mjs:7-9`) ซ่อนแถบ overlay ของ Next dev ด้วย init script (`:5`, `:14`) `startRec` ใช้ CDP `Page.startScreencast` (JPEG คุณภาพ 90) บันทึกเวลารับเฟรมเทียบนาฬิกากลาง แล้วตอนจบจัดเฟรมให้เป็นดัชนี 30 เฟรมต่อวินาทีคงที่ โดยเลือกเฟรมล่าสุดที่เวลาไม่เกินช่องนั้น เขียนเฉพาะเฟรมที่ถูกใช้พร้อม `index.json` (`:24-48`) ฟังก์ชัน `box` คืนกรอบขององค์ประกอบเป็นพิกเซลของภาพ 1920x1080 (`:51-56`) ที่อยู่เว็บที่จะอัดอ่านจาก env (`AC_BASE` ใน `video-autocare`, `WM_BASE` ในโฟลเดอร์อื่น) ค่าเริ่มต้นชี้ไปเว็บที่รันแยกในเครื่อง

`capture.mjs` เป็นการรันต่อเนื่องหนึ่งรอบตามนาฬิกากลางของ `timeline.json` (`capture.mjs:1-16`)
- เมาส์ในโหมด headless ไม่มีเคอร์เซอร์จริงในภาพ จึงมี `driver` ที่เลื่อนเมาส์แบบ ease พร้อมบันทึกเส้นทางลง `cursor.json` ให้ `video.html` วาดเคอร์เซอร์ทับ (`:21-35`) การคลิกถูกจัดเวลาให้ตรงคำพูดด้วย `C(ฉาก, "คำ")` ที่แปลง cue เป็นเวลานาฬิกากลาง (`:19`, `:32`)
- `typeAt` พิมพ์ทีละตัวอักษรด้วยจังหวะสุ่มเหมือนคนพิมพ์ และบันทึกเหตุการณ์ปุ่มกด (`:74-79`) ทุกคลิกและปุ่มกดลง `sfx.json` เพื่อทำเสียงประกอบ
- `scene(id, fn)` รอถึงเวลาเริ่มฉาก เริ่มอัด รันขั้นตอนของฉาก หยุดอัดหลังจบฉาก 0.3 วินาที แล้วเขียน `clips/<ฉาก>/` ถ้าขั้นตอนพัง จะพิมพ์ error แล้วไปฉากต่อไป (`:39-48`)
- `grab(ชื่อ, selector)` เก็บกรอบองค์ประกอบลง `boxes.json` และฉากต่าง ๆ เก็บค่าที่ได้จากการรันจริง (เลขใบงาน เลขเอกสาร ข้อความผลลัพธ์) ลง `facts.json` เพื่อให้กราฟิกโชว์ตรงกับที่เห็นบนจอ
- ตัวแปร `ONLY=ฉาก1,ฉาก2` ซ้อมเฉพาะฉากที่ระบุ โดยโหลด `boxes.json`, `facts.json`, `sfx.json` เดิมมาเก็บส่วนที่ไม่เกี่ยว และเลื่อนนาฬิกากลางให้เริ่มที่ฉากแรกที่เลือก (`:7-13`, `:94-95`) `video-workmonitor` และ `video-promo` ไม่มีโหมดนี้

`video-promo/capture.mjs` ต่างออกไป ไม่ได้อัดวิดีโอ แต่เปิดเว็บสาธิตสาธารณะทีละเส้นทาง 12 หน้า ถ่ายภาพนิ่งลง `shots/` และเก็บข้อความบนหน้าไว้ในไฟล์ `notes.json` เพื่อใช้ค้นข้อมูลเขียนบท (`video-promo/capture.mjs:1-20`)

## ประกอบข้อมูล: build.mjs

อ่านทุกโฟลเดอร์ใน `clips/` (ดัชนีเฟรมและเส้นทางเคอร์เซอร์) รวมกับ `boxes.json` และ `facts.json` แล้วเขียน `data.js` เป็น `window.DATA = {...}` ให้ `video.html` โหลด (`build.mjs:1-9`) ไม่มีใน `video-promo` เพราะคลิปนั้นใช้ภาพนิ่งจาก `shots/` โดยตรง

## หน้าประกอบ: video.html

หน้านี้เป็นฟังก์ชันของเวลาล้วน ๆ ไม่มีตัวจับเวลา จึงเรนเดอร์ซ้ำได้ผลเดิม มีสองจุดเข้า `window.init(timeline)` สร้างแต่ละฉากจาก builder ตาม `type` และ `window.seek(t)` ตั้งภาพของทุกฉากที่เวลา `t` (`video.html:293-313`)
- แต่ละฉาก fade เข้าออก 0.45 วินาที ป้าย `badge` โผล่หลังต้นฉาก 0.3 วินาที ซับไตเติลเลือกก้อนที่ช่วงเวลาครอบ `t` (`:297-312`)
- builder `clip` วาดหน้าต่างเบราว์เซอร์จำลอง แล้วแสดงเฟรมที่อัดไว้ตามดัชนี พร้อมกล้องซูมตามคีย์เฟรม (`camAt`, `zoomOn`) กรอบเน้น (callout) พร้อมหมายเลขและป้ายข้อความ วางตาม `boxes.json` และตั้งเวลาด้วยคำพูดผ่านฟังก์ชัน `seq` (`:88-102`, `:193-213`)
- ถ้าหา box ไม่เจอ จะเตือนใน console แล้วข้ามกรอบนั้น ถ้าหา cue ไม่เจอ จะเตือนและใช้เวลา 0 ไม่ทำให้การเรนเดอร์ล้ม (`:95`, `:206-208`)

## เรนเดอร์: render.mjs

เปิด Chrome ที่ 1920x1080 โหลด `video.html` รอฟอนต์และรูป decode เสร็จ แล้ววนทุกเฟรม (`ceil(ความยาว x 30)`) สั่ง `seek(f/30)` ถ่าย JPEG คุณภาพ 93 ส่งเข้า ffmpeg ทาง stdin รอ drain เมื่อบัฟเฟอร์เต็ม (`render.mjs:26-50`)

- ffmpeg: H.264 High, `preset slow`, `crf 18`, GOP 15, yuv420p สี bt709 ช่วง tv, เสียง AAC 384 kbps 48 kHz สเตอริโอ, `+faststart` (`render.mjs:37-40`)
- เสียงปรับความดัง `loudnorm I=-14 TP=-1.5 LRA=11` ทุกโฟลเดอร์ (เช่น `video-wms/render.mjs:19-21`)
- เฉพาะ `video-autocare` ที่ผสมเสียงคลิก/พิมพ์ด้วย: `writeSfx` สังเคราะห์ `sfx.wav` จาก `sfx.json` ด้วยโค้ด (เสียงเสียดสีสั้นกับโทนที่ดับเร็ว) แล้ว `amix` กับเสียงพากย์ก่อน loudnorm (`render.mjs:10-24`, `:38`) โฟลเดอร์อื่นมีแต่เสียงพากย์
- รันพร้อมตัวเลข เช่น `node render.mjs 5 40 120` จะไม่เรนเดอร์วิดีโอ แต่ถ่ายภาพนิ่งที่วินาทีเหล่านั้นลง `check/t<วินาที>.jpg` ไว้ตรวจเลย์เอาต์ (`render.mjs:2-3`, `:30-34`)

## เครื่องมือเสริม

- `video-autocare/peek.mjs <ฉาก> วินาที...` ทำภาพรวมเฟรมที่อัดไว้ (วาดจุดแดงตรงตำแหน่งเมาส์) เป็นไฟล์เดียวใน `check/` ไว้ดูผลอัดโดยไม่ต้องเรนเดอร์ (`peek.mjs:1`)
- `youtube.txt` ในแต่ละโฟลเดอร์เก็บข้อความสำหรับอัปโหลด แบ่งส่วนชื่อวิดีโอ คำอธิบาย บทในวิดีโอ (เวลาเริ่มแต่ละบท) และแท็ก (`video-autocare/youtube.txt:1`)

## ข้อจำกัดที่ควรรู้

- โค้ดถูกคัดลอกต่อโฟลเดอร์ แก้บั๊กหนึ่งจุดต้องไล่แก้ทุกที่ และค่าคงที่ (เสียง โมเดล ความยาวช่วงเว้น) ฝังในโค้ดของแต่ละโฟลเดอร์
- คีย์ ElevenLabs มาจากไฟล์ในเครื่อง ไม่ใช่ env `ELEVENLABS_API_KEY` ตามมาตรฐานใน [[std-video-tutorial-production]]
- การอัดต้องมีระบบจริงรันอยู่ในเครื่องพร้อมฐานข้อมูลเดโม ใช้เวลาเท่าความยาวคลิก เพราะคลิกตามเวลาจริง และฉากที่พังต้องซ้อมซ้ำด้วย `ONLY=`

## ที่มาในโค้ด
- `video-autocare/script.json:1-8` รูปแบบฉาก
- `video-autocare/tts.mjs:5-26`, `:28-60`, `:61-65` ค่าคงที่ การเรียก ElevenLabs แคช ซับไตเติล cue และไฟล์ WAV
- `video-autocare/lib.mjs:7-9`, `:24-48`, `:51-56` ขนาดเฟรม screencast และ `box`
- `video-autocare/capture.mjs:1-48`, `:74-79`, `:94-95` นาฬิกากลาง เคอร์เซอร์ พิมพ์ ซ้อมด้วย `ONLY`
- `video-autocare/build.mjs:1-9` สร้าง `data.js`
- `video-autocare/video.html:88-102`, `:193-213`, `:293-313` ตัวช่วยเวลา กล้อง callout `init` และ `seek`
- `video-autocare/render.mjs:1-50` และ `video-wms/render.mjs:19-21` เรนเดอร์และพารามิเตอร์ ffmpeg
- `video-promo/capture.mjs:1-20` ถ่ายภาพนิ่งหน้าเว็บสาธิต
- ดูเพิ่ม: [[sys-video-overview]] · [[sys-video-clips-catalog]] · [[std-video-tutorial-production]]
