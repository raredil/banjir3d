const { chromium } = require("playwright");
const out = process.argv[2], base = process.argv[3];
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push("pageerror " + e.message));
  p.on("console", (m) => { if (m.type() === "error" && !/openfreemap|ERR_NAME|Failed to load resource/.test(m.text())) errs.push(m.text()); });
  await p.goto(base + "/#/map"); await p.waitForTimeout(7000); await p.screenshot({ path: out + "/map.png" });
  await p.goto(base + "/#/sim?box=106.835,-6.245,106.875,-6.205"); await p.reload(); await p.waitForTimeout(7000);
  await p.screenshot({ path: out + "/sim-panel.png" });
  await p.evaluate(() => { const set = (id, v) => { const e = document.querySelector("#" + id); e.value = String(v); e.dispatchEvent(new Event("input")); }; set("s-r24", 150); set("s-dur", 3); set("s-hours", 8); });
  await p.click("#s-run");
  await p.waitForFunction(() => /Selesai|Done|gagal|failed/.test(document.querySelector("#s-status")?.textContent || ""), null, { timeout: 240000, polling: 1000 });
  console.log("status:", await p.textContent("#s-status"));
  await p.waitForTimeout(1500);
  await p.screenshot({ path: out + "/sim-result.png" });
  await p.click('#t-show [data-m="max"]'); await p.waitForTimeout(800);
  await p.screenshot({ path: out + "/sim-max.png" });
  // exports
  for (const x of ["tif", "html", "json"]) {
    await p.click("#x-btn");
    const [dl] = await Promise.all([p.waitForEvent("download"), p.click(`[data-x="${x}"]`)]);
    await dl.saveAs(out + "/export-" + x + "." + (x === "tif" ? "tif" : x));
  }
  for (const r of ["data", "methods", "validation"]) { await p.goto(base + "/#/" + r); await p.waitForTimeout(1500); await p.screenshot({ path: out + "/" + r + ".png" }); }
  const m = await b.newPage({ viewport: { width: 390, height: 844 } });
  await m.goto(base + "/#/sim"); await m.waitForTimeout(5000); await m.screenshot({ path: out + "/mobile-sim.png" });
  console.log("errors:", JSON.stringify(errs.slice(0, 8)));
  await b.close();
})();
