const puppeteer = require("puppeteer");
(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
  await page.goto("https://wvizmanos.github.io/wa-aida-crm/", { waitUntil: "networkidle2", timeout: 60000 });
  await new Promise((r) => setTimeout(r, 2500));
  const clicked = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll("button"));
    const b = btns.find((x) => x.textContent && x.textContent.indexOf("WhatsApp lead") >= 0);
    if (b) { b.click(); return true; }
    return false;
  });
  await new Promise((r) => setTimeout(r, 1200));
  const state = await page.evaluate(() => ({
    bodyLen: document.body.innerText.length,
    hasHint: document.body.innerText.indexOf("Quick capture from WhatsApp") >= 0,
    hasContextField: document.body.innerText.indexOf("Chat context") >= 0,
    hasSourceWhatsapp: document.body.innerText.indexOf("WhatsApp") >= 0
  }));
  console.log("button clicked:", clicked);
  console.log("modal state:", JSON.stringify(state));
  console.log("runtime errors:", errors.length ? errors.slice(0, 5).join(" || ") : "NONE");
  await browser.close();
})().catch((e) => console.log("FATAL:", e.message));
