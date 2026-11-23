// Local gzipped baseline cache inside d:\bcbrain\.sync-cache\ for ultra-low-token incremental diffs.
// STRICTLY READ-ONLY on D:\bcaiaccount — never writes, creates, or locks anything in SRC_DIR.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";

const CACHE_DIR = path.join(process.cwd(), ".sync-cache");
const BASELINE_FILE = path.join(CACHE_DIR, "baseline.json.gz");
const MAX_CACHED_FILE_BYTES = 1024 * 1024; // 1 MB per source file

export function saveBaselineSnapshot(srcDir, filesMap, cacheFile = BASELINE_FILE) {
  const files = {};
  for (const [rel, meta] of Object.entries(filesMap ?? {})) {
    if ((meta?.bytes ?? 0) > MAX_CACHED_FILE_BYTES) continue;
    const abs = path.join(srcDir, rel);
    try {
      files[rel] = fs.readFileSync(abs, "utf8");
    } catch {
      // skip unreadable file
    }
  }
  const payload = JSON.stringify({ capturedAt: new Date().toISOString(), files });
  const gz = zlib.gzipSync(Buffer.from(payload, "utf8"), { level: 6 });
  fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
  const tmp = `${cacheFile}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, gz);
  fs.renameSync(tmp, cacheFile);
  return { cachedFiles: Object.keys(files).length, gzBytes: gz.length };
}

function loadBaselineSnapshot(cacheFile = BASELINE_FILE) {
  if (!fs.existsSync(cacheFile)) return null;
  try {
    const raw = zlib.gunzipSync(fs.readFileSync(cacheFile)).toString("utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function diffTwoStrings(prevText, curText, ignoreAllSpace = false) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "bcbrain-diff-"));
  const aPath = path.join(tmpDir, "prev.txt");
  const bPath = path.join(tmpDir, "cur.txt");
  try {
    fs.writeFileSync(aPath, prevText.replace(/\r\n/g, "\n"), "utf8");
    fs.writeFileSync(bPath, curText.replace(/\r\n/g, "\n"), "utf8");
    const args = ["diff", "--no-index", "--unified=1", "--no-color"];
    if (ignoreAllSpace) args.push("--ignore-all-space");
    args.push("--", aPath, bPath);
    const res = spawnSync("git", args, { encoding: "utf8", timeout: 10_000, maxBuffer: 4 * 1024 * 1024 });
    return (res.stdout ?? "").replace(/\r\n/g, "\n");
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

function extractCompactHunks(rawDiff, maxLines) {
  const lines = rawDiff.split("\n").filter((l) => l.startsWith("@@") || (/^[+-]/.test(l) && !l.startsWith("+++") && !l.startsWith("---")));
  const truncated = lines.length > maxLines;
  return {
    lines: truncated ? lines.slice(0, maxLines) : lines,
    totalDiffLines: lines.length,
    truncated,
  };
}

export function computeIncrementalDiffs(srcDir, changedFileDeltas, opts = {}) {
  const maxLinesPerFile = opts.maxLinesPerFile ?? 40;
  const maxTotalLines = opts.maxTotalLines ?? 160;
  const baseline = loadBaselineSnapshot(opts.cacheFile ?? BASELINE_FILE);
  if (!baseline?.files) {
    return {
      hasBaseline: false,
      note: "no local baseline yet — run --finalize or --record-noop once to seed .sync-cache/baseline.json.gz",
      files: [],
    };
  }

  let budgetLeft = maxTotalLines;
  const files = [];
  for (const item of changedFileDeltas ?? []) {
    const rel = item.file;
    if (item.status === "deleted") {
      files.push({ file: rel, status: "deleted", hunks: [] });
      continue;
    }
    const abs = path.join(srcDir, rel);
    if (!fs.existsSync(abs)) continue;
    const curText = fs.readFileSync(abs, "utf8");
    const prevText = baseline.files[rel];
    if (prevText === undefined) {
      const preview = curText.replace(/\r\n/g, "\n").split("\n").slice(0, Math.min(20, budgetLeft));
      budgetLeft = Math.max(0, budgetLeft - preview.length);
      files.push({ file: rel, status: "added", preview });
      continue;
    }
    const raw = diffTwoStrings(prevText, curText, false);
    if (!raw.trim()) {
      files.push({ file: rel, status: "unchanged" });
      continue;
    }
    const noWs = diffTwoStrings(prevText, curText, true);
    if (!noWs.trim()) {
      files.push({ file: rel, status: "whitespaceOnly" });
      continue;
    }
    const cap = Math.max(8, Math.min(maxLinesPerFile, budgetLeft));
    const { lines, totalDiffLines, truncated } = extractCompactHunks(raw, cap);
    budgetLeft = Math.max(0, budgetLeft - lines.length);
    files.push({
      file: rel,
      status: "modified",
      totalDiffLines,
      ...(truncated ? { truncated: true } : {}),
      hunks: lines,
    });
    if (budgetLeft === 0) break;
  }

  return {
    hasBaseline: true,
    baselineCapturedAt: baseline.capturedAt,
    files,
  };
}
