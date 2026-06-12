// Architect flow end-to-end: with ?arch=1 the first board arrives unsolvable.
// We sweep clicks across the board until the validator accepts a placement
// (rejections knock, acceptance builds the wall and clears the targeting note),
// proving generation -> arming -> validation -> commit in a real browser.
// Also seeds a best run so the QUICK START button is visible on the start card.
// Requires the dev server, then: npx tsx scripts/smoke-architect.ts

import puppeteer from 'puppeteer-core';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const OUT = (process.env.TEMP ?? '.').replace(/\\/g, '/');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: true,
  args: ['--no-sandbox', '--disable-gpu'],
  defaultViewport: { width: 1500, height: 900 },
});

try {
  const page = await browser.newPage();
  page.on('pageerror', (err) => console.error('PAGE ERROR:', String(err)));
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem('statespace.rush.best', JSON.stringify({ score: 5000, boards: 15 }));
  });
  await page.goto('http://localhost:5173/?arch=1&bank=90', { waitUntil: 'load' });
  await page.waitForSelector('[data-start-btn]');
  await sleep(800);

  const quickVisible = await page.evaluate(
    () => !document.querySelector<HTMLElement>('[data-quick-btn]')!.hidden,
  );
  await page.screenshot({ path: `${OUT}/arch-0-start.png` });

  await page.click('[data-start-btn]');
  await sleep(1500);
  const noteShown = await page.evaluate(
    () => !document.querySelector<HTMLElement>('[data-target-note]')!.hidden,
  );
  await page.screenshot({ path: `${OUT}/arch-1-armed.png` });

  // sweep the playable area until the validator accepts a cell
  let fixed = false;
  outer: for (let y = 240; y <= 600; y += 55) {
    for (let x = 330; x <= 850; x += 55) {
      await page.mouse.click(x, y);
      await sleep(90);
      const hidden = await page.evaluate(
        () => document.querySelector<HTMLElement>('[data-target-note]')!.hidden,
      );
      if (hidden) {
        fixed = true;
        break outer;
      }
    }
  }
  await sleep(500);
  await page.screenshot({ path: `${OUT}/arch-2-fixed.png` });

  console.log('architect smoke:', JSON.stringify({ quickVisible, noteShown, fixed }));
  if (!quickVisible || !noteShown || !fixed) {
    console.error('FAIL');
    process.exit(1);
  }
  console.log('PASS');
} finally {
  await browser.close();
}
