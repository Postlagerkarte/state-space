// Stage-2 assist check: open Zen's "Round the Bend" (training level, previews
// instant), select the hero, idle past the assist delay, and screenshot —
// the optimal landing ghost should shimmer warm gold.
// Requires the dev server: npm run dev, then: npx tsx scripts/smoke-assist.ts

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

  await page.select('[data-level]', 'round-the-bend');
  await sleep(1000);

  // hero sits top-left on this board; sweep the pointer and PARK it on the
  // hero — hover previews are instant on training levels, and the resting
  // hover keeps the assist evaluator pointed at the right piece
  const sweep: [number, number][] = [
    [500, 400],
    [420, 360],
    [380, 330],
    [345, 318],
  ];
  for (const [x, y] of sweep) {
    await page.mouse.move(x, y);
    await sleep(150);
  }

  await sleep(8000); // past ASSIST_DELAY_MS — evaluator runs and decorates
  await page.screenshot({ path: `${OUT}/assist-shimmer.png` });
  console.log('screenshot written');
} finally {
  await browser.close();
}
