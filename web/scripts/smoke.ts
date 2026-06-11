// End-to-end smoke test: actually plays tutorial level 1 in headless Edge.
// Clicks around the hero's area (it's the only piece), presses ArrowRight to
// glide it onto the goal pad, and asserts the win overlay appears — verifying
// the whole pick -> glide -> celebrate -> stars choreography.
// Requires the dev server: npm run dev, then: npx tsx scripts/smoke.ts

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
  await page.waitForSelector('.tab-play canvas');
  await sleep(1500); // level load, board build, first frames

  // Hover the hero first: landing previews (ghosts) should appear.
  await page.mouse.move(320, 470);
  await sleep(120);
  await page.mouse.move(322, 472);
  await sleep(500);
  await page.screenshot({ path: `${OUT}/smoke-previews.png` });

  // Tutorial 1: hero is the only piece, sitting center-left. Click candidate
  // spots and press ArrowRight after each — extra inputs after the win are no-ops.
  const candidates: [number, number][] = [
    [320, 470],
    [300, 430],
    [345, 505],
    [365, 455],
    [285, 480],
  ];
  for (const [x, y] of candidates) {
    await page.mouse.click(x, y);
    await sleep(100);
    await page.keyboard.press('ArrowRight');
    await sleep(250);
    const moves = await page.evaluate(() => document.querySelector('[data-moves]')?.textContent);
    if (moves === '1') break; // solved — stop poking so we can catch the fireworks
  }

  await sleep(450); // mid-burst
  await page.screenshot({ path: `${OUT}/smoke-confetti.png` });

  await sleep(1500); // overlay + stars staggered in
  await page.screenshot({ path: `${OUT}/smoke-win.png` });

  const result = await page.evaluate(() => {
    const overlay = document.querySelector<HTMLElement>('[data-overlay]');
    const stars = document.querySelectorAll('.overlay-card .star:not(.empty)').length;
    const moves = document.querySelector('[data-moves]')?.textContent;
    return { overlayVisible: !!overlay && !overlay.hidden, stars, moves };
  });
  console.log('smoke result:', JSON.stringify(result));
  if (!result.overlayVisible) {
    console.error('FAIL: win overlay did not appear');
    process.exit(1);
  }
  console.log('PASS');
} finally {
  await browser.close();
}
