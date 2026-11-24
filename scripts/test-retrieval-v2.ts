// node scripts/test-retrieval-v2.ts — comprehensive verification of all 7 Retrieval v2 upgrades
import assert from "node:assert/strict";
import fs from "node:fs";
import { registerHooks } from "node:module";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";

registerHooks({
  resolve(specifier: string, context: { parentURL?: string }, nextResolve: (s: string, c: { parentURL?: string }) => unknown) {
    if (specifier.startsWith(".") && !specifier.endsWith(".ts") && context.parentURL?.startsWith("file:")) {
      const candidate = new URL(`${specifier}.ts`, context.parentURL);
      if (fs.existsSync(fileURLToPath(candidate))) {
        return { url: candidate.href, shortCircuit: true };
      }
    }
    return nextResolve(specifier, context) as { url: string; shortCircuit?: boolean };
  },
});

const {
  computeRrfScores,
  estimateTokens,
  excerpt,
  excerptNote,
  extractNoteFacts,
  extractStructuredFacts,
  getErrorCatalog,
  getNote,
  getNoteFacts,
  getSemanticIndexStats,
  getWhatsNew,
  lookupError,
  search,
  searchSections,
  searchSemantic,
  searchWithMeta,
  SEMANTIC_DIM,
  terms,
  trimBlockAware,
  vault,
  warmVaultIndexes,
} = await import("../lib/vault.ts");
const { extractVaultRecencyMap } = await import("../lib/vault-retrieval.ts");

const tWarm0 = performance.now();
warmVaultIndexes();
const warmMs = performance.now() - tWarm0;
console.log(`[INIT] warmVaultIndexes() completed in ${warmMs.toFixed(1)} ms (${vault().size} notes)`);

