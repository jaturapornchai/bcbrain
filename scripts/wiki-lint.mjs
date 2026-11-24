// Cross-note contradiction & vault health auditor across all vault notes.
// Checks:
//  (a) Cross-note trans_flag label contradictions against canonical vault/doctypes/doc-trans-flag-catalog.md
//  (b) Cross-note 4-digit menu code -> name contradictions against live frontend/src/config/bcMenu.json
//  (c) Cross-note 4-edition pricing figure mismatches against canonical vault/sales/sales-pricing-packages.md
//  (d) Orphan notes (0 incoming links excluding root/playbook) and thin notes (< 200 chars body)
// Strictly READ-ONLY on D:/bcaiaccount and vault/.
// Usage: node scripts/wiki-lint.mjs [--json] [--strict] [--verbose]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import { auditMenuCatalogParity, loadBcMenuTruth, loadLocalEnv } from "./load-env.mjs";

loadLocalEnv();

const ROOT = process.cwd();
const VAULT_DIR = path.join(ROOT, "vault");
const SRC_DIR = path.resolve(process.env.BC_SOURCE_DIR ?? "D:/bcaiaccount");

const DEV_FOLDERS = new Set(["dev-playbook", "schema", "queries", "api", "doctypes", "architecture"]);
const EXCLUDED_YEARS = (n) => (n >= 2015 && n <= 2035) || (n >= 2555 && n <= 2585);
const THIN_BODY_MIN_CHARS = 200;

function walkMarkdown(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith(".")) continue;
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walkMarkdown(abs));
    else if (e.isFile() && e.name.endsWith(".md")) out.push(abs);
  }
  return out.sort((a, b) => a.localeCompare(b));
}

