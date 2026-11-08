// Browser check of a fine run (dual grid): node shoot-fine.cjs <outdir> <base url> <box W,S,E,N> <cell button r> [hours]
const { chromium } = require("playwright");
(async () => {
  const [out, base, box, r, hours] = process.argv.slice(2);
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  p.on("pageerror", (e) => console.log("pageerror:", e.message));
  await p.goto(`${base}/#/sim?box=${box}`); await p.reload(); await p.waitForTimeout(6000);
  if (hours) await p.$eval("#s-hours", (el, v) => { el.value = v; el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); }, hours);
  await p.click(`#s-fine [data-r="${r}"]`); await p.waitForTimeout(2500);
  console.log("fine msg:", await p.textContent("#s-fine-msg"));
  await p.screenshot({ path: `${out}/panel.png` });
  const t0 = Date.now();
  await p.click("#s-run");
  // main-thread responsiveness while the run goes: longest gap between animation frames
  await p.evaluate(() => { window.__gap = 0; let last = performance.now(); const f = (t) => { window.__gap = Math.max(window.__gap, t - last); last = t; if (!window.__stop) requestAnimationFrame(f); }; requestAnimationFrame(f); });
  for (let i = 0; ; i++) {
    const st = await p.textContent("#s-status");
    if (/Selesai|Done|gagal|failed|Error|kesalahan/.test(st || "")) break;
    if (i % 20 === 0) console.log(((Date.now() - t0) / 1000).toFixed(0), "s:", st);
    if (Date.now() - t0 > 240000) { console.log("gave up"); break; }
    await p.waitForTimeout(500);
  }
  const wall = (Date.now() - t0) / 1000;
  const gap = await p.evaluate(() => { window.__stop = 1; return window.__gap; });
  console.log("status:", await p.textContent("#s-status"), "| wall incl. building load", wall.toFixed(1), "s | longest frame gap during run", gap.toFixed(0), "ms");
  console.log("grid:", await p.evaluate(() => [...document.querySelectorAll("#s-stats dt")].map((d) => d.textContent + ": " + d.nextElementSibling.textContent).filter((s) => /grid|Grid|bangunan|Building|neraca|balance/.test(s)).join(" | ")));
  await p.click('#t-show [data-m="max"]').catch(() => {}); await p.waitForTimeout(1500);
  await p.screenshot({ path: `${out}/result.png` });
  // zoom in on the box centre (the panel fits the box between left 420 px and right 80 px, top 120 and bottom 140 px)
  await p.click('[data-c="x"]').catch(() => {}); await p.waitForTimeout(500);
  await p.mouse.move(800, 440);
  for (let i = 0; i < 12; i++) { await p.mouse.wheel(0, -240); await p.waitForTimeout(250); }
  await p.waitForTimeout(2000);
  await p.screenshot({ path: `${out}/zoom.png` });
  // fine export: depth GeoTIFF on the fine cells
  await p.click("#x-btn"); await p.waitForTimeout(300);
  const [dl] = await Promise.all([p.waitForEvent("download", { timeout: 60000 }), p.click('[data-x="tif"]')]);
  const fs = require("fs"); const f = `${out}/${dl.suggestedFilename()}`; await dl.saveAs(f);
  console.log("tif:", dl.suggestedFilename(), fs.statSync(f).size, "bytes");
  await b.close();
})();
