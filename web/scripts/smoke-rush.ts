// Rush mode smoke test: start screen -> click START (run begins, HUD live)
// -> with a tiny ?bank= the run times out -> death screen with score.
// Requires the dev server: npm run dev, then: npx tsx scripts/smoke-rush.ts

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
  await page.goto('http://localhost:5173/?bank=4', { waitUntil: 'load' });
  await page.waitForSelector('[data-start-btn]');
  await sleep(800);
  await page.screenshot({ path: `${OUT}/rush-start.png` });

  await page.click('[data-start-btn]');
  await sleep(1200); // run begins: board pops in, bar drains
  await page.screenshot({ path: `${OUT}/rush-running.png` });

  const running = await page.evaluate(() => {
    const hud = document.querySelector<HTMLElement>('[data-hud]');
    const fill = document.querySelector<HTMLElement>('[data-time-fill]');
    return { hudVisible: !!hud && !hud.hidden, barWidth: fill?.style.width ?? '' };
  });

  await sleep(4000); // 4s bank drains out -> death
  await page.screenshot({ path: `${OUT}/rush-death.png` });
  const death = await page.evaluate(() => {
    const overlay = document.querySelector<HTMLElement>('[data-death]');
    return {
      deathVisible: !!overlay && !overlay.hidden,
      stats: document.querySelector('[data-death-stats]')?.textContent ?? '',
    };
  });

  console.log('rush smoke:', JSON.stringify({ ...running, ...death }));
  if (!running.hudVisible || !death.deathVisible) {
    console.error('FAIL');
    process.exit(1);
  }
  console.log('PASS');
} finally {
  await browser.close();
}
