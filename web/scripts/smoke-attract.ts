// Capture the Rush start screen with attract mode playing behind the dialog.
// Requires the dev server, then: npx tsx scripts/smoke-attract.ts

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
  await page.goto('http://localhost:5173/', { waitUntil: 'load' });
  await page.waitForSelector('[data-start-btn]');
  for (let i = 1; i <= 6; i++) {
    await sleep(1600);
    await page.screenshot({ path: `${OUT}/attract-${i}.png` });
  }
  console.log('attract screenshots written');
} finally {
  await browser.close();
}
