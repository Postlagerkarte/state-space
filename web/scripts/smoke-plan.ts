// Verify "Show the plan": open Build a Backstop in Zen, press Hint once, and
// screenshot — the hero's gold route to the pad should appear, plus a pulsing
// marker where the dot must be parked as a stopper.
// Requires the dev server, then: npx tsx scripts/smoke-plan.ts

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
  await page.goto('http://localhost:5173/?tab=play', { waitUntil: 'load' });
  await page.waitForSelector('.tab-play canvas');
  await sleep(1200);

  await page.select('[data-level]', 'build-a-backstop');
  await sleep(1000);

  await page.click('[data-hint]');
  await sleep(900);
  await page.screenshot({ path: `${OUT}/plan-view.png` });

  // second press should switch to the concrete next-move ghost run
  await page.click('[data-hint]');
  await sleep(900);
  await page.screenshot({ path: `${OUT}/plan-second-press.png` });
  console.log('plan screenshots written');
} finally {
  await browser.close();
}
