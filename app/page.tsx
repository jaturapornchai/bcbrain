import Brain3D, { CountUp } from "@/components/Brain3D";
import { graph, updatedAt } from "@/lib/vault";

const MCP_URL = "https://brain.bcsmethai.com/mcp";
const SKILL_URL = "https://brain.bcsmethai.com/skills/bcbrain/SKILL.md";
const TOOLS = [
  ["quick_answer", "ตอบเร็วสุดใน 1 ครั้ง (~2,000 อักษร หรือส่ง mode: 'ultra' เหลือ ~600 อักษร TL;DR) เหมาะกับ Call Center, Voice/LINE Bot มีด่าน Abstain กันหลอน"],
  ["batch_ask", "ถาม 1–5 คำถามพร้อมกันใน 1 รอบเดียว (ค่าเริ่มต้น mode: 'ultra') ลดรอบเรียก LLM สำหรับคำถามหลายประเด็น"],
  ["lookup_menu", "ค้นรหัสเมนู 4 หลัก (1001–9070), ชื่อเมนู หรือชื่อตาราง SQL แบบ O(1) ใน < 1 ms พร้อมลิงก์โน้ตที่เกี่ยวข้องทันที"],
  ["batch_read", "อ่าน 1–5 โน้ตพร้อมกันใน 1 รอบ (รองรับตัดเฉพาะหัวข้อตาม query และจำกัดความยาว) ลดรอบการเรียก read_note ซ้ำ"],
  ["ask_brain", "ถามแบบสังเคราะห์หลายโน้ต (กรอง audience: user/dev/all) พร้อมลิงก์รูปภาพ & YouTube อัตโนมัติ และบริบทกราฟ 1 ทอด (รองรับ compact: true)"],
  ["search_brain", "ค้นคำ (ตัดคำไทย + คำพ้องไทย-SQL + รหัสเมนู 4 หลัก + BM25) พร้อมแนบอาร์เรย์ images และ videos ในผลลัพธ์"],
  ["find_media", "ดึงลิงก์รูปภาพหน้าจอจริง (bcaccount.com), คลิปสอน YouTube (PLO9P7tPZLXB0 พร้อม thumbnail/embed) และหน้าเว็บอ้างอิงพร้อมแชร์"],
  ["traverse_brain", "ไล่ไซแนปส์อัจฉริยะ 18 ชนิด 1–3 hops (shares_menu, bridges_zone, implements_code, uses_table, writes_table) หรือหาเส้นทางเชื่อมหน้าจอ ↔ โค้ด ↔ ตาราง"],
  ["read_note", "อ่านโน้ตตาม slug พร้อมกลุ่ม โซน audience ลิงก์สื่อ และลิงก์ไป-กลับ (ส่ง query/max_chars เพื่อตัดเฉพาะส่วนที่ต้องการได้)"],
  ["list_notes", "สารบัญโน้ตทั้งหมด กรองตาม folder, tag หรือ audience ('all' | 'user' | 'dev') ได้"],
];

