// Same box at 30 m and at a fine cell size in the browser, maximum depth, zoomed on the box: node shoot.cjs <outdir> <base url> <box> <r list, 1 = 30 m>
const { chromium } = require("playwright");
(async () => {
  const [out, base, box, rs] = process.argv.slice(2);
  const b = await chromium.launch();
  for (const r of rs.split(",")) {
    const p = await b.newPage({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 1 });
    p.on("pageerror", (e) => console.log("pageerror:", e.message));
    await p.goto(`${base}/#/sim?box=${box}`); await p.reload(); await p.waitForTimeout(5000);
    if (r === "1") await p.click('#s-res [data-k="1"]'); else await p.click(`#s-fine [data-r="${r}"]`);
    await p.waitForTimeout(2000);
    const t0 = Date.now();
    await p.click("#s-run");
    for (;;) {
      const st = await p.textContent("#s-status");
      if (/Selesai|Done|gagal|failed|Error|kesalahan/.test(st || "")) { console.log(r, "status:", st); break; }
      if (Date.now() - t0 > 270000) { console.log(r, "gave up"); break; }
      await p.waitForTimeout(1000);
    }
    console.log(r, "wall", ((Date.now() - t0) / 1000).toFixed(0), "s |", await p.evaluate(() => [...document.querySelectorAll("#s-stats dt")].map((d) => d.textContent + ": " + d.nextElementSibling.textContent).filter((s) => /grid|Grid|bangunan|neraca|Luas|banjir/i.test(s)).join(" | ")));
    await p.click('#t-show [data-m="max"]').catch(() => {}); await p.waitForTimeout(1000);
    await p.click('[data-c="x"]').catch(() => {}); await p.waitForTimeout(300);
    await p.mouse.move(700, 430);
    for (let i = 0; i < 6; i++) { await p.mouse.wheel(0, -240); await p.waitForTimeout(250); }
    await p.waitForTimeout(2500);
    await p.screenshot({ path: `${out}/r${r}.png` });
    await p.close();
  }
  await b.close();
})();
