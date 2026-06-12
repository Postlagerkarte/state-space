// Verify the camera control split in Zen: left-drag over empty space must NOT
// orbit (the accidental-rotation bug), right-drag MUST orbit.
// Requires the dev server, then: npx tsx scripts/smoke-rotate.ts

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
  await sleep(1500);
  await page.screenshot({ path: `${OUT}/rotate-0-base.png` });

  // empty space high-left of the board (background) — proves camera behavior
  // in isolation from piece dragging
  const ax = 150;
  const ay = 170;
  const bx = 470;
  const by = 175;

  // LEFT-drag across empty space — must leave the view unchanged
  await page.mouse.move(ax, ay);
  await page.mouse.down({ button: 'left' });
  for (let i = 1; i <= 8; i++) await page.mouse.move(ax + ((bx - ax) * i) / 8, ay), await sleep(20);
  await page.mouse.up({ button: 'left' });
  await sleep(400);
  await page.screenshot({ path: `${OUT}/rotate-1-leftdrag.png` });

  // RIGHT-drag across the board — must orbit the camera
  await page.mouse.move(ax, ay);
  await page.mouse.down({ button: 'right' });
  for (let i = 1; i <= 8; i++) await page.mouse.move(ax + ((bx - ax) * i) / 8, ay), await sleep(20);
  await page.mouse.up({ button: 'right' });
  await sleep(600);
  await page.screenshot({ path: `${OUT}/rotate-2-rightdrag.png` });

  console.log('rotate screenshots written');
} finally {
  await browser.close();
}
