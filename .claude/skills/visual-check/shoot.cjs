// Screenshot the local build with the preinstalled Chromium. Usage: node shoot.cjs <outdir> <base-url> [shot...]
// Shots: methods, methods-refs, methods-mobile, sample, sample-mobile, draw-run (draws a box and runs the default event).
const { chromium } = require("playwright");
const [out, base, ...want] = process.argv.slice(2);
const all = ["methods", "methods-refs", "methods-mobile", "sample", "sample-mobile", "draw-run"];
const shots = want.length ? want : all;
const exe = process.env.CHROME || "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome";
(async () => {
  const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const errors = [];
  const page = async (w, h, hash, lang = "en") => {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    await ctx.addInitScript((l) => localStorage.setItem("b3d.lang", l), lang);
    const p = await ctx.newPage();
    p.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 160)); });
    p.on("pageerror", (e) => errors.push("PAGEERROR " + e.message.slice(0, 160)));
    await p.goto(`${base}/${hash}`, { waitUntil: "load" });
    return p;
  };
  for (const s of shots) {
    const t0 = Date.now();
    if (s.startsWith("methods")) {
      const mobile = s === "methods-mobile";
      const p = await page(mobile ? 390 : 1440, mobile ? 844 : 900, "#/methods", mobile ? "id" : "en");
      await p.waitForSelector(".refs li");
      if (s === "methods-refs") await p.locator(".refs").scrollIntoViewIfNeeded();
      await p.screenshot({ path: `${out}/${s}.png` });
      if (s === "methods") console.log("methods: paragraphs", await p.locator(".methods p").count(), "refs", await p.locator(".refs li").count(), "cites", await p.locator("a.incite").count());
    } else if (s.startsWith("sample")) {
      const mobile = s === "sample-mobile";
      const p = await page(mobile ? 390 : 1440, mobile ? 844 : 900, "#/sample");
      await p.waitForSelector("#ex-run", { timeout: 60000 });
      await p.waitForTimeout(12000);
      await p.screenshot({ path: `${out}/${s}.png` });
    } else if (s === "draw-run") {
      const p = await page(1440, 900, "#/sample");
      await p.waitForSelector("#ex-run", { timeout: 60000 });
      await p.waitForTimeout(6000);
      await p.click("#s3-draw");
      await p.waitForTimeout(1500);
      const box = await p.locator("#map").boundingBox();
      const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
      await p.mouse.move(cx - 90, cy - 70); await p.mouse.down();
      await p.mouse.move(cx + 20, cy + 20, { steps: 8 }); await p.mouse.move(cx + 90, cy + 70, { steps: 8 });
      await p.screenshot({ path: `${out}/draw-dragging.png` });
      await p.mouse.up();
      await p.waitForTimeout(2500);
      console.log("area:", await p.locator("#s3-area-txt").textContent(), "| url:", p.url().split("#")[1]);
      console.log("grid:", await p.locator("#explore-box .crs-note").first().textContent());
      await p.click("#ex-run");
      await p.waitForFunction(() => document.querySelector("#ex-status")?.textContent?.match(/Done|Selesai|Could not/), null, { timeout: 200000 });
      await p.check("#ex-max");
      await p.waitForTimeout(4000);
      console.log("stats:", await p.locator("#ex-stats").textContent());
      await p.screenshot({ path: `${out}/draw-run.png` });
    }
    console.log(s, "ok", ((Date.now() - t0) / 1000).toFixed(0) + "s");
  }
  console.log("console errors:", [...new Set(errors)].join(" || ") || "none");
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
