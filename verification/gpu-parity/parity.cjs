const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch({ args: ["--enable-unsafe-webgpu", "--use-webgpu-adapter=swiftshader", "--enable-features=Vulkan"] });
  const p = await b.newPage();
  p.on("console", (m) => console.log("console:", m.text()));
  await p.goto(process.argv[2], { timeout: 60000 });
  await p.waitForFunction(() => window.__result, null, { timeout: 280000, polling: 1000 });
  console.log(JSON.stringify(await p.evaluate(() => window.__result)));
  await b.close();
})();