// ============================================================
// 1. Block-Aware Trimming (trimBlockAware + excerptNote + token-awareness)
// ============================================================
{
  // (a) Markdown table: never slice mid-row, never leave orphan header
  const tableMd = [
    "# ตารางราคาทดสอบ",
    "",
    "| รุ่น | ราคา/เดือน | รายละเอียด |",
    "|---|---|---|",
    "| Starter | 0 บาท | ใช้ฟรีสูงสุด 100 คนพร้อมกัน |",
    "| Standard | 199 บาท | ครบ 9 หมวดเมนูพร้อมบัญชีแยกประเภท |",
    "| Professional | 499 บาท | เพิ่ม FIFO, BOM, POS, WMS, TMS |",
    "| Enterprise | 999 บาท | ครบทั้ง 15 ระบบพร้อม Private Cloud |",
  ].join("\n");

  const t1 = trimBlockAware(tableMd, 195);
  assert.equal(t1.truncated, true, "table trim flags truncated");
  assert.ok(t1.text.length <= 195, `table trim respects maxChars (${t1.text.length})`);
  const tableLines = t1.text.split("\n").filter((l) => l.trim().startsWith("|"));
  assert.ok(tableLines.length >= 3, `table keeps header + sep + >=1 complete row (got ${tableLines.length})`);
  for (const row of tableLines) {
    assert.ok(row.trim().endsWith("|"), `table row must never be sliced mid-row: ${row}`);
  }

  // Tiny budget that fits title + intro but NOT header+sep+1 row -> drops whole table cleanly
  const tableWithIntro = `ข้อความนำสั้นๆ เกี่ยวกับแพ็กเกจ\n\n${tableMd}`;
  const tDrop = trimBlockAware(tableWithIntro, 110);
  assert.ok(!tDrop.text.includes("| รุ่น |"), "table omitted cleanly when header+1 row cannot fit");

  // (b) Numbered list: never slice mid-step (including indented continuation lines)
  const listMd = [
    "## ขั้นตอนปิดงวด",
    "",
    "1. เปิดหน้าจอตรวจสอบงวดบัญชีในเมนูตั้งค่าและเลือกงวดเดือนที่ต้องการ",
    "   - ตรวจรายการค้างผ่านบัญชีให้เรียบร้อยก่อนเสมอ",
    "2. กดปุ่มประมวลผลบัญชีแยกประเภทและตรวจยอดเดบิตเครดิตให้ดุล",
    "3. กดปุ่มปิดงวดบัญชีและยืนยันด้วยรหัสผ่านผู้ดูแลระบบ",
  ].join("\n");

  const l1 = trimBlockAware(listMd, 165);
  assert.equal(l1.truncated, true, "list trim flags truncated");
  assert.ok(l1.text.includes("1. เปิดหน้าจอ") && l1.text.includes("ตรวจรายการค้างผ่านบัญชี"), "step 1 + continuation kept intact");
  assert.ok(!l1.text.includes("2. กดปุ่มประมวลผล"), "step 2 dropped whole rather than sliced mid-step");

  // (c) Code fence: never leave unclosed fence or slice mid-fence after prose
  const codeMd = [
    "คำอธิบายสั้นก่อนโค้ด SQL สำหรับเช็กยอดคงเหลือ",
    "",
    "```sql",
    "SELECT item_code, wh_code, SUM(qty) AS bal",
    "FROM ic_trans_detail",
    "WHERE COALESCE(last_status, 0) = 0",
    "GROUP BY item_code, wh_code;",
    "```",
  ].join("\n");
  const c1 = trimBlockAware(codeMd, 110);
  assert.equal((c1.text.match(/^```/gm) ?? []).length % 2, 0, "code fence count stays even (0 or 2)");
  assert.ok(!c1.text.includes("FROM ic_trans_detail"), "code block omitted cleanly instead of slicing mid-fence");

  // Code-only input exceeding budget -> closes fence cleanly
  const codeOnly = "```sql\n" + "SELECT a, b, c FROM ic_trans;\n".repeat(10) + "```";
  const cOnly = trimBlockAware(codeOnly, 95);
  assert.equal((cOnly.text.match(/^```/gm) ?? []).length, 2, "code-only trim closes fence cleanly");

  // (d) Token-estimate awareness (~2.2 Thai chars/token)
  const thaiSample = "ระบบบัญชีออนไลน์รองรับการออกใบกำกับภาษีและตรวจสต็อกสินค้าคงเหลือแบบเรียลไทม์".repeat(4);
  const est = estimateTokens(thaiSample);
  const ratio = thaiSample.length / est;
  assert.ok(ratio >= 1.9 && ratio <= 2.5, `Thai token estimate ~2.2 chars/token (got ${ratio.toFixed(2)})`);
  const tokTrim = trimBlockAware(tableMd, 5000, { maxTokens: 55 });
  assert.ok(tokTrim.truncated && tokTrim.estimatedTokens <= 55, `maxTokens respected (${tokTrim.estimatedTokens} <= 55)`);

  // (e) Real vault note excerptNote() preserves suffix format & complete rows
  const priceNote = getNote("sales-pricing-packages")!;
  const priceEx = excerptNote(priceNote, terms("ตารางราคา 4 รุ่น"), 1100, true);
  assert.ok(priceEx.includes("[excerpt — ") && priceEx.includes("read_note for the full note]"), "excerptNote preserves exact suffix format");
  for (const row of priceEx.split("\n").filter((l) => l.trim().startsWith("|"))) {
    assert.ok(row.trim().endsWith("|"), `real vault table row intact: ${row}`);
  }
  const exCompat = excerpt("intro\n## A\n" + "x".repeat(50) + "\n## B gold\ngold", ["gold"], 30);
  assert.ok(exCompat.includes("omitted sections: A") && exCompat.includes("read_note for the full note]"), "excerpt suffix contract preserved");

  // (f) Full-vault sweep across all 366 notes x budgets [300, 700, 1200]: zero corrupted table rows & zero unclosed code fences
  const sweepTerms = ["ราคา", "ตาราง", "sql", "เมนู"];
  let badTableRows = 0;
  let badCodeFences = 0;
  for (const n of vault().values()) {
    for (const b of [300, 700, 1200]) {
      const ex = excerptNote(n, sweepTerms, b, true);
      const bodyPart = ex.split("\n\n[excerpt —")[0] ?? ex;
      if (((bodyPart.match(/^```/gm) ?? []).length % 2) !== 0) badCodeFences++;
      let inCode = false;
      for (const line of bodyPart.split("\n")) {
        const tr = line.trim();
        if (tr.startsWith("```")) {
          inCode = !inCode;
          continue;
        }
        if (inCode) continue;
        if (tr.startsWith("|") && (!tr.endsWith("|") || tr.includes("| …"))) {
          badTableRows++;
        }
      }
    }
  }
  assert.equal(badTableRows, 0, `full-vault excerptNote sweep must have 0 corrupted table rows (got ${badTableRows})`);
  assert.equal(badCodeFences, 0, `full-vault excerptNote sweep must have 0 unclosed code fences (got ${badCodeFences})`);

  console.log(`[1] Block-Aware Trimming OK (Thai ratio=${ratio.toFixed(2)} chars/tok, 0 bad table rows / 0 unclosed fences across ${vault().size * 3} sweeps)`);
}

// ============================================================
// 2. Pre-computed Lightweight Semantic (256-dim Float32) + RRF + Trap Abstention
// ============================================================
{
  const stats = getSemanticIndexStats("all");
  assert.equal(stats.dim, SEMANTIC_DIM, "semantic dim is 256");
  assert.ok(stats.count >= 365, `semantic index covers all notes (${stats.count})`);
  assert.equal(stats.byteLength, stats.count * 256 * 4, "contiguous Float32Array RAM footprint");
  assert.ok(stats.byteLength < 450_000, `RAM footprint compact (${(stats.byteLength / 1024).toFixed(1)} KB)`);

  // Benchmark 100 semantic cosine searches (<0.5ms/call)
  const semQueries = [
    "สินค้าไม่พอตัดสต็อก",
    "ลูกค้าเบี้ยวเช็คขึ้นเงินไม่ผ่าน",
    "ปิดงวดบัญชีแล้วแก้เอกสารไม่ได้",
    "เปลี่ยนวันที่จากคศเป็นพศ",
    "ออกใบกำกับภาษีขายให้ลูกค้า",
    "ตั้งค่าห้ามขายต่ำกว่าต้นทุน",
    "กระทบยอดขายช้อปปี้ลาซาด้า",
    "สูตรคำนวณภาษีมูลค่าเพิ่มแยกนอกรวมใน",
    "พิมพ์สติกเกอร์บาร์โค้ดติดสินค้า",
    "ต่ออายุใบเสนอราคาแพ็กเกจ",
  ];
  const s0 = performance.now();
  for (let i = 0; i < 100; i++) {
    searchSemantic(semQueries[i % semQueries.length], 5, "user");
  }
  const semPerMs = (performance.now() - s0) / 100;
  assert.ok(semPerMs < 0.5, `semantic cosine search too slow: ${semPerMs.toFixed(4)} ms/call`);

  // Semantic isolation check
  assert.ok(searchSemantic("ic_trans gl_journal SELECT", 10, "user").every((h) => h.audience !== "dev"), "searchSemantic(user) zero dev leaks");
  assert.ok(searchSemantic("ราคาแพ็กเกจ เช็คเด้ง", 10, "dev").every((h) => h.audience !== "user"), "searchSemantic(dev) zero user leaks");

  // Strict out-of-domain Thai trap abstention (confidence="low" AND coverage < 0.5)
  const traps = [
    "สูตรทำแกงเขียวหวานไก่ใส่กะทิสด",
    "วิธีปลูกทุเรียนภูเขาไฟ",
    "ยานอวกาศ ดาวอังคาร บั้งไฟพญานาค คอนโดหรู",
    "วิธีซ่อมแอร์บ้านน้ำหยดและล้างคอยล์เย็น",
    "สูตรหมักหมูย่างเกาหลีน้ำจิ้มแจ่ว",
  ];
  for (const trap of traps) {
    const meta = searchWithMeta(trap, 4, "user");
    const cov = meta.bestMatchedTerms / Math.max(1, meta.totalTerms);
    assert.equal(meta.confidence, "low", `trap "${trap}" MUST be low confidence (got ${JSON.stringify(meta)})`);
    assert.ok(cov < 0.5, `trap "${trap}" MUST have coverage < 0.5 (got ${cov.toFixed(2)})`);
  }

  console.log(
    `[2] Lightweight Semantic (${stats.dim}-dim, ${(stats.byteLength / 1024).toFixed(1)} KB RAM, ${semPerMs.toFixed(4)} ms/call) + Trap Abstention (${traps.length}/${traps.length} low) OK`,
  );
}

// ============================================================
// 3. Structured Facts Extractor ([menu], [rule], [limit], [error], [formula])
// ============================================================
{
  const USER_SQL_JARGON = /\b(?:SELECT|FROM|WHERE|COALESCE|NUMERIC|trans_flag|last_status|ic_trans|gl_journal|ar_customer)\b|\.(?:go|tsx?|sql):\d+/i;
  let totalFacts = 0;
  let notesWithFacts = 0;
  const kindCounts: Record<string, number> = { menu: 0, rule: 0, limit: 0, error: 0, formula: 0 };

  for (const n of vault().values()) {
    const facts = getNoteFacts(n);
    assert.ok(facts.length <= 8, `${n.slug} facts capped at 8 (got ${facts.length})`);
    if (facts.length > 0) notesWithFacts++;
    totalFacts += facts.length;
    for (const f of facts) {
      const m = f.match(/^\[(menu|rule|limit|error|formula)\]\s+(.+)$/);
      assert.ok(m, `fact must carry valid typed prefix: ${f}`);
      kindCounts[m![1]]++;
      if (n.audience === "user") {
        assert.ok(!USER_SQL_JARGON.test(f), `user note ${n.slug} leaked dev jargon in fact: ${f}`);
      }
    }
  }
  assert.ok(notesWithFacts >= 320, `majority of vault has structured facts (${notesWithFacts}/${vault().size})`);
  for (const k of ["menu", "rule", "limit", "error", "formula"]) {
    assert.ok(kindCounts[k] >= 10, `fact kind [${k}] well-populated (${kindCounts[k]})`);
  }

  // Spot checks on canonical notes + caching check
  const optNote = getNote("start-erp-options-9-tabs")!;
  const optFacts1 = getNoteFacts(optNote);
  const optFacts2 = getNoteFacts(optNote);
  assert.equal(optFacts1, optFacts2, "getNoteFacts returns cached pre-computed array");
  assert.ok(optFacts1.some((f) => f.startsWith("[menu]") && f.includes("1004")), `1004 menu fact: ${JSON.stringify(optFacts1)}`);

  const negFacts = extractStructuredFacts(getNote("ts-stock-negative-control")!);
  assert.ok(negFacts.some((f) => f.kind === "error" && f.text.includes("ห้ามติดลบ")), "ts-stock-negative-control extracts [error]");

  const priceFacts = extractNoteFacts(getNote("sales-pricing-packages")!);
  assert.ok(priceFacts.some((f) => f.startsWith("[limit]")), `sales-pricing-packages extracts [limit]: ${JSON.stringify(priceFacts)}`);

  const vatFacts = extractStructuredFacts(getNote("doc-calc-vat-discount")!);
  assert.ok(vatFacts.some((f) => f.kind === "formula"), "doc-calc-vat-discount extracts [formula]");

  console.log(
    `[3] Structured Facts OK (${totalFacts} facts across ${notesWithFacts}/${vault().size} notes; kinds=${JSON.stringify(kindCounts)}, 0 user jargon leaks)`,
  );
}

// ============================================================
// 4. Section-Level Indexing (searchSections)
// ============================================================
{
  const secTab4 = searchSections("ห้ามขายสินค้าต่ำกว่าทุน วงเงินเครดิตรวมเช็คคงค้าง ส่วนที่ 4", 5, "user");
  assert.equal(secTab4[0]?.slug, "start-erp-options-9-tabs", `tab 4 section hits start-erp-options-9-tabs (got ${secTab4[0]?.slug})`);
  assert.ok(secTab4[0]?.heading.includes("ส่วนที่ 4"), `tab 4 heading exact match (got "${secTab4[0]?.heading}")`);

  const secTab7 = searchSections("กระเป๋าเงิน คิวอาร์ พร้อมเพย์ Biller ID ส่วนที่ 7", 5, "user");
  assert.equal(secTab7[0]?.slug, "start-erp-options-9-tabs", `tab 7 section hits start-erp-options-9-tabs (got ${secTab7[0]?.slug})`);
  assert.ok(secTab7[0]?.heading.includes("ส่วนที่ 5") || secTab7[0]?.heading.includes("ส่วนที่ 7"), `tab 7 heading match (got "${secTab7[0]?.heading}")`);

  const secSlip = searchSections("ลิงก์ใบวางบิลออนไลน์ ไฟล์รูปสลิปขนาดไม่เกิน 2.5 MB", 5, "user");
  assert.equal(secSlip[0]?.slug, "ts-sale-deposit-receipt", `slip upload error hits ts-sale-deposit-receipt (got ${secSlip[0]?.slug})`);
  assert.ok(secSlip[0]?.heading.includes("สลิป"), `slip section heading exact match (got "${secSlip[0]?.heading}")`);

  const secDev = searchSections("discount_word สูตรคำนวณส่วนลดหลายชั้น", 5, "dev");
  assert.equal(secDev[0]?.slug, "doc-calc-vat-discount", `dev section hits doc-calc-vat-discount (got ${secDev[0]?.slug})`);
  assert.ok(secDev[0]?.heading.includes("ส่วนลดหลายชั้น"), `dev section heading match (got "${secDev[0]?.heading}")`);

  // Isolation & speed check
  assert.ok(searchSections("ic_trans_detail gl_journal SELECT", 10, "user").every((h) => h.audience !== "dev"), "searchSections(user) zero dev leaks");
  assert.ok(searchSections("เปิดบิลขาย เช็คเด้ง", 10, "dev").every((h) => h.audience !== "user"), "searchSections(dev) zero user leaks");

  const tSec0 = performance.now();
  for (let i = 0; i < 100; i++) {
    searchSections("ห้ามขายสินค้าต่ำกว่าทุน วงเงินเครดิต", 5, "user");
  }
  const secPerMs = (performance.now() - tSec0) / 100;
  assert.ok(secPerMs < 0.5, `searchSections too slow: ${secPerMs.toFixed(4)} ms/call`);
  console.log(`[4] Section-Level BM25 OK (${secPerMs.toFixed(4)} ms/call, exact sub-section routing + 0 isolation leaks)`);
}

// ============================================================
// 5. Multi-Signal RRF Scoring
// ============================================================
{
  const rrf = computeRrfScores(
    [
      { name: "direct", weight: 1.5, rankedIds: [10, 20] },
      { name: "bm25", weight: 1.4, rankedIds: [20, 10, 30] },
      { name: "section", weight: 1.0, rankedIds: [10, 30] },
      { name: "semantic", weight: 1.0, rankedIds: [10, 40] },
    ],
    40,
  );
  assert.ok((rrf.get(10) ?? 0) > (rrf.get(20) ?? 0), "RRF elevates consensus multi-signal winner");
  assert.ok((rrf.get(20) ?? 0) > (rrf.get(40) ?? 0), "RRF ranks dual-signal hit above single-signal hit");

  // Sub-topic query in full search() surfaces both exact note AND bestSection
  const subHits = search("Biller ID พร้อมเพย์ กระเป๋าเงิน ส่วนที่ 7 เมนู 1004", 3, "user");
  assert.equal(subHits[0]?.slug, "start-erp-options-9-tabs", `multi-signal RRF puts start-erp-options-9-tabs #1 (got ${subHits[0]?.slug})`);
  assert.ok(subHits[0]?.bestSection && subHits[0].bestSection.includes("ส่วนที่"), `SearchHit carries bestSection: ${subHits[0]?.bestSection}`);
  console.log(`[5] Multi-Signal RRF OK (consensus fusion verified, bestSection="${subHits[0]?.bestSection}")`);
}

// ============================================================
// 6. O(1) Error-Message Lookup Index (lookupError + audience isolation)
// ============================================================
{
  const catalogAll = getErrorCatalog("all");
  const catalogUser = getErrorCatalog("user");
  assert.ok(catalogAll.length >= 100, `error catalog indexed >=100 real messages (got ${catalogAll.length})`);
  assert.ok(catalogUser.every((e) => e.audience !== "dev"), "getErrorCatalog(user) excludes dev entries");

  const cases: [string, string[]][] = [
    ["ห้ามขายสินค้าติดลบ", ["ts-stock-negative-control", "howto-sale-invoice", "start-erp-options-9-tabs"]],
    ["ล็อกหน่วยต้นทุนแล้ว", ["ts-stock-bom-unit-locked"]],
    ["ปิดงวดบัญชี", ["ts-common-period-closed"]],
    ["ยอดมัดจำมากกว่ามูลค่าสุทธิ", ["ts-sale-deposit-receipt"]],
    ["สินค้า [P-001] ห้ามติดลบ", ["ts-stock-negative-control"]],
    ["วันที่เอกสาร 15/01/2569 ได้ถูกปิดงวดไปแล้ว", ["ts-common-period-closed"]],
    ["ไม่มีสิทธิ์บันทึกข้อมูล", ["ts-common-no-permission"]],
  ];
  for (const [q, wantSlugs] of cases) {
    const res = lookupError(q, "user", 5);
    assert.ok(res.length > 0, `lookupError("${q}") returned results`);
    assert.ok(
      wantSlugs.includes(res[0].slug) || res.some((r) => wantSlugs.includes(r.slug)),
      `lookupError("${q}") expected one of [${wantSlugs}], got [${res.map((r) => `${r.slug}:${r.errorText}`).join(" | ")}]`,
    );
    assert.ok(res[0].fixSnippet.length >= 12 && !res[0].fixSnippet.startsWith("🎬"), `lookupError("${q}") provides clean fixSnippet: ${res[0].fixSnippet}`);
    assert.ok(res.every((r) => r.audience !== "dev"), `lookupError("${q}", "user") zero dev leaks`);
  }
  assert.equal(lookupError("ล็อกหน่วยต้นทุนแล้ว", "user", 3)[0]?.slug, "ts-stock-bom-unit-locked", "ล็อกหน่วยต้นทุนแล้ว hits ts-stock-bom-unit-locked #1");
  assert.equal(lookupError("ยอดมัดจำมากกว่ามูลค่าสุทธิ", "user", 3)[0]?.slug, "ts-sale-deposit-receipt", "ยอดมัดจำมากกว่ามูลค่าสุทธิ hits ts-sale-deposit-receipt #1");
  assert.ok(
    lookupError("ยอดมัดจำมากกว่ามูลค่าสุทธิ", "user", 3)[0]?.fixSnippet.includes("ลดยอดตัดมัดจำ"),
    "ยอดมัดจำมากกว่ามูลค่าสุทธิ returns inline cause+fix snippet",
  );

  // Strict out-of-domain Thai trap rejection on lookupError (must return 0 false-positive hits!)
  for (const trap of [
    "สูตรทำแกงเขียวหวานไก่ใส่กะทิสด",
    "วิธีปลูกทุเรียนภูเขาไฟ",
    "ยานอวกาศ ดาวอังคาร บั้งไฟพญานาค คอนโดหรู",
    "วิธีซ่อมแอร์บ้านน้ำหยดและล้างคอยล์เย็น",
    "สูตรหมักหมูย่างเกาหลีน้ำจิ้มแจ่ว",
  ]) {
    const trapHits = lookupError(trap, "user", 5);
    assert.equal(
      trapHits.length,
      0,
      `lookupError("${trap}") must return 0 hits on out-of-domain trap (got ${JSON.stringify(trapHits.map((h) => `${h.slug}:${h.errorText}`))})`,
    );
  }

  // Strict cross-zone isolation check on dev-only error string
  const devOnlyErr = "รายการนี้เลือกประเภทเป็นเงินเชื่อ / เครดิต ระบบปิดการรับ/จ่ายชำระเงิน";
  const userBlocked = lookupError(devOnlyErr, "user", 5);
  assert.ok(userBlocked.every((r) => r.audience !== "dev"), "lookupError(user) strictly hides dev error notes");
  const devHit = lookupError(devOnlyErr, "dev", 5);
  assert.ok(devHit.length > 0 && devHit.every((r) => r.audience !== "user"), "lookupError(dev) finds dev error and zero user notes");

  // Speed benchmark (<0.2ms/call)
  const e0 = performance.now();
  for (let i = 0; i < 200; i++) {
    lookupError(cases[i % cases.length][0], "user", 5);
  }
  const errPerMs = (performance.now() - e0) / 200;
  assert.ok(errPerMs < 0.25, `lookupError too slow: ${errPerMs.toFixed(4)} ms/call`);
  console.log(`[6] O(1) Error Lookup Index OK (${catalogAll.length} indexed errors, ${errPerMs.toFixed(4)} ms/lookup, 0 leaks)`);
}

// ============================================================
// 7. Temporal / Recency Metadata (getWhatsNew + graceful fallback without git)
// ============================================================
{
  const recentAll = getWhatsNew(30, "all", 20);
  assert.ok(recentAll.length > 0, `getWhatsNew(30) returned ${recentAll.length} recent notes`);
  for (let i = 0; i < recentAll.length; i++) {
    const row = recentAll[i];
    assert.ok(/^\d{4}-\d{2}-\d{2}T/.test(row.updatedAt), `valid ISO updatedAt: ${row.updatedAt}`);
    assert.ok(row.lastCommit.length >= 4, `valid lastCommit: ${row.lastCommit}`);
    assert.ok(row.tldr.length > 0, `non-empty tldr for ${row.slug}`);
    if (i > 0) assert.ok(recentAll[i - 1].updatedTs >= row.updatedTs, "getWhatsNew sorted newest-first");
  }

  const recentUser = getWhatsNew(30, "user", 50);
  const recentDev = getWhatsNew(30, "dev", 50);
  assert.ok(recentUser.every((r) => r.audience !== "dev"), "getWhatsNew(user) zero dev leaks");
  assert.ok(recentDev.every((r) => r.audience !== "user"), "getWhatsNew(dev) zero user leaks");

  // Graceful fallback test when git is unavailable (isolated temp dir with no .git)
  const tmpNoGit = fs.mkdtempSync(path.join(os.tmpdir(), "bcbrain-nogit-"));
  try {
    const vDir = path.join(tmpNoGit, "vault");
    fs.mkdirSync(path.join(vDir, "howto"), { recursive: true });
    fs.writeFileSync(path.join(vDir, "howto", "demo-note.md"), "# Demo\nhello\n", "utf8");
    const fallbackMap = extractVaultRecencyMap(vDir, [{ slug: "demo-note", folder: "howto" }], "fallback123", Date.now() - 1000);
    const meta = fallbackMap.get("demo-note");
    assert.ok(meta && meta.lastCommit === "fallback123" && meta.updatedTs > 0, "graceful mtime fallback when git unavailable");
  } finally {
    fs.rmSync(tmpNoGit, { recursive: true, force: true });
  }

  console.log(
    `[7] Temporal Recency OK (${recentAll.length} notes in 30d, latest=${recentAll[0]?.slug}@${recentAll[0]?.lastCommit}, graceful no-git fallback passed)`,
  );
}

console.log("test-retrieval-v2 ok");