function loadVaultNotes(vaultDir) {
  const notes = [];
  for (const file of walkMarkdown(vaultDir)) {
    const rel = path.relative(vaultDir, file).replace(/\\/g, "/");
    const folder = rel.includes("/") ? rel.split("/")[0] : "root";
    const slug = path.basename(file, ".md").toLowerCase();
    const text = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
    const fm = text.match(/^---\n([\s\S]*?)\n---\n?/);
    let meta = {};
    if (fm) {
      try {
        meta = parseYaml(fm[1]) ?? {};
      } catch {
        meta = {};
      }
    }
    const body = fm ? text.slice(fm[0].length) : text;
    const links = new Set();
    for (const [, , t] of body.matchAll(/\[\[(?:([a-z_]+)::)?([^\]|#]+)/g)) {
      links.add(path.basename(t.trim()).toLowerCase());
    }
    notes.push({ rel, folder, slug, meta, body, links });
  }
  return notes;
}

// ---------------------------------------------------------------------------
// (a) Cross-note trans_flag contradiction detector
// ---------------------------------------------------------------------------
function classifyTransFlagPolarity(label) {
  const s = String(label ?? "").toLowerCase();
  const isCancel = /ยกเลิก|cancel/.test(s);
  const isApprove = /อนุมัติ|approve/.test(s);
  const isBuyAp = /ซื้อ|เจ้าหนี้|ผู้ขาย|\bap\b|\bpo\b|\bpr\b|รับวางบิล|จ่ายชำระหนี้|รับสินค้าตามใบสั่งซื้อ|ส่งคืนสินค้า/.test(s);
  const isSaleAr = /ขาย|ลูกหนี้|ลูกค้า|\bar\b|\bso\b|ใบเสนอราคา|ใบสั่งจอง|รับชำระหนี้|รับคืนสินค้า|pos/.test(s);
  const isIncrease = /เพิ่มหนี้|เพิ่ม\/เกิน|สต็อกเกิน|debit note/.test(s);
  const isDecrease = /ลดหนี้|ลด\/ขาด|สต็อกขาด|credit note/.test(s);
  const isTransfer = /โอนสินค้า|โอนคลัง|โอนเงินระหว่างธนาคาร|รับเข้าคลัง/.test(s);
  const isCheque = /เช็ค|บัตรเครดิต|wallet/.test(s);
  const isAsset = /สินทรัพย์|ค่าเสื่อม/.test(s);
  return { isCancel, isApprove, isBuyAp, isSaleAr, isIncrease, isDecrease, isTransfer, isCheque, isAsset };
}

function polarityContradicts(canonicalLabel, observedLabel) {
  const c = classifyTransFlagPolarity(canonicalLabel);
  const o = classifyTransFlagPolarity(observedLabel);
  // Ignore vague/generic labels that carry no polarity keywords
  const oHasSignal =
    o.isCancel || o.isApprove || o.isBuyAp || o.isSaleAr || o.isIncrease || o.isDecrease || o.isTransfer || o.isCheque || o.isAsset;
  if (!oHasSignal) return null;

  // Buy/AP vs Sale/AR conflict (when canonical is strictly one side)
  if (c.isBuyAp && !c.isSaleAr && o.isSaleAr && !o.isBuyAp) return "buy/AP vs sale/AR mismatch";
  if (c.isSaleAr && !c.isBuyAp && o.isBuyAp && !o.isSaleAr) return "sale/AR vs buy/AP mismatch";

  // Cancel vs non-cancel conflict (only when observed explicitly labels a normal flag as cancel, or cancel flag as normal action without mentioning cancel)
  if (!c.isCancel && o.isCancel && !/คู่ยกเลิก|ยกเลิก\s*=/.test(observedLabel)) return "non-cancel flag labeled as cancel";
  if (c.isCancel && !o.isCancel && (o.isApprove || o.isBuyAp || o.isSaleAr || o.isTransfer)) {
    return "cancel flag missing cancel label";
  }

  // Approve vs cancel conflict
  if (c.isApprove && o.isCancel) return "approve flag labeled as cancel";

  // Debit/increase vs credit/decrease conflict
  if (c.isIncrease && !c.isDecrease && o.isDecrease && !o.isIncrease) return "increase/DN vs decrease/CN mismatch";
  if (c.isDecrease && !c.isIncrease && o.isIncrease && !o.isDecrease) return "decrease/CN vs increase/DN mismatch";

  return null;
}

function parseCanonicalTransFlags(notes) {
  const catalog = notes.find((n) => n.rel === "doctypes/doc-trans-flag-catalog.md");
  const canonical = new Map(); // flagNum -> string[] (array because flags 1,2,3 appear in cb_chq_list and ic_trans)
  if (!catalog) return canonical;

  const lines = catalog.body.split("\n");
  let headerCols = null;
  let nameColIdx = -1;
  for (const line of lines) {
    if (!line.trim().startsWith("|")) {
      headerCols = null;
      nameColIdx = -1;
      continue;
    }
    const cells = line
      .split("|")
      .slice(1, -1)
      .map((c) => c.trim());
    if (cells.length < 3) continue;
    if (cells.every((c) => /^:?-+:?$/.test(c))) continue;
    if (/trans_flag/i.test(cells[0])) {
      headerCols = cells;
      nameColIdx = cells.findIndex((c) => /ชื่อเอกสาร|รายการ/.test(c));
      continue;
    }
    if (!headerCols || nameColIdx < 0 || nameColIdx >= cells.length) continue;
    const fm = cells[0].match(/^\*{0,2}`?(\d{1,4})`?\*{0,2}$/);
    if (!fm) continue;
    const flag = fm[1];
    const label = cells[nameColIdx].replace(/[`*]/g, "").trim();
    if (!label) continue;
    if (!canonical.has(flag)) canonical.set(flag, []);
    canonical.get(flag).push(label);
  }
  return canonical;
}

function auditTransFlags(notes) {
  const canonical = parseCanonicalTransFlags(notes);
  const errors = [];
  const warnings = [];
  let checkedDefs = 0;

  if (canonical.size === 0) {
    errors.push("trans_flag: could not parse canonical definitions from vault/doctypes/doc-trans-flag-catalog.md");
    return { canonicalCount: 0, checkedDefs, errors, warnings };
  }

  for (const note of notes) {
    if (!DEV_FOLDERS.has(note.folder)) continue;
    if (note.rel === "doctypes/doc-trans-flag-catalog.md") continue;
    if (!/trans_flag/i.test(note.body)) continue;

    const lines = note.body.split("\n");
    let inFlagTable = false;
    let flagColIdx = -1;
    let labelColIdx = -1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      if (trimmed.startsWith("|")) {
        const cells = trimmed
          .split("|")
          .slice(1, -1)
          .map((c) => c.trim());
        if (cells.length >= 2 && cells.every((c) => /^:?-+:?$/.test(c))) continue;
        const tfIdx = cells.findIndex((c) => /^`?trans_flag`?$/i.test(c.replace(/\*+/g, "").trim()));
        if (tfIdx !== -1) {
          inFlagTable = true;
          flagColIdx = tfIdx;
          labelColIdx = cells.findIndex(
            (c, idx) => idx !== tfIdx && /ชื่อเอกสาร|เอกสาร|ความหมาย|รายการ|ประเภทเอกสาร|อธิบาย|บทบาท|ชนิด/.test(c),
          );
          if (labelColIdx === -1) labelColIdx = tfIdx === 0 ? 1 : 0;
          continue;
        }
        if (inFlagTable && flagColIdx >= 0 && labelColIdx >= 0 && cells.length > Math.max(flagColIdx, labelColIdx)) {
          const fm = cells[flagColIdx].match(/^\*{0,2}`?(\d{1,4})`?\*{0,2}$/);
          if (fm) {
            const flag = fm[1];
            const canonLabels = canonical.get(flag);
            if (canonLabels && canonLabels.length === 1) {
              const observed = cells[labelColIdx].replace(/[`*]/g, "").trim();
              if (/[\u0E00-\u0E7F]/.test(observed)) {
                checkedDefs += 1;
                const reason = polarityContradicts(canonLabels[0], observed);
                if (reason) {
                  errors.push(
                    `trans_flag conflict in vault/${note.rel}:${i + 1}: flag ${flag} labeled "${observed}" contradicts canonical "${canonLabels[0]}" (${reason})`,
                  );
                }
              }
            }
          }
          continue;
        }
      } else {
        inFlagTable = false;
        flagColIdx = -1;
        labelColIdx = -1;
      }

      // Inline explicit binding: `trans_flag = 44` — ขายสินค้า  OR  `trans_flag = 44` (ขายสินค้า)
      for (const m of line.matchAll(
        /`?trans_flag\s*=\s*(\d{1,4})`?\s*(?:\(([^()\n]{3,50})\)|[—–:]\s*\*{0,2}([^()\n|,;`]{3,50}))/gi,
      )) {
        const flag = m[1];
        const observed = (m[2] || m[3] || "").replace(/\*+/g, "").trim();
        if (!/[\u0E00-\u0E7F]/.test(observed)) continue;
        if (/\b(?:AND|OR|IN|SELECT|COALESCE|inquiry_type|last_status)\b/i.test(observed)) continue;
        const canonLabels = canonical.get(flag);
        if (!canonLabels || canonLabels.length !== 1) continue;
        checkedDefs += 1;
        const reason = polarityContradicts(canonLabels[0], observed);
        if (reason) {
          errors.push(
            `trans_flag conflict in vault/${note.rel}:${i + 1}: flag ${flag} labeled "${observed}" contradicts canonical "${canonLabels[0]}" (${reason})`,
          );
        }
      }
    }
  }

  return { canonicalCount: canonical.size, checkedDefs, errors, warnings };
}

// ---------------------------------------------------------------------------
// (b) Cross-note 4-digit menu code -> name audit against live bcMenu.json
// ---------------------------------------------------------------------------
const MENU_PROSE_PREFIX_RE = /^(?:และ|หรือ|เพื่อ|สำหรับ|ที่|ใน|โดย|จาก|จะ|ต้อง|ให้|ซึ่ง|แล้ว|แต่|กับ|ของ|เป็น|มี|ใช้|ช่วย)/;
const MENU_SYNONYM_MAP = [
  ["สินทรัพย์", "ทรัพย์สิน"],
  ["สต็อก", "สินค้า"],
  ["สต๊อก", "สินค้า"],
  ["pos", "ขายหน้าร้าน"],
  ["vat", "ภาษี"],
  ["ภ.พ.30", "ภาษีมูลค่าเพิ่ม"],
  ["เจ้าหนี้", "ซื้อ"],
  ["ลูกหนี้", "ขาย"],
  ["เช็คเด้ง", "เช็ครับคืน"],
  ["ปิดงวด", "งวดบัญชี"],
];

function extractMeaningfulTerms(text) {
  const clean = String(text ?? "")
    .toLowerCase()
    .replace(/[`*_~()[\]{}<>|/\\,:;.\-–—+="'?!]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const rawTokens = clean.split(" ").filter((t) => t.length >= 2);
  const terms = new Set(rawTokens);
  // Add Thai 3-char overlapping n-grams for unsegmented Thai screen names
  for (const tok of rawTokens) {
    if (/^[\u0E00-\u0E7F]{4,}$/.test(tok)) {
      for (let i = 0; i <= tok.length - 3; i++) {
        terms.add(tok.slice(i, i + 3));
      }
    }
  }
  for (const [a, b] of MENU_SYNONYM_MAP) {
    if (clean.includes(a)) terms.add(b);
    if (clean.includes(b)) terms.add(a);
  }
  return terms;
}

function menuLabelMatchesLive(label, liveEntry) {
  const labelTerms = extractMeaningfulTerms(label);
  const liveTerms = extractMeaningfulTerms(`${liveEntry.text} ${liveEntry.path}`);
  if (labelTerms.size === 0 || liveTerms.size === 0) return true;
  for (const t of labelTerms) {
    if (liveTerms.has(t)) return true;
  }
  return false;
}

function auditMenus(notes, srcDir, strict) {
  const menuTruth = loadBcMenuTruth(srcDir);
  const errors = [];
  const warnings = [];
  let checkedCatalogRows = 0;
  let checkedCrossBindings = 0;

  if (menuTruth.size === 0) {
    warnings.push(`menu-audit: bcMenu.json not readable at ${srcDir} — skipped live menu check`);
    return { menuTruthSize: 0, checkedCatalogRows, checkedCrossBindings, errors, warnings };
  }

  // 1. Exact 1:1 parity on vault/start/menu-cat-1..9-*.md
  const parity = auditMenuCatalogParity(ROOT, srcDir);
  checkedCatalogRows = parity.checkedRows;
  for (const mm of parity.mismatchedFiles) {
    for (const issue of mm.issues) {
      errors.push(`menu-catalog parity (${mm.note}): ${issue}`);
    }
  }

  // 2. Cross-note menu code -> Thai name checks outside menu-cat-1..9
  for (const note of notes) {
    if (note.rel.startsWith("start/menu-cat-")) continue;
    const lines = note.body.split("\n");
    let inMenuTable = false;
    let codeCol = -1;
    let nameCol = -1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      if (trimmed.startsWith("|")) {
        const cells = trimmed
          .split("|")
          .slice(1, -1)
          .map((c) => c.trim());
        if (cells.length >= 2 && cells.every((c) => /^:?-+:?$/.test(c))) continue;
        const cIdx = cells.findIndex((c) => /^รหัสเมนู$|^รหัส\s*\(4\s*หลัก\)$|^เมนู$/.test(c.replace(/\*+/g, "").trim()));
        const nIdx = cells.findIndex((c) => /ชื่อเมนู|ชื่อหน้าจอ|หน้าจอ/.test(c));
        if (cIdx !== -1 && nIdx !== -1 && cIdx !== nIdx) {
          inMenuTable = true;
          codeCol = cIdx;
          nameCol = nIdx;
          continue;
        }
        if (inMenuTable && cells.length > Math.max(codeCol, nameCol)) {
          const cm = cells[codeCol].match(/^\*{0,2}`?([1-9]\d{3})`?\*{0,2}$/);
          if (cm) {
            const code = cm[1];
            const label = cells[nameCol].replace(/[`*]/g, "").trim();
            if (!EXCLUDED_YEARS(Number(code)) && /[\u0E00-\u0E7F]/.test(label)) {
              checkedCrossBindings += 1;
              const live = menuTruth.get(code);
              if (!live) {
                errors.push(`menu conflict in vault/${note.rel}:${i + 1}: menu code "${code}" ("${label}") not in live bcMenu.json`);
              } else if (!menuLabelMatchesLive(label, live)) {
                const msg = `menu name conflict in vault/${note.rel}:${i + 1}: code ${code} labeled "${label}" != live "${live.text}"`;
                if (strict) errors.push(msg);
                else warnings.push(msg);
              }
            }
          }
          continue;
        }
      } else {
        inMenuTable = false;
        codeCol = -1;
        nameCol = -1;
      }

      // Inline menu code -> Thai name binding (skipping numeric ranges like 5001–5006 and prose continuations)
      for (const m of line.matchAll(
        /(?:รหัสเมนู|เมนู)\s*\*{0,2}`?([1-9]\d{3})`?\*{0,2}(?!\s*[-–—~]\s*\d{4})\s*(?:\(([^()\n]{2,55})\)|[:—–]\s*\*{0,2}([^()\n|,;]{2,55}))/g,
      )) {
        const code = m[1];
        if (EXCLUDED_YEARS(Number(code))) continue;
        const label = (m[2] || m[3] || "").replace(/\*+/g, "").trim();
        if (!/[\u0E00-\u0E7F]/.test(label)) continue;
        if (MENU_PROSE_PREFIX_RE.test(label) || /\b[1-9]\d{3}\b/.test(label)) continue;
        checkedCrossBindings += 1;
        const live = menuTruth.get(code);
        if (!live) {
          errors.push(`menu conflict in vault/${note.rel}:${i + 1}: menu code "${code}" ("${label}") not in live bcMenu.json`);
        } else if (!menuLabelMatchesLive(label, live)) {
          const msg = `menu name conflict in vault/${note.rel}:${i + 1}: code ${code} labeled "${label}" != live "${live.text}"`;
          if (strict) errors.push(msg);
          else warnings.push(msg);
        }
      }
    }
  }

  return { menuTruthSize: menuTruth.size, checkedCatalogRows, checkedCrossBindings, errors, warnings };
}

// ---------------------------------------------------------------------------
// (c) Cross-note 4-edition pricing consistency vs vault/sales/sales-pricing-packages.md
// ---------------------------------------------------------------------------
const EDITIONS = ["starter", "standard", "professional", "enterprise"];

function parseBahtNumber(raw) {
  const n = Number(String(raw).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function parseCanonicalPricing(notes) {
  const canonicalNote = notes.find((n) => n.rel === "sales/sales-pricing-packages.md");
  if (!canonicalNote) return null;

  const editions = Object.fromEntries(
    EDITIONS.map((e) => [e, { monthly: new Set(), yearly: new Set(), startMonthly: null, startYearly: null }]),
  );

  const lines = canonicalNote.body.split("\n");
  let colEdition = null;
  for (const line of lines) {
    if (!line.trim().startsWith("|")) {
      colEdition = null;
      continue;
    }
    const cells = line
      .split("|")
      .slice(1, -1)
      .map((c) => c.trim());
    if (cells.length < 5) continue;
    if (cells.every((c) => /^:?-+:?$/.test(c))) continue;
    if (/starter/i.test(line) && /standard/i.test(line) && /professional/i.test(line) && /enterprise/i.test(line)) {
      colEdition = cells.map((c) => {
        const lower = c.toLowerCase();
        return EDITIONS.find((e) => lower.includes(e)) ?? null;
      });
      continue;
    }
    if (!colEdition) continue;

    const isStartRow = /1\s*[–\-]\s*5/.test(cells[0]);
    for (let idx = 0; idx < colEdition.length && idx < cells.length; idx++) {
      const ed = colEdition[idx];
      if (!ed) continue;
      const cell = cells[idx];
      for (const m of cell.matchAll(/(\d[\d,]*)\s*(?:บ\.|บาท)\s*\/\s*(เดือน|ปี)/g)) {
        const val = parseBahtNumber(m[1]);
        if (val === null) continue;
        if (m[2] === "เดือน") {
          editions[ed].monthly.add(val);
          if (isStartRow && editions[ed].startMonthly === null) editions[ed].startMonthly = val;
        } else {
          editions[ed].yearly.add(val);
          if (isStartRow && editions[ed].startYearly === null) editions[ed].startYearly = val;
        }
      }
    }
  }

  // Verify all 4 editions parsed
  for (const ed of EDITIONS) {
    if (editions[ed].monthly.size === 0) return null;
  }
  return editions;
}

function auditPricing(notes) {
  const canonical = parseCanonicalPricing(notes);
  const errors = [];
  let checkedFigures = 0;

  if (!canonical) {
    errors.push("pricing: failed to parse canonical 4-edition table from vault/sales/sales-pricing-packages.md");
    return { editionsParsed: 0, checkedFigures, errors, warnings: [] };
  }

  for (const note of notes) {
    if (note.rel === "sales/sales-pricing-packages.md") continue;
    const lines = note.body.split("\n");

    // Check table headers mentioning multiple editions
    let tableColEditions = null;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      if (trimmed.startsWith("|")) {
        const cells = trimmed
          .split("|")
          .slice(1, -1)
          .map((c) => c.trim());
        if (cells.length >= 2 && cells.every((c) => /^:?-+:?$/.test(c))) continue;
        const matchedEds = cells.map((c) => EDITIONS.find((e) => c.toLowerCase().includes(e)) ?? null);
        if (matchedEds.filter(Boolean).length >= 2) {
          tableColEditions = matchedEds;
          continue;
        }
        if (tableColEditions) {
          const isStartRow = /1\s*[–\-]\s*5/.test(cells[0] ?? "");
          for (let c = 0; c < tableColEditions.length && c < cells.length; c++) {
            const ed = tableColEditions[c];
            if (!ed) continue;
            for (const m of cells[c].matchAll(/(\d[\d,]*)\s*(?:บ\.|บาท)\s*\/\s*(เดือน|ปี)/g)) {
              const val = parseBahtNumber(m[1]);
              if (val === null) continue;
              checkedFigures += 1;
              const allowed = m[2] === "เดือน" ? canonical[ed].monthly : canonical[ed].yearly;
              const startExpected = m[2] === "เดือน" ? canonical[ed].startMonthly : canonical[ed].startYearly;
              if (!allowed.has(val) || (isStartRow && startExpected !== null && val !== startExpected)) {
                errors.push(
                  `pricing mismatch in vault/${note.rel}:${i + 1}: ${ed} ${val} บาท/${m[2]} not in canonical [${[...allowed].join(", ")}]`,
                );
              }
            }
          }
          continue;
        }
      } else {
        tableColEditions = null;
      }

      // Single-line edition + baht/period check
      const foundEditions = EDITIONS.filter((ed) => new RegExp(`\\b${ed}\\b`, "i").test(line));
      if (foundEditions.length !== 1) continue;
      const ed = foundEditions[0];
      const isStarting = /เริ่ม(?:ต้น)?|1\s*[–\-]\s*5\s*คน/.test(line);

      for (const m of line.matchAll(/(\d[\d,]*)\s*(?:บ\.|บาท)\s*\/\s*(เดือน|ปี)/g)) {
        const val = parseBahtNumber(m[1]);
        if (val === null) continue;
        checkedFigures += 1;
        const allowed = m[2] === "เดือน" ? canonical[ed].monthly : canonical[ed].yearly;
        const startExpected = m[2] === "เดือน" ? canonical[ed].startMonthly : canonical[ed].startYearly;
        if (!allowed.has(val)) {
          errors.push(
            `pricing mismatch in vault/${note.rel}:${i + 1}: ${ed} ${val} บาท/${m[2]} contradicts canonical sales-pricing-packages.md [${[...allowed].join(", ")}]`,
          );
        } else if (isStarting && startExpected !== null && val !== startExpected) {
          errors.push(
            `pricing mismatch in vault/${note.rel}:${i + 1}: ${ed} starting price ${val} บาท/${m[2]} != canonical ${startExpected} บาท/${m[2]}`,
          );
        }
      }
    }
  }

  return { editionsParsed: EDITIONS.length, checkedFigures, errors, warnings: [] };
}

// ---------------------------------------------------------------------------
// (d) Orphan notes (0 incoming links excluding root/playbook) & thin notes (< 200 chars)
// ---------------------------------------------------------------------------
function auditGraphHealth(notes, strict) {
  const inLinks = new Map();
  for (const n of notes) inLinks.set(n.slug, new Set());
  for (const n of notes) {
    for (const tgt of n.links) {
      if (tgt !== n.slug && inLinks.has(tgt)) {
        inLinks.get(tgt).add(n.slug);
      }
    }
  }

  const orphans = [];
  const thinNotes = [];
  const errors = [];
  const warnings = [];

  for (const n of notes) {
    const isExemptRootOrPlaybook = n.folder === "root" || n.folder === "playbook" || n.folder === "dev-playbook";
    if (!isExemptRootOrPlaybook && inLinks.get(n.slug).size === 0) {
      orphans.push(`vault/${n.rel}`);
      warnings.push(`orphan note (0 incoming wikilinks): vault/${n.rel}`);
    }
    const bodyLen = n.body.trim().length;
    if (bodyLen < THIN_BODY_MIN_CHARS) {
      thinNotes.push({ note: `vault/${n.rel}`, chars: bodyLen });
      const msg = `thin note (<${THIN_BODY_MIN_CHARS} chars): vault/${n.rel} (${bodyLen} chars)`;
      if (strict) errors.push(msg);
      else warnings.push(msg);
    }
  }

  return { orphans, thinNotes, errors, warnings };
}

export function runWikiLint(opts = {}) {
  const t0 = Date.now();
  const vaultDir = opts.vaultDir ?? VAULT_DIR;
  const srcDir = opts.srcDir ?? SRC_DIR;
  const strict = Boolean(opts.strict);

  const notes = loadVaultNotes(vaultDir);
  const tf = auditTransFlags(notes);
  const menus = auditMenus(notes, srcDir, strict);
  const pricing = auditPricing(notes);
  const health = auditGraphHealth(notes, strict);

  const errors = [...tf.errors, ...menus.errors, ...pricing.errors, ...health.errors];
  const warnings = [...tf.warnings, ...menus.warnings, ...pricing.warnings, ...health.warnings];

  return {
    ok: errors.length === 0,
    strict,
    elapsedMs: Date.now() - t0,
    noteCount: notes.length,
    checks: {
      transFlags: { canonicalFlags: tf.canonicalCount, checkedDefs: tf.checkedDefs, errors: tf.errors.length },
      menus: {
        liveMenus: menus.menuTruthSize,
        checkedCatalogRows: menus.checkedCatalogRows,
        checkedCrossBindings: menus.checkedCrossBindings,
        errors: menus.errors.length,
        warnings: menus.warnings.length,
      },
      pricing: { editions: pricing.editionsParsed, checkedFigures: pricing.checkedFigures, errors: pricing.errors.length },
      health: {
        orphanCount: health.orphans.length,
        thinCount: health.thinNotes.length,
        orphans: health.orphans,
        thinNotes: health.thinNotes,
      },
    },
    errorCount: errors.length,
    warningCount: warnings.length,
    errors,
    warnings,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const strict = process.argv.includes("--strict");
  const jsonOut = process.argv.includes("--json");
  const verbose = process.argv.includes("--verbose") || process.env.VERBOSE === "1";

  const result = runWikiLint({ strict });
  if (jsonOut) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    const c = result.checks;
    console.log(
      `wiki-lint (${result.elapsedMs}ms, strict=${result.strict}): scanned ${result.noteCount} notes | ` +
        `transFlags=${c.transFlags.checkedDefs} (${c.transFlags.canonicalFlags} canonical) | ` +
        `menus=${c.menus.checkedCatalogRows} catalog + ${c.menus.checkedCrossBindings} cross (${c.menus.liveMenus} live) | ` +
        `pricing=${c.pricing.checkedFigures} figures (${c.pricing.editions} editions) | ` +
        `orphans=${c.health.orphanCount} | thin=${c.health.thinCount}`,
    );
    console.log(`errors=${result.errorCount}, warnings=${result.warningCount}`);
    for (const e of result.errors.slice(0, 50)) console.log("ERR ", e);
    if (verbose) {
      for (const w of result.warnings.slice(0, 50)) console.log("WARN", w);
    }
  }
  process.exit(result.errorCount ? 1 : 0);
}
