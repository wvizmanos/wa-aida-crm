/* Browser click-smoke for the multichannel Phase 1 controls.
 * Same shape as modal-smoke.cjs, but pointed at a local build so it can run
 * after `npm run build` and before deploy.
 *
 *   npm run build
 *   npx vite preview --port 4173 --strictPort
 *   node multichannel-smoke.cjs            # SMOKE_URL=... to override
 *
 * Clicks the new controls, asserts they render, and fails on any runtime
 * error. Runs in demo mode, so it must make zero backend calls.
 */
const puppeteer = require("puppeteer");

const URL = process.env.SMOKE_URL || "http://localhost:4173/wa-aida-crm/";
const results = [];

function check(name, pass, detail) {
  results.push({ name, pass });
  console.log((pass ? "PASS  " : "FAIL  ") + name + (detail ? "  -> " + detail : ""));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 }); // Huawei Nova 5T-ish
  const errors = [];
  const backendHits = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
  page.on("request", (r) => { if (r.url().includes("script.google.com")) backendHits.push(r.url()); });

  await page.goto(URL, { waitUntil: "networkidle2", timeout: 60000 });
  await sleep(1200);

  check("app boots with content", await page.evaluate(() => document.body.innerText.length > 200));

  // --- open the first lead's drawer -------------------------------------
  const opened = await page.evaluate(() => {
    const card = document.querySelector("div.cursor-pointer");
    if (!card) return false;
    card.click();
    return true;
  });
  await sleep(900);
  const drawerUp = await page.evaluate(() => document.body.innerText.includes("Activity log"));
  check("lead drawer opens", opened && drawerUp);

  // --- existing WhatsApp chip must be untouched --------------------------
  const wa = await page.evaluate(() => {
    const a = Array.from(document.querySelectorAll("a")).find((x) => (x.textContent || "").includes("Chat on WhatsApp"));
    return a ? a.getAttribute("href") : null;
  });
  check("WhatsApp chip unchanged", !!wa && wa.startsWith("https://wa.me/"), wa || "(missing)");

  // --- new no-infrastructure deep links ---------------------------------
  const viber = await page.evaluate(() => {
    const a = document.querySelector('a[data-channel="viber"]');
    return a ? a.getAttribute("href") : null;
  });
  check("Viber deep link", !!viber && viber.startsWith("viber://chat?number=%2B63"), viber || "(missing)");

  const sms = await page.evaluate(() => {
    const a = document.querySelector('a[data-channel="sms"]');
    return a ? a.getAttribute("href") : null;
  });
  check("SMS deep link", !!sms && sms.startsWith("sms:+63"), sms || "(missing)");

  // --- Email quotation composer ----------------------------------------
  const toggled = await page.evaluate(() => {
    const b = document.getElementById("email-quotation-toggle");
    if (!b) return false;
    b.click();
    return true;
  });
  await sleep(700);
  check("Email quotation opens", toggled);

  const composer = await page.evaluate(() => {
    const f = document.querySelector('iframe[title="Quotation preview"]');
    const srcdoc = f ? f.getAttribute("srcdoc") || "" : "";
    return {
      to: !!document.getElementById("quotation-to"),
      title: !!document.getElementById("quotation-title"),
      send: !!document.getElementById("quotation-send"),
      len: srcdoc.length,
      branded: srcdoc.includes("#25d366") && srcdoc.includes("#16213e"),
    };
  });
  check("composer fields render", composer.to && composer.title && composer.send, JSON.stringify(composer));
  check("branded quotation preview renders", composer.len > 400 && composer.branded, "srcdoc chars=" + composer.len);

  // --- validation before anything is sent -------------------------------
  await page.click("#quotation-send");
  await sleep(500);
  check("empty recipient is rejected", (await page.evaluate(() => document.body.innerText)).includes("Enter a valid recipient email"));

  await page.type("#quotation-to", "owner@shop.ph");
  await page.click("#quotation-send");
  await sleep(500);
  check("missing title is rejected", (await page.evaluate(() => document.body.innerText)).includes("Give the quotation a title first"));

  // --- the preview follows the composer ---------------------------------
  await page.type("#quotation-title", "Inventory system setup");
  const amountEl = await page.$('input[placeholder="Amount (PHP)"]');
  await amountEl.click({ clickCount: 3 });
  await amountEl.type("85000");
  const servicesEl = await page.$('textarea[placeholder="What is included - one item per line"]');
  await servicesEl.click();
  await servicesEl.type("Barcode inventory setup\nStaff training");
  await sleep(700);

  const preview = await page.evaluate(() => {
    const f = document.querySelector('iframe[title="Quotation preview"]');
    const s = f ? f.getAttribute("srcdoc") || "" : "";
    return {
      title: s.includes("Inventory system setup"),
      amount: s.includes("85,000"),
      service: s.includes("Barcode inventory setup"),
    };
  });
  check("preview follows the composer", preview.title && preview.amount && preview.service, JSON.stringify(preview));

  check("zero backend calls in demo mode", backendHits.length === 0, backendHits.length + " hit(s)");
  check("zero runtime errors", errors.length === 0, errors.slice(0, 4).join(" || ") || "NONE");

  await browser.close();

  const failed = results.filter((r) => !r.pass);
  console.log("\n" + (results.length - failed.length) + "/" + results.length + " checks passed");
  if (failed.length) { console.log("FAILED: " + failed.map((f) => f.name).join(", ")); process.exit(1) }
})().catch((e) => { console.log("FATAL:", e.message); process.exit(1) });
