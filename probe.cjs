const fs = require("fs");
const rec = fs.readFileSync("C:/Users/Lenovo/wa-aida-token-recovery.txt", "utf8");
const tok = (rec.match(/[A-Za-z0-9_-]{20,}/) || [])[0] || "";
const ref = fs.readFileSync("C:/Users/Lenovo/.zcode/workspace/default/wa-aida-crm/reference/v19-app.html", "utf8");
const url = (ref.match(/https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec/) || [])[0] || "";
async function main() {
  console.log("token len:", tok.length, "| url found:", Boolean(url));
  const get = async (q) => {
    const res = await fetch(url + "?" + q + "&token=" + encodeURIComponent(tok), { redirect: "follow" });
    const text = await res.text();
    let j = null; try { j = JSON.parse(text); } catch (_) {}
    return { status: res.status, j, text };
  };
  const meta = await get("action=meta");
  console.log("meta: ok =", meta.j && meta.j.ok === true, "| error =", (meta.j && meta.j.error) || "none");
  if (!(meta.j && meta.j.ok === true)) { await browser.close ? null : null; process.exit(0); }
  for (const act of ["value", "stage"]) {
    const q = act === "value" ? "id=999999&value=1" : "id=999999&stage=new";
    const r = await get("action=" + act + "&" + q);
    console.log(act + ": error =", (r.j && r.j.error) || "none");
  }
  const fu = await get("action=fu_list");
  console.log("fu_list: isArray =", Array.isArray(fu.j), "| rows =", Array.isArray(fu.j) ? fu.j.length : "n/a");
  const tl = await get("action=tpl_list");
  console.log("tpl_list: isArray =", Array.isArray(tl.j), "| rows =", Array.isArray(tl.j) ? tl.j.length : "n/a");
}
main().catch(e => console.log("FATAL:", e.message));
