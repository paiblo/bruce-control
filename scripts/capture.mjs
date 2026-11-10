import { chromium } from "playwright";
const b = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
for (const [name, viewport] of [
  ["desktop", { width: 1440, height: 1080 }],
  ["iphone", { width: 390, height: 844 }],
]) {
  const p = await b.newPage({ viewport });
  await p.goto("http://127.0.0.1:5173/bruce-control/");
  await p.screenshot({
    path: `/workspace/work/bruce-home-${name}.png`,
    fullPage: true,
  });
  await p.close();
}
await b.close();