export default function Home() {
  const g = graph();

  return (
    <>
      <main className="home">
        <Brain3D nodes={g.nodes} links={g.links} rels={g.rels}>
          <p className="eyebrow">BC Ai Account · Second Brain</p>
          <h1>สมอง BC</h1>
          <p className="lead">
            คลังความรู้สำหรับผู้ใช้ทั่วไป และสเปก Schema / SQL / API สำหรับนักพัฒนา — <CountUp to={g.nodes.length} /> เซลล์ความรู้ ·{" "}
            <CountUp to={g.links.length} delay={800} /> ไซแนปส์
          </p>
          <p className="muted">อัปเดตล่าสุด {updatedAt}</p>
        </Brain3D>
      </main>

      <section className="mcp" id="mcp">
        <h2>ให้ AI ตัวอื่นมาใช้สมองนี้ (MCP)</h2>
        <p className="lead">
          Endpoint <code>{MCP_URL}</code> (Stateless Streamable HTTP) — เปิดสาธารณะ อ่านอย่างเดียว ไม่ต้องใช้ key · รองรับตัวกรอง{" "}
          <code>audience</code> แยกโซน <code>user</code> และ <code>dev</code>
        </p>
        <div className="cards">
          {TOOLS.map(([name, desc]) => (
            <div className="card" key={name}>
              <h3>
                <code>{name}</code>
              </h3>
              <p>{desc}</p>
            </div>
          ))}
        </div>

        <h3>ตัวอย่างเรียกใช้แยกตามบทบาท</h3>
        <div className="mcp-modes">
          <div className="card">
            <h3>โหมดผู้ใช้ทั่วไป / Call Center / ฝ่ายขาย</h3>
            <p className="muted">เน้นตอบไวสุด: เรียก quick_answer (1 รอบจบ) หรือ lookup_menu แล้วส่ง audience: &quot;user&quot; เสมอ เพื่อตอบภาษาไทยเข้าใจง่ายไร้ศัพท์โค้ด</p>
            <pre>{`quick_answer({ question: "เช็คเด้งทำยังไง", audience: "user", include_media: true })
lookup_menu({ query: "4013", audience: "user" })
batch_read({ slugs: ["howto-sale-invoice", "ts-stock-negative-control"], audience: "user" })
ask_brain({ question: "ภพ30 ภาษีซื้อขาย", audience: "user", compact: true })
find_media({ query: "ใบสั่งซื้อ", kind: "all", audience: "user" })`}</pre>
          </div>
          <div className="card">
            <h3>โหมดนักพัฒนา / Dev / เขียนโค้ดต่อยอด</h3>
            <p className="muted">เน้นไวสุด: ใช้ quick_answer / lookup_menu / batch_read ด้วย audience: &quot;dev&quot; (หรือ &quot;all&quot; เมื่อต้องดูบริบทหน้างานร่วมด้วย)</p>
            <pre>{`quick_answer({ question: "โครงสร้าง ic_trans และ trans_flag ขาย", audience: "dev" })
lookup_menu({ query: "ic_trans", audience: "dev" })
batch_read({ slugs: ["tbl-ic-trans", "doc-sale-trans-flags"], audience: "dev" })
traverse_brain({ slug: "sql-ic-stock-balance", to_slug: "tbl-ic-unit", audience: "dev" })`}</pre>
          </div>
        </div>

        <h3>Claude Code</h3>
        <pre>{`claude mcp add --transport http bcbrain ${MCP_URL}`}</pre>
        <h3>Antigravity — mcp_config.json</h3>
        <pre>{`{
  "mcpServers": {
    "bcbrain": {
      "serverUrl": "${MCP_URL}"
    }
  }
}`}</pre>
        <h3>Gemini CLI — settings.json</h3>
        <pre>{`{
  "mcpServers": {
    "bcbrain": {
      "httpUrl": "${MCP_URL}"
    }
  }
}`}</pre>
        <h3>Codex — config.toml</h3>
        <pre>{`[mcp_servers.bcbrain]
url = "${MCP_URL}"`}</pre>

        <h3>ติดตั้ง Skill /bcbrain (คำสั่งลัดพร้อมกติกาครบในไฟล์เดียว)</h3>
        <p className="lead">
          เมื่อติดตั้ง Skill นี้แล้ว พิมพ์ <code>/bcbrain &lt;คำถาม&gt;</code> หรือ{" "}
          <code>/bcbrain dev &lt;โจทย์ SQL/Schema/API&gt;</code> ได้ทันที และมีตัวสำรอง HTTP JSON-RPC เมื่อยังไม่ผูก MCP
        </p>
        <div className="actions">
          <a className="btn" href="/skills/bcbrain/SKILL.md">
            ดาวน์โหลด SKILL.md (/bcbrain)
          </a>
          <a className="btn" href="/n/video-visual-tutorials?mode=user">
            คลังวิดีโอ YouTube &amp; ภาพหน้าจอ
          </a>
          <a className="btn" href="https://bcaccount.com" target="_blank" rel="noopener noreferrer">
            เว็บไซต์หลัก bcaccount.com ↗
          </a>
          <a className="btn" href="https://www.youtube.com/watch?v=_DattZyKqDA&list=PLO9P7tPZLXB0" target="_blank" rel="noopener noreferrer">
            เพลย์ลิสต์ YouTube สอนใช้งาน ↗
          </a>
        </div>
        <div className="mcp-modes">
          <div className="card">
            <h3>macOS / Linux / Git Bash</h3>
            <p className="muted">ติดตั้งแบบ Global สำหรับ Claude Code, Gemini CLI, Codex และ Antigravity</p>
            <pre>{`for d in ~/.claude/skills/bcbrain ~/.gemini/config/skills/bcbrain ~/.codex/skills/bcbrain ~/.agents/skills/bcbrain; do mkdir -p "$d" && curl -fsSL ${SKILL_URL} -o "$d/SKILL.md"; done`}</pre>
          </div>
          <div className="card">
            <h3>Windows PowerShell</h3>
            <p className="muted">รันคำสั่งเดียวเพื่อคัดลอก SKILL.md ลงทุกเครื่องมือหรือในโปรเจกต์ปัจจุบัน</p>
            <pre>{`"$HOME/.claude/skills/bcbrain","$HOME/.gemini/config/skills/bcbrain","$HOME/.codex/skills/bcbrain","$HOME/.agents/skills/bcbrain" | ForEach-Object { New-Item -ItemType Directory -Force $_ | Out-Null; Invoke-WebRequest "${SKILL_URL}" -OutFile "$_/SKILL.md" }`}</pre>
          </div>
        </div>
      </section>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "Organization",
                name: "บริษัท บ้านเชียงซอฟท์ จำกัด",
                url: "https://www.bcsmethai.com",
              },
              {
                "@type": "WebSite",
                name: "สมอง BC",
                url: "https://brain.bcsmethai.com",
                inLanguage: "th",
                potentialAction: {
                  "@type": "SearchAction",
                  target: "https://brain.bcsmethai.com/n?q={search_term_string}",
                  "query-input": "required name=search_term_string",
                },
              },
              {
                "@type": "SoftwareApplication",
                name: "สมอง BC (BC Brain)",
                applicationCategory: "BusinessApplication",
                operatingSystem: "Web",
                url: "https://brain.bcsmethai.com",
                inLanguage: "th",
                description:
                  "คลังความรู้ BC Ai Account สำหรับทั้งผู้ใช้ทั่วไป (Call Center/ฝ่ายขาย) และนักพัฒนา (Schema/SQL/API/Architecture) พร้อม MCP server รองรับตัวกรอง audience",
                publisher: { "@type": "Organization", name: "บริษัท บ้านเชียงซอฟท์ จำกัด", url: "https://www.bcsmethai.com" },
              },
            ],
          }).replace(/</g, "\\u003c"),
        }}
      />
    </>
  );
}
