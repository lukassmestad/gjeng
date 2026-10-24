// Records a ~20 second walkthrough video of the demo (for VibeOff), from Emma's point of view,
// while two other made-up people (Jonas and Sara) chat and call in other browser windows.
// Run "npm run build" first. Saves captures/walkthrough.webm.
//
//   node scripts/walkthrough.mjs
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PORT = 3300;
const URL = `http://localhost:${PORT}`;
const OUT = path.resolve('captures');
const SIZE = { width: 1280, height: 800 };
fs.mkdirSync(OUT, { recursive: true });

const server = spawn(process.execPath, ['server/index.js', '--demo'], {
  env: { ...process.env, PORT: String(PORT), DATA_FILE: path.join(os.tmpdir(), `gjeng-video-${Date.now()}.json`) },
  stdio: 'ignore',
});

async function waitForServer() {
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch(URL)).ok) return;
    } catch {
      // Not up yet.
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('Server did not start');
}

// A fake microphone that beeps, so the call shows someone talking.
const browser = await chromium.launch({
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'],
});
const context = (options = {}) => browser.newContext({ viewport: SIZE, permissions: ['microphone'], ...options });

async function jumpIn(page, name) {
  await page.goto(URL);
  await page.getByRole('button', { name: `Jump in as ${name}` }).click();
  await page.getByRole('heading', { name: 'Groups', exact: true }).waitFor();
}

const open = (page, name) => page.getByRole('navigation', { name: 'Chats' }).getByRole('button', { name }).first().click();
const pause = (page, ms) => page.waitForTimeout(ms);

try {
  await waitForServer();

  // The other two, in windows that aren't recorded.
  const jonas = await (await context()).newPage();
  await jumpIn(jonas, 'Jonas');
  await open(jonas, 'Gym crew');
  const sara = await (await context()).newPage();
  await jumpIn(sara, 'Sara');
  await open(sara, 'Gym crew');

  // Emma's window is the one being filmed.
  const recorded = await context({ recordVideo: { dir: OUT, size: SIZE } });
  const emma = await recorded.newPage();
  await emma.goto(URL);
  await pause(emma, 1500);
  await emma.getByRole('button', { name: 'Jump in as Emma' }).click();
  await emma.getByRole('heading', { level: 1, name: 'Gym crew' }).waitFor();
  await pause(emma, 1200);

  // Jonas types and sends; Emma reacts.
  const jonasBox = jonas.getByRole('textbox', { name: /^Message/ });
  await jonasBox.pressSequentially('Leg day in 10? 💪', { delay: 60 });
  await pause(emma, 600);
  await jonasBox.press('Enter');
  const message = emma.getByRole('log').locator('.message', { hasText: 'Leg day in 10?' });
  await message.waitFor();
  await pause(emma, 700);
  await message.locator('.message-text').hover();
  await pause(emma, 500);
  await message.getByRole('button', { name: 'React with 🔥' }).click();
  await emma.mouse.move(640, 760);
  await pause(emma, 700);

  // A GIF sticker from the picker.
  await emma.getByRole('button', { name: 'Add an emoji or GIF' }).click();
  await emma.getByRole('tab', { name: 'GIFs' }).click();
  await emma.getByRole('button', { name: 'Send Leg day GIF' }).locator('img').waitFor();
  await pause(emma, 1200);
  await emma.getByRole('button', { name: 'Send Leg day GIF' }).click();
  await pause(emma, 1200);

  // Jonas starts a call, Emma joins and sees him talking.
  await jonas.getByRole('button', { name: 'Start call' }).click();
  const stage = emma.getByRole('region', { name: 'Call' });
  await stage.getByRole('button', { name: 'Join call' }).click();
  await stage.getByRole('button', { name: 'Mute', exact: true }).click();
  await stage.getByRole('listitem', { name: /^Jonas.*talking/ }).waitFor({ timeout: 15000 });
  await pause(emma, 2500);

  // Sara's profile card.
  await emma.getByRole('complementary', { name: 'Members' }).getByRole('button', { name: 'Sara ✨', exact: true }).click();
  await emma.getByRole('dialog', { name: 'Sara ✨' }).getByRole('region', { name: 'Mutual friends' }).waitFor();
  await pause(emma, 1800);
  await emma.getByRole('button', { name: 'Close profile' }).click();

  // A different look, from the appearance settings.
  await emma.getByRole('button', { name: 'Profile settings' }).click();
  await emma.getByRole('navigation', { name: 'Settings sections' }).getByRole('button', { name: 'Appearance' }).click();
  await pause(emma, 800);
  await emma.getByRole('radio', { name: 'Midnight' }).click();
  await pause(emma, 1200);
  await emma.getByRole('button', { name: 'Close settings' }).click();
  await pause(emma, 1500);

  const video = emma.video();
  await recorded.close();
  const target = path.join(OUT, 'walkthrough.webm');
  fs.renameSync(await video.path(), target);
  console.log(`Saved ${target} (${(fs.statSync(target).size / 1e6).toFixed(1)} MB)`);
} finally {
  await browser.close();
  server.kill();
}
